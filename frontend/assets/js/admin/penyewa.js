// Kelola Penyewa (Figma 464:10) + menu Tindakan (464:300).
// Ambil semua penyewa kos aktif sekali (status=semua), lalu cari/saring/urut/halaman di browser.

const PER_HALAMAN = 6;
const LABEL_HUNI = { aktif: 'Aktif', akan_masuk: 'Akan Masuk', selesai: 'Selesai' };
const KELAS_BAYAR = { Lunas: 'lunas', DP: 'dp', 'Belum Bayar': 'belum' };

const SVG_T = {
  titik: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>',
  mata: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  berkas: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>',
  surat: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>',
  kiri: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>',
  kanan: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>',
};

let semua = [];
const saring = { q: '', kamar: '', bayar: '', status: '', urut: 'berakhir', halaman: 1 };

document.addEventListener('DOMContentLoaded', async () => {
  if (!(await Panel.mulai())) return;

  // Link "Detail Sewa" dari Kelola Kamar membawa ?kamar_id
  saring.kamar = new URLSearchParams(location.search).get('kamar_id') || '';

  const ubah = (kunci) => (e) => { saring[kunci] = e.target.value.trim(); saring.halaman = 1; render(); };
  document.querySelector('#cari').addEventListener('input', ubah('q'));
  document.querySelector('#f-kamar').addEventListener('change', ubah('kamar'));
  document.querySelector('#f-bayar').addEventListener('change', ubah('bayar'));
  document.querySelector('#f-urut').addEventListener('change', ubah('urut'));
  document.querySelector('#tab-status').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    saring.status = btn.dataset.status;
    saring.halaman = 1;
    document.querySelectorAll('#tab-status button').forEach((b) => b.classList.toggle('aktif', b === btn));
    render();
  });
  document.querySelector('#paginasi').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-hal]');
    if (!btn || btn.disabled) return;
    saring.halaman = Number(btn.dataset.hal);
    render();
  });
  document.querySelector('#isi-tabel').addEventListener('click', klikTabel);
  document.addEventListener('click', (e) => { if (!e.target.closest('.sel-tindakan')) tutupMenu(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { tutupMenu(); tutupDetail(); } });
  document.querySelector('#btn-ekspor').addEventListener('click', ekspor);
  document.addEventListener('kos-berganti', () => { saring.kamar = ''; muat(); });

  muat();
});

