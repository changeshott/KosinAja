-- Fitur inventaris kamar sudah diganti dengan pengelolaan status kamar.
-- Penghapusan tabel ini menghapus catatan inventaris lama.
DROP TABLE IF EXISTS inventaris_kamar;
DROP TYPE IF EXISTS kondisi_inventaris_enum;
