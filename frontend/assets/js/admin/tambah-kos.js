// Tambah / Edit Kos (Figma 464:5280). ?id=1 = mode edit (tombol gear di kartu Portofolio).
// Kos baru langsung diarahkan ke Tambah Kamar, karena kos tanpa kamar tidak muncul di katalog.

let kosId = Number(new URLSearchParams(location.search).get('id')) || null;
let galeri;
const form = document.querySelector('#form-kos');

document.addEventListener('DOMContentLoaded', async () => {
  if (!(await Panel.mulai({ butuhKos: false }))) return;
  galeri = buatGaleri({ jenis: 'kos', label: ['Foto Sampul'] });

  try {
    const [fasilitas, kos] = await Promise.all([
      api('fasilitas'),
      kosId ? api(`kos?id=${kosId}`) : null,
    ]);
    renderFasilitas(fasilitas, kos ? kos.fasilitas.map((f) => f.id) : []);
    if (kos) isiForm(kos);
  } catch (err) {
    toast(err.message || 'Gagal memuat form', true);
  }

  form.addEventListener('submit', simpan);
  document.querySelector('#btn-hapus').addEventListener('click', hapusKos);
});

function renderFasilitas(grup, dipilih) {
  const bersama = grup.flatMap((g) => g.items).filter((f) => f.lingkup === 'bersama');
  document.querySelector('#cek-fasilitas').innerHTML = bersama.map((f) => `
    <label class="cek"><input type="checkbox" value="${f.id}" ${dipilih.includes(f.id) ? 'checked' : ''}> <span>${esc(f.nama_fasilitas)}</span></label>`).join('')
    || '<p class="sel-sub">Belum ada data fasilitas bersama.</p>';
}

function isiForm(k) {
  if (k.id !== Panel.kosId) Panel.gantiKos(k.id);
  document.title = `Edit ${k.nama_kos} - KosinAja`;
  document.querySelector('#judul-form').textContent = 'Edit Kos';
  document.querySelector('#crumb-akhir').textContent = k.nama_kos;
  document.querySelector('#btn-hapus').hidden = false;
  tandaiStatus(k.is_published);

  const f = form.elements;
  ['nama_kos', 'alamat', 'kecamatan', 'kota', 'jarak_kampus_km', 'google_maps_url', 'deskripsi', 'peraturan_kos']
    .forEach((n) => { f[n].value = k[n] ?? ''; });
  form.querySelector(`[name="tipe_kos"][value="${k.tipe_kos}"]`).checked = true;
  galeri.isi(k.foto);
}

function tandaiStatus(terbit) {
  const el = document.querySelector('#status-form');
  el.classList.toggle('terbit', terbit);
  el.querySelector('span').textContent = terbit ? 'Dipublikasikan' : 'Draf';
}

function kumpulkanData(publish) {
  const f = form.elements;
  const data = {
    nama_kos: f.nama_kos.value.trim(),
    tipe_kos: form.querySelector('[name="tipe_kos"]:checked')?.value || '',
    alamat: f.alamat.value.trim(),
    kecamatan: f.kecamatan.value.trim(),
    kota: f.kota.value.trim() || 'Malang',
    deskripsi: f.deskripsi.value.trim(),
    peraturan_kos: f.peraturan_kos.value.trim(),
    is_published: publish,
    fasilitas_ids: [...document.querySelectorAll('#cek-fasilitas input:checked')].map((c) => Number(c.value)),
  };
  // Kolom angka/URL opsional: jangan kirim string kosong supaya lolos validasi numeric
  if (f.jarak_kampus_km.value) data.jarak_kampus_km = f.jarak_kampus_km.value;
  if (f.google_maps_url.value.trim()) data.google_maps_url = f.google_maps_url.value.trim();
  return data;
}

async function simpan(e) {
  e.preventDefault();
  const publish = e.submitter?.dataset.publish === '1';
  const tombol = form.querySelectorAll('button[type="submit"]');
  const baru = !kosId;
  tombol.forEach((b) => (b.disabled = true));
  try {
    const data = kumpulkanData(publish);
    const kos = kosId
      ? await api(`kos?id=${kosId}`, { method: 'PUT', body: data })
      : await api('kos', { method: 'POST', body: data });
    if (!kosId) {
      kosId = kos.id;
      history.replaceState(null, '', `?id=${kos.id}`);
    }
    await galeri.unggah(kos.id);
    Panel.gantiKos(kos.id);
    tandaiStatus(publish);

    toast(baru ? 'Kos tersimpan. Lanjut tambahkan kamar.' : 'Perubahan kos disimpan');
    setTimeout(() => (location.href = baru ? `tambah-kamar?kos_id=${kos.id}` : './'), 800);
  } catch (err) {
    tampilGalatForm(form, err);
    form.querySelector('.salah')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    tombol.forEach((b) => (b.disabled = false));
  }
}

async function hapusKos() {
  const nama = form.elements.nama_kos.value;
  if (!confirm(`Hapus "${nama}" beserta semua kamarnya? Tindakan ini tidak bisa dibatalkan.`)) return;
  try {
    await api(`kos?id=${kosId}`, { method: 'DELETE' });
    try { localStorage.removeItem('kosinaja.kosAktif'); } catch { /* abaikan */ }
    toast('Kos dihapus');
    setTimeout(() => (location.href = './'), 700);
  } catch (err) {
    // Biasanya ditolak FK karena kamar punya riwayat reservasi
    toast(err.status === 409 ? 'Kos tidak bisa dihapus karena sudah punya riwayat reservasi. Simpan sebagai draf untuk menyembunyikannya.' : err.message, true);
  }
}
