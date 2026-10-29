// Katalog Kos (Figma 464:829) + Filter Dropdown versi layar kecil (464:1612).
// Semua filter disimpan di query string supaya hasil bisa dibagikan dan tombol Back tetap benar.
// Filter langsung diterapkan saat diubah (harga ditunda sebentar sampai selesai mengetik);
// di layar kecil panel filter jadi lembar bawah dengan tombol "Lihat N kos".

const PER_HALAMAN = 9;
const KUNCI_FILTER = ['q', 'harga_min', 'harga_max', 'tipe_kos', 'kecamatan', 'fasilitas', 'tersedia'];
const TUNDA_HARGA = 600;
let nomorMuat = 0; // cegah hasil lama menimpa hasil baru
let pengendali = null; // AbortController request katalog yang sedang berjalan
let tundaHarga;
let opsi = { fasilitas: [], kecamatan: [], harga: {} };
const namaFasilitas = {};

document.addEventListener('DOMContentLoaded', async () => {
  // Pasang event dulu supaya halaman langsung responsif, data akun & opsi filter dimuat bersamaan
  const grid = document.querySelector('#grid-kos');
  const panel = document.querySelector('#panel-filter');
  const input = document.querySelector('#q');
  pasangFavorit(grid);

  document.querySelector('#form-cari').addEventListener('submit', (e) => {
    e.preventDefault();
    CariLangsung.tutup();
    CariLangsung.simpanRiwayat(input.value);
    terapkan({ riwayat: true, cari: true });
  });
  CariLangsung.pasang({
    filterSaran: () => paramFilter({ tanpa: ['q', 'urut'] }),
    saatKosong: () => { if (new URLSearchParams(location.search).get('q')) terapkan({ riwayat: true, cari: true }); },
    saatPilihLokasi: (kecamatan) => {
      panel.elements.kecamatan.value = kecamatan;
      terapkan({ riwayat: true, cari: true }); // kotak cari sudah dikosongkan -> kata kunci lama ikut hilang
    },
  });

  // Filter langsung diterapkan: radio/checkbox/select saat berubah, harga setelah berhenti mengetik
  panel.addEventListener('change', (e) => {
    if (e.target.matches('[name="harga_min"], [name="harga_max"]')) return;
    terapkan();
  });
  panel.addEventListener('input', (e) => {
    if (!e.target.matches('[name="harga_min"], [name="harga_max"]')) return;
    const n = e.target.value.replace(/\D/g, '').slice(0, 9);
    e.target.value = n ? Number(n).toLocaleString('id-ID') : '';
    clearTimeout(tundaHarga);
    tundaHarga = setTimeout(() => { if (hargaValid()) terapkan(); }, TUNDA_HARGA);
  });
  document.querySelector('#preset-harga').addEventListener('click', (e) => {
    const b = e.target.closest('[data-max]');
    if (!b) return;
    const aktif = b.getAttribute('aria-pressed') === 'true';
    const ribuan = (v) => (v && !aktif ? Number(v).toLocaleString('id-ID') : '');
    panel.elements.harga_min.value = ribuan(b.dataset.min);
    panel.elements.harga_max.value = ribuan(b.dataset.max);
    hargaValid();
    terapkan();
  });
  panel.addEventListener('submit', (e) => {
    e.preventDefault();
    clearTimeout(tundaHarga);
    if (!hargaValid()) return;
    terapkan();
    tutupPanelHp();
  });

  document.querySelector('#reset-filter').addEventListener('click', () => {
    const q = new URLSearchParams(location.search).get('q');
    history.pushState(null, '', q ? `?q=${encodeURIComponent(q)}` : location.pathname);
    isiDariUrl();
    muat();
  });
  document.querySelector('#urut').addEventListener('change', () => terapkan());
  document.querySelector('#btn-filter-hp').addEventListener('click', bukaPanelHp);
  document.querySelector('#tutup-filter').addEventListener('click', tutupPanelHp);
  document.querySelector('#latar-filter').addEventListener('click', tutupPanelHp);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel.classList.contains('buka')) tutupPanelHp();
  });
  document.querySelector('#filter-aktif').addEventListener('click', hapusSatuFilter);
  grid.addEventListener('click', hapusSatuFilter); // tombol di tampilan "tidak ditemukan"
  document.querySelector('#paginasi').addEventListener('click', (e) => {
    const b = e.target.closest('[data-hal]');
    if (!b || b.disabled) return;
    terapkan({ page: Number(b.dataset.hal), riwayat: true });
    const atas = document.querySelector('.tata-katalog').getBoundingClientRect().top + scrollY - 96;
    window.scrollTo({ top: atas, behavior: 'smooth' });
  });
  window.addEventListener('popstate', () => { isiDariUrl(); muat(); });

  isiDariUrl(); // isian dasar (q, harga, jenis, urut) sudah bisa diisi sebelum opsi dimuat
  muat();
  const [, hasilOpsi] = await Promise.allSettled([Situs.mulai(), api('katalog?opsi=1')]);
  if (hasilOpsi.status === 'fulfilled') opsi = hasilOpsi.value; // tanpa opsi, filter dasar tetap bisa dipakai
  renderOpsi();
  isiDariUrl();
  renderChip(); // label fasilitas baru diketahui setelah opsi dimuat
});

