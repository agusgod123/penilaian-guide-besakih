/**
 * Uji logika Code.gs di luar Google, dengan tiruan (stub) API Apps Script.
 * Tujuannya menangkap kesalahan sebelum kode ditempel ke spreadsheet sungguhan.
 *
 *   node server-gas/test-gas.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const APP = process.env.APP_DIR || path.resolve(new URL('..', import.meta.url).pathname);
const kode = fs.readFileSync(path.join(APP, 'server-gas', 'Code.gs'), 'utf8');

const hasil = [];
const cek = (id, ok, catatan = '') => {
  hasil.push({ id, ok });
  console.log(`${ok ? '✅' : '❌'} ${id}${catatan ? ' — ' + catatan : ''}`);
};

/* ---------------- Tiruan Spreadsheet ---------------- */
class FakeSheet {
  constructor(nama) { this.nama = nama; this.data = []; this.frozen = 0; this.widths = {}; }
  getLastRow() { return this.data.length; }
  getDataRange() { return this.getRange(1, 1, Math.max(this.data.length, 1), 20); }
  getRange(row, col, numRows = 1, numCols = 1) {
    const sh = this;
    return {
      setValues(values) {
        values.forEach((baris, i) => {
          const r = row - 1 + i;
          if (!sh.data[r]) sh.data[r] = [];
          baris.forEach((v, j) => { sh.data[r][col - 1 + j] = v; });
        });
        return this;
      },
      getValues() {
        const out = [];
        for (let i = 0; i < numRows; i++) {
          const baris = sh.data[row - 1 + i] || [];
          out.push(Array.from({ length: numCols }, (_, j) => baris[col - 1 + j] ?? ''));
        }
        return out;
      },
      setFontWeight() { return this; }, setFontColor() { return this; },
      setBackground() { return this; }, setHorizontalAlignment() { return this; },
      setFontSize() { return this; },
    };
  }
  setFrozenRows(n) { this.frozen = n; }
  setColumnWidth(i, w) { this.widths[i] = w; }
  deleteRow(r) { this.data.splice(r - 1, 1); }
  clear() { this.data = []; return this; }
}

class FakeSpreadsheet {
  constructor() { this.sheets = [new FakeSheet('Sheet1')]; }
  getSheetByName(n) { return this.sheets.find(s => s.nama === n) || null; }
  insertSheet(n) { const s = new FakeSheet(n); this.sheets.push(s); return s; }
  getSheets() { return this.sheets; }
  deleteSheet(s) { this.sheets = this.sheets.filter(x => x !== s); }
}

const doc = new FakeSpreadsheet();
let lockDipegang = false;
let gagalKunci = false;

const sandbox = {
  SpreadsheetApp: { getActiveSpreadsheet: () => doc, flush() {} },
  ContentService: {
    MimeType: { JSON: 'json' },
    createTextOutput: (t) => ({ getContent: () => t, setMimeType() { return this; } }),
  },
  LockService: {
    getScriptLock: () => ({
      waitLock() { if (gagalKunci) throw new Error('sibuk'); lockDipegang = true; },
      releaseLock() { lockDipegang = false; },
    }),
  },
  Logger: { log() {} },
  console,
};
// createTextOutput.setMimeType harus mengembalikan objek yang sama
sandbox.ContentService.createTextOutput = (t) => {
  const o = { getContent: () => t };
  o.setMimeType = () => o;
  return o;
};

vm.createContext(sandbox);
vm.runInContext(kode, sandbox);
const { setup, doGet, doPost, ujiCepat } = sandbox;
const J = (res) => JSON.parse(res.getContent());

/* ---------------- Uji ---------------- */
setup();
cek('setup() membuat tab Guides, Evaluations, Petunjuk',
  ['Guides', 'Evaluations', 'Petunjuk'].every(n => doc.getSheetByName(n)),
  doc.getSheets().map(s => s.nama).join(', '));
cek('setup() menghapus tab bawaan Sheet1', !doc.getSheetByName('Sheet1'));
const JML_GUIDE = 296;
cek('setup() mengisi seluruh guide + header',
  doc.getSheetByName('Guides').getLastRow() === JML_GUIDE + 1,
  `${doc.getSheetByName('Guides').getLastRow() - 1} guide`);
cek('setup() memasang header Evaluations', doc.getSheetByName('Evaluations').getLastRow() === 1);

setup();
cek('setup() aman dijalankan dua kali (tidak menggandakan)',
  doc.getSheetByName('Guides').getLastRow() === JML_GUIDE + 1);

// Spreadsheet lama yang masih memakai skema "lisensi" harus ikut diperbarui
{
  const gs = doc.getSheetByName('Guides');
  gs.data = [['guideId', 'guideName', 'lisensi', 'aktif'], ['G-001', 'Guide Lama', 'HPI-001', true]];
  setup();
  const header = gs.getRange(1, 1, 1, 5).getValues()[0];
  cek('setup() memperbarui tab Guides berskema lama',
    header[2] === 'kategori' && header[3] === 'regu' && gs.getLastRow() === JML_GUIDE + 1,
    header.join(' | '));
}

// Tab yang cuma berisi header (mis. penulisan sebelumnya terputus) harus diisi ulang
{
  const gs = doc.getSheetByName('Guides');
  gs.data = [['guideId', 'guideName', 'kategori', 'regu', 'aktif']];
  setup();
  cek('setup() mengisi ulang tab Guides yang hanya berisi header',
    gs.getLastRow() === JML_GUIDE + 1, `${gs.getLastRow() - 1} guide`);
}

