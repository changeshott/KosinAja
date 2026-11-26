<?php
// Contoh konfigurasi untuk pengembangan di komputer sendiri (Laragon).
//
// Cara pakai:
//   1. Salin file ini menjadi backend/config/config.php
//   2. Sesuaikan 'password' dan 'port' dengan PostgreSQL di Laragon
//
// config.php tidak ikut Git (lihat .gitignore) karena berisi password.
// Di server (EthioDeploy) file ini tidak perlu ada: nilainya dibaca dari
// environment variable oleh backend/config/muat.php.

return [
    'db' => [
        'host'     => '127.0.0.1',
        'port'     => '5432',
        'dbname'   => 'kosinaja',
        'user'     => 'postgres',
        'password' => 'GANTI_DENGAN_PASSWORD_POSTGRESQL_ANDA',
        // Kosongkan untuk PostgreSQL lokal. Isi 'require' kalau memakai
        // database online yang mewajibkan SSL (misalnya Supabase).
        'sslmode'  => null,
    ],

    // true = pesan error teknis ikut ditampilkan. Selalu false di server.
    'debug' => true,

    // Kosongkan saja di lokal; alamat situs dihitung otomatis.
    // Diisi hanya kalau link pada email lupa kata sandi perlu dipaksa,
    // contoh: 'https://nama-project.ethiodeploy.app/'
    'url_situs' => '',

    'upload' => [
        'max_bytes' => 2 * 1024 * 1024, // 2 MB per foto
        'mime'      => [
            'image/jpeg' => 'jpg',
            'image/png'  => 'png',
            'image/webp' => 'webp',
        ],
    ],
];