function renderOpsi() {
  document.querySelector('#f-kecamatan').insertAdjacentHTML('beforeend',
    opsi.kecamatan.map((k) => `<option>${esc(k)}</option>`).join(''));
  // Fasilitas dikelompokkan per kategori (Kamar Tidur, Kamar Mandi, Bersama, ...)
  document.querySelector('#f-fasilitas').innerHTML = opsi.fasilitas.map((g) => `
    <div class="sub-filter">${esc(g.kategori.replace(/^Fasilitas\s+/i, ''))}</div>
    ${g.items.map((f) => {
      namaFasilitas[f.id] = f.nama_fasilitas;
      return `<label class="cek-filter"><input type="checkbox" name="fasilitas" value="${f.id}"> ${esc(f.nama_fasilitas)}</label>`;
    }).join('')}`).join('');
  if (opsi.harga.min) {
    document.querySelector('#petunjuk-harga').textContent = `Kisaran di katalog: ${rupiah(opsi.harga.min)} - ${rupiah(opsi.harga.max)}`;
  }
}

/** Query string -> isian form. */
function isiDariUrl() {
  const p = new URLSearchParams(location.search);
  const form = document.querySelector('#panel-filter');
  const ribuan = (v) => (v ? Number(v).toLocaleString('id-ID') : '');
  document.querySelector('#q').value = p.get('q') || '';
  form.elements.harga_min.value = ribuan(p.get('harga_min'));
  form.elements.harga_max.value = ribuan(p.get('harga_max'));
  const tipe = form.querySelector(`[name="tipe_kos"][value="${CSS.escape(p.get('tipe_kos') || '')}"]`);
  (tipe || form.querySelector('[name="tipe_kos"][value=""]')).checked = true;
  form.elements.kecamatan.value = p.get('kecamatan') || '';
  const fas = (p.get('fasilitas') || '').split(',');
  form.querySelectorAll('[name="fasilitas"]').forEach((c) => { c.checked = fas.includes(c.value); });
  form.elements.tersedia.checked = p.get('tersedia') === '1';
  document.querySelector('#urut').value = p.get('urut') || 'rating';
  hargaValid();
}

const angka = (v) => (v || '').replace(/\D/g, '');

/**
 * Isian form -> parameter filter (tanpa page).
 * Kata kunci diambil dari kotak cari hanya saat pencarian dikirim (cari: true); perubahan filter lain
 * memakai kata kunci yang sedang aktif di URL, supaya ketikan yang belum di-Enter tidak ikut terpakai.
 */
function paramFilter({ tanpa = [], cari = false } = {}) {
  const form = document.querySelector('#panel-filter');
  const p = new URLSearchParams();
  const set = (k, v) => { if (v && !tanpa.includes(k)) p.set(k, v); };
  set('q', cari ? document.querySelector('#q').value.trim() : new URLSearchParams(location.search).get('q'));
  set('harga_min', angka(form.elements.harga_min.value));
  set('harga_max', angka(form.elements.harga_max.value));
  set('tipe_kos', form.querySelector('[name="tipe_kos"]:checked')?.value);
  set('kecamatan', form.elements.kecamatan.value);
  set('fasilitas', [...form.querySelectorAll('[name="fasilitas"]:checked')].map((c) => c.value).join(','));
  set('tersedia', form.elements.tersedia.checked ? '1' : '');
  const urut = document.querySelector('#urut').value;
  if (urut !== 'rating' && !tanpa.includes('urut')) p.set('urut', urut);
  return p;
}

/**
 * Isian form -> query string, lalu muat ulang hasil.
 * riwayat: true = entri baru di tombol Back (cari, pindah halaman); centang filter cukup mengganti URL.
 * cari: true = kata kunci diambil dari kotak cari (submit pencarian).
 */
