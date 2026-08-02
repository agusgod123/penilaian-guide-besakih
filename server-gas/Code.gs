/**
 * ============================================================
 *  Backend Penilaian Guide Kawasan Besakih
 *  Google Apps Script Web App (terikat pada spreadsheet)
 * ============================================================
 *
 *  CARA PAKAI
 *  1. Buka spreadsheet "Penilaian Guide Besakih — Basis Data"
 *  2. Menu Extensions (Ekstensi) → Apps Script
 *  3. Hapus isi bawaan, tempel SELURUH file ini, lalu simpan (Ctrl+S)
 *  4. Pilih fungsi "setup" di dropdown, tekan Run. Setujui izin saat diminta.
 *     → Tab Guides, Evaluations, dan Petunjuk akan dibuat otomatis.
 *  5. Deploy → New deployment → Web app
 *        Execute as     : Me
 *        Who has access : Anyone
 *  6. Salin URL yang berakhiran /exec
 *  7. Di aplikasi (HP/tablet staff): Pengaturan → Alamat Server → tempel URL
 *     → tekan "Tes Koneksi Server"
 *
 *  Kalau script ini diubah, deploy ulang lewat
 *  Deploy → Manage deployments → Edit (ikon pensil) → Version: New version
 *  supaya URL-nya TIDAK berubah.
 * ============================================================
 */

var SHEET_EVAL    = 'Evaluations';
var SHEET_GUIDES  = 'Guides';
var SHEET_INFO    = 'Petunjuk';

var HEADER_EVAL   = ['evaluationId', 'timestamp', 'pos', 'guideId', 'guideName',
                     'idCard', 'uniform', 'etika', 'catatan', 'receivedAt'];
var HEADER_GUIDES = ['guideId', 'guideName', 'lisensi', 'aktif'];

var GUIDES_AWAL = [
  ['G-001', 'I Wayan Suparta',      'HPI-BLI-1021', true],
  ['G-002', 'Ni Made Ariani',       'HPI-BLI-1044', true],
  ['G-003', 'I Ketut Sudarsana',    'HPI-BLI-1078', true],
  ['G-004', 'Ni Nyoman Sriati',     'HPI-BLI-1090', true],
  ['G-005', 'I Gede Putra Wijaya',  'HPI-BLI-1112', true],
  ['G-006', 'Ni Luh Putu Ratnasari','HPI-BLI-1133', true],
  ['G-007', 'I Nyoman Astawa',      'HPI-BLI-1150', true],
  ['G-008', 'I Komang Darmawan',    'HPI-BLI-1167', true],
  ['G-009', 'Ni Kadek Widiasih',    'HPI-BLI-1189', true],
  ['G-010', 'I Putu Agus Mahendra', 'HPI-BLI-1201', true],
  ['G-011', 'Ni Wayan Sukerti',     'HPI-BLI-1223', true],
  ['G-012', 'I Made Rai Sudana',    'HPI-BLI-1245', true],
  ['G-013', 'Ni Putu Eka Yuliani',  'HPI-BLI-1260', true],
  ['G-014', 'I Wayan Budiarta',     'HPI-BLI-1288', true],
  ['G-015', 'I Ketut Merta Yasa',   'HPI-BLI-1299', false]
];

/* ================= Utilitas ================= */

function ss_()  { return SpreadsheetApp.getActiveSpreadsheet(); }

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function sheet_(nama) {
  var sh = ss_().getSheetByName(nama);
  if (!sh) throw new Error('Tab "' + nama + '" belum ada. Jalankan fungsi setup() dulu.');
  return sh;
}

function pasangHeader_(sh, header, lebar) {
  sh.getRange(1, 1, 1, header.length).setValues([header])
    .setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#0B5D3B')
    .setHorizontalAlignment('center');
  sh.setFrozenRows(1);
  for (var i = 0; i < lebar.length; i++) sh.setColumnWidth(i + 1, lebar[i]);
}

/* ================= Setup sekali jalan ================= */

