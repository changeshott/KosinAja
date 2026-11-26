const halaman = document.body.dataset.page;
const state = { status: 'menunggu', page: 1, limit: 5, q: '', selected: null, timer: null };

async function mulaiSuperAdmin() {
  const akun = await akunSaya();
  if (!akun || akun.role !== 'super_admin') {
    location.replace(`${FRONTEND}masuk-super-admin?kembali=${encodeURIComponent(location.pathname + location.search)}`);
    return;
  }
  document.querySelector('#nama-admin').textContent = akun.nama_lengkap;
  document.querySelector('.sa-logout').addEventListener('click', async (e) => { e.preventDefault(); await keluar(`${FRONTEND}masuk-super-admin`);
    state.q = e.target.value.trim(); state.page = 1; clearTimeout(state.timer); state.timer = setTimeout(muatData, 240);
  });
  document.querySelector('#prev').onclick = () => { if (state.page > 1) { state.page--; muatData(); } };
  document.querySelector('#next').onclick = () => { state.page++; muatData(); };
  document.querySelector('#limit')?.addEventListener('change', (e) => { state.limit = Number(e.target.value); state.page = 1; muatData(); });
  document.querySelectorAll('[data-status]').forEach((b) => b.addEventListener('click', () => {
    state.status = b.dataset.status; state.page = 1;
    document.querySelectorAll('[data-status]').forEach((x) => x.classList.toggle('selected', x === b));
    muatData();
  }));
  await Promise.all([muatRingkasan(), muatData()]);
}

async function muatRingkasan() {
  const d = await api('super-admin?bagian=ringkasan');
  const set = (id, val) => { const el = document.querySelector(`#${id}`); if (el) el.textContent = Number(val || 0).toLocaleString('id-ID'); };
  set('stat-menunggu', d.menunggu); set('stat-aktif', halaman === 'konfirmasi' ? d.disetujui_bulan_ini : d.aktif); set('stat-ditolak', d.ditolak_bulan_ini);
  set('stat-terverifikasi', d.terverifikasi); set('stat-nonaktif', d.nonaktif);
  set('badge-menunggu', d.menunggu);
  const tagMenunggu = document.querySelector('#tag-menunggu');
  if (tagMenunggu) tagMenunggu.textContent = `${Number(d.menunggu || 0).toLocaleString('id-ID')} menunggu`;
}

async function muatData() {
  const status = halaman === 'konfirmasi' ? state.status : 'disetujui';
  const query = new URLSearchParams({ bagian: 'pemilik', status, page: String(state.page), limit: String(state.limit), q: state.q });
  const data = await api(`super-admin?${query}`);
  const tbody = document.querySelector('#daftar');
  if (halaman === 'konfirmasi') {
    tbody.innerHTML = data.items.map((p) => `<tr data-id="${p.id}" class="${state.selected === p.id ? 'row-selected' : ''}"><td><b>${esc(p.nama_lengkap)}</b><small>${esc(p.email)}</small></td><td><b>${esc(p.nama_kos || 'Belum ada kos')}</b><small>${esc(p.kota || '—')}</small></td><td>${tanggal(p.created_at)}</td><td><span class="status status-${esc(p.status_verifikasi)}">${labelStatus(p.status_verifikasi)}</span></td><td>›</td></tr>`).join('') || `<tr><td colspan="5" class="kosong">Tidak ada pengajuan pada status ini.</td></tr>`;
  } else {
    tbody.innerHTML = data.items.map((p) => `<tr data-id="${p.id}" class="${state.selected === p.id ? 'row-selected' : ''}"><td><b>${esc(p.nama_lengkap)}</b><small>PK-${String(p.id).padStart(4, '0')}</small></td><td>${esc(p.email)}<small>${esc(p.no_telepon)}</small></td><td>${esc(p.nama_kos || '—')}<small>${p.total_kos ? `${p.total_kos} kos` : 'Belum ada kos'}</small></td><td>${esc(p.kota || '—')}</td><td>${tanggal(p.created_at)}</td><td><span class="status ${p.akun_aktif ? 'status-disetujui' : 'status-nonaktif'}">${p.akun_aktif ? 'Aktif' : 'Nonaktif'}</span></td><td><button class="link-detail">Detail ↗</button></td></tr>`).join('') || `<tr><td colspan="7" class="kosong">Data pemilik belum tersedia.</td></tr>`;
    document.querySelector('#jumlah-pemilik').textContent = `${Number(data.total).toLocaleString('id-ID')} pemilik`;
  }
  tbody.querySelectorAll('tr[data-id]').forEach((tr) => tr.addEventListener('click', () => pilihPemilik(Number(tr.dataset.id))));
  const dari = data.total ? ((data.page - 1) * data.limit + 1) : 0;
  const sampai = Math.min(data.page * data.limit, data.total);
  document.querySelector('#paging-label').textContent = `Menampilkan ${dari}–${sampai} dari ${Number(data.total).toLocaleString('id-ID')} pengajuan`;
  document.querySelector('#page-num').textContent = state.page;
  document.querySelector('#prev').disabled = state.page <= 1;
  document.querySelector('#next').disabled = sampai >= data.total;
  if (state.selected && !data.items.some((p) => p.id === state.selected)) state.selected = null;
  if (!state.selected && data.items.length) await pilihPemilik(data.items[0].id);
  else if (!state.selected) document.querySelector('#detail').innerHTML = '<div class="empty-detail">Pilih pemilik untuk melihat detail.</div>';
}

