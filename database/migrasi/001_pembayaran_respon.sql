-- ==========================================
-- KosinAja - Migrasi 001 (jalankan SETELAH skema.sql)
-- Menutup dua celah antara desain Dashboard (Figma) dan skema v2:
--   1. Kolom "Total & Status DP" -> skema v2 belum mencatat pembayaran sama sekali.
--   2. "Rata-rata Respon Mitra"  -> butuh waktu pemilik merespon, updated_at tidak bisa dipakai
--      karena ikut berubah saat status lain diubah.
-- ==========================================

CREATE TYPE status_pembayaran_enum AS ENUM ('Belum Bayar', 'DP', 'Lunas');

ALTER TABLE reservasi
    ADD COLUMN jumlah_dp NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (jumlah_dp >= 0),
    ADD COLUMN status_pembayaran status_pembayaran_enum NOT NULL DEFAULT 'Belum Bayar',
    ADD COLUMN bukti_pembayaran TEXT,       -- path file bukti transfer
    ADD COLUMN direspon_at TIMESTAMP,       -- diisi saat pemilik pertama kali setujui/tolak/jadwalkan survei
    ADD CONSTRAINT chk_dp_tidak_melebihi_total CHECK (jumlah_dp <= total_biaya);
