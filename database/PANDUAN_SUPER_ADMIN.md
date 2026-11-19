# Menyiapkan Super Admin

1. Jalankan `migrasi_super_admin.sql` pada database KosinAja yang sudah dipakai. Migrasi ini mempertahankan pemilik lama sebagai akun terverifikasi.
2. Buat hash kata sandi lewat PHP CLI:

   ```sh
   php -r "echo password_hash('GANTI_DENGAN_KATA_SANDI_KUAT', PASSWORD_DEFAULT), PHP_EOL;"
   ```

3. Ganti nilai hash pada perintah SQL berikut, lalu jalankan sekali:

   ```sql
   INSERT INTO pengguna (nama_lengkap, email, password, no_telepon, role)
   VALUES ('Administrator KosinAja', 'admin@kosinaja.id', '<hash dari langkah 2>', '081234567890', 'super_admin');
   ```

4. Masuk melalui `/masuk-super-admin`. Pendaftaran publik tidak menerima peran `super_admin`.

Pemilik baru otomatis berstatus `menunggu`; setelah disetujui, mereka dapat masuk ke panel pemilik dan mulai mengelola kos. Kos hanya tampil di katalog ketika pemilik terverifikasi dan akunnya aktif.
