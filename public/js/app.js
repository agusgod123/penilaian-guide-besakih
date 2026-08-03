/* =========================================================
   app.js — Kontroler UI
   ========================================================= */
(function () {
  'use strict';

  const APP_VERSION = '1.1.0';
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  const TITLES = {
    home: 'Penilaian Guide',
    nilai: 'Penilaian Baru',
    guides: 'Daftar Guide',
    riwayat: 'Riwayat',
    pengaturan: 'Pengaturan',
    tentang: 'Tentang',
  };

  let guides = [];
  let current = 'home';
  let form = { pos: 1, guide: null, crit: { idCard: null, uniform: null, review: 0 }, catatan: '' };
  let historyFilter = 'all';

  /* ---------------------- Util ---------------------- */
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0; const v = c === 'x' ? r : (r & 0x3 | 0x8); return v.toString(16);
      }));

  function toast(msg, type = '', icon = '') {
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.innerHTML = `${icon ? `<span class="ticon">${icon}</span>` : ''}<span>${msg}</span>`;
    $('#toastWrap').appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 250); }, 3200);
  }

  function haptic(pattern = 30) {
    if (Sync.Settings.get().haptic && navigator.vibrate) { try { navigator.vibrate(pattern); } catch {} }
  }

  const fmtTime = iso => {
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  function download(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  /* ---------------------- Navigasi ---------------------- */
  function go(view) {
    if (!TITLES[view]) view = 'home';
    current = view;
    $$('.view').forEach(v => v.hidden = true);
    const el = $('#view-' + view);
    if (el) el.hidden = false;
    $('#appTitle').textContent = TITLES[view];
    $('#btnBack').classList.toggle('hidden', view === 'home');
    $('#btnMenu').classList.toggle('hidden', view !== 'home');
    closeDrawer();
    window.scrollTo(0, 0);
    if (location.hash !== '#' + view) history.replaceState(null, '', '#' + view);

    if (view === 'riwayat') renderHistory();
    if (view === 'guides') renderGuideCards();
    if (view === 'home') refreshStats();
    if (view === 'pengaturan') { refreshStorage(); refreshServerNotice(); }
  }

  function openDrawer() {
    $('#drawer').hidden = false; $('#scrim').hidden = false;
    $('#btnMenu').setAttribute('aria-expanded', 'true');
    refreshStats();
  }
  function closeDrawer() {
    $('#drawer').hidden = true; $('#scrim').hidden = true;
    $('#btnMenu').setAttribute('aria-expanded', 'false');
  }

  /* ---------------------- Guide ---------------------- */
  /**
   * Daftar guide diambil berlapis, dari yang paling cepat tersedia:
   *   1. Cache di perangkat (hasil unduhan terakhir dari server)
   *   2. Salinan bawaan yang ikut terpasang bersama aplikasi (guides.json)
   *   3. Server — dipakai untuk memperbarui, bukan syarat agar daftar muncul
   *
   * Dengan begitu daftar nama SELALU ada, bahkan pada perangkat yang baru
   * dipasang dan belum pernah berhasil menghubungi server.
   */
  async function loadGuides() {
    const cached = DB.getGuides();
    if (cached && cached.list.length) {
      guides = cached.list;
      fillGuideInputs();
    } else {
      try {
        const res = await fetch('guides.json', { cache: 'no-cache' });
        const bawaan = await res.json();
        if (Array.isArray(bawaan) && bawaan.length) {
          guides = bawaan;
          fillGuideInputs();
        }
      } catch (e) {
        console.warn('[guides] salinan bawaan tidak terbaca', e);
      }
    }

    // Perbarui dari server di latar belakang
    try {
      const dariServer = await Sync.refreshGuides();
      if (Array.isArray(dariServer) && dariServer.length) {
        guides = dariServer;
        fillGuideInputs();
      }
    } catch {
      // Ditulis ke barisnya sendiri, bukan menimpa #guideHelp — di dalamnya ada
      // #guideCount yang masih dipakai fillGuideInputs().
      if (!guides.length) {
        const el = $('#guideAmbigu');
        if (el) {
          el.textContent = '⚠️ Daftar guide tidak dapat dimuat. Tutup lalu buka ulang aplikasi.';
          el.hidden = false;
        }
      }
    }
  }

  /** Ubah kode regu ("A1") menjadi label manusia ("Asing · Regu 1"). */
  function labelRegu(kode) {
    return String(kode || '').split(',').map(s => s.trim()).filter(Boolean).map(k => {
      const kat = k[0] === 'A' ? 'Asing' : 'Domestik';
      return `${kat} · Regu ${k.slice(1)}`;
    }).join(' + ');
  }

  /** Apakah guide termasuk dalam kategori/regu yang sedang dipilih. */
  function cocokFilter(g, kategori, regu) {
    if (!kategori && !regu) return true;
    const kode = String(g.regu || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!kode.length) return false;
    return kode.some(k => {
      const kat = k[0] === 'A' ? 'Asing' : 'Domestik';
      return (!kategori || kat === kategori) && (!regu || k.slice(1) === regu);
    });
  }

  /** Daftar guide sesuai filter yang aktif di layar Penilaian. */
  function guidesTersaring() {
    const kat = $('#filterKategori') ? $('#filterKategori').value : '';
    const rg = $('#filterRegu') ? $('#filterRegu').value : '';
    return guides.filter(g => cocokFilter(g, kat, rg));
  }

  function fillGuideInputs() {
    const list = guidesTersaring();
    const dl = $('#guideList');
    dl.innerHTML = list.map(g =>
      `<option value="${esc(g.guideName)}">${esc(labelRegu(g.regu))}</option>`
    ).join('');
    const total = guides.length;
    $('#guideCount').textContent = list.length === total
      ? `${total} guide aktif tersedia.`
      : `Menampilkan ${list.length} dari ${total} guide.`;
    if (current === 'guides') renderGuideCards();
  }

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /**
   * Cari guide dari teks yang diketik staff.
   * Yang sedang tersaring diprioritaskan, supaya pilihan filter menentukan
   * guide mana yang dimaksud bila ada nama mirip.
   */
  function findGuide(name) {
    const q = String(name || '').trim().toLowerCase();
    if (!q) return null;
    const cari = (arr) => arr.find(g => g.guideName.toLowerCase() === q)
                       || arr.find(g => g.guideName.toLowerCase().includes(q))
                       || null;
    return cari(guidesTersaring()) || cari(guides);
  }

  /**
   * Penentuan guide saat penilaian DISIMPAN — sengaja lebih ketat daripada
   * findGuide yang dipakai untuk pratinjau saat mengetik.
   *
   * Banyak nama guide di sini hanya beda satu kata: mengetik "Darta" cocok
   * untuk 14 orang. Menebak yang pertama berarti penilaian tercatat atas nama
   * orang yang salah tanpa ada yang tahu — jadi ketikan yang masih ambigu
   * ditolak, bukan ditebak.
   */
  function guideUntukSimpan(name) {
    const teks = String(name || '').trim();
    const q = teks.toLowerCase();
    if (!q) return { error: 'Pilih nama guide dulu' };

    for (const arr of [guidesTersaring(), guides]) {
      const persis = arr.filter(g => g.guideName.toLowerCase() === q);
      if (persis.length === 1) return { guide: persis[0] };
      if (persis.length > 1) {
        return { error: `Ada ${persis.length} guide bernama "${teks}" — pilih lewat Daftar Guide` };
      }
      const mirip = arr.filter(g => g.guideName.toLowerCase().includes(q));
      if (mirip.length === 1) return { guide: mirip[0] };
      if (mirip.length > 1) {
        return { error: `"${teks}" cocok untuk ${mirip.length} guide — ketik nama lengkapnya`, kandidat: mirip };
      }
    }
    return { error: `Guide "${teks}" tidak ada dalam daftar` };
  }

  let guideKategoriFilter = '';

  function renderGuideCards() {
    const q = ($('#guideSearch').value || '').toLowerCase();
    const list = guides
      .filter(g => !guideKategoriFilter || cocokFilter(g, guideKategoriFilter, ''))
      .filter(g => !q || g.guideName.toLowerCase().includes(q) || String(g.guideId).toLowerCase().includes(q));
    const box = $('#guideCards');
    const info = $('#guideTotal');
    if (info) info.textContent = `${list.length} dari ${guides.length} guide`;
    if (!list.length) {
      box.innerHTML = `<div class="empty"><span class="big">👥</span>Tidak ada guide yang cocok.</div>`;
      return;
    }
    // Batasi jumlah kartu yang digambar agar layar tetap ringan di perangkat lama.
    // Batas lama (120) menyembunyikan lebih dari separuh dari 296 guide bahkan
    // saat tanpa filter, jadi dinaikkan sampai seluruh daftar muat.
    const tampil = list.slice(0, 300);
    box.innerHTML = tampil.map(g => `
      <button class="card" data-guide="${esc(g.guideName)}">
        <span class="cstat">👤</span>
        <span class="cbody">
          <span class="cname">${esc(g.guideName)}</span>
          <span class="cmeta">${esc(g.guideId)} · ${esc(labelRegu(g.regu))}</span>
        </span>
      </button>`).join('')
      + (list.length > tampil.length
        ? `<div class="help">Menampilkan ${tampil.length} teratas. Ketik di kotak cari untuk mempersempit.</div>`
        : '');
  }

  /* ---------------------- Form penilaian ---------------------- */
  function resetForm(keepPos = true) {
    const pos = keepPos ? form.pos : 1;
    form = { pos, guide: null, crit: { idCard: null, uniform: null, review: 0 }, catatan: '' };
    $('#posSelect').value = String(pos);
    $('#guideInput').value = '';
    $('#catatan').value = '';
    $('#guidePicked').classList.add('hidden');
    tampilkanKandidat(null);
    $$('.seg').forEach(b => b.classList.remove('on'));
    $$('.criterion').forEach(c => {
      if (c.dataset.crit !== 'review') c.classList.add('unset');
    });
    applyCritUI();
    saveDraft();
  }

  function saveDraft() {
    localStorage.setItem('besakih.draft', JSON.stringify(form));
  }
  function loadDraft() {
    try {
      const d = JSON.parse(localStorage.getItem('besakih.draft') || 'null');
      if (!d) return;
      form = { ...form, ...d, crit: { ...form.crit, ...(d.crit || {}) } };
      $('#posSelect').value = String(form.pos || 1);
      $('#guideInput').value = form.guide ? form.guide.guideName : '';
      $('#catatan').value = form.catatan || '';
      applyCritUI();
      if (form.guide) showPicked(form.guide);
      if (form.guide || Object.values(form.crit).some(v => v !== null)) $('#draftNote').hidden = false;
    } catch {}
  }

  const REVIEW_MAKS = 20;

  function applyCritUI() {
    $$('.criterion').forEach(c => {
      const k = c.dataset.crit;
      const v = form.crit[k];
      if (k === 'review') {
        const n = Math.max(0, Number(v) || 0);
        const el = $('#reviewNilai');
        if (el) el.textContent = String(n);
        c.classList.remove('unset');            // 0 sudah merupakan jawaban sah
        const kurang = c.querySelector('[data-step="-1"]');
        const tambah = c.querySelector('[data-step="1"]');
        if (kurang) kurang.toggleAttribute('disabled', n <= 0);
        if (tambah) tambah.toggleAttribute('disabled', n >= REVIEW_MAKS);
        return;
      }
      c.classList.toggle('unset', v === null);
      c.querySelectorAll('.seg').forEach(b => b.classList.toggle('on', v !== null && String(+b.dataset.val) === String(+v)));
    });
  }

  function showPicked(g) {
    const el = $('#guidePicked');
    el.dataset.guideId = g.guideId;
    el.innerHTML = `✓ ${esc(g.guideName)} · ${esc(g.guideId)} · ${esc(labelRegu(g.regu))}`;
    el.classList.remove('hidden');
    tandaiKembar(g);
  }

  /**
   * Beri tahu sedini mungkin bila guide ini sudah dinilai di pos yang sama
   * hari ini — supaya staff tidak terlanjur mengisi formulir untuk kehadiran
   * yang toh tetap dihitung satu.
   */
  async function tandaiKembar(g) {
    const el = $('#guidePicked');
    const pos = Number($('#posSelect').value);
    let kembar = null;
    try { kembar = await DB.penilaianKembar(g.guideId, pos, new Date().toISOString()); }
    catch { return; }
    // Guide sudah diganti selagi menunggu — jangan timpa keterangannya
    if (!kembar || el.dataset.guideId !== g.guideId) return;
    el.innerHTML += `<br><small>🚫 Sudah dinilai di Pos ${pos} hari ini — ` +
                    `tidak bisa dinilai lagi di pos ini. Pos lain masih bisa.</small>`;
  }

  /** Tawarkan nama-nama yang mungkin dimaksud saat ketikan masih ambigu. */
  function tampilkanKandidat(kandidat) {
    const el = $('#guideAmbigu');
    if (!el) return;
    if (!kandidat || !kandidat.length) { el.hidden = true; el.textContent = ''; return; }
    const tampil = kandidat.slice(0, 6);
    el.innerHTML = 'Maksud Anda: ' + tampil.map(g =>
      `<button type="button" class="chip" data-guide="${esc(g.guideName)}">${esc(g.guideName)}</button>`
    ).join(' ') + (kandidat.length > tampil.length
      ? ` <small>(+${kandidat.length - tampil.length} lainnya — ketik lebih lengkap)</small>` : '');
    el.hidden = false;
  }

  async function submitEval(e) {
    e.preventDefault();
    const pilihan = guideUntukSimpan($('#guideInput').value);
    if (!pilihan.guide) {
      toast(pilihan.error, 'warn', '⚠️');
      tampilkanKandidat(pilihan.kandidat);
      $('#guideInput').focus();
      return;
    }
    const g = pilihan.guide;
    // Review boleh 0; yang wajib dipilih hanya Uniform dan ID-Card
    const missing = ['idCard', 'uniform'].filter(k => form.crit[k] === null);
    if (missing.length) { toast('Pilih Ya/Tidak untuk ID-Card dan Uniform', 'warn', '⚠️'); return; }

    const pos = Number($('#posSelect').value);

    // Satu pos hanya menilai satu kali per hari. Server menolak kiriman kedua,
    // jadi menahannya di sini bukan sekadar peringatan — melainkan mencegah
    // staff mengisi formulir yang sudah pasti ditolak nanti.
    // Pos LAIN tetap boleh menilai guide yang sama pada hari yang sama.
    const kembar = await DB.penilaianKembar(g.guideId, pos, new Date().toISOString());
    if (kembar) {
      const c = kembar.criteria || {};
      toast(`${g.guideName} sudah dinilai di Pos ${pos} hari ini`, 'warn', '🚫');
      const el = $('#guideAmbigu');
      if (el) {
        el.innerHTML =
          `🚫 <strong>${esc(g.guideName)}</strong> sudah dinilai di Pos ${pos} ` +
          `pukul ${esc(fmtTime(kembar.timestamp).split(' ').pop())} — ` +
          `Uniform ${c.uniform ? 'Ya' : 'Tidak'}, ID ${c.idCard ? 'Ya' : 'Tidak'}, ` +
          `Review ${Number(c.review) || 0}.<br>` +
          `Satu pos menilai satu kali sehari. Guide ini masih bisa dinilai di pos lain.`;
        el.hidden = false;
      }
      return;
    }

    const evaluation = {
      evaluationId: uuid(),
      guideId: g.guideId,
      guideName: g.guideName,
      pos,
      timestamp: new Date().toISOString(),
      criteria: {
        idCard: !!form.crit.idCard,
        uniform: !!form.crit.uniform,
        review: Math.max(0, Number(form.crit.review) || 0),
      },
      catatan: $('#catatan').value.trim(),
      synced: false,
    };

    try {
      await DB.save(evaluation);
    } catch (err) {
      toast('Gagal menyimpan: ' + err.message, 'err', '❌');
      return;
    }

    haptic([30, 40, 30]);
    toast('Penilaian tersimpan', 'ok', '💾');
    form.pos = evaluation.pos;
    localStorage.removeItem('besakih.draft');
    $('#draftNote').hidden = true;
    resetForm(true);
    refreshStats();
    go('home');
    if (Sync.isOnline()) Sync.syncNow();
  }

  /* ---------------------- Riwayat ---------------------- */
  async function renderHistory() {
    const all = await DB.all();
    const list = all.filter(e =>
      historyFilter === 'all' ? true : historyFilter === 'pending' ? !e.synced : e.synced);
    const box = $('#historyList');
    if (!list.length) {
      box.innerHTML = `<div class="empty"><span class="big">🗂️</span>Belum ada data pada filter ini.</div>`;
      return;
    }
    box.innerHTML = list.map(e => {
      const c = e.criteria || {};
      const b = (label, val) => `<span class="badge ${val ? '' : 'bad'}">${label} ${val ? '✓' : '✕'}</span>`;
      // Entri rusak TIDAK boleh digambar sebagai "ID ✕ Uniform ✕ Review 0":
      // nilainya tidak diketahui, bukan nol — menampilkannya sebagai nol sama
      // saja menuduh guide yang bersangkutan tidak patuh.
      const nilai = e.corrupt
        ? '<span class="badge bad">nilai tidak terbaca di perangkat ini</span>'
        : `${b('ID', !!c.idCard)}${b('Uniform', !!c.uniform)}<span class="badge">Review ${Number(c.review) || 0}</span>`;
      const keterangan = e.corrupt
        ? `<span class="cmeta">Sudah terkirim ke server — lihat spreadsheet, kode ${esc(String(e.evaluationId).slice(0, 8))}</span>`
        : '';
      return `<div class="card">
        <span class="cstat">${e.corrupt ? '⚠️' : e.synced ? '✅' : '⏳'}</span>
        <span class="cbody">
          <span class="cname">${esc(e.guideName)}</span>
          <span class="cmeta">Pos ${esc(e.pos)} · ${esc(fmtTime(e.timestamp))} · ${e.synced ? 'Terkirim' : 'Menunggu sync'}</span>
          <span class="badges">${nilai}</span>
          ${keterangan}
          ${e.catatan ? `<span class="cmeta">📝 ${esc(e.catatan)}</span>` : ''}
          ${e.lastError && !e.synced ? `<span class="cmeta">⚠️ ${esc(e.lastError)}</span>` : ''}
        </span>
      </div>`;
    }).join('');
  }

  /* ---------------------- Export rekap ---------------------- */

  // Pemisah titik koma. Excel berbahasa Indonesia memakai ';' sebagai pemisah
  // daftar, sehingga berkas ber-koma menumpuk jadi satu kolom saat dibuka.
  // Baris "sep=;" di paling atas membuat Excel membacanya benar di semua bahasa.
  const SEP = ';';
  const sel = v => {
    const s = String(v ?? '');
    return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const barisCsv = arr => arr.map(sel).join(SEP);

  const jamLokal = iso => {
    const d = new Date(iso);
    const p = n => String(n).padStart(2, '0');
    return isNaN(d) ? '' : `${p(d.getHours())}.${p(d.getMinutes())}`;
  };

  /** Kode regu apa adanya ("A1, D1") agar mudah dicocokkan dengan tab rekap. */
  const reguGuide = gid => {
    const g = guides.find(x => x.guideId === gid);
    return g ? String(g.regu || '-') : '-';
  };

  /**
   * Rangkuman penilaian yang tersimpan di PERANGKAT INI.
   *
   * Aturan penggabungannya sengaja disamakan persis dengan rekap di spreadsheet
   * (`bangunRekap` pada server-gas/Code.gs): bila satu guide dinilai beberapa
   * kali pada hari yang sama, UNI FORM dan ID diambil yang paling buruk
   * sedangkan REVIEW diambil yang tertinggi. Dengan begitu angka di berkas ini
   * bisa langsung disandingkan dengan tab "Rekap ..." untuk cross-check —
   * kalau berbeda, berarti memang ada yang tidak sampai ke server.
   */
  function rangkumPerangkat(list) {
    const harian = new Map(), perPosHari = new Map(), perTgl = new Map();

    for (const e of list) {
      const c = e.criteria || {};
      const u = c.uniform ? 1 : 0;
      const i = c.idCard ? 1 : 0;
      const r = Math.max(0, Number(c.review) || 0);
      const tgl = DB.tanggalLokal(e.timestamp);
      const pos = Number(e.pos) || 0;

      const kunci = `${e.guideId}|${tgl}`;
      const h = harian.get(kunci);
      if (!h) {
        harian.set(kunci, { tgl, guideId: e.guideId, guideName: e.guideName,
                            uniform: u, idCard: i, review: r, pos: new Set([pos]), jml: 1 });
      } else {
        h.uniform = Math.min(h.uniform, u);
        h.idCard = Math.min(h.idCard, i);
        h.review = Math.max(h.review, r);
        h.pos.add(pos);
        h.jml++;
      }

      // Digabung dulu pada tingkat (guide, pos, tanggal) supaya penilaian ulang
      // di pos yang sama tidak terhitung sebagai kehadiran kedua.
      const kp = `${e.guideId}|${pos}|${tgl}`;
      const ph = perPosHari.get(kp);
      if (!ph) perPosHari.set(kp, { pos, uniform: u, idCard: i, review: r });
      else {
        ph.uniform = Math.min(ph.uniform, u);
        ph.idCard = Math.min(ph.idCard, i);
        ph.review = Math.max(ph.review, r);
      }

      const t = perTgl.get(tgl) || { tgl, jml: 0, guides: new Set(), hadir: 0 };
      t.jml++; t.guides.add(e.guideId);
      perTgl.set(tgl, t);
    }

    const perPos = new Map();
    for (const ph of perPosHari.values()) {
      const p = perPos.get(ph.pos) || { pos: ph.pos, hadir: 0, uniform: 0, idCard: 0, review: 0 };
      p.hadir++; p.uniform += ph.uniform; p.idCard += ph.idCard; p.review += ph.review;
      perPos.set(ph.pos, p);
    }
    for (const h of harian.values()) {
      const t = perTgl.get(h.tgl);
      if (t) t.hadir += h.pos.size;
    }

    const urutTgl = (a, b) => String(a.tgl).localeCompare(String(b.tgl));
    return {
      harian: [...harian.values()].sort((a, b) =>
        urutTgl(a, b) || String(a.guideName).localeCompare(String(b.guideName))),
      perPos: [...perPos.values()].sort((a, b) => a.pos - b.pos),
      perTgl: [...perTgl.values()].sort(urutTgl),
    };
  }

  async function exportCsv() {
    const all = await DB.all();
    if (!all.length) { toast('Belum ada data untuk diexport', 'warn', '⚠️'); return; }

    // Entri yang gagal dibuka dipisahkan: nilainya TIDAK diketahui, jadi
    // memasukkannya ke rekap sebagai 0 akan memalsukan angka.
    const rusak = all.filter(e => e.corrupt);
    const baik = all.filter(e => !e.corrupt);
    const { harian, perPos, perTgl } = rangkumPerangkat(baik);

    const out = [];
    const judul = t => { out.push(''); out.push(barisCsv([t])); };

    out.push('sep=' + SEP);
    out.push(barisCsv(['REKAP PENILAIAN GUIDE — DARI PERANGKAT INI']));
    out.push(barisCsv(['Diexport', `${new Date().toLocaleDateString('id-ID')} ${jamLokal(new Date().toISOString())}`]));
    out.push(barisCsv(['Alamat server', Sync.baseUrl()]));
    out.push(barisCsv(['Total penilaian', all.length]));
    out.push(barisCsv(['Sudah terkirim', all.filter(e => e.synced).length]));
    out.push(barisCsv(['Masih menunggu', all.filter(e => !e.synced).length]));
    if (rusak.length) out.push(barisCsv(['Tidak terbaca di perangkat', rusak.length]));

    judul('REKAP HARIAN PER GUIDE — cocokkan dengan tab Rekap A1/A2/D1/D2 di spreadsheet');
    out.push(barisCsv(['(Bila satu guide dinilai beberapa kali sehari: UNI FORM & ID diambil yang paling buruk, REVIEW yang tertinggi)']));
    out.push(barisCsv(['(KEHADIRAN = berapa pos yang memeriksa hari itu. Dinilai dua kali di pos yang sama tetap dihitung 1)']));
    out.push(barisCsv(['Tanggal', 'Nama Guide', 'guideId', 'Regu', 'UNI FORM', 'ID', 'REVIEW',
                       'KEHADIRAN', 'Dinilai di Pos', 'Jumlah Penilaian']));
    harian.forEach(h => out.push(barisCsv([
      h.tgl, h.guideName, h.guideId, reguGuide(h.guideId),
      h.uniform, h.idCard, h.review,
      h.pos.size, [...h.pos].sort().join(' & '), h.jml,
    ])));

    judul('REKAP PER POS PEMERIKSAAN');
    out.push(barisCsv(['(Hadir dihitung per guide per hari — bukan jumlah penilaian)']));
    out.push(barisCsv(['Pos', 'Hadir (guide-hari)', 'Uniform Sesuai', 'ID Sesuai', 'Total Review']));
    perPos.forEach(p => out.push(barisCsv([p.pos, p.hadir, p.uniform, p.idCard, p.review])));

    judul('REKAP PER TANGGAL');
    out.push(barisCsv(['Tanggal', 'Total Kehadiran', 'Guide Berbeda', 'Jumlah Penilaian']));
    perTgl.forEach(t => out.push(barisCsv([t.tgl, t.hadir, t.guides.size, t.jml])));

    judul('RINCIAN SEMUA PENILAIAN');
    out.push(barisCsv(['Tanggal', 'Jam', 'Pos', 'guideId', 'Nama Guide', 'Uniform', 'ID-Card',
                       'Review', 'Catatan', 'Status', 'Waktu (UTC, sama dgn spreadsheet)', 'evaluationId']));
    baik.forEach(e => out.push(barisCsv([
      DB.tanggalLokal(e.timestamp), jamLokal(e.timestamp), e.pos, e.guideId, e.guideName,
      e.criteria?.uniform ? 1 : 0,
      e.criteria?.idCard ? 1 : 0,
      Number(e.criteria?.review) || 0,
      e.catatan || '', e.synced ? 'Terkirim' : 'Menunggu',
      e.timestamp, e.evaluationId,
    ])));

    if (rusak.length) {
      judul('DATA TIDAK TERBACA DI PERANGKAT INI');
      out.push(barisCsv(['Nilainya tidak bisa dibuka di HP/tablet ini, tetapi baris dengan evaluationId berikut tetap ada di spreadsheet.']));
      out.push(barisCsv(['Tanggal', 'Jam', 'Pos', 'Status', 'Waktu (UTC, sama dgn spreadsheet)', 'evaluationId']));
      rusak.forEach(e => out.push(barisCsv([
        DB.tanggalLokal(e.timestamp), jamLokal(e.timestamp), e.pos,
        e.synced ? 'Terkirim' : 'Menunggu', e.timestamp, e.evaluationId,
      ])));
    }

    const csv = '﻿' + out.join('\r\n');
    download(`rekap-penilaian-${DB.tanggalLokal()}.csv`, csv, 'text/csv;charset=utf-8');
    toast(`Rekap ${baik.length} penilaian diunduh`, 'ok', '📄');
  }

  /* ---------------------- Statistik & status ---------------------- */
  async function refreshStats() {
    const c = await DB.counts();
    $('#statTotal').textContent = c.today;
    $('#statPending').textContent = c.pending;
    $('#statSynced').textContent = c.synced;
    $('#drawerSync').textContent = `Menunggu sync: ${c.pending}`;
    $('#syncHint').textContent = c.pending ? `${c.pending} data menunggu dikirim` : 'Semua data sudah terkirim';
    $('#btnSyncNow').toggleAttribute('disabled', c.pending === 0);
  }

  function setNet(state, detail) {
    const badge = $('#netBadge');
    const label = badge.querySelector('.netlabel');
    badge.classList.remove('offline', 'syncing');
    if (state === 'syncing') { badge.classList.add('syncing'); label.textContent = 'Mengirim…'; return; }
    if (!Sync.isOnline()) { badge.classList.add('offline'); label.textContent = 'Offline'; return; }
    label.textContent = 'Online';
  }

  function refreshServerNotice() {
    const el = $('#serverNotice');
    if (el) el.hidden = !Sync.needsServerUrl();

    // Tampilkan alamat yang BENAR-BENAR dipakai, supaya kolom yang sengaja
    // dibiarkan kosong tidak disangka "belum diatur".
    const box = $('#serverAktif');
    if (!box) return;
    const manual = String(Sync.Settings.get().serverUrl || '').trim();
    const bawaan = String((window.APP_CONFIG && window.APP_CONFIG.serverUrl) || '').trim();
    const aktif = Sync.baseUrl();
    const belumAda = Sync.needsServerUrl();

    box.classList.toggle('kosong', belumAda);
    box.querySelector('strong').textContent = belumAda
      ? 'Belum terhubung ke server mana pun'
      : 'Sedang terhubung ke:';
    $('#serverAktifUrl').textContent = belumAda ? '—' : aktif;
    $('#serverAktifSumber').textContent = belumAda
      ? 'Isi kolom di bawah dengan alamat server.'
      : (manual ? 'Diisi manual di perangkat ini.'
                : (bawaan ? 'Alamat bawaan aplikasi — tidak perlu diubah.'
                          : 'Server tempat aplikasi ini dibuka.'));
  }

  async function refreshStorage() {
    const info = await DB.storageInfo();
    const pct = Math.round(info.ratio * 100);
    const bar = $('.storagebar');
    bar.querySelector('i').style.width = pct + '%';
    bar.classList.toggle('full', info.ratio > 0.85);
    const mb = n => (n / 1048576).toFixed(2) + ' MB';
    $('#storageText').textContent = info.ratio > 0.85
      ? `⚠️ Penyimpanan hampir penuh (${mb(info.used)} / ${mb(info.quota)}) — segera sync!`
      : `Penyimpanan lokal: ${mb(info.used)} dari ${mb(info.quota)}`;
    $('#aboutStorage').textContent = DB.isEncryptionActive() ? 'IndexedDB (terenkripsi AES-256)' : 'IndexedDB';
  }

  /* ---------------------- Tutorial ---------------------- */
  const TUT = [
    { i: '👋', t: 'Selamat Datang', b: 'Aplikasi ini untuk menilai guide di pos pemeriksaan Kawasan Besakih. Tidak perlu login.' },
    { i: '📝', t: 'Langkah 1 — Pilih', b: 'Tekan tombol hijau “Penilaian Baru”, lalu pilih pos dan nama guide.' },
    { i: '✅', t: 'Langkah 2 — Nilai', b: 'Tekan Ya atau Tidak untuk Uniform dan ID‑Card. Untuk Review, tekan − atau + sesuai jumlah review. Lalu tekan SIMPAN.' },
    { i: '📶', t: 'Langkah 3 — Tenang', b: 'Tanpa sinyal pun data tetap tersimpan. Saat Wi‑Fi menyala, data terkirim sendiri (⏳ menjadi ✅).' },
  ];
  let tutIndex = 0;

  function showTutorial(force) {
    if (!force && localStorage.getItem('besakih.tutorialDone')) return;
    tutIndex = 0; renderTut(); $('#tutorial').hidden = false;
  }
  function renderTut() {
    const s = TUT[tutIndex];
    $('#tutIcon').textContent = s.i;
    $('#tutTitle').textContent = s.t;
    $('#tutBody').textContent = s.b;
    $('#tutDots').innerHTML = TUT.map((_, i) => `<i class="${i === tutIndex ? 'on' : ''}"></i>`).join('');
    $('#tutNext').textContent = tutIndex === TUT.length - 1 ? 'Mulai' : 'Lanjut';
  }
  function endTutorial() {
    localStorage.setItem('besakih.tutorialDone', '1');
    $('#tutorial').hidden = true;
  }

  /* ---------------------- Event binding ---------------------- */
  function bind() {
    $('#btnMenu').addEventListener('click', openDrawer);
    $('#scrim').addEventListener('click', closeDrawer);
    $('#btnBack').addEventListener('click', () => go('home'));
    document.addEventListener('click', e => {
      const nav = e.target.closest('[data-nav]');
      if (nav) { go(nav.dataset.nav); }
      const gcard = e.target.closest('[data-guide]');
      if (gcard) {
        const g = findGuide(gcard.dataset.guide);
        if (g) {
          form.guide = g; $('#guideInput').value = g.guideName;
          showPicked(g); tampilkanKandidat(null); saveDraft(); go('nilai');
        }
      }
    });

    $('#btnNewEval').addEventListener('click', () => { form.pos = Number($('#homePos').value); $('#posSelect').value = form.pos; go('nilai'); });
    $('#homePos').addEventListener('change', e => { form.pos = Number(e.target.value); Sync.Settings.set({ pos: form.pos }); saveDraft(); });
    $('#posSelect').addEventListener('change', e => {
      form.pos = Number(e.target.value);
      Sync.Settings.set({ pos: form.pos });
      $('#homePos').value = e.target.value;
      // Peringatan penilaian ganda terikat pada pos, jadi diperiksa ulang
      if (form.guide) showPicked(form.guide);
      saveDraft();
    });

    $('#guideInput').addEventListener('input', e => {
      const g = findGuide(e.target.value);
      form.guide = g;
      if (g && g.guideName.toLowerCase() === e.target.value.trim().toLowerCase()) showPicked(g);
      else $('#guidePicked').classList.add('hidden');
      tampilkanKandidat(null);
      saveDraft();
      $('#draftNote').hidden = false;
    });
    $('#catatan').addEventListener('input', e => { form.catatan = e.target.value; saveDraft(); });

    $$('.criterion').forEach(c => {
      if (c.dataset.crit !== 'review') c.classList.add('unset');

      c.querySelectorAll('.seg').forEach(btn => btn.addEventListener('click', () => {
        form.crit[c.dataset.crit] = Number(btn.dataset.val) === 1;
        applyCritUI(); saveDraft(); haptic(15);
        $('#draftNote').hidden = false;
      }));

      // Penghitung Review
      c.querySelectorAll('.stepbtn').forEach(btn => btn.addEventListener('click', () => {
        const n = Math.max(0, Number(form.crit.review) || 0) + Number(btn.dataset.step);
        form.crit.review = Math.min(REVIEW_MAKS, Math.max(0, n));
        applyCritUI(); saveDraft(); haptic(15);
        $('#draftNote').hidden = false;
      }));
    });

    $('#formEval').addEventListener('submit', submitEval);

    $('#guideSearch').addEventListener('input', renderGuideCards);

    // Filter kategori & regu di layar Penilaian
    ['#filterKategori', '#filterRegu'].forEach(sel => {
      const el = $(sel);
      if (!el) return;
      el.addEventListener('change', () => {
        Sync.Settings.set({
          filterKategori: $('#filterKategori').value,
          filterRegu: $('#filterRegu').value,
        });
        // Kalau nama yang sudah diketik tak lagi masuk filter, kosongkan
        const g = findGuide($('#guideInput').value);
        if (!g || !cocokFilter(g, $('#filterKategori').value, $('#filterRegu').value)) {
          $('#guideInput').value = '';
          form.guide = null;
          $('#guidePicked').classList.add('hidden');
        }
        fillGuideInputs();
        saveDraft();
      });
    });

    // Filter kategori di layar Daftar Guide
    $$('.chip[data-gfilter]').forEach(ch => ch.addEventListener('click', () => {
      $$('.chip[data-gfilter]').forEach(x => x.classList.remove('active'));
      ch.classList.add('active');
      guideKategoriFilter = ch.dataset.gfilter;
      renderGuideCards();
    }));

    // Chip riwayat dan chip daftar guide harus terpisah — jangan pakai '.chip' polos
    $$('.chip[data-filter]').forEach(ch => ch.addEventListener('click', () => {
      $$('.chip[data-filter]').forEach(x => x.classList.remove('active'));
      ch.classList.add('active'); historyFilter = ch.dataset.filter; renderHistory();
    }));

    $('#btnExportCsv').addEventListener('click', exportCsv);
    $('#btnSyncNow').addEventListener('click', () => Sync.syncNow({ force: true }));
    $('#btnForceSync').addEventListener('click', () => Sync.syncNow({ force: true }));

    $('#btnTestServer').addEventListener('click', async () => {
      $('#testHint').textContent = 'Menghubungi server…';
      try {
        const r = await Sync.ping();
        $('#testHint').textContent = `✅ Terhubung · ${r.total} data di server`;
        toast('Server dapat dihubungi', 'ok', '📡');
        await loadGuides();
      } catch (e) {
        $('#testHint').textContent = '❌ Gagal: ' + e.message;
        toast('Server tidak dapat dihubungi', 'err', '❌');
      }
    });

    $('#btnBackup').addEventListener('click', async () => {
      download(`cadangan-penilaian-${Date.now()}.json`, await DB.exportJson(), 'application/json');
      toast('Cadangan JSON diunduh', 'ok', '📦');
    });

    $('#btnClearSynced').addEventListener('click', async () => {
      if (!confirm('Hapus semua data yang SUDAH terkirim dari perangkat ini?')) return;
      const n = await DB.clearSynced();
      toast(`${n} data terkirim dihapus`, 'ok', '🧹');
      refreshStats(); refreshStorage(); renderHistory();
    });

    $('#serverUrl').addEventListener('change', e => {
      Sync.Settings.set({ serverUrl: e.target.value.trim() });
      refreshServerNotice();
      toast('Alamat server disimpan', 'ok', '⚙️');
    });
    $('#optForceOffline').addEventListener('change', e => { Sync.Settings.set({ forceOffline: e.target.checked }); setNet(); });
    $('#optEncrypt').addEventListener('change', e => { Sync.Settings.set({ encrypt: e.target.checked }); DB.setEncryption(e.target.checked); toast('Berlaku untuk data baru', 'ok', '🔐'); });
    $('#optHaptic').addEventListener('change', e => Sync.Settings.set({ haptic: e.target.checked }));

    $('#btnShowTutorial').addEventListener('click', () => showTutorial(true));
    $('#tutSkip').addEventListener('click', endTutorial);
    $('#tutNext').addEventListener('click', () => {
      if (tutIndex < TUT.length - 1) { tutIndex++; renderTut(); } else endTutorial();
    });

    window.addEventListener('hashchange', () => go((location.hash || '#home').slice(1)));
    window.addEventListener('beforeunload', () => DB.backupNow());
  }

  /* ---------------------- Sync events ---------------------- */
  function bindSync() {
    Sync.onChange((state, d) => {
      setNet(state, d);
      if (state === 'done' && d.sent > 0) {
        // Rekap di spreadsheet disusun ulang oleh trigger tiap 5 menit, jadi
        // jeda singkat itu wajar dan bukan tanda data gagal masuk.
        toast(`${d.sent} data terkirim · rekap spreadsheet menyusul ±5 menit`, 'ok', '✅');
        haptic(20);
      }
      if (state === 'error') toast('Gagal kirim, akan dicoba lagi otomatis', 'warn', '⏳');
      if (state === 'offline') { /* badge saja */ }
      refreshStats();
      if (current === 'riwayat') renderHistory();
    });
  }

  /* ---------------------- Init ---------------------- */
  let initialised = false;
  async function init() {
    if (initialised) return;          // cegah inisialisasi ganda
    initialised = true;
    $$('[data-version]').forEach(el => el.textContent = APP_VERSION);

    const s = Sync.Settings.get();
    $('#serverUrl').value = s.serverUrl || '';
    $('#optForceOffline').checked = !!s.forceOffline;
    $('#optEncrypt').checked = s.encrypt !== false;
    $('#optHaptic').checked = s.haptic !== false;
    DB.setEncryption(s.encrypt !== false);
    form.pos = s.pos || 1;
    $('#homePos').value = String(form.pos);
    $('#posSelect').value = String(form.pos);
    // Filter guide diingat antar penilaian — staff satu pos biasanya
    // menangani kategori/regu yang sama sepanjang hari.
    if ($('#filterKategori')) $('#filterKategori').value = s.filterKategori || '';
    if ($('#filterRegu')) $('#filterRegu').value = s.filterRegu || '';

    bind();
    bindSync();

    const restored = await DB.restoreIfEmpty();
    if (restored) toast(`${restored} data dipulihkan dari cadangan`, 'warn', '♻️');

    loadDraft();
    applyCritUI();
    setNet();
    await refreshStats();
    await loadGuides();
    go((location.hash || '#home').slice(1));
    showTutorial(false);
    Sync.start();

    // Service worker + pembaruan otomatis.
    // Strategi cache-first membuat perangkat bisa memakai versi lama setelah
    // aplikasi di-deploy ulang; blok ini memuat ulang halaman begitu versi baru
    // mengambil alih, sehingga staff tidak perlu membersihkan cache manual.
    if ('serviceWorker' in navigator) {
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading) return;
        reloading = true;
        location.reload();
      });
      navigator.serviceWorker.register('sw.js')
        .then(reg => {
          reg.update();
          setInterval(() => reg.update(), 60 * 60 * 1000); // cek pembaruan tiap jam
        })
        .catch(e => console.warn('[sw]', e));
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
