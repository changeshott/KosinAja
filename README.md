# KosinAja

Aplikasi pencarian & pengelolaan kos mahasiswa.
Frontend HTML + **Tailwind CSS v4** + JavaScript murni (tanpa framework JS), backend **API JSON** PHP PDO + PostgreSQL.

```
KosinAja/
├── index.php            buka http://localhost/KosinAja/ → cek database lalu tampilkan Beranda
├── 404.php              halaman "tidak ditemukan" (JSON untuk /api/...)
├── .htaccess            URL bersih di Apache/Laragon: /katalog, /admin/kamar, /api/katalog
├── router.php           aturan URL yang sama untuk server tanpa Apache (nginx) — lihat bagian Deploy
├── public/index.php     web root di server; meneruskan semua permintaan ke router.php
├── composer.json        penanda versi PHP & ekstensi yang dibutuhkan saat deploy (tanpa dependency)
├── package.json         build Tailwind CSS (npm run build / npm run dev)
│
├── database/
│   ├── install.sql      PASANG SEMUA: skema → migrasi → data uji (cukup jalankan file ini)
│   ├── skema.sql        tabel, enum, trigger, view
│   ├── migrasi/         perubahan setelah skema, bernomor urut (001_..., 002_..., dst.)
│   └── seed_dummy.sql   data uji (password semua akun: password123)
│
├── backend/             API JSON (PHP 8.1 + PDO PostgreSQL)
│   ├── bootstrap.php    di-require semua file api/: config, autoload class, header JSON, error → JSON
│   ├── config/          muat.php (pemilih sumber config), config.example.php (contoh), config.php (buat lokal)
│   ├── core/            kerangka kecil yang dipakai semua fitur
│   │   ├── DB.php           koneksi + helper query: DB::semua/satu/nilai/insert/update/transaksi
│   │   ├── Request.php      baca body JSON/form & query string
│   │   ├── Response.php     format JSON seragam: ok, created, error, invalid (422), notFound
│   │   ├── Validator.php    aturan 'required|int|min:1' dst.
│   │   ├── Auth.php         login session, Auth::adminId() / Auth::penyewaId()
│   │   └── helpers.php      fungsi kecil: angka(), linkWhatsApp(), halaman(), kirimEmail(), ...
│   ├── models/          SEMUA query SQL, satu class per data (KosModel, KamarModel, ...)
│   ├── api/             endpoint; nama file = URL (api/kamar.php ↔ /api/kamar), daftar method di komentar atas
│   ├── uploads/         foto kos & kamar yang diunggah
│   └── storage/         email.log (email lupa kata sandi di localhost), dibuat otomatis
│
└── frontend/
    ├── *.html           halaman publik & penyewa (URL /nama-file tanpa .html)
    ├── admin/*.html     panel pemilik kos (URL /admin/nama-file); hanya HTML
    ├── tailwind/        SUMBER CSS: situs.css, auth.css, admin.css, super-admin.css (+ watch.js)
    └── assets/
        ├── css/         HASIL BUILD Tailwind (situs.css, auth.css, admin.css, super-admin.css), jangan diedit langsung
        ├── img/
        └── js/
            ├── inti/    dipakai banyak halaman: api.js (fetch + helper), situs.js (header/kartu kos),
            │            cari-langsung.js (live search), profil.js (form profil penyewa & pemilik)
            ├── halaman/ satu file per halaman publik/penyewa: beranda.js, katalog.js, detail-kos.js, ...
            └── admin/   panel pemilik: layout.js & galeri.js (bersama), lalu satu file per halaman
```

Alur satu fitur selalu sama, jadi mudah ditelusuri:
`frontend/xxx.html` → `assets/js/.../xxx.js` memanggil `api('nama')` → `backend/api/nama.php`
(cek login + validasi) → `backend/models/NamaModel.php` (SQL) → PostgreSQL.

## Cara menjalankan (Laragon)

### Instalasi baru

