/* =========================================================
   app.js — Kontroler UI
   ========================================================= */
(function () {
  'use strict';

  const APP_VERSION = '1.0.0';
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
  let form = { pos: 1, guide: null, crit: { idCard: null, uniform: null, etika: null }, catatan: '' };
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
      if (!guides.length) {
        $('#guideHelp').innerHTML =
          '⚠️ Daftar guide tidak dapat dimuat. Tutup lalu buka ulang aplikasi.';
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
    // Batasi jumlah kartu yang digambar agar layar tetap ringan di perangkat lama
    const tampil = list.slice(0, 120);
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
    form = { pos, guide: null, crit: { idCard: null, uniform: null, etika: null }, catatan: '' };
    $('#posSelect').value = String(pos);
    $('#guideInput').value = '';
    $('#catatan').value = '';
    $('#guidePicked').classList.add('hidden');
    $$('.seg').forEach(b => b.classList.remove('on'));
    $$('.criterion').forEach(c => c.classList.add('unset'));
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

  function applyCritUI() {
    $$('.criterion').forEach(c => {
      const k = c.dataset.crit;
      const v = form.crit[k];
      c.classList.toggle('unset', v === null);
      c.querySelectorAll('.seg').forEach(b => b.classList.toggle('on', v !== null && String(+b.dataset.val) === String(+v)));
    });
  }

  function showPicked(g) {
    const el = $('#guidePicked');
    el.textContent = `✓ ${g.guideName} · ${g.guideId} · ${labelRegu(g.regu)}`;
    el.classList.remove('hidden');
  }

  async function submitEval(e) {
    e.preventDefault();
    const g = findGuide($('#guideInput').value);
    if (!g) { toast('Pilih nama guide dulu', 'warn', '⚠️'); $('#guideInput').focus(); return; }
    const missing = Object.keys(form.crit).filter(k => form.crit[k] === null);
    if (missing.length) { toast('Lengkapi semua penilaian (Ya/Tidak)', 'warn', '⚠️'); return; }

    const evaluation = {
      evaluationId: uuid(),
      guideId: g.guideId,
      guideName: g.guideName,
      pos: Number($('#posSelect').value),
      timestamp: new Date().toISOString(),
      criteria: { idCard: !!form.crit.idCard, uniform: !!form.crit.uniform, etika: !!form.crit.etika },
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
      return `<div class="card">
        <span class="cstat">${e.corrupt ? '⚠️' : e.synced ? '✅' : '⏳'}</span>
        <span class="cbody">
          <span class="cname">${esc(e.guideName)}</span>
          <span class="cmeta">Pos ${esc(e.pos)} · ${esc(fmtTime(e.timestamp))} · ${e.synced ? 'Terkirim' : 'Menunggu sync'}</span>
          <span class="badges">${b('ID', !!c.idCard)}${b('Uniform', !!c.uniform)}${b('Etika', !!c.etika)}</span>
          ${e.catatan ? `<span class="cmeta">📝 ${esc(e.catatan)}</span>` : ''}
          ${e.lastError && !e.synced ? `<span class="cmeta">⚠️ ${esc(e.lastError)}</span>` : ''}
        </span>
      </div>`;
    }).join('');
  }

  async function exportCsv() {
    const all = await DB.all();
    if (!all.length) { toast('Belum ada data untuk diexport', 'warn', '⚠️'); return; }
    const head = ['evaluationId', 'waktu', 'pos', 'guideId', 'guideName', 'idCard', 'uniform', 'etika', 'catatan', 'status'];
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = all.map(e => [
      e.evaluationId, e.timestamp, e.pos, e.guideId, e.guideName,
      e.criteria?.idCard ? 'Ya' : 'Tidak',
      e.criteria?.uniform ? 'Ya' : 'Tidak',
      e.criteria?.etika ? 'Ya' : 'Tidak',
      e.catatan || '', e.synced ? 'Terkirim' : 'Menunggu',
    ].map(q).join(','));
    const csv = '﻿' + [head.join(','), ...rows].join('\r\n');
    download(`penilaian-guide-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv;charset=utf-8');
    toast('CSV diunduh', 'ok', '📄');
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
    { i: '✅', t: 'Langkah 2 — Nilai', b: 'Tekan Ya atau Tidak untuk ID‑Card, Uniform, dan Etika. Lalu tekan SIMPAN.' },
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
        if (g) { form.guide = g; $('#guideInput').value = g.guideName; showPicked(g); saveDraft(); go('nilai'); }
      }
    });

    $('#btnNewEval').addEventListener('click', () => { form.pos = Number($('#homePos').value); $('#posSelect').value = form.pos; go('nilai'); });
    $('#homePos').addEventListener('change', e => { form.pos = Number(e.target.value); Sync.Settings.set({ pos: form.pos }); saveDraft(); });
    $('#posSelect').addEventListener('change', e => { form.pos = Number(e.target.value); Sync.Settings.set({ pos: form.pos }); $('#homePos').value = e.target.value; saveDraft(); });

    $('#guideInput').addEventListener('input', e => {
      const g = findGuide(e.target.value);
      form.guide = g;
      if (g && g.guideName.toLowerCase() === e.target.value.trim().toLowerCase()) showPicked(g);
      else $('#guidePicked').classList.add('hidden');
      saveDraft();
      $('#draftNote').hidden = false;
    });
    $('#catatan').addEventListener('input', e => { form.catatan = e.target.value; saveDraft(); });

    $$('.criterion').forEach(c => {
      c.classList.add('unset');
      c.querySelectorAll('.seg').forEach(btn => btn.addEventListener('click', () => {
        form.crit[c.dataset.crit] = Number(btn.dataset.val) === 1;
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
      if (state === 'done' && d.sent > 0) { toast(`${d.sent} data berhasil terkirim`, 'ok', '✅'); haptic(20); }
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
