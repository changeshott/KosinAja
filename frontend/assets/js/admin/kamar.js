// Kelola Kamar & Unit (Figma 464:4305). Data dari GET api/kamar?kos_id=..., filter di sisi browser
// karena satu kos paling banyak puluhan kamar. Tombol Inventaris di kartu membuka modal CRUD api/inventaris.

const FOTO_CONTOH = ['kamar-1.jpg', 'kamar-2.jpg', 'kamar-3.jpg'];

// Ikon strip fasilitas: cocokkan nama fasilitas dari database ke ikon Figma
const IKON_FASILITAS = [
  [/^AC$/i, 'fas-ac.svg', 15, 15],
  [/wifi/i, 'fas-wifi.svg', 18, 12.75],
  [/shower|kloset|wastafel/i, 'fas-kamar-mandi.svg', 10.5, 13.5],
  [/kasur/i, 'fas-kasur.svg', 15, 9],
  [/stop kontak|listrik/i, 'fas-listrik.svg', 12, 15],
  [/lemari/i, 'fas-lemari.svg', 15, 15],
];

let semuaKamar = [];
const filter = { q: '', tipe: '', status: '' };

document.addEventListener('DOMContentLoaded', async () => {
  if (!(await Panel.mulai())) return;

  document.querySelector('#cari').addEventListener('input', (e) => { filter.q = e.target.value.trim().toLowerCase(); render(); });
  document.querySelector('#filter-tipe').addEventListener('change', (e) => { filter.tipe = e.target.value; render(); });
  document.querySelector('#tab-status').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    filter.status = btn.dataset.status;
    document.querySelectorAll('#tab-status button').forEach((b) => b.classList.toggle('aktif', b === btn));
    render();
  });
  document.querySelector('#grid-kamar').addEventListener('click', aksiKartu);
  document.addEventListener('kos-berganti', muat);
  pasangInventaris();
  muat();
});

async function muat() {
  const grid = document.querySelector('#grid-kamar');
  grid.classList.add('memuat');
  try {
    semuaKamar = await api(`kamar?kos_id=${Panel.kosId}`);
    isiTipe();
    hitungKpi();
    render();
  } catch (err) {
    grid.innerHTML = `<p class="galat">${esc(err.message || 'Gagal memuat kamar')}</p>`;
  } finally {
    grid.classList.remove('memuat');
  }
}

function isiTipe() {
  const select = document.querySelector('#filter-tipe');
  const tipe = [...new Set(semuaKamar.map((k) => k.tipe_kamar))].sort();
  select.innerHTML = '<option value="">Semua Tipe Kamar</option>' +
    tipe.map((t) => `<option ${t === filter.tipe ? 'selected' : ''}>${esc(t)}</option>`).join('');
  if (!tipe.includes(filter.tipe)) filter.tipe = '';
}

// "Terisi (Aktif)" menghitung kamar Terisi + Dipesan (sudah disetujui, menunggu tanggal masuk)
const terisi = (k) => k.status === 'Terisi' || k.status === 'Dipesan';

function hitungKpi() {
  const n = {
    semua: semuaKamar.length,
    terisi: semuaKamar.filter(terisi).length,
    kosong: semuaKamar.filter((k) => k.status === 'Tersedia').length,
    perbaikan: semuaKamar.filter((k) => k.status === 'Perbaikan').length,
  };
  const set = (id, v) => (document.querySelector(id).textContent = v);
  set('#kpi-total', n.semua); set('#kpi-terisi', n.terisi); set('#kpi-kosong', n.kosong); set('#kpi-perbaikan', n.perbaikan);
  set('#n-semua', n.semua); set('#n-terisi', n.terisi); set('#n-kosong', n.kosong); set('#n-perbaikan', n.perbaikan);
}

