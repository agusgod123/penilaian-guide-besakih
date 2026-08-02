# Aplikasi Penilaian Guide Kawasan Besakih

PWA **offline-first** untuk staff lapangan menilai guide pada tiga pos pemeriksaan
(**ID-Card**, **Uniform**, **Etika**). Tanpa login, data tersimpan di perangkat, dan
terkirim otomatis ke server begitu ada koneksi.

Dibangun sesuai `PRD_Guide_Evaluation_App.md`.

---

## Menjalankan

```bash
node server/server.js
```

Buka `http://localhost:3000`. Server juga mencetak alamat jaringan lokal
(mis. `http://192.168.1.10:3000`) — pakai alamat itu di tablet/HP staff yang
terhubung Wi-Fi yang sama.

Tidak ada dependensi produksi. Cukup Node.js ≥ 18.

### Install sebagai aplikasi (PWA)

- **Android / Chrome** — menu ⋮ → *Add to Home screen* / *Install app*
- **iOS / Safari** — tombol Share → *Add to Home Screen*

Setelah ter-install, aplikasi berjalan penuh tanpa jaringan.

> **Catatan produksi:** service worker dan Web Crypto hanya aktif pada `localhost`
> atau **HTTPS**. Untuk penggunaan di lapangan lewat alamat IP, pasang sertifikat
> (mis. reverse proxy Caddy/nginx) agar PWA dapat di-install.

---

## Deploy

### 1. PWA → GitHub Pages (gratis, HTTPS)

Repo sudah berisi `.github/workflows/deploy-pages.yml`. Cukup aktifkan sekali:

**Settings → Pages → Source: GitHub Actions**

Setiap push ke `main` yang menyentuh `public/` akan otomatis mem-publish situs ke
`https://<username>.github.io/penilaian-guide-besakih/`. Dari alamat itu aplikasi
sudah bisa di-install sebagai PWA di HP staff (HTTPS aktif).

### 2a. Backend → Google Spreadsheet (gratis, **disarankan**)

Spreadsheet jadi database, Apps Script jadi endpoint REST-nya. Data persisten,
dan rekapnya langsung bisa di-PivotTable untuk laporan.

1. Buat spreadsheet baru → **Extensions → Apps Script**
2. Tempel isi `server-gas/Code.gs`, simpan
3. Jalankan fungsi `setup` → tab `Guides`, `Evaluations`, `Petunjuk` dibuat otomatis
   beserta data guide awal
4. **Deploy → New deployment → Web app** — *Execute as*: **Me**, *Who has access*: **Anyone**
5. Salin URL `/exec`, isikan di aplikasi lewat **Pengaturan → Alamat Server**

Aplikasi mendeteksi jenis backend dari URL secara otomatis: `script.google.com`
→ mode Apps Script (query parameter + `Content-Type: text/plain` agar lolos CORS),
selain itu → mode REST biasa.

> **Jangan commit URL `/exec` ke repo publik.** Web app di-deploy sebagai "Anyone",
> jadi URL itulah satu-satunya pembatas. Biarkan `config.js` kosong dan isikan
> alamatnya per perangkat lewat menu Pengaturan.

Detail lengkap, termasuk batasan dan alternatifnya: [`docs/RENCANA-BACKEND-GOOGLE-SHEETS.md`](docs/RENCANA-BACKEND-GOOGLE-SHEETS.md).

### 2b. Backend → Render (gratis)

