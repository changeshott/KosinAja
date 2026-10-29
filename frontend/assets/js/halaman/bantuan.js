// Bantuan (Figma 464:439): pencarian FAQ di sisi browser + saring topik.
// Isi FAQ ada di bantuan.html (<details id data-topik data-kata>), jadi menambah pertanyaan cukup di HTML.
//
// Pencarian dibuat "pintar" tanpa server:
//   - per kata, kata umum ("cara", "bagaimana", "saya") diabaikan
//   - kata dasar sederhana: "membatalkan" -> "batal", "pembayaran" -> "bayar"
//   - sinonim: "password" ~ "sandi", "booking" ~ "pesan", "wa" ~ "whatsapp"
//   - toleran salah ketik: "reservsi" tetap cocok dengan "reservasi"
//   - hasil diurutkan: cocok di judul > kata kunci > isi jawaban
// URL ikut tersimpan (?q=&topik=) dan tiap pertanyaan punya tautan langsung (#id).

const KATA_UMUM = new Set(['cara', 'bagaimana', 'gimana', 'apa', 'apakah', 'saya', 'aku', 'yang', 'di', 'ke', 'dari',
  'untuk', 'bisa', 'kenapa', 'mengapa', 'dan', 'atau', 'ini', 'itu', 'dengan', 'kalau', 'jika', 'mau', 'ingin', 'kapan',
  'berapa', 'ada', 'tidak', 'nya', 'dong', 'sih', 'tolong', 'kos', 'kost', 'kosan', 'kosinaja']);

// Setiap baris = kata yang dianggap sama (sudah dalam bentuk kata dasar)
const SINONIM = [
  ['sandi', 'password', 'pass', 'pin'],
  ['batal', 'cancel', 'urung'],
  ['bayar', 'transfer', 'lunas', 'tagih'],
  ['dp', 'muka', 'panjar'],
  ['pesan', 'booking', 'book', 'ajukan', 'aju', 'sewa', 'reservasi'],
  ['survei', 'survey', 'kunjung', 'lihat'],
  ['whatsapp', 'wa', 'kontak', 'telepon', 'nomor', 'hp', 'chat', 'hubung'],
  ['pemilik', 'owner', 'mitra', 'juragan'],
  ['daftar', 'registrasi', 'register', 'signup'],
  ['masuk', 'login', 'signin'],
  ['ulas', 'review', 'rating', 'bintang', 'nilai', 'testimoni'],
  ['beri', 'kasih', 'tulis', 'kirim'],
  ['tolak', 'reject', 'gagal'],
  ['cari', 'search', 'temu'],
  ['filter', 'saring'],
  ['favorit', 'simpan', 'wishlist', 'bookmark', 'suka'],
  ['kamar', 'unit', 'ruang'],
  ['murah', 'harga', 'budget', 'biaya'],
  ['tipu', 'scam', 'palsu', 'curiga'],
];
const GRUP_SINONIM = new Map();
SINONIM.forEach((baris, i) => baris.forEach((k) => GRUP_SINONIM.set(k, i)));

const LABEL_TOPIK = { cari: 'Mencari Kos', sewa: 'Reservasi & Survei', bayar: 'Pembayaran', akun: 'Akun & Ulasan', pemilik: 'Untuk Pemilik' };
const KUNCI_MEMBANTU = 'kosinaja.faqMembantu';
const SARAN_MAKS = 5;

let topik = '';
let indeks = []; // { el, id, topik, judul, judulAsli, isiAsli, token: {judul, kata, isi} }
let tunda;
let pilihan = -1;

