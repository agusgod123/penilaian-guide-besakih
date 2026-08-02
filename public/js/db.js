/* =========================================================
   db.js — Penyimpanan lokal (IndexedDB + enkripsi AES-256-GCM)
   PRD §4.4, §5 (keamanan), §10 (mitigasi korupsi data)
   ========================================================= */
(function (global) {
  'use strict';

  const DB_NAME = 'besakih-guide-eval';
  const DB_VERSION = 1;
  const STORE = 'evaluations';
  const META = 'meta';
  const KEY_STORAGE = 'besakih.cryptoKey';
  const BACKUP_KEY = 'besakih.backup';
  const BACKUP_INTERVAL_MS = 5 * 60 * 1000; // §10: backup tiap 5 menit
  const STORAGE_LIMIT_BYTES = 10 * 1024 * 1024; // §10: batas 10 MB

  let dbPromise = null;
  let cryptoKey = null;
  let encryptionEnabled = true;

  /* ---------------------- Enkripsi ---------------------- */
  const canCrypto = () => !!(global.crypto && global.crypto.subtle && global.isSecureContext !== false);

  async function getKey() {
    if (cryptoKey) return cryptoKey;
    if (!canCrypto()) return null;
    try {
      const saved = localStorage.getItem(KEY_STORAGE);
      if (saved) {
        cryptoKey = await crypto.subtle.importKey('jwk', JSON.parse(saved), { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
      } else {
        cryptoKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
        localStorage.setItem(KEY_STORAGE, JSON.stringify(await crypto.subtle.exportKey('jwk', cryptoKey)));
      }
      return cryptoKey;
    } catch (e) {
      console.warn('[db] enkripsi tidak tersedia:', e);
      return null;
    }
  }

  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

  async function encryptObject(obj) {
    const key = encryptionEnabled ? await getKey() : null;
    if (!key) return { enc: false, payload: obj };
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)));
    return { enc: true, iv: b64(iv), payload: b64(data) };
  }

  async function decryptObject(rec) {
    if (!rec.enc) return rec.payload;
    const key = await getKey();
    if (!key) throw new Error('Kunci enkripsi hilang');
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: unb64(rec.iv) }, key, unb64(rec.payload)
    );
    return JSON.parse(dec.decode(plain));
  }

  /* ---------------------- IndexedDB ---------------------- */
  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!global.indexedDB) return reject(new Error('IndexedDB tidak didukung'));
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const os = db.createObjectStore(STORE, { keyPath: 'evaluationId' });
          os.createIndex('syncState', 'syncState');   // 0 = pending, 1 = synced
          os.createIndex('timestamp', 'timestamp');
        }
        if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: 'k' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function tx(mode, fn, storeName = STORE) {
    return openDB().then(db => new Promise((resolve, reject) => {
      const t = db.transaction(storeName, mode);
      const store = t.objectStore(storeName);
      let result;
      try { result = fn(store); } catch (e) { reject(e); return; }
      t.oncomplete = () => resolve(result && result.__req ? result.__req.result : result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    }));
  }

  const wrap = req => { const o = { __req: req }; return o; };

  /* ---------------------- API publik ---------------------- */
  const DB = {
    STORAGE_LIMIT_BYTES,

    setEncryption(on) { encryptionEnabled = !!on; },
    isEncryptionActive() { return encryptionEnabled && canCrypto(); },

    /** Simpan satu penilaian (status awal pending). */
    async save(evaluation) {
      const packed = await encryptObject(evaluation);
      const record = {
        evaluationId: evaluation.evaluationId,
        timestamp: evaluation.timestamp,
        pos: evaluation.pos,
        syncState: 0,
        attempts: 0,
        lastError: null,
        ...packed,
      };
      await tx('readwrite', s => wrap(s.put(record)));
      DB.scheduleBackup();
      return record;
    },

    /** Ambil semua entri, terurut terbaru dulu. */
    async all() {
      const records = await tx('readonly', s => wrap(s.getAll()));
      const out = [];
      for (const r of records || []) {
        try {
          const data = await decryptObject(r);
          out.push({ ...data, synced: r.syncState === 1, attempts: r.attempts || 0, lastError: r.lastError || null });
        } catch (e) {
          console.warn('[db] gagal membuka entri', r.evaluationId, e);
          out.push({ evaluationId: r.evaluationId, timestamp: r.timestamp, pos: r.pos,
                     guideName: '(data rusak)', guideId: '-', criteria: {}, corrupt: true,
                     synced: r.syncState === 1 });
        }
      }
      return out.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
    },

    /** Entri yang belum terkirim. */
    async pending() {
      return (await DB.all()).filter(e => !e.synced && !e.corrupt);
    },

    async counts() {
      const all = await DB.all();
      const today = new Date().toISOString().slice(0, 10);
      return {
        total: all.length,
        pending: all.filter(e => !e.synced).length,
        synced: all.filter(e => e.synced).length,
        today: all.filter(e => String(e.timestamp).slice(0, 10) === today).length,
      };
    },

    async markSynced(evaluationId) {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const t = db.transaction(STORE, 'readwrite');
        const s = t.objectStore(STORE);
        const g = s.get(evaluationId);
        g.onsuccess = () => {
          const rec = g.result;
          if (!rec) return;
          rec.syncState = 1; rec.lastError = null; rec.syncedAt = new Date().toISOString();
          s.put(rec);
        };
        t.oncomplete = resolve; t.onerror = () => reject(t.error);
      });
    },

    async markFailed(evaluationId, message) {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const t = db.transaction(STORE, 'readwrite');
        const s = t.objectStore(STORE);
        const g = s.get(evaluationId);
        g.onsuccess = () => {
          const rec = g.result;
          if (!rec) return;
          rec.attempts = (rec.attempts || 0) + 1;
          rec.lastError = String(message).slice(0, 200);
          s.put(rec);
        };
        t.oncomplete = resolve; t.onerror = () => reject(t.error);
      });
    },

    async clearSynced() {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const t = db.transaction(STORE, 'readwrite');
        const s = t.objectStore(STORE);
        let n = 0;
        const cur = s.index('syncState').openCursor(IDBKeyRange.only(1));
        cur.onsuccess = e => {
          const c = e.target.result;
          if (c) { c.delete(); n++; c.continue(); }
        };
        t.oncomplete = () => resolve(n);
        t.onerror = () => reject(t.error);
      });
    },

    /* ---- Cache daftar guide (PRD 4.1: dapat di-cache) ---- */
    async setGuides(list) {
      localStorage.setItem('besakih.guides', JSON.stringify({ at: Date.now(), list }));
    },
    getGuides() {
      try {
        const raw = JSON.parse(localStorage.getItem('besakih.guides') || 'null');
        return raw && Array.isArray(raw.list) ? raw : null;
      } catch { return null; }
    },

    /* ---- Backup ke localStorage (§10) ---- */
    _backupTimer: null,
    scheduleBackup() {
      if (DB._backupTimer) return;
      DB._backupTimer = setTimeout(() => { DB._backupTimer = null; DB.backupNow(); }, 3000);
    },
    async backupNow() {
      try {
        const records = await tx('readonly', s => wrap(s.getAll()));
        localStorage.setItem(BACKUP_KEY, JSON.stringify({ at: Date.now(), records }));
      } catch (e) { console.warn('[db] backup gagal', e); }
    },
    /** Pulihkan dari backup bila object store kosong tapi backup ada. */
    async restoreIfEmpty() {
      try {
        const existing = await tx('readonly', s => wrap(s.count()));
        if (existing > 0) return 0;
        const raw = JSON.parse(localStorage.getItem(BACKUP_KEY) || 'null');
        if (!raw || !raw.records || !raw.records.length) return 0;
        await tx('readwrite', s => { raw.records.forEach(r => s.put(r)); });
        return raw.records.length;
      } catch { return 0; }
    },

    /** Estimasi pemakaian penyimpanan. */
    async storageInfo() {
      let used = 0, quota = STORAGE_LIMIT_BYTES;
      try {
        if (navigator.storage && navigator.storage.estimate) {
          const est = await navigator.storage.estimate();
          used = est.usage || 0;
          quota = Math.min(est.quota || STORAGE_LIMIT_BYTES, STORAGE_LIMIT_BYTES);
        } else {
          used = (localStorage.getItem(BACKUP_KEY) || '').length * 2;
        }
      } catch {}
      return { used, quota, ratio: quota ? Math.min(used / quota, 1) : 0 };
    },

    async exportJson() {
      return JSON.stringify({ exportedAt: new Date().toISOString(), evaluations: await DB.all() }, null, 2);
    },
  };

  // Backup berkala tiap 5 menit
  setInterval(() => DB.backupNow(), BACKUP_INTERVAL_MS);

  global.DB = DB;
})(window);
