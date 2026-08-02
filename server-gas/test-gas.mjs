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
      setValue(v) { return this.setValues([[v]]); },
      setFormulas(values) { return this.setValues(values); },
      merge() { return this; },
      setFontWeight() { return this; }, setFontColor() { return this; },
      setBackground() { return this; }, setHorizontalAlignment() { return this; },
      setFontSize() { return this; },
    };
  }
  setFrozenRows(n) { this.frozen = n; }
  setFrozenColumns(n) { this.frozenCols = n; }
  setColumnWidth(i, w) { this.widths[i] = w; }
  deleteRow(r) { this.data.splice(r - 1, 1); }
  clear() { this.data = []; return this; }
  clearFormats() { return this; }
}

class FakeSpreadsheet {
  constructor() { this.sheets = [new FakeSheet('Sheet1')]; }
  getSpreadsheetTimeZone() { return 'Asia/Makassar'; }
  getSheetByName(n) { return this.sheets.find(s => s.nama === n) || null; }
  insertSheet(n) { const s = new FakeSheet(n); this.sheets.push(s); return s; }
  getSheets() { return this.sheets; }
  deleteSheet(s) { this.sheets = this.sheets.filter(x => x !== s); }
}

const doc = new FakeSpreadsheet();
let lockDipegang = false;
let gagalKunci = false;

