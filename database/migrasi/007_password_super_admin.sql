-- ==========================================
-- KosinAja - Migrasi 007: Set password superadmin
-- Menambahkan baris pada tabel pengguna untuk superadmin
-- ==========================================

INSERT INTO pengguna (nama_lengkap, email, password, no_telepon, role)
   VALUES ('Administrator KosinAja', 'admin@kosinaja.id', 'adminkossrithebat123', '085717509121', 'super_admin');