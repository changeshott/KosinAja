<?php
// Semua angka di halaman Dashboard pengelola, per kos yang dipilih di "Properti Aktif".
class DashboardModel
{
    public static function get(int $adminId, ?int $kosId): array
    {
        ReservasiModel::kedaluwarsakan();
        $admin = DB::satu('SELECT id, nama_lengkap, role FROM pengguna WHERE id = :id', ['id' => $adminId])
            ?? Response::error('Akun pemilik tidak ditemukan', 500);
        $properti = KosModel::listByPemilik($adminId);
        if (!$properti) {
            // Pemilik baru: frontend menampilkan kartu "+ Daftarkan Properti Kos"
            return ['admin' => $admin, 'properti' => [], 'kos_aktif' => null];
        }

        $kosId ??= (int) $properti[0]['id'];
        $kosAktif = array_values(array_filter($properti, fn($p) => (int) $p['id'] === $kosId))[0]
            ?? Response::notFound('Kos tidak ditemukan');

        return [
            'admin'             => $admin,
            'properti'          => $properti,           // dropdown "Properti Aktif" + kartu Portofolio
            'kos_aktif'         => $kosAktif,
            'statistik'         => self::statistik($kosId),
            'ringkasan_tipe'    => self::ringkasanTipe($kosId),
            'rating'            => self::rating($kosId),
            'reservasi_terbaru' => ReservasiModel::list($adminId, ['kos_id' => $kosId, 'status' => 'menunggu', 'limit' => 5]),
            'total_reservasi'   => ReservasiModel::list($adminId, ['kos_id' => $kosId, 'limit' => 0])['total'],
        ];
    }

    /** Lima kartu statistik di atas. */
    private static function statistik(int $kosId): array
    {
        return angka(DB::satu("
            SELECT COUNT(*) AS total_unit,
                   COUNT(*) FILTER (WHERE status = 'Terisi')    AS terisi,
                   COUNT(*) FILTER (WHERE status = 'Tersedia')  AS siap_huni,
                   COUNT(*) FILTER (WHERE status = 'Dipesan')   AS dipesan,
                   COUNT(*) FILTER (WHERE status = 'Perbaikan') AS perbaikan,
                   COALESCE(SUM(harga_per_bulan) FILTER (WHERE status = 'Terisi'), 0) AS estimasi_omzet_bulanan,
                   (SELECT COUNT(*) FROM reservasi r JOIN kamar km ON km.id = r.kamar_id
                     WHERE km.kos_id = :kos1 AND r.status_reservasi IN ('Pending', 'Survei')) AS pengajuan_reservasi
              FROM kamar WHERE kos_id = :kos2", ['kos1' => $kosId, 'kos2' => $kosId]), ['estimasi_omzet_bulanan']);
    }

    /** Bar keterisian total + kartu per tipe kamar ("Tipe 1 80% Penuh, 8 Terisi 2 Kosong"). */
    private static function ringkasanTipe(int $kosId): array
    {
        $tipe = array_map(fn($r) => angka($r, ['harga_min', 'harga_max']) + ['persen_terisi' => $r['total'] ? round($r['terisi'] / $r['total'] * 100) : 0], DB::semua("
            SELECT tipe_kamar, MIN(harga_per_bulan) AS harga_min, MAX(harga_per_bulan) AS harga_max, COUNT(*) AS total,
                   COUNT(*) FILTER (WHERE status = 'Terisi')   AS terisi,
                   COUNT(*) FILTER (WHERE status = 'Tersedia') AS kosong
              FROM kamar WHERE kos_id = :kos
             GROUP BY tipe_kamar ORDER BY MAX(harga_per_bulan) DESC", ['kos' => $kosId]));
        $total = array_sum(array_column($tipe, 'total'));
        $terisi = array_sum(array_column($tipe, 'terisi'));
        $kosong = array_sum(array_column($tipe, 'kosong'));

        return [
            'total'         => $total,
            'terisi'        => $terisi,
            'kosong'        => $kosong,
            'lainnya'       => $total - $terisi - $kosong, // Dipesan + Perbaikan: bukan terisi, tapi belum siap huni
            'persen_terisi' => $total ? round($terisi / $total * 100, 1) : 0,
            'per_tipe'      => $tipe,
        ];
    }

    /** Panel biru "Ringkasan Rating Kost Kamu". */
    private static function rating(int $kosId): array
    {
        $r = DB::satu('SELECT rating_rata, jumlah_ulasan FROM (' . KosModel::SQL_RATING . ') r WHERE kos_id = :kos', ['kos' => $kosId]);
        // Rata-rata selisih pengajuan -> respon pertama pemilik (jam)
        $respon = DB::nilai("
            SELECT ROUND(AVG(EXTRACT(EPOCH FROM (r.direspon_at - r.created_at)) / 3600)::numeric, 1)
              FROM reservasi r JOIN kamar k ON k.id = r.kamar_id
             WHERE k.kos_id = :kos AND r.direspon_at IS NOT NULL", ['kos' => $kosId]);
        return [
            'rating_rata'     => $r ? (float) $r['rating_rata'] : null,
            'jumlah_ulasan'   => (int) ($r['jumlah_ulasan'] ?? 0),
            'rata_respon_jam' => $respon !== null ? (float) $respon : null,
        ];
    }
}