const health = J(doGet({ parameter: { action: 'health' } }));
cek('health membalas ok & total 0', health.ok === true && health.total === 0);

const g = J(doGet({ parameter: { action: 'guides' } }));
cek('guides mengembalikan seluruh yang aktif', g.guides.length === JML_GUIDE, `${g.guides.length} guide`);
cek('guides memuat kategori & regu',
  !!g.guides[0].guideId && !!g.guides[0].guideName && !!g.guides[0].kategori && !!g.guides[0].regu,
  JSON.stringify(g.guides[0]));

// Guide nonaktif harus tersaring
{
  const gs = doc.getSheetByName('Guides');
  gs.data.push(['G-900', 'Guide Nonaktif', 'Asing', 'A1', false]);
  const g2 = J(doGet({ parameter: { action: 'guides' } }));
  cek('Guide dengan aktif=FALSE tidak ikut terkirim', g2.guides.length === JML_GUIDE);
  gs.data.pop();
}

const post = (obj) => J(doPost({ postData: { contents: JSON.stringify(obj) } }));
const contoh = (id, pos = 1) => ({
  evaluationId: id, guideId: 'G-001', guideName: 'Gusti Alit Astawa', pos,
  timestamp: new Date().toISOString(),
  criteria: { idCard: true, uniform: false, etika: true }, catatan: 'uji',
});

let r = post(contoh('uuid-1'));
cek('POST menyimpan penilaian', r.accepted.length === 1 && r.accepted[0].synced === true);
cek('Baris tersimpan di tab Evaluations', doc.getSheetByName('Evaluations').getLastRow() === 2);

const baris = doc.getSheetByName('Evaluations').getRange(2, 1, 1, 10).getValues()[0];
cek('Urutan kolom sesuai header',
  baris[0] === 'uuid-1' && Number(baris[2]) === 1 && baris[3] === 'G-001' &&
  baris[5] === true && baris[6] === false && baris[7] === true,
  JSON.stringify(baris.slice(0, 8)));

r = post(contoh('uuid-1'));
cek('Kirim ulang tidak menggandakan baris',
  r.accepted[0].duplicate === true && doc.getSheetByName('Evaluations').getLastRow() === 2);

r = post({ guideId: 'G-002', pos: 9, criteria: { idCard: 'ya' } });
cek('Data tidak sah ditolak dengan alasan jelas',
  r.accepted.length === 0 && r.rejected.length === 1 && r.rejected[0].errors.length >= 4,
  r.rejected[0].errors.slice(0, 3).join('; '));

r = J(doPost({ postData: { contents: JSON.stringify({
  evaluations: [contoh('uuid-2', 2), contoh('uuid-3', 3)] }) } }));
cek('Batch beberapa entri sekaligus',
  r.accepted.length === 2 && doc.getSheetByName('Evaluations').getLastRow() === 4);

r = post({ ...contoh('uuid-4'), pos: '2' });
cek('pos berupa teks "2" tetap diterima sebagai angka',
  r.accepted.length === 1 &&
  doc.getSheetByName('Evaluations').getRange(5, 3, 1, 1).getValues()[0][0] === 2);

r = J(doPost({ postData: { contents: 'bukan json' } }));
cek('Body bukan JSON ditolak tanpa membuat script error',
  r.accepted.length === 0 && r.rejected.length === 1);

gagalKunci = true;
r = post(contoh('uuid-5'));
cek('Gagal dapat kunci → busy, tidak mengaku tersimpan',
  r.busy === true && r.accepted.length === 0);
gagalKunci = false;
cek('Kunci selalu dilepas kembali', lockDipegang === false);

const totalAkhir = J(doGet({ parameter: { action: 'health' } })).total;
cek('health menghitung jumlah baris dengan benar', totalAkhir === 4, `total ${totalAkhir}`);

/* ---------------- resetGuides ---------------- */
{
  const gs = doc.getSheetByName('Guides');
  gs.data.push(['G-999', 'Guide Tambahan Manual', 'Asing', 'A1', true]);
  const sebelum = gs.getLastRow();
  const barisEvalSebelum = doc.getSheetByName('Evaluations').getLastRow();
  const pesan = sandbox.resetGuides();
  cek('resetGuides() menulis ulang daftar guide dari awal',
    sebelum === JML_GUIDE + 2 && doc.getSheetByName('Guides').getLastRow() === JML_GUIDE + 1, pesan);
  cek('resetGuides() tidak menyentuh data penilaian',
    doc.getSheetByName('Evaluations').getLastRow() === barisEvalSebelum);
}

const sebelumUji = doc.getSheetByName('Evaluations').getLastRow();
const uji = ujiCepat();
const sesudahUji = doc.getSheetByName('Evaluations').getLastRow();
cek('ujiCepat() bawaan berjalan & membersihkan barisnya',
  uji.indexOf('GAGAL') === -1 && sesudahUji === sebelumUji,
  `baris ${sebelumUji} → ${sesudahUji}`);

const gagal = hasil.filter(h => !h.ok);
console.log(`\n${hasil.length - gagal.length}/${hasil.length} pemeriksaan lulus`);
process.exit(gagal.length ? 1 : 0);
