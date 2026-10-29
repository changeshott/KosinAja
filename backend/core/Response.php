<?php
// Format response seragam supaya JS di frontend cukup cek `success`.
//   sukses: { "success": true,  "message": "...", "data": ... }
//   gagal : { "success": false, "message": "...", "errors": {...} }
class Response
{
    public static function json(int $status, array $body): never
    {
        http_response_code($status);
        echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function ok($data = null, string $message = 'OK', int $status = 200): never
    {
        self::json($status, ['success' => true, 'message' => $message, 'data' => $data]);
    }

    public static function created($data = null, string $message = 'Data berhasil dibuat'): never
    {
        self::ok($data, $message, 201);
    }

    public static function error(string $message, int $status = 400, array $errors = []): never
    {
        self::json($status, ['success' => false, 'message' => $message] + ($errors ? ['errors' => $errors] : []));
    }

    /** 422 dengan pesan per kolom form, misal Response::invalid(['email' => 'Wajib diisi']). */
    public static function invalid(array $errors): never
    {
        self::error('Data tidak valid', 422, $errors);
    }

    public static function notFound(string $message = 'Data tidak ditemukan'): never
    {
        self::error($message, 404);
    }

    public static function methodNotAllowed(): never
    {
        self::error('Method tidak didukung', 405);
    }
}
