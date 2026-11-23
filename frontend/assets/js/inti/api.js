// Helper bersama untuk semua halaman (panel pengelola & sisi penyewa).

// URL bersih diatur .htaccess di root project: /katalog, /admin/kamar, /api/katalog, /uploads/...
// Akar situs dihitung dari lokasi file ini (/assets/js/inti/api.js), jadi benar untuk
// http://localhost/KosinAja/ maupun http://kosinaja.test/, dan dari halaman admin/ juga.
const FRONTEND = new URL('../../../', document.currentScript.src).href;
const API = `${FRONTEND}api`;
const ASET = `${FRONTEND}assets/img`;

/**
 * Peran yang sedang dipakai halaman ini: 'penyewa' | 'admin' | 'super_admin'.
 * Dikirim ke backend lewat header X-Peran supaya satu browser bisa login beberapa
 * peran sekaligus di tab berbeda (super admin di satu tab, pemilik kos di tab lain)
 * tanpa saling melempar keluar -- tiap peran punya slot session sendiri.
 * Halaman login/daftar sudah menandai dirinya lewat <body data-sebagai="...">,
 * sisanya ditebak dari folder halaman (/admin/..., /super-admin/...).
 */
function peranHalaman() {
  const ditandai = document.body?.dataset?.sebagai;
  if (['penyewa', 'admin', 'super_admin'].includes(ditandai)) return ditandai;

  const rel = location.href.startsWith(FRONTEND) ? location.href.slice(FRONTEND.length) : location.pathname;
  if (/^super-admin(\/|$)/.test(rel) || rel.includes('masuk-super-admin')) return 'super_admin';
  if (/^admin(\/|$)/.test(rel) || rel.includes('masuk-pemilik') || rel.includes('daftar-mitra')) return 'admin';
  return 'penyewa';
}

/**
 * Kunci tab browser ini. Disimpan di sessionStorage -- satu-satunya penyimpanan
 * browser yang benar-benar per tab: tab baru selalu mulai kosong, dan isinya
 * hilang saat tab ditutup. Cookie PHPSESSID tetap dipakai bersama semua tab
 * (tidak bisa diubah), jadi kunci inilah yang membuat backend tahu tab mana
 * yang bicara, lalu memberi slot login terpisah untuk tiap tab.
 *
 * Akibatnya: login penyewa di tab 1 TIDAK ikut terbawa ke tab yang baru dibuka.
 */