1. Letakkan folder project di `C:\laragon\www\KosinAja`, lalu buka Laragon dan klik **Start All**. Pastikan layanan PostgreSQL dan Apache aktif.
2. Buka Terminal Laragon (atau PowerShell) di folder project. Jika `psql` belum dikenali, gunakan path penuh Laragon berikut. Ganti `postgresql` dengan nama folder versi PostgreSQL yang ada di `C:\laragon\bin\postgresql` bila berbeda:

   ```powershell
   cd C:\laragon\www\KosinAja
   & 'C:\laragon\bin\postgresql\postgresql\bin\psql.exe' -U postgres -c "CREATE DATABASE kosinaja"
   & 'C:\laragon\bin\postgresql\postgresql\bin\psql.exe' -U postgres -d kosinaja -f database/install.sql
   ```

   Masukkan password user PostgreSQL `postgres` saat diminta. `install.sql` memasang skema, migrasi bernomor `001`–`006` dan `008`, lalu data contoh. Tidak ada migrasi bernomor `007`; nomor itu memang dilewati. Akun super admin tidak ikut dibuat oleh `install.sql` — lihat [`database/PANDUAN_SUPER_ADMIN.md`](database/PANDUAN_SUPER_ADMIN.md) kalau panel super admin mau dipakai. Jalankan install ini hanya untuk database baru/kosong. Kalau database `kosinaja` sudah ada, jangan buat ulang atau menjalankan `install.sql` di atasnya karena seed bukan proses pembaruan.

   Alternatif memakai HeidiSQL/pgAdmin: buat database `kosinaja`, lalu jalankan `skema.sql`, migrasi `001`–`006`, migrasi `008_perbaikan_kamar.sql`, dan terakhir `seed_dummy.sql`. Jangan jalankan `install.sql` lewat HeidiSQL karena file itu memakai perintah khusus `psql` (`\ir`).

3. Pastikan `backend/config/config.php` ada. File ini tidak disertakan di Git karena berisi password. Salin dari contoh yang sudah tersedia, lalu sesuaikan `password` dan `port` dengan PostgreSQL Laragon:

   ```powershell
   Copy-Item backend\config\config.example.php backend\config\config.php
   ```

   Semua kunci yang dikenali sudah ada di `config.example.php` beserta penjelasannya.

4. Di Laragon buka **Menu → PHP → Extensions**, aktifkan `pdo_pgsql`, `mbstring`, dan `fileinfo`, lalu restart Apache jika baru mengubah ekstensi.
5. Buka **http://localhost/KosinAja/**. Beranda dan katalog publik dapat dibuka tanpa login. URL **http://localhost/KosinAja/?cek=1** menampilkan status koneksi dan migrasi jika ingin memeriksa setup.

### Database yang sudah ada

Jangan jalankan `install.sql` atau `seed_dummy.sql` lagi pada database yang berisi data. Jalankan hanya migrasi yang belum diterapkan, satu per satu sesuai urutan. Untuk database lama yang belum mendapat fitur verifikasi pemilik/super admin, ikuti [`database/PANDUAN_SUPER_ADMIN.md`](database/PANDUAN_SUPER_ADMIN.md), yang menjalankan `database/migrasi/migrasi_super_admin.sql`. Instalasi baru dari `skema.sql` sudah mencakup struktur tersebut, jadi migrasi khusus itu tidak diperlukan.

## Deploy ke server online

Project ini bisa dijalankan di hosting PHP tanpa Apache (nginx + PHP-FPM, misalnya EthioDeploy)
dengan database PostgreSQL online (misalnya Supabase). Tidak ada file yang perlu diubah: yang
membedakan lokal dan server hanya **dari mana config dibaca**.

- **Lokal (Laragon)** — `backend/config/config.php` ada, jadi file itu yang dipakai.
- **Server** — `config.php` tidak ikut Git, jadi `backend/config/muat.php` beralih membaca
  *environment variable*.

### 1. Pengaturan di panel hosting

