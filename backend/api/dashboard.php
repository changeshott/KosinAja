<?php
// Pemilik — Dashboard.
// GET /api/dashboard[?kos_id=1]   (default: kos pertama milik pemilik)
require __DIR__ . '/../bootstrap.php';

Request::method() === 'GET' || Response::methodNotAllowed();
Response::ok(DashboardModel::get(Auth::adminId(), Request::queryInt('kos_id')));
