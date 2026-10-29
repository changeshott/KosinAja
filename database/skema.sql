-- ==========================================
-- KosinAja - Skema Basis Data v2 (PostgreSQL 14+)
-- Revisi dari database.sql (commit 8719199)
-- Ringkasan perubahan ada di dokumen review; tiap blok yang berubah ditandai [v2].
-- ==========================================

-- [v2] Dibutuhkan untuk EXCLUDE constraint anti double booking (kamar_id WITH =)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ==========================================
-- 1. PEMBUATAN TIPE DATA ENUM
-- ==========================================
CREATE TYPE role_pengguna AS ENUM ('penyewa', 'admin');
CREATE TYPE tipe_kos_enum AS ENUM ('pria', 'wanita', 'campuran');
CREATE TYPE status_kamar_enum AS ENUM ('Tersedia', 'Dipesan', 'Terisi', 'Perbaikan');
-- [v2] + 'Kedaluwarsa' untuk auto-cancel 1x24 jam (Sustainability M06a & Kendala F)
CREATE TYPE status_reservasi_enum AS ENUM ('Pending', 'Survei', 'Disetujui', 'Ditolak', 'Dibatalkan', 'Kedaluwarsa', 'Selesai');
-- [v2] Kondisi barang inventaris kamar
CREATE TYPE kondisi_inventaris_enum AS ENUM ('Baik', 'Rusak Ringan', 'Rusak Berat', 'Hilang');
-- [v2] Fasilitas melekat ke kamar atau ke gedung kos
CREATE TYPE lingkup_fasilitas_enum AS ENUM ('kamar', 'bersama');

-- ==========================================
-- 2. TABEL MASTER & INDUK
-- ==========================================

-- Entitas: PENGGUNA
CREATE TABLE pengguna (
    id SERIAL PRIMARY KEY,
    nama_lengkap VARCHAR(150) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL, -- Hash dari password_hash() PHP, bukan plain text
    no_telepon VARCHAR(20) NOT NULL, -- Dipakai untuk tombol "Hubungi via WhatsApp"
    nik VARCHAR(16) UNIQUE, -- Boleh NULL untuk penyewa
    role role_pengguna NOT NULL DEFAULT 'penyewa',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- [v2] NIK harus tepat 16 digit angka
    CONSTRAINT chk_nik_format CHECK (nik IS NULL OR nik ~ '^[0-9]{16}$'),
    -- [v2] Kriteria Keberhasilan no. 11: Admin/Pemilik wajib punya NIK
    CONSTRAINT chk_admin_wajib_nik CHECK (role <> 'admin' OR nik IS NOT NULL)
);

-- Entitas: FASILITAS (master)
CREATE TABLE fasilitas (
    id SERIAL PRIMARY KEY,
    nama_fasilitas VARCHAR(100) NOT NULL UNIQUE,
    kategori VARCHAR(50) NOT NULL,
    lingkup lingkup_fasilitas_enum NOT NULL DEFAULT 'kamar', -- [v2]
    ikon VARCHAR(255) -- URL atau nama class icon (misal: 'fa-solid fa-wifi')
);

-- ==========================================
-- 3. TABEL RELASI UTAMA (PROPERTI)
-- ==========================================

