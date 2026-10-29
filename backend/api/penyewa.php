<?php
// Pemilik — Kelola Penyewa (hanya lihat; data penyewa berasal dari reservasi yang disetujui).
// GET /api/penyewa[?kos_id=1&kamar_id=3&status=aktif|akan_masuk|selesai|semua&q=nama]
// GET /api/penyewa?id=3     profil + riwayat sewa di kos milik pemilik
require __DIR__ . '/../bootstrap.php';

Request::method() === 'GET' || Response::methodNotAllowed();
$admin = Auth::adminId();

if ($id = Request::queryInt('id')) {
    Response::ok(PenyewaModel::find($id, $admin));
}
Response::ok(PenyewaModel::list($admin, [
    'kos_id'   => Request::queryInt('kos_id'),
    'kamar_id' => Request::queryInt('kamar_id'),
    'status'   => Request::query('status', 'aktif'),
    'q'        => Request::query('q'),
]));