async function pilihPemilik(id) {
  state.selected = id;
  const p = await api(`super-admin?bagian=pemilik&id=${id}`);
  document.querySelectorAll('#daftar tr[data-id]').forEach((tr) => tr.classList.toggle('row-selected', Number(tr.dataset.id) === id));
  const detail = document.querySelector('#detail');
  if (halaman === 'konfirmasi') {
    detail.innerHTML = `<div class="detail-head"><div><b>Detail pengajuan</b><small>ID #PK-${String(p.id).padStart(4,'0')}</small></div><span class="status status-${esc(p.status_verifikasi)}">${labelStatus(p.status_verifikasi)}</span></div><hr><h2>${esc(p.nama_lengkap)}</h2><small>Diajukan pada ${tanggal(p.created_at)}</small><p class="section-label">INFORMASI PEMILIK</p><dl><dt>Email</dt><dd>${esc(p.email)}</dd><dt>Nomor telepon</dt><dd>${esc(p.no_telepon)}</dd><dt>NIK</dt><dd>${esc(p.nik_samar)}</dd><dt>Alamat domisili</dt><dd>${esc(p.alamat_domisili)}</dd></dl><hr><p class="section-label">INFORMASI KOST</p>${p.kos.length ? p.kos.map(kosMini).join('') : '<p class="muted">Pemilik belum menambahkan data kos.</p>'}<div class="detail-actions">${p.status_verifikasi === 'menunggu' ? '<button class="btn-outline" id="tolak">Tolak pengajuan</button><button class="btn-primary" id="setujui">✓ Setujui pemilik</button>' : ''}</div>`;
    document.querySelector('#setujui')?.addEventListener('click', () => prosesVerifikasi('setujui'));
    document.querySelector('#tolak')?.addEventListener('click', () => prosesVerifikasi('tolak'));
  } else {
    detail.innerHTML = `<div class="card-head"><b>Data lengkap pemilik</b><span class="status ${p.status_verifikasi === 'disetujui' ? 'status-disetujui' : 'status-menunggu'}">${labelStatus(p.status_verifikasi)}</span></div><div class="owner-cols"><section><p class="section-label">01 INFORMASI PRIBADI</p>${baris('Nama lengkap',p.nama_lengkap)}${baris('NIK',p.nik_samar)}${baris('Email',p.email)}${baris('Telepon',p.no_telepon)}${baris('Domisili',p.alamat_domisili)}</section><section><p class="section-label">02 INFORMASI KOST</p>${p.kos.length ? p.kos.map(kosMini).join('') : '<span class="muted">Belum ada kos terdaftar</span>'}</section><section><p class="section-label">03 AKUN & VERIFIKASI</p>${baris('ID pemilik',`PK-${String(p.id).padStart(4,'0')}`)}${baris('Bergabung',tanggal(p.created_at))}${baris('Disetujui',tanggal(p.diverifikasi_at))}${baris('Status akun',p.akun_aktif ? 'Aktif' : 'Nonaktif')}${p.alasan_verifikasi ? baris('Catatan',p.alasan_verifikasi) : ''}<button id="toggle-akun" class="${p.akun_aktif ? 'btn-outline' : 'btn-primary'}">${p.akun_aktif ? 'Nonaktifkan akun' : 'Aktifkan akun'}</button></section></div>`;
    document.querySelector('#toggle-akun').onclick = () => toggleAkun(p.id, !p.akun_aktif);
  }
}

function baris(label, value) { return `<div class="info-row"><span>${esc(label)}</span><b>${esc(value || '—')}</b></div>`; }
function kosMini(k) { return `<div class="kos-mini"><b>${esc(k.nama_kos)}</b><small>${esc(k.alamat)}, ${esc(k.kota)} · ${esc(k.tipe_kos)}${k.total_kamar ? ` · ${k.total_kamar} kamar` : ''}</small></div>`; }
function labelStatus(s) { return ({ menunggu: 'Menunggu', disetujui: 'Disetujui', ditolak: 'Ditolak' })[s] || s; }

async function prosesVerifikasi(aksi) {
  let alasan = '';
  if (aksi === 'tolak') { alasan = prompt('Tuliskan alasan penolakan pengajuan:')?.trim() || ''; if (!alasan) return; }
  try {
    await api(`super-admin?bagian=verifikasi&id=${state.selected}`, { method: 'POST', body: { aksi, alasan } });
    toast(aksi === 'setujui' ? 'Pemilik berhasil disetujui' : 'Pengajuan pemilik ditolak');
    state.selected = null; await Promise.all([muatRingkasan(), muatData()]);
  } catch (e) { toast(e.message || 'Gagal memperbarui pengajuan', true); }
}

async function toggleAkun(id, aktif) {
  try { await api(`super-admin?bagian=akun&id=${id}`, { method: 'PATCH', body: { aktif } }); toast(aktif ? 'Akun pemilik diaktifkan' : 'Akun pemilik dinonaktifkan'); await Promise.all([muatRingkasan(), muatData()]); await pilihPemilik(id); }
  catch (e) { toast(e.message || 'Gagal memperbarui akun', true); }
}

mulaiSuperAdmin().catch((e) => toast(e.message || 'Gagal memuat data super admin', true));
