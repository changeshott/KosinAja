<?php
require __DIR__ . '/../bootstrap.php';
$aktor = Auth::superAdminId();
$method = Request::method();
$bagian = Request::query('bagian', 'ringkasan');
$id = Request::queryInt('id');

if ($method === 'GET') {
    if ($bagian === 'pemilik' && $id) Response::ok(SuperAdminModel::detail($id));
    if ($bagian === 'pemilik') Response::ok(SuperAdminModel::pemilik([
        'status' => Request::query('status', 'semua'), 'q' => Request::query('q', ''),
        'page' => Request::queryInt('page') ?: 1, 'limit' => Request::queryInt('limit') ?: 5,
    ]));
    if ($bagian === 'ringkasan') Response::ok(SuperAdminModel::ringkasan());
}

if ($method === 'POST' && $bagian === 'verifikasi' && $id) {
    $data = Request::body();
    Response::ok(SuperAdminModel::verifikasi($id, $aktor, (string) ($data['aksi'] ?? ''), (string) ($data['alasan'] ?? '')), 'Status pengajuan pemilik diperbarui');
}

if ($method === 'PATCH' && $bagian === 'akun' && $id) {
    $data = Validator::validate(Request::body(), ['aktif' => 'required|bool']);
    Response::ok(SuperAdminModel::statusAkun($id, $data['aktif']), 'Status akun pemilik diperbarui');
}

Response::methodNotAllowed();
