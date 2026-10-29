-- ==========================================
-- KosinAja - Data Uji (dummy) untuk skema.sql + migrasi
-- Semua akun memakai password: password123  (hash bcrypt, cocok dengan password_verify() PHP)
-- ==========================================

INSERT INTO pengguna (nama_lengkap, email, password, no_telepon, nik, role) VALUES
('Budi Santoso',     'budi.pemilik@kosinaja.test',  '$2a$10$bQl44gghWy/nYQuzzSA26ulxRF3udgpDD1FH2xn7LDTPNkbRQTx1W', '081234500001', '3573010101800001', 'admin'),
('Siti Rahmawati',   'siti.pemilik@kosinaja.test',  '$2a$10$bQl44gghWy/nYQuzzSA26ulxRF3udgpDD1FH2xn7LDTPNkbRQTx1W', '081234500002', '3573014202850002', 'admin'),
('Andi Pratama',     'andi@kosinaja.test',          '$2a$10$bQl44gghWy/nYQuzzSA26ulxRF3udgpDD1FH2xn7LDTPNkbRQTx1W', '085700000001', NULL, 'penyewa'),
('Dewi Lestari',     'dewi@kosinaja.test',          '$2a$10$bQl44gghWy/nYQuzzSA26ulxRF3udgpDD1FH2xn7LDTPNkbRQTx1W', '085700000002', NULL, 'penyewa'),
('Rizky Hidayat',    'rizky@kosinaja.test',         '$2a$10$bQl44gghWy/nYQuzzSA26ulxRF3udgpDD1FH2xn7LDTPNkbRQTx1W', '085700000003', NULL, 'penyewa');

INSERT INTO kos (pengguna_id, nama_kos, tipe_kos, alamat, kecamatan, kota, latitude, longitude, jarak_kampus_km, deskripsi, peraturan_kos, is_published) VALUES
(1, 'Kos Griya Soekarno Hatta', 'pria',     'Jl. Soekarno Hatta Gg. 3 No. 12', 'Lowokwaru', 'Malang', -7.946700, 112.615100, 0.80, 'Kos pria dekat Polinema, akses jalan kaki.', 'Tamu lawan jenis dilarang masuk kamar.', TRUE),
(1, 'Kos Melati Kembar',        'wanita',   'Jl. Kembang Turi No. 5',          'Lowokwaru', 'Malang', -7.944200, 112.618900, 1.20, 'Kos putri tenang, lingkungan perumahan.', 'Jam malam 22.00.', TRUE),
(2, 'Kos Sigura-gura Residence','campuran', 'Jl. Sigura-gura No. 30',          'Lowokwaru', 'Malang', -7.955300, 112.611400, 2.50, 'Kos campuran lantai terpisah.', 'Lantai 1 pria, lantai 2 wanita.', FALSE);

INSERT INTO foto_kos (kos_id, url_foto, kategori, is_utama) VALUES
(1, '/uploads/kos/1-depan.jpg', 'Depan', TRUE),
(1, '/uploads/kos/1-dapur.jpg', 'Dapur', FALSE),
(2, '/uploads/kos/2-depan.jpg', 'Depan', TRUE),
(3, '/uploads/kos/3-depan.jpg', 'Depan', TRUE);

-- Fasilitas bersama (id 11-15)
INSERT INTO fasilitas_kos (kos_id, fasilitas_id) VALUES
(1, 11), (1, 12), (1, 14), (1, 15),
(2, 11), (2, 12), (2, 13), (2, 15),
(3, 12), (3, 13);

INSERT INTO kamar (kos_id, nomor_kamar, tipe_kamar, harga_per_bulan, deposit_kunci, is_published) VALUES
(1, 'A1', 'Standar', 650000,  100000, TRUE),
(1, 'A2', 'Standar', 650000,  100000, TRUE),
(1, 'B1', 'AC + KM Dalam', 1100000, 200000, TRUE),
(2, '101', 'Standar', 750000,  100000, TRUE),
(2, '102', 'AC + KM Dalam', 1250000, 200000, TRUE),
(2, '103', 'AC + KM Dalam', 1250000, 200000, FALSE),
(3, '1A', 'Standar', 600000,  0, TRUE);