async function muat() {
  const tbody = document.querySelector('#isi-tabel');
  tbody.innerHTML = '<tr><td colspan="6" class="kosong">Memuat data...</td></tr>';
  try {
    semua = await api(`penyewa?kos_id=${Panel.kosId}&status=semua`);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="kosong">${esc(err.message)}</td></tr>`;
    return;
  }
  isiPilihanKamar();
  renderRingkasan();
  render();
}

function isiPilihanKamar() {
  const kamar = [...new Map(semua.map((p) => [p.kamar_id, p.nomor_kamar])).entries()]
    .sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'id', { numeric: true }));
  const select = document.querySelector('#f-kamar');
  select.innerHTML = '<option value="">Semua Kamar</option>' +
    kamar.map(([id, no]) => `<option value="${id}">Kamar ${esc(no)}</option>`).join('');
  // Kamar dari URL mungkin belum punya penyewa: tetap tampilkan supaya filter terlihat aktif
  if (saring.kamar && !kamar.some(([id]) => String(id) === saring.kamar)) {
    select.insertAdjacentHTML('beforeend', `<option value="${esc(saring.kamar)}">Kamar terpilih</option>`);
  }
  select.value = saring.kamar;
}

function renderRingkasan() {
  const aktif = semua.filter((p) => p.status_huni === 'aktif');
  const belum = semua.filter((p) => p.status_huni !== 'selesai' && p.status_pembayaran !== 'Lunas');
  const sisaTagihan = belum.reduce((n, p) => n + (p.total_biaya - p.jumlah_dp), 0);
  const akanMasuk = semua.filter((p) => p.status_huni === 'akan_masuk').length;

  document.querySelector('#r-total').textContent = semua.length;
  document.querySelector('#r-aktif').textContent = aktif.length;
  document.querySelector('#r-aktif-ket').textContent = akanMasuk ? `${akanMasuk} penyewa akan segera masuk` : 'Sedang menghuni kamar';
  document.querySelector('#r-belum').textContent = belum.length;
  document.querySelector('#r-belum-ket').textContent = `${rupiah(sisaTagihan)} belum diterima`;
  document.querySelector('#r-berakhir').textContent = aktif.filter((p) => p.sisa_hari <= 30).length;

  document.querySelectorAll('[data-n]').forEach((el) => {
    el.textContent = el.dataset.n ? semua.filter((p) => p.status_huni === el.dataset.n).length : semua.length;
  });
}

function hasilSaring() {
  const q = saring.q.toLowerCase();
  const data = semua.filter((p) =>
    (!saring.status || p.status_huni === saring.status) &&
    (!saring.kamar || String(p.kamar_id) === saring.kamar) &&
    (!saring.bayar || p.status_pembayaran === saring.bayar) &&
    (!q || [p.nama_lengkap, p.email, p.nomor_kamar].some((t) => String(t).toLowerCase().includes(q))));

  const urut = {
    berakhir: (a, b) => (a.status_huni === 'selesai') - (b.status_huni === 'selesai') || a.tanggal_keluar.localeCompare(b.tanggal_keluar),
    terbaru: (a, b) => b.tanggal_masuk.localeCompare(a.tanggal_masuk),
    nama: (a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap, 'id'),
  }[saring.urut];
  return data.sort(urut);
}

function render() {
  const data = hasilSaring();
  const jmlHal = Math.max(1, Math.ceil(data.length / PER_HALAMAN));
  saring.halaman = Math.min(saring.halaman, jmlHal);
  const awal = (saring.halaman - 1) * PER_HALAMAN;
  const halIni = data.slice(awal, awal + PER_HALAMAN);

  const tbody = document.querySelector('#isi-tabel');
  if (!semua.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="kosong">Belum ada penyewa. Penyewa muncul di sini setelah Anda menyetujui pengajuan reservasi.</td></tr>';
  } else if (!halIni.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="kosong">Tidak ada penyewa yang cocok dengan pencarian/filter.</td></tr>';
  } else {
    tbody.innerHTML = halIni.map(barisPenyewa).join('');
  }

  document.querySelector('#info-hasil').textContent = data.length
    ? `Menampilkan ${awal + 1}-${awal + halIni.length} dari ${data.length} penyewa`
    : 'Tidak ada data';
  renderPaginasi(jmlHal);
}

function barisPenyewa(p) {
  const sisa = p.status_huni === 'aktif'
    ? `<div class="sel-sub ${p.sisa_hari <= 30 ? 'sisa-dekat' : ''}">Sisa ${p.sisa_hari} hari</div>`
    : `<div class="sel-sub">s/d ${tanggal(p.tanggal_keluar)}</div>`;
  const ketBayar = p.status_pembayaran === 'DP'
    ? `DP ${rupiah(p.jumlah_dp)}`
    : p.status_pembayaran;
  return `
    <tr>
      <td>
        <div class="penyewa">
          <span class="inisial v${p.penyewa_id % 3}">${esc(p.inisial)}</span>
          <div>
            <div class="sel-utama">${esc(p.nama_lengkap)}</div>
            <span class="status-huni ${p.status_huni}">${LABEL_HUNI[p.status_huni]} · ${esc(p.kode_reservasi)}</span>
          </div>
        </div>
      </td>
      <td><div class="sel-utama">Kamar ${esc(p.nomor_kamar)}</div><div class="sel-sub">${esc(p.tipe_kamar || p.nama_kos)}</div></td>
      <td><div class="sel-utama">${esc(p.no_telepon)}</div><div class="sel-sub">${esc(p.email)}</div></td>
      <td><div class="sel-utama">${tanggal(p.tanggal_masuk)}</div>${sisa}</td>
      <td><div class="sel-utama">${rupiah(p.total_biaya)}</div><span class="status-bayar ${KELAS_BAYAR[p.status_pembayaran]}">${esc(ketBayar)} · ${esc(p.durasi_label)}</span></td>
      <td>
        <div class="sel-tindakan" data-reservasi="${p.reservasi_id}">
          <button class="btn-detail" data-aksi="detail">Detail</button>
          <button class="btn-titik" data-aksi="menu" aria-haspopup="menu" aria-expanded="false" aria-label="Tindakan lain">${SVG_T.titik}</button>
        </div>
      </td>
    </tr>`;
}

function renderPaginasi(jmlHal) {
  const h = saring.halaman;
  // Maksimal 3 nomor halaman di sekitar halaman aktif (Figma: < 1 2 3 4 >)
  const mulai = Math.max(1, Math.min(h - 1, jmlHal - 3));
  const nomor = [];
  for (let i = mulai; i <= Math.min(jmlHal, mulai + 3); i++) nomor.push(i);
  document.querySelector('#paginasi').innerHTML = `
    <button data-hal="${h - 1}" ${h === 1 ? 'disabled' : ''} aria-label="Halaman sebelumnya">${SVG_T.kiri}</button>
    ${nomor.map((i) => `<button data-hal="${i}" class="${i === h ? 'aktif' : ''}">${i}</button>`).join('')}
    <button data-hal="${h + 1}" ${h === jmlHal ? 'disabled' : ''} aria-label="Halaman berikutnya">${SVG_T.kanan}</button>`;
}

// ---------- Tindakan per baris ----------

const cariBaris = (id) => semua.find((p) => p.reservasi_id === Number(id));

function klikTabel(e) {
  const tombol = e.target.closest('[data-aksi]');
  if (!tombol) return;
  const sel = tombol.closest('.sel-tindakan');
  const p = cariBaris(sel.dataset.reservasi);
  const aksi = tombol.dataset.aksi;

  if (aksi === 'menu') {
    const sudahBuka = sel.querySelector('.menu-tindakan');
    tutupMenu();
    if (!sudahBuka) bukaMenu(sel, tombol);
    return;
  }
  tutupMenu();
  if (aksi === 'detail') bukaDetail(p);
  if (aksi === 'tagihan') cetakTagihan(p);
}

function bukaMenu(sel, tombol) {
  tombol.setAttribute('aria-expanded', 'true');
  const p = cariBaris(sel.dataset.reservasi);
  const menu = document.createElement('div');
  menu.className = 'menu-tindakan';
  menu.setAttribute('role', 'menu');
  menu.innerHTML = `
    <button data-aksi="detail" role="menuitem">${SVG_T.mata}Lihat detail</button>
    <button data-aksi="tagihan" role="menuitem">${SVG_T.berkas}Cetak tagihan</button>
    <a href="${esc(linkNotifikasi(p))}" target="_blank" rel="noopener" role="menuitem">${SVG_T.surat}Kirim notifikasi</a>`;
  sel.appendChild(menu);
  // Baris paling bawah: buka ke atas supaya tidak terpotong
  if (menu.getBoundingClientRect().bottom > window.innerHeight - 8) menu.classList.add('ke-atas');
  menu.querySelector('a').addEventListener('click', tutupMenu);
}

function tutupMenu() {
  document.querySelectorAll('.menu-tindakan').forEach((m) => m.remove());
  document.querySelectorAll('.btn-titik[aria-expanded="true"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
}

/** Notifikasi = pesan WhatsApp siap kirim (pengingat bayar atau perpanjangan sewa). */
function linkNotifikasi(p) {
  const kos = Panel.kos()?.nama_kos || p.nama_kos;
  const sisa = p.total_biaya - p.jumlah_dp;
  const pesan = p.status_pembayaran !== 'Lunas'
    ? `Halo ${p.nama_lengkap}, kami dari ${kos}. Mengingatkan tagihan sewa Kamar ${p.nomor_kamar} (${p.kode_reservasi}) sebesar ${rupiah(sisa)} belum lunas. Terima kasih.`
    : `Halo ${p.nama_lengkap}, kami dari ${kos}. Masa sewa Kamar ${p.nomor_kamar} berakhir ${tanggal(p.tanggal_keluar)}. Apakah ingin diperpanjang?`;
  return `${p.wa}?text=${encodeURIComponent(pesan)}`;
}

function cetakTagihan(p) {
  const kos = Panel.kos() || { nama_kos: p.nama_kos, alamat: '', kota: '' };
  const sisa = p.total_biaya - p.jumlah_dp;
  const w = window.open('', '_blank', 'width=720,height=900');
  if (!w) { toast('Izinkan pop-up untuk mencetak tagihan', true); return; }
  w.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Tagihan ${esc(p.kode_reservasi)}</title>
    <style>
      body{font-family:Inter,system-ui,sans-serif;color:#1e293b;margin:40px;font-size:14px}
      h1{font-size:22px;margin:0;color:#004ac6} .muted{color:#64748b} table{width:100%;border-collapse:collapse;margin:24px 0}
      td,th{padding:10px;border-bottom:1px solid #e2e8f0;text-align:left} th{background:#eff4ff;font-size:12px}
      .kanan{text-align:right} .total td{font-weight:700;font-size:16px;border:0} .kepala{display:flex;justify-content:space-between}
    </style></head><body>
    <div class="kepala"><div><h1>KosinAja</h1><div class="muted">${esc(kos.nama_kos)}<br>${esc([kos.alamat, kos.kota].filter(Boolean).join(', '))}</div></div>
      <div class="kanan"><b>TAGIHAN SEWA</b><br><span class="muted">${esc(p.kode_reservasi)}<br>Dicetak ${tanggal(new Date().toISOString().slice(0, 10))}</span></div></div>
    <p><b>Kepada:</b> ${esc(p.nama_lengkap)}<br><span class="muted">${esc(p.no_telepon)} · ${esc(p.email)}</span></p>
    <table><tr><th>Keterangan</th><th>Periode</th><th class="kanan">Jumlah</th></tr>
      <tr><td>Sewa Kamar ${esc(p.nomor_kamar)} (${esc(p.tipe_kamar || '-')}), ${esc(p.durasi_label)}</td>
        <td>${tanggal(p.tanggal_masuk)} - ${tanggal(p.tanggal_keluar)}</td><td class="kanan">${rupiah(p.total_biaya)}</td></tr>
      <tr><td colspan="2">Sudah dibayar (${esc(p.status_pembayaran)})</td><td class="kanan">- ${rupiah(p.status_pembayaran === 'Lunas' ? p.total_biaya : p.jumlah_dp)}</td></tr>
      <tr class="total"><td colspan="2">Sisa tagihan</td><td class="kanan">${rupiah(p.status_pembayaran === 'Lunas' ? 0 : sisa)}</td></tr>
    </table>
    <p class="muted">Pembayaran dilakukan langsung kepada pemilik kos. Simpan tagihan ini sebagai bukti.</p>
    <script>window.onload=()=>window.print()<\/script></body></html>`);
  w.document.close();
}

