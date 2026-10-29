// Kerangka halaman penyewa: header + menu akun, footer, kartu kos, dan tombol favorit.
// Halaman cukup punya <header id="kepala"></header>, <footer id="kaki"></footer>, dan <body data-halaman="beranda">.

const MENU_SITUS = [
  { id: 'beranda', label: 'Beranda', href: '' },
  { id: 'katalog', label: 'Katalog Kos', href: 'katalog' },
  { id: 'tentang', label: 'Tentang Kami', href: 'tentang' },
  { id: 'bantuan', label: 'Bantuan', href: 'bantuan' },
];
const LABEL_TIPE = { pria: 'Putra', wanita: 'Putri', campuran: 'Campur' };
const FOTO_CADANGAN = ['kamar-1.jpg', 'contoh-galeri-1.jpg', 'kamar-2.jpg', 'contoh-galeri-3.jpg'];

const SVG_S = {
  rumah: '<svg width="24" height="24" viewBox="0 0 24 24" fill="#004ac6"><path d="M12 3 2 11h3v9h5v-6h4v6h5v-9h3z"/></svg>',
  cari: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  hati: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>',
  panah: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12h14M13 5l7 7-7 7"/></svg>',
  pin: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  dokumen: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>',
  keluar: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>',
  panel: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>',
  garis3: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
  bawah: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>',
  orang: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>',
};

const Situs = {
  akun: null,

  /** Dipanggil di awal setiap halaman penyewa. */
  async mulai() {
    this.akun = await akunSaya();
    renderKepalaSitus(this.akun);
    renderKakiSitus();
    return this.akun;
  },

  /** Arahkan ke login penyewa lalu kembali ke halaman ini. */
  mintaMasuk(pesan) {
    if (pesan) toast(pesan);
    setTimeout(() => {
      location.href = `${FRONTEND}masuk?kembali=${encodeURIComponent(location.pathname + location.search)}`;
    }, pesan ? 700 : 0);
  },
};

function renderKepalaSitus(akun) {
  const aktif = document.body.dataset.halaman;
  const el = document.querySelector('#kepala');
  el.className = 'kepala-situs';
  el.innerHTML = `
    <div class="wadah">
      <a href="${FRONTEND}" class="merek">
        <span class="merek-lambang">${SVG_S.rumah}</span>
        <span><b>KosinAja</b><small>STUDENT LIVING</small></span>
      </a>
      <nav class="nav-utama" id="nav-utama">
        ${MENU_SITUS.map((m) => `<a href="${FRONTEND}${m.href}" class="${m.id === aktif ? 'aktif' : ''}">${m.label}</a>`).join('')}
      </nav>
      <div class="kepala-kanan">
        ${akun ? tombolAkun(akun) : `<a class="btn-masuk" href="${FRONTEND}masuk?kembali=${encodeURIComponent(location.pathname + location.search)}">Masuk / Daftar</a>`}
        <button class="btn-menu-hp" id="btn-menu-hp" aria-label="Menu">${SVG_S.garis3}</button>
      </div>
    </div>`;

  el.querySelector('#btn-menu-hp').addEventListener('click', () => el.querySelector('#nav-utama').classList.toggle('buka'));
  if (!akun) return;

  const tombol = el.querySelector('.akun-tombol');
  const menu = el.querySelector('.menu-akun');
  tombol.addEventListener('click', () => {
    menu.hidden = !menu.hidden;
    tombol.setAttribute('aria-expanded', String(!menu.hidden));
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.akun')) { menu.hidden = true; tombol.setAttribute('aria-expanded', 'false'); }
  });
  el.querySelector('[data-keluar]').addEventListener('click', () => keluar(`${FRONTEND}`));

  // Lencana jumlah pengajuan yang masih menunggu
  if (akun.role === 'penyewa') {
    api('akun?bagian=reservasi').then((daftar) => {
      const n = daftar.filter((r) => ['Pending', 'Survei'].includes(r.status_reservasi)).length;
      const badge = el.querySelector('#lencana-res');
      if (n) { badge.textContent = n; badge.hidden = false; }
    }).catch(() => {});
  }
}

