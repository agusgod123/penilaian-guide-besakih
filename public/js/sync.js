/* =========================================================
   sync.js — Sinkronisasi offline → online (PRD §8)
   1. Deteksi jaringan  2. Queue  3. Retry exponential backoff
   4. Append-only (tanpa konflik)
   ========================================================= */
(function (global) {
  'use strict';

  const SETTINGS_KEY = 'besakih.settings';
  const MAX_ATTEMPTS = 6;
  const BASE_DELAY = 2000;      // 2s, 4s, 8s, 16s, 32s, 64s
  const MAX_DELAY = 5 * 60_000;
  const AUTO_INTERVAL = 60_000; // cek berkala tiap 1 menit

  const listeners = new Set();
  let running = false;
  let retryTimer = null;
  let backoffStep = 0;

  const defaults = {
    serverUrl: '', forceOffline: false, encrypt: true, haptic: true, pos: 1,
    filterKategori: '', filterRegu: '',
  };

  const Settings = {
    get() {
      try { return { ...defaults, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')) }; }
      catch { return { ...defaults }; }
    },
    set(patch) {
      const next = { ...Settings.get(), ...patch };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      return next;
    },
  };

  const trim = u => String(u || '').trim().replace(/\/+$/, '');

  /**
   * Urutan penentuan alamat backend:
   * 1. Yang diisi staff di menu Pengaturan
   * 2. `serverUrl` pada config.js (untuk deploy statis, mis. GitHub Pages)
   * 3. Origin tempat aplikasi dibuka (mis. `node server/server.js` di lokal)
   */
  function baseUrl() {
    return trim(Settings.get().serverUrl)
        || trim(global.APP_CONFIG && global.APP_CONFIG.serverUrl)
        || global.location.origin;
  }

  /** True bila aplikasi di-host statis (tanpa backend di origin yang sama). */
  function needsServerUrl() {
    if (trim(Settings.get().serverUrl) || trim(global.APP_CONFIG && global.APP_CONFIG.serverUrl)) return false;
    return /\.github\.io$/i.test(global.location.hostname)
        || /\.pages\.dev$/i.test(global.location.hostname)
        || global.location.protocol === 'file:';
  }

  /**
   * Jenis backend. Google Apps Script hanya punya SATU URL (…/exec) tanpa path,
   * jadi endpoint-nya dibedakan lewat query parameter.
   */
  function serverKind() {
    return /script\.google(usercontent)?\.com/i.test(baseUrl()) ? 'gas' : 'rest';
  }

  /** URL endpoint sesuai jenis backend. */
  function endpoint(nama) {
    const b = baseUrl();
    if (serverKind() === 'gas') {
      return nama === 'evaluations' ? b : `${b}?action=${nama}`;
    }
    return nama === 'evaluations' ? `${b}/api/evaluations` : `${b}/api/${nama}`;
  }

  /**
   * Header POST. Apps Script tidak menjawab preflight `OPTIONS`, sehingga
   * `application/json` akan diblokir CORS. `text/plain` membuat permintaan
   * tergolong "simple request" — isi body tetap JSON dan dibaca lewat
   * `e.postData.contents`.
   */
  function postHeaders() {
    return serverKind() === 'gas'
      ? { 'Content-Type': 'text/plain;charset=utf-8' }
      : { 'Content-Type': 'application/json' };
  }

  function emit(state, detail) {
    listeners.forEach(fn => { try { fn(state, detail || {}); } catch (e) { console.warn(e); } });
  }

  function isOnline() {
    return navigator.onLine !== false && !Settings.get().forceOffline;
  }

  async function fetchWithTimeout(url, opts = {}, ms = 12000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
    finally { clearTimeout(t); }
  }

  /** Ambil daftar guide dari server, simpan ke cache. Aman dipanggil offline. */
  async function refreshGuides() {
    try {
      const res = await fetchWithTimeout(endpoint('guides'), { cache: 'no-store' }, 12000);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (Array.isArray(data.guides) && data.guides.length) {
        await DB.setGuides(data.guides);
        return data.guides;
      }
      throw new Error('daftar kosong');
    } catch (e) {
      const cached = DB.getGuides();
      if (cached) return cached.list;
      throw e;
    }
  }

  async function ping() {
    const res = await fetchWithTimeout(endpoint('health'), { cache: 'no-store' }, 15000);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  /** True bila server mengonfirmasi evaluationId tersimpan (bukan sekadar HTTP 200). */
  function diterima_(body, evaluationId) {
    return !!(body && Array.isArray(body.accepted)
      && body.accepted.some(a => a && a.evaluationId === evaluationId));
  }

  /**
   * Kirim semua entri pending satu per satu (append-only, idempotent by evaluationId).
   * @param {{force?:boolean, silent?:boolean}} opts
   */
  async function syncNow(opts = {}) {
    if (running) return { skipped: 'sedang berjalan' };
    if (!opts.force && !isOnline()) { emit('offline'); return { skipped: 'offline' }; }

    const queue = await DB.pending();
    if (!queue.length) { emit('idle', { pending: 0 }); return { sent: 0, failed: 0 }; }

    running = true;
    emit('syncing', { pending: queue.length });

    let sent = 0, failed = 0, lastError = null;

    for (const item of queue) {
      const payload = {
        evaluationId: item.evaluationId,
        guideId: item.guideId,
        guideName: item.guideName,
        pos: Number(item.pos),
        timestamp: item.timestamp,
        criteria: {
          idCard: !!item.criteria.idCard,
          uniform: !!item.criteria.uniform,
          etika: !!item.criteria.etika,
        },
        catatan: item.catatan || '',
      };
      try {
        const res = await fetchWithTimeout(endpoint('evaluations'), {
          method: 'POST',
          headers: postHeaders(),
          body: JSON.stringify(payload),
        }, serverKind() === 'gas' ? 30000 : 12000);

        if (res.status >= 500 || res.status === 429) throw new Error('Server sibuk (' + res.status + ')');

        const body = await res.json().catch(() => null);

        // Server sedang terkunci (mis. pos lain menulis bersamaan) — coba lagi nanti.
        if (body && body.busy) throw new Error('Server sedang sibuk menulis');

        const ditolak = body && Array.isArray(body.rejected)
          && body.rejected.some(r => !r.evaluationId || r.evaluationId === item.evaluationId);
        if (res.status === 400 || (ditolak && !diterima_(body, item.evaluationId))) {
          // Ditolak permanen (data tidak sah) — tandai gagal agar tidak diulang selamanya.
          const alasan = body && body.rejected ? JSON.stringify(body.rejected) : ('HTTP ' + res.status);
          await DB.markFailed(item.evaluationId, 'Ditolak server: ' + alasan);
          failed++; continue;
        }

        if (!res.ok) throw new Error('HTTP ' + res.status);

        // Baru tandai ✅ kalau server benar-benar mengonfirmasi evaluationId ini.
        // Status 200 saja tidak cukup: Apps Script tetap membalas 200 walau
        // penulisan ke spreadsheet gagal, dan data akan hilang tanpa jejak.
        if (!diterima_(body, item.evaluationId)) {
          throw new Error('Server tidak mengonfirmasi penyimpanan');
        }

        await DB.markSynced(item.evaluationId);
        sent++;
        emit('progress', { sent, total: queue.length });
      } catch (err) {
        lastError = err.message || String(err);
        await DB.markFailed(item.evaluationId, lastError);
        failed++;
        break; // jaringan bermasalah: hentikan, jadwalkan retry
      }
    }

    running = false;

    if (failed > 0) {
      backoffStep = Math.min(backoffStep + 1, MAX_ATTEMPTS);
      scheduleRetry();
      emit('error', { sent, failed, message: lastError });
    } else {
      backoffStep = 0;
      emit('done', { sent });
    }
    return { sent, failed, lastError };
  }

  function scheduleRetry() {
    clearTimeout(retryTimer);
    const delay = Math.min(BASE_DELAY * Math.pow(2, backoffStep - 1), MAX_DELAY);
    console.log(`[sync] retry dalam ${Math.round(delay / 1000)} detik`);
    retryTimer = setTimeout(() => { if (isOnline()) syncNow(); }, delay);
  }

  /* ------------------ Pemicu otomatis ------------------ */
  function start() {
    global.addEventListener('online', () => { backoffStep = 0; emit('online'); setTimeout(() => syncNow(), 800); });
    global.addEventListener('offline', () => emit('offline'));
    document.addEventListener('visibilitychange', () => { if (!document.hidden && isOnline()) syncNow(); });
    setInterval(() => { if (isOnline()) syncNow(); }, AUTO_INTERVAL);
    if (isOnline()) setTimeout(() => syncNow(), 1500);
  }

  global.Sync = {
    Settings, baseUrl, serverKind, endpoint, needsServerUrl,
    isOnline, syncNow, refreshGuides, ping, start,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    get isRunning() { return running; },
  };
})(window);
