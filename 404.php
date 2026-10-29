<?php
// Halaman "tidak ditemukan" (ErrorDocument 404 di .htaccess).
// <base> dihitung dari lokasi file ini, jadi aset tetap benar walau URL yang salah bertingkat (mis. /KosinAja/a/b/c).
// Permintaan ke /api/... dijawab JSON supaya fetch() di frontend tetap bisa membaca pesannya.

http_response_code(404);
$base = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'])), '/') . '/';
$asal = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?: ''; // URL asli yang diminta browser

if (str_starts_with($asal, $base . 'api/')) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'message' => 'Endpoint API tidak ditemukan'], JSON_UNESCAPED_UNICODE);
    exit;
}
?>
<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <base href="<?= htmlspecialchars($base) ?>">
  <link rel="icon" type="image/svg+xml" href="assets/img/favicon.svg">
  <title>Halaman Tidak Ditemukan - KosinAja</title>
  <meta name="robots" content="noindex">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="assets/css/situs.css">
</head>
<body data-halaman="404">
<header id="kepala"></header>
<main class="bg-white bg-[radial-gradient(ellipse_at_top,#eaf1ff,transparent_70%)] pt-18 pb-20 text-center border-b border-garis">
  <div class="wadah">
    <span class="block font-judul text-120 font-extrabold leading-none tracking-[-4px] bg-[linear-gradient(135deg,var(--color-aksen),#60a5fa)] bg-clip-text text-transparent max-sm:text-88" aria-hidden="true">404</span>
    <h1 class="mt-3 mb-2 text-40 leading-[1.15] tracking-[-.8px] max-sm:text-28">Halaman <span class="text-aksen">tidak ditemukan</span></h1>
    <p class="mx-auto my-0 max-w-[672px] text-abu text-16 leading-6">Alamat yang kamu buka mungkin salah ketik atau halamannya sudah dipindahkan. Coba cari kos yang kamu butuhkan di bawah ini.</p>
    <form class="kotak-cari max-w-[768px] mx-auto mt-8 mb-4" action="katalog" role="search">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <label class="sr-only" for="q">Cari kos</label>
      <input id="q" name="q" type="search" placeholder="Cari nama kos, jalan, atau kecamatan">
      <button class="btn-utama" type="submit">Cari Kos</button>
    </form>
    <div class="flex flex-wrap justify-center gap-2">
      <a class="btn-garis" href="./">Kembali ke Beranda</a>
      <a class="btn-garis" href="katalog">Lihat Katalog Kos</a>
      <a class="btn-garis" href="bantuan">Pusat Bantuan</a>
    </div>
  </div>
</main>
<footer id="kaki"></footer>

<script src="assets/js/inti/api.js"></script>
<script src="assets/js/inti/situs.js"></script>
<script>document.addEventListener('DOMContentLoaded', () => Situs.mulai());</script>
</body>
</html>
