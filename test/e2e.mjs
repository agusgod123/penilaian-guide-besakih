/**
 * Uji end-to-end Acceptance Criteria (PRD §9) dengan Puppeteer.
 *
 *   npm i puppeteer     (sekali saja, di folder ini atau global)
 *   node server/server.js        # terminal 1
 *   node test/e2e.mjs            # terminal 2
 */
import puppeteer from 'puppeteer';

const BASE = process.env.BASE || 'http://localhost:3000';
const results = [];
const check = (id, ok, note = '') => {
  results.push({ id, ok, note });
  console.log(`${ok ? '✅' : '❌'} ${id}${note ? ' — ' + note : ''}`);
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.setViewport({ width: 412, height: 915, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(BASE, { waitUntil: 'networkidle0' });
await sleep(1200);

/* AC-1 — tanpa login */
const hasLogin = await page.$$eval('input[type=password]', els => els.length);
check('AC-1 tanpa login', hasLogin === 0 && (await page.$('#view-home')) !== null);

/* Tutorial pertama kali muncul, lalu ditutup */
const tutVisible = await page.$eval('#tutorial', el => !el.hidden);
check('Tutorial overlay tampil saat pertama buka', tutVisible);
if (tutVisible) {
  for (let i = 0; i < 4; i++) { await page.click('#tutNext'); await sleep(120); }
}
check('Tutorial dapat ditutup', await page.$eval('#tutorial', el => el.hidden));

/* AC-2 — dropdown guide >= 10 */
await page.click('#btnNewEval');
await sleep(300);
const nGuides = await page.$$eval('#guideList option', o => o.length);
check('AC-2 daftar guide >= 10', nGuides >= 10, `${nGuides} guide`);

/* AC-7 — ukuran target sentuh & teks */
const tapOk = await page.evaluate(() => {
  const sel = ['#btnSave', '.seg', '.bigselect', '.iconbtn', '.navitem'];
  const bad = [];
  for (const s of sel) {
    document.querySelectorAll(s).forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.height > 0 && r.height < 48) bad.push(s + ':' + Math.round(r.height));
    });
  }
  const fs = parseFloat(getComputedStyle(document.body).fontSize);
  return { bad, fs };
});
check('AC-7 target sentuh >= 48px & teks >= 16px',
  tapOk.bad.length === 0 && tapOk.fs >= 16, `font ${tapOk.fs}px, pelanggaran: ${tapOk.bad.join(', ') || 'tidak ada'}`);

/* AC-3 — isi form & simpan lokal */
await page.type('#guideInput', 'I Wayan Suparta');
await page.evaluate(() => {
  document.querySelector('[data-crit=idCard] .seg.yes').click();
  document.querySelector('[data-crit=uniform] .seg.no').click();
  document.querySelector('[data-crit=review] .stepbtn[data-step="1"]').click();
});
await page.type('#catatan', 'uji otomatis');
await page.click('#btnSave');
await sleep(900);

const stored = await page.evaluate(async () => (await DB.all()).length);
check('AC-3 penilaian tersimpan di IndexedDB', stored >= 1, `${stored} entri`);

const encActive = await page.evaluate(() => DB.isEncryptionActive());
check('Enkripsi AES-256-GCM aktif', encActive === true);

const rawEncrypted = await page.evaluate(() => new Promise(res => {
  const r = indexedDB.open('besakih-guide-eval');
  r.onsuccess = () => {
    const tx = r.result.transaction('evaluations', 'readonly');
    tx.objectStore('evaluations').getAll().onsuccess = e => {
      const rec = e.target.result[0];
      res({ enc: !!rec.enc, bocor: JSON.stringify(rec).includes('Wayan') });
    };
  };
}));
check('Data lokal benar-benar terenkripsi (nama tidak terbaca)',
  rawEncrypted.enc && !rawEncrypted.bocor);

/* AC-5 — sync otomatis saat online */
await page.evaluate(() => Sync.syncNow({ force: true }));
await sleep(1500);
const syncedCount = await page.evaluate(async () => (await DB.counts()).synced);
check('AC-5 data terkirim ke server & status ✅', syncedCount >= 1, `${syncedCount} tersinkron`);

const serverTotal = await (await fetch(`${BASE}/api/health`)).json();
check('Data benar-benar tersimpan di server', serverTotal.total >= 1, `total server ${serverTotal.total}`);