-- Entitas: KOS
CREATE TABLE kos (
    id SERIAL PRIMARY KEY,
    pengguna_id INT NOT NULL, -- FK ke Pengguna (Pemilik/Admin)
    nama_kos VARCHAR(150) NOT NULL,
    tipe_kos tipe_kos_enum NOT NULL,
    alamat TEXT NOT NULL,
    -- [v2] Lokasi terstruktur supaya filter "lokasi" bisa pakai WHERE/INDEX, bukan LIKE ke alamat
    kecamatan VARCHAR(100) NOT NULL,
    kota VARCHAR(100) NOT NULL DEFAULT 'Malang',
    latitude NUMERIC(9, 6),
    longitude NUMERIC(9, 6),
    jarak_kampus_km NUMERIC(5, 2) CHECK (jarak_kampus_km >= 0), -- [v2] satuan dikunci ke km
    google_maps_url TEXT,
    deskripsi TEXT,
    peraturan_kos TEXT,
    -- [v2] foto_utama dihapus; pakai foto_kos.is_utama supaya tidak ada dua sumber foto
    -- Status publikasi gedung kos: FALSE = Draft, TRUE = Public
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- [v2] RESTRICT: akun pemilik yang masih punya kos tidak boleh terhapus diam-diam
    CONSTRAINT fk_kos_pemilik FOREIGN KEY (pengguna_id) REFERENCES pengguna(id) ON DELETE RESTRICT
);

-- Entitas: FOTO_KOS
CREATE TABLE foto_kos (
    id SERIAL PRIMARY KEY,
    kos_id INT NOT NULL,
    url_foto TEXT NOT NULL,
    kategori VARCHAR(50), -- Misal: 'Depan', 'Teras', 'Dapur'
    is_utama BOOLEAN NOT NULL DEFAULT FALSE, -- [v2] Pengganti kos.foto_utama
    CONSTRAINT fk_foto_kos FOREIGN KEY (kos_id) REFERENCES kos(id) ON DELETE CASCADE
);
-- [v2] Maksimal satu foto utama per kos
CREATE UNIQUE INDEX uq_foto_utama_per_kos ON foto_kos (kos_id) WHERE is_utama;

-- Tabel Perantara: FASILITAS_KOS (M:N Kos & Fasilitas bersama) [v2]
-- Parkir, dapur bersama, CCTV melekat ke gedung, bukan ke tiap kamar
CREATE TABLE fasilitas_kos (
    kos_id INT NOT NULL,
    fasilitas_id INT NOT NULL,
    PRIMARY KEY (kos_id, fasilitas_id),
    CONSTRAINT fk_fkos_kos FOREIGN KEY (kos_id) REFERENCES kos(id) ON DELETE CASCADE,
    CONSTRAINT fk_fkos_fasilitas FOREIGN KEY (fasilitas_id) REFERENCES fasilitas(id) ON DELETE CASCADE
);

-- Entitas: KAMAR
CREATE TABLE kamar (
    id SERIAL PRIMARY KEY,
    kos_id INT NOT NULL,
    nomor_kamar VARCHAR(20) NOT NULL,
    tipe_kamar VARCHAR(100) NOT NULL,
    harga_per_bulan NUMERIC(12, 2) NOT NULL CHECK (harga_per_bulan >= 0),
    deposit_kunci NUMERIC(12, 2) DEFAULT 0 CHECK (deposit_kunci >= 0),
    -- Diisi otomatis oleh trigger dari tabel reservasi; 'Perbaikan' diset manual oleh admin
    status status_kamar_enum NOT NULL DEFAULT 'Tersedia',
    -- Status publikasi: FALSE = Draft (disembunyikan), TRUE = Public (ditampilkan)
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_kamar_kos FOREIGN KEY (kos_id) REFERENCES kos(id) ON DELETE CASCADE,
    CONSTRAINT unique_kamar_per_kos UNIQUE (kos_id, nomor_kamar)
);

