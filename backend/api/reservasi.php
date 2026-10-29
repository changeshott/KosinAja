<?php
// Pemilik — pengajuan reservasi. Pengajuan oleh penyewa ada di api/akun?bagian=reservasi.
// GET   /api/reservasi[?kos_id=1&status=menunggu|Pending|...&q=nama&page=1&per_page=10]
// GET   /api/reservasi?id=7
// PATCH /api/reservasi?id=7&aksi=setujui | selesai | batalkan
// PATCH /api/reservasi?id=7&aksi=tolak       body {catatan_pemilik}
// PATCH /api/reservasi?id=7&aksi=survei      body {jadwal_survei}
// PATCH /api/reservasi?id=7&aksi=pembayaran  body {jumlah_dp, status_pembayaran}
require __DIR__ . '/../bootstrap.php';

$admin = Auth::adminId();

switch (Request::method()) {
    case 'GET':
        ReservasiModel::kedaluwarsakan();
        if ($id = Request::queryInt('id')) {
            Response::ok(ReservasiModel::find($id, $admin));
        }
        $status = Request::query('status');
        if ($status && $status !== 'menunggu' && !in_array($status, ReservasiModel::STATUS, true)) {
            Response::error('Status: menunggu, ' . implode(', ', ReservasiModel::STATUS));
        }
        [$page, $perPage] = halaman(10, 50);
        Response::ok(ReservasiModel::list($admin, [
            'kos_id' => Request::queryInt('kos_id'),
            'status' => $status,
            'q'      => Request::query('q'),
            'limit'  => $perPage,
            'offset' => ($page - 1) * $perPage,
        ]) + ['page' => $page, 'per_page' => $perPage]);

    case 'PATCH':
        $id = Request::requireId();
        $aksi = Request::query('aksi', '');
        if ($aksi === 'pembayaran') {
            $data = Validator::validate(Request::body(), ['jumlah_dp' => 'numeric|min:0', 'status_pembayaran' => 'required|in:Belum Bayar,DP,Lunas']);
            Response::ok(ReservasiModel::catatPembayaran($id, $admin, $data), 'Pembayaran dicatat');
        }
        $data = Validator::validate(Request::body(), ['catatan_pemilik' => 'string', 'jadwal_survei' => 'datetime']);
        Response::ok(ReservasiModel::ubahStatus($id, $admin, $aksi, $data), 'Status reservasi diperbarui');
}
Response::methodNotAllowed();
