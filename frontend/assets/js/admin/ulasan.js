// Ulasan Penghuni: tombol "Lihat Ulasan" di dashboard. GET api/ulasan?kos_id=...&page=...&per_page=...
// Ringkasan skor dihitung dari sebaran bintang (5..1) yang dikirim backend.

const PER_HALAMAN = 8;
let halaman = 1;

document.addEventListener('DOMContentLoaded', async () => {
  if (!(await Panel.mulai())) return;

  document.querySelector('#paginasi').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-hal]');
    if (!btn || btn.disabled) return;
    halaman = Number(btn.dataset.hal);
    muat();
  });
  document.addEventListener('kos-berganti', () => { halaman = 1; muat(); });
  muat();
});

async function muat() {
  const daftar = document.querySelector('#daftar-ulasan');
  daftar.classList.add('memuat');
  document.querySelector('#lihat-publik').href = `../detail-kos?id=${Panel.kosId}#ulasan`;
  try {
    const data = await api(`ulasan?kos_id=${Panel.kosId}&page=${halaman}&per_page=${PER_HALAMAN}`);
    renderRingkasan(data);
    renderDaftar(data);
  } catch (err) {
    daftar.innerHTML = `<p class="kosong border-t border-garis">${esc(err.message || 'Gagal memuat ulasan')}</p>`;
  } finally {
    daftar.classList.remove('memuat');
  }
}

function renderRingkasan({ sebaran, total }) {
  const rata = total ? Object.entries(sebaran).reduce((n, [b, j]) => n + b * j, 0) / total : null;
  const bulat = Math.round(rata || 0);
  document.querySelector('#rata').textContent = rata === null ? '-' : rata.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  document.querySelector('#bintang-rata').textContent = '★'.repeat(bulat) + '☆'.repeat(5 - bulat);
  document.querySelector('#total-ulasan').textContent = total
    ? `${total} ulasan penghuni ${Panel.kos()?.nama_kos || ''}`
    : 'Belum ada ulasan untuk kos ini.';
  document.querySelector('#sebaran').innerHTML = [5, 4, 3, 2, 1].map((b) => {
    const jumlah = sebaran[b] || 0;
    const persen = total ? (jumlah / total) * 100 : 0;
    return `
      <div class="flex items-center gap-3 text-12">
        <span class="w-9 shrink-0">${b} ★</span>
        <div class="bar flex-1"><div style="width:${persen}%"></div></div>
        <span class="w-6 text-right opacity-85">${jumlah}</span>
      </div>`;
  }).join('');
}

function renderDaftar({ items, total }) {
  const awal = (halaman - 1) * PER_HALAMAN;
  document.querySelector('#daftar-ulasan').innerHTML = items.map((u, i) => `
    <article class="flex gap-4 py-5 px-6 border-t border-garis">
      <span class="inisial v${i % 3} size-10 shrink-0">${esc(u.penyewa_inisial)}</span>
      <div class="flex-1 min-w-0">
        <div class="flex justify-between items-start gap-3 flex-wrap">
          <div>
            <div class="sel-utama">${esc(u.penyewa_nama)}</div>
            <div class="sel-sub">Kamar ${esc(u.nomor_kamar)} · ${esc(u.tipe_kamar)} · ${tanggal(u.created_at.slice(0, 10))}</div>
          </div>
          <span class="bintang text-16 tracking-[1px]" aria-label="${u.rating} dari 5 bintang">${'★'.repeat(u.rating)}<span class="text-[#e2e8f0]">${'★'.repeat(5 - u.rating)}</span></span>
        </div>
        ${u.komentar
          ? `<p class="mt-2 mb-0 text-14 leading-[1.6] text-teks">"${esc(u.komentar)}"</p>`
          : '<p class="mt-2 mb-0 text-13 text-abu italic">Tanpa komentar.</p>'}
      </div>
    </article>`).join('') ||
    '<p class="kosong border-t border-garis">Belum ada ulasan. Ulasan muncul setelah penyewa menyelesaikan masa sewanya dan memberi rating.</p>';

  document.querySelector('#info-hasil').textContent = total
    ? `Menampilkan ${awal + 1}-${awal + items.length} dari ${total} ulasan`
    : '';
  const jmlHal = Math.max(1, Math.ceil(total / PER_HALAMAN));
  document.querySelector('#paginasi').innerHTML = jmlHal > 1 ? `
    <button data-hal="${halaman - 1}" ${halaman === 1 ? 'disabled' : ''} aria-label="Halaman sebelumnya">‹</button>
    ${Array.from({ length: jmlHal }, (_, i) => i + 1)
      .map((n) => `<button data-hal="${n}" class="${n === halaman ? 'aktif' : ''}">${n}</button>`).join('')}
    <button data-hal="${halaman + 1}" ${halaman === jmlHal ? 'disabled' : ''} aria-label="Halaman berikutnya">›</button>` : '';
}
