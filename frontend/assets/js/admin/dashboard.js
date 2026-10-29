// Dashboard pengelola. Semua data dari GET api/dashboard?kos_id=...

const $ = (sel) => document.querySelector(sel);
const LABEL_TIPE_KOS = { pria: 'Kost Putra', wanita: 'Kost Putri', campuran: 'Kost Campuran' };

let kosAktifId = null;

document.addEventListener('DOMContentLoaded', async () => {
  pasangIkon(document);
  if (!(await Panel.mulai())) return;

  $('#pilih-kos').addEventListener('change', (e) => muat(Number(e.target.value)));
  document.addEventListener('kos-berganti', (e) => muat(e.detail));
  muat(Panel.kosId);
});

async function muat(kosId) {
  const konten = $('#konten');
  konten.classList.add('memuat');
  try {
    const data = await api('dashboard' + (kosId ? `?kos_id=${kosId}` : ''));
    kosAktifId = data.kos_aktif?.id ?? null;
    if (kosAktifId) Panel.gantiKos(kosAktifId);
    render(data);
  } catch (err) {
    tampilGalat(err.message || 'Gagal memuat dashboard');
  } finally {
    konten.classList.remove('memuat');
  }
}

function render(d) {
  $('#sapaan').textContent = d.admin.nama_lengkap;

  if (!d.kos_aktif) {
    // Pemilik belum punya kos: tampilkan hanya ajakan menambah kos
    $('#hero-alamat').textContent = 'Belum ada properti terdaftar';
    $('#pilih-kos').innerHTML = '<option>-</option>';
    ['#statistik', '#ringkasan', '#rating', '#tabel-reservasi'].forEach((s) => ($(s).innerHTML = ''));
    renderPortofolio([]);
    return;
  }

  renderHero(d);
  renderStatistik(d.statistik);
  renderRingkasan(d.ringkasan_tipe, d.kos_aktif.nama_kos);
  renderRating(d.rating);
  renderReservasi(d.reservasi_terbaru, d.total_reservasi);
  renderPortofolio(d.properti);
  pasangIkon(document);
}

function renderHero({ kos_aktif: kos, properti }) {
  $('#badges').innerHTML = `
    <span class="badge badge-biru"><span data-ikon="centang"></span>Terdaftar</span>
    ${kos.is_published
      ? '<span class="badge badge-hijau">Aktif Disewakan</span>'
      : '<span class="badge badge-biru">Draft (belum tampil di katalog)</span>'}`;
  $('#hero-alamat').textContent = `${kos.nama_kos} • ${kos.alamat}`;

  $('#pilih-kos').innerHTML = properti
    .map((p, i) => `<option value="${p.id}" ${p.id === kos.id ? 'selected' : ''}>${esc(p.nama_kos)} (Cabang ${i + 1})</option>`)
    .join('');
}

function renderStatistik(s) {
  const kartu = [
    { judul: 'Total Unit Kamar', ikon: 'gedung', nilai: s.total_unit, ket: 'Kamar' },
    { judul: 'Kamar Terisi', ikon: 'orang', nilai: s.terisi, ket: `/ ${s.total_unit} Kamar` },
    { judul: 'Kamar Siap Huni', ikon: 'pintu', nilai: s.siap_huni, ket: 'Unit Kosong', kelas: 'biru' },
    { judul: 'Pengajuan Reservasi', ikon: 'papan', nilai: s.pengajuan_reservasi, ket: 'Calon Penyewa', kelas: 'oranye', ikonKelas: 'ikon-oranye' },
    { judul: 'Estimasi Omzet', ikon: 'uang', nilai: rupiahSingkat(s.estimasi_omzet_bulanan), ket: '/ bulan', kelas: 'uang' },
  ];
  $('#statistik').innerHTML = kartu.map((k) => `
    <div class="kartu stat">
      <div class="stat-atas">
        <span class="stat-judul">${k.judul}</span>
        <span class="stat-ikon ${k.ikonKelas || 'ikon-biru'}" data-ikon="${k.ikon}"></span>
      </div>
      <div class="stat-nilai ${k.kelas || ''}"><b>${k.nilai}</b><span>${k.ket}</span></div>
    </div>`).join('');
}

