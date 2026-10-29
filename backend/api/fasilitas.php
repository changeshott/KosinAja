<?php
// Master fasilitas.
// GET  /api/fasilitas[?lingkup=kamar|bersama]   publik: checkbox form & filter katalog
// POST /api/fasilitas  body {nama_fasilitas, kategori, lingkup}   pemilik: checkbox "Isi Manual"
require __DIR__ . '/../bootstrap.php';

switch (Request::method()) {
    case 'GET':
        $lingkup = Request::query('lingkup');
        if ($lingkup && !in_array($lingkup, ['kamar', 'bersama'], true)) {
            Response::error('lingkup: kamar atau bersama');
        }
        Response::ok(FasilitasModel::list($lingkup));

    case 'POST':
        Auth::adminId();
        $data = Validator::validate(Request::body(), [
            'nama_fasilitas' => 'required|string|max:100',
            'kategori'       => 'required|string|max:50',
            'lingkup'        => 'required|in:kamar,bersama',
        ]);
        Response::created(FasilitasModel::ambilAtauBuat($data), 'Fasilitas ditambahkan');
}
Response::methodNotAllowed();
