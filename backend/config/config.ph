<?php
// Salin file ini menjadi config.php lalu sesuaikan dengan PostgreSQL di laptop masing-masing.
// config.php tidak ikut di-commit (lihat .gitignore) karena berisi password database.

return [
    'db' => [
        'host'     => '127.0.0.1',
        'port'     => '5432',
        'dbname'   => 'kosinaja',
        'user'     => 'postgres',
        'password' => 'postgres',
    ],

    // Tampilkan detail error PDO di response. Matikan (false) saat demo/presentasi.
    'debug' => true,

    // Alamat situs untuk link di email (lupa kata sandi). Kosongkan untuk dideteksi otomatis,
    // misalnya 'http://localhost/KosinAja/'.
    'url_situs' => '',

    'upload' => [
        'max_bytes' => 2 * 1024 * 1024, // 2 MB
        'mime'      => ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'],
    ],
];