const KUNCI_TAB = 'kosinaja-tab';
function idTab() {
  let id = null;
  try { id = sessionStorage.getItem(KUNCI_TAB); } catch { return '-'; } // mode privat ketat
  if (!id) {
    id = (crypto.randomUUID?.() ?? `${Date.now()}${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9]/g, '');
    try { sessionStorage.setItem(KUNCI_TAB, id); } catch { return '-'; }
  }
  return id;
}

let permintaanAktif = 0;
let waktuTundaLoading = null;
let indikatorLoading = null;

function mulaiLoadingApi() {
  permintaanAktif++;
  if (permintaanAktif === 1) {
    waktuTundaLoading = setTimeout(() => {
      if (!document.body) return;
      if (!indikatorLoading) {
        const gaya = document.createElement('style');
        gaya.textContent = `
          #indikator-api { position:fixed; inset:0 0 auto; height:3px; z-index:9999; overflow:hidden; background:#dbeafe; opacity:0; transition:opacity .15s ease; pointer-events:none; }
          #indikator-api.tampil { opacity:1; }
          #indikator-api::after { content:""; display:block; width:35%; height:100%; border-radius:0 3px 3px 0; background:linear-gradient(90deg,#2563eb,#60a5fa,#2563eb); animation:gerak-indikator-api 1.1s ease-in-out infinite; }
          #indikator-api span { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
          @keyframes gerak-indikator-api { from { transform:translateX(-100%); } to { transform:translateX(290%); } }
          @media (prefers-reduced-motion:reduce) { #indikator-api::after { width:100%; animation:none; } }
        `;
        document.head.append(gaya);
        indikatorLoading = document.createElement('div');
        indikatorLoading.id = 'indikator-api';
        indikatorLoading.setAttribute('role', 'status');
        indikatorLoading.setAttribute('aria-live', 'polite');
        indikatorLoading.innerHTML = '<span>Memuat data...</span>';
        document.body.prepend(indikatorLoading);
      }
      indikatorLoading.classList.add('tampil');
    }, 250);
  }
}

function selesaiLoadingApi() {
  permintaanAktif = Math.max(0, permintaanAktif - 1);
  if (permintaanAktif) return;
  clearTimeout(waktuTundaLoading);
  waktuTundaLoading = null;
  indikatorLoading?.classList.remove('tampil');
}

/**
 * Panggil API backend. Melempar objek { message, errors } kalau success = false.
 * options.signal (AbortController) boleh dipakai; request yang dibatalkan melempar error name 'AbortError'.
 */
async function api(path, options = {}) {
  const opsi = { ...options };
  if (opsi.body && !(opsi.body instanceof FormData) && typeof opsi.body !== 'string') {
    opsi.body = JSON.stringify(opsi.body);
    opsi.headers = { 'Content-Type': 'application/json', ...opsi.headers };
  }
  // Beri tahu backend tab mana & peran apa; sesi login dipisah per (tab, peran)
  opsi.headers = { 'X-Tab': idTab(), 'X-Peran': peranHalaman(), ...opsi.headers };

  mulaiLoadingApi();
  try {
    let res;
    try {
      res = await fetch(`${API}/${path}`, opsi);
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      throw { message: 'Server tidak bisa dihubungi. Pastikan Laragon sudah Start All.' };
    }

    let json;
    try {
      json = await res.json();
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      throw { message: `Respons server tidak valid (HTTP ${res.status})` };
    }
    if (!json.success) throw { ...json, status: res.status };
    return json.data;
  } finally {
    selesaiLoadingApi();
  }
}

// ---------- Akun ----------

/** Pengguna yang sedang login (null kalau belum). Disimpan supaya tidak fetch berulang. */
let _akun;
async function akunSaya() {
  if (_akun === undefined) {
    try { _akun = await api('auth'); } catch { _akun = null; }
  }
  return _akun;
}

/** Keluar dari peran halaman ini saja; peran lain di tab sebelah tetap login. */
async function keluar(tujuan) {
  try { await api('auth?aksi=keluar', { method: 'POST' }); } catch { /* tetap pindah halaman */ }
  location.href = tujuan;
}

/** Kosongkan pesan galat & tanda merah di form. */
function bersihkanGalatForm(form) {
  form.querySelectorAll('[data-galat]').forEach((el) => (el.textContent = ''));
  form.querySelectorAll('.salah').forEach((el) => el.classList.remove('salah'));
}

/** Tampilkan pesan per-field dari response 422 ke elemen [data-galat="nama_field"] di form. */
function tampilGalatForm(form, err) {
  bersihkanGalatForm(form);
  Object.entries(err.errors || {}).forEach(([field, pesan]) => {
    const el = form.querySelector(`[data-galat="${field}"]`);
    if (el) el.textContent = pesan;
    form.querySelector(`[name="${field}"]`)?.classList.add('salah');
  });
  toast(err.message || 'Gagal menyimpan', true);
}

// ---------- Format tampilan ----------

const rupiah = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');

/** 28500000 -> "Rp 28,5 jt" (kartu Estimasi Omzet). */
function rupiahSingkat(n) {
  n = Number(n || 0);
  if (n >= 1e9) return 'Rp ' + (n / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' M';
  if (n >= 1e6) return 'Rp ' + (n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' jt';
  return rupiah(n);
}

/** "2026-02-01" -> "1 Feb 2026". */
function tanggal(iso) {
  if (!iso) return '-';
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso.replace(' ', 'T'));
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '');
}

/** Cegah XSS: semua teks dari database lewat sini sebelum masuk innerHTML. */
function esc(teks) {
  return String(teks ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

const inisial = (nama) => {
  const kata = String(nama || '').trim().split(/\s+/);
  return ((kata[0]?.[0] || '') + (kata.length > 1 ? kata[kata.length - 1][0] : '')).toUpperCase();
};

/** 12 -> "1 Tahun", 6 -> "6 Bulan". */
function labelDurasi(bulan) {
  const th = Math.floor(bulan / 12), bl = bulan % 12;
  return [th && `${th} Tahun`, bl && `${bl} Bulan`].filter(Boolean).join(' ');
}

/** Path foto dari database -> URL yang bisa dibuka browser. */
function urlFoto(path) {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return `${FRONTEND}${path.replace(/^\/+/, '')}`;
}

// ---------- Toast & modal ----------

function toast(pesan, gagal = false) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = pesan;
  el.classList.toggle('gagal', gagal);
  el.classList.add('tampil');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('tampil'), 3000);
}

/** Modal isian satu teks, mengembalikan Promise berisi teks atau null kalau dibatalkan. */
function mintaTeks({ judul, keterangan, tombol = 'Kirim', wajib = true }) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal buka';
    modal.innerHTML = `
      <div class="modal-isi" role="dialog" aria-modal="true">
        <h3>${esc(judul)}</h3>
        <p>${esc(keterangan)}</p>
        <textarea></textarea>
        <div class="modal-aksi">
          <button class="btn-abu" data-batal>Batal</button>
          <button class="btn-merah" data-ok>${esc(tombol)}</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    const area = modal.querySelector('textarea');
    area.focus();

    const tutup = (hasil) => { modal.remove(); resolve(hasil); };
    modal.querySelector('[data-batal]').onclick = () => tutup(null);
    modal.onclick = (e) => { if (e.target === modal) tutup(null); };
    modal.querySelector('[data-ok]').onclick = () => {
      if (wajib && !area.value.trim()) { area.focus(); return; }
      tutup(area.value.trim());
    };
  });
}

// ---------- Ikon SVG (garis, 20px) ----------

const IKON = {
  rumah: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3 2 11h3v9h5v-6h4v6h5v-9h3z"/></svg>',
  gedung: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1M10 21v-3h4v3"/></svg>',
  orang: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z"/></svg>',
  pintu: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 21V4a1 1 0 0 1 1-1h9v18M15 5h3v16M3 21h18"/><circle cx="12" cy="12" r=".8" fill="currentColor"/></svg>',
  papan: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 2h6v4H9z"/><circle cx="15" cy="15" r="3"/><path d="M15 13.5V15l1 1"/></svg>',
  uang: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 10v4M18 10v4"/></svg>',
  centang: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 2.1 3.1-.4.9 3 2.8 1.5-1 3 1 3-2.8 1.5-.9 3-3.1-.4L12 22l-2.4-2.1-3.1.4-.9-3-2.8-1.5 1-3-1-3 2.8-1.5.9-3 3.1.4z"/><path d="m8.5 12 2.5 2.5 4.5-5" stroke="#fff" stroke-width="2" fill="none"/></svg>',
  ceklis: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>',
  lonceng: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4M4 6 2 4M20 6l2-2"/></svg>',
  silang: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  pin: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  gear: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  tambahKos: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l1.5-5h15L21 9M3 9h18v3H3zM5 12v8h8M9 16h3"/><path d="M18 15v6M15 18h6"/></svg>',
  rumahPlus: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11 12 4l9 7M5 10v10h6M17 14v6M14 17h6"/></svg>',
  plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M5 12h14"/></svg>',
};
