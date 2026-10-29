<?php
// Barang fisik di kamar (jumlah + kondisi). Fasilitas = yang diiklankan, inventaris = yang dicatat pemilik.
class InventarisModel
{
    public const RULES = [
        'nama_barang' => 'required|string|max:100',
        'jumlah'      => 'int|min:0',
        'kondisi'     => 'in:Baik,Rusak Ringan,Rusak Berat,Hilang',
        'catatan'     => 'string',
    ];

    public static function listByKamar(int $kamarId): array
    {
        return DB::semua('
            SELECT id, nama_barang, jumlah, kondisi, catatan, updated_at
              FROM inventaris_kamar WHERE kamar_id = :id ORDER BY nama_barang', ['id' => $kamarId]);
    }

    /** Ambil barang + pastikan kamarnya milik pemilik ini. */
    public static function pastikanMilik(int $id, int $adminId): array
    {
        return DB::satu('
            SELECT i.* FROM inventaris_kamar i
              JOIN kamar k ON k.id = i.kamar_id
              JOIN kos s ON s.id = k.kos_id
             WHERE i.id = :id AND s.pengguna_id = :admin', ['id' => $id, 'admin' => $adminId])
            ?? Response::notFound('Data inventaris tidak ditemukan');
    }

    public static function create(int $kamarId, array $data): int
    {
        return DB::insert('inventaris_kamar', $data + ['kamar_id' => $kamarId])['id'];
    }

    public static function update(int $id, array $data): void
    {
        DB::update('inventaris_kamar', $data, 'id = :id', ['id' => $id]);
    }

    public static function delete(int $id): void
    {
        DB::query('DELETE FROM inventaris_kamar WHERE id = :id', ['id' => $id]);
    }
}