| Pengaturan | Nilai |
|---|---|
| Web root / document root | `public` |
| Versi PHP | 8.1 atau lebih baru |
| Ekstensi PHP | `pdo`, `pdo_pgsql`, `mbstring`, `fileinfo` |
| Build command | tidak perlu (`composer.json` tanpa dependency); kalau wajib diisi: `composer install --no-dev --optimize-autoloader` |

Permintaan masuk ke `public/index.php` → `router.php`, yang memakai aturan URL sama dengan
`.htaccess`. Jadi `/katalog`, `/admin/kamar`, `/api/katalog`, dan `/uploads/...` tetap berfungsi,
dan `/backend/...` serta `/database/...` tetap tidak bisa dibuka dari browser.

### 2. Environment variable

| Nama | Contoh isi | Keterangan |
|---|---|---|
| `DATABASE_URL` | `postgresql://user:password@host:6543/postgres?sslmode=require` | Connection string dari Supabase. Mengganti semua `DB_*` di bawah |
| `DB_SSLMODE` | `require` | Wajib untuk Supabase. Tidak perlu kalau `sslmode` sudah ada di `DATABASE_URL` |
| `APP_DEBUG` | `false` | **Selalu `false`** di server; `true` hanya sementara saat mencari error |
| `URL_SITUS` | `https://nama-project.ethiodeploy.app/` | Dipakai untuk link di email lupa kata sandi |

Kalau hosting tidak menyediakan `DATABASE_URL`, isi terpisah: `DB_HOST`, `DB_PORT`, `DB_NAME`,
`DB_USER`, `DB_PASSWORD`, `DB_SSLMODE`. Password yang mengandung karakter khusus (`@`, `/`, `:`)
aman ditulis di `DATABASE_URL` selama di-*URL encode* (`@` → `%40`, `/` → `%2F`).

### 3. Pasang database

Supabase memberi database `postgres` yang sudah jadi, jadi langkah `CREATE DATABASE` dilewati.
Jalankan dari komputer sendiri memakai `psql` (ambil connection string di Supabase →
**Project Settings → Database**):

```powershell
psql "postgresql://user:password@host:5432/postgres?sslmode=require" -f database/install.sql
```

`install.sql` memakai perintah khusus `psql` (`\ir`, `\set`), jadi **jangan** menempelkan isinya
ke SQL Editor Supabase. Kalau hanya punya SQL Editor, jalankan berurutan satu per satu:
`skema.sql` → migrasi `001`–`006` → `008_perbaikan_kamar.sql` → `seed_dummy.sql`.

Dua ekstensi dibuat otomatis oleh skrip (`btree_gist` untuk mencegah double booking, `pg_trgm`
untuk pencarian) dan keduanya tersedia di Supabase.

`seed_dummy.sql` berisi data contoh beserta akun uji berpassword `password123`. Untuk situs yang
dipakai sungguhan, lewati file itu dan buat akun sendiri lewat halaman daftar.

Akun super admin tidak ikut dibuat skrip mana pun. Ikuti
[`database/PANDUAN_SUPER_ADMIN.md`](database/PANDUAN_SUPER_ADMIN.md) kalau panel `/super-admin/`
mau dipakai — buat hash kata sandi sendiri, jangan pakai hash contoh di `buat_super_admin.sql`.

### 4. Cek setelah deploy

Buka `https://alamat-situs/?cek=1`. Halaman itu menampilkan status koneksi database dan menyebut
nama file migrasi yang belum dijalankan, jadi penyebab error langsung kelihatan tanpa perlu
menyalakan `APP_DEBUG`.

### Yang perlu diketahui

- **Foto unggahan tidak permanen.** Foto disimpan ke `backend/uploads/`, yang ikut terhapus setiap
  kali aplikasi di-deploy ulang di hosting dengan penyimpanan sementara. Foto contoh dari seed tetap
  ada karena ikut Git. Supaya unggahan awet, foto perlu dipindah ke penyimpanan objek (Supabase Storage).
