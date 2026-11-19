-- ==========================================
-- KosinAja - Migrasi 006: Hapus jarak ke kampus
-- Input jarak_kampus_km dihapus dari kos.
-- View v_katalog_kamar diperbarui tanpa kolom s.jarak_kampus_km.
-- ==========================================

DROP VIEW IF EXISTS v_katalog_kamar;

ALTER TABLE kos DROP COLUMN IF EXISTS jarak_kampus_km CASCADE;

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
