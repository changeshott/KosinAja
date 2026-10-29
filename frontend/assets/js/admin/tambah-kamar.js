// Tambah / Edit Kamar (Figma 464:4618). ?id=3 = mode edit (ada tombol Hapus Kamar).
// Alur simpan: POST/PUT api/kamar -> unggah foto baru satu per satu -> kembali ke Kelola Kamar.

const PERATURAN_BAKU = [
  'Khusus Mahasiswi / Putri',
  'Khusus Mahasiswa / Putra',
  'Tamu Lawan Jenis di Ruang Tamu Depan',
  'Tanpa Hewan Peliharaan',
  'Dilarang Merokok & Bebas Narkoba',
];
// Ikon & judul grup fasilitas mengikuti kategori di tabel fasilitas
const GRUP_FASILITAS = {
  'Fasilitas Kamar Tidur': { judul: 'A. Fasilitas Kamar Tidur', ikon: 'grup-kamar-tidur.svg', w: 15, h: 10.5 },
  'Fasilitas Kamar Mandi Dalam': { judul: 'B. Fasilitas Kamar Mandi Dalam', ikon: 'grup-kamar-mandi.svg', w: 10.5, h: 13.5 },
  'Fasilitas Bersama': { judul: 'C. Fasilitas Bersama & Gedung Kos', ikon: 'grup-gedung.svg', w: 13.5, h: 13.5 },
};

let kamarId = Number(new URLSearchParams(location.search).get('id')) || null;
let kamarLama = null;
let galeri;

const form = document.querySelector('#form-kamar');

document.addEventListener('DOMContentLoaded', async () => {
  if (!(await Panel.mulai())) return;
  galeri = buatGaleri({ jenis: 'kamar', label: ['Foto Utama', 'Kamar Mandi', 'Area Belajar', 'Penyimpanan'] });

  try {
    const [fasilitas, kamarKos, kos] = await Promise.all([
      api('fasilitas'),
      api(`kamar?kos_id=${Panel.kosId}`),
      api(`kos?id=${Panel.kosId}`),
    ]);
    document.querySelector('#daftar-tipe').innerHTML = [...new Set(kamarKos.map((k) => k.tipe_kamar))]
      .map((t) => `<option value="${esc(t)}">`).join('');
    if (kamarId) {
      kamarLama = await api(`kamar?id=${kamarId}`);
      if (kamarLama.kos_id !== Panel.kosId) Panel.gantiKos(kamarLama.kos_id);
    }
    renderFasilitas(fasilitas, kos.fasilitas.map((f) => f.id));
    renderPeraturan();
    if (kamarLama) isiForm(kamarLama);
  } catch (err) {
    toast(err.message || 'Gagal memuat form', true);
  }

  form.addEventListener('input', perbaruiInfoUkuran);
  form.addEventListener('submit', simpan);
  form.querySelector('#harga').addEventListener('input', formatHarga);
  document.querySelector('#btn-hapus').addEventListener('click', hapusKamar);
  perbaruiInfoUkuran();
});

function renderFasilitas(grup, idBersamaKos) {
  const dicentang = new Set(kamarLama ? kamarLama.fasilitas.map((f) => f.id) : []);
  document.querySelector('#grup-fasilitas').innerHTML = grup.map(({ kategori, items }) => {
    const info = GRUP_FASILITAS[kategori] || { judul: kategori, ikon: 'grup-gedung.svg', w: 13.5, h: 13.5 };
    const bersama = items[0]?.lingkup === 'bersama';
    // Untuk kamar baru, fasilitas kamar dicentang semua sebagai titik awal (seperti di desain)
    const cek = (f) => (bersama ? idBersamaKos.includes(f.id) : kamarLama ? dicentang.has(f.id) : !/TV/.test(f.nama_fasilitas));
    return `
      <div class="grup-cek" data-kategori="${esc(kategori)}" data-lingkup="${bersama ? 'bersama' : 'kamar'}">
        <h3><img src="../assets/img/${info.ikon}" width="${info.w}" height="${info.h}" alt="">${esc(info.judul)}</h3>
        ${bersama ? '<p class="catatan-grup">Berlaku untuk semua kamar di kos ini.</p>' : ''}
        <div class="grid-cek">
          ${items.map((f) => `<label class="cek"><input type="checkbox" value="${f.id}" ${cek(f) ? 'checked' : ''}> <span>${esc(f.nama_fasilitas)}</span></label>`).join('')}
          <label class="cek manual"><input type="checkbox" data-manual> <span><b>Isi Manual</b></span></label>
        </div>
        <input class="input input-manual" placeholder="Nama fasilitas lain, pisahkan dengan koma" hidden>
      </div>`;
  }).join('');

  document.querySelectorAll('[data-manual]').forEach((cb) => cb.addEventListener('change', () => {
    const input = cb.closest('.grup-cek').querySelector('.input-manual');
    input.hidden = !cb.checked;
    if (cb.checked) input.focus();
  }));
}