function render() {
  const grid = document.querySelector('#grid-kamar');
  const hasil = semuaKamar.filter((k) => {
    if (filter.tipe && k.tipe_kamar !== filter.tipe) return false;
    if (filter.status === 'Terisi' ? !terisi(k) : filter.status && k.status !== filter.status) return false;
    if (filter.q) {
      const teks = `${k.nomor_kamar} ${k.tipe_kamar} ${k.penghuni || ''}`.toLowerCase();
      if (!teks.includes(filter.q)) return false;
    }
    return true;
  });

  if (semuaKamar.length === 0) {
    grid.innerHTML = `<div class="kartu kosong-besar">
      <h3>Belum ada kamar di kos ini</h3>
      <p>Tambahkan unit kamar pertama supaya bisa tampil di katalog mahasiswa.</p>
      <a href="tambah-kamar" class="btn-biru">Tambah Kamar</a></div>`;
    return;
  }
  grid.innerHTML = hasil.length
    ? hasil.map(kartuKamar).join('')
    : '<p class="kosong">Tidak ada kamar yang cocok dengan filter.</p>';
}

function kartuKamar(k, i) {
  const status = {
    Terisi: { label: 'Terisi', kelas: 'hijau', ikon: 'status-terisi.svg', w: 11.667, h: 11.667 },
    Dipesan: { label: 'Dipesan', kelas: 'ungu', ikon: 'status-terisi.svg', w: 11.667, h: 11.667 },
    Tersedia: { label: 'Siap Huni', kelas: 'biru', ikon: 'status-siap-huni.svg', w: 10.5, h: 10.5 },
    Perbaikan: { label: 'Perbaikan', kelas: 'kuning', ikon: 'status-perbaikan.svg', w: 10.806, h: 10.515 },
  }[k.status];
  const foto = urlFoto(k.foto) || `../assets/img/${FOTO_CONTOH[i % 3]}`;
  const ukuran = k.panjang_m ? `${angkaId(k.lebar_m)} × ${angkaId(k.panjang_m)} m` : '';
  const perbaikan = k.status === 'Perbaikan';

  return `
  <article class="kartu-kamar ${perbaikan ? 'perbaikan' : ''}" data-id="${k.id}">
    <div class="kamar-media">
      <img class="kamar-foto" src="${esc(foto)}" alt="Foto kamar ${esc(k.nomor_kamar)}"
           onerror="this.onerror=null;this.src='../assets/img/${FOTO_CONTOH[i % 3]}'">
      <div class="badge-atas">
        <span class="badge-nomor">${esc(k.nomor_kamar)}</span>
        ${k.lantai != null ? `<span class="badge-lantai">Lt. ${k.lantai}</span>` : ''}
      </div>
      <span class="badge-status ${status.kelas}"><img src="../assets/img/${status.ikon}" width="${status.w}" height="${status.h}" alt="">${status.label}</span>
      <div class="badge-bawah">
        <span>${esc(k.tipe_kamar)}${ukuran ? ` • ${ukuran}` : ''}</span>
        ${k.kamar_mandi ? `<span>KM ${esc(k.kamar_mandi)}</span>` : ''}
      </div>
    </div>
    <div class="kamar-isi">
      <div>
        <p class="label-kecil">Biaya Sewa</p>
        <p class="harga-kamar"><b>${rupiah(k.harga_per_bulan)}</b><span>/bln</span></p>
      </div>
      ${perbaikan ? stripServis() : stripFasilitas(k.fasilitas)}
      ${k.penghuni ? blokPenghuni(k) : (perbaikan ? '' : blokPemeriksaan())}
      <div class="kamar-aksi">
        ${tombolUtama(k)}
        <button class="btn-ikon" data-aksi="inventaris" title="Inventaris kamar" aria-label="Inventaris kamar ${esc(k.nomor_kamar)}">${IKON_INVENTARIS}</button>
        <a href="tambah-kamar?id=${k.id}" class="btn-ikon" title="Edit / hapus kamar"><img src="../assets/img/ikon-edit.svg" width="13.5" height="13.5" alt="Edit"></a>
      </div>
    </div>
  </article>`;
}

const angkaId = (n) => Number(n).toLocaleString('id-ID', { maximumFractionDigits: 2 });

function stripFasilitas(daftar) {
  const ikon = [];
  IKON_FASILITAS.forEach(([pola, file, w, h]) => {
    if (daftar.some((f) => pola.test(f))) ikon.push(`<img src="../assets/img/${file}" width="${w}" height="${h}" alt="" title="${esc(daftar.find((f) => pola.test(f)))}">`);
  });
  return `<div class="strip-fasilitas">${ikon.join('') || '<span class="label-kecil">Belum ada fasilitas dicentang</span>'}</div>`;
}

