<?php
// Login berbasis session PHP. Frontend dan backend satu origin, jadi cookie PHPSESSID ikut terkirim otomatis oleh fetch().
//   role 'admin'   = pemilik kos / mitra (panel pengelola)
//   role 'penyewa' = mahasiswa pencari kos
class Auth
{
    /** Data pengguna yang sedang login, atau null. */
    public static function user(): ?array
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_set_cookie_params(['httponly' => true, 'samesite' => 'Lax']);
            session_start();
        }
        return $_SESSION['pengguna'] ?? null;
    }

    public static function masuk(array $p): void
    {
        self::user();
        session_regenerate_id(true); // cegah session fixation
        $_SESSION['pengguna'] = ['id' => (int) $p['id']] + array_intersect_key($p, array_flip(['nama_lengkap', 'email', 'no_telepon', 'role']));
    }

    public static function keluar(): void
    {
        self::user();
        $_SESSION = [];
        session_destroy();
    }

    /** Wajib login sebagai pemilik kos. Dipakai semua endpoint panel pengelola. */
    public static function adminId(): int
    {
        return self::wajib('admin', 'Silakan masuk sebagai pemilik kos terlebih dahulu', 'Halaman ini khusus pemilik kos');
    }

    /** Wajib login sebagai penyewa (reservasi, favorit, ulasan). */
    public static function penyewaId(): int
    {
        return self::wajib('penyewa', 'Silakan masuk terlebih dahulu', 'Fitur ini khusus akun penyewa');
    }

    private static function wajib(string $role, string $belumMasuk, string $salahPeran): int
    {
        $u = self::user() ?? Response::error($belumMasuk, 401);
        return $u['role'] === $role ? $u['id'] : Response::error($salahPeran, 403);
    }
}
