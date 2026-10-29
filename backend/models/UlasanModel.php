<?php
// Ulasan per kos (halaman Ulasan Penghuni & Detail Kos) + sebaran bintang 5..1.
class UlasanModel
{
    public static function listByKos(int $kosId, int $limit, int $offset): array
    {
        $items = DB::semua('
            SELECT u.id, u.rating, u.komentar, u.created_at,
                   p.nama_lengkap AS penyewa_nama, k.nomor_kamar, k.tipe_kamar
              FROM ulasan u
              JOIN reservasi r ON r.id = u.reservasi_id
              JOIN pengguna p ON p.id = r.pengguna_id
              JOIN kamar k ON k.id = r.kamar_id
             WHERE k.kos_id = :kos
             ORDER BY u.created_at DESC
             LIMIT :limit OFFSET :offset', ['kos' => $kosId, 'limit' => $limit, 'offset' => $offset]);

        $sebaran = array_fill_keys([5, 4, 3, 2, 1], 0);
        foreach (DB::semua('
                SELECT u.rating, COUNT(*) AS jumlah
                  FROM ulasan u JOIN reservasi r ON r.id = u.reservasi_id JOIN kamar k ON k.id = r.kamar_id
                 WHERE k.kos_id = :kos GROUP BY u.rating', ['kos' => $kosId]) as $s) {
            $sebaran[(int) $s['rating']] = (int) $s['jumlah'];
        }

        return [
            'items'   => array_map(fn($u) => $u + ['penyewa_inisial' => inisial($u['penyewa_nama'])], $items),
            'sebaran' => $sebaran,
            'total'   => array_sum($sebaran),
        ];
    }
}
