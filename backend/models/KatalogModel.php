<?php
// Sisi penyewa (Beranda, Katalog, Detail Kos): hanya kos & kamar yang sudah publish yang terlihat.
class KatalogModel
{
    /** word_similarity minimal agar dianggap cocok: "sukarno"~"soekarno", "hata"~"hatta". */
    private const AMBANG_MIRIP = 0.45;

    /** Kata yang tidak membantu pencarian (semua alamat punya "Jl.", semua nama punya "Kos"). */
    private const KATA_UMUM = ['jl', 'jln', 'jalan', 'gg', 'gang', 'no', 'kos', 'kost', 'di', 'dekat'];

    private const URUT = [
        'termurah' => 'harga_mulai ASC',
        'termahal' => 'harga_mulai DESC',
        'terdekat' => 's.jarak_kampus_km ASC NULLS LAST',
        'rating'   => 'r.rating_rata DESC NULLS LAST',
    ];

    /** "Jl. Sukarno Hata" -> ['sukarno', 'hata']. Kalau semua kata umum, pakai teks aslinya. */
    private static function kataKunci(string $q): array
    {
        $semua = preg_split('/[^\p{L}\p{N}-]+/u', mb_strtolower(trim($q)), -1, PREG_SPLIT_NO_EMPTY);
        $kata = array_values(array_filter($semua, fn($k) => mb_strlen($k) >= 2 && !in_array($k, self::KATA_UMUM, true)));
        return array_slice($kata ?: [trim($q)], 0, 5);
    }

    /** pg_trgm dipasang lewat migrasi 003; tanpa itu pencarian tetap jalan tanpa toleransi salah ketik. */
    private static function adaTrigram(): bool
    {
        static $ada = null;
        return $ada ??= (bool) DB::nilai("SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'");
    }