// ---------- Modal detail ----------

async function bukaDetail(p) {
  const modal = document.querySelector('#modal-detail');
  const isi = modal.querySelector('.modal-isi');
  isi.innerHTML = '<p>Memuat...</p>';
  modal.classList.add('buka');
  modal.onclick = (e) => { if (e.target === modal) tutupDetail(); };

  let profil;
  try {
    profil = await api(`penyewa?id=${p.penyewa_id}`);
  } catch (err) {
    isi.innerHTML = `<p>${esc(err.message)}</p><div class="modal-aksi"><button class="btn-abu" data-tutup>Tutup</button></div>`;
    isi.querySelector('[data-tutup]').onclick = tutupDetail;
    return;
  }

  isi.innerHTML = `
    <div class="detail-profil">
      <span class="inisial v${p.penyewa_id % 3}">${esc(profil.inisial)}</span>
      <div>
        <h3>${esc(profil.nama_lengkap)}</h3>
        <p class="sel-sub">${esc(profil.email)} · ${esc(profil.no_telepon)}</p>
      </div>
    </div>
    <div class="detail-grid">
      <div><span>Kamar</span><b>${esc(p.nomor_kamar)} · ${esc(p.tipe_kamar || '-')}</b></div>
      <div><span>Status</span><b>${LABEL_HUNI[p.status_huni]}</b></div>
      <div><span>Masuk</span><b>${tanggal(p.tanggal_masuk)}</b></div>
      <div><span>Berakhir</span><b>${tanggal(p.tanggal_keluar)} (${esc(p.durasi_label)})</b></div>
      <div><span>Total Sewa</span><b>${rupiah(p.total_biaya)}</b></div>
      <div><span>Kode</span><b>${esc(p.kode_reservasi)}</b></div>
    </div>
    <h4>Catat Pembayaran</h4>
    <form class="form-bayar" id="form-bayar">
      <label>Status<select name="status_pembayaran">
        ${['Belum Bayar', 'DP', 'Lunas'].map((s) => `<option ${s === p.status_pembayaran ? 'selected' : ''}>${s}</option>`).join('')}
      </select></label>
      <label>Jumlah DP (Rp)<input name="jumlah_dp" type="number" min="0" max="${p.total_biaya}" step="1000" value="${p.jumlah_dp}"></label>
      <button class="btn-biru" type="submit">Simpan</button>
    </form>
    <h4>Riwayat Sewa</h4>
    <ul class="riwayat">
      ${profil.riwayat.map((r) => `
        <li><span><b>${esc(r.nama_kos)}</b> · Kamar ${esc(r.nomor_kamar)}<br>
          <span class="sel-sub">${tanggal(r.tanggal_masuk)} - ${tanggal(r.tanggal_keluar)}${r.rating ? ` · ★ ${r.rating}` : ''}</span></span>
          <span class="pill-status ${{ Disetujui: 'hijau', Selesai: 'biru', Pending: 'kuning', Survei: 'kuning' }[r.status_reservasi] || 'abu'}">${esc(r.status_reservasi)}</span></li>`).join('')}
    </ul>
    <div class="modal-aksi">
      <a class="btn-abu biru" href="${esc(profil.wa)}" target="_blank" rel="noopener">Chat WhatsApp</a>
      <button class="btn-abu" data-tutup>Tutup</button>
    </div>`;

  isi.querySelector('[data-tutup]').onclick = tutupDetail;
  const form = isi.querySelector('#form-bayar');
  const status = form.elements.status_pembayaran;
  const dp = form.elements.jumlah_dp;
  const sesuaikan = () => {
    dp.disabled = status.value !== 'DP';
    if (status.value === 'Belum Bayar') dp.value = 0;
    if (status.value === 'Lunas') dp.value = p.total_biaya;
  };
  status.addEventListener('change', sesuaikan);
  sesuaikan();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const tombol = form.querySelector('button');
    tombol.disabled = true;
    try {
      const hasil = await api(`reservasi?id=${p.reservasi_id}&aksi=pembayaran`, {
        method: 'PATCH',
        body: { status_pembayaran: status.value, jumlah_dp: Number(dp.value || 0) },
      });
      Object.assign(p, { status_pembayaran: hasil.status_pembayaran, jumlah_dp: hasil.jumlah_dp });
      toast('Pembayaran dicatat');
      renderRingkasan();
      render();
    } catch (err) {
      toast(err.message, true);
    } finally {
      tombol.disabled = false;
    }
  });
}

