<?php

class Request
{
    private static ?array $body = null;

    public static function method(): string
    {
        return $_SERVER['REQUEST_METHOD'] ?? 'GET';
    }

    /** Body JSON (fetch dengan Content-Type: application/json) atau form biasa / multipart. */
    public static function body(): array
    {
        if (self::$body === null) {
            $type = $_SERVER['CONTENT_TYPE'] ?? '';
            if (str_contains($type, 'application/json')) {
                $data = json_decode(file_get_contents('php://input'), true);
                if (!is_array($data)) {
                    Response::error('Body JSON tidak valid');
                }
                self::$body = $data;
            } elseif (self::method() === 'POST') {
                self::$body = $_POST;
            } else {
                // PUT/PATCH dengan x-www-form-urlencoded tidak diisi PHP ke $_POST
                parse_str(file_get_contents('php://input'), $data);
                self::$body = $data;
            }
        }
        return self::$body;
    }

    public static function input(string $key, $default = null)
    {
        return self::body()[$key] ?? $default;
    }

    public static function query(string $key, $default = null)
    {
        $v = $_GET[$key] ?? null;
        return ($v === null || $v === '') ? $default : $v;
    }

    /** Ambil query param sebagai integer positif, atau null. */
    public static function queryInt(string $key): ?int
    {
        $v = self::query($key);
        if ($v === null) {
            return null;
        }
        if (!ctype_digit((string) $v) || (int) $v < 1) {
            Response::error("Parameter '$key' harus angka positif");
        }
        return (int) $v;
    }

    /** Query param wajib berupa id. */
    public static function requireId(string $key = 'id'): int
    {
        $id = self::queryInt($key);
        if ($id === null) {
            Response::error("Parameter '$key' wajib diisi");
        }
        return $id;
    }
}