function tombolAkun(akun) {
  const pemilik = akun.role === 'admin';
  return `
    <div class="akun">
      <button class="akun-tombol" aria-haspopup="menu" aria-expanded="false">
        <span class="avatar">${esc(inisial(akun.nama_lengkap))}</span>
        <span><b>Akun Saya</b><small>${esc(akun.nama_lengkap)}</small></span>
        ${SVG_S.bawah}
      </button>
      <div class="menu-akun" role="menu" hidden>
        <div class="profil">
          <span class="avatar">${esc(inisial(akun.nama_lengkap))}</span>
          <div><b>${esc(akun.nama_lengkap)}</b><small>${esc(akun.email)}</small></div>
        </div>
        ${pemilik
          ? `<a href="${FRONTEND}admin/" role="menuitem"><span class="ikon">${SVG_S.panel}</span><span class="teks">Panel Pemilik<small>Kelola kos & penyewa</small></span></a>
             <a href="${FRONTEND}admin/profil" role="menuitem"><span class="ikon">${SVG_S.orang}</span><span class="teks">Profil Saya<small>Data diri & kata sandi</small></span></a>`
          : `<a href="${FRONTEND}reservasi-saya" role="menuitem"><span class="ikon">${SVG_S.dokumen}</span><span class="teks">Reservasi Saya<small>Status pengajuan & sewa</small></span><span class="lencana-angka" id="lencana-res" hidden></span></a>
             <a href="${FRONTEND}favorit" role="menuitem"><span class="ikon">${SVG_S.hati}</span><span class="teks">Kos Favorit<small>Kos yang kamu simpan</small></span></a>
             <a href="${FRONTEND}profil" role="menuitem"><span class="ikon">${SVG_S.orang}</span><span class="teks">Profil Saya<small>Data diri & kata sandi</small></span></a>`}
        <button data-keluar role="menuitem"><span class="ikon">${SVG_S.keluar}</span><span class="teks">Logout</span></button>
      </div>
    </div>`;
}

function renderKakiSitus() {
  const el = document.querySelector('#kaki');
  if (!el) return;
  el.className = 'kaki-situs';
  el.innerHTML = `
    <div class="wadah">
      <div class="kaki-grid">
        <div>
          <a href="${FRONTEND}" class="merek"><span class="merek-lambang">${SVG_S.rumah}</span><span><b>KosinAja</b></span></a>
          <p>Platform kurasi pencarian kos mahasiswa paling terpercaya di sekitar kampus Malang. Temukan kos nyaman, aman, dan transparan.</p>
        </div>
        <div>
          <h4>Menu</h4>
          <ul>${MENU_SITUS.map((m) => `<li><a href="${FRONTEND}${m.href}">${m.label}</a></li>`).join('')}</ul>
        </div>
        <div>
          <h4>Bantuan &amp; Kontak</h4>
          <ul>
            <li><a href="${FRONTEND}bantuan#faq">Pertanyaan Umum</a></li>
            <li><a href="${FRONTEND}daftar-mitra">Daftarkan Kos Anda</a></li>
            <li>Jl. Soekarno Hatta No. 9, Malang</li>
            <li>halo@kosinaja.test</li>
          </ul>
        </div>
      </div>
      <div class="hak-cipta">© 2026 KosinAja Student Living. Hak cipta dilindungi undang-undang.</div>
    </div>`;
}

/** URL foto kos, atau foto contoh kalau belum ada. */
function fotoKos(path, i = 0) {
  return urlFoto(path) || `${ASET}/${FOTO_CADANGAN[i % FOTO_CADANGAN.length]}`;
}
const CADANGAN_ONERROR = (i) => `this.onerror=null;this.src='${ASET}/${FOTO_CADANGAN[i % FOTO_CADANGAN.length]}'`;