function renderPeraturan() {
  const box = document.querySelector('#cek-peraturan');
  box.innerHTML = PERATURAN_BAKU.map((p) => `<label class="cek"><input type="checkbox" value="${esc(p)}"> <span>${esc(p)}</span></label>`).join('') +
    '<label class="cek"><input type="checkbox" id="cek-tambah-manual"> <span>Tambah Manual</span></label>';
  const manual = document.querySelector('#field-peraturan-manual');
  const cek = document.querySelector('#cek-tambah-manual');
  cek.addEventListener('change', () => (manual.hidden = !cek.checked));
  manual.hidden = true;
}

function isiForm(k) {
  document.title = `Edit Kamar ${k.nomor_kamar} - KosinAja`;
  document.querySelector('#judul-form').textContent = `Edit Kamar ${k.nomor_kamar}`;
  document.querySelector('#crumb-akhir').textContent = `Edit Kamar ${k.nomor_kamar}`;
  document.querySelector('#btn-hapus').hidden = false;
  const d = k.detail || {};
  const set = (nama, nilai) => { if (nilai != null && form.elements[nama]) form.elements[nama].value = nilai; };
  set('nomor_kamar', k.nomor_kamar);
  set('tipe_kamar', k.tipe_kamar);
  set('harga_per_bulan', Number(k.harga_per_bulan).toLocaleString('id-ID'));
  ['lantai', 'panjang_m', 'lebar_m', 'minimal_sewa_bulan', 'deskripsi_suasana'].forEach((n) => set(n, d[n]));
  // Nilai lama di luar pilihan dropdown tetap ditampilkan sebagai opsi tambahan
  ['tipe_kasur', 'listrik', 'ventilasi'].forEach((n) => {
    if (!d[n]) return;
    const sel = form.elements[n];
    if (![...sel.options].some((o) => o.value === d[n])) sel.add(new Option(d[n], d[n]));
    sel.value = d[n];
  });
  form.querySelectorAll('[name="kamar_mandi"]').forEach((r) => (r.checked = r.value === d.kamar_mandi));
  form.querySelectorAll('[name="status_awal"]').forEach((r) => (r.checked = (r.value === 'perbaikan') === (k.status === 'Perbaikan')));

  const baris = (d.peraturan_kamar || '').split('\n').map((s) => s.trim()).filter(Boolean);
  const lain = [];
  baris.forEach((p) => {
    const cb = [...document.querySelectorAll('#cek-peraturan input[value]')].find((c) => c.value === p);
    if (cb) cb.checked = true; else lain.push(p);
  });
  if (lain.length) {
    document.querySelector('#cek-tambah-manual').checked = true;
    document.querySelector('#field-peraturan-manual').hidden = false;
    document.querySelector('#peraturan_manual').value = lain.join('\n');
  }

  galeri.isi(k.foto);
}

function perbaruiInfoUkuran() {
  const p = Number(form.elements.panjang_m.value), l = Number(form.elements.lebar_m.value);
  if (p > 0 && l > 0) {
    const fmt = (n) => n.toLocaleString('id-ID', { maximumFractionDigits: 2 });
    document.querySelector('#info-ukuran').textContent = `Format display: ${fmt(l)} x ${fmt(p)} Meter (${fmt(p * l)} m²)`;
  }
}

function formatHarga(e) {
  const angka = e.target.value.replace(/\D/g, '');
  e.target.value = angka ? Number(angka).toLocaleString('id-ID') : '';
}

// ---------- Simpan ----------

