<?php
// Halaman awal http://localhost/KosinAja/ : cek koneksi database lalu tampilkan Beranda di URL yang sama.
// Kalau database belum siap, yang tampil halaman cek ini. Tambahkan ?cek=1 untuk selalu melihatnya.

$GLOBALS['__config'] = require __DIR__ . '/backend/config/config.php';
$db = $GLOBALS['__config']['db'];

try {
    $pdo = new PDO("pgsql:host={$db['host']};port={$db['port']};dbname={$db['dbname']}", $db['user'], $db['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
    $versi = $pdo->query('SHOW server_version')->fetchColumn();
    // Migrasi 002 menambah kolom detail_kamar.minimal_sewa_bulan; cek supaya lupa migrasi langsung ketahuan
    $migrasi = (bool) $pdo->query("SELECT 1 FROM information_schema.columns
        WHERE table_name = 'detail_kamar' AND column_name = 'minimal_sewa_bulan'")->fetchColumn();
    // Migrasi 004 menambah tabel reset_password (fitur lupa kata sandi)
    $migrasi4 = (bool) $pdo->query("SELECT to_regclass('reset_password')")->fetchColumn();
    $status = !$migrasi
        ? ['gagal', 'Database terhubung, tapi <b>database/migrasi/002_detail_kamar.sql</b> belum dijalankan.']
        : (!$migrasi4
            ? ['gagal', 'Database terhubung, tapi <b>database/migrasi/004_reset_password.sql</b> belum dijalankan.']
            : ['ok', "Terhubung ke PostgreSQL $versi, database <b>{$db['dbname']}</b>"]);
} catch (Throwable $e) {
    $status = ['gagal', 'Gagal terhubung: ' . htmlspecialchars($e->getMessage())];
}

if ($status[0] === 'ok' && !isset($_GET['cek'])) {
    readfile(__DIR__ . '/frontend/index.html');
    exit;
}
?>
<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>KosinAja - Cek Instalasi</title>
<link rel="icon" type="image/svg+xml" href="assets/img/favicon.svg">
<style>
  body { font-family: system-ui, sans-serif; background: #f4f7fb; color: #1f3349; margin: 0; padding: 32px 16px; }
  main { max-width: 640px; margin: 0 auto; }
  h1 { color: #2563eb; margin: 0 0 4px; }
  .status { padding: 12px 16px; border-radius: 10px; margin: 20px 0; }
  .ok { background: #dcfce7; color: #166534; }
  .gagal { background: #fee2e2; color: #991b1b; }
  .tombol { display: flex; gap: 8px; flex-wrap: wrap; }
  .tombol a { background: #2563eb; color: #fff; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 10px; overflow: hidden; margin-top: 16px; }
  td, th { padding: 10px 12px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
</style>
</head>
<body>
<main>
  <h1>KosinAja</h1>
  <p>Cek instalasi: database PostgreSQL dan akun uji.</p>
  <div class="status <?= $status[0] ?>"><?= $status[1] ?></div>
  <div class="tombol">
    <a href="./">Buka Situs Penyewa</a>
    <a href="masuk-pemilik">Login Pemilik</a>
  </div>
  <table>
    <tr><th>Peran</th><th>Email</th><th>Password</th></tr>
    <tr><td>Pemilik</td><td>budi.pemilik@kosinaja.test</td><td>password123</td></tr>
    <tr><td>Pemilik</td><td>siti.pemilik@kosinaja.test</td><td>password123</td></tr>
    <tr><td>Penyewa</td><td>andi@kosinaja.test</td><td>password123</td></tr>
    <tr><td>Penyewa</td><td>dewi@kosinaja.test</td><td>password123</td></tr>
  </table>
</main>
</body>
</html>
