-- Buat akun Super Admin KosinAja.
-- Jalankan pada database kosinaja. Skema saat ini sudah mendukung role super_admin.

INSERT INTO pengguna (nama_lengkap, email, password, no_telepon, role)
VALUES (
    'Administrator KosinAja',
    'admin@kosinaja.id',
    '$2y$10$3enJM8j.RuGXuAQ8lnBYLu4n2xCZ9iCRxWKz3tlglm1SeuYtDNUJm',
    '081234567890',
    'super_admin'
);
