-- Simpan kategori dan catatan pekerjaan untuk setiap periode perbaikan kamar.
CREATE TABLE IF NOT EXISTS perbaikan_kamar (
    id BIGSERIAL PRIMARY KEY,
    kamar_id INT NOT NULL REFERENCES kamar(id) ON DELETE CASCADE,
    jenis_perbaikan VARCHAR(40) NOT NULL CHECK (jenis_perbaikan IN (
        'Kerusakan bangunan', 'Plumbing', 'Instalasi listrik', 'AC/peralatan', 'Cat/renovasi', 'Lainnya'
    )),
    catatan VARCHAR(1000) NOT NULL DEFAULT '',
    mulai_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    selesai_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_perbaikan_kamar_aktif
    ON perbaikan_kamar (kamar_id, mulai_at DESC) WHERE selesai_at IS NULL;