- **Email lupa kata sandi belum terkirim.** Masih ditulis ke `backend/storage/email.log` di server,
  bukan dikirim lewat SMTP. Lihat bagian *Lupa kata sandi* di bawah.
- **Jangan unggah `backend/config/config.php` ke server.** Kalau file itu ada, environment variable
  diabaikan dan koneksi akan memakai `127.0.0.1` milik server.

## CSS (Tailwind CSS v4)

Semua tampilan memakai Tailwind CSS v4 lewat Tailwind CLI. Hasil build (`assets/css/situs.css`,
`assets/css/auth.css`, `assets/css/admin.css`, `assets/css/super-admin.css`) **ikut di-commit**, jadi untuk sekadar menjalankan aplikasi
tidak perlu Node.js. Node.js hanya dibutuhkan kalau mengubah class atau file di `frontend/tailwind/`:

```
npm install        # sekali saja
npm run build      # build keempat bundle CSS (minify)
npm run dev        # build ulang otomatis setiap HTML/JS/CSS disimpan
```

- Tata letak halaman ditulis langsung sebagai utility class di HTML (`flex gap-4 max-md:flex-col ...`).
- Komponen yang dipakai berulang atau dibuat dari JavaScript (kartu kos, tombol, modal, tabel, form)
  didefinisikan di `@layer components` dengan `@apply` di `frontend/tailwind/*.css`.
- Token desain (warna `aksen`, `navy`, `abu`, ukuran huruf `text-13` = 13px, dll.) ada di blok `@theme`.
- Breakpoint memakai varian `max-*`: `max-sm` (HP), `max-md` (tablet), `max-lg`/`max-xl` (laptop kecil).
- Setiap bundle hanya memindai file miliknya (`@source`), termasuk halaman dan script super admin, jadi class baru di HTML/JS harus di-build ulang.

### Akun uji (seed_dummy.sql)

| Peran | Email | Password | Halaman masuk |
|---|---|---|---|
| Pemilik | budi.pemilik@kosinaja.test | password123 | `/masuk-pemilik` |
| Pemilik | siti.pemilik@kosinaja.test | password123 | `/masuk-pemilik` |
| Penyewa | andi@kosinaja.test | password123 | `/masuk` |
| Penyewa | dewi@kosinaja.test | password123 | `/masuk` |

## Halaman

| Halaman | URL (setelah `http://localhost/KosinAja`) | Login |
|---|---|---|
| Beranda | `/` | – |
| Katalog Kos (filter, urut, paginasi) | `/katalog?q=&tipe_kos=&kecamatan=&harga_min=&harga_max=&fasilitas=1,2&tersedia=1&urut=` | – |
| Detail Kos + ajukan sewa | `/detail-kos?id=1&kamar=3` | ajukan sewa: penyewa |
| Reservasi Saya + beri/ubah/hapus ulasan | `/reservasi-saya` (`?ulas=ID` buka modal ulasan) | penyewa |
| Kos Favorit | `/favorit` | penyewa |
| Profil Saya (data diri & ganti kata sandi) | `/profil` | penyewa |
| Bantuan, Tentang Kami | `/bantuan`, `/tentang` | – |
| Masuk / Daftar penyewa | `/masuk`, `/daftar` (`?kembali=/path` setelah login) | – |
| Masuk / Daftar mitra | `/masuk-pemilik`, `/daftar-mitra` | – |
| Masuk Super Admin | `/masuk-super-admin` | super admin (akun dibuat manual) |
| Lupa / Atur kata sandi | `/lupa-sandi`, `/atur-sandi?token=` (tautan dari email) | – |
| Onboarding pemilik baru | `/admin/onboarding` | pemilik |
| Dashboard | `/admin/` | pemilik |
| Tambah / Edit Kos | `/admin/tambah-kos` (`?id=` edit) | pemilik |
| Tambah / Edit Kamar | `/admin/tambah-kamar` (`?id=` edit) | pemilik |
| Pengajuan Reservasi | `/admin/reservasi` | pemilik |
| Kelola Kamar & Unit + Inventaris | `/admin/kamar` (tombol papan klip di kartu = inventaris) | pemilik |
| Kelola Penyewa | `/admin/penyewa` (`?kamar_id=`) | pemilik |
| Ulasan Penghuni | `/admin/ulasan` | pemilik |
| Profil Saya (data pemilik & ganti kata sandi) | `/admin/profil` | pemilik |
| Konfirmasi & data pemilik | `/super-admin/`, `/super-admin/pemilik` | super admin |

