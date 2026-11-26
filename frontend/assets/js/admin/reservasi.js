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
      : `<tr><td colspan="6" class="kosong">${status === 'menunggu' ? 'Tidak ada reservasi yang menunggu respon.' : 'Belum ada reservasi.'}</td></tr>`;
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="kosong">${esc(err.message || 'Gagal memuat reservasi')}</td></tr>`;
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
      <td>${labelStatus(r)}</td>
      <td><div class="aksi-reservasi">${r.penyewa_wa ? `<a class="btn-wa whitespace-nowrap" href="${esc(r.penyewa_wa)}" target="_blank" rel="noopener">Chat WA</a>` : ''}${r.menunggu_respon ? tombolRespon(r) : ''}</div></td>
    </tr>`;
}

function labelBayar(r) {
  if (r.status_pembayaran === 'Lunas') return '<div class="sel-sub teks-hijau">Lunas</div>';
  if (r.status_pembayaran === 'DP') return `<div class="sel-sub text-aksen">DP ${rupiah(r.jumlah_dp)}</div>`;
  return '';
}

function tombolRespon(r) {
  return `
    ${r.status_reservasi === 'Pending' ? '<button class="btn-pill biru whitespace-nowrap" data-aksi="survei">Atur survei</button>' : ''}
    <button class="btn-setuju" data-aksi="setujui">Setuju</button>
    <button class="btn-tolak-merah" data-aksi="tolak">Tolak</button>`;
}

function labelStatus(r) {
  const mintaSurvei = [true, 1, '1', 't', 'true'].includes(r.is_survei_dahulu) && r.status_reservasi === 'Pending'
    ? '<span class="pill-status biru">Minta survei lokasi</span>' : '';
  const jadwal = r.status_reservasi === 'Survei' && r.jadwal_survei
    ? `<span class="sel-sub">${tanggal(r.jadwal_survei.slice(0, 10))}, ${esc(r.jadwal_survei.slice(11, 16))}</span>` : '';
  const batas = r.status_reservasi === 'Pending' && r.batas_konfirmasi
    ? `<span class="info-respons">Respons sebelum ${tanggal(r.batas_konfirmasi.slice(0, 10))}, ${esc(r.batas_konfirmasi.slice(11, 16))}</span>` : '';
  const label = { Pending: 'Menunggu respons', Survei: 'Jadwal survei' }[r.status_reservasi] || r.status_reservasi;
  return `<div class="status-reservasi"><span class="pill-status ${KELAS_STATUS[r.status_reservasi] || 'abu'}">${esc(label)}</span>${mintaSurvei}${jadwal}${batas}</div>`;
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
  if (jenis === 'survei') {
    const jadwal = await mintaJadwalSurvei();
    if (!jadwal) return;
    body = { jadwal_survei: `${jadwal.replace('T', ' ')}:00` };
  }
  if (jenis === 'setujui') {
    if (!(await konfirmasiPersetujuan())) return;
  }
  if (jenis === 'batalkan' && !confirm('Batalkan reservasi ini? Kamar akan kembali tersedia.')) return;

  btn.disabled = true;
  try {
    await api(`reservasi?id=${id}&aksi=${jenis}`, { method: 'PATCH', body });
    toast({ survei: 'Jadwal survei tersimpan', setujui: 'Reservasi disetujui, kamar ditandai terisi', tolak: 'Reservasi ditolak', batalkan: 'Reservasi dibatalkan' }[jenis]);
    muat();
  } catch (err) {
    toast(err.message || 'Gagal memproses reservasi', true);
    btn.disabled = false;
  }
}

function mintaJadwalSurvei() {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal buka';
    modal.innerHTML = `
      <section class="modal-isi modal-jadwal" role="dialog" aria-modal="true" aria-labelledby="judul-jadwal">
        <h3 id="judul-jadwal">Jadwalkan survei</h3>
        <p>Pilih waktu kunjungan untuk calon penyewa.</p>
        <label class="label-jadwal" for="waktu-jadwal">Tanggal dan waktu</label>
        <input class="input-jadwal" id="waktu-jadwal" type="datetime-local" required>
        <div class="modal-aksi">
          <button class="btn-abu" type="button" data-batal>Batal</button>
          <button class="btn-biru" type="button" data-simpan>Simpan jadwal</button>
        </div>
      </section>`;
    document.body.appendChild(modal);

    const input = modal.querySelector('#waktu-jadwal');
    const sekarang = new Date();
    sekarang.setMinutes(sekarang.getMinutes() - sekarang.getTimezoneOffset());
    input.min = sekarang.toISOString().slice(0, 16);

    const tutup = (hasil) => {
      document.removeEventListener('keydown', tombolEscape);
      modal.remove();
      resolve(hasil);
    };
    const tombolEscape = (e) => { if (e.key === 'Escape') tutup(null); };
    modal.querySelector('[data-batal]').addEventListener('click', () => tutup(null));
    modal.querySelector('[data-simpan]').addEventListener('click', () => {
      if (!input.value) { input.focus(); return; }
      tutup(input.value);
    });
    modal.addEventListener('click', (e) => { if (e.target === modal) tutup(null); });
    document.addEventListener('keydown', tombolEscape);
    input.focus();
  });
}

function konfirmasiPersetujuan() {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal buka';
    modal.innerHTML = `
      <section class="modal-isi modal-persetujuan" role="dialog" aria-modal="true" aria-labelledby="judul-persetujuan">
        <span class="ikon-persetujuan" aria-hidden="true">!</span>
        <h3 id="judul-persetujuan">Periksa sebelum menyetujui</h3>
        <p>Pastikan pengajuan ini sudah kamu tinjau.</p>
        <div class="catatan-persetujuan">
          <p><b>1.</b> Periksa nama calon penyewa dan kamar yang diajukan.</p>
          <p><b>2.</b> Setelah disetujui, kamar akan ditandai terisi dan status reservasi berubah menjadi Disetujui.</p>
        </div>
        <label class="cek-persetujuan"><input type="checkbox"> Saya yakin ingin menyetujui pengajuan ini.</label>
        <div class="modal-aksi">
          <button class="btn-abu" type="button" data-batal>Batal</button>
          <button class="btn-setuju" type="button" data-ok disabled>Setujui Reservasi</button>
        </div>
      </section>`;
    document.body.appendChild(modal);

    const tutup = (hasil) => {
      document.removeEventListener('keydown', tombolEscape);
      modal.remove();
      resolve(hasil);
    };
    const tombolEscape = (e) => { if (e.key === 'Escape') tutup(false); };
    const cek = modal.querySelector('input[type="checkbox"]');
    const setujui = modal.querySelector('[data-ok]');
    cek.addEventListener('change', () => { setujui.disabled = !cek.checked; });
    modal.querySelector('[data-batal]').addEventListener('click', () => tutup(false));
    setujui.addEventListener('click', () => tutup(true));
    modal.addEventListener('click', (e) => { if (e.target === modal) tutup(false); });
    document.addEventListener('keydown', tombolEscape);
    modal.querySelector('[data-batal]').focus();
  });
}
