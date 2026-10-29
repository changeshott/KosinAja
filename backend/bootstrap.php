<?php
// Di-require oleh setiap file di folder api/. Menyiapkan config, autoload, header JSON, dan penanganan error.

declare(strict_types=1);

define('BASE_PATH', __DIR__);

if (!file_exists(BASE_PATH . '/config/config.php')) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'config/config.php belum ada. Salin dari config.example.php']);
    exit;
}

$GLOBALS['__config'] = require BASE_PATH . '/config/config.php';

function config(string $key)
{
    return $GLOBALS['__config'][$key] ?? null;
}

spl_autoload_register(function (string $class) {
    foreach (['core', 'models'] as $dir) {
        $file = BASE_PATH . "/$dir/$class.php";
        if (file_exists($file)) {
            require $file;
            return;
        }
    }
});

require BASE_PATH . '/core/helpers.php';

header('Content-Type: application/json; charset=utf-8');

// Semua exception yang lolos diubah jadi JSON. Error dari constraint/trigger PostgreSQL
// diterjemahkan ke pesan yang bisa langsung ditampilkan ke pengguna.
set_exception_handler(function (Throwable $e) {
    if ($e instanceof PDOException) {
        [$status, $pesan] = terjemahkanErrorDb($e);
        $body = ['success' => false, 'message' => $pesan];
        if (config('debug')) {
            $body['debug'] = $e->getMessage();
        }
        http_response_code($status);
        echo json_encode($body, JSON_UNESCAPED_UNICODE);
        return;
    }
    // DomainException = aturan bisnis dilanggar (dilempar dari model), pesannya aman ditampilkan
    if ($e instanceof DomainException) {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
        return;
    }
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Terjadi kesalahan di server',
        'debug'   => config('debug') ? $e->getMessage() . ' @ ' . basename($e->getFile()) . ':' . $e->getLine() : null,
    ], JSON_UNESCAPED_UNICODE);
});
