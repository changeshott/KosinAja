-- ==========================================
-- Migrasi 004: Lupa kata sandi
-- Token reset sekali pakai, berlaku 30 menit. Yang disimpan hanya hash SHA-256 dari token,
-- token aslinya dikirim lewat email (di localhost ditulis ke backend/storage/email.log).
-- Jalankan setelah skema.sql dan migrasi 001-003.
-- ==========================================

CREATE TABLE IF NOT EXISTS reset_password (
    pengguna_id INT PRIMARY KEY,               -- satu token aktif per pengguna
    token_hash CHAR(64) NOT NULL UNIQUE,
    kedaluwarsa TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_reset_pengguna FOREIGN KEY (pengguna_id) REFERENCES pengguna(id) ON DELETE CASCADE
);
