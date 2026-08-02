# Rencana: Google Spreadsheet sebagai Backend

Dokumen rancangan — **belum diterapkan ke kode**. Baca dulu, terutama bagian
[Batasan & risiko](#5-batasan--risiko-baca-ini-dulu).

---

## 1. Cara kerjanya

Google Spreadsheet tidak bisa menerima permintaan HTTP secara langsung. Perantaranya
adalah **Google Apps Script Web App** — sebuah script yang menempel pada spreadsheet
dan di-*deploy* menjadi satu URL publik:

```
https://script.google.com/macros/s/AKfycb.../exec
```

Alur datanya:

```
HP staff (PWA)  ──POST──►  Apps Script Web App  ──►  Spreadsheet (tab Evaluations)
                ◄──GET───  (daftar guide)       ◄──  Spreadsheet (tab Guides)
```

Aplikasi PWA-nya sendiri tetap di GitHub Pages. Yang berganti hanya "servernya":
dari Node.js/Render menjadi Apps Script.

---

## 2. Struktur spreadsheet

Satu spreadsheet, dua tab.

### Tab `Guides` — master data guide (kamu yang isi & rawat)

| A `guideId` | B `guideName` | C `lisensi` | D `aktif` |
|---|---|---|---|
| G-001 | I Wayan Suparta | HPI-BLI-1021 | TRUE |
| G-002 | Ni Made Ariani | HPI-BLI-1044 | TRUE |
| G-015 | I Ketut Merta Yasa | HPI-BLI-1299 | FALSE |

Baris 1 = header. Guide dengan `aktif = FALSE` tidak muncul di dropdown aplikasi.
Menambah guide baru cukup menambah baris — tidak perlu sentuh kode.

### Tab `Evaluations` — hasil penilaian (diisi otomatis oleh aplikasi)

| A `evaluationId` | B `timestamp` | C `pos` | D `guideId` | E `guideName` | F `idCard` | G `uniform` | H `etika` | I `catatan` | J `receivedAt` |
|---|---|---|---|---|---|---|---|---|---|

Bersifat *append-only* — aplikasi hanya menambah baris, tidak pernah mengubah atau
menghapus. Kolom A dipakai untuk mencegah data ganda.

Dari sini kamu bisa langsung bikin PivotTable (mis. persentase kepatuhan per pos per
bulan) atau grafik, tanpa export apa pun.

---

## 3. Kode Apps Script

Ditempel di **Extensions → Apps Script** pada spreadsheet tersebut.

```javascript
/**
 * Backend Penilaian Guide Kawasan Besakih — Google Apps Script Web App.
 * Deploy: Deploy → New deployment → Web app
 *         Execute as: Me | Who has access: Anyone
 */

const SHEET_EVAL   = 'Evaluations';
const SHEET_GUIDES = 'Guides';

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function sheet_(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

/* ------------------------- GET ------------------------- */
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'health';

  if (action === 'guides') {
    const rows = sheet_(SHEET_GUIDES).getDataRange().getValues().slice(1);
    const guides = rows
      .filter(r => r[0] && String(r[3]).toUpperCase() !== 'FALSE')
      .map(r => ({
        guideId:   String(r[0]).trim(),
        guideName: String(r[1]).trim(),
        lisensi:   String(r[2] || '').trim(),
        aktif:     true,
      }));
    return json_({ guides: guides });
  }

  // health — dipakai tombol "Tes Koneksi Server" di aplikasi
  const last = sheet_(SHEET_EVAL).getLastRow();
  return json_({
    ok: true,
    storage: 'google-sheets',
    total: Math.max(0, last - 1),
    serverTime: new Date().toISOString(),
  });
}

/* ------------------------- POST ------------------------- */
function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ accepted: [], rejected: [{ errors: ['JSON tidak valid'] }] });
  }

  const items = Array.isArray(body.evaluations) ? body.evaluations : [body];
  const accepted = [], rejected = [];

  // Kunci: mencegah dua pos menulis baris yang sama bersamaan.
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    // Gagal dapat kunci → balas seolah server sibuk agar aplikasi mencoba lagi.
    return json_({ accepted: [], rejected: [], busy: true });
  }

  try {
    const sh = sheet_(SHEET_EVAL);
    const last = sh.getLastRow();
    const existing = last > 1
      ? sh.getRange(2, 1, last - 1, 1).getValues().flat().map(String)
      : [];

    const baris = [];
    items.forEach(function (it) {
      const errs = validasi_(it);
      if (errs.length) { rejected.push({ evaluationId: it && it.evaluationId, errors: errs }); return; }

      if (existing.indexOf(String(it.evaluationId)) !== -1) {
        accepted.push({ evaluationId: it.evaluationId, synced: true, duplicate: true });
        return;
      }

      baris.push([
        it.evaluationId, it.timestamp, Number(it.pos), it.guideId, it.guideName,
        !!it.criteria.idCard, !!it.criteria.uniform, !!it.criteria.etika,
        it.catatan || '', new Date().toISOString(),
      ]);
      existing.push(String(it.evaluationId));
      accepted.push({ evaluationId: it.evaluationId, synced: true, duplicate: false });
    });

    if (baris.length) {
      sh.getRange(sh.getLastRow() + 1, 1, baris.length, baris[0].length).setValues(baris);
      SpreadsheetApp.flush();
    }
  } finally {
    lock.releaseLock();
  }

  return json_({ accepted: accepted, rejected: rejected });
}

function validasi_(it) {
  const errs = [];
  if (!it || typeof it !== 'object') return ['body bukan objek'];
  if (!it.evaluationId) errs.push('evaluationId wajib');
  if (!it.guideId)      errs.push('guideId wajib');
  if (!it.guideName)    errs.push('guideName wajib');
  if ([1, 2, 3].indexOf(Number(it.pos)) === -1) errs.push('pos harus 1, 2, atau 3');
  if (!it.timestamp || isNaN(Date.parse(it.timestamp))) errs.push('timestamp harus ISO8601');
  if (!it.criteria || typeof it.criteria !== 'object') errs.push('criteria wajib');
  else ['idCard', 'uniform', 'etika'].forEach(function (k) {
    if (typeof it.criteria[k] !== 'boolean') errs.push('criteria.' + k + ' harus boolean');
  });
  return errs;
}
```

Perhatikan: `doPost` **tidak** membaca `Content-Type`. Itu sebabnya trik `text/plain`
di bagian berikutnya bisa bekerja.

---

## 4. Perubahan yang dibutuhkan di aplikasi

Tiga hal, semuanya di `public/`.

### 4.1 Deteksi jenis server (`sync.js`)

Apps Script hanya punya **satu URL**, tanpa path `/api/...`. Jadi aplikasi perlu tahu
sedang bicara dengan siapa:

| Endpoint sekarang (Node.js) | Menjadi (Apps Script) |
|---|---|
| `GET /api/health` | `GET .../exec?action=health` |
| `GET /api/guides` | `GET .../exec?action=guides` |
| `POST /api/evaluations` | `POST .../exec` |

Deteksi otomatis dari URL: kalau mengandung `script.google.com` → mode Apps Script.
Tidak ada yang perlu dipilih staff.

### 4.2 Content-Type `text/plain` saat POST (`sync.js`)

Apps Script tidak menangani permintaan *preflight* `OPTIONS`. Kalau POST dikirim
sebagai `application/json`, browser mengirim preflight dulu, Apps Script tidak
menjawabnya, dan permintaan diblokir CORS.

Solusinya: kirim sebagai `text/plain;charset=utf-8`. Ini membuat permintaan
tergolong *simple request* sehingga preflight dilewati. Isi body tetap JSON —
`doPost` membacanya lewat `e.postData.contents` apa pun content-type-nya.

### 4.3 Verifikasi respons sebelum menandai "terkirim" (`sync.js`) — **penting**

Saat ini aplikasi menandai data terkirim (✅) hanya berdasarkan status HTTP 200.
Apps Script bisa membalas 200 walaupun penulisan ke sheet gagal, dan aplikasi akan
mengira data sudah aman padahal hilang.

Perbaikannya: baru tandai ✅ kalau badan respons benar-benar memuat `evaluationId`
yang dikirim di dalam `accepted`. Perbaikan ini bagus untuk kedua jenis server, jadi
akan diterapkan tanpa syarat.

Selain itu `busy: true` (gagal dapat kunci) diperlakukan sebagai kegagalan sementara
→ masuk antrean retry, bukan ditolak permanen.

### 4.4 Yang **tidak** perlu diubah

Seluruh logika offline tetap sama persis: IndexedDB, enkripsi AES-256, antrean,
exponential backoff, riwayat, export CSV, service worker. Google Sheets hanya
menggantikan tujuan akhir sinkronisasi.

---

## 5. Batasan & risiko (baca ini dulu)

### 5.1 Endpoint terbuka — dan repo kamu publik

Kamu memilih **tanpa token**. Konsekuensinya: satu-satunya "rahasia" adalah URL
`/exec` itu sendiri. Siapa pun yang memilikinya bisa menambah baris ke spreadsheet.

Masalahnya, `penilaian-guide-besakih` adalah repo **publik**. Kalau URL itu ditulis
di `public/config.js` lalu di-commit, URL-nya bisa dibaca siapa saja di internet —
endpoint jadi terbuka sepenuhnya, bukan sekadar "rahasia yang lemah".

Tiga jalan keluar, pilih salah satu:

| Opsi | Cara | Konsekuensi |
|---|---|---|
| **A. Jangan commit URL** | `config.js` dibiarkan kosong. Tiap perangkat staff mengisi alamat sekali di menu **Pengaturan**. | Repo tetap publik & aman. Perlu setup manual 1× per perangkat (3 perangkat = 3 menit). **Paling praktis.** |
| **B. Repo dijadikan privat** | Settings → General → Change visibility. | URL aman di repo, tapi **GitHub Pages gratis butuh repo publik** — situsnya akan mati kecuali berlangganan GitHub Pro. |
| **C. Pakai token** | Token dicek Apps Script. | Menghalangi iseng, tapi kalau token ikut di-commit ke repo publik, sama saja bocornya. Baru berguna kalau digabung opsi A. |

Saya sarankan **opsi A**. Kalau nanti kamu berubah pikiran soal token, opsi A + C
memberi dua lapis.

### 5.2 Membaca data juga terbuka

Dengan deploy "Anyone", `?action=guides` bisa diakses siapa saja — daftar nama guide
jadi publik. Karena itu di rancangan di atas saya **sengaja tidak membuat endpoint
untuk membaca daftar penilaian**; hasil penilaian hanya bisa dilihat dari spreadsheet
(yang tetap terlindungi izin Google Drive kamu) dan dari riwayat lokal di perangkat.

### 5.3 Lambat

Respons Apps Script biasanya **1–3 detik**, kadang lebih saat "dingin". Tidak
mengganggu staff karena penyimpanan bersifat lokal dan pengiriman berjalan di latar
belakang — tapi jangan berharap ✅ muncul seketika.

### 5.4 Kuota

- Maksimal **6 menit per eksekusi** — jauh di atas kebutuhan (satu request < 2 detik).
- Batas **90 menit/hari** berlaku untuk *trigger* terjadwal, bukan permintaan web app.
- Untuk skala 3 pos dengan ratusan penilaian per hari, kuota bukan masalah.

### 5.5 Kecepatan menurun saat data menumpuk

Pengecekan duplikat membaca seluruh kolom A setiap request. Sampai puluhan ribu baris
masih cepat. Kalau nanti melewati ~50.000 baris, arsipkan ke tab per tahun.

### 5.6 Setiap deploy ulang script menghasilkan URL baru

Kalau kamu mengubah script, gunakan **Deploy → Manage deployments → Edit → New
version** (bukan *New deployment*) supaya URL-nya tetap. Kalau URL berubah, tiap
perangkat staff harus diperbarui.

---

## 6. Langkah setup (kalau jadi dipakai)

1. Buat spreadsheet baru, beri nama mis. *Penilaian Guide Besakih*.
2. Buat tab `Guides` dan `Evaluations` dengan header persis seperti bagian 2.
   Salin isi `server/guides.json` ke tab `Guides`.
3. **Extensions → Apps Script**, hapus isi bawaan, tempel kode bagian 3, simpan.
4. **Deploy → New deployment → Web app**:
   - *Execute as*: **Me**
   - *Who has access*: **Anyone**
   - Setujui izin saat diminta (wajar — script menulis ke spreadsheet-mu).
5. Salin URL `/exec` yang muncul.
6. Di aplikasi (HP/tablet staff): menu **Pengaturan → Alamat Server** → tempel URL →
   **Tes Koneksi Server**. Ulangi di tiap perangkat (opsi A di bagian 5.1).

Uji cepat sebelum dipakai lapangan: buat satu penilaian → cek baris baru muncul di
tab `Evaluations` → matikan Wi-Fi → buat penilaian lagi → hidupkan Wi-Fi → pastikan
statusnya berubah dari ⏳ menjadi ✅ dan barisnya masuk.

---

## 7. Perbandingan singkat

| | Google Sheets | Render (free) | Node.js sendiri |
|---|---|---|---|
| Biaya | Gratis | Gratis | Biaya server |
| Data persisten | ✅ | ❌ hilang saat restart | ✅ |
| Kecepatan | 1–3 detik | ~0,3 detik (setelah bangun) | Cepat |
| Laporan | ✅ langsung di spreadsheet | Perlu export | Perlu export |
| Keamanan | Lemah tanpa token | Sedang | Sesuai konfigurasi |
| Perawatan | Hampir nol | Rendah | Perlu perhatian |

Untuk 3 pos pemeriksaan dengan data kepatuhan yang tidak sensitif, Google Sheets
adalah pilihan paling masuk akal — asalkan URL-nya tidak ikut ter-commit ke repo publik.