INSERT INTO detail_kamar (kamar_id, panjang_m, lebar_m, kapasitas, lantai, tipe_kasur, listrik, ventilasi, kamar_mandi, deskripsi_suasana) VALUES
(1, 3, 3, 1, 1, 'Single 90x200', 'Include',       'Jendela Luar', 'Luar',  'Dekat ruang jemur.'),
(2, 3, 3, 1, 1, 'Single 90x200', 'Include',       'Jendela Luar', 'Luar',  NULL),
(3, 3, 4, 1, 2, 'Queen 160x200', 'Token Sendiri', 'Jendela Luar', 'Dalam', 'Pemandangan jalan, terang.'),
(4, 3, 3, 1, 1, 'Single 90x200', 'Include',       'Exhaust',      'Luar',  NULL),
(5, 3, 4, 2, 2, 'Queen 160x200', 'Token Sendiri', 'Jendela Luar', 'Dalam', NULL),
(6, 3, 4, 2, 2, 'Queen 160x200', 'Token Sendiri', 'Jendela Luar', 'Dalam', NULL),
(7, 2.5, 3, 1, 1, 'Single 90x200', 'Include',     'Exhaust',      'Luar',  NULL);

INSERT INTO foto_kamar (kamar_id, url_foto, urutan) VALUES
(1, '/uploads/kamar/1-a.jpg', 0),
(3, '/uploads/kamar/3-a.jpg', 0),
(3, '/uploads/kamar/3-b.jpg', 1),
(5, '/uploads/kamar/5-a.jpg', 0);

INSERT INTO fasilitas_kamar (kamar_id, fasilitas_id) VALUES
(1, 1), (1, 3), (1, 4), (1, 5),
(2, 1), (2, 3), (2, 4), (2, 5),
(3, 1), (3, 2), (3, 3), (3, 4), (3, 5), (3, 6), (3, 8), (3, 9), (3, 10),
(4, 1), (4, 4), (4, 5),
(5, 1), (5, 2), (5, 3), (5, 4), (5, 5), (5, 7), (5, 8), (5, 9),
(6, 1), (6, 2), (6, 3), (6, 4), (6, 5), (6, 8), (6, 9),
(7, 1), (7, 4);

INSERT INTO inventaris_kamar (kamar_id, nama_barang, jumlah, kondisi, catatan) VALUES
(1, 'Kasur single',     1, 'Baik', NULL),
(1, 'Lemari 2 pintu',   1, 'Baik', NULL),
(1, 'Meja belajar',     1, 'Rusak Ringan', 'Laci macet'),
(3, 'AC 1/2 PK',        1, 'Baik', 'Servis terakhir Agustus 2026'),
(3, 'Kasur queen',      1, 'Baik', NULL),
(3, 'Kursi busa',       1, 'Baik', NULL),
(5, 'AC 1/2 PK',        1, 'Rusak Ringan', 'Kurang dingin'),
(5, 'Smart TV 32 inch', 1, 'Baik', NULL);

-- Reservasi: 1 sudah selesai (bisa diulas), 1 disetujui (kamar Terisi), 1 pending (kamar Dipesan)
INSERT INTO reservasi (pengguna_id, kamar_id, kode_reservasi, tanggal_masuk, durasi_sewa_bulan, total_biaya, status_reservasi) VALUES
(3, 1, 'KSN-2026-0001', '2026-01-05', 6, 3900000, 'Disetujui'),
(4, 5, 'KSN-2026-0002', CURRENT_DATE + 7, 12, 15000000, 'Disetujui'),
(5, 3, 'KSN-2026-0003', CURRENT_DATE + 14, 6, 6600000, 'Pending');
UPDATE reservasi SET status_reservasi = 'Selesai' WHERE kode_reservasi = 'KSN-2026-0001';

INSERT INTO ulasan (reservasi_id, rating, komentar) VALUES
(1, 4, 'Dekat kampus, pemilik responsif. Air kadang kecil pagi hari.');

INSERT INTO favorit (pengguna_id, kos_id) VALUES
(3, 2), (5, 1), (5, 2);
