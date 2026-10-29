// Reservasi Saya (Figma 471:5963) + modal Rating dan Ulasan (464:396).
// ?ulas=ID membuka modal ulasan langsung (dari tombol "Beri ulasan" di Detail Kos).
// Ulasan yang sudah dikirim bisa diubah atau dihapus lewat modal yang sama.

const MAKNA = ['', 'Buruk', 'Kurang', 'Cukup', 'Bagus', 'Sangat Bagus'];
const STATUS = {
  Pending: ['Menunggu konfirmasi pemilik', 'kuning'],
  Survei: ['Jadwal survei', 'biru'],
  Disetujui: ['Disetujui', 'hijau'],
  Ditolak: ['Ditolak', 'merah'],
  Dibatalkan: ['Dibatalkan', 'abu'],
  Kedaluwarsa: ['Kedaluwarsa', 'abu'],
  Selesai: ['Selesai', 'biru'],
};
let semua = [];
let tab = 'semua';
let diulas = null;
let rating = 0;

document.addEventListener('DOMContentLoaded', async () => {
  const akun = await Situs.mulai();
  if (!akun || akun.role !== 'penyewa') {
    Situs.mintaMasuk(akun ? 'Halaman ini khusus akun penyewa' : 'Masuk dulu untuk melihat reservasi');
    return;
  }
  document.querySelector('#tab-res').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    tab = b.dataset.tab;
    document.querySelectorAll('#tab-res button').forEach((x) => x.classList.toggle('aktif', x === b));
    render();
  });
  document.querySelector('#daftar-res').addEventListener('click', klikKartu);
  pasangModal();
  await muat();

  const ulas = Number(new URLSearchParams(location.search).get('ulas'));
  const r = semua.find((x) => x.id === ulas && x.bisa_diulas);
  if (r) bukaUlasan(r);
});

async function muat() {
  try {
    semua = await api('akun?bagian=reservasi');
  } catch (err) {
    document.querySelector('#daftar-res').innerHTML = `<div class="kosong-situs"><b>Gagal memuat</b>${esc(err.message)}</div>`;
    return;
  }
  const n = (k) => semua.filter((r) => kelompok(r) === k).length;
  document.querySelector('#s-menunggu').textContent = n('menunggu');
  document.querySelector('#s-aktif').textContent = n('aktif');
  document.querySelector('#s-riwayat').textContent = n('riwayat');
  document.querySelectorAll('[data-n]').forEach((el) => {
    el.textContent = el.dataset.n === 'semua' ? semua.length : n(el.dataset.n);
  });
  render();
}

/** Satu reservasi masuk satu tab saja. */
function kelompok(r) {
  const hariIni = new Date().toISOString().slice(0, 10);
  if (['Pending', 'Survei'].includes(r.status_reservasi)) return 'menunggu';
  if (r.status_reservasi === 'Disetujui') {
    if (r.tanggal_keluar <= hariIni) return 'riwayat';
    return r.tanggal_masuk <= hariIni ? 'aktif' : 'disetujui';
  }
  return 'riwayat';
}

function render() {
  const data = semua.filter((r) => tab === 'semua' || kelompok(r) === tab);
  document.querySelector('#daftar-res').innerHTML = data.map(kartu).join('') || `
    <div class="kosong-situs"><b>${semua.length ? 'Tidak ada reservasi di tab ini' : 'Belum ada reservasi'}</b>
      ${semua.length ? '' : 'Temukan kos yang cocok lalu ajukan sewa langsung ke pemilik.<br><br><a class="btn-utama" href="katalog">Jelajahi Katalog</a>'}</div>`;
}

function langkah(r) {
  const s = r.status_reservasi;
  const k = kelompok(r);
  if (['Ditolak', 'Dibatalkan', 'Kedaluwarsa'].includes(s)) return '';
  const tahap = ['Diajukan', 'Konfirmasi pemilik', ...(r.is_survei_dahulu ? ['Survei lokasi'] : []), 'Mulai tinggal'];
  // indeks tahap yang sedang berjalan
  let kini = 1;
  if (s === 'Survei') kini = 2;
  if (s === 'Disetujui') kini = k === 'disetujui' ? tahap.length - 1 : tahap.length;
  if (s === 'Selesai' || k === 'riwayat') kini = tahap.length;
  return `<div class="langkah-res">${tahap.map((t, i) => `
    ${i ? '<hr>' : ''}<span class="${i < kini ? 'selesai' : i === kini ? 'kini' : ''}"><i>${i < kini ? '✓' : i + 1}</i>${t}</span>`).join('')}</div>`;
}