-- Entitas: DETAIL_KAMAR (Relasi 1:1)
CREATE TABLE detail_kamar (
    kamar_id INT PRIMARY KEY, -- Bertindak sebagai PK sekaligus FK
    -- [v2] Ukuran dipecah jadi angka supaya bisa difilter/diurutkan (sebelumnya VARCHAR '3x4 m')
    panjang_m NUMERIC(4, 2) NOT NULL CHECK (panjang_m > 0),
    lebar_m NUMERIC(4, 2) NOT NULL CHECK (lebar_m > 0),
    kapasitas SMALLINT NOT NULL DEFAULT 1 CHECK (kapasitas > 0), -- [v2] Ada di proposal, belum ada di SQL
    lantai SMALLINT NOT NULL CHECK (lantai >= 0), -- [v2] VARCHAR -> SMALLINT
    tipe_kasur VARCHAR(50),
    listrik VARCHAR(50),      -- Misal: 'Token Sendiri', 'Include'
    ventilasi VARCHAR(50),    -- Misal: 'Jendela Luar', 'Exhaust'
    kamar_mandi VARCHAR(50),  -- Misal: 'Dalam', 'Luar'
    deskripsi_suasana TEXT,
    CONSTRAINT fk_detail_kamar FOREIGN KEY (kamar_id) REFERENCES kamar(id) ON DELETE CASCADE
);

-- Entitas: FOTO_KAMAR [v2] - galeri per kamar (fitur "Manajemen Data Kamar & Galeri Foto")
CREATE TABLE foto_kamar (
    id SERIAL PRIMARY KEY,
    kamar_id INT NOT NULL,
    url_foto TEXT NOT NULL,
    urutan SMALLINT NOT NULL DEFAULT 0,
    CONSTRAINT fk_foto_kamar FOREIGN KEY (kamar_id) REFERENCES kamar(id) ON DELETE CASCADE
);

-- Tabel Perantara (Junction): FASILITAS_KAMAR (Relasi M:N Kamar & Fasilitas)
CREATE TABLE fasilitas_kamar (
    kamar_id INT NOT NULL,
    fasilitas_id INT NOT NULL,
    PRIMARY KEY (kamar_id, fasilitas_id),
    CONSTRAINT fk_fkamar_kamar FOREIGN KEY (kamar_id) REFERENCES kamar(id) ON DELETE CASCADE,
    CONSTRAINT fk_fkamar_fasilitas FOREIGN KEY (fasilitas_id) REFERENCES fasilitas(id) ON DELETE CASCADE
);

-- Entitas: INVENTARIS_KAMAR [v2]
-- Proposal & Kriteria Keberhasilan menjanjikan CRUD Inventaris (barang + jumlah + kondisi per kamar).
-- Fasilitas = apa yang diiklankan ke penyewa; Inventaris = barang fisik yang dicatat pemilik.
CREATE TABLE inventaris_kamar (
    id SERIAL PRIMARY KEY,
    kamar_id INT NOT NULL,
    nama_barang VARCHAR(100) NOT NULL,
    jumlah SMALLINT NOT NULL DEFAULT 1 CHECK (jumlah >= 0),
    kondisi kondisi_inventaris_enum NOT NULL DEFAULT 'Baik',
    catatan TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_inventaris_kamar FOREIGN KEY (kamar_id) REFERENCES kamar(id) ON DELETE CASCADE,
    CONSTRAINT unique_barang_per_kamar UNIQUE (kamar_id, nama_barang)
);

-- ==========================================
-- 4. TABEL TRANSAKSI & FITUR PENGGUNA
-- ==========================================

