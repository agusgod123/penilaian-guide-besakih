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
│  ├─ css/styles.css   Desain large-tap, kontras tinggi
│  ├─ js/db.js         IndexedDB + enkripsi AES-256-GCM + backup
│  ├─ js/sync.js       Antrean sync, deteksi jaringan, exponential backoff
│  ├─ js/app.js        Kontroler UI
│  ├─ sw.js            Service worker (cache-first app shell)
│  ├─ manifest.webmanifest
│  └─ icons/
└─ test/
   ├─ app.test.mjs     34 pemeriksaan otomatis (jsdom + fake-indexeddb)
   └─ e2e.mjs          Uji browser sungguhan (opsional, butuh Puppeteer)
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

Menjalankan 34 pemeriksaan yang memuat `index.html` sungguhan beserta seluruh
skripnya, dan menguji setiap Acceptance Criteria PRD §9 termasuk simulasi putus
jaringan, antrean sync, retry, enkripsi, dan idempotensi server.

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