function stripServis() {
  return `<div class="strip-fasilitas servis">
    <img src="../assets/img/ikon-servis-1.svg" width="15" height="12" alt="">
    <img src="../assets/img/ikon-servis-2.svg" width="12" height="14.25" alt="">
    <span>Servis Berkala</span>
  </div>`;
}

function blokPenghuni(k) {
  return `<div class="blok-penghuni">
    <span class="avatar-inisial">${esc(inisial(k.penghuni))}</span>
    <div><b>${esc(k.penghuni)}</b><span>${esc(k.penghuni_telepon || '')}</span></div>
  </div>`;
}

function blokPemeriksaan() {
  return `<div class="blok-pemeriksaan">
    <div><b>Pemeriksaan Unit</b>
      <span><img src="../assets/img/ikon-ceklis-kecil.svg" width="8.829" height="6.514" alt="">Lolos Standar Kebersihan</span></div>
    <img src="../assets/img/ikon-sapu.svg" width="16.5" height="20.167" alt="">
  </div>`;
}

function tombolUtama(k) {
  if (k.status === 'Perbaikan') return `<button class="btn-kartu kuning" data-aksi="selesai">Selesai Perbaikan</button>`;
  if (k.status === 'Tersedia') return `<button class="btn-kartu biru" data-aksi="perbaikan" title="Klik untuk menandai kamar sedang perbaikan">Belum Terisi</button>`;
  return `<a class="btn-kartu hijau" href="penyewa?kamar_id=${k.id}">Detail Sewa</a>`;
}

async function aksiKartu(e) {
  const btn = e.target.closest('[data-aksi]');
  if (!btn) return;
  const kartu = btn.closest('.kartu-kamar');
  const kamar = semuaKamar.find((k) => k.id === Number(kartu.dataset.id));
  if (btn.dataset.aksi === 'inventaris') return bukaInventaris(kamar);
  const kePerbaikan = btn.dataset.aksi === 'perbaikan';
  if (kePerbaikan && !confirm(`Tandai kamar ${kamar.nomor_kamar} sedang dalam perbaikan? Kamar tidak bisa dipesan sampai selesai.`)) return;

  btn.disabled = true;
  try {
    const hasil = await api(`kamar?id=${kamar.id}`, { method: 'PATCH', body: { perbaikan: kePerbaikan } });
    kamar.status = hasil.status;
    hitungKpi();
    render();
    toast(kePerbaikan ? `Kamar ${kamar.nomor_kamar} ditandai perbaikan` : `Kamar ${kamar.nomor_kamar} siap huni lagi`);
  } catch (err) {
    toast(err.message || 'Gagal mengubah status', true);
    btn.disabled = false;
  }
}

// ---------- Inventaris kamar (modal) ----------

const IKON_INVENTARIS = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 2h6v4H9zM9 11h6M9 15h4"/></svg>';
const KELAS_KONDISI = { Baik: 'hijau', 'Rusak Ringan': 'kuning', 'Rusak Berat': 'merah', Hilang: 'abu' };
let kamarInventaris = null;
let daftarInventaris = [];
let idDiubah = null; // barang yang sedang diedit di form, null = tambah baru

function pasangInventaris() {
  const modal = document.querySelector('#modal-inventaris');
  const form = document.querySelector('#form-inventaris');
  modal.addEventListener('click', (e) => { if (e.target === modal || e.target.closest('[data-tutup]')) tutupInventaris(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.classList.contains('buka')) tutupInventaris(); });
  document.querySelector('#batal-edit-inventaris').addEventListener('click', () => aturForm(null));
  form.addEventListener('submit', simpanInventaris);
  document.querySelector('#isi-inventaris').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-inv]');
    if (!btn) return;
    const barang = daftarInventaris.find((b) => b.id === Number(btn.closest('tr').dataset.id));
    if (btn.dataset.inv === 'ubah') aturForm(barang);
    if (btn.dataset.inv === 'hapus') hapusInventaris(barang, btn);
  });
}

