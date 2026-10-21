-- ==========================================
-- 1. PEMBUATAN TIPE DATA ENUM (OPSIONAL, UNTUK KONSISTENSI)
-- ==========================================
CREATE TYPE role_pengguna AS ENUM ('penyewa', 'admin');
CREATE TYPE tipe_kos_enum AS ENUM ('pria', 'wanita', 'campuran');
CREATE TYPE status_kamar_enum AS ENUM ('Tersedia', 'Dipesan', 'Terisi', 'Perbaikan');
CREATE TYPE status_reservasi_enum AS ENUM ('Pending', 'Survei', 'Disetujui', 'Ditolak', 'Dibatalkan', 'Selesai');

-- ==========================================
-- 2. TABEL MASTER & INDUK
-- ==========================================

-- Entitas: PENGGUNA
CREATE TABLE pengguna (
    id SERIAL PRIMARY KEY,
    nama_lengkap VARCHAR(150) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    no_telepon VARCHAR(20) NOT NULL,
    nik VARCHAR(16) UNIQUE, -- Bisa Null untuk penyewa yang belum melengkapi profil
    role role_pengguna NOT NULL DEFAULT 'penyewa',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Entitas: FASILITAS
CREATE TABLE fasilitas (
    id SERIAL PRIMARY KEY,
    nama_fasilitas VARCHAR(100) NOT NULL,
    kategori VARCHAR(50) NOT NULL,
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
    jarak_kampus NUMERIC(5, 2), -- Disimpan dalam satuan Kilometer atau Meter
    google_maps_url TEXT,
    deskripsi TEXT,
    peraturan_kos TEXT,
    foto_utama TEXT,
	-- Status publikasi gedung kos: FALSE = Draft, TRUE = Public
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_kos_pemilik FOREIGN KEY (pengguna_id) REFERENCES pengguna(id) ON DELETE CASCADE
);

-- Entitas: FOTO_KOS
CREATE TABLE foto_kos (
    id SERIAL PRIMARY KEY,
    kos_id INT NOT NULL,
    url_foto TEXT NOT NULL,
    kategori VARCHAR(50), -- Misal: 'Depan', 'Teras', 'Dapur'
    CONSTRAINT fk_foto_kos FOREIGN KEY (kos_id) REFERENCES kos(id) ON DELETE CASCADE
);

-- Entitas: KAMAR
CREATE TABLE kamar (
    id SERIAL PRIMARY KEY,
    kos_id INT NOT NULL,
    nomor_kamar VARCHAR(20) NOT NULL,
    tipe_kamar VARCHAR(100) NOT NULL,
    harga_per_bulan NUMERIC(12, 2) NOT NULL CHECK (harga_per_bulan >= 0),
    deposit_kunci NUMERIC(12, 2) DEFAULT 0 CHECK (deposit_kunci >= 0),
    status status_kamar_enum NOT NULL DEFAULT 'Tersedia',
	-- Status publikasi: FALSE = Draft (disembunyikan), TRUE = Public (ditampilkan)
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_kamar_kos FOREIGN KEY (kos_id) REFERENCES kos(id) ON DELETE CASCADE,
    CONSTRAINT unique_kamar_per_kos UNIQUE (kos_id, nomor_kamar)
);

-- Entitas: DETAIL_KAMAR (Relasi 1:1)
CREATE TABLE detail_kamar (
    kamar_id INT PRIMARY KEY, -- Bertindak sebagai PK sekaligus FK
    ukuran_kamar VARCHAR(20) NOT NULL, -- Misal: '3x4 m'
	lantai VARCHAR(20) NOT NULL,
    tipe_kasur VARCHAR(50),
    listrik VARCHAR(50),      -- Misal: 'Token Sendiri', 'Include'
    ventilasi VARCHAR(50),    -- Misal: 'Jendela Luar', 'Exhaust'
    kamar_mandi VARCHAR(50),  -- Misal: 'Dalam', 'Luar'
    deskripsi_suasana TEXT,
    CONSTRAINT fk_detail_kamar FOREIGN KEY (kamar_id) REFERENCES kamar(id) ON DELETE CASCADE
);

-- Tabel Perantara (Junction): FASILITAS_KAMAR (Relasi M:N Kamar & Fasilitas)
CREATE TABLE fasilitas_kamar (
    kamar_id INT NOT NULL,
    fasilitas_id INT NOT NULL,
    PRIMARY KEY (kamar_id, fasilitas_id),
    CONSTRAINT fk_fkamar_kamar FOREIGN KEY (kamar_id) REFERENCES kamar(id) ON DELETE CASCADE,
    CONSTRAINT fk_fkamar_fasilitas FOREIGN KEY (fasilitas_id) REFERENCES fasilitas(id) ON DELETE CASCADE
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
    is_survei_dahulu BOOLEAN DEFAULT FALSE,
    total_biaya NUMERIC(12, 2) NOT NULL CHECK (total_biaya >= 0),
    status_reservasi status_reservasi_enum NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_reservasi_pengguna FOREIGN KEY (pengguna_id) REFERENCES pengguna(id) ON DELETE RESTRICT,
    CONSTRAINT fk_reservasi_kamar FOREIGN KEY (kamar_id) REFERENCES kamar(id) ON DELETE RESTRICT
);

-- Entitas: ULASAN
CREATE TABLE ulasan (
    id SERIAL PRIMARY KEY,
    pengguna_id INT NOT NULL,  -- Siapa yang mereview
    kos_id INT NOT NULL,       -- Kos mana yang direview
    reservasi_id INT UNIQUE,   -- Validasi 1 Transaksi = 1 Review
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    komentar TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ulasan_pengguna FOREIGN KEY (pengguna_id) REFERENCES pengguna(id) ON DELETE CASCADE,
    CONSTRAINT fk_ulasan_kos FOREIGN KEY (kos_id) REFERENCES kos(id) ON DELETE CASCADE,
    CONSTRAINT fk_ulasan_reservasi FOREIGN KEY (reservasi_id) REFERENCES reservasi(id) ON DELETE SET NULL
);

-- Entitas: FAVORIT (Menyimpan Kos yang Disimpan Penyewa)
CREATE TABLE favorit (
    id SERIAL PRIMARY KEY,
    pengguna_id INT NOT NULL,
    kos_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_favorit_pengguna FOREIGN KEY (pengguna_id) REFERENCES pengguna(id) ON DELETE CASCADE,
    CONSTRAINT fk_favorit_kos FOREIGN KEY (kos_id) REFERENCES kos(id) ON DELETE CASCADE,
    CONSTRAINT unique_favorit_per_user UNIQUE (pengguna_id, kos_id) -- Mencegah duplicate bookmark
);

INSERT INTO fasilitas (nama_fasilitas, kategori) VALUES
-- A. Kategori Fasilitas Kamar Tidur
('Kasur Springbed + Sprei & Bantal Guling', 'Fasilitas Kamar Tidur'),
('AC', 'Fasilitas Kamar Tidur'),
('Meja Belajar Ergonomis + Kursi Busa Nyaman', 'Fasilitas Kamar Tidur'),
('Lemari Pakaian 2 Pintu + Cermin Full-Body', 'Fasilitas Kamar Tidur'),
('WiFi', 'Fasilitas Kamar Tidur'),
('Multi Stop Kontak Meja & Lampu', 'Fasilitas Kamar Tidur'),
('TV Kabel / Smart TV 32 Inch', 'Fasilitas Kamar Tidur'),

-- B. Kategori Fasilitas Kamar Mandi Dalam
('Shower Air Panas', 'Fasilitas Kamar Mandi Dalam'),
('Kloset Duduk', 'Fasilitas Kamar Mandi Dalam'),
('Wastafel, Cermin, & Rak Sabun Dinding', 'Fasilitas Kamar Mandi Dalam'),

-- C. Kategori Fasilitas Bersama & Gedung Kos
('Dapur Bersama (Kompor, Kulkas, Dispenser Galon)', 'Fasilitas Bersama'),
('Parkir Motor/Mobil', 'Fasilitas Bersama'),
('Ruang Jemur', 'Fasilitas Bersama'),
('Bebas Jam Malam', 'Fasilitas Bersama'),
('CCTV 24 Jam', 'Fasilitas Bersama');