document.addEventListener('DOMContentLoaded', () => {
  Situs.mulai();
  bangunIndeks();
  pasangUmpanBalik();

  const input = document.querySelector('#q');
  const p = new URLSearchParams(location.search);
  input.value = p.get('q') || '';
  topik = LABEL_TOPIK[p.get('topik')] ? p.get('topik') : '';

  document.querySelector('#form-cari').addEventListener('submit', (e) => {
    e.preventDefault();
    tutupSaran();
    terapkan();
    gulirKe(document.querySelector('#faq'));
  });
  input.addEventListener('input', () => {
    clearTimeout(tunda);
    tunda = setTimeout(() => { terapkan(); tampilSaran(); }, 150);
  });
  input.addEventListener('focus', () => { if (input.value.trim()) tampilSaran(); });
  input.addEventListener('keydown', navigasiSaran);

  const panel = document.querySelector('#saran-cari');
  panel.addEventListener('mousedown', (e) => e.preventDefault()); // input tetap fokus saat panel diklik
  panel.addEventListener('click', (e) => {
    const item = e.target.closest('[role="option"]');
    if (item) pilihSaran(item);
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('#form-cari')) tutupSaran(); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    e.preventDefault();
    input.focus();
    input.select();
  });

  document.querySelector('#cari-populer').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cari]');
    if (!b) return;
    input.value = b.dataset.cari;
    terapkan();
    gulirKe(document.querySelector('#faq'));
  });
  // Tab topik di samping daftar & kartu kategori
  document.querySelectorAll('#topik-faq [data-topik], .kartu-topik [data-topik]').forEach((el) => {
    el.addEventListener('click', () => {
      topik = el.dataset.topik;
      terapkan();
      if (el.closest('.kartu-topik')) gulirKe(document.querySelector('#faq'));
    });
  });
  document.querySelector('#faq').addEventListener('click', (e) => {
    const b = e.target.closest('[data-aksi]');
    if (!b) return;
    if (b.dataset.aksi === 'reset') {
      input.value = '';
      topik = '';
      terapkan();
    } else if (b.dataset.aksi === 'salin') {
      salinTautan(b.closest('details').id);
    } else if (b.dataset.aksi === 'buka') {
      bukaPertanyaan(b.dataset.id);
    }
  });

  terapkan({ simpanUrl: false });
  if (location.hash) bukaPertanyaan(location.hash.slice(1));
  window.addEventListener('hashchange', () => bukaPertanyaan(location.hash.slice(1)));
});

// ---------- Indeks & pencocokan ----------

/**
 * Kata dasar sederhana: "membatalkan" -> "batal", "pembayaran" -> "bayar", "menyewa" -> "sewa".
 * Kata yang ada di daftar sinonim ("survei", "reservasi") dipakai apa adanya.
 */
function kataDasar(kata) {
  if (GRUP_SINONIM.has(kata)) return kata;
  const awalan = (k) => {
    if (k.length <= 5) return k;
    return /^(meny|peny)/.test(k)
      ? `s${k.slice(4)}` // menyewa -> sewa
      : k.replace(/^(meng|mem|men|me|peng|pem|pen|pe|ber|di|ter|ke|se)/, '');
  };
  const akhiran = (k) => (k.length > 5 ? k.replace(/(kan|an|i)$/, '') : k);
  const k = kata.length > 5 ? kata.replace(/(nya|lah|kah)$/, '') : kata;
  // Kalau salah satu urutan pemotongan menghasilkan kata yang dikenal, pakai itu ("memberi" -> "beri", bukan "ber")
  const calon = [k, awalan(k), akhiran(k), awalan(akhiran(k)), akhiran(awalan(k))];
  const dikenal = calon.find((c) => GRUP_SINONIM.has(c));
  const hasil = dikenal || awalan(akhiran(k));
  return hasil.length >= 2 ? hasil : kata;
}

