/**
 * Uji logika Code.gs di luar Google, dengan tiruan (stub) API Apps Script.
 * Tujuannya menangkap kesalahan sebelum kode ditempel ke spreadsheet sungguhan.
 *
 *   node server-gas/test-gas.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import vm from 'node:vm';

// fileURLToPath, bukan .pathname — di Windows .pathname menghasilkan "/D:/..."
// yang membuat path.resolve menempelkannya jadi "D:\D:\..." dan tes gagal jalan.
const APP = process.env.APP_DIR || path.resolve(url.fileURLToPath(new URL('..', import.meta.url)));
const kode = fs.readFileSync(path.join(APP, 'server-gas', 'Code.gs'), 'utf8');

const hasil = [];
const cek = (id, ok, catatan = '') => {
  hasil.push({ id, ok });
  console.log(`${ok ? '✅' : '❌'} ${id}${catatan ? ' — ' + catatan : ''}`);
};

/* ---------------- Tiruan Spreadsheet ---------------- */
class FakeSheet {
  constructor(nama) {
    this.nama = nama; this.data = []; this.frozen = 0; this.widths = {};
    this.merges = []; this.frozenCols = 0;
  }
  getLastRow() { return this.data.length; }
  getMaxRows() { return Math.max(this.data.length, 1000); }
  getMaxColumns() { return 26; }
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
      merge() { sh.merges.push({ row, col, numRows, numCols }); return this; },
      breakApart() {
        sh.merges = sh.merges.filter(m =>
          m.row + m.numRows - 1 < row || m.row > row + numRows - 1 ||
          m.col + m.numCols - 1 < col || m.col > col + numCols - 1);
        return this;
      },
      setFontWeight() { return this; }, setFontColor() { return this; },
      setBackground() { return this; }, setHorizontalAlignment() { return this; },
      setFontSize() { return this; },
    };
  }
  setFrozenRows(n) { this.frozen = n; }
  setFrozenColumns(n) { this.frozenCols = n; }
  setColumnWidth(i, w) { this.widths[i] = w; }
  deleteRow(r) { this.data.splice(r - 1, 1); }
  clear() { this.data = []; this.merges = []; return this; }
  clearFormats() { return this; }
}

class FakeSpreadsheet {
  constructor() { this.sheets = [new FakeSheet('Sheet1')]; this.tz = 'Asia/Makassar'; }
  getSpreadsheetTimeZone() { return this.tz; }
  getSheetByName(n) { return this.sheets.find(s => s.nama === n) || null; }
  insertSheet(n) { const s = new FakeSheet(n); this.sheets.push(s); return s; }
  getSheets() { return this.sheets; }
  deleteSheet(s) { this.sheets = this.sheets.filter(x => x !== s); }
}

const doc = new FakeSpreadsheet();
let lockDipegang = false;
let gagalKunci = false;
const props = new Map();
let triggers = [];

