<?php
// Akses database: satu koneksi PDO per request + helper query singkat yang dipakai semua model.
//   DB::semua($sql, $p)  semua baris          DB::satu($sql, $p)   satu baris atau null
//   DB::nilai($sql, $p)  satu nilai            DB::kolom($sql, $p)  satu kolom sebagai array
//   DB::insert('kos', $data)                   baris hasil RETURNING (default kolom id)
//   DB::update('kos', $data, 'id = :id', ['id' => 1])
//   DB::transaksi(fn () => ...)                rollback otomatis kalau ada exception
// Nama kolom di insert/update berasal dari key aturan Validator (bukan input bebas), jadi aman dipakai di SQL.
class DB
{
    private static ?PDO $pdo = null;

    public static function pdo(): PDO
    {
        if (!self::$pdo) {
            $c = config('db');
            self::$pdo = new PDO("pgsql:host={$c['host']};port={$c['port']};dbname={$c['dbname']}", $c['user'], $c['password'], [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
        }
        return self::$pdo;
    }

    /** Jalankan query. int dikirim sebagai integer (LIMIT/OFFSET), bool sebagai 'true'/'false' untuk PostgreSQL. */
    public static function query(string $sql, array $p = []): PDOStatement
    {
        $stmt = self::pdo()->prepare($sql);
        foreach ($p as $k => $v) {
            if (is_bool($v)) {
                $v = $v ? 'true' : 'false';
            }
            $stmt->bindValue($k, $v, is_int($v) ? PDO::PARAM_INT : ($v === null ? PDO::PARAM_NULL : PDO::PARAM_STR));
        }
        $stmt->execute();
        return $stmt;
    }

    public static function semua(string $sql, array $p = []): array
    {
        return self::query($sql, $p)->fetchAll();
    }

    public static function satu(string $sql, array $p = []): ?array
    {
        return self::query($sql, $p)->fetch() ?: null;
    }

    public static function nilai(string $sql, array $p = []): mixed
    {
        return self::query($sql, $p)->fetchColumn();
    }

    public static function kolom(string $sql, array $p = []): array
    {
        return self::query($sql, $p)->fetchAll(PDO::FETCH_COLUMN);
    }

    public static function insert(string $tabel, array $data, string $kembali = 'id'): array
    {
        $kolom = array_keys($data);
        $sql = "INSERT INTO $tabel (" . implode(', ', $kolom) . ') VALUES (:' . implode(', :', $kolom) . ") RETURNING $kembali";
        return self::query($sql, $data)->fetch();
    }

    /** UPDATE kolom di $data (tidak melakukan apa-apa kalau kosong). Kembalikan jumlah baris yang berubah. */
    public static function update(string $tabel, array $data, string $where, array $p, bool $updatedAt = true): int
    {
        if (!$data) {
            return 0;
        }
        $set = implode(', ', array_map(fn($k) => "$k = :$k", array_keys($data)));
        $waktu = $updatedAt ? ', updated_at = CURRENT_TIMESTAMP' : '';
        return self::query("UPDATE $tabel SET $set$waktu WHERE $where", $data + $p)->rowCount();
    }

    public static function transaksi(callable $fn): mixed
    {
        self::pdo()->beginTransaction();
        try {
            $hasil = $fn();
            self::pdo()->commit();
            return $hasil;
        } catch (Throwable $e) {
            self::pdo()->rollBack();
            throw $e;
        }
    }
}
