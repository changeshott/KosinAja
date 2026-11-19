<?php
// Login berbasis session PHP. Frontend dan backend satu origin, jadi cookie PHPSESSID ikut terkirim otomatis oleh fetch().
//   role 'admin'   = pemilik kos / mitra (panel pengelola)
//   role 'super_admin' = administrator platform
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
        $id = self::wajib('admin', 'Silakan masuk sebagai pemilik kos terlebih dahulu', 'Halaman ini khusus pemilik kos');
        $status = DB::satu('SELECT status_verifikasi, akun_aktif FROM pengguna WHERE id = :id', ['id' => $id]);
        if (!$status || !filter_var($status['akun_aktif'], FILTER_VALIDATE_BOOLEAN) || $status['status_verifikasi'] !== 'disetujui') {
            self::keluar();
            Response::error('Akun pemilik belum aktif atau belum disetujui', 403);
        }
        return $id;
    }

    public static function superAdminId(): int
    {
        return self::wajib('super_admin', 'Silakan masuk sebagai administrator', 'Halaman ini khusus super admin');
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
