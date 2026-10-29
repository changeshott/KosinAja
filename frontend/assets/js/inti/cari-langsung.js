// Live search bersama untuk Beranda & Katalog: panel saran di bawah kotak cari.
// Halaman cukup punya <form id="form-cari"> berisi <input id="q"> dan <div id="saran-cari">, lalu memanggil
// CariLangsung.pasang({...}) dan menangani submit form-nya sendiri (panggil CariLangsung.tutup() + simpanRiwayat()).
//
// Kotak kosong + fokus  -> pencarian terakhir & lokasi populer.
// Ketik minimal 2 huruf -> lokasi (kecamatan) yang cocok + 5 kos teratas (ikut filter halaman yang aktif).
// Panah atas/bawah memilih, Enter membuka pilihan (atau submit form kalau tidak ada yang dipilih), Esc menutup.
// Tekan "/" di mana saja untuk langsung mengetik di kotak cari.

const CariLangsung = (() => {
  const SARAN_MAKS = 5;
  const MIN_HURUF = 2;
  const KUNCI_RIWAYAT = 'kosinaja.riwayatCari';
  const RIWAYAT_MAKS = 5;
  const IKON_SARAN = {
    jam: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    pin: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    silang: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  };

  let form, input, panel;
  let opsiHalaman = {};
  let tunda;
  let nomor = 0; // cegah respons lama menimpa saran baru
  let pilihan = -1;
  let daftarKecamatan = null; // Promise, dimuat sekali saat pertama dibutuhkan

  /**
   * @param {object} o
   * @param {() => object} [o.filterSaran]  filter halaman yang ikut dipakai saran kos (tanpa q)
   * @param {() => void}   [o.saatKosong]   kotak cari dikosongkan (mis. tombol × bawaan browser)
   * @param {(kecamatan: string) => void} o.saatPilihLokasi
   */
  function pasang(o) {
    opsiHalaman = o;
    form = document.querySelector('#form-cari');
    input = document.querySelector('#q');
    panel = document.querySelector('#saran-cari');

    input.addEventListener('input', () => {
      clearTimeout(tunda);
      const q = input.value.trim();
      if (q.length < MIN_HURUF) {
        if (!q) opsiHalaman.saatKosong?.();
        tampilAwal();
        return;
      }
      tampil(`<div class="saran-status"><span class="saran-memuat"></span>Mencari "${esc(q)}"...</div>`);
      tunda = setTimeout(() => muatSaran(q), 250);
    });

    input.addEventListener('focus', () => {
      if (input.value.trim().length < MIN_HURUF) tampilAwal();
      else if (panel.innerHTML) buka();
    });

    input.addEventListener('keydown', (e) => {
      if (panel.hidden) return;
      const opsi = [...panel.querySelectorAll('[role="option"]')];
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!opsi.length) return;
        pilihan = e.key === 'ArrowDown' ? (pilihan + 1) % opsi.length : (pilihan - 1 + opsi.length) % opsi.length;
        tandai(opsi);
      } else if (e.key === 'Enter' && pilihan >= 0 && opsi[pilihan]) {
        e.preventDefault();
        pilih(opsi[pilihan]);
      } else if (e.key === 'Escape') {
        e.preventDefault(); // Esc pertama cukup menutup panel, teks yang diketik tidak ikut terhapus
        tutup();
      }
    });

    // mousedown dicegah supaya input tidak kehilangan fokus saat panel diklik
    panel.addEventListener('mousedown', (e) => e.preventDefault());
    panel.addEventListener('click', (e) => {
      const hapus = e.target.closest('[data-hapus-riwayat]');
      if (hapus) return hapusRiwayat(hapus.dataset.hapusRiwayat);
      const item = e.target.closest('[role="option"]');
      if (item) pilih(item);
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#form-cari')) tutup();
    });

    // Pintasan "/" untuk fokus ke kotak cari (kecuali sedang mengetik di kolom lain)
    document.addEventListener('keydown', (e) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      e.preventDefault();
      input.focus();
      input.select();
    });
  }

  function pilih(item) {
    const { aksi, nilai } = item.dataset;
    if (aksi === 'kos') {
      simpanRiwayat(input.value);
      location.href = item.dataset.href;
    } else if (aksi === 'riwayat') {
      input.value = nilai;
      form.requestSubmit();
    } else if (aksi === 'lokasi') {
      tutup();
      input.value = '';
      opsiHalaman.saatPilihLokasi(nilai);
    } else {
      form.requestSubmit();
    }
  }

  /** Saran saat kotak cari masih kosong: riwayat pencarian + lokasi populer. */
  async function tampilAwal() {
    const n = ++nomor;
    const riwayat = bacaRiwayat();
    const kecamatan = await muatKecamatan();
    if (n !== nomor || input.value.trim().length >= MIN_HURUF) return;
    if (!riwayat.length && !kecamatan.length) return tutup();

    let html = '';
    if (riwayat.length) {
      html += '<div class="saran-judul saran-judul-aksi">Pencarian terakhir<button type="button" data-hapus-riwayat="*">Hapus semua</button></div>';
      html += riwayat.map((q, i) => `
        <div class="saran-baris" role="option" id="saran-r${i}" aria-selected="false" data-aksi="riwayat" data-nilai="${esc(q)}">
          <span class="saran-ikon">${IKON_SARAN.jam}</span><span class="saran-label">${esc(q)}</span>
          <button type="button" class="saran-hapus" data-hapus-riwayat="${esc(q)}" title="Hapus dari riwayat" aria-label="Hapus ${esc(q)} dari riwayat">${IKON_SARAN.silang}</button>
        </div>`).join('');
    }
    if (kecamatan.length) {
      html += '<div class="saran-judul">Lokasi populer</div>';
      html += kecamatan.slice(0, 5).map((k, i) => itemLokasi(k, `saran-l${i}`)).join('');
    }
    tampil(html);
  }

  async function muatSaran(q) {
    const n = ++nomor;
    const p = new URLSearchParams(opsiHalaman.filterSaran?.() || {});
    p.set('q', q);
    p.set('per_page', SARAN_MAKS);
    try {
      const [hasil, kecamatan] = await Promise.all([api(`katalog?${p}`), muatKecamatan()]);
      if (n !== nomor || input.value.trim() !== q) return;

      const kecil = q.toLowerCase();
      const lokasi = kecamatan.filter((k) => k.toLowerCase().includes(kecil)).slice(0, 3);
      if (!hasil.items.length && !lokasi.length) {
        return tampil('<div class="saran-status"><b>Kos tidak ditemukan</b>Coba nama jalan atau kecamatan lain.</div>');
      }
      let html = '';
      if (lokasi.length) {
        html += '<div class="saran-judul">Lokasi</div>' + lokasi.map((k, i) => itemLokasi(k, `saran-l${i}`, q)).join('');
      }
      if (hasil.items.length) {
        html += `<div class="saran-judul">Kos</div>
          ${hasil.items.map((k, i) => itemKos(k, q, i)).join('')}
          <div class="saran-semua" role="option" id="saran-semua" aria-selected="false" data-aksi="semua">
            Lihat semua ${hasil.total} hasil untuk "${esc(q)}" ${SVG_S.panah}
          </div>`;
      }
      tampil(html);
    } catch (err) {
      if (n === nomor) tampil(`<div class="saran-status"><b>Gagal memuat</b>${esc(err.message)}</div>`);
    }
  }

  /** Disimpan sebagai Promise supaya panggilan bersamaan (fokus + ketik) cukup satu request. */
  function muatKecamatan() {
    daftarKecamatan ??= api('katalog?opsi=1')
      .then((opsi) => opsi.kecamatan || [])
      .catch(() => {
        daftarKecamatan = null; // dicoba lagi lain kali
        return [];
      });
    return daftarKecamatan;
  }

  function itemLokasi(kecamatan, id, q = '') {
    return `
      <div class="saran-baris" role="option" id="${id}" aria-selected="false" data-aksi="lokasi" data-nilai="${esc(kecamatan)}">
        <span class="saran-ikon">${IKON_SARAN.pin}</span>
        <span class="saran-label">${q ? sorot(kecamatan, q) : esc(kecamatan)}<small>Kecamatan, Malang</small></span>
      </div>`;
  }

  function itemKos(k, q, i) {
    const status = k.kamar_tersedia > 0 ? `${k.kamar_tersedia} kamar kosong` : '<span class="penuh">Penuh</span>';
    const jarak = k.jarak_kampus_km !== null ? ` · ${k.jarak_kampus_km.toLocaleString('id-ID')} km ke kampus` : '';
    return `
      <div class="saran-item" role="option" id="saran-${k.id}" aria-selected="false" data-aksi="kos" data-href="${FRONTEND}detail-kos?id=${k.id}">
        <img src="${esc(fotoKos(k.foto_utama, i))}" alt="" onerror="${CADANGAN_ONERROR(i)}">
        <div class="saran-teks">
          <b>${sorot(k.nama_kos, q)}</b>
          <small>${LABEL_TIPE[k.tipe_kos] || k.tipe_kos} · ${sorot(k.alamat, q)}, ${sorot(k.kecamatan, q)}${jarak}</small>
        </div>
        <div class="saran-kanan"><b>${rupiah(k.harga_mulai)}</b><small>${status}</small></div>
      </div>`;
  }

  /** Tebalkan bagian teks yang cocok dengan kata kunci (per kata, aman dari HTML injection). */
  function sorot(teks, q) {
    const aman = esc(teks || '');
    const kata = q.split(/\s+/).filter((k) => k.length >= 2)
      .map((k) => esc(k).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (!kata.length) return aman;
    return aman.replace(new RegExp(`(${kata.join('|')})`, 'gi'), '<mark>$1</mark>');
  }

  // ---------- Riwayat pencarian (hanya di browser ini) ----------

  function bacaRiwayat() {
    try {
      const isi = JSON.parse(localStorage.getItem(KUNCI_RIWAYAT) || '[]');
      return Array.isArray(isi) ? isi.filter((x) => typeof x === 'string').slice(0, RIWAYAT_MAKS) : [];
    } catch {
      return [];
    }
  }

  function simpanRiwayat(teks) {
    const q = (teks || '').trim();
    if (q.length < MIN_HURUF) return;
    const baru = [q, ...bacaRiwayat().filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, RIWAYAT_MAKS);
    try { localStorage.setItem(KUNCI_RIWAYAT, JSON.stringify(baru)); } catch { /* mode privat */ }
  }

  function hapusRiwayat(q) {
    const sisa = q === '*' ? [] : bacaRiwayat().filter((x) => x !== q);
    try { localStorage.setItem(KUNCI_RIWAYAT, JSON.stringify(sisa)); } catch { /* mode privat */ }
    tampilAwal();
  }

  // ---------- Buka / tutup panel ----------

  function tampil(html) {
    panel.innerHTML = html;
    pilihan = -1;
    input.removeAttribute('aria-activedescendant');
    buka();
  }

  function buka() {
    panel.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function tutup() {
    if (!panel) return;
    clearTimeout(tunda);
    nomor++; // abaikan respons yang masih dalam perjalanan
    panel.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    pilihan = -1;
  }

  function tandai(opsi) {
    opsi.forEach((el, i) => el.setAttribute('aria-selected', i === pilihan));
    input.setAttribute('aria-activedescendant', opsi[pilihan].id);
    opsi[pilihan].scrollIntoView({ block: 'nearest' });
  }

  return { pasang, tutup, simpanRiwayat };
})();