-- Entitas: RESERVASI
CREATE TABLE reservasi (
    id SERIAL PRIMARY KEY,
    pengguna_id INT NOT NULL, -- FK ke Penyewa
    kamar_id INT NOT NULL,    -- FK ke Kamar
    kode_reservasi VARCHAR(50) UNIQUE NOT NULL,
    tanggal_masuk DATE NOT NULL,
    durasi_sewa_bulan INT NOT NULL CHECK (durasi_sewa_bulan > 0),
    -- [v2] Tanggal keluar dihitung otomatis, dipakai untuk cek bentrok periode
    tanggal_keluar DATE GENERATED ALWAYS AS ((tanggal_masuk + make_interval(months => durasi_sewa_bulan))::date) STORED,
    is_survei_dahulu BOOLEAN NOT NULL DEFAULT FALSE,
    jadwal_survei TIMESTAMP, -- [v2] Fitur "penjadwalan survei" di ruang lingkup proposal
    total_biaya NUMERIC(12, 2) NOT NULL CHECK (total_biaya >= 0), -- Snapshot harga saat pengajuan
    status_reservasi status_reservasi_enum NOT NULL DEFAULT 'Pending',
    -- [v2] Batas auto-cancel 1x24 jam; dicek oleh job/cron atau saat halaman admin dibuka
    batas_konfirmasi TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
    catatan_pemilik TEXT, -- [v2] Alasan penolakan, ditampilkan ke penyewa
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_reservasi_pengguna FOREIGN KEY (pengguna_id) REFERENCES pengguna(id) ON DELETE RESTRICT,
    CONSTRAINT fk_reservasi_kamar FOREIGN KEY (kamar_id) REFERENCES kamar(id) ON DELETE RESTRICT,
    -- Status 'Survei' wajib punya jadwal
    CONSTRAINT chk_jadwal_survei CHECK (status_reservasi <> 'Survei' OR jadwal_survei IS NOT NULL),
    -- [v2] Anti double booking di level database: reservasi aktif pada kamar yang sama
    -- tidak boleh punya periode yang beririsan. Aman walau dua request masuk bersamaan.
    CONSTRAINT excl_reservasi_bentrok EXCLUDE USING gist (
        kamar_id WITH =,
        daterange(tanggal_masuk, tanggal_keluar) WITH &&
    ) WHERE (status_reservasi IN ('Pending', 'Survei', 'Disetujui'))
);

-- Entitas: ULASAN
-- [v2] kos_id & pengguna_id dihapus: keduanya turunan dari reservasi (hindari data tidak sinkron).
-- reservasi_id wajib -> ulasan hanya bisa dari transaksi nyata (fitur: "ulasan pada riwayat sewa yang selesai")
CREATE TABLE ulasan (
    id SERIAL PRIMARY KEY,
    reservasi_id INT NOT NULL UNIQUE, -- Validasi 1 Transaksi = 1 Review
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    komentar TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ulasan_reservasi FOREIGN KEY (reservasi_id) REFERENCES reservasi(id) ON DELETE CASCADE
);

-- Entitas: FAVORIT (Menyimpan Kos yang Disimpan Penyewa)
-- [v2] PK komposit, id surrogate tidak diperlukan
CREATE TABLE favorit (
    pengguna_id INT NOT NULL,
    kos_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (pengguna_id, kos_id), -- Mencegah duplicate bookmark
    CONSTRAINT fk_favorit_pengguna FOREIGN KEY (pengguna_id) REFERENCES pengguna(id) ON DELETE CASCADE,
    CONSTRAINT fk_favorit_kos FOREIGN KEY (kos_id) REFERENCES kos(id) ON DELETE CASCADE
);

-- ==========================================
-- 5. INDEX [v2]
-- PostgreSQL tidak membuat index otomatis untuk kolom FK; ini untuk JOIN & filter katalog.
-- ==========================================
CREATE INDEX idx_kos_pemilik ON kos (pengguna_id);
CREATE INDEX idx_kos_lokasi ON kos (kota, kecamatan) WHERE is_published;
CREATE INDEX idx_kamar_harga ON kamar (harga_per_bulan) WHERE is_published;
CREATE INDEX idx_foto_kos_kos ON foto_kos (kos_id);
CREATE INDEX idx_foto_kamar_kamar ON foto_kamar (kamar_id);
CREATE INDEX idx_fasilitas_kamar_fasilitas ON fasilitas_kamar (fasilitas_id);
CREATE INDEX idx_fasilitas_kos_fasilitas ON fasilitas_kos (fasilitas_id);
CREATE INDEX idx_reservasi_pengguna ON reservasi (pengguna_id);
CREATE INDEX idx_reservasi_kamar_status ON reservasi (kamar_id, status_reservasi);
CREATE INDEX idx_favorit_kos ON favorit (kos_id);

-- ==========================================
-- 6. TRIGGER [v2]
-- ==========================================

