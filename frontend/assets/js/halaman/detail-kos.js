// Detail Kos (Figma 464:3035 sebelum login, 464:2418 sesudah login). ?id=kos&kamar=kamar_id
// Kontak WhatsApp pemilik hanya dikirim backend kalau pengunjung sudah login.

const LABEL_STATUS = { Tersedia: 'Kosong', Dipesan: 'Sudah dipesan', Terisi: 'Terisi', Perbaikan: 'Perbaikan' };
let kos;
let kamar;   // kamar yang sedang dipilih

document.addEventListener('DOMContentLoaded', async () => {
  await Situs.mulai();
  const p = new URLSearchParams(location.search);
  const wadah = document.querySelector('#isi-detail');
  try {
    kos = await api(`katalog?id=${Number(p.get('id'))}`);
  } catch (err) {
    wadah.querySelector('#memuat').innerHTML = `<b>Kos tidak ditemukan</b>${esc(err.message)}<br><br><a class="btn-utama" href="katalog">Kembali ke katalog</a>`;
    return;
  }

  document.title = `${kos.nama_kos} - KosinAja`;
  document.querySelector('#jejak-nama').textContent = kos.nama_kos;
  wadah.querySelector('#memuat').remove();
  wadah.appendChild(document.querySelector('#tpl-detail').content.cloneNode(true));

  renderKepala();
  renderGaleri();
  renderLokasi();
  renderUlasan();
  pasangForm();
  pilihKamar(Number(p.get('kamar')) || (kos.kamar.find((k) => k.status === 'Tersedia') || kos.kamar[0])?.id);

  // Konten dirender setelah fetch, jadi lompatan #ulasan dari dashboard pemilik dilakukan manual
  if (location.hash) document.querySelector(location.hash)?.scrollIntoView();

  wadah.addEventListener('click', (e) => {
    const b = e.target.closest('[data-kamar]');
    if (!b) return;
    pilihKamar(Number(b.dataset.kamar));
    if (b.closest('.kamar-lain')) wadah.querySelector('.tata-detail').scrollIntoView({ behavior: 'smooth' });
  });
});

const isi = (nama) => document.querySelector(`[data-isi="${nama}"]`);

function renderKepala() {
  isi('tipe').textContent = `Kos ${LABEL_TIPE[kos.tipe_kos]}`;
  isi('nama').textContent = kos.nama_kos;
  const u = kos.ulasan;
  const rata = u.total ? (Object.entries(u.sebaran).reduce((n, [b, j]) => n + b * j, 0) / u.total) : null;
  isi('info').innerHTML = `
    <span>${SVG_S.pin}${esc(kos.alamat)}, ${esc(kos.kecamatan)}</span>
    ${kos.jarak_kampus_km !== null ? `<span>🎓 ${kos.jarak_kampus_km.toLocaleString('id-ID')} km ke kampus</span>` : ''}
    <span>★ ${rata ? `${rata.toLocaleString('id-ID', { maximumFractionDigits: 1 })} (${u.total} ulasan)` : 'Belum ada ulasan'}</span>
    <span>Pemilik: ${esc(kos.pemilik_nama)}</span>`;

  const fav = document.querySelector('#btn-favorit-detail');
  const tandai = (aktif) => {
    fav.classList.toggle('aktif', aktif);
    fav.querySelector('span').textContent = aktif ? 'Tersimpan' : 'Simpan';
  };
  tandai(kos.is_favorit);
  fav.addEventListener('click', async () => {
    if (!Situs.akun) return Situs.mintaMasuk('Masuk dulu untuk menyimpan kos favorit');
    if (Situs.akun.role !== 'penyewa') return toast('Favorit hanya untuk akun penyewa', true);
    const jadi = !kos.is_favorit;
    try {
      await api(jadi ? 'akun?bagian=favorit' : `akun?bagian=favorit&kos_id=${kos.id}`,
        { method: jadi ? 'POST' : 'DELETE', body: jadi ? { kos_id: kos.id } : undefined });
      kos.is_favorit = jadi;
      tandai(jadi);
      toast(jadi ? 'Disimpan ke favorit' : 'Dihapus dari favorit');
    } catch (err) { toast(err.message, true); }
  });

  document.querySelector('#btn-bagikan').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      toast('Link kos disalin');
    } catch {
      prompt('Salin link berikut:', location.href);
    }
  });
}

