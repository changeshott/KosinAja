<?php
// Akun & login (penyewa dan pemilik).
// GET  /api/auth                  pengguna yang sedang login (null kalau belum); pemilik dapat nik_samar
// POST /api/auth?aksi=masuk       body {email, password, sebagai: penyewa|admin|super_admin}
// POST /api/auth?aksi=daftar      body {nama_lengkap, email, no_telepon, password, sebagai, nik (wajib untuk admin)}
// POST /api/auth?aksi=keluar    keluar dari satu peran saja (lihat header X-Peran di Auth.php)
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
            $pesan = match ($p['role']) {
                'admin' => 'Akun ini terdaftar sebagai pemilik kos. Masuk lewat halaman Login Pemilik.',
                'super_admin' => 'Akun ini khusus administrator. Gunakan halaman login super admin.',
                default => 'Akun ini terdaftar sebagai penyewa. Masuk lewat halaman Login penyewa.',
            };
            Response::error($pesan, 403);
        }
        if ($p['role'] === 'admin' && $p['status_verifikasi'] !== 'disetujui') {
            Response::error($p['status_verifikasi'] === 'ditolak'
                ? 'Pengajuan pemilik ditolak. Hubungi administrator untuk informasi lebih lanjut.'
                : 'Akun pemilik masih menunggu verifikasi administrator.', 403);
        }
        if (in_array($p['akun_aktif'] ?? true, [false, 0, '0', 'f', 'false'], true)) {
            Response::error('Akun dinonaktifkan. Hubungi administrator.', 403);
        }
        Auth::masuk($p);
        // Ambil dari slot peran akun ini, bukan peran halaman, supaya pasti cocok
        Response::ok(Auth::user($p['role']), 'Berhasil masuk');

    case 'POST daftar':
        if (($body['sebagai'] ?? '') === 'super_admin') {
            Response::error('Akun super admin hanya dapat dibuat melalui database.', 403);
        }
        $rules = PenggunaModel::RULES_DAFTAR;
        if (sebagai($body) === 'admin') {
            $rules += [
                'alamat_domisili' => 'required|string|max:500',
                'nama_kos' => 'required|string|max:150',
                'tipe_kos' => 'required|in:pria,wanita,campuran',
                'alamat_kos' => 'required|string|max:500',
                'kecamatan' => 'required|string|max:100',
                'kota' => 'required|string|max:100',
            ];
        }
        $data = Validator::validate($body, $rules);
        if (PenggunaModel::cariEmail($data['email'])) {
            Response::invalid(['email' => 'Email sudah terdaftar']);
        }
        $akun = PenggunaModel::daftar($data, sebagai($body));
        if ($akun['role'] === 'admin') {
            Response::created(['menunggu_verifikasi' => true], 'Pendaftaran berhasil. Akun Anda menunggu verifikasi administrator.');
        }
        Auth::masuk($akun);
        Response::created(Auth::user($akun['role']), 'Akun berhasil dibuat');

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
    return in_array(($body['sebagai'] ?? 'penyewa'), ['admin', 'super_admin'], true) ? $body['sebagai'] : 'penyewa';
}
