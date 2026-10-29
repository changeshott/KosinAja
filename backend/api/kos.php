<?php
// Pemilik — gedung kos.
// GET    /api/kos            daftar kos milik pemilik (+ ringkasan kamar)
// GET    /api/kos?id=1       detail kos (+ foto, fasilitas bersama)
// POST   /api/kos            tambah kos            body: kolom KosModel::RULES + fasilitas_ids
// PUT    /api/kos?id=1       ubah kos (kirim kolom yang berubah saja)
// DELETE /api/kos?id=1       hapus kos
require __DIR__ . '/../bootstrap.php';

$admin = Auth::adminId();
$fasilitas = fn() => array_key_exists('fasilitas_ids', Request::body()) ? Validator::idList(Request::input('fasilitas_ids'), 'fasilitas_ids') : null;

switch (Request::method()) {
    case 'GET':
        $id = Request::queryInt('id');
        Response::ok($id ? KosModel::find($id, $admin) : KosModel::listByPemilik($admin));

    case 'POST':
        $id = KosModel::create($admin, Validator::validate(Request::body(), KosModel::RULES), $fasilitas() ?? []);
        Response::created(KosModel::find($id, $admin), 'Kos berhasil ditambahkan');

    case 'PUT':
        $id = Request::requireId();
        KosModel::update($id, $admin, Validator::validate(Request::body(), KosModel::RULES, partial: true), $fasilitas());
        Response::ok(KosModel::find($id, $admin), 'Kos berhasil diperbarui');

    case 'DELETE':
        KosModel::delete(Request::requireId(), $admin);
        Response::ok(null, 'Kos berhasil dihapus');
}
Response::methodNotAllowed();
