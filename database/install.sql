-- ==========================================
-- KosinAja - Pasang database dari nol (urutan wajib: skema -> migrasi -> data uji)
--   psql -U postgres -c "CREATE DATABASE kosinaja"
--   psql -U postgres -d kosinaja -f database/install.sql
-- Database lama cukup menjalankan file migrasi/ yang belum pernah dijalankan.
-- Migrasi baru: tambahkan file migrasi/005_nama.sql lalu daftarkan di bawah sebelum seed.
-- ==========================================
\set ON_ERROR_STOP on

\ir skema.sql
\ir migrasi/001_pembayaran_respon.sql
\ir migrasi/002_detail_kamar.sql
\ir migrasi/003_pencarian.sql
\ir migrasi/004_reset_password.sql
\ir seed_dummy.sql
