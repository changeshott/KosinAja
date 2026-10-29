// Beranda (Figma 464:2031 sebelum login, 464:1641 sesudah login): 8 kos per muat.
// Kotak cari & "Pencarian populer" menyaring daftar kos langsung di Beranda (tanpa pindah halaman).
// Filter disimpan di query string (?q=&tipe_kos=...) supaya tetap ada saat halaman di-refresh.

const PER_MUAT = 8;
const KUNCI_FILTER = ['q', 'tipe_kos', 'kecamatan', 'harga_max', 'tersedia'];
let halaman = 1;
let nomorPermintaan = 0; // cegah hasil lama menimpa hasil baru

/** Filter aktif (lihat KUNCI_FILTER). Urutan dibaca dari <select id="urut">. */
const filter = {};

document.addEventListener('DOMContentLoaded', async () => {
  // Pasang semua event dulu supaya kotak cari langsung bisa dipakai, baru muat data akun
  const grid = document.querySelector('#grid-kos');
  pasangFavorit(grid);
  isiDariUrl();

  const input = document.querySelector('#q');
  document.querySelector('#form-cari').addEventListener('submit', (e) => {
    e.preventDefault();
    CariLangsung.tutup();
    CariLangsung.simpanRiwayat(input.value);
    cari(input.value);
    document.querySelector('#daftar-kos').scrollIntoView({ behavior: 'smooth' });
  });
  CariLangsung.pasang({
    filterSaran: () => { const { q, ...lain } = filter; return lain; },
    saatKosong: () => { if (filter.q) cari(''); },
    saatPilihLokasi: (kecamatan) => {
      delete filter.q;
      filter.kecamatan = kecamatan;
      terapkan();
      document.querySelector('#daftar-kos').scrollIntoView({ behavior: 'smooth' });
    },
  });

  document.querySelector('#pintasan').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-kunci]');
    if (!chip) return;
    e.preventDefault();
    toggleChip(chip.dataset.kunci, chip.dataset.nilai);
  });

  document.querySelector('#urut').addEventListener('change', () => { syncChip(); terapkan(); });
  // Tombol × di chip filter aktif dan tombol di tampilan "tidak ditemukan"
  const hapus = (e) => {
    const b = e.target.closest('[data-hapus]');
    if (b) hapusFilter(b.dataset.hapus);
  };
  document.querySelector('#filter-aktif').addEventListener('click', hapus);
  grid.addEventListener('click', hapus);
  document.querySelector('#muat-lagi').addEventListener('click', () => { halaman++; muat(true); });

  await Situs.mulai();
  muat();
});

function cari(teks) {
  const q = teks.trim();
  if ((filter.q || '') === q) return;
  if (q) filter.q = q; else delete filter.q;
  terapkan();
}

/** Chip "Dekat Kampus" mengatur urutan; chip lain menyalakan/mematikan filter. */
function toggleChip(kunci, nilai) {
  const urut = document.querySelector('#urut');
  if (kunci === 'urut') {
    urut.value = urut.value === nilai ? 'rating' : nilai;
  } else if (filter[kunci] === nilai) {
    delete filter[kunci];
  } else {
    filter[kunci] = nilai; // Putra & Putri sama-sama tipe_kos, jadi otomatis saling menggantikan
  }
  syncChip();
  terapkan();
}

function hapusFilter(kunci) {
  if (kunci === 'semua') {
    Object.keys(filter).forEach((k) => delete filter[k]);
    document.querySelector('#urut').value = 'rating';
  } else if (kunci === 'urut') {
    document.querySelector('#urut').value = 'rating';
  } else {
    delete filter[kunci];
  }
  if (!filter.q) document.querySelector('#q').value = '';
  CariLangsung.tutup();
  syncChip();
  terapkan();
}

function syncChip() {
  const urut = document.querySelector('#urut').value;
  document.querySelectorAll('#pintasan [data-kunci]').forEach((chip) => {
    const { kunci, nilai } = chip.dataset;
    const aktif = kunci === 'urut' ? urut === nilai : filter[kunci] === nilai;
    chip.setAttribute('aria-pressed', aktif);
  });
}

/** Query string -> filter + isian form. */
function isiDariUrl() {
  const p = new URLSearchParams(location.search);
  KUNCI_FILTER.forEach((k) => { if (p.get(k)) filter[k] = p.get(k); });
  document.querySelector('#q').value = filter.q || '';
  const urut = document.querySelector('#urut');
  if ([...urut.options].some((o) => o.value === p.get('urut'))) urut.value = p.get('urut');
  syncChip();
}

function parameter() {
  const p = new URLSearchParams(filter);
  const urut = document.querySelector('#urut').value;
  if (urut !== 'rating') p.set('urut', urut);
  return p;
}

/** Filter berubah: simpan ke URL, lalu muat ulang dari halaman pertama. */
function terapkan() {
  const qs = parameter().toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
  halaman = 1;
  muat();
}

