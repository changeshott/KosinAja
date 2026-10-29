<?php
// Reservasi: pengajuan dari penyewa, lalu diproses pemilik (setujui, tolak, survei, selesai, pembayaran).
class ReservasiModel
{
    public const STATUS = ['Pending', 'Survei', 'Disetujui', 'Ditolak', 'Dibatalkan', 'Kedaluwarsa', 'Selesai'];

    // aksi => [status asal yang diizinkan, status tujuan]
    private const TRANSISI = [
        'survei'   => [['Pending'], 'Survei'],
        'setujui'  => [['Pending', 'Survei'], 'Disetujui'],
        'tolak'    => [['Pending', 'Survei'], 'Ditolak'],
        'batalkan' => [['Pending', 'Survei', 'Disetujui'], 'Dibatalkan'],
        'selesai'  => [['Disetujui'], 'Selesai'],
    ];

    // Kolom yang dipakai tabel "Reservasi & Booking Terbaru" dan halaman "Pengajuan Reservasi"
    private const SELECT = "
        SELECT r.id, r.kode_reservasi, r.status_reservasi, r.tanggal_masuk, r.tanggal_keluar,
               r.durasi_sewa_bulan, r.total_biaya, r.jumlah_dp, r.status_pembayaran,
               r.is_survei_dahulu, r.jadwal_survei, r.batas_konfirmasi, r.catatan_pemilik,
               r.created_at, r.direspon_at,
               p.id AS penyewa_id, p.nama_lengkap AS penyewa_nama, p.no_telepon AS penyewa_telepon,
               k.id AS kamar_id, k.nomor_kamar, k.tipe_kamar, d.lantai,
               s.id AS kos_id, s.nama_kos
          FROM reservasi r
          JOIN pengguna p ON p.id = r.pengguna_id
          JOIN kamar k ON k.id = r.kamar_id
          LEFT JOIN detail_kamar d ON d.kamar_id = k.id
          JOIN kos s ON s.id = k.kos_id";

    /** Reservasi Pending yang lewat 1x24 jam diubah ke Kedaluwarsa (fungsi di database). */
    public static function kedaluwarsakan(): void
    {
        DB::query('SELECT fn_kedaluwarsakan_reservasi()');
    }