function setup() {
  var ss = ss_();

  // --- Tab Guides ---
  var g = ss.getSheetByName(SHEET_GUIDES) || ss.insertSheet(SHEET_GUIDES);
  if (g.getLastRow() === 0) {
    pasangHeader_(g, HEADER_GUIDES, [110, 220, 150, 80]);
    g.getRange(2, 1, GUIDES_AWAL.length, HEADER_GUIDES.length).setValues(GUIDES_AWAL);
  }

  // --- Tab Evaluations ---
  var e = ss.getSheetByName(SHEET_EVAL) || ss.insertSheet(SHEET_EVAL);
  if (e.getLastRow() === 0) {
    pasangHeader_(e, HEADER_EVAL, [290, 190, 50, 90, 200, 80, 80, 80, 240, 190]);
  }

  // --- Tab Petunjuk ---
  var p = ss.getSheetByName(SHEET_INFO) || ss.insertSheet(SHEET_INFO);
  if (p.getLastRow() === 0) {
    var teks = [
      ['PENILAIAN GUIDE KAWASAN BESAKIH — Basis Data'],
      [''],
      ['Spreadsheet ini adalah "server" aplikasi penilaian guide di lapangan.'],
      [''],
      ['Tab Guides      : daftar guide. Tambah baris untuk guide baru.'],
      ['                  Isi kolom aktif dengan FALSE untuk menonaktifkan tanpa menghapus.'],
      ['Tab Evaluations : hasil penilaian dari lapangan — DIISI OTOMATIS oleh aplikasi.'],
      ['                  Jangan mengubah atau menghapus baris di tab ini.'],
      [''],
      ['CATATAN PENTING'],
      ['- Jangan menulis URL /exec di repositori GitHub yang bersifat publik.'],
      ['- Kalau script diubah: Deploy → Manage deployments → Edit → New version,'],
      ['  supaya URL tidak berubah dan perangkat staff tidak perlu diatur ulang.'],
      ['- Aplikasi hanya menambah baris (append-only), jadi data lama aman.']
    ];
    p.getRange(1, 1, teks.length, 1).setValues(teks);
    p.setColumnWidth(1, 700);
    p.getRange('A1').setFontWeight('bold').setFontSize(13).setFontColor('#0B5D3B');
    p.getRange('A10').setFontWeight('bold');
  }

  // Buang tab bawaan "Sheet1" / "Sheet 1" kalau masih kosong
  ['Sheet1', 'Sheet 1', 'Sheet'].forEach(function (nama) {
    var s = ss.getSheetByName(nama);
    if (s && ss.getSheets().length > 1 && s.getLastRow() === 0) ss.deleteSheet(s);
  });

  return 'Setup selesai. Lanjut ke Deploy → New deployment → Web app.';
}

/* ================= GET ================= */
/**
 * ?action=guides  → daftar guide aktif (dipakai dropdown aplikasi)
 * ?action=health  → cek server hidup (tombol "Tes Koneksi Server")
 *
 * Sengaja TIDAK ada endpoint untuk membaca daftar penilaian: web app ini
 * dideploy sebagai "Anyone", jadi endpoint semacam itu akan membuat seluruh
 * data penilaian bisa diunduh siapa saja. Rekap dilihat dari spreadsheet ini.
 */
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'health';

  if (action === 'guides') {
    var rows = sheet_(SHEET_GUIDES).getDataRange().getValues().slice(1);
    var guides = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (!r[0]) continue;
      if (String(r[3]).toUpperCase() === 'FALSE') continue;
      guides.push({
        guideId:   String(r[0]).trim(),
        guideName: String(r[1]).trim(),
        lisensi:   String(r[2] || '').trim(),
        aktif:     true
      });
    }
    return json_({ guides: guides });
  }

  var last = sheet_(SHEET_EVAL).getLastRow();
  return json_({
    ok: true,
    storage: 'google-sheets',
    total: Math.max(0, last - 1),
    serverTime: new Date().toISOString()
  });
}

/* ================= POST ================= */
/**
 * Menerima satu penilaian, atau batch { evaluations: [...] }.
 * Bersifat append-only dan idempoten: mengirim ulang evaluationId yang sama
 * tidak menggandakan baris, sehingga retry dari aplikasi selalu aman.
 *
 * Aplikasi mengirim body dengan Content-Type text/plain agar tidak memicu
 * preflight CORS — Apps Script tidak bisa menjawab permintaan OPTIONS.
 */
