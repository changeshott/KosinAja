// Pengajuan Reservasi (Figma 464:5131). Default menampilkan yang menunggu respon (Pending + Survei).

const WARNA_AVATAR = [['#dbe1ff', '#004ac6'], ['#f3e8ff', '#7e22ce'], ['#dcfce7', '#15803d'], ['#fef3c7', '#b45309']];
const KELAS_STATUS = {
  Pending: 'kuning', Survei: 'biru', Disetujui: 'hijau', Selesai: 'hijau',
  Ditolak: 'merah', Dibatalkan: 'abu', Kedaluwarsa: 'abu',
};

let status = 'menunggu';

document.addEventListener('DOMContentLoaded', async () => {
  if (!(await Panel.mulai())) return;

  document.querySelector('#filter-status').addEventListener('change', (e) => { status = e.target.value; muat(); });
  document.querySelector('#lihat-semua').addEventListener('click', () => {
    status = '';
    document.querySelector('#filter-status').value = 'menunggu';
    muat();
  });
  document.querySelector('#tabel').addEventListener('click', aksi);
  document.addEventListener('kos-berganti', muat);
  muat();
});

async function muat() {
  const tbody = document.querySelector('#tabel');
  tbody.classList.add('memuat');
  try {
    const kos = `kos_id=${Panel.kosId}`;
    const [data, menunggu, semua] = await Promise.all([
      api(`reservasi?${kos}&per_page=50${status ? `&status=${status}` : ''}`),
      api(`reservasi?${kos}&status=menunggu&per_page=1`),
      api(`reservasi?${kos}&per_page=1`),
    ]);
    const badge = document.querySelector('#badge-menunggu');
    badge.hidden = menunggu.total === 0;
    badge.textContent = `${menunggu.total} Menunggu Respon`;
    document.querySelector('#lihat-semua').textContent = `Lihat Semua (${semua.total})`;
    document.querySelector('#lihat-semua').classList.toggle('aktif', status === '');

    tbody.innerHTML = data.items.length
      ? data.items.map(baris).join('')
      : `<tr><td colspan="5" class="kosong">${status === 'menunggu' ? 'Tidak ada reservasi yang menunggu respon.' : 'Belum ada reservasi.'}</td></tr>`;
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="kosong">${esc(err.message || 'Gagal memuat reservasi')}</td></tr>`;
  } finally {
    tbody.classList.remove('memuat');
  }
}

function baris(r) {
  const [bg, fg] = WARNA_AVATAR[r.penyewa_id % WARNA_AVATAR.length];
  return `
    <tr data-id="${r.id}">
      <td>
        <div class="penyewa">
          <span class="avatar-reservasi" style="background:${bg};color:${fg}">${esc(r.penyewa_inisial)}</span>
          <div><div class="sel-utama tebal">${esc(r.penyewa_nama)}</div><div class="sel-sub">${esc(r.penyewa_telepon)}</div></div>
        </div>
      </td>
      <td><div class="sel-utama">Kamar ${esc(r.nomor_kamar)}</div><div class="sel-sub">${esc(r.tipe_kamar)}</div></td>
      <td><div class="sel-utama">${tanggal(r.tanggal_masuk)}</div><div class="sel-sub">Durasi: ${esc(r.durasi_label)}</div></td>
      <td><div class="sel-utama tebal">${rupiah(r.total_biaya)}</div>${labelBayar(r)}</td>
      <td><div class="aksi">${r.menunggu_respon ? tombolRespon(r) : labelStatus(r)}</div></td>
    </tr>`;
}

function labelBayar(r) {
  if (r.status_pembayaran === 'Lunas') return '<div class="sel-sub teks-hijau">Lunas</div>';
  if (r.status_pembayaran === 'DP') return `<div class="sel-sub text-aksen">DP ${rupiah(r.jumlah_dp)}</div>`;
  return '';
}

function tombolRespon(r) {
  return `
    <button class="btn-setuju" data-aksi="setujui">Setuju</button>
    <button class="btn-tolak-merah" data-aksi="tolak">Tolak</button>
    <button class="btn-x" data-aksi="batalkan" title="Batalkan reservasi (misal calon penyewa membatalkan lewat chat)">
      <img src="../assets/img/ikon-silang.svg" width="10.5" height="10.5" alt="Batalkan">
    </button>`;
}

function labelStatus(r) {
  const wa = r.penyewa_wa ? `<a class="btn-pill" href="${esc(r.penyewa_wa)}" target="_blank" rel="noopener">Chat WA</a>` : '';
  return `${wa}<span class="pill-status ${KELAS_STATUS[r.status_reservasi] || 'abu'}">${esc(r.status_reservasi)}</span>`;
}

async function aksi(e) {
  const btn = e.target.closest('[data-aksi]');
  if (!btn) return;
  const id = btn.closest('tr').dataset.id;
  const jenis = btn.dataset.aksi;
  let body;

  if (jenis === 'tolak') {
    const alasan = await mintaTeks({
      judul: 'Tolak reservasi?',
      keterangan: 'Alasan penolakan akan ditampilkan ke calon penyewa di halaman Reservasi Saya.',
      tombol: 'Tolak Reservasi',
    });
    if (!alasan) return;
    body = { catatan_pemilik: alasan };
  }
  if (jenis === 'batalkan' && !confirm('Batalkan reservasi ini? Kamar akan kembali tersedia.')) return;

  btn.disabled = true;
  try {
    await api(`reservasi?id=${id}&aksi=${jenis}`, { method: 'PATCH', body });
    toast({ setujui: 'Reservasi disetujui, kamar ditandai terisi', tolak: 'Reservasi ditolak', batalkan: 'Reservasi dibatalkan' }[jenis]);
    muat();
  } catch (err) {
    toast(err.message || 'Gagal memproses reservasi', true);
    btn.disabled = false;
  }
}
