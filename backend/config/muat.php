<?php
// Memuat konfigurasi aplikasi.
// - Lokal (Laragon): pakai backend/config/config.php seperti biasa (tidak di-commit).
// - Server (EthioDeploy + Supabase): config.php tidak ada, jadi semua nilai dibaca dari environment variable:
//     DATABASE_URL  postgresql://user:password@host:5432/postgres   (atau isi DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD)
//     DB_SSLMODE    require   (wajib untuk Supabase)
//     APP_DEBUG     false     (true hanya saat mencari error)
//     URL_SITUS     https://nama-project.ethiodeploy.app/   (untuk link di email lupa kata sandi)

if (is_file(__DIR__ . '/config.php')) {
    return require __DIR__ . '/config.php';
}

$env = static function (string $nama, ?string $bawaan = null): ?string {
    $nilai = getenv($nama);
    return ($nilai === false || $nilai === '') ? $bawaan : $nilai;
};

$db = [
    'host'     => $env('DB_HOST', '127.0.0.1'),
    'port'     => $env('DB_PORT', '5432'),
    'dbname'   => $env('DB_NAME', 'postgres'),
    'user'     => $env('DB_USER', 'postgres'),
    'password' => $env('DB_PASSWORD', ''),
    'sslmode'  => $env('DB_SSLMODE'),
];

// DATABASE_URL (format connection string Supabase) menimpa DB_* kalau diisi
if ($url = $env('DATABASE_URL')) {
    $u = parse_url($url);
    if ($u && isset($u['host'])) {
        $db['host']     = $u['host'];
        $db['port']     = (string) ($u['port'] ?? 5432);
        $db['dbname']   = ltrim($u['path'] ?? '/postgres', '/') ?: 'postgres';
        $db['user']     = urldecode($u['user'] ?? $db['user']);
        $db['password'] = urldecode($u['pass'] ?? $db['password']);
        parse_str($u['query'] ?? '', $q);
        if (!empty($q['sslmode'])) {
            $db['sslmode'] = $q['sslmode'];
        }
    }
}

return [
    'db'        => $db,
    'debug'     => filter_var($env('APP_DEBUG', 'false'), FILTER_VALIDATE_BOOLEAN),
    'url_situs' => $env('URL_SITUS', ''),
    'upload'    => [
        'max_bytes' => 2 * 1024 * 1024,
        'mime'      => ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'],
    ],
];