const sandbox = {
  SpreadsheetApp: {
    getActiveSpreadsheet: () => doc,
    flush() {},
    getSpreadsheetTimeZone: () => 'Asia/Makassar',
    getUi: () => { throw new Error('tidak ada UI di lingkungan uji'); },
  },
  Utilities: {
    formatDate(d, tz, pola) {
      const p = n => String(n).padStart(2, '0');
      if (pola === 'yyyy-MM') return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}`;
      return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
    },
  },
  ScriptApp: {
    getProjectTriggers: () => [],
    newTrigger: () => ({ timeBased: () => ({ atHour: () => ({ everyDays: () => ({ create() {} }) }) }) }),
    deleteTrigger() {},
  },
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
  criteria: { idCard: true, uniform: false, review: 2 }, catatan: 'uji',
});

let r = post(contoh('uuid-1'));
cek('POST menyimpan penilaian', r.accepted.length === 1 && r.accepted[0].synced === true);
cek('Baris tersimpan di tab Evaluations', doc.getSheetByName('Evaluations').getLastRow() === 2);

const baris = doc.getSheetByName('Evaluations').getRange(2, 1, 1, 10).getValues()[0];
cek('Urutan kolom sesuai header (uniform, idCard, review)',
  baris[0] === 'uuid-1' && Number(baris[2]) === 1 && baris[3] === 'G-001' &&
  baris[5] === 0 && baris[6] === 1 && baris[7] === 2,
  JSON.stringify(baris.slice(0, 8)));

r = post(contoh('uuid-1'));
cek('Kirim ulang tidak menggandakan baris',
  r.accepted[0].duplicate === true && doc.getSheetByName('Evaluations').getLastRow() === 2);

r = post({ guideId: 'G-002', pos: 9, criteria: { idCard: 'ya', review: -1 } });
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

/* ---------------- Rekap bulanan ---------------- */
{
  const ev = doc.getSheetByName('Evaluations');
  ev.data = [ev.data[0]];                       // sisakan header saja

  const T = (hari, jam) => `2026-07-${String(hari).padStart(2, '0')}T${jam}:00:00.000Z`;
  const buat = (id, gid, nama, pos, hari, uniform, idCard, review) =>
    ev.data.push([id, T(hari, '02'), pos, gid, nama, uniform, idCard, review, '', T(hari, '02')]);

  // G-001 (Asing A1) tanggal 3: pos 1 bagus, pos 3 buruk -> harus terambil yang buruk
  buat('e1', 'G-001', 'Gusti Alit Astawa', 1, 3, 1, 1, 1);
  buat('e2', 'G-001', 'Gusti Alit Astawa', 3, 3, 0, 0, 3);
  // G-001 tanggal 5: sekali saja
  buat('e3', 'G-001', 'Gusti Alit Astawa', 2, 5, 1, 1, 0);
  // G-005 (Domestik D2) tanggal 4
  buat('e4', 'G-005', 'I Gede Darta', 1, 4, 0, 1, 2);
  // bulan lain — tidak boleh ikut
  ev.data.push(['e9', '2026-06-10T02:00:00.000Z', 1, 'G-001', 'Gusti Alit Astawa', 1, 1, 9, '', '']);

  const pesan = sandbox.bangunRekap('2026-07');
  cek('bangunRekap() menghasilkan 4 tab regu + 1 tab per pos',
    ['Rekap A1 2026-07', 'Rekap A2 2026-07', 'Rekap D1 2026-07', 'Rekap D2 2026-07',
     'Rekap per Pos 2026-07'].every(n => doc.getSheetByName(n)), pesan);

  const a1 = doc.getSheetByName('Rekap A1 2026-07');
  const head3 = a1.getRange(3, 1, 1, 10).getValues()[0];
  cek('Header rekap memakai istilah lama (NAME / UNI FORM / ID / REVIEW)',
    head3[0] === 'NAME' && head3[1] === 'UNI FORM' && head3[2] === 'ID' && head3[3] === 'REVIEW',
    head3.slice(0, 4).join(' | '));

  // G-001 ada di baris 5 (nama paling awal secara abjad di regu A1)
  const barisG1 = a1.getRange(5, 1, 1, 12).getValues()[0];
  cek('Nilai harian mengambil yang paling buruk antar pos',
    barisG1[0] === 'Gusti Alit Astawa' && barisG1[1] === 0 && barisG1[2] === 0,
    `uniform=${barisG1[1]} id=${barisG1[2]} (pos 1 bernilai 1/1, pos 3 bernilai 0/0)`);
  cek('Review mengambil nilai tertinggi antar pos, tidak terhapus',
    barisG1[3] === 3, `review=${barisG1[3]}`);

  cek('Tanggal tanpa penilaian dibiarkan kosong',
    barisG1[4] === 1 && barisG1[5] === 1 && barisG1[6] === 0,
    'tanggal 5: uniform=1 id=1 review=0');

  const kolTotal = 1 + 2 * 3 + 1;               // 2 tanggal -> TOTAL mulai kolom 8
  const rumus = a1.getRange(5, kolTotal, 1, 3).getValues()[0];
  cek('Kolom TOTAL berisi rumus SUM yang tetap hidup',
    String(rumus[0]).indexOf('=SUM(') === 0 && String(rumus[0]).indexOf('B5') > -1,
    String(rumus[0]));

  cek('Penilaian bulan lain tidak ikut terhitung',
    a1.getRange(2, 1, 1, 12).getValues()[0].filter(v => String(v).indexOf('TGL') === 0).length === 2,
    'hanya 2 tanggal di Juli');

  // Guide yang tidak pernah dinilai tetap muncul (agar terlihat siapa yang kosong)
  cek('Seluruh anggota regu tercantum walau belum pernah dinilai',
    a1.getLastRow() - 4 > 50, `${a1.getLastRow() - 4} baris guide di regu A1`);

  const perPos = doc.getSheetByName('Rekap per Pos 2026-07');
  const headPos = perPos.getRange(2, 1, 1, 15).getValues()[0];
  cek('Tab per pos memisahkan Pos 1, 2, dan 3',
    headPos[2] === 'P1 Dinilai' && headPos[6] === 'P2 Dinilai' && headPos[10] === 'P3 Dinilai',
    headPos.slice(2, 4).join(' | '));

  const barisPos = perPos.getRange(3, 1, 2, 15).getValues();
  const g1pos = barisPos.find(b => b[0] === 'Gusti Alit Astawa');
  cek('Rincian per pos mencatat jumlah penilaian tiap pos',
    g1pos && g1pos[2] === 1 && g1pos[6] === 1 && g1pos[10] === 1 && g1pos[14] === 3,
    g1pos ? `P1=${g1pos[2]} P2=${g1pos[6]} P3=${g1pos[10]} total=${g1pos[14]}` : 'tidak ketemu');

  // Jalankan dua kali — tidak boleh menggandakan tab atau baris
  const jmlTabSebelum = doc.getSheets().length;
  sandbox.bangunRekap('2026-07');
  cek('bangunRekap() aman diulang (tab ditulis ulang, tidak bertambah)',
    doc.getSheets().length === jmlTabSebelum &&
    doc.getSheetByName('Rekap A1 2026-07').getRange(5, 1, 1, 1).getValues()[0][0] === 'Gusti Alit Astawa');

  ev.data = [ev.data[0]];                       // bersihkan lagi untuk uji berikutnya
}

/* ---------------- Migrasi skema lama ---------------- */
{
  const ev = doc.getSheetByName('Evaluations');
  ev.data = [
    ['evaluationId', 'timestamp', 'pos', 'guideId', 'guideName', 'idCard', 'uniform', 'etika', 'catatan', 'receivedAt'],
    ['lama-1', '2026-06-01T02:00:00.000Z', 1, 'G-001', 'Gusti Alit Astawa', true, false, true, 'catatan lama', ''],
  ];
  setup();
  const h = ev.getRange(1, 1, 1, 10).getValues()[0];
  const b = ev.getRange(2, 1, 1, 10).getValues()[0];
  cek('Tab Evaluations skema lama dimigrasikan',
    h[5] === 'uniform' && h[6] === 'idCard' && h[7] === 'review', h.slice(5, 8).join(' | '));
  cek('Nilai lama dipindahkan dengan benar (bukan dihapus)',
    b[5] === 0 && b[6] === 1 && b[7] === 1 && b[8] === 'catatan lama',
    `uniform=${b[5]} idCard=${b[6]} review=${b[7]}`);
  ev.data = [ev.data[0]];
}

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
