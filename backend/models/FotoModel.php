<?php
// Upload foto kos (galeri gedung) dan foto kamar. File disimpan di backend/uploads/, path disimpan di DB.
class FotoModel
{
    /** Validasi & pindahkan file upload, kembalikan path relatif (misal 'uploads/kamar/abc.jpg'). */
    public static function simpanFile(array $file, string $folder): string
    {
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            Response::invalid(['foto' => 'File gagal diunggah atau tidak dipilih']);
        }
        $cfg = config('upload');
        if ($file['size'] > $cfg['max_bytes']) {
            Response::invalid(['foto' => 'Ukuran maksimal ' . ($cfg['max_bytes'] / 1048576) . ' MB']);
        }
        // Cek isi file, bukan ekstensi/MIME kiriman browser yang bisa dipalsukan
        $ext = $cfg['mime'][(new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name'])] ?? Response::invalid(['foto' => 'Format harus JPG, PNG, atau WEBP']);
        $relatif = "uploads/$folder/" . bin2hex(random_bytes(8)) . ".$ext";
        if (!move_uploaded_file($file['tmp_name'], BASE_PATH . '/' . $relatif)) {
            throw new RuntimeException('Gagal menyimpan file ke ' . $relatif);
        }
        return $relatif;
    }

    /** Hapus file dari disk, hanya kalau path-nya memang di dalam folder uploads. */
    public static function hapusFile(string $relatif): void
    {
        $path = realpath(BASE_PATH . '/' . $relatif);
        if ($path && str_starts_with($path, realpath(BASE_PATH . '/uploads')) && is_file($path)) {
            unlink($path);
        }
    }

    public static function tambahFotoKos(int $kosId, string $url, ?string $kategori, bool $utama): array
    {
        return DB::transaksi(function () use ($kosId, $url, $kategori, $utama) {
            if ($utama) {
                // Hanya boleh satu foto utama per kos (unique index uq_foto_utama_per_kos)
                DB::query('UPDATE foto_kos SET is_utama = FALSE WHERE kos_id = :id', ['id' => $kosId]);
            }
            return DB::insert('foto_kos', ['kos_id' => $kosId, 'url_foto' => $url, 'kategori' => $kategori, 'is_utama' => $utama],
                'id, url_foto, kategori, is_utama');
        });
    }

    public static function tambahFotoKamar(int $kamarId, string $url): array
    {
        return DB::satu('
            INSERT INTO foto_kamar (kamar_id, url_foto, urutan)
            VALUES (:kamar, :url, (SELECT COALESCE(MAX(urutan) + 1, 0) FROM foto_kamar WHERE kamar_id = :kamar2))
            RETURNING id, url_foto, urutan', ['kamar' => $kamarId, 'url' => $url, 'kamar2' => $kamarId]);
    }

    /** Hapus foto (kos/kamar) milik pemilik; kembalikan url untuk dihapus dari disk. */
    public static function hapus(string $jenis, int $fotoId, int $adminId): string
    {
        $url = DB::nilai($jenis === 'kos'
            ? 'DELETE FROM foto_kos f USING kos s
                WHERE f.id = :id AND s.id = f.kos_id AND s.pengguna_id = :admin RETURNING f.url_foto'
            : 'DELETE FROM foto_kamar f USING kamar k, kos s
                WHERE f.id = :id AND k.id = f.kamar_id AND s.id = k.kos_id AND s.pengguna_id = :admin RETURNING f.url_foto',
            ['id' => $fotoId, 'admin' => $adminId]);
        return $url !== false ? $url : Response::notFound('Foto tidak ditemukan');
    }
}