function token(teks) {
  return (teks || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((k) => k.length >= 2 && !KATA_UMUM.has(k))
    .map(kataDasar);
}

function bangunIndeks() {
  indeks = [...document.querySelectorAll('#daftar-faq details')].map((el) => {
    // Teks judul dibungkus satu <span>: <summary> memakai flex, jadi <mark> lepas akan terpecah jadi kolom
    const summary = el.querySelector('summary');
    summary.innerHTML = `<span class="judul-faq">${summary.innerHTML}</span>`;
    const judul = summary.querySelector('.judul-faq');
    const isi = el.querySelector('.isi-faq p');
    // Isi asli disimpan supaya penanda kata yang cocok bisa dibersihkan lagi
    el.dataset.judulAsli = judul.innerHTML;
    el.dataset.isiAsli = isi.innerHTML;
    return {
      el,
      id: el.id,
      topik: el.dataset.topik,
      judul: summary.textContent.trim(),
      token: {
        judul: new Set(token(summary.textContent)),
        kata: new Set(token(el.dataset.kata)),
        isi: new Set(token(isi.textContent)),
      },
    };
  });
}

/** Jarak edit maksimal 1 (kata 4-6 huruf) atau 2 (7+ huruf) = dianggap salah ketik. */
function mirip(a, b) {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 4 || Math.abs(a.length - b.length) > 2) return false;
  const batas = Math.min(a.length, b.length) >= 7 ? 2 : 1;
  let baris = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const baru = [i];
    let minBaris = i;
    for (let j = 1; j <= b.length; j++) {
      baru[j] = Math.min(baris[j] + 1, baru[j - 1] + 1, baris[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      minBaris = Math.min(minBaris, baru[j]);
    }
    if (minBaris > batas) return false;
    baris = baru;
  }
  return baris[b.length] <= batas;
}

/**
 * Nilai kecocokan satu kata pencarian terhadap sekumpulan token:
 * 1 = persis, 0.8 = awalan kata, 0.6 = sinonim, 0.5 = salah ketik.
 * Sinonim sengaja lebih rendah dari persis supaya "booking" mengutamakan FAQ yang memang memuat kata itu.
 */
function nilaiKata(q, kumpulan) {
  let terbaik = 0;
  const grup = GRUP_SINONIM.get(q);
  for (const t of kumpulan) {
    if (t === q) return 1;
    if (q.length >= 3 && t.startsWith(q)) terbaik = Math.max(terbaik, 0.8);
    else if (grup !== undefined && GRUP_SINONIM.get(t) === grup) terbaik = Math.max(terbaik, 0.6);
    else if (terbaik < 0.5 && mirip(q, t)) terbaik = 0.5;
  }
  return terbaik;
}

/** Cari di indeks. Mengembalikan [{item, skor, kata}] terurut, kata = token pencarian yang cocok. */
function cari(teks) {
  const kataCari = [...new Set(token(teks))];
  if (!kataCari.length) return null; // tidak ada kata bermakna -> anggap tanpa pencarian
  const frasa = teks.trim().toLowerCase();
  const hasil = [];
  for (const item of indeks) {
    let skor = 0;
    let cocok = 0;
    for (const q of kataCari) {
      const n = Math.max(
        nilaiKata(q, item.token.judul) * 3,
        nilaiKata(q, item.token.kata) * 2,
        nilaiKata(q, item.token.isi) * 1,
      );
      if (n > 0) { cocok++; skor += n; }
    }
    // Semua kata harus cocok; untuk pencarian panjang (3+ kata) boleh meleset satu
    const cukup = cocok === kataCari.length || (kataCari.length >= 3 && cocok >= kataCari.length - 1);
    if (!cukup) continue;
    if (frasa.length >= 4 && item.judul.toLowerCase().includes(frasa)) skor += 5;
    hasil.push({ item, skor, kata: kataCari });
  }
  return hasil.sort((a, b) => b.skor - a.skor);
}

// ---------- Tampilan daftar ----------

function terapkan({ simpanUrl = true } = {}) {
  const teks = document.querySelector('#q').value.trim();
  const hasil = cari(teks);
  const daftar = document.querySelector('#daftar-faq');
  const cocokTopik = (item) => !topik || item.topik === topik;

  // Urutan: hasil pencarian menurut skor, tanpa pencarian menurut urutan asli di HTML
  const urut = hasil ? hasil : indeks.map((item) => ({ item, skor: 0, kata: [] }));
  const lolosCari = new Set(urut.map((h) => h.item));
  let tampil = 0;
  urut.forEach(({ item, kata }) => {
    const lolos = cocokTopik(item);
    item.el.hidden = !lolos;
    sorot(item.el, kata);
    if (lolos) {
      tampil++;
      daftar.appendChild(item.el); // pindahkan ke urutan skor
      if (hasil && tampil <= 2) item.el.open = true; // dua jawaban teratas langsung terbuka
    }
  });
  indeks.filter((item) => !lolosCari.has(item)).forEach((item) => {
    item.el.hidden = true;
    sorot(item.el, []);
  });
  if (!hasil) indeks.forEach((item) => daftar.appendChild(item.el));

  // Jumlah per topik ikut hasil pencarian
  document.querySelectorAll('#topik-faq button').forEach((b) => {
    const t = b.dataset.topik;
    b.classList.toggle('aktif', t === topik);
    b.setAttribute('aria-pressed', String(t === topik));
    b.querySelector('span').textContent = urut.filter((h) => !t || h.item.topik === t).length;
  });

  renderInfo(teks, hasil, tampil);
  renderKosong(teks, tampil);
  perbaruiEmail(teks);
  if (simpanUrl) simpanKeUrl(teks);
}

function renderInfo(teks, hasil, tampil) {
  const info = document.querySelector('#info-faq');
  const label = topik ? ` di topik <b>${LABEL_TOPIK[topik]}</b>` : '';
  if (hasil) {
    info.innerHTML = `<span>${tampil} jawaban untuk "<b>${esc(teks)}</b>"${label}</span>
      <button type="button" class="btn-reset" data-aksi="reset">Hapus pencarian</button>`;
  } else if (topik) {
    info.innerHTML = `<span>${tampil} pertanyaan${label}</span>
      <button type="button" class="btn-reset" data-aksi="reset">Tampilkan semua</button>`;
  } else {
    info.innerHTML = `<span>${tampil} pertanyaan umum</span>`;
  }
}

function renderKosong(teks, tampil) {
  const kosong = document.querySelector('#faq-kosong');
  kosong.hidden = tampil > 0;
  if (tampil) return;
  // Tawarkan pertanyaan populer + tombol kontak, bukan sekadar "tidak ditemukan"
  const populer = ['batalkan-reservasi', 'survei', 'cara-bayar', 'daftarkan-kos']
    .map((id) => indeks.find((i) => i.id === id)).filter(Boolean);
  kosong.innerHTML = `
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M8.5 8.5l5 5M13.5 8.5l-5 5"/></svg>
    <b>Belum ada jawaban yang cocok</b>
    ${teks ? `Coba kata lain untuk "${esc(teks)}", atau lihat pertanyaan yang sering dibuka:` : 'Lihat pertanyaan yang sering dibuka:'}
    <div class="kosong-aksi">
      ${populer.map((i) => `<button type="button" class="btn-garis" data-aksi="buka" data-id="${i.id}">${esc(i.judul)}</button>`).join('')}
    </div>
    <div class="kosong-aksi">
      <button type="button" class="btn-reset" data-aksi="reset">Hapus pencarian</button>
      <a class="btn-utama" href="#kontak">Tanya tim KosinAja</a>
    </div>`;
}

/** Beri <mark> pada kata yang cocok di judul & jawaban; selalu mulai dari isi asli. */
function sorot(el, kataCari) {
  const judul = el.querySelector('.judul-faq');
  const isi = el.querySelector('.isi-faq p');
  judul.innerHTML = el.dataset.judulAsli;
  isi.innerHTML = el.dataset.isiAsli;
  if (!kataCari.length) return;
  [judul, isi].forEach((wadah) => {
    const jalan = document.createTreeWalker(wadah, NodeFilter.SHOW_TEXT);
    const simpul = [];
    while (jalan.nextNode()) simpul.push(jalan.currentNode);
    simpul.forEach((node) => {
      const bagian = node.textContent.split(/([A-Za-zÀ-ÿ0-9]+)/);
      if (!bagian.some((b) => cocokSorot(b, kataCari))) return;
      const frag = document.createDocumentFragment();
      bagian.forEach((b) => {
        if (cocokSorot(b, kataCari)) {
          const m = document.createElement('mark');
          m.textContent = b;
          frag.appendChild(m);
        } else if (b) {
          frag.appendChild(document.createTextNode(b));
        }
      });
      node.replaceWith(frag);
    });
  });
}

function cocokSorot(kata, kataCari) {
  if (!kata || kata.length < 2) return false;
  const k = kata.toLowerCase();
  if (KATA_UMUM.has(k)) return false;
  const d = kataDasar(k);
  return kataCari.some((q) => d === q || (q.length >= 3 && d.startsWith(q)) ||
    (GRUP_SINONIM.has(q) && GRUP_SINONIM.get(q) === GRUP_SINONIM.get(d)) || mirip(q, d));
}

function simpanKeUrl(teks) {
  const p = new URLSearchParams();
  if (teks) p.set('q', teks);
  if (topik) p.set('topik', topik);
  history.replaceState(null, '', (p.toString() ? `?${p}` : location.pathname) + location.hash);
}

/** Email bantuan ikut membawa kata kunci supaya tim langsung tahu konteksnya. */
function perbaruiEmail(teks) {
  const subjek = teks ? `Bantuan KosinAja: ${teks}` : 'Bantuan KosinAja';
  document.querySelector('#tombol-email').href = `mailto:halo@kosinaja.test?subject=${encodeURIComponent(subjek)}`;
}

/** Buka satu pertanyaan (dari #hash, saran, atau tombol populer), tampilkan walau sedang tersaring. */
function bukaPertanyaan(id) {
  const el = id && document.getElementById(id);
  if (!el || el.tagName !== 'DETAILS') return;
  if (el.hidden) {
    document.querySelector('#q').value = '';
    topik = '';
    terapkan();
  }
  el.open = true;
  gulirKe(el);
  el.classList.remove('sorot-faq');
  void el.offsetWidth; // ulang animasi
  el.classList.add('sorot-faq');
}

function gulirKe(el) {
  const atas = el.getBoundingClientRect().top + scrollY - 96;
  window.scrollTo({ top: atas, behavior: 'smooth' });
}

// ---------- Saran saat mengetik ----------

function tampilSaran() {
  const input = document.querySelector('#q');
  const teks = input.value.trim();
  const hasil = cari(teks);
  if (!hasil) return tutupSaran();
  const panel = document.querySelector('#saran-cari');
  panel.innerHTML = hasil.length
    ? `<div class="saran-judul">Jawaban yang cocok</div>
       ${hasil.slice(0, SARAN_MAKS).map(({ item }, i) => {
         const isi = item.el.querySelector('.isi-faq p').textContent;
         return `<div class="saran-baris" role="option" id="saran-${i}" aria-selected="false" data-id="${item.id}">
           <span class="saran-ikon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17h.01"/></svg></span>
           <span class="saran-label">${esc(item.judul)}<small>${LABEL_TOPIK[item.topik]} · ${esc(isi.slice(0, 70))}...</small></span>
         </div>`;
       }).join('')}
       <div class="saran-semua" role="option" id="saran-semua" aria-selected="false">Lihat semua ${hasil.length} jawaban ${SVG_S.panah}</div>`
    : `<div class="saran-status"><b>Belum ada jawaban yang cocok</b>Coba kata lain, atau tekan Enter untuk melihat pertanyaan populer.</div>`;
  pilihan = -1;
  input.removeAttribute('aria-activedescendant');
  panel.hidden = false;
  input.setAttribute('aria-expanded', 'true');
}

function tutupSaran() {
  const input = document.querySelector('#q');
  document.querySelector('#saran-cari').hidden = true;
  input.setAttribute('aria-expanded', 'false');
  input.removeAttribute('aria-activedescendant');
  pilihan = -1;
}

function navigasiSaran(e) {
  const panel = document.querySelector('#saran-cari');
  if (panel.hidden) return;
  const opsi = [...panel.querySelectorAll('[role="option"]')];
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (!opsi.length) return;
    pilihan = e.key === 'ArrowDown' ? (pilihan + 1) % opsi.length : (pilihan - 1 + opsi.length) % opsi.length;
    opsi.forEach((el, i) => el.setAttribute('aria-selected', i === pilihan));
    e.target.setAttribute('aria-activedescendant', opsi[pilihan].id);
    opsi[pilihan].scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter' && pilihan >= 0 && opsi[pilihan]) {
    e.preventDefault();
    pilihSaran(opsi[pilihan]);
  } else if (e.key === 'Escape') {
    e.preventDefault(); // Esc pertama hanya menutup panel, teks tidak ikut terhapus
    tutupSaran();
  }
}

