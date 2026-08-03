# Alur Aplikasi Penilaian Guide Kawasan Besakih

Dokumen teknis: seluruh alur kerja aplikasi, dari staff menekan tombol di
lapangan sampai angka muncul di tab rekap spreadsheet.

Untuk panduan pemakaian sehari-hari (bahasa sederhana), lihat
[`PANDUAN-PEMAKAIAN.md`](PANDUAN-PEMAKAIAN.md).

> Diagram di bawah memakai Mermaid — tampil otomatis di GitHub, GitLab, VS Code
> (ekstensi *Markdown Preview Mermaid*), dan Obsidian.

---

## Daftar isi

1. [Peta besar sistem](#1-peta-besar-sistem)
2. [Alur staff memakai aplikasi](#2-alur-staff-memakai-aplikasi)
3. [Apa yang terjadi saat tombol SIMPAN ditekan](#3-apa-yang-terjadi-saat-tombol-simpan-ditekan)
4. [Daur hidup satu penilaian](#4-daur-hidup-satu-penilaian)
5. [Alur sinkronisasi ke server](#5-alur-sinkronisasi-ke-server)
6. [Penentuan alamat & jenis server](#6-penentuan-alamat--jenis-server)
7. [Alur di sisi server (Apps Script)](#7-alur-di-sisi-server-apps-script)
8. [Alur penyusunan rekap bulanan](#8-alur-penyusunan-rekap-bulanan)
9. [Tiga jalur melihat data](#9-tiga-jalur-melihat-data)
10. [Penyimpanan di perangkat](#10-penyimpanan-di-perangkat)
11. [Alur service worker & pembaruan aplikasi](#11-alur-service-worker--pembaruan-aplikasi)
12. [Jadwal waktu ringkas](#12-jadwal-waktu-ringkas)
13. [Peta berkas](#13-peta-berkas)

---

## 1. Peta besar sistem

```mermaid
flowchart TD
    subgraph HP["📱 HP / Tablet Staff — di pos pemeriksaan"]
        UI["Aplikasi PWA<br/>index.html + app.js"]
        DB[("IndexedDB<br/>penilaian terenkripsi AES-256")]
        LS[("localStorage<br/>pengaturan, draft,<br/>cache guide, cadangan")]
        SW["Service Worker<br/>sw.js — bikin jalan tanpa sinyal"]
        UI --> DB
        UI --> LS
        SW -.->|melayani| UI
    end

    subgraph NET["🌐 Internet"]
        SYNC["sync.js<br/>antrean + kirim ulang otomatis"]
    end

    subgraph GAS["☁️ Google Apps Script — Code.gs"]
        POST["doPost<br/>terima penilaian"]
        GET["doGet<br/>daftar guide + cek server"]
        TRIG["Trigger tiap 5 menit<br/>rekapOtomatis"]
        NIGHT["Trigger tiap malam 23.00<br/>rekapHarian"]
    end

    subgraph SS["📊 Spreadsheet — Penilaian Guide Besakih"]
        TG[["Tab Guides<br/>296 nama guide"]]
        TE[["Tab Evaluations<br/>data mentah, append-only"]]
        TR[["Tab Rekap A1 / A2 / D1 / D2<br/>format NILAI REWARD"]]
        TP[["Tab Rekap per Pos"]]
        TI[["Tab Petunjuk"]]
    end

    UI --> SYNC
    SYNC -->|"POST penilaian"| POST
    SYNC -->|"GET daftar guide"| GET
    POST --> TE
    GET --> TG
    POST -.->|"menitipkan: bulan ini berubah"| TRIG
    TRIG --> TE
    NIGHT --> TE
    TRIG --> TR
    TRIG --> TP
    NIGHT --> TR
    NIGHT --> TP

    STAFF(["👤 Staff lapangan"]) --> UI
    ADMIN(["👤 Admin / kantor"]) --> TR
```

**Inti yang sering disalahpahami:** aplikasi hanya menulis ke **tab
`Evaluations`**. Tab **`Rekap ...`** disusun belakangan oleh trigger, jadi wajar
kalau rekap tertinggal beberapa menit dari data mentahnya.

---

## 2. Alur staff memakai aplikasi

```mermaid
flowchart TD
    A(["Buka aplikasi"]) --> B{"Pertama kali dipakai?"}
    B -->|Ya| C["Tutorial 4 langkah muncul"]
    B -->|Tidak| D["Layar Beranda"]
    C --> D

    D --> E["Pilih Pos Pemeriksaan<br/>Pos 1 / 2 / 3"]
    E --> F["Tekan tombol hijau<br/>PENILAIAN BARU"]

    F --> G["Saring daftar guide<br/>Kategori: Asing / Domestik<br/>Regu: 1 / 2"]
    G --> H["Ketik atau pilih nama guide"]
    H --> I{"Nama jelas menunjuk<br/>satu orang?"}
    I -->|"Tidak — mis. ketik 'Darta'<br/>cocok untuk 14 orang"| J["Ditolak.<br/>Aplikasi menawarkan nama<br/>yang mungkin dimaksud"]
    J --> H
    I -->|Ya| K["Tanda ✓ hijau muncul<br/>berisi nama, kode, regu"]

    K --> L["Isi 3 kriteria"]
    L --> L1["👔 Uniform: Ya / Tidak"]
    L --> L2["🪪 ID-Card: Ya / Tidak"]
    L --> L3["⭐ Review: tekan − atau +<br/>angka 0 sampai 20"]

    L1 --> M{"Uniform & ID-Card<br/>sudah dipilih?"}
    L2 --> M
    L3 --> M
    M -->|Belum| N["Ditolak dengan pesan"]
    N --> L
    M -->|Sudah| O["Isi Catatan — boleh kosong"]
    O --> P(["Tekan SIMPAN PENILAIAN"])

    style P fill:#0B5D3B,color:#fff
    style J fill:#FFF6E0
    style N fill:#FFF6E0
```

Catatan: **Review boleh 0** dan itu jawaban sah. Yang wajib dipilih hanya
Uniform dan ID-Card.

Selama mengisi, isian disimpan otomatis sebagai **draft** — kalau aplikasi
tertutup tidak sengaja, isian kembali seperti semula saat dibuka lagi.

---

## 3. Apa yang terjadi saat tombol SIMPAN ditekan

```mermaid
sequenceDiagram
    autonumber
    actor S as Staff
    participant A as app.js
    participant D as db.js
    participant I as IndexedDB
    participant Y as sync.js
    participant G as Apps Script
    participant E as Tab Evaluations

    S->>A: Tekan SIMPAN
    A->>A: Pastikan nama guide tidak ambigu
    A->>A: Pastikan Uniform & ID-Card terisi
    A->>A: Buat evaluationId (UUID acak)
    A->>D: save(penilaian)
    D->>D: Enkripsi AES-256-GCM
    D->>I: Simpan, syncState = 0 (menunggu)
    I-->>D: OK
    D-->>A: Tersimpan
    A-->>S: 💾 "Penilaian tersimpan" + getar
    A->>A: Hapus draft, kosongkan formulir

    alt Ada sinyal
        A->>Y: syncNow()
        Y->>G: POST penilaian (JSON)
        G->>G: Validasi + cek guideId di tab Guides
        G->>E: Tambah 1 baris
        G-->>Y: {accepted:[{evaluationId}]}
        Y->>Y: Cocokkan evaluationId di balasan
        Y->>I: syncState = 1 (terkirim)
        Y-->>S: ✅ "terkirim · rekap menyusul ±5 menit"
    else Tanpa sinyal
        A-->>S: Tetap tersimpan, status ⏳
        Note over Y: Dicoba lagi otomatis
    end
```

**Yang penting:** status ✅ baru dipasang kalau server **menyebutkan
`evaluationId` itu** dalam balasannya. Balasan "HTTP 200" saja tidak cukup —
Apps Script tetap membalas 200 walau penulisan ke spreadsheet gagal, dan tanpa
pemeriksaan ini data bisa hilang tanpa jejak.

---

## 4. Daur hidup satu penilaian

```mermaid
stateDiagram-v2
    [*] --> Draft: staff mulai mengisi
    Draft --> Menunggu: tekan SIMPAN
    note right of Draft
        Disimpan di localStorage.
        Aman walau aplikasi ditutup.
    end note

    Menunggu --> Terkirim: server konfirmasi evaluationId
    Menunggu --> Menunggu: gagal jaringan, dicoba lagi berkala
    Menunggu --> Ditolak: data tidak sah / guideId asing

    Terkirim --> Terhapus: staff menekan "Hapus Data Terkirim"

    Menunggu --> Tidak_terbaca: kunci enkripsi hilang
    Terkirim --> Tidak_terbaca: kunci enkripsi hilang
    note right of Tidak_terbaca
        Isinya masih ada di server.
        Muncul sebagai ⚠️ di Riwayat
        dan dipisah di Export Rekap.
    end note

    Ditolak --> [*]
    Terhapus --> [*]
```

| Status | Tanda di Riwayat | Artinya |
| --- | --- | --- |
| Menunggu | ⏳ | Tersimpan di perangkat, belum sampai server |
| Terkirim | ✅ | Sudah ada di tab `Evaluations` |
| Ditolak | ⏳ + pesan merah | Ada yang salah pada datanya; tidak diulang selamanya |
| Tidak terbaca | ⚠️ | Nilainya tak bisa dibuka di perangkat ini — cek spreadsheet |

---

## 5. Alur sinkronisasi ke server

```mermaid
flowchart TD
    START(["Pemicu sync"]) --> T1["Setelah tekan SIMPAN"]
    START --> T2["Berkala tiap 1 menit"]
    START --> T3["Sinyal kembali menyala"]
    START --> T4["Aplikasi dibuka kembali"]
    START --> T5["Tombol Kirim Sekarang / Force Sync"]

    T1 --> Q{"Sedang berjalan?"}
    T2 --> Q
    T3 --> Q
    T4 --> Q
    T5 --> Q
    Q -->|Ya| STOP1(["Berhenti — jangan tumpang tindih"])
    Q -->|Tidak| ON{"Ada sinyal?<br/>Mode Offline Paksa mati?"}

    ON -->|Tidak| STOP2(["Berhenti, tunggu sinyal"])
    ON -->|Ya| LIST["Ambil semua entri ⏳"]
    LIST --> EMPTY{"Antrean kosong?"}
    EMPTY -->|Ya| STOP3(["Selesai — semua sudah terkirim"])
    EMPTY -->|Tidak| SEND["Kirim satu per satu"]

    SEND --> RES{"Balasan server"}
    RES -->|"HTTP 5xx / 429 / busy"| RETRY["Tandai gagal sementara<br/>HENTIKAN antrean"]
    RES -->|"HTTP 400 / ditolak"| FAIL["Tandai gagal permanen<br/>lanjut ke entri berikutnya"]
    RES -->|"200 tapi tanpa konfirmasi"| RETRY
    RES -->|"200 + evaluationId cocok"| OK["Tandai ✅ terkirim"]

    OK --> SEND
    FAIL --> SEND
    RETRY --> BACK["Jadwalkan ulang<br/>2s, 4s, 8s, 16s, 32s, 64s<br/>maksimal 5 menit"]
    BACK -.-> START

    style OK fill:#E7F3EC
    style RETRY fill:#FFF6E0
    style FAIL fill:#FDECEA
```

Antrean **dihentikan pada kegagalan jaringan pertama** — kalau jaringannya
memang sedang putus, mencoba 50 entri sisanya hanya membuang baterai. Kiriman
bersifat *idempotent*: mengirim ulang `evaluationId` yang sama tidak
menggandakan baris di spreadsheet.

---

## 6. Penentuan alamat & jenis server

```mermaid
flowchart TD
    A(["Aplikasi butuh alamat server"]) --> B{"Pengaturan → Alamat Server<br/>diisi staff?"}
    B -->|Ya| C["Pakai alamat itu"]
    B -->|Tidak| D{"config.js punya serverUrl?"}
    D -->|Ya| E["Pakai alamat bawaan aplikasi<br/>— ini yang normal"]
    D -->|Tidak| F["Pakai alamat tempat<br/>aplikasi dibuka"]

    C --> G{"Alamatnya mengandung<br/>script.google.com?"}
    E --> G
    F --> G

    G -->|Ya| H["Mode Apps Script"]
    G -->|Tidak| I["Mode REST biasa"]

    H --> H1["Kirim penilaian: POST ke .../exec"]
    H --> H2["Ambil guide: .../exec?action=guides"]
    H --> H3["Cek server: .../exec?action=health"]
    H --> H4["Content-Type: text/plain<br/>agar lolos CORS"]

    I --> I1["Kirim penilaian: POST /api/evaluations"]
    I --> I2["Ambil guide: GET /api/guides"]
    I --> I3["Cek server: GET /api/health"]
    I --> I4["Content-Type: application/json"]

    style E fill:#E7F3EC
```

Apps Script tidak bisa menjawab permintaan `OPTIONS`, sehingga
`application/json` akan diblokir CORS. Memakai `text/plain` membuat permintaan
tergolong *simple request* — isi badannya tetap JSON.

---

## 7. Alur di sisi server (Apps Script)

```mermaid
flowchart TD
    A(["POST masuk ke .../exec"]) --> B{"Badan permintaan JSON sah?"}
    B -->|Tidak| R1(["Balas: ditolak"])
    B -->|Ya| C{"Jumlah entri ≤ 200?"}
    C -->|Tidak| R2(["Balas: ditolak, terlalu banyak"])
    C -->|Ya| D["Ambil kunci penulisan<br/>LockService, tunggu maks 20 detik"]
    D --> E{"Dapat kunci?"}
    E -->|Tidak| R3(["Balas: busy<br/>aplikasi akan mencoba lagi"])
    E -->|Ya| F["Baca daftar evaluationId<br/>yang sudah ada"]
    F --> G["Baca peta guideId → nama resmi<br/>dari tab Guides"]

    G --> H{"Untuk tiap entri:<br/>data lengkap & sah?"}
    H -->|Tidak| I["Masuk daftar ditolak<br/>beserta alasannya"]
    H -->|Ya| J{"guideId terdaftar<br/>di tab Guides?"}
    J -->|Tidak| I
    J -->|Ya| K{"evaluationId sudah ada?"}
    K -->|Ya| L["Balas: sudah tersimpan<br/>tidak digandakan"]
    K -->|Tidak| M["Siapkan baris:<br/>nama dipakai dari tab Guides,<br/>review dibatasi 0–20,<br/>catatan dipangkas 500 huruf"]

    M --> N["Tambahkan semua baris sekaligus<br/>ke tab Evaluations"]
    N --> O["Titipkan: bulan ini perlu<br/>disusun ulang rekapnya"]
    O --> P["Lepas kunci"]
    P --> Q(["Balas: accepted + rejected"])
    I --> P
    L --> P

    style Q fill:#E7F3EC
    style R3 fill:#FFF6E0
```

Rekap **tidak** dibangun di sini. Menyusun empat tab regu memakan belasan
detik, sedangkan aplikasi di lapangan menunggu balasan dan akan menganggap
penilaian gagal bila terlalu lama.

---

## 8. Alur penyusunan rekap bulanan

```mermaid
flowchart TD
    A(["Trigger tiap 5 menit<br/>rekapOtomatis"]) --> B{"Ada titipan<br/>bulan yang berubah?"}
    B -->|Tidak| Z(["Berhenti — tidak ada kerja"])
    B -->|Ya| C["Hapus titipan lebih dulu<br/>agar penilaian yang masuk saat ini<br/>tercatat untuk putaran berikutnya"]
    C --> D["bangunRekap(bulan)"]

    D --> E{"Dapat kunci?"}
    E -->|Tidak| Y["Titipkan ulang bulan itu<br/>— jangan sampai hilang"]
    Y --> Z
    E -->|Ya| F["Baca tab Guides → daftar anggota tiap regu"]
    F --> G["Baca tab Evaluations → saring bulan itu saja"]

    G --> GA["Gabungkan dulu per<br/>guide + POS + tanggal<br/>(dasar rincian per pos)"]
    GA --> H["Gabungkan lagi lintas pos,<br/>per guide per tanggal"]
    GA --> GB["Kehadiran harian = 0 atau 1<br/><b>satu hari bernilai satu</b>"]
    H --> H1["UNI FORM: ambil yang PALING BURUK"]
    H --> H2["ID: ambil yang PALING BURUK"]
    H --> H3["REVIEW: ambil yang TERTINGGI"]

    H1 --> I["Susun 4 tab regu:<br/>Rekap A1, A2, D1, D2"]
    H2 --> I
    H3 --> I
    GB --> IK["Susun tab Rekap Kehadiran:<br/>kolom = tanggal, isi = 1 bila hadir"]
    IK --> M
    I --> J["Lepas sel gabungan sisa susunan kemarin"]
    J --> K["Tulis judul, tanggal, nama,<br/>nilai harian, dan rumus TOTAL"]
    K --> L["Bubuhkan cap 'Diperbarui: ...'<br/>di pojok kanan atas"]
    L --> M["Susun tab Rekap per Pos"]

    M --> N{"Ada penilaian bulan ini<br/>tapi TIDAK ADA nilai<br/>yang masuk rekap?"}
    N -->|Ya| O["⚠️ Beri peringatan keras —<br/>kemungkinan guideId tidak terdaftar"]
    N -->|Tidak| P(["Selesai"])
    O --> P

    style GA fill:#E7F3EC
    style GB fill:#E7F3EC
    style H1 fill:#FFF6E0
    style H2 fill:#FFF6E0
    style H3 fill:#FFF6E0
    style O fill:#FDECEA
```

**Kenapa digabung begitu?** Satu guide bisa lewat lebih dari satu pos di hari
yang sama. Kalau di Pos 1 seragamnya lengkap tapi di Pos 3 tidak, yang dicatat
adalah yang tidak lengkap — inilah cara penilaian yang dipakai tim selama ini.
Sebaliknya REVIEW diambil yang tertinggi supaya review yang tercatat di salah
satu pos tidak terhapus.

**Kenapa digabung dua tingkat?** Penggabungan pertama — per guide **per pos**
per tanggal — menghasilkan kolom `Pn Diperiksa` yang menghitung **hari**, bukan
jumlah penilaian. Penggabungan kedua, lintas pos, menghasilkan nilai harian
untuk tab regu sekaligus angka kehadiran.

**Kehadiran bernilai 0 atau 1.** Guide yang melewati tiga pos pada hari yang
sama tetap dihitung hadir satu kali — jalur jalannya saja yang berbeda, bukan
kepatuhannya. Pos mana saja yang memeriksanya tetap terlihat di tab
`Rekap per Pos`.

---

## 9. Tiga jalur melihat data

```mermaid
flowchart LR
    subgraph J1["1️⃣ Di aplikasi — cepat, per perangkat"]
        A1["Menu → Riwayat"] --> A2["Daftar penilaian<br/>dari perangkat ini saja"]
        A2 --> A3["Saring: Semua / ⏳ Tertunda / ✅ Terkirim"]
    end

    subgraph J2["2️⃣ Export Rekap CSV — untuk cross-check"]
        B1["Riwayat → Export Rekap CSV"] --> B2["Berkas .csv dibuka di Excel"]
        B2 --> B3["Rekap harian per guide"]
        B2 --> B4["Rekap per pos"]
        B2 --> B5["Rekap per tanggal"]
        B2 --> B6["Rincian + evaluationId"]
    end

    subgraph J3["3️⃣ Spreadsheet — sumber resmi, semua perangkat"]
        C1["Tab Evaluations<br/>data mentah"] --> C2["Tab Rekap A1/A2/D1/D2<br/>format NILAI REWARD"]
        C1 --> C3["Tab Rekap per Pos"]
    end

    B3 -.->|"angkanya HARUS sama"| C2
    A2 -.->|"terkirim ke"| C1

    style J3 fill:#E7F3EC
```

Aturan penggabungan pada **Export Rekap CSV** sengaja dibuat **persis sama**
dengan rekap di spreadsheet. Jadi kalau angkanya berbeda, itu tanda nyata ada
penilaian yang belum sampai ke server — bukan sekadar beda cara menghitung.

---

## 10. Penyimpanan di perangkat

```mermaid
flowchart TD
    subgraph IDB["IndexedDB — besakih-guide-eval"]
        S1[["evaluations<br/>penilaian terenkripsi AES-256-GCM<br/>kunci: evaluationId"]]
        S2[["meta<br/>salinan kunci enkripsi"]]
    end

    subgraph LST["localStorage"]
        L1["besakih.settings<br/>alamat server, pos, filter, sakelar"]
        L2["besakih.draft<br/>isian yang belum disimpan"]
        L3["besakih.guides<br/>cache 296 nama guide"]
        L4["besakih.backup<br/>cadangan seluruh penilaian"]
        L5["besakih.cryptoKey<br/>kunci enkripsi"]
        L6["besakih.tutorialDone"]
    end

    L5 -.->|"disalin dua arah"| S2
    S2 -.->|"kalau salah satu hilang,<br/>yang lain menyelamatkan"| L5
    S1 -.->|"dicadangkan tiap 5 menit<br/>dan saat aplikasi ditutup"| L4
    L4 -.->|"dipulihkan otomatis bila<br/>IndexedDB kedapatan kosong"| S1

    style S2 fill:#E7F3EC
    style L5 fill:#E7F3EC
```

Kunci enkripsi disimpan **di dua tempat**. Dulu kunci hanya ada di
`localStorage` sedangkan datanya di IndexedDB; browser bisa membersihkan
keduanya secara terpisah, dan begitu kunci hilang seluruh penilaian lama
berubah menjadi `(data rusak)` walau isinya masih utuh.

---

## 11. Alur service worker & pembaruan aplikasi

```mermaid
flowchart TD
    A(["Aplikasi dibuka"]) --> B["Daftarkan sw.js"]
    B --> C["Simpan app shell ke cache<br/>html, css, js, ikon, guides.json"]

    C --> D{"Ada permintaan jaringan"}
    D -->|"Ke server lain<br/>mis. script.google.com"| E["Lepas apa adanya ke jaringan<br/>— JANGAN disentuh cache"]
    D -->|"Ke /api/ sendiri"| F["Selalu ke jaringan"]
    D -->|"Berkas aplikasi"| G["Ambil dari cache dulu,<br/>perbarui diam-diam di latar"]

    G --> H{"Jaringan gagal &<br/>tidak ada di cache?"}
    H -->|"Perpindahan halaman"| I["Tampilkan index.html"]
    H -->|"Berkas data"| J["Balas 504 —<br/>JANGAN balas HTML,<br/>nanti dikira JSON rusak"]

    C --> K["Cek versi baru tiap 1 jam"]
    K --> L{"Versi baru tersedia?"}
    L -->|Ya| M["Service worker baru<br/>mengambil alih"]
    M --> N["Halaman dimuat ulang otomatis<br/>— staff tidak perlu bersihkan cache"]

    style E fill:#E7F3EC
    style J fill:#E7F3EC
```

---

## 12. Jadwal waktu ringkas

```mermaid
flowchart LR
    A["⏱️ 0 detik<br/><br/>Tekan SIMPAN<br/>Tersimpan di HP<br/><b>tanpa perlu sinyal</b>"]
    B["⏱️ ± 3 detik<br/><br/>Terkirim ke server<br/>Baris muncul di<br/>tab Evaluations"]
    C["⏱️ ± 5 menit<br/><br/>Trigger berjalan<br/>Rekap disusun ulang"]
    D["⏱️ ± 6 menit<br/><br/>Angka tampil di<br/>tab Rekap A1/A2/D1/D2"]

    A --> B --> C --> D

    A -.->|"kalau tanpa sinyal:<br/>dicoba lagi tiap 1 menit"| B
    C -.->|"kalau trigger terlewat:<br/>tetap disusun 23.00"| D

    style A fill:#E7F3EC
    style D fill:#FFF6E0
```

| Peristiwa | Waktu |
| --- | --- |
| Tersimpan di perangkat | seketika, **tanpa perlu sinyal** |
| Masuk tab `Evaluations` | beberapa detik bila ada sinyal |
| Pengiriman ulang berkala | tiap **1 menit** |
| Tab `Rekap ...` disusun ulang | tiap **5 menit**, hanya bila ada data baru |
| Penyusunan menyeluruh | tiap malam **23.00** |
| **Total terburuk** | **± 6 menit** |

---

## 13. Peta berkas

```mermaid
flowchart TD
    subgraph P["public/ — yang dipasang di HP staff"]
        P1["index.html — seluruh tampilan"]
        P2["js/app.js — kontroler layar, formulir, export"]
        P3["js/db.js — IndexedDB + enkripsi + cadangan"]
        P4["js/sync.js — antrean, kirim ulang, deteksi server"]
        P5["sw.js — service worker, mode tanpa sinyal"]
        P6["config.js — alamat server bawaan"]
        P7["guides.json — 296 guide, salinan bawaan"]
        P8["css/styles.css"]
    end

    subgraph G["server-gas/ — backend utama"]
        G1["Code.gs — ditempel ke Apps Script"]
        G2["test-gas.mjs — uji logika tanpa Google"]
    end

    subgraph N["server/ — backend alternatif"]
        N1["server.js — REST tanpa dependensi"]
        N2["storage.js — SQLite / JSON"]
    end

    subgraph T["test/"]
        T1["app.test.mjs — uji aplikasi via jsdom"]
        T2["e2e.mjs — uji lewat browser sungguhan"]
    end

    P2 --> P3
    P2 --> P4
    P4 --> G1
    P4 -.->|alternatif| N1
```

| Perintah | Kegunaan |
| --- | --- |
| `node server/server.js` | Jalankan backend alternatif di komputer sendiri |
| `node server-gas/test-gas.mjs` | Uji seluruh logika Apps Script (57 pemeriksaan) |
| `node test/app.test.mjs` | Uji aplikasi tanpa browser (69 pemeriksaan) |
| `node test/e2e.mjs` | Uji lewat browser sungguhan |

---

## Ringkasan satu kalimat

Staff menekan SIMPAN → penilaian terenkripsi di HP → dikirim saat ada sinyal →
Apps Script memvalidasi dan menambah satu baris di tab `Evaluations` →
trigger 5 menit menyusun ulang tab `Rekap` → admin membaca tab `Rekap`, dan
bisa mencocokkannya dengan **Export Rekap CSV** dari tiap perangkat.
