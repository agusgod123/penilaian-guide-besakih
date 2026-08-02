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

// jalankan skrip aplikasi berurutan
for (const f of ['config.js', 'js/db.js', 'js/sync.js', 'js/app.js']) {
  window.eval(fs.readFileSync(path.join(APP, 'public', f), 'utf8'));
}
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
check('Model data sesuai PRD §7',
  !!saved.evaluationId && saved.guideId === 'G-001' && saved.pos === 1 &&
  !isNaN(Date.parse(saved.timestamp)) &&
  saved.criteria.idCard === true && saved.criteria.uniform === false && saved.criteria.etika === true,
  JSON.stringify({ pos: saved.pos, criteria: saved.criteria }));

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

setVal($('#guideInput'), 'Ni Made Ariani');
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
check('Alamat kosong kembali ke server asal', window.Sync.baseUrl() === BASE);

/* ---------- config.js sebagai fallback (deploy statis) ---------- */
window.APP_CONFIG.serverUrl = 'https://contoh-api.onrender.com/';
check('config.js dipakai bila Pengaturan kosong',
  window.Sync.baseUrl() === 'https://contoh-api.onrender.com');
setVal($('#serverUrl'), 'https://prioritas.contoh.id');
check('Pengaturan staff mengalahkan config.js',
  window.Sync.baseUrl() === 'https://prioritas.contoh.id');
setVal($('#serverUrl'), '');
window.APP_CONFIG.serverUrl = '';

check('Peringatan server tidak muncul saat backend satu origin',
  window.Sync.needsServerUrl() === false && $('#serverNotice').hidden === true);

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
  evaluationId: evalId, guideId: 'G-003', guideName: 'I Ketut Sudarsana', pos: 3,
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
    evaluationId: evalId, guideId: 'G-003', guideName: 'I Ketut Sudarsana', pos: 3,
    timestamp: new Date().toISOString(), criteria: { idCard: true, uniform: true, etika: false },
  }),
});
const after = (await (await fetch(BASE + '/api/health')).json()).total;
check('Pengiriman ulang tidak menggandakan data di server (append-only)', before === after, `${before} → ${after}`);

/* ---------- Error JS ---------- */
check('Tidak ada error JavaScript fatal', jsErrors.length === 0, jsErrors.slice(0, 2).join(' | '));

/* ---------- ringkasan ---------- */
const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pemeriksaan lulus`);
process.exit(failed.length ? 1 : 0);
