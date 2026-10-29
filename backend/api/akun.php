<?php
// Penyewa yang sudah login.
// GET    /api/akun?bagian=reservasi             Reservasi Saya
// POST   /api/akun?bagian=reservasi             ajukan sewa     body {kamar_id, tanggal_masuk, durasi_sewa_bulan, is_survei_dahulu, jadwal_survei}
// PATCH  /api/akun?bagian=reservasi&id=7        batalkan pengajuan sendiri
// POST   /api/akun?bagian=ulasan                beri ulasan     body {reservasi_id, rating 1-5, komentar}
// PUT    /api/akun?bagian=ulasan&id=3           ubah ulasan     body {rating, komentar}
// DELETE /api/akun?bagian=ulasan&id=3           hapus ulasan
// GET    /api/akun?bagian=favorit               Kos Favorit
// POST   /api/akun?bagian=favorit               body {kos_id}
// DELETE /api/akun?bagian=favorit&kos_id=1
require __DIR__ . '/../bootstrap.php';

$penyewa = Auth::penyewaId();
$ulasan = ['rating' => 'required|int|min:1|max:5', 'komentar' => 'string|max:1000'];

switch (Request::query('bagian', '') . ' ' . Request::method()) {
    case 'reservasi GET':
        ReservasiModel::kedaluwarsakan();
        Response::ok(AkunPenyewaModel::reservasiSaya($penyewa));

    case 'reservasi POST':
        $data = Validator::validate(Request::body(), [
            'kamar_id'          => 'required|int|min:1',
            'tanggal_masuk'     => 'required|date',
            'durasi_sewa_bulan' => 'required|int|min:1|max:24',
            'is_survei_dahulu'  => 'bool',
            'jadwal_survei'     => 'datetime',
        ]);
        if ($data['tanggal_masuk'] < date('Y-m-d')) {
            Response::invalid(['tanggal_masuk' => 'Tidak boleh tanggal lampau']);
        }
        if (empty($data['is_survei_dahulu'])) {
            unset($data['jadwal_survei']);
        }
        Response::created(AkunPenyewaModel::ajukan($penyewa, $data), 'Reservasi diajukan, pemilik akan merespon maksimal 1x24 jam');

    case 'reservasi PATCH':
        AkunPenyewaModel::batalkan($penyewa, Request::requireId());
        Response::ok(null, 'Reservasi dibatalkan');

    case 'ulasan POST':
        $data = Validator::validate(Request::body(), ['reservasi_id' => 'required|int|min:1'] + $ulasan);
        Response::created(AkunPenyewaModel::ulas($penyewa, $data), 'Terima kasih atas ulasannya');

    case 'ulasan PUT':
        Response::ok(AkunPenyewaModel::ubahUlasan($penyewa, Request::requireId(), Validator::validate(Request::body(), $ulasan)), 'Ulasan diperbarui');

    case 'ulasan DELETE':
        AkunPenyewaModel::hapusUlasan($penyewa, Request::requireId());
        Response::ok(null, 'Ulasan dihapus');

    case 'favorit GET':
        Response::ok(AkunPenyewaModel::favorit($penyewa));

    case 'favorit POST':
        AkunPenyewaModel::setFavorit($penyewa, Validator::validate(Request::body(), ['kos_id' => 'required|int|min:1'])['kos_id'], true);
        Response::ok(null, 'Disimpan ke favorit');

    case 'favorit DELETE':
        AkunPenyewaModel::setFavorit($penyewa, Request::requireId('kos_id'), false);
        Response::ok(null, 'Dihapus dari favorit');
}
Response::error('Bagian: reservasi, ulasan, favorit (cek juga method HTTP)');
