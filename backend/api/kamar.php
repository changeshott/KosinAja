<?php
// Pemilik — kamar + detail kamar + fasilitas.
// GET    /api/kamar?kos_id=1[&status=&tipe_kamar=&q=]   daftar kamar (Kelola Kamar & Unit)
// GET    /api/kamar?id=3                               detail kamar (form Edit Kamar)
// POST   /api/kamar        body: kos_id + RULES_KAMAR + RULES_DETAIL + fasilitas_ids, fasilitas_bersama_ids, perbaikan
// PUT    /api/kamar?id=3   kolom yang berubah saja
// PATCH  /api/kamar?id=3   body {perbaikan: true|false}   tombol "Belum Terisi" / "Selesai Perbaikan"
// DELETE /api/kamar?id=3
require __DIR__ . '/../bootstrap.php';

$admin = Auth::adminId();

switch (Request::method()) {
    case 'GET':
        if ($id = Request::queryInt('id')) {
            Response::ok(KamarModel::find($id, $admin));
        }
        $kosId = Request::requireId('kos_id');
        KosModel::pastikanMilik($kosId, $admin);
        $status = Request::query('status');
        if ($status && !in_array($status, ['Tersedia', 'Dipesan', 'Terisi', 'Perbaikan'], true)) {
            Response::error('Status: Tersedia, Dipesan, Terisi, Perbaikan');
        }
        Response::ok(KamarModel::listByKos($kosId, ['status' => $status, 'tipe_kamar' => Request::query('tipe_kamar'), 'q' => Request::query('q')]));

    case 'POST':
        $body = Request::body();
        $kosId = (int) ($body['kos_id'] ?? 0);
        $kosId > 0 ? KosModel::pastikanMilik($kosId, $admin) : Response::invalid(['kos_id' => 'Wajib diisi']);
        $id = KamarModel::create($kosId, Validator::validate($body, KamarModel::RULES_KAMAR), Validator::validate($body, KamarModel::RULES_DETAIL),
            Validator::idList($body['fasilitas_ids'] ?? null, 'fasilitas_ids'));
        simpanTambahan($id, $kosId, $admin, $body);
        Response::created(KamarModel::find($id, $admin), 'Kamar berhasil ditambahkan');

    case 'PUT':
        $id = Request::requireId();
        $body = Request::body();
        KamarModel::update($id, $admin, Validator::validate($body, KamarModel::RULES_KAMAR, partial: true),
            Validator::validate($body, KamarModel::RULES_DETAIL, partial: true),
            array_key_exists('fasilitas_ids', $body) ? Validator::idList($body['fasilitas_ids'], 'fasilitas_ids') : null);
        simpanTambahan($id, (int) KamarModel::pastikanMilik($id, $admin)['kos_id'], $admin, $body);
        Response::ok(KamarModel::find($id, $admin), 'Kamar berhasil diperbarui');

    case 'PATCH':
        $id = Request::requireId();
        $status = KamarModel::setPerbaikan($id, $admin, Validator::validate(Request::body(), ['perbaikan' => 'required|bool'])['perbaikan']);
        Response::ok(['id' => $id, 'status' => $status], "Status kamar: $status");

    case 'DELETE':
        KamarModel::delete(Request::requireId(), $admin);
        Response::ok(null, 'Kamar berhasil dihapus');
}
Response::methodNotAllowed();

/** Isian form Tambah Kamar yang bukan kolom kamar/detail_kamar: fasilitas gedung & status perbaikan. */
function simpanTambahan(int $kamarId, int $kosId, int $admin, array $body): void
{
    if (array_key_exists('fasilitas_bersama_ids', $body)) {
        KosModel::update($kosId, $admin, [], Validator::idList($body['fasilitas_bersama_ids'], 'fasilitas_bersama_ids'));
    }
    if (array_key_exists('perbaikan', $body)) {
        $perbaikan = filter_var($body['perbaikan'], FILTER_VALIDATE_BOOLEAN);
        // Hanya ubah kalau memang berubah, supaya status Terisi/Dipesan dari reservasi tidak tertimpa
        if ($perbaikan !== (KamarModel::pastikanMilik($kamarId, $admin)['status'] === 'Perbaikan')) {
            KamarModel::setPerbaikan($kamarId, $admin, $perbaikan);
        }
    }
}
