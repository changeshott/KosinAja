// Kerangka panel pengelola: sidebar, header, cek login, dan pilihan kos aktif.
// Halaman cukup punya <aside id="sidebar"></aside> dan <header id="topbar"></header>,
// lalu <body data-halaman="kamar" data-judul="Kelola Kamar & Unit">.

const MENU_PENGELOLA = [
  { id: 'dashboard', label: 'Dashboard', href: './' },
  { id: 'tambah-kamar', label: 'Tambah Kamar', href: 'tambah-kamar' },
  { id: 'reservasi', label: 'Pengajuan Reservasi', href: 'reservasi' },
  { id: 'kamar', label: 'Kelola Kamar & Unit', href: 'kamar' },
  { id: 'penyewa', label: 'Kelola Penyewa', href: 'penyewa' },
  { id: 'ulasan', label: 'Ulasan Penghuni', href: 'ulasan' },
  { id: 'profil', label: 'Profil Saya', href: 'profil' },
];

const Panel = {
  admin: null,
  properti: [],
  kosId: null,

  /**
   * Dipanggil sekali di awal setiap halaman. Mengembalikan false kalau belum login
   * (halaman langsung dialihkan ke Login Pemilik).
   */
  async mulai({ butuhKos = true } = {}) {
    const halaman = document.body.dataset.halaman;
    const judul = document.body.dataset.judul;
    renderSidebar(halaman);
    renderTopbar(judul);

    const akun = await akunSaya();
    if (!akun || akun.role !== 'admin') {
      location.href = `${FRONTEND}masuk-pemilik?kembali=${encodeURIComponent(location.pathname + location.search)}`;
      return false;
    }
    this.admin = akun;
    document.querySelector('#nama-admin').textContent = akun.nama_lengkap;

    this.properti = await api('kos');
    if (butuhKos && this.properti.length === 0) {
      // Pemilik baru belum punya kos: arahkan ke onboarding
      location.href = 'onboarding';
      return false;
    }
    this.kosId = pilihKosAwal(this.properti);
    renderPilihKos(this.properti, this.kosId);
    return true;
  },

  /** Simpan pilihan kos supaya halaman lain ikut memakai kos yang sama. */
  gantiKos(id) {
    this.kosId = id;
    try { localStorage.setItem('kosinaja.kosAktif', String(id)); } catch { /* mode privat */ }
    const url = new URL(location.href);
    url.searchParams.set('kos_id', id);
    history.replaceState(null, '', url);
  },

  kos() {
    return this.properti.find((p) => p.id === this.kosId) || null;
  },
};

function pilihKosAwal(properti) {
  const ids = properti.map((p) => p.id);
  const dariUrl = Number(new URLSearchParams(location.search).get('kos_id'));
  let tersimpan = null;
  try { tersimpan = Number(localStorage.getItem('kosinaja.kosAktif')); } catch { /* abaikan */ }
  const id = [dariUrl, tersimpan].find((x) => ids.includes(x)) ?? ids[0] ?? null;
  if (id) Panel.gantiKos(id);
  return id;
}

function renderSidebar(aktif) {
  const el = document.querySelector('#sidebar');
  if (!el) return;
  el.className = 'sidebar';
  el.innerHTML = `
    <div class="sidebar-atas">
      <a href="./" class="brand">
        <span class="brand-lambang"><img src="${ASET}/logo-rumah.svg" width="24" height="24" alt=""></span>
        <span class="brand-teks"><b>KosinAja</b><small>STUDENT LIVING</small></span>
      </a>
      <p class="menu-label">MENU PENGELOLA</p>
      <nav class="menu">
        ${MENU_PENGELOLA.map((m) => `<a href="${m.href}" class="${m.id === aktif ? 'aktif' : ''}">${esc(m.label)}</a>`).join('')}
      </nav>
      ${document.body.hasAttribute('data-gedung') ? `<img class="sidebar-gedung" src="${ASET}/gedung-kos.png" alt="">` : ''}
    </div>
    <div class="sidebar-bawah">
      <a href="${FRONTEND}" class="kartu-beranda" id="tombol-keluar">
        <span class="titik-hijau"></span>
        <span class="teks">Beranda<small>Logout</small></span>
        <img src="${ASET}/ikon-chevron-kanan.svg" width="6.36" height="11.32" alt="">
      </a>
    </div>`;
  el.querySelector('#tombol-keluar').addEventListener('click', (e) => {
    e.preventDefault();
    keluar(`${FRONTEND}`);
  });
}

function renderTopbar(judul) {
  const el = document.querySelector('#topbar');
  if (!el) return;
  el.className = 'topbar';
  el.innerHTML = `
    <div class="topbar-kiri">
      <span class="pill-halaman">${esc(judul)}</span>
      <label class="pilih-kos" hidden>
        <span class="sr-only">Properti aktif</span>
        <select id="pilih-kos-header"></select>
      </label>
    </div>
    <a class="profil" href="profil" title="Profil Saya">
      <span class="garis-tegak"></span>
      <div class="nama"><span id="nama-admin">...</span><small>Pemilik Kos</small></div>
      <span class="avatar-admin"><img src="${ASET}/ikon-akun.svg" width="12" height="12" alt=""></span>
    </a>`;
}

/** Dropdown kos di header hanya muncul kalau pemilik punya lebih dari satu kos. */
function renderPilihKos(properti, kosId) {
  const label = document.querySelector('.pilih-kos');
  if (!label || properti.length < 2) return;
  const select = label.querySelector('select');
  select.innerHTML = properti
    .map((p) => `<option value="${p.id}" ${p.id === kosId ? 'selected' : ''}>${esc(p.nama_kos)}</option>`)
    .join('');
  label.hidden = false;
  select.addEventListener('change', () => {
    Panel.gantiKos(Number(select.value));
    document.dispatchEvent(new CustomEvent('kos-berganti', { detail: Panel.kosId }));
  });
}
