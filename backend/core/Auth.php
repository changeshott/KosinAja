<?php
// Login berbasis session PHP. Frontend dan backend satu origin, jadi cookie PHPSESSID ikut terkirim otomatis oleh fetch().
//   role 'admin'       = pemilik kos / mitra (panel pengelola)
//   role 'super_admin' = administrator platform
//   role 'penyewa'     = mahasiswa pencari kos
//
// Satu browser boleh login sebagai beberapa peran sekaligus (mis. tab 1 super admin,
// tab 2 pemilik kos, tab 3 penyewa). Caranya: $_SESSION['sesi'] menyimpan satu slot
// per peran, bukan satu pengguna tunggal. Endpoint khusus peran (adminId/superAdminId/
// penyewaId) membaca slotnya sendiri, sedangkan endpoint umum (/api/auth) memakai
// peran yang dikirim halaman lewat header X-Peran (lihat peranHalaman() di api.js).
class Auth
{
    public const PERAN = ['penyewa', 'admin', 'super_admin'];

    private static function mulaiSession(): void
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_set_cookie_params(['httponly' => true, 'samesite' => 'Lax']);
            session_start();
        }
        // Sesi lama (sebelum dukungan multi-peran) dipindah ke slot peran-nya sekali jalan.
        if (isset($_SESSION['pengguna'])) {
            $lama = $_SESSION['pengguna'];
            unset($_SESSION['pengguna']);
            if (in_array($lama['role'] ?? '', self::PERAN, true)) {
                $_SESSION['sesi'][$lama['role']] = $lama;
            }
        }
    }

    /**
     * Peran yang sedang dipakai halaman pemanggil. Header X-Peran dikirim api.js;
     * ?sebagai= jadi cadangan kalau request dibuat tanpa helper itu.
     */
    public static function peranDiminta(): string
    {
        foreach ([$_SERVER['HTTP_X_PERAN'] ?? '', $_GET['sebagai'] ?? ''] as $kandidat) {
            if (in_array($kandidat, self::PERAN, true)) {
                return $kandidat;
            }
        }
        return 'penyewa';
    }

    /** Data pengguna yang login pada satu peran, atau null. */
    public static function user(?string $peran = null): ?array
    {
        self::mulaiSession();
        return $_SESSION['sesi'][$peran ?? self::peranDiminta()] ?? null;
    }

    /** Login satu peran tanpa mengganggu peran lain yang sedang aktif di tab sebelah. */
    public static function masuk(array $p): void
    {
        self::mulaiSession();
        session_regenerate_id(true); // cegah session fixation; isi $_SESSION tetap terbawa
        $_SESSION['sesi'][$p['role']] = ['id' => (int) $p['id']]
            + array_intersect_key($p, array_flip(['nama_lengkap', 'email', 'no_telepon', 'role']));
    }

    /** Keluar dari satu peran saja. Session baru dihapus kalau tidak ada peran tersisa. */
    public static function keluar(?string $peran = null): void
    {
        self::mulaiSession();
        unset($_SESSION['sesi'][$peran ?? self::peranDiminta()]);
        if (empty($_SESSION['sesi'])) {
            $_SESSION = [];
            session_destroy();
        }
    }

    /** Wajib login sebagai pemilik kos. Dipakai semua endpoint panel pengelola. */
    public static function adminId(): int
    {
        $id = self::wajib('admin', 'Silakan masuk sebagai pemilik kos terlebih dahulu', 'Halaman ini khusus pemilik kos');
        $status = DB::satu('SELECT status_verifikasi, akun_aktif FROM pengguna WHERE id = :id', ['id' => $id]);
        if (!$status || !filter_var($status['akun_aktif'], FILTER_VALIDATE_BOOLEAN) || $status['status_verifikasi'] !== 'disetujui') {
            self::keluar('admin'); // peran lain di browser yang sama tidak ikut terlempar keluar
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
        $u = self::user($role) ?? Response::error($belumMasuk, 401);
        return $u['role'] === $role ? $u['id'] : Response::error($salahPeran, 403);
    }
}
