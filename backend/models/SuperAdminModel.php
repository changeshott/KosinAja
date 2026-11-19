<?php
class SuperAdminModel
{
    public static function ringkasan(): array
    {
        return DB::satu("SELECT
            COUNT(*) FILTER (WHERE role = 'admin' AND status_verifikasi = 'menunggu') AS menunggu,
            COUNT(*) FILTER (WHERE role = 'admin' AND status_verifikasi = 'disetujui' AND akun_aktif) AS aktif,
            COUNT(*) FILTER (WHERE role = 'admin' AND status_verifikasi = 'ditolak' AND diverifikasi_at >= date_trunc('month', CURRENT_DATE)) AS ditolak_bulan_ini,
            COUNT(*) FILTER (WHERE role = 'admin' AND status_verifikasi = 'disetujui' AND diverifikasi_at >= date_trunc('month', CURRENT_DATE)) AS disetujui_bulan_ini,
            COUNT(*) FILTER (WHERE role = 'admin' AND status_verifikasi = 'disetujui') AS terverifikasi,
            COUNT(*) FILTER (WHERE role = 'admin' AND NOT akun_aktif) AS nonaktif
          FROM pengguna");
    }

    public static function pemilik(array $f): array
    {
        $where = ["p.role = 'admin'"];
        $params = [];
        if (!empty($f['status']) && $f['status'] !== 'semua') {
            $where[] = 'p.status_verifikasi = :status';
            $params['status'] = $f['status'];
        }
        if (!empty($f['q'])) {
            $where[] = "(p.nama_lengkap ILIKE :q1 OR p.email ILIKE :q2 OR EXISTS (SELECT 1 FROM kos sx WHERE sx.pengguna_id=p.id AND sx.nama_kos ILIKE :q3) OR EXISTS (SELECT 1 FROM pengajuan_pemilik ax WHERE ax.pengguna_id=p.id AND ax.nama_kos ILIKE :q4))";
            $params['q1'] = $params['q2'] = $params['q3'] = $params['q4'] = '%' . $f['q'] . '%';
        }
        $limit = max(1, min(50, (int) ($f['limit'] ?? 5)));
        $page = max(1, (int) ($f['page'] ?? 1));
        $countParams = $params;
        $params['limit'] = $limit;
        $params['offset'] = ($page - 1) * $limit;
        $base = "FROM pengguna p LEFT JOIN kos s ON s.pengguna_id=p.id LEFT JOIN pengajuan_pemilik a ON a.pengguna_id=p.id WHERE " . implode(' AND ', $where);
        $total = (int) DB::nilai("SELECT COUNT(*) FROM (SELECT p.id $base GROUP BY p.id) x", $countParams);
        $rows = DB::semua("SELECT p.id, p.nama_lengkap, p.email, p.no_telepon, p.nik, p.status_verifikasi, p.akun_aktif,
                p.created_at, p.diverifikasi_at,
                COUNT(DISTINCT s.id) AS total_kos,
                COALESCE((array_agg(s.nama_kos ORDER BY s.created_at, s.id) FILTER (WHERE s.id IS NOT NULL))[1], a.nama_kos) AS nama_kos,
                COALESCE((array_agg(s.kota ORDER BY s.created_at, s.id) FILTER (WHERE s.id IS NOT NULL))[1], a.kota) AS kota,
                (array_agg(s.alamat ORDER BY s.created_at, s.id) FILTER (WHERE s.id IS NOT NULL))[1] AS alamat_kos,
                (array_agg(s.tipe_kos::text ORDER BY s.created_at, s.id) FILTER (WHERE s.id IS NOT NULL))[1] AS tipe_kos,
                (array_agg(s.created_at ORDER BY s.created_at, s.id) FILTER (WHERE s.id IS NOT NULL))[1] AS kos_dibuat
            $base GROUP BY p.id,a.pengguna_id ORDER BY CASE p.status_verifikasi WHEN 'menunggu' THEN 0 ELSE 1 END, p.created_at DESC
            LIMIT :limit OFFSET :offset", $params);
        $items = array_map(function ($r) {
            $r['akun_aktif'] = filter_var($r['akun_aktif'], FILTER_VALIDATE_BOOLEAN);
            return angka($r, ['id','total_kos']);
        }, $rows);
        return ['items' => $items, 'total' => $total, 'page' => $page, 'limit' => $limit];
    }

    public static function detail(int $id): array
    {
        $p = DB::satu("SELECT p.id,p.nama_lengkap,p.email,p.no_telepon,p.nik,p.status_verifikasi,p.akun_aktif,p.alasan_verifikasi,p.created_at,p.diverifikasi_at,a.alamat_domisili FROM pengguna p LEFT JOIN pengajuan_pemilik a ON a.pengguna_id=p.id WHERE p.id=:id AND p.role='admin'", ['id'=>$id])
            ?? Response::notFound('Pemilik tidak ditemukan');
        $p['nik_samar'] = $p['nik'] ? substr($p['nik'],0,4) . str_repeat('*',8) . substr($p['nik'],-4) : '-';
        unset($p['nik']);
        $p['akun_aktif'] = filter_var($p['akun_aktif'], FILTER_VALIDATE_BOOLEAN);
        $p['kos'] = DB::semua("SELECT s.id,s.nama_kos,s.tipe_kos,s.alamat,s.kecamatan,s.kota,s.created_at,
                 COUNT(k.id) AS total_kamar,
                 (SELECT MIN(k2.harga_per_bulan) FROM kamar k2 WHERE k2.kos_id=s.id) AS harga_min,
                 (SELECT MAX(k3.harga_per_bulan) FROM kamar k3 WHERE k3.kos_id=s.id) AS harga_max
            FROM kos s LEFT JOIN kamar k ON k.kos_id=s.id WHERE s.pengguna_id=:id
            GROUP BY s.id ORDER BY s.created_at", ['id'=>$id]);
        if (!$p['kos'] && $p['status_verifikasi'] === 'menunggu') {
            $awal = DB::satu('SELECT nama_kos,tipe_kos,alamat_kos AS alamat,kecamatan,kota,created_at FROM pengajuan_pemilik WHERE pengguna_id=:id', ['id'=>$id]);
            if ($awal) $p['kos'][] = ['id'=>null,'nama_kos'=>$awal['nama_kos'],'tipe_kos'=>$awal['tipe_kos'],'alamat'=>$awal['alamat'],'kecamatan'=>$awal['kecamatan'],'kota'=>$awal['kota'],'created_at'=>$awal['created_at'],'total_kamar'=>0];
        }
        return $p;
    }

    public static function verifikasi(int $id, int $aktor, string $aksi, string $alasan): array
    {
        if (!in_array($aksi, ['setujui','tolak'], true)) Response::invalid(['aksi'=>'Pilih setujui atau tolak']);
        if ($aksi === 'tolak' && trim($alasan) === '') Response::invalid(['alasan'=>'Alasan penolakan wajib diisi']);
        $status = $aksi === 'setujui' ? 'disetujui' : 'ditolak';
        $p = DB::transaksi(function () use ($status, $aksi, $alasan, $aktor, $id) {
            $pemilik = DB::satu("UPDATE pengguna SET status_verifikasi=:status, alasan_verifikasi=:alasan,
                    diverifikasi_oleh=:aktor, diverifikasi_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
                WHERE id=:id AND role='admin' AND status_verifikasi='menunggu'
                RETURNING id,nama_lengkap,status_verifikasi", ['status'=>$status,'alasan'=>$aksi==='tolak'?$alasan:null,'aktor'=>$aktor,'id'=>$id]);
            if ($pemilik && $aksi === 'setujui' && !DB::nilai('SELECT 1 FROM kos WHERE pengguna_id=:id LIMIT 1', ['id'=>$id])) {
                $awal = DB::satu('SELECT nama_kos,tipe_kos,alamat_kos,kecamatan,kota FROM pengajuan_pemilik WHERE pengguna_id=:id', ['id'=>$id]);
                if ($awal) DB::insert('kos', [
                    'pengguna_id'=>$id, 'nama_kos'=>$awal['nama_kos'], 'tipe_kos'=>$awal['tipe_kos'],
                    'alamat'=>$awal['alamat_kos'], 'kecamatan'=>$awal['kecamatan'], 'kota'=>$awal['kota'],
                ], 'id');
            }
            return $pemilik;
        });
        return $p ?? Response::error('Pengajuan tidak ditemukan atau sudah diproses', 409);
    }

    public static function statusAkun(int $id, bool $aktif): array
    {
        $p = DB::satu("UPDATE pengguna SET akun_aktif=:aktif,updated_at=CURRENT_TIMESTAMP WHERE id=:id AND role='admin' AND status_verifikasi='disetujui' RETURNING id,nama_lengkap,akun_aktif", ['aktif'=>$aktif,'id'=>$id]);
        if (!$p) Response::notFound('Pemilik terverifikasi tidak ditemukan');
        $p['akun_aktif'] = filter_var($p['akun_aktif'], FILTER_VALIDATE_BOOLEAN);
        return $p;
    }
}
