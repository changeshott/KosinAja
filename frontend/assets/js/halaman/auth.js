// Halaman login, registrasi, lupa kata sandi, dan atur kata sandi baru (penyewa dan pemilik).
// <body data-mode="masuk|daftar|lupa|reset" data-sebagai="penyewa|admin">, panel kiri diisi dari BRANDING.

const SVG = {
  rumah: (s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3 2 11h3v9h5v-6h4v6h5v-9h3z"/></svg>`,
  perisai: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/></svg>',
  bintang: '<svg class="bintang" width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="m12 2 3 6.6 7 .7-5.3 4.8 1.6 7L12 17.5 5.7 21l1.6-7L2 9.3l7-.7z"/></svg>',
  pin: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  gedung: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1M10 21v-3h4v3"/></svg>',
  kunci: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M14 9l2 2"/></svg>',
  mata: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  mataTutup: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-2.6 3.4M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6M3 3l18 18M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
};

const BRANDING = {
  penyewa: {
    lencana: [SVG.perisai, 'Terverifikasi'],
    chipKanan: [SVG.bintang, '4.9 Rating Penghuni'],
    chipKiri: [SVG.pin, 'Dekat Kampus'],
    pengantar: 'HUNIAN NYAMAN UNTUK MAHASISWA',
    tagline: 'Temukan kos idaman yang aman, nyaman, dan dekat kampus.',
  },
  admin: {
    lencana: [SVG.perisai, 'Mitra Pemilik'],
    chipKanan: [SVG.gedung, 'Kelola Kos'],
    chipKiri: [SVG.kunci, 'Akses Mudah'],
    pengantar: 'PANEL PENGELOLA KOSINAJA',
    tagline: 'Kelola kamar, penyewa, dan reservasi dalam satu tempat.',
    deskripsi: 'Pantau kamar kosong, setujui pengajuan sewa, dan hubungi calon penyewa lewat WhatsApp tanpa ribet.',
  },
};

const mode = document.body.dataset.mode;
const sebagai = document.body.dataset.sebagai;

function renderBranding() {
  const b = BRANDING[sebagai];
  document.querySelector('#branding').innerHTML = `
    <span class="cahaya langit"></span><span class="cahaya hangat"></span><span class="cahaya terang"></span>
    <div class="branding-atas">
      <a href="./" class="merek"><span class="merek-lambang">${SVG.rumah(17)}</span>KosinAja</a>
      <span class="lencana">${b.lencana.join('')}</span>
    </div>
    <div class="ilustrasi" aria-hidden="true">
      <span class="halo"></span><span class="orbit"></span>
      <span class="ubin-rumah">${SVG.rumah(73)}</span>
      <span class="chip kiri">${b.chipKiri.join('')}</span>
      <span class="chip kanan">${b.chipKanan.join('')}</span>
    </div>
    <div class="pesan">
      <p class="pengantar">${b.pengantar}</p>
      <p class="tagline">${b.tagline}</p>
      ${b.deskripsi ? `<p class="deskripsi">${b.deskripsi}</p>` : ''}
    </div>`;
}

/** Hanya terima path di situs sendiri ("/KosinAja/..."), bukan URL luar, supaya tidak jadi open redirect. */
function tujuanSetelahMasuk(akun) {
  const kembali = new URLSearchParams(location.search).get('kembali');
  if (kembali && kembali.startsWith('/') && !kembali.startsWith('//')) return kembali;
  return akun.role === 'admin' ? `${FRONTEND}admin/` : `${FRONTEND}`;
}

function pasangMata() {
  document.querySelectorAll('.input .mata').forEach((btn) => {
    btn.innerHTML = SVG.mata;
    btn.addEventListener('click', () => {
      const input = btn.parentElement.querySelector('input');
      const tampil = input.type === 'password';
      input.type = tampil ? 'text' : 'password';
      btn.innerHTML = tampil ? SVG.mataTutup : SVG.mata;
      btn.setAttribute('aria-label', tampil ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi');
    });
  });
}

/** Validasi ringan di browser; aturan yang sama dicek ulang di backend. */
function cekDaftar(data) {
  const e = {};
  if (data.password.length < 8) e.password = 'Minimal 8 karakter';
  if (data.password !== data.konfirmasi) e.konfirmasi = 'Konfirmasi kata sandi tidak sama';
  if (sebagai === 'admin' && !/^[0-9]{16}$/.test(data.nik || '')) e.nik = 'NIK wajib 16 digit angka';
  if (sebagai === 'admin' && !data.setuju) e.setuju = 'Centang persetujuan terlebih dahulu';
  return e;
}

/** Lupa kata sandi: minta tautan reset. Pesannya sama untuk email terdaftar maupun tidak. */
async function kirimLupa(form, tombol) {
  try {
    await api('auth?aksi=lupa', { method: 'POST', body: { email: form.elements.email.value.trim() } });
    document.querySelector('#pesan-terkirim').textContent =
      `Kalau ${form.elements.email.value.trim()} terdaftar, tautan untuk membuat kata sandi baru sudah dikirim ke email tersebut.`;
    form.hidden = true;
    document.querySelector('#terkirim').hidden = false;
  } catch (err) {
    tampilGalatForm(form, err);
    tombol.disabled = false;
  }
}

/** Atur kata sandi baru dari tautan email (?token=...). */
async function kirimReset(form, tombol) {
  const f = form.elements;
  const token = new URLSearchParams(location.search).get('token') || '';
  const galat = {};
  if (f.password.value.length < 8) galat.password = 'Minimal 8 karakter';
  if (f.password.value !== f.konfirmasi.value) galat.konfirmasi = 'Konfirmasi kata sandi tidak sama';
  if (Object.keys(galat).length) {
    tampilGalatForm(form, { message: 'Periksa kembali isian Anda', errors: galat });
    tombol.disabled = false;
    return;
  }
  try {
    await api('auth?aksi=reset', { method: 'POST', body: { token, password: f.password.value } });
    form.hidden = true;
    document.querySelector('#berhasil').hidden = false;
  } catch (err) {
    tampilGalatForm(form, { ...err, errors: err.errors || { token: err.message } });
    tombol.disabled = false;
  }
}

async function kirim(e) {
  e.preventDefault();
  const form = e.currentTarget;
  if (mode === 'lupa' || mode === 'reset') {
    const tombol = form.querySelector('[type="submit"]');
    tombol.disabled = true;
    return mode === 'lupa' ? kirimLupa(form, tombol) : kirimReset(form, tombol);
  }
  const tombol = form.querySelector('[type="submit"]');
  const data = Object.fromEntries(new FormData(form));
  data.setuju = form.querySelector('[name="setuju"]')?.checked;

  if (mode === 'daftar') {
    const galat = cekDaftar(data);
    if (Object.keys(galat).length) {
      tampilGalatForm(form, { message: 'Periksa kembali isian Anda', errors: galat });
      return;
    }
  }

  tombol.disabled = true;
  try {
    const { konfirmasi, setuju, ...body } = data;
    const akun = await api(`auth?aksi=${mode}`, { method: 'POST', body: { ...body, sebagai } });
    toast(mode === 'masuk' ? `Selamat datang, ${akun.nama_lengkap}` : 'Akun berhasil dibuat');
    location.href = tujuanSetelahMasuk(akun);
  } catch (err) {
    tampilGalatForm(form, err);
    tombol.disabled = false;
  }
}

async function mulai() {
  renderBranding();
  pasangMata();
  document.querySelector('form').addEventListener('submit', kirim);

  if (mode === 'lupa' || mode === 'reset') {
    // Dari Login Pemilik (?peran=pemilik): tautan kembali mengarah ke Login Pemilik
    if (new URLSearchParams(location.search).get('peran') === 'pemilik') {
      document.querySelectorAll('[data-link-masuk]').forEach((a) => (a.href = 'masuk-pemilik'));
    }
    if (mode === 'reset' && !new URLSearchParams(location.search).get('token')) {
      tampilGalatForm(document.querySelector('form'), {
        message: 'Tautan reset tidak lengkap',
        errors: { token: 'Tautan tidak lengkap. Buka lagi tautan dari email, atau minta tautan baru.' },
      });
    }
    return;
  }

  // Sudah login dengan peran yang sama: langsung lanjut, tidak perlu isi form lagi
  const akun = await akunSaya();
  if (akun && akun.role === sebagai) {
    location.replace(tujuanSetelahMasuk(akun));
    return;
  }

  // Bawa ?kembali ke link pindah halaman (Masuk <-> Daftar)
  const kembali = new URLSearchParams(location.search).get('kembali');
  if (kembali) {
    document.querySelectorAll('[data-bawa-kembali]').forEach((a) => {
      const url = new URL(a.href);
      url.searchParams.set('kembali', kembali);
      a.href = url;
    });
  }

  document.querySelectorAll('[data-segera]').forEach((el) =>
    el.addEventListener('click', (e) => {
      e.preventDefault();
      toast(el.dataset.segera);
    }));
}

mulai();
