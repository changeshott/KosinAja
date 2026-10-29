<?php
// Pemilik — foto galeri kos & kamar.
// POST   /api/foto   multipart: jenis=kos + kos_id + foto [+ kategori, is_utama=1]  |  jenis=kamar + kamar_id + foto
// DELETE /api/foto?jenis=kos|kamar&id=4
require __DIR__ . '/../bootstrap.php';

$admin = Auth::adminId();

switch (Request::method()) {
    case 'POST':
        $jenis = $_POST['jenis'] ?? '';
        if ($jenis === 'kos') {
            $kosId = (int) ($_POST['kos_id'] ?? 0);
            KosModel::pastikanMilik($kosId, $admin);
            $utama = filter_var($_POST['is_utama'] ?? false, FILTER_VALIDATE_BOOLEAN);
            Response::created(FotoModel::tambahFotoKos($kosId, FotoModel::simpanFile($_FILES['foto'] ?? [], 'kos'), $_POST['kategori'] ?? null, $utama), 'Foto diunggah');
        }
        if ($jenis === 'kamar') {
            $kamarId = (int) ($_POST['kamar_id'] ?? 0);
            KamarModel::pastikanMilik($kamarId, $admin);
            Response::created(FotoModel::tambahFotoKamar($kamarId, FotoModel::simpanFile($_FILES['foto'] ?? [], 'kamar')), 'Foto diunggah');
        }
        Response::invalid(['jenis' => 'Pilihan: kos, kamar']);

    case 'DELETE':
        $jenis = Request::query('jenis');
        if (!in_array($jenis, ['kos', 'kamar'], true)) {
            Response::error('jenis: kos atau kamar');
        }
        FotoModel::hapusFile(FotoModel::hapus($jenis, Request::requireId(), $admin));
        Response::ok(null, 'Foto dihapus');
}
Response::methodNotAllowed();