Penyiapan Super Admin dan migrasi database instalasi lama: lihat [`database/PANDUAN_SUPER_ADMIN.md`](database/PANDUAN_SUPER_ADMIN.md).

### Pencarian di Beranda & Katalog

Live search ada di `assets/js/inti/cari-langsung.js` dan dipakai kedua halaman.

- Ketik minimal 2 huruf: panel saran berisi **Filter cepat** (tipe putri/putra/campuran), **Lokasi** (kecamatan), dan **Kos** (5 teratas, ikut chip filter aktif).
- Kotak cari kosong + diklik: **pencarian terakhir** (disimpan di browser, `kosinaja.riwayatCari`) dan **lokasi populer**.
- Keyboard: `/` fokus ke kotak cari, `↑`/`↓` memilih, `Enter` membuka, `Esc` menutup.
- Pencarian per kata dan toleran salah ketik: nama, alamat, kecamatan, deskripsi, fasilitas, serta sinonim tipe kos ikut dicari; "putri" cocok dengan tipe wanita dan "sukarno hata" menemukan "Soekarno Hatta".
- Kata seperti "murah" atau "budget" mengurutkan hasil dari harga terendah; "mahal" mengurutkan dari harga tertinggi. Kata penghubung seperti "kos", "dekat", dan "sekitar" tidak menghambat pencarian.
- Daftar kos memakai skeleton loading, chip filter aktif dengan tombol ×, dan tampilan "tidak ditemukan"
  dengan tombol untuk melonggarkan filter (juga di Katalog).

### Filter di Katalog

- Filter langsung diterapkan saat diubah (harga menunggu 0,6 detik setelah berhenti mengetik), tanpa tombol "Terapkan".
- Harga: pilihan cepat (< 750 rb, 750 rb - 1 jt, > 1 jt) dan peringatan kalau minimum > maksimum.
- Fasilitas dikelompokkan per kategori; paginasi `1 … 4 5 6 … 20`; request lama dibatalkan (AbortController).
- Layar kecil: filter jadi lembar bawah dengan latar gelap, tombol tutup, lencana jumlah filter, dan tombol "Lihat N kos".
- Centang filter mengganti URL (`replaceState`); cari & pindah halaman menambah riwayat, jadi tombol Back tetap wajar.
- Backend: daftar + total dihitung dalam satu query (`COUNT(*) OVER()`).

### Pusat Bantuan

- FAQ ditulis di `bantuan.html` sebagai `<details id data-topik data-kata>`; menambah pertanyaan cukup di HTML.
  `data-topik`: `cari`, `sewa`, `bayar`, `akun`, `pemilik`. `data-kata`: kata kunci tambahan (sinonim, istilah sehari-hari).
- Pencarian di browser (`assets/js/halaman/bantuan.js`): per kata, kata dasar ("membatalkan" -> "batal"), sinonim
  ("password" ~ "sandi"), toleran salah ketik, diurutkan menurut relevansi, dan kata yang cocok ditandai.
- Saran jawaban saat mengetik, `?q=&topik=` di URL, tautan langsung per pertanyaan (`bantuan#lupa-sandi`),
  serta "Apakah jawaban ini membantu?" (diingat di browser, `kosinaja.faqMembantu`).

Panel pemilik mengingat kos aktif di `localStorage` (`kosinaja.kosAktif`) dan `?kos_id=`.

## URL

