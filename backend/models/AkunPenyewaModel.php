<?php
// Fitur penyewa yang sudah login: Reservasi Saya, ulasan, favorit.
class AkunPenyewaModel
{
    public static function reservasiSaya(int $penggunaId): array
    {
        $baris = DB::semua("
            SELECT r.id, r.kode_reservasi, r.status_reservasi, r.tanggal_masuk, r.tanggal_keluar,
                   r.durasi_sewa_bulan, r.total_biaya, r.jumlah_dp, r.status_pembayaran,
                   r.is_survei_dahulu, r.jadwal_survei, r.batas_konfirmasi, r.catatan_pemilik, r.created_at,
                   k.id AS kamar_id, k.nomor_kamar, k.tipe_kamar, k.harga_per_bulan,
                   s.id AS kos_id, s.nama_kos, s.alamat, s.kecamatan,
                   (SELECT url_foto FROM foto_kos f WHERE f.kos_id = s.id ORDER BY f.is_utama DESC, f.id LIMIT 1) AS foto,
                   p.nama_lengkap AS pemilik_nama, p.no_telepon AS pemilik_telepon,
                   u.id AS ulasan_id, u.rating AS ulasan_rating, u.komentar AS ulasan_komentar
              FROM reservasi r
              JOIN kamar k ON k.id = r.kamar_id
              JOIN kos s ON s.id = k.kos_id
              JOIN pengguna p ON p.id = s.pengguna_id
              LEFT JOIN ulasan u ON u.reservasi_id = r.id
             WHERE r.pengguna_id = :p
             ORDER BY r.created_at DESC", ['p' => $penggunaId]);

        return array_map(function ($r) {
            $r['durasi_label'] = labelDurasi((int) $r['durasi_sewa_bulan']);
            // WA pemilik hanya dibuka setelah reservasi disetujui/ada jadwal survei
            $r['pemilik_wa'] = in_array($r['status_reservasi'], ['Survei', 'Disetujui', 'Selesai'], true)
                ? linkWhatsApp($r['pemilik_telepon']) : null;
            unset($r['pemilik_telepon']);
            $r['bisa_diulas'] = $r['status_reservasi'] === 'Selesai' && !$r['ulasan_id'];
            return angka($r, ['total_biaya', 'jumlah_dp', 'harga_per_bulan']);
        }, $baris);
    }

    public static function ajukan(int $penggunaId, array $data): array
    {
        $kamar = DB::satu('
            SELECT k.status, COALESCE(d.minimal_sewa_bulan, 1) AS minimal
              FROM kamar k JOIN kos s ON s.id = k.kos_id LEFT JOIN detail_kamar d ON d.kamar_id = k.id
             WHERE k.id = :id AND k.is_published AND s.is_published', ['id' => $data['kamar_id']])
            ?? Response::notFound('Kamar tidak ditemukan');
        if ($kamar['status'] === 'Perbaikan') {
            Response::error('Kamar sedang dalam perbaikan', 409);
        }
        if ($data['durasi_sewa_bulan'] < (int) $kamar['minimal']) {
            Response::invalid(['durasi_sewa_bulan' => "Minimal sewa {$kamar['minimal']} bulan"]);
        }
        return ReservasiModel::create($data + ['pengguna_id' => $penggunaId]);
    }

    /** Penyewa membatalkan pengajuannya sendiri (belum disetujui). */
    public static function batalkan(int $penggunaId, int $id): void
    {
        $diubah = DB::query("
            UPDATE reservasi SET status_reservasi = 'Dibatalkan', updated_at = CURRENT_TIMESTAMP
             WHERE id = :id AND pengguna_id = :p AND status_reservasi IN ('Pending', 'Survei')", ['id' => $id, 'p' => $penggunaId])->rowCount();
        if (!$diubah) {
            Response::error('Reservasi tidak bisa dibatalkan (sudah diproses atau bukan milik Anda)', 409);
        }
    }

    /** Ulasan hanya untuk reservasi milik sendiri yang sudah Selesai; 1 reservasi = 1 ulasan (UNIQUE di DB). */
    public static function ulas(int $penggunaId, array $data): array
    {
        $status = DB::nilai('SELECT status_reservasi FROM reservasi WHERE id = :id AND pengguna_id = :p', ['id' => $data['reservasi_id'], 'p' => $penggunaId]);
        if ($status === false) {
            Response::notFound('Reservasi tidak ditemukan');
        }
        if ($status !== 'Selesai') {
            Response::error('Ulasan bisa diberikan setelah masa sewa selesai', 409);
        }
        return DB::insert('ulasan', ['reservasi_id' => $data['reservasi_id'], 'rating' => $data['rating'], 'komentar' => $data['komentar'] ?? null],
            'id, rating, komentar, created_at');
    }

    /** Ubah rating & komentar ulasan sendiri. */
    public static function ubahUlasan(int $penggunaId, int $id, array $data): array
    {
        return DB::satu('
            UPDATE ulasan u SET rating = :rating, komentar = :komentar
              FROM reservasi r
             WHERE u.id = :id AND r.id = u.reservasi_id AND r.pengguna_id = :p
            RETURNING u.id, u.rating, u.komentar, u.created_at',
            ['rating' => $data['rating'], 'komentar' => $data['komentar'] ?? null, 'id' => $id, 'p' => $penggunaId])
            ?? Response::notFound('Ulasan tidak ditemukan');
    }

    /** Hapus ulasan sendiri; reservasinya bisa diulas lagi. */
    public static function hapusUlasan(int $penggunaId, int $id): void
    {
        $terhapus = DB::query('DELETE FROM ulasan u USING reservasi r WHERE u.id = :id AND r.id = u.reservasi_id AND r.pengguna_id = :p',
            ['id' => $id, 'p' => $penggunaId])->rowCount();
        if (!$terhapus) {
            Response::notFound('Ulasan tidak ditemukan');
        }
    }

    public static function favorit(int $penggunaId): array
    {
        return KatalogModel::list(['limit' => 100, 'favorit_saja' => true], $penggunaId);
    }

    public static function setFavorit(int $penggunaId, int $kosId, bool $simpan): void
    {
        $p = ['p' => $penggunaId, 'k' => $kosId];
        if (!$simpan) {
            DB::query('DELETE FROM favorit WHERE pengguna_id = :p AND kos_id = :k', $p);
            return;
        }
        if (!DB::nilai('SELECT 1 FROM kos WHERE id = :id AND is_published', ['id' => $kosId])) {
            Response::notFound('Kos tidak ditemukan');
        }
        DB::query('INSERT INTO favorit (pengguna_id, kos_id) VALUES (:p, :k) ON CONFLICT DO NOTHING', $p);
    }
}