const sandbox = {
  SpreadsheetApp: {
    getActiveSpreadsheet: () => doc,
    flush() {},
    getSpreadsheetTimeZone: () => doc.getSpreadsheetTimeZone(),
    getUi: () => { throw new Error('tidak ada UI di lingkungan uji'); },
  },
  Utilities: {
    // Menghormati zona waktu betulan, seperti Apps Script. Versi lama tes ini
    // memakai UTC apa pun zonanya, sehingga salah-hitung tanggal karena beda
    // zona (mis. penilaian pagi di WITA) tidak akan pernah tertangkap di sini.
    formatDate(d, tz, pola) {
      const bagian = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
      }).formatToParts(d).reduce((o, p) => (o[p.type] = p.value, o), {});
      if (pola === 'yyyy-MM') return `${bagian.year}-${bagian.month}`;
      if (pola === 'yyyy-MM-dd') return `${bagian.year}-${bagian.month}-${bagian.day}`;
      return `${bagian.day} ${bagian.month} ${bagian.year} ${bagian.hour}:${bagian.minute}`;
    },
  },
  ScriptApp: {
    getProjectTriggers: () => triggers,
    newTrigger: (fn) => {
      const buat = () => { triggers.push({ getHandlerFunction: () => fn }); };
      const tb = { atHour: () => tb, everyDays: () => tb, everyMinutes: () => tb, create: buat };
      return { timeBased: () => tb };
    },
    deleteTrigger(t) { triggers = triggers.filter(x => x !== t); },
  },
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: k => (props.has(k) ? props.get(k) : null),
      setProperty(k, v) { props.set(k, String(v)); return this; },
      deleteProperty(k) { props.delete(k); return this; },
    }),
  },
  CacheService: {
    getScriptCache: () => { throw new Error('cache tidak tersedia di lingkungan uji'); },
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

  // Google menolak setFrozenColumns bila ada sel gabungan yang melintasi
  // batas kolom beku. Judul baris 1 karena itu tidak boleh di-merge.
  const bentrok = ['Rekap A1 2026-07', 'Rekap A2 2026-07', 'Rekap D1 2026-07', 'Rekap D2 2026-07']
    .map(n => doc.getSheetByName(n))
    .filter(s => s.frozenCols > 0 &&
      s.merges.some(m => m.row === 1 && m.col <= s.frozenCols && m.col + m.numCols - 1 > s.frozenCols));
  cek('Judul tidak di-merge melintasi kolom beku (jebakan setFrozenColumns)',
    bentrok.length === 0, bentrok.length ? bentrok.map(s => s.nama).join(', ') : 'aman');

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

  // Cap waktu di ujung kanan baris judul — pembeda rekap segar vs rekap basi
  const jmlKolomA1 = 1 + (2 + 1) * 3;
  cek('Rekap membawa cap waktu "Diperbarui:"',
    String(a1.getRange(1, jmlKolomA1, 1, 1).getValues()[0][0]).indexOf('Diperbarui:') === 0,
    String(a1.getRange(1, jmlKolomA1, 1, 1).getValues()[0][0]));

  // Sisa sel gabungan dari susunan kemarin tidak boleh menelan nilai hari ini
  const a2 = doc.getSheetByName('Rekap A2 2026-07');
  a2.merges.push({ row: 5, col: 2, numRows: 1, numCols: 3 });
  sandbox.bangunRekap('2026-07');
  cek('Sel gabungan sisa susunan lama dilepas sebelum rekap ditulis ulang',
    !a2.merges.some(m => m.row === 5), `${a2.merges.length} gabungan tersisa`);

  // Pemeriksaan mandiri: penilaian ada tapi guideId-nya tak dikenal
  {
    const simpan = ev.data.slice();
    ev.data = [ev.data[0], ['x1', '2026-07-03T02:00:00.000Z', 1, 'G-TIDAK-ADA', '?', 1, 1, 1, '', '']];
    const pesanAneh = sandbox.bangunRekap('2026-07');
    cek('bangunRekap() memperingatkan bila tidak ada nilai yang masuk rekap',
      pesanAneh.indexOf('TIDAK ADA YANG MASUK REKAP') > -1, pesanAneh.slice(-90));
    ev.data = simpan;
  }

  ev.data = [ev.data[0]];                       // bersihkan lagi untuk uji berikutnya
}

