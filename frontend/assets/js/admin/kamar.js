// Kelola Kamar & Unit (Figma 464:4305). Data dari GET api/kamar?kos_id=..., filter di sisi browser
// karena satu kos paling banyak puluhan kamar. Status perbaikan dikelola langsung dari kartu kamar.

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
  document.querySelector('#form-perbaikan').addEventListener('submit', simpanPerbaikan);
  document.querySelector('#modal-perbaikan').addEventListener('click', (e) => {
    if (e.target.id === 'modal-perbaikan' || e.target.closest('[data-batal-perbaikan]')) tutupPerbaikan();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') tutupPerbaikan();
  });
  document.addEventListener('kos-berganti', muat);
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
      ${perbaikan ? stripServis(k) : stripFasilitas(k.fasilitas)}
      ${k.penghuni ? blokPenghuni(k) : (perbaikan ? '' : blokPemeriksaan())}
      <div class="kamar-aksi">
        ${tombolUtama(k)}
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

function stripServis(k) {
  return `<div class="strip-fasilitas servis">
    <img src="../assets/img/ikon-servis-1.svg" width="15" height="12" alt="">
    <img src="../assets/img/ikon-servis-2.svg" width="12" height="14.25" alt="">
    <span>${esc(k.jenis_perbaikan || 'Perbaikan aktif')}${k.catatan_perbaikan ? `: ${esc(k.catatan_perbaikan)}` : ''}</span>
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
  const aksiPerbaikan = `<button class="btn-kartu biru" data-aksi="perbaikan" title="Tandai kamar sedang diperbaiki">Mulai Perbaikan</button>`;
  if (terisi(k)) return `<a class="btn-kartu hijau" href="penyewa?kamar_id=${k.id}">Detail Sewa</a>${aksiPerbaikan}`;
  return aksiPerbaikan;
}

async function aksiKartu(e) {
  const btn = e.target.closest('[data-aksi]');
  if (!btn) return;
  const kartu = btn.closest('.kartu-kamar');
  const kamar = semuaKamar.find((k) => k.id === Number(kartu.dataset.id));
  const kePerbaikan = btn.dataset.aksi === 'perbaikan';
  if (kePerbaikan) {
    document.querySelector('#judul-perbaikan').textContent = `Mulai Perbaikan Kamar ${kamar.nomor_kamar}`;
    document.querySelector('#form-perbaikan').dataset.kamarId = kamar.id;
    document.querySelector('#form-perbaikan').reset();
    document.querySelector('#modal-perbaikan').classList.add('buka');
    return;
  }

  btn.disabled = true;
  try {
    await simpanStatusPerbaikan(kamar, false);
  } catch (err) {
    toast(err.message || 'Gagal mengubah status', true);
    btn.disabled = false;
  }
}

function tutupPerbaikan() {
  document.querySelector('#modal-perbaikan').classList.remove('buka');
}

async function simpanPerbaikan(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const tombol = document.querySelector('#simpan-perbaikan');
  const kamar = semuaKamar.find((k) => k.id === Number(form.dataset.kamarId));
  tombol.disabled = true;
  try {
    const hasil = await api(`kamar?id=${kamar.id}`, {
      method: 'PATCH',
      body: {
        perbaikan: true,
        jenis_perbaikan: form.elements.jenis_perbaikan.value,
        catatan: form.elements.catatan.value.trim(),
      },
    });
    kamar.status = hasil.status;
    hitungKpi();
    render();
    tutupPerbaikan();
    toast(`Perbaikan kamar ${kamar.nomor_kamar} dicatat`);
  } catch (err) {
    toast(err.message || 'Gagal mencatat perbaikan', true);
  } finally {
    tombol.disabled = false;
  }
}

async function simpanStatusPerbaikan(kamar, perbaikan) {
  const hasil = await api(`kamar?id=${kamar.id}`, { method: 'PATCH', body: { perbaikan } });
  kamar.status = hasil.status;
  hitungKpi();
  render();
  toast(perbaikan ? `Kamar ${kamar.nomor_kamar} ditandai perbaikan` : `Kamar ${kamar.nomor_kamar} siap huni lagi`);
}