function renderRingkasan(r, namaKos) {
  $('#ringkasan-sub').textContent = `Sebaran keterisian unit kos per tipe kamar di ${namaKos}`;
  $('#periode').textContent = 'Per ' + new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  if (!r.total) {
    $('#ringkasan').innerHTML = '<p class="kosong">Belum ada kamar di kos ini.</p>';
    return;
  }

  const persen = (n) => Number(n).toLocaleString('id-ID', { maximumFractionDigits: 1 });
  const harga = (t) => t.harga_min === t.harga_max
    ? rupiah(t.harga_min)
    : `${rupiah(t.harga_min)} - ${rupiah(t.harga_max).replace('Rp ', '')}`;

  $('#ringkasan').innerHTML = `
    <div class="ringkasan-total">
      <div class="ringkasan-atas">
        <b>${persen(r.persen_terisi)}%</b>
        <span class="ket">(${r.terisi} Terisi dari ${r.total} Total Unit)</span>
        <span class="legend">
          <span><i class="bg-biru-tua"></i>Terisi (${r.terisi})</span>
          <span><i style="background:#dde7fb"></i>Kosong (${r.kosong})</span>
        </span>
      </div>
      <div class="bar"><div style="width:${r.persen_terisi}%"></div></div>
    </div>
    <div class="tipe-grid">
      ${r.per_tipe.map((t) => `
        <div class="tipe">
          <div class="tipe-atas"><h3>${esc(t.tipe_kamar)}</h3><span>${t.persen_terisi}%<br>Penuh</span></div>
          <div class="tipe-harga">${harga(t)} / bln</div>
          <div class="bar"><div style="width:${t.persen_terisi}%"></div></div>
          <div class="tipe-bawah">
            <span class="teks-hijau">${t.terisi} Terisi</span>
            <span class="teks-merah">${t.kosong} Kosong</span>
          </div>
        </div>`).join('')}
    </div>`;
}

function renderRating(r) {
  const nilai = r.rating_rata;
  let judul = 'Belum ada ulasan untuk Kost kamu';
  if (nilai !== null) {
    if (nilai >= 4.5) judul = 'Ulasan untuk Kost kamu, sangat bagus!';
    else if (nilai >= 4) judul = 'Ulasan untuk Kost kamu, bagus!';
    else if (nilai >= 3) judul = 'Ulasan untuk Kost kamu cukup baik';
    else judul = 'Ulasan Kost kamu perlu ditingkatkan';
  }
  const respon = r.rata_respon_jam === null
    ? '-'
    : r.rata_respon_jam < 1
      ? `${Math.max(1, Math.round(r.rata_respon_jam * 60))} menit`
      : `${r.rata_respon_jam.toLocaleString('id-ID')} jam`;

  $('#rating').innerHTML = `
    <span class="pill">Ringkasan Rating Kost Kamu</span>
    <h2>${judul}</h2>
    <p>Ulasan yang diberikan bisa kamu cek di halaman Ulasan Penghuni</p>
    <hr>
    <div class="rating-baris">
      <span class="label">Rata-rata Respon Mitra: <b>${respon}</b></span>
      <a href="ulasan?kos_id=${Panel.kosId}" class="btn-lihat">Lihat Ulasan</a>
    </div>
    <div class="rating-baris">
      <span class="label">Skor Reputasi Kos:</span>
      <b>${nilai === null ? '-' : `<span class="bintang">★</span> ${nilai.toLocaleString('id-ID', { minimumFractionDigits: 1 })} / 5.0`} (${r.jumlah_ulasan} Ulasan)</b>
    </div>`;
}

function renderReservasi({ total: menunggu, items }, totalSemua) {
  $('#badge-menunggu').textContent = `${menunggu} Menunggu Respon`;
  $('#badge-menunggu').hidden = menunggu === 0;
  $('#lihat-semua').textContent = `Lihat Semua (${totalSemua})`;

  if (!items.length) {
    $('#tabel-reservasi').innerHTML = '<tr><td colspan="5" class="kosong">Tidak ada reservasi yang menunggu respon.</td></tr>';
    return;
  }

  $('#tabel-reservasi').innerHTML = items.map((r, i) => `
    <tr data-id="${r.id}">
      <td>
        <div class="penyewa">
          <span class="inisial v${i % 3}">${esc(r.penyewa_inisial)}</span>
          <div><div class="sel-utama">${esc(r.penyewa_nama)}</div><div class="sel-sub">${esc(r.penyewa_telepon)}</div></div>
        </div>
      </td>
      <td>
        <div class="sel-utama">Kamar ${esc(r.nomor_kamar)}</div>
        <div class="sel-sub">${esc(r.tipe_kamar)}${r.lantai !== null ? ` (Lantai ${r.lantai})` : ''}</div>
      </td>
      <td>
        <div class="sel-utama">${tanggal(r.tanggal_masuk)}</div>
        <div class="sel-sub">Durasi: ${esc(r.durasi_label)}${r.status_reservasi === 'Survei' ? `<br>Survei: ${tanggal(r.jadwal_survei)}` : ''}</div>
      </td>
      <td>
        <div class="sel-utama">${rupiah(r.total_biaya)}</div>
        ${statusBayar(r)}
      </td>
      <td>
        <div class="aksi">
          <button class="btn-setujui" data-aksi="setujui">Setujui</button>
          <a class="btn-wa" href="${esc(r.penyewa_wa)}" target="_blank" rel="noopener">Chat<br>WA</a>
          <button class="btn-tolak" data-aksi="tolak" title="Tolak" data-ikon="silang"></button>
        </div>
      </td>
    </tr>`).join('');

  $('#tabel-reservasi').querySelectorAll('[data-aksi]').forEach((btn) => {
    btn.addEventListener('click', () => responReservasi(btn.closest('tr').dataset.id, btn.dataset.aksi, btn));
  });
}

