// Galeri foto drag & drop, dipakai Tambah Kamar dan Tambah Kos.
// Butuh elemen #dropzone, #input-foto, #galeri, #jumlah-foto di halaman.
// Foto baru disimpan di browser dulu, lalu diunggah lewat unggah(id) setelah data induknya tersimpan.

function buatGaleri({ jenis, label = [], maks = 8 }) {
  let lama = [];  // {id, url_foto} yang sudah tersimpan di server
  let baru = [];  // File yang belum diunggah
  const zona = document.querySelector('#dropzone');
  const input = document.querySelector('#input-foto');
  const wadah = document.querySelector('#galeri');

  function tambah(files) {
    for (const f of files) {
      if (lama.length + baru.length >= maks) { toast(`Maksimal ${maks} foto`, true); break; }
      if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { toast(`${f.name}: format harus JPG, PNG, atau WEBP`, true); continue; }
      if (f.size > 2 * 1024 * 1024) { toast(`${f.name}: lebih dari 2MB`, true); continue; }
      f.pratinjau = URL.createObjectURL(f);
      baru.push(f);
    }
    render();
  }

  function render() {
    const semua = [
      ...lama.map((f) => ({ src: urlFoto(f.url_foto), nama: f.url_foto.split('/').pop(), hapus: `lama-${f.id}` })),
      ...baru.map((f, i) => ({ src: f.pratinjau, nama: f.name, hapus: `baru-${i}` })),
    ];
    wadah.innerHTML = semua.map((f, i) => `
      <figure class="foto-galeri">
        <img src="${esc(f.src)}" alt="" onerror="this.src='../assets/img/kamar-${(i % 3) + 1}.jpg'">
        ${label[i] ? `<span class="foto-label ${i === 0 ? 'utama' : ''}">${label[i]}</span>` : ''}
        <figcaption>${esc(f.nama)}</figcaption>
        <button type="button" class="foto-hapus" data-hapus="${f.hapus}" title="Hapus foto"><img src="../assets/img/ikon-hapus.svg" width="9.333" height="10.5" alt="Hapus"></button>
      </figure>`).join('');
    document.querySelector('#jumlah-foto').textContent = `${semua.length} / ${maks} Foto Terunggah`;
  }

  async function hapus(e) {
    const btn = e.target.closest('[data-hapus]');
    if (!btn) return;
    const [asal, id] = btn.dataset.hapus.split('-');
    if (asal === 'baru') {
      URL.revokeObjectURL(baru[id].pratinjau);
      baru.splice(Number(id), 1);
    } else {
      if (!confirm('Hapus foto ini dari galeri?')) return;
      try {
        await api(`foto?jenis=${jenis}&id=${id}`, { method: 'DELETE' });
        lama = lama.filter((f) => f.id !== Number(id));
      } catch (err) {
        toast(err.message || 'Gagal menghapus foto', true);
        return;
      }
    }
    render();
  }

  input.addEventListener('change', () => { tambah(input.files); input.value = ''; });
  ['dragenter', 'dragover'].forEach((ev) => zona.addEventListener(ev, (e) => { e.preventDefault(); zona.classList.add('aktif'); }));
  ['dragleave', 'drop'].forEach((ev) => zona.addEventListener(ev, (e) => { e.preventDefault(); zona.classList.remove('aktif'); }));
  zona.addEventListener('drop', (e) => tambah(e.dataTransfer.files));
  wadah.addEventListener('click', hapus);
  render();

  return {
    isi(fotoTersimpan) { lama = [...fotoTersimpan]; render(); },
    jumlah: () => lama.length + baru.length,

    /** Unggah satu per satu; yang sudah berhasil tidak diulang kalau simpan dicoba lagi. */
    async unggah(indukId) {
      while (baru.length) {
        const fd = new FormData();
        fd.append('jenis', jenis);
        fd.append(`${jenis}_id`, indukId);
        fd.append('foto', baru[0]);
        // Foto pertama gedung kos otomatis jadi foto sampul di katalog
        if (jenis === 'kos' && !lama.length) fd.append('is_utama', '1');
        lama.push(await api('foto', { method: 'POST', body: fd }));
        URL.revokeObjectURL(baru[0].pratinjau);
        baru.shift();
      }
    },
  };
}
