// Kos Favorit: kos yang disimpan penyewa lewat ikon hati.
// GET api/akun?bagian=favorit, hapus dengan DELETE api/akun?bagian=favorit&kos_id=...

let daftarFavorit = [];

document.addEventListener('DOMContentLoaded', async () => {
  const akun = await Situs.mulai();
  if (!akun || akun.role !== 'penyewa') {
    Situs.mintaMasuk(akun ? 'Halaman ini khusus akun penyewa' : 'Masuk dulu untuk melihat kos favorit');
    return;
  }
  const grid = document.querySelector('#grid-kos');
  grid.addEventListener('click', hapusFavorit);
  grid.innerHTML = kerangkaKartu(4);
  try {
    daftarFavorit = (await api('akun?bagian=favorit')).items;
    render();
  } catch (err) {
    grid.innerHTML = `<div class="kosong-situs"><b>Gagal memuat</b>${esc(err.message)}</div>`;
  }
});

function render() {
  const n = daftarFavorit.length;
  document.querySelector('#info-favorit').textContent = n
    ? `${n} kos tersimpan. Tekan ikon hati untuk menghapus dari favorit.`
    : 'Belum ada kos yang disimpan.';
  document.querySelector('#grid-kos').innerHTML = daftarFavorit.map((k, i) => kartuKos(k, i)).join('') || `
    <div class="kosong-situs kosong-bantu">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>
      <b>Belum ada kos favorit</b>
      Tekan ikon hati di kartu kos atau halaman Detail Kos untuk menyimpannya di sini.
      <div class="kosong-aksi"><a class="btn-utama" href="katalog">Jelajahi Katalog</a></div>
    </div>`;
}

async function hapusFavorit(e) {
  const btn = e.target.closest('[data-favorit]');
  if (!btn) return;
  e.preventDefault();
  const kosId = Number(btn.dataset.favorit);
  btn.disabled = true;
  try {
    await api(`akun?bagian=favorit&kos_id=${kosId}`, { method: 'DELETE' });
    daftarFavorit = daftarFavorit.filter((k) => k.id !== kosId);
    render();
    toast('Dihapus dari favorit');
  } catch (err) {
    toast(err.message, true);
    btn.disabled = false;
  }
}