/* ---------------- Zona waktu & pembaruan otomatis ---------------- */
{
  const ev = doc.getSheetByName('Evaluations');
  ev.data = [ev.data[0]];

  // 2026-07-03T17:30Z = 4 Juli 01.30 WITA. Rekap harus memakai tanggal setempat,
  // bukan tanggal UTC — kalau tidak, penilaian sore hari lompat ke hari lain.
  ev.data.push(['tz1', '2026-07-03T17:30:00.000Z', 1, 'G-001', 'Gusti Alit Astawa', 1, 1, 2, '', '']);
  sandbox.bangunRekap('2026-07');
  const tzA1 = doc.getSheetByName('Rekap A1 2026-07');
  cek('Tanggal rekap memakai zona waktu spreadsheet, bukan UTC',
    String(tzA1.getRange(2, 2, 1, 1).getValues()[0][0]) === 'TGL: 4-7-2026',
    String(tzA1.getRange(2, 2, 1, 1).getValues()[0][0]));

  // POST harus menitipkan bulan yang berubah, lalu trigger yang menyusun rekap
  props.clear();
  triggers = [];
  ev.data = [ev.data[0]];
  const kirim = J(doPost({ postData: { contents: JSON.stringify({
    evaluationId: 'auto-1', guideId: 'G-001', guideName: 'Gusti Alit Astawa', pos: 1,
    timestamp: '2026-09-10T02:00:00.000Z',
    criteria: { idCard: true, uniform: true, review: 3 },
  }) } }));
  cek('POST menitipkan bulan yang perlu dirangkum ulang',
    kirim.accepted.length === 1 && props.get('rekapTertunda') === '2026-09',
    `tertunda="${props.get('rekapTertunda')}"`);
  cek('POST tidak membangun rekap sendiri (balasan tetap cepat)',
    !doc.getSheetByName('Rekap A1 2026-09'));

  sandbox.rekapOtomatis();
  const sep = doc.getSheetByName('Rekap A1 2026-09');
  cek('rekapOtomatis() menyusun rekap bulan yang tertunda',
    !!sep && sep.getRange(5, 1, 1, 4).getValues()[0][0] === 'Gusti Alit Astawa' &&
    sep.getRange(5, 2, 1, 3).getValues()[0].join(',') === '1,1,3',
    sep ? sep.getRange(5, 1, 1, 4).getValues()[0].join(' | ') : 'tab tidak dibuat');
  cek('rekapOtomatis() menghapus tanda setelah selesai', !props.has('rekapTertunda'));

  const tabSebelum = doc.getSheets().length;
  sandbox.rekapOtomatis();
  cek('rekapOtomatis() diam saja bila tidak ada penilaian baru',
    doc.getSheets().length === tabSebelum);

  // Kalau kunci sedang dipegang proses lain, bulan itu harus DITANDAI ULANG —
  // kalau tandanya hilang begitu saja, pembaruan rekapnya tidak pernah terjadi.
  props.set('rekapTertunda', '2026-09');
  gagalKunci = true;
  sandbox.rekapOtomatis();
  gagalKunci = false;
  cek('Rekap yang gagal karena kunci ditandai ulang, bukan hilang',
    props.get('rekapTertunda') === '2026-09', `tertunda="${props.get('rekapTertunda')}"`);
  sandbox.rekapOtomatis();
  cek('Percobaan berikutnya berhasil menyusun rekap', !props.has('rekapTertunda'));

  // guideId asing harus ditolak, bukan diam-diam masuk lalu hilang dari rekap
  const asing = J(doPost({ postData: { contents: JSON.stringify({
    evaluationId: 'auto-2', guideId: 'G-999', guideName: 'Entah Siapa', pos: 1,
    timestamp: '2026-09-10T02:00:00.000Z',
    criteria: { idCard: true, uniform: true, review: 1 },
  }) } }));
  cek('guideId yang tidak ada di tab Guides ditolak',
    asing.accepted.length === 0 &&
    String(asing.rejected[0].errors).indexOf('tidak ada di tab Guides') > -1,
    String(asing.rejected[0].errors));

  // Nama dari perangkat berdaftar lama diperbaiki memakai tab Guides
  J(doPost({ postData: { contents: JSON.stringify({
    evaluationId: 'auto-3', guideId: 'G-002', guideName: 'Nama Salah Dari Aplikasi Lama', pos: 2,
    timestamp: '2026-09-11T02:00:00.000Z',
    criteria: { idCard: true, uniform: true, review: 1 },
  }) } }));
  const barisNama = ev.getRange(ev.getLastRow(), 1, 1, 10).getValues()[0];
  cek('guideName ditulis ulang memakai nama resmi dari tab Guides',
    barisNama[4] === 'I Gede Astawa', `tersimpan sebagai "${barisNama[4]}"`);

  // Batas wajar
  const batas = J(doPost({ postData: { contents: JSON.stringify({
    evaluationId: 'auto-4', guideId: 'G-002', guideName: 'I Gede Astawa', pos: 2,
    timestamp: '2026-09-11T02:00:00.000Z',
    criteria: { idCard: true, uniform: true, review: 9999 }, catatan: 'x'.repeat(2000),
  }) } }));
  const barisBatas = ev.getRange(ev.getLastRow(), 1, 1, 10).getValues()[0];
  cek('review & catatan dipangkas ke batas wajar',
    batas.accepted.length === 1 && barisBatas[7] === 20 && barisBatas[8].length === 500,
    `review=${barisBatas[7]} panjang catatan=${barisBatas[8].length}`);

  const borongan = J(doPost({ postData: { contents: JSON.stringify({
    evaluations: Array.from({ length: 201 }, (_, i) => ({
      evaluationId: 'b' + i, guideId: 'G-001', guideName: 'Gusti Alit Astawa', pos: 1,
      timestamp: '2026-09-11T02:00:00.000Z', criteria: { idCard: true, uniform: true, review: 0 },
    })) }) } }));
  cek('Kiriman borongan berlebihan ditolak', borongan.accepted.length === 0);

  props.clear();
  ev.data = [ev.data[0]];
}

/* ---------------- Pemeriksaan kesehatan & trigger ---------------- */
{
  triggers = [];
  sandbox.pasangTriggerHarian();
  const nama = triggers.map(t => t.getHandlerFunction()).sort().join(',');
  cek('pasangTriggerHarian() memasang trigger 5 menit + harian',
    nama === 'rekapHarian,rekapOtomatis', nama);

  sandbox.pasangTriggerHarian();
  cek('Trigger tidak menumpuk bila dipasang dua kali', triggers.length === 2, `${triggers.length} trigger`);

  const ev = doc.getSheetByName('Evaluations');
  ev.data = [ev.data[0], ['s1', '2026-09-01T02:00:00.000Z', 1, 'G-XXX', '?', 1, 1, 1, '', '']];
  const laporan = sandbox.periksaKesehatan();
  cek('periksaKesehatan() menunjuk guideId yang tercecer',
    laporan.indexOf('G-XXX') > -1 && laporan.indexOf('Total penilaian tersimpan : 1') > -1,
    laporan.split('\n').pop());
  ev.data = [ev.data[0]];
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
