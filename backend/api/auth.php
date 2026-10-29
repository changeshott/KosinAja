<?php
// Akun & login (penyewa dan pemilik).
// GET  /api/auth                  pengguna yang sedang login (null kalau belum); pemilik dapat nik_samar
// POST /api/auth?aksi=masuk       body {email, password, sebagai: penyewa|admin}
// POST /api/auth?aksi=daftar      body {nama_lengkap, email, no_telepon, password, sebagai, nik (wajib untuk admin)}
// POST /api/auth?aksi=keluar
// POST /api/auth?aksi=lupa        body {email}             kirim tautan reset (lihat backend/storage/email.log)
// POST /api/auth?aksi=reset       body {token, password}   buat kata sandi baru dari tautan email
// PUT  /api/auth                  body {nama_lengkap, no_telepon}        ubah profil sendiri
// PUT  /api/auth?aksi=sandi       body {password_lama, password_baru}    ganti kata sandi sendiri
require __DIR__ . '/../bootstrap.php';

$aksi = Request::query('aksi', '');
$body = Request::method() === 'GET' ? [] : Request::body();

// GET mengabaikan ?aksi, PUT tanpa ?aksi=sandi berarti ubah profil
switch (match (Request::method()) { 'GET' => 'GET', 'PUT' => $aksi === 'sandi' ? 'PUT sandi' : 'PUT', default => Request::method() . " $aksi" }) {
    case 'GET':
        $u = Auth::user();
        if ($u && $u['role'] === 'admin') {
            $u['nik_samar'] = PenggunaModel::nikSamar($u['id']); // hanya versi tersamar (layar Onboarding & Profil)
        }
        Response::ok($u);

    case 'PUT sandi':
        $u = Auth::user() ?? Response::error('Silakan masuk terlebih dahulu', 401);
        $data = Validator::validate($body, PenggunaModel::RULES_SANDI);
        PenggunaModel::gantiPassword($u['id'], $data['password_lama'], $data['password_baru']);
        Response::ok(null, 'Kata sandi diperbarui');

    case 'PUT':
        $u = Auth::user() ?? Response::error('Silakan masuk terlebih dahulu', 401);
        Auth::masuk(PenggunaModel::ubahProfil($u['id'], Validator::validate($body, [
            'nama_lengkap' => 'required|string|max:150',
            'no_telepon'   => 'required|string|max:20',
        ])));
        Response::ok(Auth::user(), 'Profil diperbarui');

    case 'POST masuk':
        $data = Validator::validate($body, ['email' => 'required|string', 'password' => 'required|string']);
        $p = PenggunaModel::cariEmail($data['email']);
        // Pesan sama untuk email tidak terdaftar & password salah supaya email tidak bisa ditebak
        if (!$p || !password_verify($data['password'], $p['password'])) {
            Response::error('Email atau password salah', 401);
        }
        if ($p['role'] !== sebagai($body)) {
            Response::error($p['role'] === 'admin'
                ? 'Akun ini terdaftar sebagai pemilik kos. Masuk lewat halaman Login Pemilik.'
                : 'Akun ini terdaftar sebagai penyewa. Masuk lewat halaman Login penyewa.', 403);
        }
        Auth::masuk($p);
        Response::ok(Auth::user(), 'Berhasil masuk');

    case 'POST daftar':
        $data = Validator::validate($body, PenggunaModel::RULES_DAFTAR);
        if (PenggunaModel::cariEmail($data['email'])) {
            Response::invalid(['email' => 'Email sudah terdaftar']);
        }
        Auth::masuk(PenggunaModel::daftar($data, sebagai($body)));
        Response::created(Auth::user(), 'Akun berhasil dibuat');

    case 'POST keluar':
        Auth::keluar();
        Response::ok(null, 'Berhasil keluar');

    case 'POST lupa':
        $data = Validator::validate($body, ['email' => 'required|string|max:100']);
        if ($p = PenggunaModel::cariEmail($data['email'])) {
            $token = PenggunaModel::buatTokenReset((int) $p['id']);
            kirimEmail($p['email'], 'Atur ulang kata sandi KosinAja',
                "Halo {$p['nama_lengkap']},\n\nBuka tautan berikut dalam 30 menit untuk membuat kata sandi baru:\n" .
                urlSitus() . "atur-sandi?token=$token\n\nAbaikan email ini kalau Anda tidak meminta reset kata sandi.");
        }
        // Jawaban sama untuk email terdaftar maupun tidak, supaya email tidak bisa ditebak
        Response::ok(null, 'Kalau email terdaftar, tautan untuk mengatur ulang kata sandi sudah dikirim.');

    case 'POST reset':
        $data = Validator::validate($body, ['token' => 'required|string|max:64', 'password' => 'required|string|max:72']);
        PenggunaModel::resetPassword($data['token'], $data['password']);
        Response::ok(null, 'Kata sandi baru tersimpan. Silakan masuk.');
}
Request::method() === 'POST' ? Response::error('Aksi: masuk, daftar, keluar, lupa, reset') : Response::methodNotAllowed();

function sebagai(array $body): string
{
    return ($body['sebagai'] ?? 'penyewa') === 'admin' ? 'admin' : 'penyewa';
}
