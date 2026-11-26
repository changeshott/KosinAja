<?php
// Router untuk server tanpa Apache/.htaccess (nginx + PHP-FPM di EthioDeploy, atau `php -S`).
// Aturannya sama dengan .htaccess, jadi di Laragon file ini tidak terpakai.
//   /                       -> index.php (cek database lalu Beranda)
//   /katalog                -> frontend/katalog.html
//   /admin/ , /admin/kamar  -> frontend/admin/index.html, frontend/admin/kamar.html
//   /super-admin/...        -> frontend/super-admin/...
//   /assets/...             -> frontend/assets/...
//   /api/katalog            -> backend/api/katalog.php
//   /uploads/...            -> backend/uploads/...

define('KOSINAJA_ROUTER', true);
$akar = __DIR__;
$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
$rel  = ltrim($path, '/');

function kirimFile(string $file): void
{
    $tipe = [
        'html' => 'text/html; charset=utf-8', 'css' => 'text/css; charset=utf-8',
        'js' => 'application/javascript; charset=utf-8', 'json' => 'application/json',
        'svg' => 'image/svg+xml', 'png' => 'image/png', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg',
        'webp' => 'image/webp', 'gif' => 'image/gif', 'ico' => 'image/x-icon',
        'woff' => 'font/woff', 'woff2' => 'font/woff2',
    ];
    $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
    header('Content-Type: ' . ($tipe[$ext] ?? 'application/octet-stream'));
    if (in_array($ext, ['html', 'js', 'css'], true)) {
        header('Cache-Control: no-cache'); // sama seperti .htaccess
    }
    header('Content-Length: ' . filesize($file));
    readfile($file);
    exit;
}

function tidakAda(string $akar): void
{
    $_SERVER['SCRIPT_NAME'] = '/404.php';
    require $akar . '/404.php';
    exit;
}

function alihkan(string $ke): void
{
    header('Location: /' . ltrim($ke, '/'), true, 301);
    exit;
}

// Cegah keluar folder (../) dan akses file tersembunyi
if (str_contains($rel, '..') || preg_match('#(^|/)\.#', $rel)) {
    tidakAda($akar);
}

// Beranda
if ($rel === '' || $rel === 'index.php') {
    require $akar . '/index.php';
    exit;
}

// Folder & file internal tidak boleh dibuka langsung
if (preg_match('#^(backend|database|node_modules|frontend/tailwind)(/|$)#', $rel)
    || preg_match('#^(package(-lock)?\.json|README\.md|router\.php|composer\.(json|lock))$#', $rel)) {
    tidakAda($akar);
}

// Alamat lama (.html / frontend/) -> alamat bersih
if (preg_match('#^(?:frontend/)?(.*/)?index\.html$#', $rel, $m)) alihkan($m[1] ?? '');
if (preg_match('#^(?:frontend/)?(.+)\.html$#', $rel, $m)) alihkan($m[1]);
if (preg_match('#^frontend/(.*)$#', $rel, $m)) alihkan($m[1]);
if ($rel === 'admin' || $rel === 'super-admin') alihkan($rel . '/');

if ($rel === 'favicon.ico') kirimFile($akar . '/frontend/assets/img/favicon.svg');

// API
if (preg_match('#^api/([a-z-]+)/?$#', $rel, $m)) {
    $file = $akar . '/backend/api/' . $m[1] . '.php';
    if (!is_file($file)) tidakAda($akar);
    $_SERVER['SCRIPT_NAME'] = '/backend/api/' . $m[1] . '.php'; // dipakai urlSitus()
    require $file;
    exit;
}

// File statis
$peta = [
    '#^uploads/(.+)$#'              => '/backend/uploads/%s',
    '#^assets/(.+)$#'               => '/frontend/assets/%s',
    '#^super-admin/$#'              => '/frontend/super-admin/index.html',
    '#^super-admin/([a-z-]+)$#'     => '/frontend/super-admin/%s.html',
    '#^admin/$#'                    => '/frontend/admin/index.html',
    '#^admin/([a-z-]+)$#'           => '/frontend/admin/%s.html',
    '#^([a-z-]+)$#'                 => '/frontend/%s.html',
];
foreach ($peta as $pola => $tujuan) {
    if (preg_match($pola, $rel, $m)) {
        $file = $akar . sprintf($tujuan, $m[1] ?? '');
        if (is_file($file)) kirimFile($file);
        break;
    }
}

tidakAda($akar);