    /**
     * Kartu kos di Beranda, Katalog, dan Favorit. Satu kartu = satu kos, harga = kamar termurah yang publish.
     * $f: q, tipe_kos, kecamatan, harga_min, harga_max, fasilitas_ids, tersedia, favorit_saja, urut, limit, offset
     */
    public static function list(array $f, ?int $penggunaId): array
    {
        $where = ['s.is_published', 'k.is_published'];
        $p = [];
        if (!empty($f['q'])) {
            // Setiap kata harus cocok ke nama/alamat/kecamatan/kota: persis (ILIKE) atau mirip (pg_trgm)
            $teks = "(s.nama_kos || ' ' || s.alamat || ' ' || s.kecamatan || ' ' || s.kota)";
            foreach (self::kataKunci($f['q']) as $i => $kata) {
                $p["q$i"] = '%' . addcslashes($kata, '%_\\') . '%'; // % dan _ ketikan pengguna bukan wildcard
                if (self::adaTrigram()) {
                    $where[] = "($teks ILIKE :q$i OR word_similarity(:m$i, $teks) >= " . self::AMBANG_MIRIP . ')';
                    $p["m$i"] = $kata;
                } else {
                    $where[] = "$teks ILIKE :q$i";
                }
            }
        }
        if (!empty($f['tipe_kos'])) {
            $where[] = 's.tipe_kos = :tipe::tipe_kos_enum';
            $p['tipe'] = $f['tipe_kos'];
        }
        if (!empty($f['kecamatan'])) {
            $where[] = 's.kecamatan = :kec';
            $p['kec'] = $f['kecamatan'];
        }
        if (!empty($f['favorit_saja']) && $penggunaId) {
            $where[] = 'EXISTS (SELECT 1 FROM favorit fv WHERE fv.kos_id = s.id AND fv.pengguna_id = :fav_p)';
            $p['fav_p'] = $penggunaId;
        }
        if (!empty($f['tersedia'])) {
            $where[] = "k.status = 'Tersedia'";
        }
        // Fasilitas: kos lolos kalau SEMUA fasilitas yang dicentang ada (di kamar atau di gedung)
        if (!empty($f['fasilitas_ids'])) {
            $where[] = '(SELECT COUNT(DISTINCT x.fid) FROM (
                            SELECT fasilitas_id AS fid FROM fasilitas_kamar WHERE kamar_id = k.id
                            UNION SELECT fasilitas_id FROM fasilitas_kos WHERE kos_id = s.id) x
                          WHERE x.fid = ANY(:fas::int[])) = :jml_fas';
            $p['fas'] = pgIntArray($f['fasilitas_ids']);
            $p['jml_fas'] = count($f['fasilitas_ids']);
        }
        $having = [];
        if (isset($f['harga_min'])) {
            $having[] = 'MIN(k.harga_per_bulan) >= :hmin';
            $p['hmin'] = $f['harga_min'];
        }
        if (isset($f['harga_max'])) {
            $having[] = 'MIN(k.harga_per_bulan) <= :hmax';
            $p['hmax'] = $f['harga_max'];
        }
        $urut = self::URUT[$f['urut'] ?? ''] ?? 'r.rating_rata DESC NULLS LAST, s.jarak_kampus_km ASC NULLS LAST';
        $favorit = $penggunaId ? 'EXISTS (SELECT 1 FROM favorit fv WHERE fv.kos_id = s.id AND fv.pengguna_id = ' . (int) $penggunaId . ')' : 'FALSE';

        $sql = "
            SELECT s.id, s.nama_kos, s.tipe_kos, s.alamat, s.kecamatan, s.kota, s.jarak_kampus_km,
                   (SELECT url_foto FROM foto_kos f WHERE f.kos_id = s.id ORDER BY f.is_utama DESC, f.id LIMIT 1) AS foto_utama,
                   MIN(k.harga_per_bulan) AS harga_mulai,
                   COUNT(k.id) FILTER (WHERE k.status = 'Tersedia') AS kamar_tersedia,
                   COUNT(k.id) AS total_kamar,
                   r.rating_rata, COALESCE(r.jumlah_ulasan, 0) AS jumlah_ulasan,
                   (SELECT COALESCE(json_agg(fa.nama_fasilitas ORDER BY fa.id), '[]')
                      FROM fasilitas_kos fk JOIN fasilitas fa ON fa.id = fk.fasilitas_id
                     WHERE fk.kos_id = s.id) AS fasilitas,
                   $favorit AS is_favorit
              FROM kos s
              JOIN kamar k ON k.kos_id = s.id
              LEFT JOIN (" . KosModel::SQL_RATING . ') r ON r.kos_id = s.id
             WHERE ' . implode(' AND ', $where) . '
             GROUP BY s.id, r.rating_rata, r.jumlah_ulasan' . ($having ? ' HAVING ' . implode(' AND ', $having) : '');

        // Satu query: COUNT(*) OVER() menghitung total hasil (setelah GROUP BY/HAVING) sebelum LIMIT
        $baris = DB::semua(preg_replace('/^\s*SELECT /', 'SELECT COUNT(*) OVER() AS total_semua, ', $sql) .
            " ORDER BY $urut, s.id LIMIT :limit OFFSET :offset", $p + ['limit' => $f['limit'] ?? 12, 'offset' => $f['offset'] ?? 0]);
        $total = match (true) {
            (bool) $baris => (int) $baris[0]['total_semua'],
            // Halaman di luar jangkauan: total tetap dibutuhkan supaya frontend bisa kembali ke halaman terakhir
            ($f['offset'] ?? 0) > 0 => (int) DB::nilai("SELECT COUNT(*) FROM ($sql) x", $p),
            default => 0,
        };

        return ['total' => $total, 'items' => array_map(function ($r) {
            unset($r['total_semua']);
            $r['fasilitas'] = json_decode($r['fasilitas'], true);
            return angka($r, ['jarak_kampus_km', 'harga_mulai', 'rating_rata']);
        }, $baris)];
    }

    /** Pilihan filter: kecamatan yang punya kos publish + rentang harga + fasilitas. */
    public static function opsiFilter(): array
    {
        return [
            'kecamatan' => DB::kolom('SELECT DISTINCT kecamatan FROM kos WHERE is_published ORDER BY kecamatan'),
            'harga'     => angka(DB::satu('SELECT MIN(harga_per_bulan) AS min, MAX(harga_per_bulan) AS max FROM v_katalog_kamar'), ['min', 'max']),
            'fasilitas' => FasilitasModel::list(null),
        ];
    }

    /** Halaman Detail Kos. Kontak pemilik (WA) hanya dikirim kalau pengunjung sudah login. */
    public static function detail(int $kosId, ?array $user): array
    {
        $kos = DB::satu('
            SELECT s.id, s.nama_kos, s.tipe_kos, s.alamat, s.kecamatan, s.kota, s.latitude, s.longitude,
                   s.jarak_kampus_km, s.google_maps_url, s.deskripsi, s.peraturan_kos, s.created_at,
                   p.nama_lengkap AS pemilik_nama, p.no_telepon AS pemilik_telepon, p.created_at AS pemilik_sejak
              FROM kos s JOIN pengguna p ON p.id = s.pengguna_id
             WHERE s.id = :id AND s.is_published', ['id' => $kosId])
            ?? Response::notFound('Kos tidak ditemukan atau belum dipublikasikan');
        $kos = angka($kos, ['latitude', 'longitude', 'jarak_kampus_km']);
        $kos['pemilik_inisial'] = inisial($kos['pemilik_nama']);
        $kos['pemilik_wa'] = $user ? linkWhatsApp($kos['pemilik_telepon']) : null;
        if (!$user) {
            unset($kos['pemilik_telepon']);
        }

        $kos['foto'] = DB::semua('SELECT id, url_foto, kategori, is_utama FROM foto_kos WHERE kos_id = :id ORDER BY is_utama DESC, id', ['id' => $kosId]);
        $kos['fasilitas_bersama'] = DB::semua('
            SELECT f.id, f.nama_fasilitas, f.kategori FROM fasilitas_kos fk JOIN fasilitas f ON f.id = fk.fasilitas_id
             WHERE fk.kos_id = :id ORDER BY f.id', ['id' => $kosId]);
        $kos['kamar'] = array_map(function ($k) {
            $k['fasilitas'] = json_decode($k['fasilitas'], true);
            $k['foto'] = json_decode($k['foto'], true);
            return angka($k, ['harga_per_bulan', 'deposit_kunci', 'panjang_m', 'lebar_m']);
        }, DB::semua("
            SELECT k.id, k.nomor_kamar, k.tipe_kamar, k.harga_per_bulan, k.deposit_kunci, k.status,
                   d.panjang_m, d.lebar_m, d.kapasitas, d.lantai, d.tipe_kasur, d.listrik, d.ventilasi,
                   d.kamar_mandi, d.deskripsi_suasana, d.minimal_sewa_bulan, d.peraturan_kamar,
                   (SELECT COALESCE(json_agg(json_build_object('id', f.id, 'nama', f.nama_fasilitas, 'kategori', f.kategori) ORDER BY f.id), '[]')
                      FROM fasilitas_kamar fk JOIN fasilitas f ON f.id = fk.fasilitas_id WHERE fk.kamar_id = k.id) AS fasilitas,
                   (SELECT COALESCE(json_agg(fo.url_foto ORDER BY fo.urutan, fo.id), '[]')
                      FROM foto_kamar fo WHERE fo.kamar_id = k.id) AS foto
              FROM kamar k LEFT JOIN detail_kamar d ON d.kamar_id = k.id
             WHERE k.kos_id = :id AND k.is_published
             ORDER BY k.harga_per_bulan, k.nomor_kamar", ['id' => $kosId]));

        $kos['ulasan'] = UlasanModel::listByKos($kosId, 6, 0);
        $kos['is_favorit'] = $user && $user['role'] === 'penyewa'
            && (bool) DB::nilai('SELECT 1 FROM favorit WHERE pengguna_id = :p AND kos_id = :k', ['p' => $user['id'], 'k' => $kosId]);
        return $kos;
    }
}