-- 6a. Status kamar otomatis mengikuti reservasi (Kriteria Keberhasilan no. 6)
--     Pending/Survei -> Dipesan, Disetujui -> Terisi, selain itu -> Tersedia.
--     Kamar berstatus 'Perbaikan' tidak disentuh.
CREATE OR REPLACE FUNCTION fn_sinkron_status_kamar() RETURNS TRIGGER AS $$
DECLARE
    v_kamar_id INT := COALESCE(NEW.kamar_id, OLD.kamar_id);
    v_status status_kamar_enum;
BEGIN
    SELECT CASE
             WHEN bool_or(status_reservasi = 'Disetujui') THEN 'Terisi'
             WHEN bool_or(status_reservasi IN ('Pending', 'Survei')) THEN 'Dipesan'
             ELSE 'Tersedia'
           END::status_kamar_enum
      INTO v_status
      FROM reservasi
     WHERE kamar_id = v_kamar_id
       AND status_reservasi IN ('Pending', 'Survei', 'Disetujui')
       AND tanggal_keluar > CURRENT_DATE;

    UPDATE kamar
       SET status = COALESCE(v_status, 'Tersedia'), updated_at = CURRENT_TIMESTAMP
     WHERE id = v_kamar_id AND status <> 'Perbaikan';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sinkron_status_kamar
AFTER INSERT OR UPDATE OF status_reservasi OR DELETE ON reservasi
FOR EACH ROW EXECUTE FUNCTION fn_sinkron_status_kamar();

-- 6b. Reservasi baru hanya untuk kamar yang tampil di katalog dan tidak sedang diperbaiki
CREATE OR REPLACE FUNCTION fn_validasi_reservasi_baru() RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM kamar k JOIN kos s ON s.id = k.kos_id
         WHERE k.id = NEW.kamar_id AND k.is_published AND s.is_published AND k.status <> 'Perbaikan'
    ) THEN
        RAISE EXCEPTION 'Kamar % tidak dapat direservasi (draft atau sedang perbaikan)', NEW.kamar_id;
    END IF;
    IF (SELECT role FROM pengguna WHERE id = NEW.pengguna_id) <> 'penyewa' THEN
        RAISE EXCEPTION 'Hanya akun penyewa yang dapat mengajukan reservasi';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validasi_reservasi_baru
BEFORE INSERT ON reservasi
FOR EACH ROW EXECUTE FUNCTION fn_validasi_reservasi_baru();

-- 6c. Ulasan hanya untuk reservasi berstatus 'Selesai'
CREATE OR REPLACE FUNCTION fn_validasi_ulasan() RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT status_reservasi FROM reservasi WHERE id = NEW.reservasi_id) <> 'Selesai' THEN
        RAISE EXCEPTION 'Ulasan hanya bisa diberikan setelah masa sewa selesai';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validasi_ulasan
BEFORE INSERT ON ulasan
FOR EACH ROW EXECUTE FUNCTION fn_validasi_ulasan();

-- 6d. Auto-cancel reservasi yang lewat batas konfirmasi.
--     Panggil dari cron / scheduler PHP, atau di awal request halaman admin: SELECT fn_kedaluwarsakan_reservasi();
CREATE OR REPLACE FUNCTION fn_kedaluwarsakan_reservasi() RETURNS INT AS $$
DECLARE
    v_jumlah INT;
BEGIN
    UPDATE reservasi
       SET status_reservasi = 'Kedaluwarsa', updated_at = CURRENT_TIMESTAMP
     WHERE status_reservasi = 'Pending' AND batas_konfirmasi < CURRENT_TIMESTAMP;
    GET DIAGNOSTICS v_jumlah = ROW_COUNT;
    RETURN v_jumlah;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 7. VIEW [v2]
-- ==========================================

