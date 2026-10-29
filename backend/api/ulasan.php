<?php
// Pemilik — Ulasan Penghuni.
// GET /api/ulasan?kos_id=1[&page=1&per_page=10]
require __DIR__ . '/../bootstrap.php';

Request::method() === 'GET' || Response::methodNotAllowed();
$kosId = Request::requireId('kos_id');
KosModel::pastikanMilik($kosId, Auth::adminId());
[$page, $perPage] = halaman(10, 50);
Response::ok(UlasanModel::listByKos($kosId, $perPage, ($page - 1) * $perPage));