function renderGaleri() {
  // 1 foto besar + 4 kecil: foto gedung dulu, lalu foto kamar
  const foto = [
    ...kos.foto.map((f) => ({ src: f.url_foto, ket: f.kategori })),
    ...kos.kamar.flatMap((k) => k.foto.map((src) => ({ src, ket: `Kamar ${k.nomor_kamar}` }))),
  ].slice(0, 5);
  while (foto.length < 5) foto.push({ src: null, ket: '' });
  isi('galeri').innerHTML = foto.map((f, i) => `
    <figure><img src="${esc(fotoKos(f.src, i))}" alt="${esc(f.ket || kos.nama_kos)}" onerror="${CADANGAN_ONERROR(i)}">
      ${f.ket ? `<figcaption>${esc(f.ket)}</figcaption>` : ''}</figure>`).join('');
}

function pilihKamar(id) {
  kamar = kos.kamar.find((k) => k.id === id) || kos.kamar[0];
  const url = new URL(location.href);
  if (kamar) url.searchParams.set('kamar', kamar.id);
  history.replaceState(null, '', url);

  if (!kamar) {
    isi('pilih-kamar').innerHTML = '<p>Belum ada kamar yang dipublikasikan.</p>';
    document.querySelector('#form-sewa').hidden = true;
    return;
  }

  isi('pilih-kamar').innerHTML = kos.kamar.map((k) => `
    <button type="button" data-kamar="${k.id}" class="${k.id === kamar.id ? 'aktif' : ''} ${k.status === 'Perbaikan' ? 'perbaikan' : ''}">
      Kamar ${esc(k.nomor_kamar)}<small>${esc(k.tipe_kamar)} · ${LABEL_STATUS[k.status] || k.status}</small></button>`).join('');

  const spek = [
    ['Ukuran', k_ukuran(kamar)], ['Lantai', kamar.lantai === 0 ? 'Dasar' : kamar.lantai ?? '-'],
    ['Kamar Mandi', kamar.kamar_mandi ? `${kamar.kamar_mandi}` : '-'], ['Kasur', kamar.tipe_kasur || '-'],
    ['Listrik', kamar.listrik || '-'], ['Ventilasi', kamar.ventilasi || '-'],
    ['Minimal Sewa', `${kamar.minimal_sewa_bulan} Bulan`], ['Status', LABEL_STATUS[kamar.status] || kamar.status],
  ];
  isi('spek').innerHTML = spek.map(([a, b]) => `<div><span>${a}</span><b>${esc(b)}</b></div>`).join('');

  isi('deskripsi').innerHTML = [kos.deskripsi, kamar.deskripsi_suasana].filter(Boolean).map(esc).join('<br><br>') || 'Pemilik belum menulis deskripsi.';

  const grup = (judul, daftar) => daftar.length
    ? `<h3>${judul}</h3><ul class="daftar-fasilitas">${daftar.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : '';
  const fasKamar = kamar.fasilitas.filter((f) => !/mandi/i.test(f.kategori)).map((f) => f.nama);
  const fasKm = kamar.fasilitas.filter((f) => /mandi/i.test(f.kategori)).map((f) => f.nama);
  isi('fasilitas').innerHTML = (grup('1. Fasilitas Kamar', fasKamar) + grup('2. Fasilitas Kamar Mandi', fasKm) +
    grup('3. Fasilitas Bersama', kos.fasilitas_bersama.map((f) => f.nama_fasilitas))) || '<p>Belum ada data fasilitas.</p>';

  const aturan = [kos.peraturan_kos, kamar.peraturan_kamar].filter(Boolean).join('\n').split('\n').map((s) => s.trim()).filter(Boolean);
  isi('aturan').innerHTML = aturan.map((a) => `<li>${esc(a)}</li>`).join('') || '<li>Tidak ada peraturan khusus.</li>';

  isi('harga').textContent = rupiah(kamar.harga_per_bulan);
  const durasi = document.querySelector('[name="durasi_sewa_bulan"]');
  const pilihan = [1, 3, 6, 12].filter((n) => n >= kamar.minimal_sewa_bulan);
  if (!pilihan.includes(kamar.minimal_sewa_bulan)) pilihan.unshift(kamar.minimal_sewa_bulan);
  durasi.innerHTML = pilihan.map((n) => `<option value="${n}">${labelDurasi(n)}${n === 1 ? ' - Fleksibel Mahasiswa' : n === 6 ? ' - Per Semester' : ''}</option>`).join('');
  renderRincian();

  const lain = kos.kamar.filter((k) => k.id !== kamar.id);
  isi('kamar-lain').innerHTML = lain.map((k, i) => `
    <button type="button" class="kartu-kamar-lain" data-kamar="${k.id}">
      <img src="${esc(fotoKos(k.foto[0], i + 1))}" alt="" onerror="${CADANGAN_ONERROR(i + 1)}" loading="lazy">
      <span class="isi"><span><b>Kamar ${esc(k.nomor_kamar)}</b><small>${esc(k.tipe_kamar)} · ${LABEL_STATUS[k.status] || k.status}</small></span>
        <span class="harga"><b>${rupiah(k.harga_per_bulan)}</b><span>/bln</span></span></span>
    </button>`).join('') || '<p class="sel-sub">Tidak ada kamar lain di kos ini.</p>';
  document.querySelector('#btn-ajukan').disabled = kamar.status === 'Perbaikan';
}

const k_ukuran = (k) => (k.panjang_m && k.lebar_m ? `${k.panjang_m} x ${k.lebar_m} m` : '-');

function renderRincian() {
  if (!kamar) return;
  const n = Number(document.querySelector('[name="durasi_sewa_bulan"]').value || 1);
  const sewa = kamar.harga_per_bulan * n;
  const deposit = kamar.deposit_kunci || 0;
  isi('rincian').innerHTML = `
    <h4>RINCIAN ESTIMASI BIAYA</h4>
    <div><span>${rupiah(kamar.harga_per_bulan)} × ${labelDurasi(n)}</span><span>${rupiah(sewa)}</span></div>
    <div><span>Deposit kunci (dikembalikan)</span><span>${rupiah(deposit)}</span></div>
    <div class="total"><span>Total Pembayaran Pertama</span><b>${rupiah(sewa + deposit)}</b></div>`;
}

function renderLokasi() {
  const ada = kos.latitude !== null && kos.longitude !== null;
  const q = ada ? `${kos.latitude},${kos.longitude}` : `${kos.alamat}, ${kos.kecamatan}, ${kos.kota}`;
  const linkMaps = kos.google_maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  isi('lokasi').innerHTML = `
    <iframe title="Peta lokasi ${esc(kos.nama_kos)}" loading="lazy" referrerpolicy="no-referrer"
      src="https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=16&output=embed"></iframe>
    <div class="info"><span>Jarak ke kampus</span><b>${kos.jarak_kampus_km !== null ? `${kos.jarak_kampus_km.toLocaleString('id-ID')} km` : '-'}</b></div>
    <div class="info"><span>Kecamatan</span><b>${esc(kos.kecamatan)}, ${esc(kos.kota)}</b></div>
    <a class="btn-garis" href="${esc(linkMaps)}" target="_blank" rel="noopener">Buka di Google Maps</a>`;
}

function renderUlasan() {
  const u = kos.ulasan;
  if (!u.total) {
    isi('ulasan').innerHTML = '<p>Belum ada ulasan. Ulasan hanya bisa ditulis penghuni yang sudah selesai menyewa.</p>';
  } else {
    const rata = Object.entries(u.sebaran).reduce((n, [b, j]) => n + b * j, 0) / u.total;
    isi('ulasan').innerHTML = `
      <div class="ringkas-ulasan">
        <span class="angka">${rata.toLocaleString('id-ID', { maximumFractionDigits: 1 })}</span>
        <div><span class="bintang">${'★'.repeat(Math.round(rata))}${'☆'.repeat(5 - Math.round(rata))}</span>
          <small>${rata.toLocaleString('id-ID', { maximumFractionDigits: 1 })} dari ${u.total} ulasan penghuni KosinAja</small></div>
      </div>
      ${u.items.map((r) => `
        <div class="ulasan">
          <div class="ulasan-kepala"><span class="avatar">${esc(r.penyewa_inisial)}</span>
            <div><b>${esc(r.penyewa_nama)}</b><small>Kamar ${esc(r.nomor_kamar)} · ${tanggal(r.created_at.slice(0, 10))}</small></div>
            <span class="bintang">${'★'.repeat(r.rating)}</span></div>
          ${r.komentar ? `<p>"${esc(r.komentar)}"</p>` : ''}
        </div>`).join('')}`;
  }

  document.querySelector('#btn-beri-ulasan').addEventListener('click', async () => {
    if (!Situs.akun) return Situs.mintaMasuk('Masuk dulu untuk memberi ulasan');
    if (Situs.akun.role !== 'penyewa') return toast('Ulasan hanya untuk akun penyewa', true);
    const daftar = await api('akun?bagian=reservasi').catch(() => []);
    const bisa = daftar.find((r) => r.kos_id === kos.id && r.bisa_diulas);
    if (bisa) location.href = `reservasi-saya?ulas=${bisa.id}`;
    else toast('Ulasan bisa ditulis setelah masa sewamu di kos ini selesai.', true);
  });
}

function pasangForm() {
  const form = document.querySelector('#form-sewa');
  const besok = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  form.elements.tanggal_masuk.min = new Date().toISOString().slice(0, 10);
  form.elements.tanggal_masuk.value = besok;
  form.elements.durasi_sewa_bulan.addEventListener('change', renderRincian);
  form.elements.is_survei_dahulu.addEventListener('change', (e) => {
    document.querySelector('#field-survei').hidden = !e.target.checked;
  });

  const wa = document.querySelector('#btn-wa');
  const catatan = isi('catatan');
  if (kos.pemilik_wa) {
    wa.href = `${kos.pemilik_wa}?text=${encodeURIComponent(`Halo, saya tertarik dengan ${kos.nama_kos} (KosinAja). Apakah kamar masih tersedia?`)}`;
  } else {
    wa.removeAttribute('target');
    wa.addEventListener('click', (e) => { e.preventDefault(); Situs.mintaMasuk('Masuk untuk melihat kontak pemilik'); });
    catatan.textContent = 'Masuk sebagai penyewa untuk mengajukan sewa dan menghubungi pemilik.';
  }
  if (Situs.akun?.role === 'admin') catatan.textContent = 'Anda masuk sebagai pemilik. Reservasi hanya bisa diajukan akun penyewa.';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!Situs.akun) return Situs.mintaMasuk('Masuk dulu untuk mengajukan reservasi');
    if (Situs.akun.role !== 'penyewa') return toast('Reservasi hanya untuk akun penyewa', true);

    const survei = form.elements.is_survei_dahulu.checked;
    const body = {
      kamar_id: kamar.id,
      tanggal_masuk: form.elements.tanggal_masuk.value,
      durasi_sewa_bulan: Number(form.elements.durasi_sewa_bulan.value),
      is_survei_dahulu: survei,
    };
    if (survei && form.elements.jadwal_survei.value) body.jadwal_survei = form.elements.jadwal_survei.value.replace('T', ' ') + ':00';

    const tombol = document.querySelector('#btn-ajukan');
    tombol.disabled = true;
    try {
      const hasil = await api('akun?bagian=reservasi', { method: 'POST', body });
      toast(`Reservasi ${hasil.kode_reservasi} terkirim. Pemilik merespons maks. 1x24 jam.`);
      setTimeout(() => (location.href = 'reservasi-saya'), 1200);
    } catch (err) {
      tampilGalatForm(form, err);
      tombol.disabled = false;
    }
  });
}
