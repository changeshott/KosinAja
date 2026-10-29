<?php

/** Ubah PDOException jadi [http_status, pesan untuk pengguna]. */
function terjemahkanErrorDb(PDOException $e): array
{
    $state = $e->errorInfo[0] ?? $e->getCode();
    $pesanDb = $e->errorInfo[2] ?? $e->getMessage();

    // Pesan constraint yang sering muncul, dipetakan ke bahasa pengguna
    $peta = [
        'excl_reservasi_bentrok'      => 'Kamar sudah dipesan orang lain pada periode tersebut',
        'unique_kamar_per_kos'        => 'Nomor kamar sudah dipakai di kos ini',
        'unique_barang_per_kamar'     => 'Barang dengan nama ini sudah tercatat di kamar tersebut',
        'pengguna_email_key'          => 'Email sudah terdaftar',
        'pengguna_nik_key'            => 'NIK sudah terdaftar',
        'ulasan_reservasi_id_key'     => 'Reservasi ini sudah pernah diulas',
        'uq_foto_utama_per_kos'       => 'Kos ini sudah punya foto utama',
        'chk_jadwal_survei'           => 'Jadwal survei wajib diisi',
        'chk_dp_tidak_melebihi_total' => 'DP tidak boleh melebihi total biaya',
        'fk_reservasi_kamar'          => 'Kamar masih punya riwayat reservasi, tidak bisa dihapus. Ubah ke Draft saja',
        'fk_kos_pemilik'              => 'Pengguna masih memiliki kos',
    ];
    foreach ($peta as $nama => $pesan) {
        if (str_contains($pesanDb, $nama)) {
            $status = in_array($state, ['23514', '22P02'], true) ? 422 : 409;
            return [$status, $pesan];
        }
    }

    return match ($state) {
        '23505' => [409, 'Data duplikat'],
        '23503' => [409, 'Data masih dipakai oleh data lain atau referensinya tidak ada'],
        '23514', '22P02', '22003' => [422, 'Nilai data tidak sesuai aturan'],
        '23P01' => [409, 'Data bentrok dengan data lain'],
        // RAISE EXCEPTION dari trigger: pesannya sudah ramah pengguna, tinggal dibersihkan
        'P0001' => [422, trim(preg_replace('/^ERROR:\s*|\s*CONTEXT:.*$/s', '', $pesanDb))],
        '08006', '08001', '7'   => [500, 'Tidak bisa terhubung ke database. Cek config/config.php'],
        default => [500, 'Kesalahan database'],
    };
}

/** Alamat situs ("http://localhost/KosinAja/"), untuk link di email. Bisa dikunci lewat config 'url_situs'. */
function urlSitus(): string
{
    if ($url = config('url_situs')) {
        return rtrim($url, '/') . '/';
    }
    $https = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    $path = preg_replace('#backend/api/[^/]*$#', '', $_SERVER['SCRIPT_NAME'] ?? '/');
    return ($https ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . $path;
}

/**
 * Belum ada server email (SMTP), jadi email ditulis ke backend/storage/email.log
 * supaya alur lupa kata sandi tetap bisa dicoba di localhost. Ganti isi fungsi ini dengan mail()/PHPMailer saat online.
 */
function kirimEmail(string $ke, string $subjek, string $isi): void
{
    $folder = BASE_PATH . '/storage';
    if (!is_dir($folder)) {
        mkdir($folder, 0775, true);
    }
    $teks = sprintf("==== %s\nKepada : %s\nSubjek : %s\n\n%s\n\n", date('Y-m-d H:i:s'), $ke, $subjek, $isi);
    file_put_contents("$folder/email.log", $teks, FILE_APPEND | LOCK_EX);
}

/** Nomor lokal (08xx) -> link wa.me (628xx). Dipakai tombol "Chat WA". */
function linkWhatsApp(?string $noTelepon): ?string
{
    if (!$noTelepon) {
        return null;
    }
    $angka = preg_replace('/\D/', '', $noTelepon);
    if (str_starts_with($angka, '0')) {
        $angka = '62' . substr($angka, 1);
    }
    return 'https://wa.me/' . $angka;
}

/** Inisial nama untuk avatar ("Ahmad Fauzi" -> "AF"). */
function inisial(string $nama): string
{
    $kata = preg_split('/\s+/', trim($nama));
    $hasil = mb_substr($kata[0], 0, 1);
    if (count($kata) > 1) {
        $hasil .= mb_substr(end($kata), 0, 1);
    }
    return mb_strtoupper($hasil);
}

/** Ubah kolom numeric PostgreSQL (dikirim PDO sebagai string) jadi angka. */
function angka(array $row, array $kolom): array
{
    foreach ($kolom as $k) {
        if (isset($row[$k]) && is_numeric($row[$k])) {
            $row[$k] = $row[$k] + 0;
        }
    }
    return $row;
}

/** ?page=&per_page= -> [halaman, jumlah per halaman] dengan batas maksimal. */
function halaman(int $default, int $maks): array
{
    return [Request::queryInt('page') ?? 1, min(Request::queryInt('per_page') ?? $default, $maks)];
}

/** Ubah array PHP jadi literal array PostgreSQL untuk dipakai dengan = ANY(:ids). */
function pgIntArray(array $ids): string
{
    return '{' . implode(',', array_map('intval', $ids)) . '}';
}

/** Label durasi: 12 -> "1 Tahun", 6 -> "6 Bulan", 18 -> "1 Tahun 6 Bulan". */
function labelDurasi(int $bulan): string
{
    $th = intdiv($bulan, 12);
    $bl = $bulan % 12;
    $bagian = [];
    if ($th) $bagian[] = "$th Tahun";
    if ($bl) $bagian[] = "$bl Bulan";
    return implode(' ', $bagian);
}
