<?php
// Publik (tanpa login): Beranda, Katalog Kos, Detail Kos.
// GET /api/katalog[?q=&tipe_kos=pria|wanita|campuran&kecamatan=&harga_min=&harga_max=
//                  &fasilitas=1,2&tersedia=1&urut=termurah|termahal|terdekat|rating&page=1&per_page=12]
// GET /api/katalog?id=1      detail kos + kamar + ulasan (WA pemilik hanya kalau sudah login)
// GET /api/katalog?opsi=1    pilihan dropdown filter
require __DIR__ . '/../bootstrap.php';

Request::method() === 'GET' || Response::methodNotAllowed();
$user = Auth::user();

if ($id = Request::queryInt('id')) {
    Response::ok(KatalogModel::detail($id, $user));
}
if (Request::query('opsi')) {
    Response::ok(KatalogModel::opsiFilter());
}

$tipe = Request::query('tipe_kos');
if ($tipe && !in_array($tipe, ['pria', 'wanita', 'campuran'], true)) {
    Response::error('tipe_kos: pria, wanita, campuran');
}
$harga = fn($k) => is_numeric(Request::query($k)) ? (float) Request::query($k) : null;
[$hargaMin, $hargaMax] = [$harga('harga_min'), $harga('harga_max')];
if ($hargaMin !== null && $hargaMax !== null && $hargaMin > $hargaMax) {
    [$hargaMin, $hargaMax] = [$hargaMax, $hargaMin]; // tertukar (mis. URL diketik manual)
}
[$page, $perPage] = halaman(12, 48);

Response::ok(KatalogModel::list(array_filter([
    'q'             => Request::query('q'),
    'tipe_kos'      => $tipe,
    'kecamatan'     => Request::query('kecamatan'),
    'harga_min'     => $hargaMin,
    'harga_max'     => $hargaMax,
    'fasilitas_ids' => Request::query('fasilitas') ? Validator::idList(explode(',', Request::query('fasilitas')), 'fasilitas') : [],
    'tersedia'      => Request::query('tersedia') === '1',
    'urut'          => Request::query('urut'),
    'limit'         => $perPage,
    'offset'        => ($page - 1) * $perPage,
], fn($v) => $v !== null && $v !== false && $v !== []), $user && $user['role'] === 'penyewa' ? $user['id'] : null)
    + ['page' => $page, 'per_page' => $perPage]);
