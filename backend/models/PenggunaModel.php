<?php
// Akun pengguna: daftar, profil, ganti / lupa kata sandi.
class PenggunaModel
{
    public const RULES_DAFTAR = [
        'nama_lengkap' => 'required|string|max:150',
        'email'        => 'required|string|max:100',
        'no_telepon'   => 'required|string|max:20',
        'password'     => 'required|string|max:72',
        'nik'          => 'string|max:16',
    ];

    public const RULES_SANDI = [
        'password_lama' => 'required|string|max:72',
        'password_baru' => 'required|string|max:72',
    ];

    private const KOLOM_SESI = 'id, nama_lengkap, email, no_telepon, role';

    public static function cariEmail(string $email): ?array
    {
        return DB::satu('SELECT * FROM pengguna WHERE LOWER(email) = LOWER(:email)', ['email' => $email]);
    }

    /** "0812-3456-7890" -> "081234567890"; galat ditambahkan ke $errors kalau formatnya salah. */
    private static function rapikanTelepon(string $no, array &$errors): string
    {
        $telp = preg_replace('/[^0-9+]/', '', $no);
        if (!preg_match('/^(\+62|62|0)8[0-9]{7,12}$/', $telp)) {
            $errors['no_telepon'] = 'Nomor WhatsApp tidak valid (contoh 081234567890)';
        }
        return $telp;
    }

    /** Validasi tambahan yang tidak tercakup Validator, lalu simpan dengan password_hash(). */
    public static function daftar(array $data, string $role): array
    {
        $errors = [];
        if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
            $errors['email'] = 'Format email tidak valid';
        }
        if (mb_strlen($data['password']) < 8) {
            $errors['password'] = 'Minimal 8 karakter';
        }
        $telp = self::rapikanTelepon($data['no_telepon'], $errors);
        // Pemilik wajib NIK (constraint chk_admin_wajib_nik di database)
        if ($role === 'admin' && !preg_match('/^[0-9]{16}$/', (string) ($data['nik'] ?? ''))) {
            $errors['nik'] = 'NIK wajib 16 digit angka';
        }
        if ($errors) {
            Response::invalid($errors);
        }
        return DB::satu('
            INSERT INTO pengguna (nama_lengkap, email, password, no_telepon, nik, role)
            VALUES (:nama, LOWER(:email), :password, :telp, :nik, :role::role_pengguna)
            RETURNING ' . self::KOLOM_SESI, [
            'nama'     => $data['nama_lengkap'],
            'email'    => $data['email'],
            'password' => password_hash($data['password'], PASSWORD_DEFAULT),
            'telp'     => $telp,
            'nik'      => $role === 'admin' ? $data['nik'] : null,
            'role'     => $role,
        ]);
    }

    /** Ubah nama & nomor WhatsApp sendiri (onboarding & halaman Profil). Email dan NIK tidak bisa diubah. */
    public static function ubahProfil(int $id, array $data): array
    {
        $errors = [];
        $telp = self::rapikanTelepon($data['no_telepon'], $errors);
        if ($errors) {
            Response::invalid($errors);
        }
        return DB::satu('
            UPDATE pengguna SET nama_lengkap = :nama, no_telepon = :telp, updated_at = CURRENT_TIMESTAMP
             WHERE id = :id RETURNING ' . self::KOLOM_SESI, ['nama' => $data['nama_lengkap'], 'telp' => $telp, 'id' => $id]);
    }

    /** Ganti kata sandi sendiri (halaman Profil). Wajib tahu kata sandi lama. */
    public static function gantiPassword(int $id, string $lama, string $baru): void
    {
        if (!password_verify($lama, (string) DB::nilai('SELECT password FROM pengguna WHERE id = :id', ['id' => $id]))) {
            Response::invalid(['password_lama' => 'Kata sandi lama salah']);
        }
        self::cekSandiBaru($baru, 'password_baru');
        self::simpanPassword($id, $baru);
    }

    /**
     * Lupa kata sandi: token acak sekali pakai, berlaku 30 menit. Token asli hanya dikirim lewat email,
     * yang disimpan di database hanya hash-nya. Satu pengguna satu token aktif (token lama tertimpa).
     */
    public static function buatTokenReset(int $id): string
    {
        $token = bin2hex(random_bytes(32));
        DB::query("
            INSERT INTO reset_password (pengguna_id, token_hash, kedaluwarsa)
            VALUES (:id, :hash, CURRENT_TIMESTAMP + INTERVAL '30 minutes')
            ON CONFLICT (pengguna_id) DO UPDATE
               SET token_hash = EXCLUDED.token_hash, kedaluwarsa = EXCLUDED.kedaluwarsa, created_at = CURRENT_TIMESTAMP",
            ['id' => $id, 'hash' => hash('sha256', $token)]);
        return $token;
    }

    /** Pakai token dari email untuk membuat kata sandi baru. Token langsung dihapus supaya tidak bisa dipakai ulang. */
    public static function resetPassword(string $token, string $baru): void
    {
        self::cekSandiBaru($baru, 'password');
        DB::transaksi(function () use ($token, $baru) {
            $id = DB::nilai('DELETE FROM reset_password WHERE token_hash = :hash AND kedaluwarsa > CURRENT_TIMESTAMP RETURNING pengguna_id',
                ['hash' => hash('sha256', $token)]);
            if (!$id) {
                throw new DomainException('Tautan reset tidak valid atau sudah kedaluwarsa. Minta tautan baru.');
            }
            self::simpanPassword((int) $id, $baru);
        });
    }

    /** NIK disamarkan untuk ditampilkan kembali: 3573********0002. */
    public static function nikSamar(int $id): ?string
    {
        $nik = DB::nilai('SELECT nik FROM pengguna WHERE id = :id', ['id' => $id]);
        return $nik ? substr($nik, 0, 4) . str_repeat('*', 8) . substr($nik, -4) : null;
    }

    private static function cekSandiBaru(string $sandi, string $field): void
    {
        if (mb_strlen($sandi) < 8) {
            Response::invalid([$field => 'Minimal 8 karakter']);
        }
    }

    private static function simpanPassword(int $id, string $sandi): void
    {
        DB::update('pengguna', ['password' => password_hash($sandi, PASSWORD_DEFAULT)], 'id = :id', ['id' => $id]);
    }
}