Repo berisi `render.yaml`. Di [render.com](https://render.com): **New → Blueprint →
pilih repo ini**. Render membaca blueprint dan menjalankan `node server/server.js`.

Setelah backend hidup, isi alamatnya di `public/config.js`:

```js
window.APP_CONFIG = { serverUrl: 'https://penilaian-guide-besakih-api.onrender.com' };
```

Commit ulang → Pages otomatis ter-deploy dengan alamat server tersebut. Staff juga
bisa menimpanya kapan saja lewat menu **Pengaturan** tanpa mengubah kode.

> **Batasan paket Free Render — penting:**
> disk bersifat sementara, jadi data di server hilang setiap kali service restart
> atau di-deploy ulang. Service juga "tidur" setelah ~15 menit tanpa trafik
> (permintaan pertama lambat ~30 detik; aplikasi menanganinya dengan retry otomatis,
> tidak ada data yang hilang di sisi perangkat). Untuk produksi, tambahkan Persistent
> Disk berbayar dengan mount ke `server/data`, atau ganti `storage.js` ke database
> eksternal.

### Selama backend belum ada

Aplikasi tetap berfungsi 100%: penilaian tersimpan dan terenkripsi di perangkat,
menunggu di antrean, dan layar **Pengaturan** menampilkan peringatan bahwa alamat
server belum diisi. Begitu alamat diisi, seluruh antrean terkirim otomatis.

---

## Struktur

```
app/
├─ server/
│  ├─ server.js        REST API + static server (zero dependency)
│  ├─ storage.js       SQLite (node:sqlite) dengan fallback file JSON
│  ├─ guides.json      Master data guide
│  └─ data/            Database (dibuat otomatis, tidak di-commit)
├─ public/             Yang di-install ke perangkat — 92 KB total
│  ├─ index.html       Semua layar (SPA)
│  ├─ config.js        Alamat backend (untuk deploy statis)
│  ├─ css/styles.css   Desain large-tap, kontras tinggi
│  ├─ js/db.js         IndexedDB + enkripsi AES-256-GCM + backup
│  ├─ js/sync.js       Antrean sync, deteksi jaringan, exponential backoff
│  ├─ js/app.js        Kontroler UI
│  ├─ sw.js            Service worker (cache-first app shell)
│  ├─ manifest.webmanifest
│  └─ icons/
├─ server-gas/
│  ├─ Code.gs          Backend Google Apps Script (spreadsheet sebagai database)
│  └─ test-gas.mjs     20 pemeriksaan logika Code.gs di luar Google
├─ test/
│  ├─ app.test.mjs     48 pemeriksaan otomatis (jsdom + fake-indexeddb)
│  └─ e2e.mjs          Uji browser sungguhan (opsional, butuh Puppeteer)
├─ render.yaml         Blueprint deploy backend ke Render
└─ .github/workflows/  Deploy otomatis PWA ke GitHub Pages
```

---

## API

| Method | Endpoint | Keterangan |
|--------|----------|------------|
| `GET`  | `/api/health` | Cek server hidup + jumlah data |
| `GET`  | `/api/guides` | Daftar guide aktif (di-cache aplikasi) |
| `POST` | `/api/evaluations` | Kirim 1 penilaian, atau batch `{ "evaluations": [...] }` |
| `GET`  | `/api/evaluations` | Rekap data di server |
| `GET`  | `/api/evaluations.csv` | Unduh rekap CSV |

**Body `POST /api/evaluations`** (sesuai PRD §7):

```json
{
  "evaluationId": "uuid",
  "guideId": "G-001",
  "guideName": "I Wayan Suparta",
  "pos": 1,
  "timestamp": "2026-08-02T08:00:00.000Z",
  "criteria": { "idCard": true, "uniform": false, "etika": true },
  "catatan": "opsional"
}
```

Bersifat **append-only dan idempoten** — mengirim ulang `evaluationId` yang sama
tidak menggandakan data, sehingga retry selalu aman.

---

## Cara kerja offline → online

1. Penilaian disimpan ke IndexedDB dengan `syncState = 0` (⏳).
2. Sync dipicu oleh: event `online`, aplikasi kembali dibuka, timer 1 menit,
   atau tombol **Kirim Sekarang** / **Force Sync**.
3. Entri dikirim satu per satu; sukses → `syncState = 1` (✅).
4. Gagal (timeout / 5xx) → retry dengan **exponential backoff** 2s → 4s → 8s …
   maksimal 5 menit. Data ditolak permanen (400) ditandai dan tidak diulang selamanya.
5. Backup seluruh data ke `localStorage` tiap 5 menit; bila IndexedDB kosong saat
   dibuka (indikasi korupsi), data dipulihkan otomatis.

---

## Keamanan

Data lokal dienkripsi **AES-256-GCM** lewat Web Crypto API. Kunci dibuat per
perangkat dan disimpan di `localStorage`. Ini "enkripsi ringan" sesuai PRD §5 —
mencegah pengubahan/pembacaan iseng melalui DevTools, **bukan** perlindungan
terhadap penyerang yang menguasai perangkat sepenuhnya.

---

## Pengujian

```bash
npm install          # jsdom + fake-indexeddb (devDependencies)
node server/server.js &   # server harus hidup
npm test
```

Menjalankan 48 pemeriksaan yang memuat `index.html` sungguhan beserta seluruh
skripnya, dan menguji setiap Acceptance Criteria PRD §9 termasuk simulasi putus
jaringan, antrean sync, retry, enkripsi, idempotensi server, serta adapter
Google Apps Script.

Logika backend Apps Script diuji terpisah tanpa perlu Google (memakai tiruan
`SpreadsheetApp`, `LockService`, `ContentService`):

```bash
npm run test:gas
```

Uji browser sungguhan (opsional, memerlukan Chrome via Puppeteer):

```bash
npm i puppeteer && npm run test:browser
```

---

## Status Acceptance Criteria

| Kode | Kriteria | Status |
|------|----------|--------|
| AC-1 | Buka tanpa login | ✅ |
| AC-2 | Dropdown ≥ 10 guide, dapat dipilih | ✅ 14 guide |
| AC-3 | Tiga toggle Ya/Tidak, tersimpan lokal | ✅ |
| AC-4 | Tetap responsif & ikon offline saat jaringan hilang | ✅ |
| AC-5 | Terkirim otomatis saat online, status → ✅ | ✅ |
| AC-6 | Burger menu menampilkan semua layar | ✅ 6 menu |
| AC-7 | Target sentuh ≥ 48 px, teks ≥ 16 px | ✅ tombol 56–84 px, teks 17 px |
| AC-8 | Installable sebagai PWA (manifest + service worker) | ✅ |

Non-fungsional: ukuran app shell **92 KB** (batas 5 MB), responsif untuk
hand-held & tablet, seluruh teks bahasa Indonesia.

---

## Kustomisasi

- **Daftar guide** — sunting `server/guides.json` (set `"aktif": false` untuk menonaktifkan).
- **Nama pos** — sunting `<option>` pada `#homePos` dan `#posSelect` di `index.html`.
- **Alamat server** — dapat diubah staff lewat menu **Pengaturan** tanpa mengubah kode.

Lisensi: MIT
