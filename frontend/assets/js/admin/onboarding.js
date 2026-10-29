// Onboarding pemilik baru (Figma 464:3648). Panel.mulai() mengarahkan ke sini kalau pemilik belum punya kos.
// Simpan: PUT auth (profil) -> POST kos (draf) -> Tambah Kamar.

const form = document.querySelector('#form-onb');

document.addEventListener('DOMContentLoaded', async () => {
  const akun = await akunSaya();
  if (!akun || akun.role !== 'admin') {
    location.href = `${FRONTEND}masuk-pemilik?kembali=${encodeURIComponent(location.pathname)}`;
    return;
  }
  // Sudah punya kos: onboarding tidak perlu diulang
  const properti = await api('kos').catch(() => []);
  if (properti.length) {
    location.replace('./');
    return;
  }

  document.querySelector('#nama-akun').textContent = akun.nama_lengkap;
  document.querySelector('#avatar').textContent = inisial(akun.nama_lengkap);
  document.querySelector('#nik').value = akun.nik_samar || '-';
  form.elements.nama_lengkap.value = akun.nama_lengkap;
  form.elements.no_telepon.value = akun.no_telepon;

  form.addEventListener('submit', simpan);
  document.querySelector('#btn-keluar').addEventListener('click', () => keluar(`${FRONTEND}`));
});

async function simpan(e) {
  e.preventDefault();
  const f = form.elements;
  if (!document.querySelector('#setuju').checked) {
    tampilGalatForm(form, { message: 'Centang pernyataan terlebih dahulu', errors: { setuju: 'Wajib disetujui' } });
    return;
  }
  const tombol = form.querySelector('[type="submit"]');
  tombol.disabled = true;
  try {
    await api('auth', { method: 'PUT', body: { nama_lengkap: f.nama_lengkap.value.trim(), no_telepon: f.no_telepon.value } });
    const kos = await api('kos', {
      method: 'POST',
      body: {
        nama_kos: f.nama_kos.value.trim(),
        tipe_kos: form.querySelector('[name="tipe_kos"]:checked')?.value || '',
        alamat: f.alamat.value.trim(),
        kecamatan: f.kecamatan.value.trim(),
        is_published: false,
      },
    });
    try { localStorage.setItem('kosinaja.kosAktif', String(kos.id)); } catch { /* abaikan */ }
    toast('Kos pertama tersimpan. Sekarang tambahkan kamar.');
    setTimeout(() => (location.href = `tambah-kamar?kos_id=${kos.id}`), 800);
  } catch (err) {
    tampilGalatForm(form, err);
    tombol.disabled = false;
  }
}