-- Katalog publik: hanya kos & kamar yang sudah publish, lengkap dengan rating
CREATE VIEW v_katalog_kamar AS
SELECT k.id AS kamar_id,
       k.nomor_kamar,
       k.tipe_kamar,
       k.harga_per_bulan,
       k.status,
       s.id AS kos_id,
       s.nama_kos,
       s.tipe_kos,
       s.kecamatan,
       s.kota,
       s.jarak_kampus_km,
       (SELECT url_foto FROM foto_kos f WHERE f.kos_id = s.id AND f.is_utama) AS foto_utama,
       r.rating_rata,
       COALESCE(r.jumlah_ulasan, 0) AS jumlah_ulasan
  FROM kamar k
  JOIN kos s ON s.id = k.kos_id
  LEFT JOIN (
        SELECT km.kos_id, ROUND(AVG(u.rating), 1) AS rating_rata, COUNT(*) AS jumlah_ulasan
          FROM ulasan u
          JOIN reservasi rv ON rv.id = u.reservasi_id
          JOIN kamar km ON km.id = rv.kamar_id
         GROUP BY km.kos_id
       ) r ON r.kos_id = s.id
 WHERE k.is_published AND s.is_published;

-- Ringkasan dashboard pemilik (Fitur Admin: Dashboard Statistik)
CREATE VIEW v_statistik_pemilik AS
SELECT s.pengguna_id,
       COUNT(k.id) AS total_kamar,
       COUNT(k.id) FILTER (WHERE k.status = 'Tersedia') AS kamar_tersedia,
       COUNT(k.id) FILTER (WHERE k.status = 'Dipesan') AS kamar_dipesan,
       COUNT(k.id) FILTER (WHERE k.status = 'Terisi') AS kamar_terisi,
       COUNT(k.id) FILTER (WHERE k.status = 'Perbaikan') AS kamar_perbaikan
  FROM kos s
  LEFT JOIN kamar k ON k.kos_id = s.id
 GROUP BY s.pengguna_id;

-- ==========================================
-- 8. DATA MASTER FASILITAS
-- ==========================================
INSERT INTO fasilitas (nama_fasilitas, kategori, lingkup) VALUES
-- A. Kategori Fasilitas Kamar Tidur
('Kasur Springbed + Sprei & Bantal Guling', 'Fasilitas Kamar Tidur', 'kamar'),
('AC', 'Fasilitas Kamar Tidur', 'kamar'),
('Meja Belajar Ergonomis + Kursi Busa Nyaman', 'Fasilitas Kamar Tidur', 'kamar'),
('Lemari Pakaian 2 Pintu + Cermin Full-Body', 'Fasilitas Kamar Tidur', 'kamar'),
('WiFi', 'Fasilitas Kamar Tidur', 'kamar'),
('Multi Stop Kontak Meja & Lampu', 'Fasilitas Kamar Tidur', 'kamar'),
('TV Kabel / Smart TV 32 Inch', 'Fasilitas Kamar Tidur', 'kamar'),

-- B. Kategori Fasilitas Kamar Mandi Dalam
('Shower Air Panas', 'Fasilitas Kamar Mandi Dalam', 'kamar'),
('Kloset Duduk', 'Fasilitas Kamar Mandi Dalam', 'kamar'),
('Wastafel, Cermin, & Rak Sabun Dinding', 'Fasilitas Kamar Mandi Dalam', 'kamar'),

-- C. Kategori Fasilitas Bersama & Gedung Kos (lingkup 'bersama' -> dipasang lewat fasilitas_kos)
('Dapur Bersama (Kompor, Kulkas, Dispenser Galon)', 'Fasilitas Bersama', 'bersama'),
('Parkir Motor/Mobil', 'Fasilitas Bersama', 'bersama'),
('Ruang Jemur', 'Fasilitas Bersama', 'bersama'),
('Bebas Jam Malam', 'Fasilitas Bersama', 'bersama'),
('CCTV 24 Jam', 'Fasilitas Bersama', 'bersama');