/** [kunci, label] untuk setiap filter yang sedang aktif. */
function daftarFilterAktif() {
  const chip = [];
  if (filter.q) chip.push(['q', `"${filter.q}"`]);
  if (filter.tipe_kos) chip.push(['tipe_kos', `Kos ${LABEL_TIPE[filter.tipe_kos] || filter.tipe_kos}`]);
  if (filter.kecamatan) chip.push(['kecamatan', filter.kecamatan]);
  if (filter.harga_max) chip.push(['harga_max', `Maks. ${rupiah(filter.harga_max)}`]);
  if (filter.tersedia) chip.push(['tersedia', 'Ada kamar kosong']);
  const urut = document.querySelector('#urut');
  if (urut.value !== 'rating') chip.push(['urut', urut.selectedOptions[0].textContent]);
  return chip;
}

const SVG_SILANG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M6 6l12 12M18 6 6 18"/></svg>';

function renderChipAktif(chip) {
  const p = parameter();
  document.querySelector('#filter-aktif').innerHTML = chip.length
    ? '<span>Filter aktif:</span>' +
      chip.map(([k, label]) => `<button type="button" class="chip-filter" data-hapus="${k}" title="Hapus filter ini">${esc(label)} ${SVG_SILANG}</button>`).join('') +
      '<button type="button" class="btn-reset" data-hapus="semua">Hapus semua</button>' +
      `<a class="link-katalog" href="katalog?${p}">Filter lengkap di Katalog ${SVG_S.panah}</a>`
    : '';
}

/** Tampilan saat hasil kosong: tawarkan langkah berikutnya, bukan sekadar teks. */
function tampilanKosong(chip) {
  if (!chip.length) {
    return '<div class="kosong-situs"><b>Belum ada kos</b>Kos yang sudah dipublikasikan pemilik akan tampil di sini.</div>';
  }
  const tombol = chip.filter(([k]) => k !== 'urut').slice(0, 3)
    .map(([k, label]) => `<button type="button" class="btn-garis" data-hapus="${k}">Hapus ${esc(label)}</button>`).join('');
  return `
    <div class="kosong-situs kosong-bantu">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M8.5 8.5l5 5M13.5 8.5l-5 5"/></svg>
      <b>Kos tidak ditemukan</b>
      ${filter.q ? `Tidak ada kos yang cocok dengan "${esc(filter.q)}". Periksa ejaan atau coba nama jalan/kecamatan.` : 'Tidak ada kos yang cocok dengan semua filter ini.'}
      <div class="kosong-aksi">
        ${tombol}
        <button type="button" class="btn-utama" data-hapus="semua">Tampilkan semua kos</button>
      </div>
    </div>`;
}

async function muat(tambah = false) {
  const grid = document.querySelector('#grid-kos');
  const tombol = document.querySelector('#muat-lagi');
  const nomor = ++nomorPermintaan;
  const p = parameter();
  const chip = daftarFilterAktif();

  renderChipAktif(chip);
  tombol.disabled = true;
  grid.setAttribute('aria-busy', 'true');
  // Skeleton: kartu abu-abu selama data dimuat
  if (tambah) {
    grid.insertAdjacentHTML('beforeend', kerangkaKartu(4));
  } else {
    grid.innerHTML = kerangkaKartu(PER_MUAT);
  }

  try {
    p.set('page', halaman);
    p.set('per_page', PER_MUAT);
    const hasil = await api(`katalog?${p}`);
    if (nomor !== nomorPermintaan) return;

    const awal = (halaman - 1) * PER_MUAT;
    const html = hasil.items.map((k, i) => kartuKos(k, awal + i)).join('');
    grid.querySelectorAll('.kerangka').forEach((el) => el.remove());
    if (tambah) {
      grid.insertAdjacentHTML('beforeend', html);
    } else {
      grid.innerHTML = html || tampilanKosong(chip);
    }

    const tampil = Math.min(halaman * PER_MUAT, hasil.total);
    const sisa = chip.length ? 'kos sesuai filter' : 'kos siap huni';
    document.querySelector('#info-jumlah').textContent = filter.q
      ? `Ditemukan ${hasil.total} kos untuk "${filter.q}"${hasil.total ? `, menampilkan ${tampil}` : ''}`
      : `Menampilkan ${tampil} dari ${hasil.total} ${sisa}`;
    tombol.hidden = tampil >= hasil.total;
  } catch (err) {
    if (nomor !== nomorPermintaan) return;
    grid.querySelectorAll('.kerangka').forEach((el) => el.remove());
    if (tambah) {
      toast(err.message, true);
    } else {
      grid.innerHTML = `<div class="kosong-situs"><b>Gagal memuat</b>${esc(err.message)}</div>`;
    }
  } finally {
    if (nomor === nomorPermintaan) {
      tombol.disabled = false;
      grid.removeAttribute('aria-busy');
    }
  }
}