function statusBayar(r) {
  if (r.status_pembayaran === 'Lunas') {
    return `<span class="status-bayar lunas">${IKON.ceklis} Pembayaran Selesai</span>`;
  }
  if (r.status_pembayaran === 'DP') {
    return `<span class="status-bayar dp">${IKON.ceklis} DP ${rupiah(r.jumlah_dp)}</span>`;
  }
  return '<span class="status-bayar belum">Belum Bayar DP</span>';
}

async function responReservasi(id, aksi, tombol) {
  let body;
  if (aksi === 'tolak') {
    const alasan = await mintaTeks({
      judul: 'Tolak reservasi?',
      keterangan: 'Alasan penolakan akan ditampilkan ke calon penyewa.',
      tombol: 'Tolak Reservasi',
    });
    if (!alasan) return;
    body = { catatan_pemilik: alasan };
  }

  tombol.disabled = true;
  try {
    await api(`reservasi?id=${id}&aksi=${aksi}`, { method: 'PATCH', body });
    toast(aksi === 'setujui' ? 'Reservasi disetujui, kamar ditandai Terisi' : 'Reservasi ditolak');
    muat(kosAktifId);
  } catch (err) {
    toast(err.message || 'Gagal memproses reservasi', true);
    tombol.disabled = false;
  }
}

function renderPortofolio(properti) {
  const aktif = properti.filter((p) => p.is_published).length;
  $('#jumlah-aktif').textContent = `${aktif} Aktif • ${properti.length} Terdaftar`;

  const kartuKos = properti.map((p) => {
    const foto = urlFoto(p.foto_utama);
    return `
      <article class="kartu kos-kartu">
        <div class="kos-foto" ${foto ? `style="background-image:url('${esc(foto)}'), linear-gradient(135deg,#94a3b8,#475569)"` : ''}>
          <span class="kos-tipe">${LABEL_TIPE_KOS[p.tipe_kos] || p.tipe_kos}</span>
          <h3>${esc(p.nama_kos)}</h3>
          <span class="alamat">${IKON.pin} ${esc(p.alamat)}, ${esc(p.kota)}</span>
          ${p.rating_rata !== null ? `<span class="kos-rating"><span class="bintang">★</span> ${p.rating_rata.toLocaleString('id-ID', { minimumFractionDigits: 1 })}</span>` : ''}
        </div>
        <div class="kos-angka">
          <div><span>Total Kamar</span><b>${p.total_kamar}</b></div>
          <div><span>Terisi</span><b class="teks-hijau">${p.terisi} Unit</b></div>
          <div><span>Kosong</span><b class="text-biru">${p.kosong} Unit</b></div>
        </div>
        <div class="kos-aksi">
          <a href="kamar?kos_id=${p.id}">Kelola Kamar</a>
          <a href="penyewa?kos_id=${p.id}">Kelola Penyewa</a>
          <a href="tambah-kos?id=${p.id}" class="btn-gear" title="Pengaturan kos">${IKON.gear}</a>
        </div>
      </article>`;
  }).join('');

  $('#portofolio').innerHTML = kartuKos + `
    <article class="kartu tambah-kos">
      <span class="ikon">${IKON.tambahKos}</span>
      <h3>+ Daftarkan Properti Kos Tambahan</h3>
      <p>Punya kos lain di sekitar Suhat, Sigura-gura, atau Kerto? Tambahkan cabang baru untuk mengelola seluruh kamar dalam satu dasbor terpadu KosinAja.</p>
      <a href="tambah-kos" class="btn-biru">${IKON.plus} Tambah Kos Sekarang</a>
    </article>`;
}

/** Isi elemen [data-ikon="nama"] dengan SVG dari IKON. */
function pasangIkon(root) {
  root.querySelectorAll('[data-ikon]').forEach((el) => {
    if (!el.innerHTML.trim()) el.innerHTML = IKON[el.dataset.ikon] || '';
  });
}

function tampilGalat(pesan) {
  const ada = $('.galat');
  if (ada) ada.remove();
  const el = document.createElement('div');
  el.className = 'galat';
  el.textContent = pesan;
  $('.topbar').after(el);
}