async function bukaInventaris(kamar) {
  kamarInventaris = kamar;
  document.querySelector('#judul-inventaris').textContent = `Inventaris Kamar ${kamar.nomor_kamar}`;
  document.querySelector('#modal-inventaris').classList.add('buka');
  aturForm(null);
  const tbody = document.querySelector('#isi-inventaris');
  tbody.innerHTML = '<tr><td colspan="5" class="kosong">Memuat inventaris...</td></tr>';
  try {
    daftarInventaris = await api(`inventaris?kamar_id=${kamar.id}`);
    renderInventaris();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="kosong">${esc(err.message)}</td></tr>`;
  }
}

function tutupInventaris() {
  document.querySelector('#modal-inventaris').classList.remove('buka');
}

function renderInventaris() {
  document.querySelector('#isi-inventaris').innerHTML = daftarInventaris.map((b) => `
    <tr data-id="${b.id}">
      <td><div class="sel-utama">${esc(b.nama_barang)}</div></td>
      <td>${b.jumlah}</td>
      <td><span class="pill-status ${KELAS_KONDISI[b.kondisi] || 'abu'}">${esc(b.kondisi)}</span></td>
      <td><div class="sel-sub mt-0">${esc(b.catatan || '-')}</div></td>
      <td><div class="aksi">
        <button class="btn-abu biru" data-inv="ubah">Ubah</button>
        <button class="btn-abu text-merah" data-inv="hapus">Hapus</button>
      </div></td>
    </tr>`).join('') || '<tr><td colspan="5" class="kosong">Belum ada barang tercatat. Tambahkan lewat form di atas.</td></tr>';
}

/** Isi form untuk mengubah barang, atau kosongkan untuk menambah barang baru (barang = null). */
function aturForm(barang) {
  const form = document.querySelector('#form-inventaris');
  idDiubah = barang?.id ?? null;
  bersihkanGalatForm(form);
  form.elements.nama_barang.value = barang?.nama_barang ?? '';
  form.elements.jumlah.value = barang?.jumlah ?? 1;
  form.elements.kondisi.value = barang?.kondisi ?? 'Baik';
  form.elements.catatan.value = barang?.catatan ?? '';
  document.querySelector('#simpan-inventaris').textContent = barang ? 'Simpan Perubahan' : '+ Tambah Barang';
  document.querySelector('#batal-edit-inventaris').hidden = !barang;
  if (barang) form.elements.nama_barang.focus();
}

async function simpanInventaris(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const tombol = document.querySelector('#simpan-inventaris');
  const data = {
    nama_barang: form.elements.nama_barang.value.trim(),
    jumlah: form.elements.jumlah.value,
    kondisi: form.elements.kondisi.value,
    catatan: form.elements.catatan.value.trim(),
  };
  tombol.disabled = true;
  try {
    if (idDiubah) {
      const baru = await api(`inventaris?id=${idDiubah}`, { method: 'PUT', body: data });
      daftarInventaris = daftarInventaris.map((b) => (b.id === idDiubah ? baru : b));
      toast('Inventaris diperbarui');
    } else {
      daftarInventaris.push(await api('inventaris', { method: 'POST', body: { ...data, kamar_id: kamarInventaris.id } }));
      toast('Barang ditambahkan');
    }
    daftarInventaris.sort((a, b) => a.nama_barang.localeCompare(b.nama_barang, 'id'));
    renderInventaris();
    aturForm(null);
  } catch (err) {
    tampilGalatForm(form, err);
  } finally {
    tombol.disabled = false;
  }
}

async function hapusInventaris(barang, btn) {
  if (!confirm(`Hapus "${barang.nama_barang}" dari inventaris kamar ${kamarInventaris.nomor_kamar}?`)) return;
  btn.disabled = true;
  try {
    await api(`inventaris?id=${barang.id}`, { method: 'DELETE' });
    daftarInventaris = daftarInventaris.filter((b) => b.id !== barang.id);
    if (idDiubah === barang.id) aturForm(null);
    renderInventaris();
    toast('Barang dihapus');
  } catch (err) {
    toast(err.message, true);
    btn.disabled = false;
  }
}
