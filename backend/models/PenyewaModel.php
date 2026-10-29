<?php
// Menu "Kelola Penyewa": penyewa (reservasi Disetujui/Selesai) di kos milik pemilik.
class PenyewaModel
{
    /** Masa sewa sudah lewat (status_huni = 'selesai'). */
    private const SELESAI = "(r.status_reservasi = 'Selesai' OR r.tanggal_keluar <= CURRENT_DATE)";

    private const FILTER_STATUS = [
        'aktif'      => "r.status_reservasi = 'Disetujui' AND CURRENT_DATE >= r.tanggal_masuk AND CURRENT_DATE < r.tanggal_keluar",
        'akan_masuk' => "r.status_reservasi = 'Disetujui' AND r.tanggal_masuk > CURRENT_DATE",
        'selesai'    => self::SELESAI,
        'semua'      => 'TRUE',
    ];

    /** $filter: kos_id, kamar_id, status (aktif [default] | akan_masuk | selesai | semua), q (nama, email, no. kamar). */
    public static function list(int $adminId, array $filter): array
    {
        $where = [
            's.pengguna_id = :admin',
            "r.status_reservasi IN ('Disetujui', 'Selesai')",
            self::FILTER_STATUS[$filter['status'] ?? 'aktif'] ?? Response::error('Parameter status: aktif, akan_masuk, selesai, semua'),
        ];
        $p = ['admin' => $adminId];
        if (!empty($filter['kos_id'])) {
            $where[] = 's.id = :kos';
            $p['kos'] = $filter['kos_id'];
        }
        if (!empty($filter['kamar_id'])) {
            $where[] = 'k.id = :kamar';
            $p['kamar'] = $filter['kamar_id'];
        }
        if (!empty($filter['q'])) {
            // PDO native prepare: placeholder yang sama tidak boleh dipakai dua kali
            $where[] = '(p.nama_lengkap ILIKE :q1 OR p.email ILIKE :q2 OR k.nomor_kamar ILIKE :q3)';
            $p += array_fill_keys(['q1', 'q2', 'q3'], '%' . $filter['q'] . '%');
        }

        $baris = DB::semua('
            SELECT p.id AS penyewa_id, p.nama_lengkap, p.email, p.no_telepon,
                   r.id AS reservasi_id, r.kode_reservasi, r.status_reservasi, r.tanggal_masuk, r.tanggal_keluar,
                   r.durasi_sewa_bulan, r.total_biaya, r.jumlah_dp, r.status_pembayaran,
                   (r.tanggal_keluar - CURRENT_DATE) AS sisa_hari,
                   CASE WHEN ' . self::SELESAI . " THEN 'selesai'
                        WHEN r.tanggal_masuk > CURRENT_DATE THEN 'akan_masuk'
                        ELSE 'aktif' END AS status_huni,
                   k.id AS kamar_id, k.nomor_kamar, k.tipe_kamar, s.id AS kos_id, s.nama_kos
              FROM reservasi r
              JOIN pengguna p ON p.id = r.pengguna_id
              JOIN kamar k ON k.id = r.kamar_id
              JOIN kos s ON s.id = k.kos_id
             WHERE " . implode(' AND ', $where) . '
             ORDER BY ' . self::SELESAI . ', r.tanggal_keluar', $p);

        return array_map(fn($r) => angka($r, ['total_biaya', 'jumlah_dp']) + [
            'inisial'      => inisial($r['nama_lengkap']),
            'wa'           => linkWhatsApp($r['no_telepon']),
            'durasi_label' => labelDurasi((int) $r['durasi_sewa_bulan']),
        ], $baris);
    }

    /** Profil penyewa + riwayat sewanya. Pemilik hanya boleh melihat penyewa yang pernah mengajukan ke kos miliknya. */
    public static function find(int $penyewaId, int $adminId): array
    {
        $penyewa = DB::satu("SELECT id, nama_lengkap, email, no_telepon, created_at FROM pengguna WHERE id = :id AND role = 'penyewa'", ['id' => $penyewaId]);
        $riwayat = DB::semua('
            SELECT r.id, r.kode_reservasi, r.status_reservasi, r.tanggal_masuk, r.tanggal_keluar,
                   r.durasi_sewa_bulan, r.total_biaya, r.jumlah_dp, r.status_pembayaran, k.nomor_kamar, k.tipe_kamar, s.nama_kos,
                   u.rating, u.komentar
              FROM reservasi r
              JOIN kamar k ON k.id = r.kamar_id
              JOIN kos s ON s.id = k.kos_id
              LEFT JOIN ulasan u ON u.reservasi_id = r.id
             WHERE r.pengguna_id = :penyewa AND s.pengguna_id = :admin
             ORDER BY r.tanggal_masuk DESC', ['penyewa' => $penyewaId, 'admin' => $adminId]);
        if (!$penyewa || !$riwayat) {
            Response::notFound('Penyewa tidak ditemukan');
        }
        return $penyewa + [
            'inisial' => inisial($penyewa['nama_lengkap']),
            'wa'      => linkWhatsApp($penyewa['no_telepon']),
            'riwayat' => array_map(fn($r) => angka($r, ['total_biaya', 'jumlah_dp']), $riwayat),
        ];
    }
}