    /** $filter: kos_id, status ('menunggu' = Pending+Survei), q (nama/kode), limit, offset. */
    public static function list(int $adminId, array $filter): array
    {
        $where = ['s.pengguna_id = :admin'];
        $p = ['admin' => $adminId];
        if (!empty($filter['kos_id'])) {
            $where[] = 's.id = :kos';
            $p['kos'] = $filter['kos_id'];
        }
        if (($filter['status'] ?? null) === 'menunggu') {
            $where[] = "r.status_reservasi IN ('Pending', 'Survei')";
        } elseif (!empty($filter['status'])) {
            $where[] = 'r.status_reservasi = :status::status_reservasi_enum';
            $p['status'] = $filter['status'];
        }
        if (!empty($filter['q'])) {
            $where[] = '(p.nama_lengkap ILIKE :q1 OR r.kode_reservasi ILIKE :q2)';
            $p['q1'] = $p['q2'] = '%' . $filter['q'] . '%';
        }
        $sql = self::SELECT . ' WHERE ' . implode(' AND ', $where);

        return [
            'total' => (int) DB::nilai("SELECT COUNT(*) FROM ($sql) x", $p),
            // Yang menunggu respon tampil paling atas, lalu terbaru
            'items' => array_map([self::class, 'format'], DB::semua("$sql
                ORDER BY (r.status_reservasi IN ('Pending', 'Survei')) DESC, r.created_at DESC
                LIMIT :limit OFFSET :offset", $p + ['limit' => $filter['limit'] ?? 10, 'offset' => $filter['offset'] ?? 0])),
        ];
    }

    public static function find(int $id, int $adminId): array
    {
        return self::format(DB::satu(self::SELECT . ' WHERE r.id = :id AND s.pengguna_id = :admin', ['id' => $id, 'admin' => $adminId])
            ?? Response::notFound('Reservasi tidak ditemukan'));
    }

    /**
     * Pengajuan reservasi dari penyewa. Total biaya dihitung di server dari harga kamar, bukan dari input frontend.
     * Bentrok jadwal ditolak oleh EXCLUDE constraint di database.
     */
    public static function create(array $data): array
    {
        $harga = DB::nilai('SELECT harga_per_bulan FROM kamar WHERE id = :id', ['id' => $data['kamar_id']]);
        if ($harga === false) {
            Response::notFound('Kamar tidak ditemukan');
        }
        $data['total_biaya'] = (float) $harga * $data['durasi_sewa_bulan'];
        $data['kode_reservasi'] = 'KSN-' . date('Ymd') . '-' . strtoupper(bin2hex(random_bytes(3)));
        return angka(DB::insert('reservasi', $data, 'id, kode_reservasi, total_biaya, batas_konfirmasi'), ['total_biaya']);
    }

    /**
     * Tombol Setujui, Tolak, Jadwalkan survei, dll. Status asal dicek di WHERE supaya dua klik bersamaan
     * tidak saling menimpa. Status kamar ikut berubah lewat trigger.
     */
    public static function ubahStatus(int $id, int $adminId, string $aksi, array $data): array
    {
        [$asal, $tujuan] = self::TRANSISI[$aksi]
            ?? Response::error('Aksi tidak dikenal. Pilihan: ' . implode(', ', array_keys(self::TRANSISI)) . ', pembayaran');
        $lama = self::find($id, $adminId);
        if (!in_array($lama['status_reservasi'], $asal, true)) {
            Response::error("Reservasi berstatus {$lama['status_reservasi']} tidak bisa di-$aksi", 409);
        }
        if ($aksi === 'tolak' && empty($data['catatan_pemilik'])) {
            Response::invalid(['catatan_pemilik' => 'Alasan penolakan wajib diisi']);
        }
        if ($aksi === 'survei' && empty($data['jadwal_survei'])) {
            Response::invalid(['jadwal_survei' => 'Wajib diisi']);
        }

        $diubah = DB::query("
            UPDATE reservasi
               SET status_reservasi = :tujuan::status_reservasi_enum,
                   catatan_pemilik  = COALESCE(:catatan, catatan_pemilik),
                   jadwal_survei    = COALESCE(:jadwal::timestamp, jadwal_survei),
                   direspon_at      = COALESCE(direspon_at, CURRENT_TIMESTAMP),
                   updated_at       = CURRENT_TIMESTAMP
             WHERE id = :id AND status_reservasi = ANY(:asal::status_reservasi_enum[])", [
            'tujuan'  => $tujuan,
            'catatan' => $data['catatan_pemilik'] ?? null,
            'jadwal'  => $data['jadwal_survei'] ?? null,
            'id'      => $id,
            'asal'    => '{' . implode(',', $asal) . '}',
        ])->rowCount();
        if (!$diubah) {
            Response::error('Status reservasi sudah berubah, muat ulang halaman', 409);
        }
        return self::find($id, $adminId);
    }

    /** Catat DP / pelunasan (kolom "Total & Status DP"). */
    public static function catatPembayaran(int $id, int $adminId, array $data): array
    {
        self::find($id, $adminId);
        DB::update('reservasi', $data, 'id = :id', ['id' => $id]);
        return self::find($id, $adminId);
    }

    /** Tambah field turunan yang langsung dipakai tampilan (inisial avatar, label durasi, link WA). */
    public static function format(array $r): array
    {
        return angka($r, ['total_biaya', 'jumlah_dp']) + [
            'penyewa_inisial' => inisial($r['penyewa_nama']),
            'penyewa_wa'      => linkWhatsApp($r['penyewa_telepon']),
            'durasi_label'    => labelDurasi((int) $r['durasi_sewa_bulan']),
            'menunggu_respon' => in_array($r['status_reservasi'], ['Pending', 'Survei'], true),
        ];
    }
}