function kartu(r) {
  const [label, warna] = STATUS[r.status_reservasi] || [r.status_reservasi, 'abu'];
  const k = kelompok(r);
  const labelStatus = k === 'aktif' ? 'Sedang ditempati' : label;
  const pesan = {
    menunggu: r.status_reservasi === 'Survei'
      ? `Survei dijadwalkan ${r.jadwal_survei ? tanggal(r.jadwal_survei.slice(0, 10)) + ' pukul ' + r.jadwal_survei.slice(11, 16) : 'segera'}.`
      : 'Pemilik biasanya merespons dalam 1×24 jam.',
    disetujui: `Siap masuk ${tanggal(r.tanggal_masuk)}. Koordinasikan pembayaran dengan pemilik.`,
    aktif: `Masa sewa berakhir ${tanggal(r.tanggal_keluar)}.`,
    riwayat: r.status_reservasi === 'Kedaluwarsa' ? 'Pemilik tidak merespons dalam 1×24 jam.' : '',
  }[k];

  const tombol = [];
  if (['Pending', 'Survei'].includes(r.status_reservasi)) tombol.push(`<button class="btn-garis btn-batal" data-batal="${r.id}">Batalkan</button>`);
  if (r.bisa_diulas) tombol.push(`<button class="btn-utama" data-ulas="${r.id}">★ Beri Ulasan</button>`);
  if (r.ulasan_rating) {
    tombol.push(`<span class="pill-label">Ulasanmu: ${'★'.repeat(r.ulasan_rating)}</span>`);
    tombol.push(`<button class="btn-garis" data-ulas="${r.id}">Ubah Ulasan</button>`);
  }
  if (r.pemilik_wa) tombol.push(`<a class="btn-garis btn-wa" target="_blank" rel="noopener" href="${esc(r.pemilik_wa)}?text=${encodeURIComponent(`Halo, saya ${Situs.akun.nama_lengkap} terkait reservasi ${r.kode_reservasi} di ${r.nama_kos}.`)}">Chat Pemilik</a>`);
  tombol.push(`<a class="btn-garis" href="detail-kos?id=${r.kos_id}&kamar=${r.kamar_id}">Lihat Kos</a>`);

  return `
    <article class="kartu-res">
      <div class="kartu-res-atas">
        <img src="${esc(fotoKos(r.foto, r.id))}" alt="" onerror="${CADANGAN_ONERROR(r.id)}">
        <div>
          <span class="status-res ${warna}">${labelStatus}</span>
          <h3>${esc(r.nama_kos)} · Kamar ${esc(r.nomor_kamar)}</h3>
          <div class="detail-res">
            <span>${SVG_S.pin} ${esc(r.alamat)}, ${esc(r.kecamatan)}</span>
            <span>Masuk <b>${tanggal(r.tanggal_masuk)}</b></span>
            <span>Durasi <b>${esc(r.durasi_label)}</b></span>
            <span>Kode <b>${esc(r.kode_reservasi)}</b></span>
          </div>
          ${r.catatan_pemilik ? `<div class="catatan-pemilik"><b>Catatan pemilik:</b> ${esc(r.catatan_pemilik)}</div>` : ''}
        </div>
        <div class="harga-res">
          <small>Total sewa</small>
          <b>${rupiah(r.total_biaya)}</b>
          <small>${r.status_reservasi === 'Disetujui' ? `Pembayaran: ${esc(r.status_pembayaran)}` : `Diajukan ${tanggal(r.created_at.slice(0, 10))}`}</small>
        </div>
      </div>
      ${langkah(r)}
      <div class="kaki-res"><span>${esc(pesan)}</span><div class="tombol">${tombol.join('')}</div></div>
    </article>`;
}

async function klikKartu(e) {
  const batal = e.target.closest('[data-batal]');
  if (batal) {
    if (!confirm('Batalkan pengajuan ini? Kamar bisa langsung dipesan orang lain.')) return;
    batal.disabled = true;
    try {
      await api(`akun?bagian=reservasi&id=${batal.dataset.batal}`, { method: 'PATCH' });
      toast('Pengajuan dibatalkan');
      await muat();
    } catch (err) {
      toast(err.message, true);
      batal.disabled = false;
    }
    return;
  }
  const ulas = e.target.closest('[data-ulas]');
  if (ulas) bukaUlasan(semua.find((r) => r.id === Number(ulas.dataset.ulas)));
}

