-- Migrasi 003: pencarian toleran salah ketik di Beranda & Katalog.
-- pg_trgm membandingkan potongan 3 huruf, jadi "sukarno hata" tetap menemukan "Soekarno Hatta".
-- Kalau migrasi ini belum dijalankan, pencarian tetap jalan (hanya cocok persis, tanpa toleransi typo).

CREATE EXTENSION IF NOT EXISTS pg_trgm;