function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ accepted: [], rejected: [{ evaluationId: null, errors: ['JSON tidak valid'] }] });
  }

  var items = (body && Object.prototype.toString.call(body.evaluations) === '[object Array]')
    ? body.evaluations : [body];

  var accepted = [], rejected = [];

  // Kunci: mencegah dua pos menulis ke baris yang sama secara bersamaan.
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    // Tidak dapat kunci → beri tahu aplikasi agar mencoba lagi nanti.
    return json_({ accepted: [], rejected: [], busy: true });
  }

  try {
    var sh = sheet_(SHEET_EVAL);
    var last = sh.getLastRow();
    var idAda = {};
    if (last > 1) {
      var kol = sh.getRange(2, 1, last - 1, 1).getValues();
      for (var i = 0; i < kol.length; i++) idAda[String(kol[i][0])] = true;
    }

    var baris = [];
    for (var j = 0; j < items.length; j++) {
      var it = items[j];
      var errs = validasi_(it);
      if (errs.length) {
        rejected.push({ evaluationId: (it && it.evaluationId) || null, errors: errs });
        continue;
      }
      if (idAda[String(it.evaluationId)]) {
        accepted.push({ evaluationId: it.evaluationId, synced: true, duplicate: true });
        continue;
      }
      baris.push([
        String(it.evaluationId),
        String(it.timestamp),
        Number(it.pos),
        String(it.guideId),
        String(it.guideName),
        !!it.criteria.idCard,
        !!it.criteria.uniform,
        !!it.criteria.etika,
        String(it.catatan || ''),
        new Date().toISOString()
      ]);
      idAda[String(it.evaluationId)] = true;
      accepted.push({ evaluationId: it.evaluationId, synced: true, duplicate: false });
    }

    if (baris.length) {
      sh.getRange(sh.getLastRow() + 1, 1, baris.length, HEADER_EVAL.length).setValues(baris);
      SpreadsheetApp.flush();
    }
  } catch (err) {
    // Gagal menulis → jangan balas "accepted", supaya aplikasi menahan data
    // di antrean dan mencobanya lagi.
    return json_({ accepted: [], rejected: [], error: String(err) });
  } finally {
    lock.releaseLock();
  }

  return json_({ accepted: accepted, rejected: rejected, total: sheet_(SHEET_EVAL).getLastRow() - 1 });
}

/* ================= Validasi ================= */

function validasi_(it) {
  var errs = [];
  if (!it || typeof it !== 'object') return ['body bukan objek'];
  if (!it.evaluationId) errs.push('evaluationId wajib');
  if (!it.guideId)      errs.push('guideId wajib');
  if (!it.guideName)    errs.push('guideName wajib');
  if ([1, 2, 3].indexOf(Number(it.pos)) === -1) errs.push('pos harus 1, 2, atau 3');
  if (!it.timestamp || isNaN(Date.parse(it.timestamp))) errs.push('timestamp harus ISO8601');
  if (!it.criteria || typeof it.criteria !== 'object') {
    errs.push('criteria wajib');
  } else {
    ['idCard', 'uniform', 'etika'].forEach(function (k) {
      if (typeof it.criteria[k] !== 'boolean') errs.push('criteria.' + k + ' harus boolean');
    });
  }
  return errs;
}

/* ================= Uji mandiri (opsional) ================= */
/**
 * Jalankan fungsi ini dari editor Apps Script untuk memastikan tulis-baca
 * berfungsi tanpa perlu membuka aplikasi. Baris ujinya dihapus lagi di akhir.
 */
function ujiCepat() {
  var id = 'TEST-' + new Date().getTime();
  var res = JSON.parse(doPost({ postData: { contents: JSON.stringify({
    evaluationId: id,
    guideId: 'G-001',
    guideName: 'I Wayan Suparta',
    pos: 1,
    timestamp: new Date().toISOString(),
    criteria: { idCard: true, uniform: false, etika: true },
    catatan: 'baris uji otomatis'
  }) } }).getContent());

  var ulang = JSON.parse(doPost({ postData: { contents: JSON.stringify({
    evaluationId: id, guideId: 'G-001', guideName: 'I Wayan Suparta', pos: 1,
    timestamp: new Date().toISOString(),
    criteria: { idCard: true, uniform: false, etika: true }
  }) } }).getContent());

  var salah = JSON.parse(doPost({ postData: { contents: JSON.stringify({
    guideId: 'G-002', pos: 9, criteria: { idCard: 'ya' }
  }) } }).getContent());

  var guides = JSON.parse(doGet({ parameter: { action: 'guides' } }).getContent());

  // bersihkan baris uji
  var sh = sheet_(SHEET_EVAL);
  var kol = sh.getRange(2, 1, Math.max(1, sh.getLastRow() - 1), 1).getValues();
  for (var i = kol.length - 1; i >= 0; i--) {
    if (String(kol[i][0]) === id) sh.deleteRow(i + 2);
  }

  var hasil = [
    'tulis pertama  : ' + (res.accepted.length === 1 && !res.accepted[0].duplicate ? 'OK' : 'GAGAL'),
    'kirim ulang    : ' + (ulang.accepted.length === 1 && ulang.accepted[0].duplicate ? 'OK (tidak ganda)' : 'GAGAL'),
    'data tidak sah : ' + (salah.rejected.length === 1 && salah.accepted.length === 0 ? 'OK (ditolak)' : 'GAGAL'),
    'daftar guide   : ' + guides.guides.length + ' guide aktif',
    'baris uji sudah dihapus kembali.'
  ].join('\n');

  Logger.log(hasil);
  return hasil;
}