// ---------- Modal ulasan ----------

function pasangModal() {
  const modal = document.querySelector('#modal-ulasan');
  const form = document.querySelector('#form-ulasan');
  const bintang = document.querySelector('#bintang-pilih');
  bintang.innerHTML = [1, 2, 3, 4, 5].map((n) =>
    `<button type="button" data-bintang="${n}" role="radio" aria-checked="false" aria-label="${n} bintang">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor"><path d="m12 2 3 6.6 7 .7-5.3 4.8 1.6 7L12 17.5 5.7 21l1.6-7L2 9.3l7-.7z"/></svg></button>`).join('');
  bintang.addEventListener('click', (e) => {
    const b = e.target.closest('[data-bintang]');
    if (b) setRating(Number(b.dataset.bintang));
  });

  const area = form.elements.komentar;
  area.addEventListener('input', () => { document.querySelector('#jumlah-karakter').textContent = `${area.value.length}/1000`; });
  modal.addEventListener('click', (e) => { if (e.target === modal || e.target.closest('[data-tutup]')) tutupUlasan(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) tutupUlasan(); });

  const tombolHapus = document.querySelector('#btn-hapus-ulasan');
  tombolHapus.addEventListener('click', async () => {
    if (!confirm('Hapus ulasan ini? Kamu bisa menulis ulasan baru setelahnya.')) return;
    tombolHapus.disabled = true;
    try {
      await api(`akun?bagian=ulasan&id=${diulas.ulasan_id}`, { method: 'DELETE' });
      toast('Ulasan dihapus');
      tutupUlasan();
      await muat();
    } catch (err) {
      toast(err.message, true);
    } finally {
      tombolHapus.disabled = false;
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!rating) { toast('Pilih jumlah bintang dulu', true); return; }
    const tombol = form.querySelector('[type="submit"]');
    tombol.disabled = true;
    try {
      const komentar = area.value.trim();
      if (diulas.ulasan_id) {
        await api(`akun?bagian=ulasan&id=${diulas.ulasan_id}`, { method: 'PUT', body: { rating, komentar } });
        toast('Ulasan diperbarui');
      } else {
        await api('akun?bagian=ulasan', { method: 'POST', body: { reservasi_id: diulas.id, rating, komentar } });
        toast('Terima kasih atas ulasannya!');
      }
      tutupUlasan();
      await muat();
    } catch (err) {
      toast(err.message, true);
    } finally {
      tombol.disabled = false;
    }
  });
}

function setRating(n) {
  rating = n;
  document.querySelectorAll('[data-bintang]').forEach((b) => {
    const nyala = Number(b.dataset.bintang) <= n;
    b.classList.toggle('nyala', nyala);
    b.setAttribute('aria-checked', String(Number(b.dataset.bintang) === n));
  });
  document.querySelector('#makna-rating').textContent = n ? MAKNA[n] : '-';
  document.querySelector('#nilai-rating').textContent = n ? `${n} dari 5 bintang` : 'Belum dipilih';
}

function bukaUlasan(r) {
  diulas = r;
  const ubah = Boolean(r.ulasan_id);
  const form = document.querySelector('#form-ulasan');
  document.querySelector('#nama-diulas').textContent = `${r.nama_kos} · Kamar ${r.nomor_kamar}`;
  document.querySelector('#judul-ulasan').textContent = ubah ? 'Ubah Rating & Ulasan' : 'Beri Rating & Ulasan';
  document.querySelector('#btn-kirim-ulasan').textContent = ubah ? 'Simpan Perubahan' : 'Kirim Ulasan';
  document.querySelector('#btn-hapus-ulasan').hidden = !ubah;
  form.reset();
  form.elements.komentar.value = ubah ? r.ulasan_komentar || '' : '';
  document.querySelector('#jumlah-karakter').textContent = `${form.elements.komentar.value.length}/1000`;
  setRating(ubah ? r.ulasan_rating : 0);
  document.querySelector('#modal-ulasan').hidden = false;
  document.querySelector('[data-bintang="5"]').focus();
}

function tutupUlasan() {
  document.querySelector('#modal-ulasan').hidden = true;
  const url = new URL(location.href);
  url.searchParams.delete('ulas');
  history.replaceState(null, '', url);
}
