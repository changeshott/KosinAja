<?php
// Master fasilitas (lingkup 'kamar' atau 'bersama'), dipakai checkbox di form kamar/kos dan filter katalog.
class FasilitasModel
{
    /** Dikelompokkan per kategori: [{kategori, items: [...]}, ...]. */
    public static function list(?string $lingkup): array
    {
        $baris = $lingkup
            ? DB::semua('SELECT id, nama_fasilitas, kategori, lingkup, ikon FROM fasilitas WHERE lingkup = :l::lingkup_fasilitas_enum ORDER BY id', ['l' => $lingkup])
            : DB::semua('SELECT id, nama_fasilitas, kategori, lingkup, ikon FROM fasilitas ORDER BY id');
        $grup = [];
        foreach ($baris as $f) {
            $grup[$f['kategori']][] = $f;
        }
        return array_map(fn($kategori, $items) => ['kategori' => $kategori, 'items' => $items], array_keys($grup), $grup);
    }

    /** Fasilitas isian manual. Kalau namanya sudah ada (tanpa beda huruf besar/kecil), pakai yang lama. */
    public static function ambilAtauBuat(array $data): array
    {
        $ada = DB::satu('SELECT id, nama_fasilitas, kategori, lingkup FROM fasilitas WHERE LOWER(nama_fasilitas) = LOWER(:n)', ['n' => $data['nama_fasilitas']]);
        if ($ada && $ada['lingkup'] !== $data['lingkup']) {
            throw new DomainException("\"{$ada['nama_fasilitas']}\" sudah terdaftar sebagai fasilitas {$ada['lingkup']}");
        }
        return $ada ?? DB::insert('fasilitas', $data, 'id, nama_fasilitas, kategori, lingkup');
    }
}