/* AC-4 — offline: UI tetap jalan, badge offline, data tetap tersimpan */
await page.setOfflineMode(true);
await page.evaluate(() => window.dispatchEvent(new Event('offline')));
await sleep(400);
const badgeOffline = await page.$eval('#netBadge', el => el.classList.contains('offline'));
check('AC-4 badge offline tampil', badgeOffline);

await page.evaluate(() => location.hash = '#nilai');
await sleep(300);
await page.evaluate(() => {
  document.querySelector('#guideInput').value = '';
});
await page.type('#guideInput', 'Ni Made Ariani');
await page.evaluate(() => {
  document.querySelector('#guideInput').dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('[data-crit=idCard] .seg.no').click();
  document.querySelector('[data-crit=uniform] .seg.yes').click();
  document.querySelector('[data-crit=review] .stepbtn[data-step="1"]').click();
});
await page.click('#btnSave');
await sleep(800);
const pendingOffline = await page.evaluate(async () => (await DB.counts()).pending);
check('AC-4 penilaian tetap tersimpan saat offline', pendingOffline >= 1, `${pendingOffline} tertunda`);

/* AC-5 (lanjutan) — kembali online, antrean terkirim otomatis */
await page.setOfflineMode(false);
await page.evaluate(() => window.dispatchEvent(new Event('online')));
await sleep(3000);
const afterOnline = await page.evaluate(async () => await DB.counts());
check('AC-5 antrean otomatis terkirim setelah online', afterOnline.pending === 0,
  `tertunda ${afterOnline.pending}, terkirim ${afterOnline.synced}`);

/* AC-6 — burger menu & seluruh layar */
await page.evaluate(() => location.hash = '#home');
await sleep(300);
await page.click('#btnMenu');
await sleep(250);
const drawerOpen = await page.$eval('#drawer', el => !el.hidden);
const navCount = await page.$$eval('.navitem', els => els.length);
check('AC-6 burger menu terbuka', drawerOpen && navCount === 6, `${navCount} menu`);

let allViewsOk = true;
for (const v of ['nilai', 'guides', 'riwayat', 'pengaturan', 'tentang', 'home']) {
  await page.evaluate(view => location.hash = '#' + view, v);
  await sleep(250);
  const shown = await page.$eval('#view-' + v, el => !el.hidden);
  if (!shown) { allViewsOk = false; console.log('   layar gagal:', v); }
}
check('AC-6 semua layar dapat dibuka', allViewsOk);

/* Riwayat menampilkan ikon status */
await page.evaluate(() => location.hash = '#riwayat');
await sleep(500);
const histo = await page.$$eval('#historyList .card .cstat', els => els.map(e => e.textContent.trim()));
check('Riwayat menampilkan ikon sync ✅/⏳', histo.length >= 2 && histo.every(t => ['✅', '⏳', '⚠️'].includes(t)),
  histo.join(' '));

/* AC-8 — PWA: manifest + service worker */
const swReg = await page.evaluate(async () => {
  const regs = await navigator.serviceWorker.getRegistrations();
  return regs.length;
});
const manifestHref = await page.$eval('link[rel=manifest]', el => el.getAttribute('href'));
const manifestRes = await fetch(`${BASE}/${manifestHref}`);
const manifest = await manifestRes.json();
check('AC-8 service worker terdaftar', swReg >= 1);
check('AC-8 manifest valid (name, icons, standalone, start_url)',
  !!manifest.name && manifest.icons.length >= 2 && manifest.display === 'standalone' && !!manifest.start_url);

/* Ketersediaan offline penuh: reload tanpa jaringan */
await page.setOfflineMode(true);
let offlineLoad = false;
try {
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(1200);
  offlineLoad = await page.$eval('#view-home', el => !!el);
} catch (e) { offlineLoad = false; }
check('Aplikasi tetap terbuka saat reload tanpa jaringan (service worker)', offlineLoad);
await page.setOfflineMode(false);

/* Ukuran aplikasi <= 5 MB */
const { execSync } = await import('node:child_process');
const appDir = process.env.APP_DIR || new URL('..', import.meta.url).pathname;
const sizeKb = Number(execSync('du -sk public | cut -f1', { cwd: appDir }).toString().trim());
check('Ukuran app shell <= 5 MB', sizeKb <= 5120, `${(sizeKb / 1024).toFixed(2)} MB`);

/* Tidak ada JS error */
const realErrors = errors.filter(e => !/favicon|Failed to load resource.*503|offline/i.test(e));
check('Tidak ada error JavaScript', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

await browser.close();

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pemeriksaan lulus`);
process.exit(failed.length ? 1 : 0);
