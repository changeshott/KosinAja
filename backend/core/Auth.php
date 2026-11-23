<?php
// Login berbasis session PHP. Frontend dan backend satu origin, jadi cookie PHPSESSID ikut terkirim otomatis oleh fetch().
//   role 'admin'       = pemilik kos / mitra (panel pengelola)
//   role 'super_admin' = administrator platform
//   role 'penyewa'     = mahasiswa pencari kos
//
// SESI DIPISAH PER TAB BROWSER.
// Cookie PHPSESSID dipakai bersama semua tab (itu aturan browser, tidak bisa diubah),
// jadi pemisahan dilakukan di dalam session: $_SESSION['tab'] menyimpan satu kotak
// per tab, dan di dalam tiap kotak ada satu slot per peran.
//
// Kunci tab dikirim halaman lewat header X-Tab, diambil dari sessionStorage yang
// memang hidup per tab (lihat idTab() di api.js). Tab baru = sessionStorage kosong
// = kunci baru = kotak kosong = belum login, walaupun cookie-nya sama.
//
// Efeknya: tab 1 login penyewa, lalu buka tab baru -> tab baru minta login lagi.
// Dua peran berbeda di dua tab (super admin & pemilik) juga tidak saling melempar keluar.
class Auth
{
    public const PERAN = ['penyewa', 'admin', 'super_admin'];

    /** Batas kotak tab yang disimpan; yang paling lama tidak dipakai dibuang. */
    private const MAKS_TAB = 12;

    private static function mulaiSession(): void
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_set_cookie_params(['httponly' => true, 'samesite' => 'Lax']);
            session_start();
        }
        // Sesi gaya lama (satu pengguna untuk semua tab) tidak dipakai lagi: buang saja.
        unset($_SESSION['pengguna'], $_SESSION['sesi']);
    }

    /** Kunci tab pemanggil. Tanpa header X-Tab semua request masuk satu kotak bersama. */
    private static function idTab(): string
    {
        $t = $_SERVER['HTTP_X_TAB'] ?? '';
        return (is_string($t) && preg_match('/^[A-Za-z0-9]{8,64}$/', $t)) ? $t : '-';
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

    /** Data pengguna yang login di tab ini pada satu peran, atau null. */
    public static function user(?string $peran = null): ?array
    {
        self::mulaiSession();
        $tab = self::idTab();
        if (isset($_SESSION['tab'][$tab])) {
            self::sentuh($tab); // tab yang masih dipakai tidak ikut terbuang saat rapikan()
        }
        return $_SESSION['tab'][$tab]['peran'][$peran ?? self::peranDiminta()] ?? null;
    }

    /** Login hanya untuk tab ini; tab lain (dan peran lain) tidak tersentuh. */
    public static function masuk(array $p): void
    {
        self::mulaiSession();
        session_regenerate_id(true); // cegah session fixation; isi $_SESSION tetap terbawa
        $tab = self::idTab();
        self::sentuh($tab);
        $_SESSION['tab'][$tab]['peran'][$p['role']] = ['id' => (int) $p['id']]
            + array_intersect_key($p, array_flip(['nama_lengkap', 'email', 'no_telepon', 'role']));
        self::rapikan();
    }

    /** Keluar dari satu peran di tab ini saja. */
    public static function keluar(?string $peran = null): void
    {
        self::mulaiSession();
        $tab = self::idTab();
        unset($_SESSION['tab'][$tab]['peran'][$peran ?? self::peranDiminta()]);
        if (empty($_SESSION['tab'][$tab]['peran'])) {
            unset($_SESSION['tab'][$tab]);
        }
        if (empty($_SESSION['tab'])) {
            $_SESSION = [];
            session_destroy();
        }
    }

    /**
     * Tandai kotak tab sebagai yang paling baru dipakai. Memakai penghitung yang selalu
     * naik, bukan time(), karena time() hanya beresolusi detik: beberapa tab yang aktif
     * dalam detik yang sama akan seri dan urutannya jadi acak saat rapikan().
     */
    private static function sentuh(string $tab): void
    {
        $_SESSION['tab'][$tab]['urut'] = ++$_SESSION['urut'];
    }

    /** Buang kotak tab yang paling lama tidak dipakai, supaya session tidak menumpuk. */
    private static function rapikan(): void
    {
        if (count($_SESSION['tab'] ?? []) <= self::MAKS_TAB) {
            return;
        }
        uasort($_SESSION['tab'], fn($a, $b) => ($b['urut'] ?? 0) <=> ($a['urut'] ?? 0));
        $_SESSION['tab'] = array_slice($_SESSION['tab'], 0, self::MAKS_TAB, true);
    }

    /** Wajib login sebagai pemilik kos. Dipakai semua endpoint panel pengelola. */
    public static function adminId(): int
    {
        $id = self::wajib('admin', 'Silakan masuk sebagai pemilik kos terlebih dahulu', 'Halaman ini khusus pemilik kos');
        $status = DB::satu('SELECT status_verifikasi, akun_aktif FROM pengguna WHERE id = :id', ['id' => $id]);
        if (!$status || !filter_var($status['akun_aktif'], FILTER_VALIDATE_BOOLEAN) || $status['status_verifikasi'] !== 'disetujui') {
            self::keluar('admin'); // tab & peran lain tidak ikut terlempar keluar
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
