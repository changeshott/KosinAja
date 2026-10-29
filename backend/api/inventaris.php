<?php
// Pemilik — inventaris barang di kamar (modal "Inventaris" di Kelola Kamar).
// GET    /api/inventaris?kamar_id=3
// POST   /api/inventaris        body {kamar_id, nama_barang, jumlah, kondisi, catatan}
// PUT    /api/inventaris?id=5   body {nama_barang, jumlah, kondisi, catatan}
// DELETE /api/inventaris?id=5
require __DIR__ . '/../bootstrap.php';

$admin = Auth::adminId();

switch (Request::method()) {
    case 'GET':
        $kamarId = Request::requireId('kamar_id');
        KamarModel::pastikanMilik($kamarId, $admin);
        Response::ok(InventarisModel::listByKamar($kamarId));

    case 'POST':
        $kamarId = (int) Request::input('kamar_id', 0);
        $kamarId > 0 ? KamarModel::pastikanMilik($kamarId, $admin) : Response::invalid(['kamar_id' => 'Wajib diisi']);
        $id = InventarisModel::create($kamarId, Validator::validate(Request::body(), InventarisModel::RULES));
        Response::created(InventarisModel::pastikanMilik($id, $admin), 'Barang ditambahkan');

    case 'PUT':
        $id = Request::requireId();
        InventarisModel::pastikanMilik($id, $admin);
        InventarisModel::update($id, Validator::validate(Request::body(), InventarisModel::RULES, partial: true));
        Response::ok(InventarisModel::pastikanMilik($id, $admin), 'Inventaris diperbarui');

    case 'DELETE':
        $id = Request::requireId();
        InventarisModel::pastikanMilik($id, $admin);
        InventarisModel::delete($id);
        Response::ok(null, 'Barang dihapus');
}
Response::methodNotAllowed();