function terapkan({ page = 1, riwayat = false, cari = false } = {}) {
  const p = paramFilter({ cari });
  if (page > 1) p.set('page', page);
  const url = p.toString() ? `?${p}` : location.pathname;
  if (url === location.search || (url === location.pathname && !location.search)) return muat();
  history[riwayat ? 'pushState' : 'replaceState'](null, '', url);
  muat();
}

/** Minimum tidak boleh lebih besar dari maksimum. Menandai isian & menyalakan preset yang cocok. */
function hargaValid() {
  const form = document.querySelector('#panel-filter');
  const min = Number(angka(form.elements.harga_min.value)) || 0;
  const max = Number(angka(form.elements.harga_max.value)) || 0;
  const salah = max > 0 && min > max;
  const galat = document.querySelector('#galat-harga');
  galat.hidden = !salah;
  galat.textContent = salah ? 'Harga minimum lebih besar dari maksimum.' : '';
  form.elements.harga_min.closest('label').classList.toggle('salah', salah);
  form.elements.harga_max.closest('label').classList.toggle('salah', salah);
  document.querySelectorAll('#preset-harga [data-max]').forEach((b) => {
    b.setAttribute('aria-pressed', String(Number(b.dataset.min || 0) === min && Number(b.dataset.max || 0) === max && (min || max) > 0));
  });
  return !salah;
}

async function muat() {
  const p = new URLSearchParams(location.search);
  if (!p.get('urut')) p.set('urut', 'rating');
  p.set('per_page', PER_HALAMAN);
  const grid = document.querySelector('#grid-kos');
  const nomor = ++nomorMuat;
  pengendali?.abort(); // batalkan request lama, tidak perlu ditunggu
  pengendali = new AbortController();
  grid.innerHTML = kerangkaKartu(PER_HALAMAN);
  grid.setAttribute('aria-busy', 'true');
  document.querySelector('#tombol-lihat').textContent = 'Memuat...';
  const chip = renderChip();
  try {
    const hasil = await api(`katalog?${p}`, { signal: pengendali.signal });
    if (nomor !== nomorMuat) return;
    const jmlHal = Math.max(1, Math.ceil(hasil.total / PER_HALAMAN));
    if (hasil.page > jmlHal) return terapkan({ page: jmlHal }); // ?page= lebih besar dari jumlah halaman

    const dari = (hasil.page - 1) * PER_HALAMAN + 1;
    const sampai = dari + hasil.items.length - 1;
    document.querySelector('#jumlah-hasil').textContent = `${hasil.total} kos ditemukan`;
    document.querySelector('#rentang-hasil').textContent = jmlHal > 1
      ? `Menampilkan ${dari}-${sampai} dari ${hasil.total} kos di sekitar kampus Malang`
      : 'di sekitar kampus Malang';
    document.querySelector('#tombol-lihat').textContent = hasil.total ? `Lihat ${hasil.total} kos` : 'Tidak ada hasil';
    grid.innerHTML = hasil.items.map((k, i) => kartuKos(k, dari - 1 + i)).join('') || tampilanKosong(chip);
    renderPaginasi(hasil.page, jmlHal);
  } catch (err) {
    if (err.name === 'AbortError' || nomor !== nomorMuat) return;
    grid.innerHTML = `<div class="kosong-situs"><b>Gagal memuat katalog</b>${esc(err.message)}</div>`;
    document.querySelector('#tombol-lihat').textContent = 'Lihat hasil';
  } finally {
    if (nomor === nomorMuat) grid.removeAttribute('aria-busy');
  }
}

/** Hasil kosong: tawarkan tombol untuk melonggarkan filter, bukan sekadar teks. */
function tampilanKosong(chip) {
  const p = new URLSearchParams(location.search);
  const tombol = chip.slice(0, 3)
    .map(([k, label]) => `<button type="button" class="btn-garis" data-hapus="${esc(k)}">Hapus ${esc(label)}</button>`).join('');
  return `
    <div class="kosong-situs kosong-bantu">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M8.5 8.5l5 5M13.5 8.5l-5 5"/></svg>
      <b>Tidak ada kos yang cocok</b>
      ${p.get('q') ? `Tidak ada hasil untuk "${esc(p.get('q'))}" dengan filter ini. Periksa ejaan atau longgarkan filter.` : 'Coba longgarkan rentang harga atau kurangi fasilitas yang dicentang.'}
      ${chip.length ? `<div class="kosong-aksi">${tombol}<button type="button" class="btn-utama" data-hapus="semua">Hapus semua filter</button></div>` : ''}
    </div>`;
}

