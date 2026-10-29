// Form Profil Saya, dipakai halaman penyewa (/profil) dan panel pemilik (/admin/profil).
// Halaman cukup punya <form id="form-profil"> (nama_lengkap, email, no_telepon) dan
// <form id="form-sandi"> (password_lama, password_baru, konfirmasi), lalu memanggil pasangProfil(akun).
// Elemen [data-akun="nama|email|inisial"] ikut diperbarui setelah profil disimpan.

function pasangProfil(akun, { saatTersimpan } = {}) {
  const formProfil = document.querySelector('#form-profil');
  const formSandi = document.querySelector('#form-sandi');

  const tampilkan = (a) => {
    formProfil.elements.nama_lengkap.value = a.nama_lengkap;
    formProfil.elements.email.value = a.email;
    formProfil.elements.no_telepon.value = a.no_telepon;
    document.querySelectorAll('[data-akun="nama"]').forEach((el) => (el.textContent = a.nama_lengkap));
    document.querySelectorAll('[data-akun="email"]').forEach((el) => (el.textContent = a.email));
    document.querySelectorAll('[data-akun="inisial"]').forEach((el) => (el.textContent = inisial(a.nama_lengkap)));
  };
  tampilkan(akun);

  formProfil.addEventListener('submit', async (e) => {
    e.preventDefault();
    const tombol = formProfil.querySelector('[type="submit"]');
    tombol.disabled = true;
    try {
      const baru = await api('auth', {
        method: 'PUT',
        body: { nama_lengkap: formProfil.elements.nama_lengkap.value.trim(), no_telepon: formProfil.elements.no_telepon.value.trim() },
      });
      _akun = baru; // cache akunSaya() di api.js ikut diperbarui
      bersihkanGalatForm(formProfil);
      tampilkan(baru);
      saatTersimpan?.(baru);
      toast('Profil diperbarui');
    } catch (err) {
      tampilGalatForm(formProfil, err);
    } finally {
      tombol.disabled = false;
    }
  });

  formSandi.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = formSandi.elements;
    const galat = {};
    if (!f.password_lama.value) galat.password_lama = 'Wajib diisi';
    if (f.password_baru.value.length < 8) galat.password_baru = 'Minimal 8 karakter';
    if (f.password_baru.value !== f.konfirmasi.value) galat.konfirmasi = 'Konfirmasi kata sandi tidak sama';
    if (Object.keys(galat).length) {
      tampilGalatForm(formSandi, { message: 'Periksa kembali isian Anda', errors: galat });
      return;
    }
    const tombol = formSandi.querySelector('[type="submit"]');
    tombol.disabled = true;
    try {
      await api('auth?aksi=sandi', { method: 'PUT', body: { password_lama: f.password_lama.value, password_baru: f.password_baru.value } });
      bersihkanGalatForm(formSandi);
      formSandi.reset();
      toast('Kata sandi diperbarui');
    } catch (err) {
      tampilGalatForm(formSandi, err);
    } finally {
      tombol.disabled = false;
    }
  });
}