function kartuKos(k, i = 0) {
  const url = `${FRONTEND}detail-kos?id=${k.id}`;
  const rating = k.rating_rata
    ? `<span class="rating"><span class="bintang">★</span>${k.rating_rata.toLocaleString('id-ID', { minimumFractionDigits: 1 })} <small>(${k.jumlah_ulasan})</small></span>`
    : '<span class="rating"><small>Belum ada ulasan</small></span>';
  return `
    <article class="kartu-kos">
      <div class="kartu-media">
        <a href="${url}"><img src="${esc(fotoKos(k.foto_utama, i))}" alt="${esc(k.nama_kos)}" loading="lazy" onerror="${CADANGAN_ONERROR(i)}"></a>
        <div class="kartu-lencana">
          <span>${LABEL_TIPE[k.tipe_kos] || k.tipe_kos}</span>
          ${k.kamar_tersedia > 0 ? `<span class="tersedia">${k.kamar_tersedia} Kosong</span>` : '<span class="penuh">Penuh</span>'}
        </div>
        <button class="btn-favorit ${k.is_favorit ? 'aktif' : ''}" data-favorit="${k.id}" aria-pressed="${!!k.is_favorit}" title="Simpan ke favorit">${SVG_S.hati}</button>
      </div>
      <div class="kartu-isi">
        <div class="kartu-meta">
          ${rating}
          ${k.jarak_kampus_km !== null ? `<span class="jarak">${k.jarak_kampus_km.toLocaleString('id-ID')} km ke kampus</span>` : ''}
        </div>
        <h3><a href="${url}">${esc(k.nama_kos)}</a></h3>
        <p class="lokasi">${esc(k.kecamatan)}, ${esc(k.kota)}</p>
        <div class="kartu-bawah">
          <div class="harga"><small>Mulai dari</small><b>${rupiah(k.harga_mulai)}</b><span>/bln</span></div>
          <a href="${url}" class="link-detail">Detail ${SVG_S.panah}</a>
        </div>
      </div>
    </article>`;
}

/** Kartu abu-abu berkedip (skeleton) selama daftar kos dimuat. */
function kerangkaKartu(jumlah) {
  return `
    <article class="kartu-kos kerangka" aria-hidden="true">
      <div class="kartu-media"></div>
      <div class="kartu-isi">
        <span class="garis-kerangka" style="width:45%"></span>
        <span class="garis-kerangka tebal" style="width:80%"></span>
        <span class="garis-kerangka" style="width:60%"></span>
        <span class="garis-kerangka tebal" style="width:40%;margin-top:auto"></span>
      </div>
    </article>`.repeat(jumlah);
}

/** Pasang sekali di wadah grid: klik hati -> simpan/hapus favorit. */
function pasangFavorit(wadah) {
  wadah.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-favorit]');
    if (!btn) return;
    e.preventDefault();
    if (!Situs.akun) return Situs.mintaMasuk('Masuk dulu untuk menyimpan kos favorit');
    if (Situs.akun.role !== 'penyewa') return toast('Favorit hanya untuk akun penyewa', true);

    const kosId = btn.dataset.favorit;
    const jadi = !btn.classList.contains('aktif');
    btn.classList.toggle('aktif', jadi);
    try {
      await api(jadi ? 'akun?bagian=favorit' : `akun?bagian=favorit&kos_id=${kosId}`, {
        method: jadi ? 'POST' : 'DELETE',
        body: jadi ? { kos_id: Number(kosId) } : undefined,
      });
      btn.setAttribute('aria-pressed', String(jadi));
      toast(jadi ? 'Disimpan ke favorit' : 'Dihapus dari favorit');
    } catch (err) {
      btn.classList.toggle('aktif', !jadi);
      toast(err.message, true);
    }
  });
}