function renderChip() {
  const p = new URLSearchParams(location.search);
  const chip = [];
  if (p.get('q')) chip.push(['q', `"${p.get('q')}"`]);
  if (p.get('harga_min') || p.get('harga_max')) {
    chip.push(['harga', `${rupiah(p.get('harga_min') || 0)} - ${p.get('harga_max') ? rupiah(p.get('harga_max')) : 'maks'}`]);
  }
  if (p.get('tipe_kos')) chip.push(['tipe_kos', LABEL_TIPE[p.get('tipe_kos')] || p.get('tipe_kos')]);
  if (p.get('kecamatan')) chip.push(['kecamatan', p.get('kecamatan')]);
  (p.get('fasilitas') || '').split(',').filter(Boolean).forEach((id) => chip.push([`fasilitas:${id}`, namaFasilitas[id] || 'Fasilitas']));
  if (p.get('tersedia')) chip.push(['tersedia', 'Ada kamar kosong']);

  document.querySelector('#filter-aktif').innerHTML = chip.length
    ? '<span>Filter aktif:</span>' + chip.map(([k, label]) =>
      `<button type="button" class="chip-filter" data-hapus="${esc(k)}" title="Hapus filter ini">${esc(label)} <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M6 6l12 12M18 6 6 18"/></svg></button>`).join('') +
      '<button type="button" class="btn-reset" data-hapus="semua">Hapus filter</button>'
    : '';

  // Lencana jumlah filter di tombol "Filter" (layar kecil); kata kunci tidak dihitung
  const jml = chip.filter(([k]) => k !== 'q').length;
  const lencana = document.querySelector('#lencana-filter');
  lencana.hidden = !jml;
  lencana.textContent = jml;
  return chip;
}

function hapusSatuFilter(e) {
  const b = e.target.closest('[data-hapus]');
  if (!b) return;
  const k = b.dataset.hapus;
  const p = new URLSearchParams(location.search);
  if (k === 'semua') {
    KUNCI_FILTER.forEach((x) => p.delete(x));
  } else if (k === 'harga') {
    p.delete('harga_min'); p.delete('harga_max');
  } else if (k.startsWith('fasilitas:')) {
    const sisa = p.get('fasilitas').split(',').filter((id) => id !== k.split(':')[1]);
    sisa.length ? p.set('fasilitas', sisa.join(',')) : p.delete('fasilitas');
  } else {
    p.delete(k);
  }
  p.delete('page');
  history.pushState(null, '', p.toString() ? `?${p}` : location.pathname);
  isiDariUrl();
  muat();
}

/** 1 … 4 5 [6] 7 8 … 20: halaman pertama & terakhir selalu tampil. */
function renderPaginasi(hal, jml) {
  const nav = document.querySelector('#paginasi');
  if (jml <= 1) { nav.innerHTML = ''; return; }
  const nomor = new Set([1, jml]);
  for (let i = Math.max(1, hal - 2); i <= Math.min(jml, hal + 2); i++) nomor.add(i);
  const urut = [...nomor].sort((a, b) => a - b);
  let html = `<button data-hal="${hal - 1}" ${hal === 1 ? 'disabled' : ''} aria-label="Halaman sebelumnya">‹</button>`;
  urut.forEach((i, idx) => {
    if (idx && i - urut[idx - 1] > 1) html += '<span class="elipsis" aria-hidden="true">…</span>';
    html += `<button data-hal="${i}" class="${i === hal ? 'aktif' : ''}" ${i === hal ? 'aria-current="page"' : ''} aria-label="Halaman ${i}">${i}</button>`;
  });
  html += `<button data-hal="${hal + 1}" ${hal === jml ? 'disabled' : ''} aria-label="Halaman berikutnya">›</button>`;
  nav.innerHTML = html;
}

// ---------- Panel filter versi layar kecil (lembar bawah) ----------

function bukaPanelHp() {
  document.querySelector('#panel-filter').classList.add('buka');
  document.querySelector('#latar-filter').hidden = false;
  document.querySelector('#btn-filter-hp').setAttribute('aria-expanded', 'true');
  document.body.classList.add('kunci-gulir');
}

function tutupPanelHp() {
  document.querySelector('#panel-filter').classList.remove('buka');
  document.querySelector('#latar-filter').hidden = true;
  document.querySelector('#btn-filter-hp').setAttribute('aria-expanded', 'false');
  document.body.classList.remove('kunci-gulir');
}
