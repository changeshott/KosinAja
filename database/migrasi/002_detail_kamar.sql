-- ==========================================
-- KosinAja - Migrasi 002 (jalankan SETELAH migrasi 001)
-- Form "Tambah Kamar" di Figma punya dua isian yang belum ada di skema:
--   Seksi 4 "Opsi Pembayaran Minimum" -> minimal_sewa_bulan
--   Seksi 5 "Peraturan & Ketentuan Kamar" -> peraturan_kamar (peraturan_kos tetap untuk aturan gedung)
-- ==========================================

ALTER TABLE detail_kamar
    ADD COLUMN minimal_sewa_bulan SMALLINT NOT NULL DEFAULT 1 CHECK (minimal_sewa_bulan BETWEEN 1 AND 12),
    ADD COLUMN peraturan_kamar TEXT;
