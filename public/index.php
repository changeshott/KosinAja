<?php
// Web root untuk server nginx + PHP-FPM (EthioDeploy memakai folder public/ sebagai web root).
// Semua permintaan diteruskan ke router.php di root project, yang meniru aturan .htaccess.
require dirname(__DIR__) . '/router.php';