Diatur `.htaccess` di root (Apache `mod_rewrite`, sudah aktif di Laragon). Tidak ada `.html`, `.php`,
`frontend/` atau `backend/` di alamat yang dilihat pengguna. Di server tanpa Apache, aturan yang
sama dijalankan `router.php` (lihat bagian [Deploy](#deploy-ke-server-online)) — kalau satu aturan
di tabel bawah diubah, ubah di kedua file.

| Alamat | File sebenarnya |
|---|---|
| `/` | `index.php` → isi `frontend/index.html` |
| `/katalog`, `/detail-kos?id=1`, ... | `frontend/katalog.html`, `frontend/detail-kos.html`, ... |
| `/admin/`, `/admin/kamar`, ... | `frontend/admin/index.html`, `frontend/admin/kamar.html`, ... |
| `/assets/...` | `frontend/assets/...` (css, js, gambar) |
| `/api/katalog?...` | `backend/api/katalog.php` |
| `/uploads/kos/1.jpg` | `backend/uploads/kos/1.jpg` |

Alamat lama (`/frontend/katalog.html`, `/katalog.html`) dialihkan permanen (301) ke alamat baru.
`/backend/...`, `/database/...`, `README.md` dan `.gitignore` tidak bisa dibuka dari browser (404).
Alamat yang tidak ada menampilkan `404.php` bergaya KosinAja; untuk `/api/...` jawabannya JSON.
Di JavaScript cukup panggil `api('katalog?q=...')`; alamat dasarnya dihitung di `assets/js/inti/api.js`.

## Format response

```json
{ "success": true,  "message": "OK", "data": { } }
{ "success": false, "message": "Data tidak valid", "errors": { "nama_kos": "Wajib diisi" } }
```

Error dari database (nomor kamar dobel, double booking, kamar masih punya reservasi, dll.) sudah
diterjemahkan ke pesan bahasa Indonesia. Set `'debug' => false` di config saat presentasi
(di server: `APP_DEBUG=false`).

## Login

Session PHP (`backend/core/Auth.php`). Frontend dan backend satu origin, jadi cookie ikut otomatis.
Role `admin` = pemilik kos, `penyewa` = mahasiswa. Endpoint pemilik memanggil `Auth::adminId()`
(401/403 kalau bukan pemilik) dan semua query difilter berdasarkan pemilik yang login.

## Endpoint

| Bagian | Method & URL | Keterangan |
|---|---|---|
| Akun aktif | `GET api/auth` | null kalau belum login; pemilik dapat `nik_samar` |
| Masuk / Daftar / Keluar | `POST api/auth?aksi=masuk` · `daftar` · `keluar` | body `sebagai: penyewa\|admin`; `nik` wajib untuk admin |
| Ubah profil | `PUT api/auth` | `{nama_lengkap, no_telepon}` |
| Ganti kata sandi | `PUT api/auth?aksi=sandi` | `{password_lama, password_baru}` |
| Lupa / reset kata sandi | `POST api/auth?aksi=lupa` `{email}`, `POST api/auth?aksi=reset` `{token, password}` | token 30 menit, sekali pakai |
| Katalog (publik) | `GET api/katalog?q=&tipe_kos=&kecamatan=&harga_min=&harga_max=&fasilitas=&tersedia=&urut=&page=` | `urut=terdekat` memakai `latitude` dan `longitude` dari izin lokasi browser |
| Detail kos (publik) | `GET api/katalog?id=1` | WA pemilik hanya kalau login |
| Opsi filter | `GET api/katalog?opsi=1` | |
| Reservasi Saya | `GET / POST api/akun?bagian=reservasi`, `PATCH ?bagian=reservasi&id=` (batal) | penyewa |
| Ulasan penyewa | `POST api/akun?bagian=ulasan`, `PUT / DELETE ?bagian=ulasan&id=` | `{reservasi_id, rating, komentar}` |
| Favorit | `GET / POST api/akun?bagian=favorit`, `DELETE ?bagian=favorit&kos_id=` | penyewa |
| Dashboard | `GET api/dashboard?kos_id=1` | pemilik |
| Kos | `GET / POST api/kos`, `GET / PUT / DELETE ?id=` | pemilik |
| Kamar | `GET api/kamar?kos_id=&status=&tipe_kamar=&q=`, `POST`, `GET / PUT / PATCH / DELETE ?id=` | PATCH `{"perbaikan": true}` untuk menutup perbaikan; mulai perbaikan mengirim jenis dan catatan |
| Pengajuan Reservasi | `GET api/reservasi?kos_id=&status=menunggu&q=&page=` | |
| Aksi reservasi | `PATCH api/reservasi?id=7&aksi=setujui\|tolak\|survei\|selesai\|batalkan\|pembayaran` | tolak: `catatan_pemilik`, survei: `jadwal_survei`, pembayaran: `jumlah_dp, status_pembayaran` |
| Kelola Penyewa | `GET api/penyewa?kos_id=&kamar_id=&status=aktif\|akan_masuk\|selesai\|semua&q=`, `GET ?id=` | `q` cocok ke nama, email, nomor kamar |
| Ulasan kos | `GET api/ulasan?kos_id=1` | termasuk sebaran bintang |
| Fasilitas | `GET api/fasilitas?lingkup=kamar\|bersama`, `POST` | |
| Foto | `POST api/foto` (multipart), `DELETE ?jenis=&id=` | jenis=kos (+kos_id, is_utama) atau kamar (+kamar_id) |

## Menambah fitur baru

1. **Tabel/kolom baru**: buat migrasi bernomor berikutnya, daftarkan di `database/install.sql` sebelum seed, dan perbarui database yang sudah ada dengan migrasi tersebut.
2. **Query**: tambah method di model yang sesuai (atau `backend/models/NamaModel.php` baru, otomatis ter-load).
   Pakai helper `DB`, contoh:
   ```php
   DB::semua('SELECT * FROM kamar WHERE kos_id = :kos', ['kos' => $kosId]);           // banyak baris
   DB::satu('SELECT * FROM kos WHERE id = :id', ['id' => $id]) ?? Response::notFound(); // satu baris / 404
   DB::insert('inventaris_kamar', $data)['id'];                                         // INSERT ... RETURNING id
   DB::update('kos', $data, 'id = :id', ['id' => $id]);                                 // UPDATE kolom di $data
   ```
3. **Endpoint**: file baru `backend/api/nama.php` (otomatis jadi `/api/nama`). Mulai dengan
   `require __DIR__ . '/../bootstrap.php';`, cek login (`Auth::adminId()` / `Auth::penyewaId()`),
   validasi (`Validator::validate(Request::body(), [...])`), lalu `Response::ok(...)`. Tulis daftar method di komentar atas.
4. **Halaman**: `frontend/nama.html` (atau `frontend/admin/nama.html`) + `assets/js/halaman/nama.js`
   (atau `assets/js/admin/nama.js`). Panggil API dengan `await api('nama?id=1')`.
5. **Tampilan**: tulis utility class Tailwind di HTML; jalankan `npm run dev` selama mengerjakan supaya CSS ikut terbuild.

## Lupa kata sandi di localhost

Belum ada server email (SMTP), jadi "email" reset ditulis ke `backend/storage/email.log`.
Buka file itu, salin tautan `atur-sandi?token=...` ke browser. Untuk server online, ganti isi fungsi
`kirimEmail()` di `backend/core/helpers.php` dengan `mail()`/PHPMailer, dan isi `url_situs` di config
(atau environment variable `URL_SITUS`). Sebelum diganti, fitur ini tetap "berhasil" di server tetapi
emailnya hanya masuk ke log yang tidak bisa dibuka pengguna.

## Belum dibuat

Login dengan Google masih menampilkan pemberitahuan "segera hadir" (butuh Client ID OAuth dari Google Cloud).
Master fasilitas sengaja hanya bisa ditambah (tidak diubah/dihapus) karena dipakai bersama semua pemilik.
