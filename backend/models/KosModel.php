<?php
// Gedung kos milik pemilik (panel pengelola): daftar, detail, tambah, ubah, hapus.
class KosModel
{
    public const RULES = [
        'nama_kos'        => 'required|string|max:150',
        'tipe_kos'        => 'required|in:pria,wanita,campuran',
        'alamat'          => 'required|string',
        'kecamatan'       => 'required|string|max:100',
        'kota'            => 'string|max:100',
        'latitude'        => 'numeric',
        'longitude'       => 'numeric',
        'jarak_kampus_km' => 'numeric|min:0',
        'google_maps_url' => 'string',
        'deskripsi'       => 'string',
        'peraturan_kos'   => 'string',
        'is_published'    => 'bool',
    ];

    // Rating per kos dihitung dari ulasan -> reservasi -> kamar (ulasan tidak menyimpan kos_id di skema v2)
    public const SQL_RATING = "
        SELECT km.kos_id, ROUND(AVG(u.rating), 1) AS rating_rata, COUNT(*) AS jumlah_ulasan
          FROM ulasan u
          JOIN reservasi rv ON rv.id = u.reservasi_id
          JOIN kamar km ON km.id = rv.kamar_id
         GROUP BY km.kos_id";

    /** Daftar kos milik pemilik + ringkasan kamar. Dipakai dropdown "Properti Aktif" dan kartu Portofolio. */
    public static function listByPemilik(int $adminId): array
    {
        $baris = DB::semua("
            SELECT s.id, s.nama_kos, s.tipe_kos, s.alamat, s.kecamatan, s.kota, s.is_published,
                   (SELECT url_foto FROM foto_kos f WHERE f.kos_id = s.id AND f.is_utama) AS foto_utama,
                   COUNT(k.id) AS total_kamar,
                   COUNT(k.id) FILTER (WHERE k.status = 'Terisi')   AS terisi,
                   COUNT(k.id) FILTER (WHERE k.status = 'Tersedia') AS kosong,
                   r.rating_rata, COALESCE(r.jumlah_ulasan, 0) AS jumlah_ulasan
              FROM kos s
              LEFT JOIN kamar k ON k.kos_id = s.id
              LEFT JOIN (" . self::SQL_RATING . ") r ON r.kos_id = s.id
             WHERE s.pengguna_id = :admin
             GROUP BY s.id, r.rating_rata, r.jumlah_ulasan
             ORDER BY s.created_at, s.id", ['admin' => $adminId]);
        return array_map(fn($r) => angka($r, ['rating_rata']), $baris);
    }

    /** Ambil kos milik pemilik, atau langsung 404 kalau bukan miliknya. */
    public static function pastikanMilik(int $kosId, int $adminId): array
    {
        return DB::satu('SELECT * FROM kos WHERE id = :id AND pengguna_id = :admin', ['id' => $kosId, 'admin' => $adminId])
            ?? Response::notFound('Kos tidak ditemukan');
    }

    public static function find(int $kosId, int $adminId): array
    {
        $kos = angka(self::pastikanMilik($kosId, $adminId), ['latitude', 'longitude', 'jarak_kampus_km']);
        $kos['foto'] = DB::semua('SELECT id, url_foto, kategori, is_utama FROM foto_kos WHERE kos_id = :id ORDER BY is_utama DESC, id', ['id' => $kosId]);
        $kos['fasilitas'] = DB::semua('
            SELECT f.id, f.nama_fasilitas, f.kategori, f.ikon
              FROM fasilitas_kos fk JOIN fasilitas f ON f.id = fk.fasilitas_id
             WHERE fk.kos_id = :id ORDER BY f.id', ['id' => $kosId]);
        return $kos;
    }

    public static function create(int $adminId, array $data, array $fasilitasIds): int
    {
        return DB::transaksi(function () use ($adminId, $data, $fasilitasIds) {
            $data['kota'] ??= 'Malang';
            $id = DB::insert('kos', $data + ['pengguna_id' => $adminId])['id'];
            self::simpanFasilitas($id, $fasilitasIds);
            return $id;
        });
    }

    /** $fasilitasIds null = fasilitas tidak diubah. */
    public static function update(int $kosId, int $adminId, array $data, ?array $fasilitasIds): void
    {
        self::pastikanMilik($kosId, $adminId);
        DB::transaksi(function () use ($kosId, $data, $fasilitasIds) {
            DB::update('kos', $data, 'id = :id', ['id' => $kosId]);
            if ($fasilitasIds !== null) {
                DB::query('DELETE FROM fasilitas_kos WHERE kos_id = :id', ['id' => $kosId]);
                self::simpanFasilitas($kosId, $fasilitasIds);
            }
        });
    }

    /** Kamar ikut terhapus (CASCADE), tapi ditolak FK kalau ada kamar yang punya riwayat reservasi. */
    public static function delete(int $kosId, int $adminId): void
    {
        self::pastikanMilik($kosId, $adminId);
        $foto = DB::kolom('
            SELECT url_foto FROM foto_kos WHERE kos_id = :k1
            UNION ALL
            SELECT f.url_foto FROM foto_kamar f JOIN kamar k ON k.id = f.kamar_id WHERE k.kos_id = :k2', ['k1' => $kosId, 'k2' => $kosId]);
        DB::query('DELETE FROM kos WHERE id = :id', ['id' => $kosId]);
        array_walk($foto, fn($url) => FotoModel::hapusFile($url));
    }

    /** Hanya fasilitas berlingkup 'bersama' yang boleh dipasang ke gedung kos. */
    private static function simpanFasilitas(int $kosId, array $ids): void
    {
        if ($ids && DB::query("
                INSERT INTO fasilitas_kos (kos_id, fasilitas_id)
                SELECT :kos, id FROM fasilitas WHERE id = ANY(:ids::int[]) AND lingkup = 'bersama'",
                ['kos' => $kosId, 'ids' => pgIntArray($ids)])->rowCount() !== count($ids)) {
            throw new DomainException('Sebagian fasilitas tidak ada atau bukan fasilitas bersama');
        }
    }
}
