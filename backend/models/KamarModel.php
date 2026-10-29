<?php
// Kamar + detail_kamar (relasi 1:1) + fasilitas kamar, milik pemilik yang login.
class KamarModel
{
    public const RULES_KAMAR = [
        'nomor_kamar'     => 'required|string|max:20',
        'tipe_kamar'      => 'required|string|max:100',
        'harga_per_bulan' => 'required|numeric|min:0',
        'deposit_kunci'   => 'numeric|min:0',
        'is_published'    => 'bool',
    ];

    public const RULES_DETAIL = [
        'panjang_m'          => 'required|numeric|min:0.5',
        'lebar_m'            => 'required|numeric|min:0.5',
        'kapasitas'          => 'int|min:1',
        'lantai'             => 'required|int|min:0',
        'tipe_kasur'         => 'string|max:50',
        'listrik'            => 'string|max:50',
        'ventilasi'          => 'string|max:50',
        'kamar_mandi'        => 'string|max:50',
        'deskripsi_suasana'  => 'string',
        'minimal_sewa_bulan' => 'int|min:1|max:12',
        'peraturan_kamar'    => 'string',
    ];

    /** Ambil kamar beserta nama kos-nya, 404 kalau kamar bukan milik pemilik ini. */
    public static function pastikanMilik(int $kamarId, int $adminId): array
    {
        return DB::satu('
            SELECT k.*, s.nama_kos FROM kamar k JOIN kos s ON s.id = k.kos_id
             WHERE k.id = :id AND s.pengguna_id = :admin', ['id' => $kamarId, 'admin' => $adminId])
            ?? Response::notFound('Kamar tidak ditemukan');
    }

    /** Tabel "Kelola Kamar & Unit". Filter opsional: status, tipe_kamar, q (no. kamar, tipe, nama penyewa). */
    public static function listByKos(int $kosId, array $filter): array
    {
        $where = ['k.kos_id = :kos'];
        $p = ['kos' => $kosId];
        if (!empty($filter['status'])) {
            $where[] = 'k.status = :status::status_kamar_enum';
            $p['status'] = $filter['status'];
        }
        if (!empty($filter['tipe_kamar'])) {
            $where[] = 'k.tipe_kamar = :tipe';
            $p['tipe'] = $filter['tipe_kamar'];
        }
        if (!empty($filter['q'])) {
            // PDO native prepare: placeholder yang sama tidak boleh dipakai dua kali
            $where[] = '(k.nomor_kamar ILIKE :q1 OR k.tipe_kamar ILIKE :q2 OR p.nama_lengkap ILIKE :q3)';
            $p += array_fill_keys(['q1', 'q2', 'q3'], '%' . $filter['q'] . '%');
        }

        // Penghuni = reservasi Disetujui yang masa sewanya belum berakhir
        $baris = DB::semua("
            SELECT k.id, k.nomor_kamar, k.tipe_kamar, k.harga_per_bulan, k.deposit_kunci, k.status, k.is_published,
                   d.lantai, d.panjang_m, d.lebar_m, d.kapasitas, d.kamar_mandi,
                   (SELECT url_foto FROM foto_kamar f WHERE f.kamar_id = k.id ORDER BY urutan, id LIMIT 1) AS foto,
                   (SELECT COALESCE(json_agg(f.nama_fasilitas ORDER BY f.id), '[]')
                      FROM fasilitas_kamar fk JOIN fasilitas f ON f.id = fk.fasilitas_id WHERE fk.kamar_id = k.id) AS fasilitas,
                   p.nama_lengkap AS penghuni, p.no_telepon AS penghuni_telepon,
                   r.id AS reservasi_id, r.tanggal_keluar AS sewa_berakhir
              FROM kamar k
              LEFT JOIN detail_kamar d ON d.kamar_id = k.id
              LEFT JOIN LATERAL (
                    SELECT rv.id, rv.pengguna_id, rv.tanggal_keluar FROM reservasi rv
                     WHERE rv.kamar_id = k.id AND rv.status_reservasi = 'Disetujui' AND CURRENT_DATE < rv.tanggal_keluar
                     ORDER BY rv.tanggal_masuk LIMIT 1
                   ) r ON TRUE
              LEFT JOIN pengguna p ON p.id = r.pengguna_id
             WHERE " . implode(' AND ', $where) . '
             ORDER BY d.lantai NULLS LAST, k.nomor_kamar', $p);
        return array_map(function ($r) {
            $r['fasilitas'] = json_decode($r['fasilitas'], true);
            return angka($r, ['harga_per_bulan', 'deposit_kunci', 'panjang_m', 'lebar_m']);
        }, $baris);
    }

    /** Form Edit Kamar: kamar + detail + fasilitas + foto + inventaris. */
    public static function find(int $kamarId, int $adminId): array
    {
        $kamar = angka(self::pastikanMilik($kamarId, $adminId), ['harga_per_bulan', 'deposit_kunci']);
        $detail = DB::satu('SELECT * FROM detail_kamar WHERE kamar_id = :id', ['id' => $kamarId]);
        $kamar['detail'] = $detail ? angka($detail, ['panjang_m', 'lebar_m']) : null;
        $kamar['fasilitas'] = DB::semua('
            SELECT f.id, f.nama_fasilitas, f.kategori, f.ikon
              FROM fasilitas_kamar fk JOIN fasilitas f ON f.id = fk.fasilitas_id
             WHERE fk.kamar_id = :id ORDER BY f.id', ['id' => $kamarId]);
        $kamar['foto'] = DB::semua('SELECT id, url_foto, urutan FROM foto_kamar WHERE kamar_id = :id ORDER BY urutan, id', ['id' => $kamarId]);
        $kamar['inventaris'] = InventarisModel::listByKamar($kamarId);
        return $kamar;
    }

    /** Form "Tambah Kamar": kamar + detail + fasilitas disimpan sekaligus dalam satu transaksi. */
    public static function create(int $kosId, array $kamar, array $detail, array $fasilitasIds): int
    {
        return DB::transaksi(function () use ($kosId, $kamar, $detail, $fasilitasIds) {
            $id = DB::insert('kamar', $kamar + ['kos_id' => $kosId])['id'];
            DB::insert('detail_kamar', $detail + ['kamar_id' => $id], 'kamar_id');
            self::simpanFasilitas($id, $fasilitasIds);
            return $id;
        });
    }

    /** $fasilitasIds null = fasilitas tidak diubah. */
    public static function update(int $kamarId, int $adminId, array $kamar, array $detail, ?array $fasilitasIds): void
    {
        self::pastikanMilik($kamarId, $adminId);
        DB::transaksi(function () use ($kamarId, $kamar, $detail, $fasilitasIds) {
            DB::update('kamar', $kamar, 'id = :id', ['id' => $kamarId]);
            DB::update('detail_kamar', $detail, 'kamar_id = :id', ['id' => $kamarId], updatedAt: false);
            if ($fasilitasIds !== null) {
                DB::query('DELETE FROM fasilitas_kamar WHERE kamar_id = :id', ['id' => $kamarId]);
                self::simpanFasilitas($kamarId, $fasilitasIds);
            }
        });
    }

    /**
     * Status Dipesan/Terisi diatur trigger dari reservasi. Pemilik hanya boleh menandai 'Perbaikan'
     * atau mengembalikannya; saat dikembalikan, status dihitung ulang dari reservasi aktif.
     */
    public static function setPerbaikan(int $kamarId, int $adminId, bool $perbaikan): string
    {
        self::pastikanMilik($kamarId, $adminId);
        return DB::nilai($perbaikan
            ? "UPDATE kamar SET status = 'Perbaikan', updated_at = CURRENT_TIMESTAMP WHERE id = :id RETURNING status"
            : "UPDATE kamar k SET updated_at = CURRENT_TIMESTAMP, status = COALESCE((
                   SELECT CASE WHEN bool_or(status_reservasi = 'Disetujui') THEN 'Terisi' ELSE 'Dipesan' END::status_kamar_enum
                     FROM reservasi r
                    WHERE r.kamar_id = k.id AND r.status_reservasi IN ('Pending', 'Survei', 'Disetujui')
                      AND r.tanggal_keluar > CURRENT_DATE
                   HAVING COUNT(*) > 0), 'Tersedia')
                WHERE id = :id RETURNING status", ['id' => $kamarId]);
    }

    /** Ditolak FK (RESTRICT) kalau kamar sudah punya riwayat reservasi -> pesan ramah dari helpers.php. */
    public static function delete(int $kamarId, int $adminId): void
    {
        self::pastikanMilik($kamarId, $adminId);
        $foto = DB::kolom('SELECT url_foto FROM foto_kamar WHERE kamar_id = :id', ['id' => $kamarId]);
        DB::query('DELETE FROM kamar WHERE id = :id', ['id' => $kamarId]);
        array_walk($foto, fn($url) => FotoModel::hapusFile($url)); // baris foto_kamar ikut terhapus (CASCADE)
    }

    private static function simpanFasilitas(int $kamarId, array $ids): void
    {
        if ($ids && DB::query("
                INSERT INTO fasilitas_kamar (kamar_id, fasilitas_id)
                SELECT :kamar, id FROM fasilitas WHERE id = ANY(:ids::int[]) AND lingkup = 'kamar'",
                ['kamar' => $kamarId, 'ids' => pgIntArray($ids)])->rowCount() !== count($ids)) {
            throw new DomainException('Sebagian fasilitas tidak ada atau bukan fasilitas kamar');
        }
    }
}
