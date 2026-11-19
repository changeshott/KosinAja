-- Jalankan satu kali pada database KosinAja yang sudah ada.
ALTER TYPE role_pengguna ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TABLE pengguna
    ADD COLUMN IF NOT EXISTS status_verifikasi VARCHAR(20) NOT NULL DEFAULT 'disetujui',
    ADD COLUMN IF NOT EXISTS akun_aktif BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS alasan_verifikasi TEXT,
    ADD COLUMN IF NOT EXISTS diverifikasi_oleh INT REFERENCES pengguna(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS diverifikasi_at TIMESTAMP;

ALTER TABLE pengguna DROP CONSTRAINT IF EXISTS pengguna_status_verifikasi_check;
ALTER TABLE pengguna ADD CONSTRAINT pengguna_status_verifikasi_check
    CHECK (status_verifikasi IN ('menunggu', 'disetujui', 'ditolak'));
ALTER TABLE pengguna DROP CONSTRAINT IF EXISTS chk_pemilik_status;
ALTER TABLE pengguna ADD CONSTRAINT chk_pemilik_status
    CHECK (role = 'admin' OR status_verifikasi = 'disetujui');

-- Akun pemilik yang sudah ada tetap dapat masuk.
UPDATE pengguna SET status_verifikasi = 'disetujui' WHERE role = 'admin';

CREATE TABLE IF NOT EXISTS pengajuan_pemilik (
    pengguna_id INT PRIMARY KEY REFERENCES pengguna(id) ON DELETE CASCADE,
    alamat_domisili TEXT NOT NULL,
    nama_kos VARCHAR(150) NOT NULL,
    tipe_kos tipe_kos_enum NOT NULL,
    alamat_kos TEXT NOT NULL,
    kecamatan VARCHAR(100) NOT NULL,
    kota VARCHAR(100) NOT NULL DEFAULT 'Malang',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Buat akun super admin secara manual setelah migrasi. Contoh:
-- INSERT INTO pengguna (nama_lengkap,email,password,no_telepon,role)
-- VALUES ('Administrator','admin@kosinaja.id','<hash password_hash PHP>','081234567890','super_admin');