function pilihSaran(item) {
  tutupSaran();
  if (item.dataset.id) {
    bukaPertanyaan(item.dataset.id);
  } else {
    document.querySelector('#form-cari').requestSubmit();
  }
}

// ---------- Tautan & umpan balik per pertanyaan ----------

async function salinTautan(id) {
  const url = `${location.origin}${location.pathname}#${id}`;
  try {
    await navigator.clipboard.writeText(url);
    toast('Tautan pertanyaan disalin');
  } catch {
    prompt('Salin tautan berikut:', url);
  }
}

/** "Apakah jawaban ini membantu?" di bawah setiap jawaban; pilihan diingat di browser ini. */
function pasangUmpanBalik() {
  let tersimpan = {};
  try { tersimpan = JSON.parse(localStorage.getItem(KUNCI_MEMBANTU) || '{}'); } catch { /* abaikan */ }

  indeks.forEach(({ el, id }) => {
    el.querySelector('.isi-faq').insertAdjacentHTML('beforeend', `
      <div class="kaki-faq">
        <span class="tanya-membantu">Apakah jawaban ini membantu?
          <button type="button" data-membantu="ya">Ya</button>
          <button type="button" data-membantu="tidak">Tidak</button>
        </span>
        <button type="button" class="salin-faq" data-aksi="salin" title="Salin tautan pertanyaan ini">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>Salin tautan
        </button>
      </div>`);
    if (tersimpan[id]) tandaiMembantu(el, tersimpan[id]);
  });

  document.querySelector('#daftar-faq').addEventListener('click', (e) => {
    const b = e.target.closest('[data-membantu]');
    if (!b) return;
    const el = b.closest('details');
    tersimpan[el.id] = b.dataset.membantu;
    try { localStorage.setItem(KUNCI_MEMBANTU, JSON.stringify(tersimpan)); } catch { /* mode privat */ }
    tandaiMembantu(el, b.dataset.membantu);
  });
}

function tandaiMembantu(el, nilai) {
  el.querySelector('.tanya-membantu').innerHTML = nilai === 'ya'
    ? '<span class="terima-kasih">Terima kasih atas masukanmu!</span>'
    : 'Maaf jawabannya belum membantu. <a class="tautan" href="#kontak">Tanya tim KosinAja</a>';
}