/** Fasilitas "Isi Manual" dibuat dulu di master fasilitas, lalu id-nya ikut dicentang. */
async function idFasilitasManual(grup) {
  const input = grup.querySelector('.input-manual');
  if (input.hidden || !input.value.trim()) return [];
  const nama = input.value.split(',').map((s) => s.trim()).filter(Boolean);
  const hasil = await Promise.all(nama.map((n) => api('fasilitas', {
    method: 'POST',
    body: { nama_fasilitas: n, kategori: grup.dataset.kategori, lingkup: grup.dataset.lingkup },
  })));
  return hasil.map((f) => f.id);
}

async function kumpulkanData(publish) {
  const f = form.elements;
  const kamarIds = [], bersamaIds = [];
  for (const grup of document.querySelectorAll('.grup-cek')) {
    const target = grup.dataset.lingkup === 'bersama' ? bersamaIds : kamarIds;
    grup.querySelectorAll('input[type="checkbox"][value]:checked').forEach((c) => target.push(Number(c.value)));
    target.push(...(await idFasilitasManual(grup)));
  }
  const peraturan = [...document.querySelectorAll('#cek-peraturan input[value]:checked')].map((c) => c.value);
  if (document.querySelector('#cek-tambah-manual').checked) {
    peraturan.push(...document.querySelector('#peraturan_manual').value.split('\n').map((s) => s.trim()).filter(Boolean));
  }

  return {
    kos_id: Panel.kosId,
    nomor_kamar: f.nomor_kamar.value,
    tipe_kamar: f.tipe_kamar.value,
    harga_per_bulan: f.harga_per_bulan.value.replace(/\D/g, ''),
    is_published: publish,
    lantai: f.lantai.value,
    panjang_m: f.panjang_m.value,
    lebar_m: f.lebar_m.value,
    tipe_kasur: f.tipe_kasur.value,
    listrik: f.listrik.value,
    ventilasi: f.ventilasi.value,
    kamar_mandi: form.querySelector('[name="kamar_mandi"]:checked').value,
    minimal_sewa_bulan: f.minimal_sewa_bulan.value,
    deskripsi_suasana: f.deskripsi_suasana.value,
    peraturan_kamar: peraturan.join('\n'),
    fasilitas_ids: [...new Set(kamarIds)],
    fasilitas_bersama_ids: [...new Set(bersamaIds)],
    perbaikan: form.querySelector('[name="status_awal"]:checked').value === 'perbaikan',
  };
}

async function simpan(e) {
  e.preventDefault();
  const publish = e.submitter?.dataset.publish === '1';
  const tombol = form.querySelectorAll('button[type="submit"]');
  tombol.forEach((b) => (b.disabled = true));
  try {
    const data = await kumpulkanData(publish);
    const kamar = kamarId
      ? await api(`kamar?id=${kamarId}`, { method: 'PUT', body: data })
      : await api('kamar', { method: 'POST', body: data });
    // Kalau unggah foto gagal di tengah jalan, simpan ulang harus jadi edit, bukan kamar baru lagi
    if (!kamarId) {
      kamarId = kamar.id;
      history.replaceState(null, '', `?id=${kamar.id}`);
    }

    await galeri.unggah(kamar.id);
    toast(publish ? 'Kamar dipublikasikan' : 'Kamar disimpan sebagai draf');
    setTimeout(() => (location.href = 'kamar'), 700);
  } catch (err) {
    tampilGalatForm(form, err);
    form.querySelector('.salah')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    tombol.forEach((b) => (b.disabled = false));
  }
}

/** Kamar yang sudah punya riwayat reservasi ditolak database (FK RESTRICT), cukup jadikan Draf. */
async function hapusKamar() {
  const nomor = form.elements.nomor_kamar.value;
  if (!confirm(`Hapus kamar ${nomor} beserta foto, fasilitas, dan inventarisnya? Tindakan ini tidak bisa dibatalkan.`)) return;
  const tombol = document.querySelector('#btn-hapus');
  tombol.disabled = true;
  try {
    await api(`kamar?id=${kamarId}`, { method: 'DELETE' });
    toast(`Kamar ${nomor} dihapus`);
    setTimeout(() => (location.href = 'kamar'), 700);
  } catch (err) {
    toast(err.status === 409 ? 'Kamar tidak bisa dihapus karena sudah punya riwayat reservasi. Simpan sebagai Draf untuk menyembunyikannya.' : err.message, true);
    tombol.disabled = false;
  }
}
