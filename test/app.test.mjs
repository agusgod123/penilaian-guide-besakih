/**
 * Uji fungsional aplikasi (tanpa browser) memakai jsdom + fake-indexeddb.
 * Menjalankan index.html sungguhan beserta db.js, sync.js, app.js.
 *
 *   npm i jsdom fake-indexeddb
 *   node server/server.js      # terminal 1
 *   node test/app.test.mjs     # terminal 2
 */
import fs from 'node:fs';
import path from 'node:path';
import { webcrypto } from 'node:crypto';
import { JSDOM, VirtualConsole } from 'jsdom';
import 'fake-indexeddb/auto';

const APP = process.env.APP_DIR || path.resolve(new URL('..', import.meta.url).pathname);
const BASE = process.env.BASE || 'http://localhost:3000';

const results = [];
const check = (id, ok, note = '') => { results.push({ id, ok, note }); console.log(`${ok ? '✅' : '❌'} ${id}${note ? ' — ' + note : ''}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- siapkan DOM ---------- */
const html = fs.readFileSync(path.join(APP, 'public', 'index.html'), 'utf8');
const vc = new VirtualConsole();
const jsErrors = [];
vc.on('jsdomError', e => jsErrors.push(e.message));
vc.on('error', (...a) => jsErrors.push(a.join(' ')));

const dom = new JSDOM(html, {
  url: BASE + '/',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  virtualConsole: vc,
});
const { window } = dom;

// polyfill lingkungan browser yang tidak ada di jsdom
window.indexedDB = globalThis.indexedDB;
window.IDBKeyRange = globalThis.IDBKeyRange;
Object.defineProperty(window, 'crypto', { value: webcrypto, configurable: true });
window.isSecureContext = true;
window.fetch = (...a) => fetch(...a);
window.Blob = globalThis.Blob;
window.URL.createObjectURL = () => 'blob:stub';
window.URL.revokeObjectURL = () => {};
window.confirm = () => true;
window.alert = () => {};
window.scrollTo = () => {};   // jsdom belum mengimplementasikan scrollTo
let online = true;
Object.defineProperty(window.navigator, 'onLine', { get: () => online, configurable: true });
const downloads = [];
window.HTMLAnchorElement.prototype.click = function () { downloads.push(this.download); };

/* Pemeriksaan statis config.js — dijalankan sebelum aplikasi dimuat.
   Menjaga agar alamat server tidak pernah tidak sengaja terkirim dalam
   keadaan kosong, yang membuat aplikasi tidak siap pakai di perangkat baru. */
const isiConfig = fs.readFileSync(path.join(APP, 'public', 'config.js'), 'utf8');
const cocokUrl = isiConfig.match(/serverUrl:\s*'([^']*)'/);
check('config.js berisi alamat server (aplikasi siap pakai tanpa setting manual)',
  !!cocokUrl && /^https?:\/\/\S+$/.test(cocokUrl[1]),
  cocokUrl && cocokUrl[1] ? cocokUrl[1].slice(0, 42) + '…' : '(kosong)');

// jalankan skrip aplikasi berurutan
for (const f of ['config.js', 'js/db.js', 'js/sync.js', 'js/app.js']) {
  window.eval(fs.readFileSync(path.join(APP, 'public', f), 'utf8'));
}

/* Selama pengujian, arahkan ke server Node lokal — bukan ke Apps Script
   sungguhan di config.js — supaya pengujian tidak menyentuh data produksi. */
window.localStorage.setItem('besakih.settings', JSON.stringify({ serverUrl: BASE }));
if (window.document.readyState === 'loading') {
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
}
await sleep(1500);

const $ = s => window.document.querySelector(s);
const $$ = s => Array.from(window.document.querySelectorAll(s));
const click = el => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
const setVal = (el, v) => { el.value = v; el.dispatchEvent(new window.Event('input', { bubbles: true })); el.dispatchEvent(new window.Event('change', { bubbles: true })); };

/* ---------- AC-1 ---------- */
check('AC-1 aplikasi terbuka tanpa login',
  $$('input[type=password]').length === 0 && !$('#view-home').hidden);

/* ---------- Tutorial ---------- */
check('Tutorial tampil pada pemakaian pertama', !$('#tutorial').hidden);
for (let i = 0; i < 4; i++) { click($('#tutNext')); }
check('Tutorial dapat diselesaikan & tidak muncul lagi',
  $('#tutorial').hidden && window.localStorage.getItem('besakih.tutorialDone') === '1');

/* ---------- AC-2 ---------- */
const nOpt = $$('#guideList option').length;
check('AC-2 daftar guide >= 10 & dapat dipilih', nOpt >= 10, `${nOpt} guide dari server`);

/* ---------- Filter Kategori & Regu ---------- */
{
  const semua = $$('#guideList option').length;
  const pilih = (kat, regu) => {
    setVal($('#filterKategori'), kat);
    setVal($('#filterRegu'), regu);
    return $$('#guideList option').length;
  };

  const asing = pilih('Asing', '');
  const domestik = pilih('Domestik', '');
  check('Filter kategori memperkecil daftar guide',
    asing > 0 && domestik > 0 && asing < semua && domestik < semua,
    `semua ${semua} · Asing ${asing} · Domestik ${domestik}`);

  const a1 = pilih('Asing', '1');
  const a2 = pilih('Asing', '2');
  check('Filter regu mempersempit lagi', a1 > 0 && a2 > 0 && a1 < asing && a2 < asing,
    `Asing-1 ${a1} · Asing-2 ${a2}`);

  // Guide yang merangkap dua regu harus muncul di keduanya
  const daftar = (await (await fetch(BASE + '/api/guides')).json()).guides;
  const rangkap = daftar.find(g => (g.regu || '').indexOf(',') > -1);
  if (rangkap) {
    const kode = rangkap.regu.split(',').map(s => s.trim());
    const munculDiSemua = kode.every(k => {
      pilih(k[0] === 'A' ? 'Asing' : 'Domestik', k.slice(1));
      return $$('#guideList option').some(o => o.value === rangkap.guideName);
    });
    check('Guide merangkap regu muncul di setiap regunya', munculDiSemua,
      `${rangkap.guideName} (${rangkap.regu})`);
  }

  pilih('', '');
  check('Filter dikosongkan menampilkan seluruh guide', $$('#guideList option').length === semua);

  // Filter tersimpan agar tidak perlu diatur ulang
  pilih('Domestik', '2');
  check('Pilihan filter tersimpan di Pengaturan',
    window.Sync.Settings.get().filterKategori === 'Domestik' &&
    window.Sync.Settings.get().filterRegu === '2');
  pilih('', '');
}

/* ---------- AC-6 burger menu ---------- */
click($('#btnMenu'));
check('AC-6 burger menu terbuka', !$('#drawer').hidden && $$('.navitem').length === 6);
const views = ['nilai', 'guides', 'riwayat', 'pengaturan', 'tentang', 'home'];
let ok = true;
for (const v of views) {
  click($(`.navitem[data-nav="${v}"]`) || $('#btnNewEval'));
  const nav = $$('.navitem').find(n => n.dataset.nav === v);
  if (nav) click(nav);
  await sleep(30);
  if ($('#view-' + v).hidden) { ok = false; console.log('   layar gagal:', v); }
}
check('AC-6 semua layar (Penilaian, Guide, Riwayat, Pengaturan, Tentang) dapat dibuka', ok);

/* ---------- AC-3 simpan lokal ---------- */
click($('#btnNewEval'));
await sleep(50);
setVal($('#guideInput'), 'I Wayan Suparta');
click($('[data-crit=idCard] .seg.yes'));
click($('[data-crit=uniform] .seg.no'));
click($('[data-crit=etika] .seg.yes'));
setVal($('#catatan'), 'uji otomatis');
check('Draft otomatis tersimpan sebelum submit', !!window.localStorage.getItem('besakih.draft'));

$('#formEval').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
await sleep(700);
let counts = await window.DB.counts();
check('AC-3 penilaian tersimpan di IndexedDB', counts.total === 1, `${counts.total} entri`);

const saved = (await window.DB.all())[0];
const dariServer = (await (await fetch(BASE + '/api/guides')).json()).guides;
const seharusnya = dariServer.find(g => g.guideName === 'I Wayan Suparta');
check('Model data sesuai PRD §7',
  !!saved.evaluationId && saved.guideId === seharusnya.guideId && saved.pos === 1 &&
  !isNaN(Date.parse(saved.timestamp)) &&
  saved.criteria.idCard === true && saved.criteria.uniform === false && saved.criteria.etika === true,
  JSON.stringify({ guideId: saved.guideId, pos: saved.pos, criteria: saved.criteria }));

/* ---------- Enkripsi ---------- */
check('Enkripsi AES-256-GCM aktif', window.DB.isEncryptionActive() === true);
const raw = await new Promise(res => {
  const r = window.indexedDB.open('besakih-guide-eval');
  r.onsuccess = () => {
    const t = r.result.transaction('evaluations', 'readonly');
    t.objectStore('evaluations').getAll().onsuccess = e => res(e.target.result[0]);
  };
});
check('Data lokal terenkripsi (nama guide tidak terbaca mentah)',
  raw.enc === true && !JSON.stringify(raw).includes('Wayan'));

/* ---------- AC-5 sync ---------- */
await window.Sync.syncNow({ force: true });
await sleep(600);
counts = await window.DB.counts();
check('AC-5 data terkirim & status menjadi ✅', counts.synced === 1 && counts.pending === 0,
  `terkirim ${counts.synced}, tertunda ${counts.pending}`);

const health = await (await fetch(BASE + '/api/health')).json();
check('Data benar-benar tersimpan di server', health.total >= 1, `total server ${health.total}`);

/* ---------- Validasi form ---------- */
click($('#btnNewEval')); await sleep(30);
setVal($('#guideInput'), 'Nama Tidak Terdaftar');
$('#formEval').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
await sleep(300);
check('Guide tidak valid ditolak (tidak tersimpan)', (await window.DB.counts()).total === 1);

setVal($('#guideInput'), 'I Wayan Ardana');
$('#formEval').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
await sleep(300);
check('Kriteria belum lengkap ditolak', (await window.DB.counts()).total === 1);

/* ---------- AC-4 offline ---------- */
online = false;
window.dispatchEvent(new window.Event('offline'));
await sleep(100);
check('AC-4 badge offline tampil & UI tetap responsif',
  $('#netBadge').classList.contains('offline') && $('#netBadge .netlabel').textContent === 'Offline');

click($('[data-crit=idCard] .seg.no'));
click($('[data-crit=uniform] .seg.yes'));
click($('[data-crit=etika] .seg.yes'));
$('#formEval').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
await sleep(600);
counts = await window.DB.counts();
check('AC-4 penilaian tetap tersimpan saat offline', counts.total === 2 && counts.pending === 1,
  `total ${counts.total}, tertunda ${counts.pending}`);

const skipped = await window.Sync.syncNow();
check('Sync tidak dipaksa berjalan saat offline', skipped.skipped === 'offline');

/* ---------- AC-5 kembali online ---------- */
online = true;
window.dispatchEvent(new window.Event('online'));
await sleep(2500);
counts = await window.DB.counts();
check('AC-5 antrean terkirim otomatis begitu online', counts.pending === 0 && counts.synced === 2,
  `tertunda ${counts.pending}, terkirim ${counts.synced}`);

/* ---------- Riwayat ---------- */
const navRiwayat = $$('.navitem').find(n => n.dataset.nav === 'riwayat');
click(navRiwayat); await sleep(400);
const icons = $$('#historyList .card .cstat').map(e => e.textContent.trim());
check('Riwayat menampilkan status sync per entri', icons.length === 2 && icons.every(i => i === '✅'), icons.join(' '));

click($('.chip[data-filter=pending]')); await sleep(300);
check('Filter "Tertunda" bekerja', $$('#historyList .card').length === 0);
click($('.chip[data-filter=synced]')); await sleep(300);
check('Filter "Terkirim" bekerja', $$('#historyList .card').length === 2);

/* ---------- Export CSV ---------- */
downloads.length = 0;
click($('#btnExportCsv'));
await sleep(300);
check('Export CSV menghasilkan file', downloads.length === 1 && /\.csv$/.test(downloads[0]), downloads[0] || '-');

downloads.length = 0;
const navSet = $$('.navitem').find(n => n.dataset.nav === 'pengaturan');
click(navSet); await sleep(200);
click($('#btnBackup')); await sleep(300);
check('Export cadangan JSON berfungsi', downloads.length === 1 && /\.json$/.test(downloads[0]));

/* ---------- Pengaturan ---------- */
setVal($('#serverUrl'), 'https://server-lain.contoh.id/');
check('Alamat server tersimpan & dinormalisasi',
  window.Sync.baseUrl() === 'https://server-lain.contoh.id');
setVal($('#serverUrl'), '');
check('Alamat kosong jatuh ke alamat bawaan config.js',
  window.Sync.baseUrl() === String(window.APP_CONFIG.serverUrl).replace(/\/+$/, ''),
  window.Sync.baseUrl().slice(0, 42) + '…');

/* ---------- config.js sebagai fallback (deploy statis) ---------- */
window.APP_CONFIG.serverUrl = 'https://contoh-api.onrender.com/';
check('config.js dipakai bila Pengaturan kosong',
  window.Sync.baseUrl() === 'https://contoh-api.onrender.com');
setVal($('#serverUrl'), 'https://prioritas.contoh.id');
check('Pengaturan staff mengalahkan config.js',
  window.Sync.baseUrl() === 'https://prioritas.contoh.id');
setVal($('#serverUrl'), '');
check('Peringatan "alamat server belum diisi" tidak muncul di perangkat baru',
  window.Sync.needsServerUrl() === false && $('#serverNotice').hidden === true);

// Alamat yang sedang dipakai harus terlihat, walau kolomnya sengaja kosong
check('Alamat server aktif ditampilkan meski kolom isian kosong',
  $('#serverUrl').value === '' &&
  $('#serverAktifUrl').textContent === window.Sync.baseUrl() &&
  $('#serverAktifSumber').textContent.indexOf('bawaan') > -1,
  $('#serverAktifUrl').textContent.slice(0, 40) + '… / ' + $('#serverAktifSumber').textContent);

setVal($('#serverUrl'), 'https://ditimpa.contoh.id');
check('Sumber alamat berubah jadi "diisi manual" saat ditimpa',
  $('#serverAktifUrl').textContent === 'https://ditimpa.contoh.id' &&
  $('#serverAktifSumber').textContent.indexOf('manual') > -1);
setVal($('#serverUrl'), '');

// kembalikan ke server uji lokal untuk sisa pemeriksaan
window.APP_CONFIG.serverUrl = '';
setVal($('#serverUrl'), BASE);

$('#optForceOffline').checked = true;
$('#optForceOffline').dispatchEvent(new window.Event('change', { bubbles: true }));
check('Mode Offline Paksa mematikan sync', window.Sync.isOnline() === false);
$('#optForceOffline').checked = false;
$('#optForceOffline').dispatchEvent(new window.Event('change', { bubbles: true }));

/* ---------- Backup & pemulihan (§10) ---------- */
await window.DB.backupNow();
check('Backup ke localStorage tersedia', !!window.localStorage.getItem('besakih.backup'));

const cleared = await window.DB.clearSynced();
check('Hapus data terkirim berfungsi', cleared === 2 && (await window.DB.counts()).total === 0);
const restored = await window.DB.restoreIfEmpty();
check('Pemulihan otomatis dari cadangan berfungsi', restored === 2 && (await window.DB.counts()).total === 2,
  `${restored} entri dipulihkan`);

/* ---------- Retry / backoff ---------- */
window.Sync.Settings.set({ serverUrl: 'http://127.0.0.1:59999' });
const evalId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
await window.DB.save({
  evaluationId: evalId, guideId: 'G-003', guideName: 'I Gede Budiarsana', pos: 3,
  timestamp: new Date().toISOString(), criteria: { idCard: true, uniform: true, etika: false }, catatan: '',
});
const failRes = await window.Sync.syncNow({ force: true });
check('Kegagalan jaringan ditangani & entri tetap tertunda',
  failRes.failed === 1 && (await window.DB.counts()).pending === 1, failRes.lastError || '');
window.Sync.Settings.set({ serverUrl: '' });
const retryRes = await window.Sync.syncNow({ force: true });
check('Retry setelah server pulih berhasil', retryRes.sent === 1 && (await window.DB.counts()).pending === 0);

/* ---------- Duplikat / idempotensi ---------- */
const before = (await (await fetch(BASE + '/api/health')).json()).total;
await fetch(BASE + '/api/evaluations', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    evaluationId: evalId, guideId: 'G-003', guideName: 'I Gede Budiarsana', pos: 3,
    timestamp: new Date().toISOString(), criteria: { idCard: true, uniform: true, etika: false },
  }),
});
const after = (await (await fetch(BASE + '/api/health')).json()).total;
check('Pengiriman ulang tidak menggandakan data di server (append-only)', before === after, `${before} → ${after}`);

/* ---------- Daftar guide tetap ada walau server gagal ---------- */
{
  // Tiru perangkat baru: tidak ada cache, dan setiap panggilan ke server gagal.
  const aslinya = window.fetch;
  window.localStorage.removeItem('besakih.guides');
  window.fetch = async (url, opts) => {
    const u = String(url);
    if (u.indexOf('guides.json') > -1) return aslinya(u, opts); // salinan bawaan
    throw new Error('server tidak terjangkau');
  };

  const dom2 = new JSDOM(html, { url: BASE + '/', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc });
  const w2 = dom2.window;
  w2.indexedDB = globalThis.indexedDB;
  w2.IDBKeyRange = globalThis.IDBKeyRange;
  Object.defineProperty(w2, 'crypto', { value: webcrypto, configurable: true });
  w2.isSecureContext = true;
  w2.scrollTo = () => {};
  w2.alert = () => {};
  w2.confirm = () => true;
  // guides.json dibaca langsung dari berkas, meniru berkas yang ikut terpasang
  w2.fetch = async (url) => {
    const u = String(url);
    if (u.indexOf('guides.json') > -1) {
      const teks = fs.readFileSync(path.join(APP, 'public', 'guides.json'), 'utf8');
      return { ok: true, status: 200, json: async () => JSON.parse(teks) };
    }
    throw new Error('server tidak terjangkau');
  };
  for (const f of ['config.js', 'js/db.js', 'js/sync.js', 'js/app.js']) {
    w2.eval(fs.readFileSync(path.join(APP, 'public', f), 'utf8'));
  }
  if (w2.document.readyState === 'loading') {
    w2.document.dispatchEvent(new w2.Event('DOMContentLoaded'));
  }
  await sleep(1200);

  const jml = w2.document.querySelectorAll('#guideList option').length;
  check('Daftar guide tetap muncul walau server tidak terjangkau', jml === 296,
    `${jml} guide dari salinan bawaan`);
  check('Tidak menampilkan pesan "daftar guide belum tersedia"',
    w2.document.querySelector('#guideHelp').textContent.indexOf('tidak dapat dimuat') === -1);

  window.fetch = aslinya;
}

/* ---------- Adapter Google Apps Script ---------- */
{
  const GAS = 'https://script.google.com/macros/s/AKfycbXXXX/exec';
  const asli = window.fetch;
  let terakhir = null;
  let balasan = () => ({ ok: true, status: 200, body: { accepted: [], rejected: [] } });

  window.fetch = async (url, opts = {}) => {
    if (String(url).indexOf('script.google.com') === -1) return asli(url, opts);
    terakhir = { url: String(url), opts, body: opts.body ? JSON.parse(opts.body) : null };
    const r = balasan(terakhir);
    return {
      ok: r.ok, status: r.status,
      json: async () => r.body,
      text: async () => JSON.stringify(r.body),
    };
  };

  window.Sync.Settings.set({ serverUrl: GAS });
  check('Mendeteksi backend Apps Script dari URL', window.Sync.serverKind() === 'gas');
  check('Endpoint memakai query parameter, bukan path',
    window.Sync.endpoint('guides') === GAS + '?action=guides' &&
    window.Sync.endpoint('health') === GAS + '?action=health' &&
    window.Sync.endpoint('evaluations') === GAS);

  // Daftar guide lewat Apps Script
  balasan = () => ({ ok: true, status: 200, body: { guides: [
    { guideId: 'G-900', guideName: 'Guide Dari Sheets', lisensi: 'X', aktif: true },
  ] } });
  const dariSheets = await window.Sync.refreshGuides();
  check('Daftar guide terbaca dari Apps Script',
    dariSheets.length === 1 && dariSheets[0].guideId === 'G-900');

  // Simpan satu penilaian baru untuk diuji kirim
  const idGas = 'gas-' + Date.now();
  await window.DB.save({
    evaluationId: idGas, guideId: 'G-900', guideName: 'Guide Dari Sheets', pos: 2,
    timestamp: new Date().toISOString(),
    criteria: { idCard: true, uniform: true, etika: false }, catatan: '',
  });

  // 1) Apps Script membalas 200 TAPI tidak mengonfirmasi → tidak boleh dianggap terkirim
  balasan = () => ({ ok: true, status: 200, body: { accepted: [], rejected: [] } });
  let r = await window.Sync.syncNow({ force: true });
  check('HTTP 200 tanpa konfirmasi TIDAK dianggap terkirim',
    r.sent === 0 && r.failed === 1 && (await window.DB.counts()).pending === 1,
    r.lastError || '');

  // 2) busy → kegagalan sementara, tetap di antrean
  balasan = () => ({ ok: true, status: 200, body: { accepted: [], rejected: [], busy: true } });
  r = await window.Sync.syncNow({ force: true });
  check('Respons busy diperlakukan sebagai gagal sementara',
    r.sent === 0 && (await window.DB.counts()).pending === 1);

  // 3) Content-Type harus text/plain agar lolos CORS Apps Script
  check('POST ke Apps Script memakai Content-Type text/plain',
    terakhir.opts.headers['Content-Type'] === 'text/plain;charset=utf-8');
  check('Body tetap JSON sesuai model data PRD',
    terakhir.body.evaluationId === idGas && terakhir.body.pos === 2 &&
    terakhir.body.criteria.uniform === true);

  // 4) Konfirmasi benar → baru ditandai terkirim
  balasan = (req) => ({ ok: true, status: 200, body: {
    accepted: [{ evaluationId: req.body.evaluationId, synced: true, duplicate: false }],
    rejected: [],
  } });
  r = await window.Sync.syncNow({ force: true });
  check('Konfirmasi evaluationId → ditandai terkirim',
    r.sent === 1 && (await window.DB.counts()).pending === 0);

  // 5) Ditolak permanen → tidak diulang selamanya
  const idTolak = 'gas-tolak-' + Date.now();
  await window.DB.save({
    evaluationId: idTolak, guideId: 'G-900', guideName: 'Guide Dari Sheets', pos: 3,
    timestamp: new Date().toISOString(),
    criteria: { idCard: true, uniform: true, etika: true }, catatan: '',
  });
  balasan = (req) => ({ ok: true, status: 200, body: {
    accepted: [], rejected: [{ evaluationId: req.body.evaluationId, errors: ['pos harus 1, 2, atau 3'] }],
  } });
  r = await window.Sync.syncNow({ force: true });
  const ditandai = (await window.DB.all()).find(e => e.evaluationId === idTolak);
  check('Data ditolak Apps Script ditandai gagal, bukan diulang terus',
    r.failed === 1 && !!ditandai.lastError && ditandai.lastError.indexOf('Ditolak server') === 0,
    ditandai.lastError || '');

  window.fetch = asli;
  setVal($('#serverUrl'), '');
  check('Kembali ke mode REST saat alamat dikosongkan', window.Sync.serverKind() === 'rest');
}

/* ---------- Atribut [hidden] benar-benar menyembunyikan ---------- */
{
  const css = fs.readFileSync(path.join(APP, 'public', 'css', 'styles.css'), 'utf8');
  const hasRule = /\[hidden\]\s*\{[^}]*display\s*:\s*none\s*!important/.test(css);
  const displayed = ['#drawer', '#tutorial', '#view-riwayat', '#serverNotice']
    .filter(sel => {
      const el = $(sel);
      if (!el || !el.hidden) return false;
      return window.getComputedStyle(el).display !== 'none';
    });
  check('Elemen [hidden] benar-benar tersembunyi (drawer, tutorial, view)',
    hasRule && displayed.length === 0, displayed.join(', ') || 'aturan CSS ada');
}

/* ---------- Error JS ---------- */
check('Tidak ada error JavaScript fatal', jsErrors.length === 0, jsErrors.slice(0, 2).join(' | '));

/* ---------- ringkasan ---------- */
const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pemeriksaan lulus`);
process.exit(failed.length ? 1 : 0);