function tutupDetail() {
  document.querySelector('#modal-detail').classList.remove('buka');
}

// ---------- Ekspor CSV (dibuka Excel) ----------

function ekspor() {
  const data = hasilSaring();
  if (!data.length) { toast('Tidak ada data untuk diekspor', true); return; }
  const kolom = [
    ['Kode', 'kode_reservasi'], ['Status', 'status_huni'], ['Nama', 'nama_lengkap'], ['Email', 'email'], ['Telepon', 'no_telepon'],
    ['Kamar', 'nomor_kamar'], ['Tipe', 'tipe_kamar'], ['Masuk', 'tanggal_masuk'], ['Berakhir', 'tanggal_keluar'],
    ['Durasi', 'durasi_label'], ['Total Biaya', 'total_biaya'], ['DP', 'jumlah_dp'], ['Pembayaran', 'status_pembayaran'],
  ];
  const sel = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const baris = [kolom.map(([j]) => sel(j)).join(';'),
    ...data.map((p) => kolom.map(([, k]) => sel(k === 'status_huni' ? LABEL_HUNI[p[k]] : p[k])).join(';'))];
  // BOM + pemisah titik koma supaya Excel versi Indonesia langsung membaca kolom dengan benar
  const blob = new Blob(['﻿' + baris.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `penyewa-${(Panel.kos()?.nama_kos || 'kos').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
