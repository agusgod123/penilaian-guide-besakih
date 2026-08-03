# PRD — Aplikasi Penilaian Guide Kawasan Besakih

**Product Requirements Document**
Versi 2.0 · Bahasa: Indonesia · Status: acuan pembangunan ulang dari nol

> Dokumen ini cukup lengkap untuk membangun aplikasi dari awal tanpa melihat
> kode yang sudah ada. Penomoran §4.1, §4.4, §5, §7, §8, §9, §10 dan AC-1…AC-8
> dipertahankan dari PRD versi 1 karena masih dirujuk oleh komentar di dalam
> kode sumber.
>
> Dokumen pendamping: [`ALUR-APLIKASI.md`](ALUR-APLIKASI.md) (diagram alur),
> [`PANDUAN-PEMAKAIAN.md`](PANDUAN-PEMAKAIAN.md) (panduan pengguna).

---

## Daftar isi

| § | Bagian |
| --- | --- |
| [1](#1-ringkasan) | Ringkasan |
| [2](#2-masalah--tujuan) | Masalah & tujuan |
| [3](#3-pengguna--lingkungan-pemakaian) | Pengguna & lingkungan pemakaian |
| [4](#4-kebutuhan-fungsional) | Kebutuhan fungsional |
| [5](#5-keamanan-privasi--ketersediaan) | Keamanan, privasi & ketersediaan |
| [6](#6-kebutuhan-antarmuka--non-fungsional) | Kebutuhan antarmuka & non-fungsional |
| [7](#7-model-data) | Model data |
| [8](#8-sinkronisasi) | Sinkronisasi |
| [9](#9-strategi-pengujian) | Strategi pengujian |
| [10](#10-risiko--mitigasi) | Risiko & mitigasi |
| [11](#11-rekap-bulanan) | Rekap bulanan |
| [12](#12-kontrak-api) | Kontrak API |
| [13](#13-arsitektur--teknologi) | Arsitektur & teknologi |
| [14](#14-kriteria-penerimaan) | Kriteria penerimaan |
| [15](#15-rencana-rilis--operasional) | Rencana rilis & operasional |
| [16](#16-keputusan-desain-dan-alasannya) | Keputusan desain dan alasannya |
| [17](#17-di-luar-lingkup) | Di luar lingkup |
| [18](#18-lampiran) | Lampiran |

---

## 1. Ringkasan

Aplikasi web (PWA) **offline-first** untuk mencatat kepatuhan guide di tiga pos
pemeriksaan Kawasan Besakih. Staff lapangan menilai tiga kriteria —
**Uniform**, **ID-Card**, dan **Review** — memakai HP atau tablet, tanpa login,
dan tanpa bergantung pada sinyal. Data terkirim sendiri ke Google Spreadsheet
begitu ada jaringan, lalu dirangkum otomatis ke tab rekap bulanan berformat
sama dengan berkas *NILAI REWARD* yang dipakai tim selama ini.

| Aspek | Keputusan |
| --- | --- |
| Bentuk | Progressive Web App, satu halaman, tanpa framework |
| Autentikasi | Tidak ada |
| Basis data lapangan | IndexedDB terenkripsi di perangkat |
| Basis data pusat | Google Spreadsheet lewat Apps Script Web App |
| Sifat data | *Append-only* dan *idempotent* |
| Bahasa antarmuka | Indonesia |
| Biaya operasional | Nol |

---

## 2. Masalah & tujuan

### 2.1 Keadaan sebelum ada aplikasi

Penilaian dicatat di kertas lalu disalin manual ke berkas Excel *NILAI REWARD*
di kantor. Akibatnya:

- Penyalinan memakan waktu dan rawan salah ketik
- Rekap baru tersedia beberapa hari setelah kejadian
- Sulit memastikan seorang guide sudah diperiksa atau belum
- Lembar kertas bisa hilang atau basah

### 2.2 Kendala lapangan yang wajib diakomodasi

| Kendala | Konsekuensi bagi rancangan |
| --- | --- |
| Sinyal seluler putus-putus di area pura | Aplikasi **wajib** berfungsi penuh tanpa jaringan |
| Staff bukan pengguna teknologi | Antarmuka harus sangat sederhana, tanpa istilah teknis |
| Perangkat milik pribadi, spesifikasi rendah | Ringan, hemat kuota, hemat baterai |
| Penilaian dilakukan sambil berdiri | Target sentuh besar, alur sesingkat mungkin |
| Tidak ada anggaran server | Backend gratis dan tanpa pemeliharaan |

### 2.3 Tujuan

| Kode | Tujuan | Ukuran keberhasilan |
| --- | --- | --- |
| G-1 | Menghapus penyalinan manual | 0 langkah salin-tempel dari kertas ke Excel |
| G-2 | Penilaian tetap bisa dilakukan tanpa sinyal | 100% fungsi tersedia saat offline |
| G-3 | Rekap tersedia hari yang sama | Rekap termutakhir ≤ 6 menit setelah data dikirim |
| G-4 | Tidak ada penilaian yang hilang | 0 kehilangan data pada uji putus-jaringan |
| G-5 | Dapat dipakai tanpa pelatihan khusus | Staff baru mampu menyelesaikan 1 penilaian < 60 detik setelah membaca tutorial dalam aplikasi |

---

## 3. Pengguna & lingkungan pemakaian

### 3.1 Persona

**P-1 — Staff pos pemeriksaan** (pengguna utama)
Bertugas di salah satu dari tiga pos. Memakai HP Android kelas menengah ke
bawah. Tidak terbiasa dengan aplikasi kerja. Menilai puluhan guide per hari
sambil berdiri, sering dengan satu tangan. **Tidak boleh dibebani** urusan
sinkronisasi, alamat server, atau istilah teknis apa pun.

**P-2 — Admin / staf kantor**
Membuka spreadsheet untuk menyusun laporan bulanan. Terbiasa dengan Excel,
tidak dengan pemrograman. Perlu memastikan angka di rekap benar dan lengkap.

**P-3 — Pengelola teknis** (sesekali)
Memasang pembaruan, menambah guide, dan menangani gangguan. Bukan pengembang
penuh waktu.

### 3.2 Lingkungan

| Aspek | Nilai |
| --- | --- |
| Perangkat | Android 8+ (Chrome), iOS 14+ (Safari); komputer sebagai cadangan |
| Jaringan | Seluler tidak stabil; sering hilang total di dalam area pura |
| Zona waktu | WITA (UTC+8) |
| Jumlah pos | 3 |
| Jumlah guide | 296 pada saat penulisan, dapat bertambah |
| Perkiraan volume | 30–150 penilaian per hari untuk seluruh pos |

---

## 4. Kebutuhan fungsional

Prioritas: **W** = wajib, **S** = sebaiknya, **B** = boleh menyusul.

### 4.1 Daftar guide

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| F-4.1.1 | Aplikasi menampilkan daftar guide aktif untuk dipilih saat menilai | W |
| F-4.1.2 | Tiap guide punya `guideId` unik, `guideName`, `kategori`, dan `regu` | W |
| F-4.1.3 | Daftar **dapat di-cache** di perangkat dan tetap tersedia saat offline | W |
| F-4.1.4 | Aplikasi membawa **salinan bawaan** daftar guide, sehingga perangkat yang baru dipasang dan belum pernah terhubung server tetap bisa menilai | W |
| F-4.1.5 | Urutan sumber daftar: cache perangkat → salinan bawaan → server (server hanya memperbarui, bukan syarat) | W |
| F-4.1.6 | Guide dapat disaring berdasarkan **kategori** (Asing/Domestik) dan **regu** (1/2); pilihan filter diingat antar penilaian | S |
| F-4.1.7 | Guide dapat dinonaktifkan tanpa dihapus (`aktif = FALSE`); yang nonaktif tidak muncul di aplikasi tetapi data lamanya tetap utuh | W |
| F-4.1.8 | Satu guide boleh tergabung dalam lebih dari satu regu, mis. `A1, D1` | W |
| F-4.1.9 | Tersedia layar daftar guide yang dapat dicari, dan menekan satu kartu langsung membuka formulir dengan nama tersebut terisi | S |

### 4.2 Pencatatan penilaian

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| F-4.2.1 | Staff memilih **pos pemeriksaan** (1, 2, atau 3); pilihan diingat antar penilaian | W |
| F-4.2.2 | Staff memilih guide dengan mengetik sebagian nama atau memilih dari daftar | W |
| F-4.2.3 | **Uniform** dinilai `Ya`/`Tidak` dan disimpan sebagai `1`/`0` | W |
| F-4.2.4 | **ID-Card** dinilai `Ya`/`Tidak` dan disimpan sebagai `1`/`0` | W |
| F-4.2.5 | **Review** diisi bilangan bulat `0`–`20` lewat tombol − dan +; nilai `0` adalah jawaban sah, bukan "belum diisi" | W |
| F-4.2.6 | Tersedia isian **catatan** bebas, maksimal 500 huruf, boleh kosong | W |
| F-4.2.7 | Penyimpanan ditolak bila Uniform atau ID-Card belum dipilih | W |
| F-4.2.8 | **Penyimpanan ditolak bila nama guide masih ambigu.** Bila ketikan cocok untuk lebih dari satu guide, aplikasi menolak dan menawarkan daftar nama yang mungkin dimaksud — **aplikasi tidak boleh menebak** | W |
| F-4.2.9 | Isian yang belum disimpan otomatis menjadi **draft** dan pulih setelah aplikasi ditutup tidak sengaja | S |
| F-4.2.10 | Setiap penilaian menerima `evaluationId` berupa UUID yang dibuat di perangkat | W |
| F-4.2.11 | Setelah tersimpan: umpan balik getar + pesan, formulir dikosongkan, pos tetap seperti semula | S |

> **Alasan F-4.2.8:** dari 296 nama, ketikan `Darta` cocok untuk 14 orang.
> Menebak yang pertama berarti mencatat penilaian atas nama orang yang salah,
> dan kesalahan itu tidak akan pernah terdeteksi.

### 4.3 Melihat data di perangkat

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| F-4.3.1 | Layar **Riwayat** menampilkan seluruh penilaian dari perangkat itu, terbaru di atas | W |
| F-4.3.2 | Tiap entri menampilkan status: ⏳ menunggu, ✅ terkirim, ⚠️ tidak terbaca | W |
| F-4.3.3 | Riwayat dapat disaring: Semua / Tertunda / Terkirim | S |
| F-4.3.4 | **Entri yang tidak terbaca tidak boleh digambar sebagai nilai `0`.** Nilainya tidak diketahui, dan menampilkannya sebagai nol sama dengan menuduh guide tidak patuh | W |
| F-4.3.5 | Layar utama menampilkan tiga angka: total hari ini, menunggu sync, terkirim | W |
| F-4.3.6 | Angka "hari ini" dihitung memakai **tanggal setempat perangkat**, bukan UTC | W |
| F-4.3.7 | Tersedia **Export Rekap CSV** berisi rangkuman, bukan sekadar daftar baris (rincian di §4.6) | W |
| F-4.3.8 | Tersedia export cadangan JSON berisi seluruh data mentah | S |

### 4.4 Penyimpanan lokal

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| F-4.4.1 | Penilaian disimpan di IndexedDB dengan `evaluationId` sebagai kunci utama | W |
| F-4.4.2 | Isi penilaian dienkripsi **AES-256-GCM** sebelum disimpan (§5) | W |
| F-4.4.3 | Tiap catatan menyimpan status sync, jumlah percobaan, dan galat terakhir | W |
| F-4.4.4 | Seluruh data dicadangkan berkala ke `localStorage` (tiap 5 menit dan saat aplikasi ditutup) | S |
| F-4.4.5 | Bila IndexedDB kedapatan kosong sedangkan cadangan ada, data dipulihkan otomatis dan pengguna diberi tahu | S |
| F-4.4.6 | Pemakaian penyimpanan ditampilkan, dengan peringatan bila melewati 85% dari batas 10 MB | S |
| F-4.4.7 | Data yang **sudah terkirim** dapat dihapus dari perangkat atas perintah pengguna, dengan konfirmasi | S |
| F-4.4.8 | Data yang belum terkirim **tidak boleh** terhapus oleh mekanisme mana pun | W |

### 4.5 Pengaturan

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| F-4.5.1 | Alamat server tertanam dalam aplikasi sehingga perangkat baru **langsung siap pakai tanpa pengaturan manual** | W |
| F-4.5.2 | Alamat server dapat ditimpa per perangkat bila suatu saat berubah | S |
| F-4.5.3 | Layar pengaturan menampilkan alamat yang **benar-benar sedang dipakai** beserta sumbernya (bawaan / diisi manual / asal aplikasi dibuka) | S |
| F-4.5.4 | Tersedia tombol **Tes Koneksi Server** yang melaporkan hasilnya dalam bahasa manusia | S |
| F-4.5.5 | Tersedia sakelar: mode offline paksa, enkripsi lokal, getar saat simpan | B |

### 4.6 Export Rekap CSV

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| F-4.6.1 | Berkas memakai pemisah **titik koma** dan diawali baris `sep=;`, agar terbuka rapi di Excel berbahasa Indonesia | W |
| F-4.6.2 | Berkas diawali BOM UTF-8 agar huruf beraksen tidak rusak | W |
| F-4.6.3 | Angka **tidak** dikutip, supaya langsung dapat dijumlah di Excel | W |
| F-4.6.4 | Berisi bagian: keterangan ringkas, rekap harian per guide, rekap per pos, rekap per tanggal, rincian seluruh penilaian | W |
| F-4.6.5 | **Rekap harian per guide memakai aturan penggabungan yang identik dengan rekap di spreadsheet (§11.3)**, supaya kedua angka dapat disandingkan langsung | W |
| F-4.6.6 | Rincian menyertakan `timestamp` UTC dan `evaluationId` untuk penelusuran baris ke spreadsheet | W |
| F-4.6.7 | Entri yang tidak terbaca dipisahkan ke bagian tersendiri dan **tidak ikut dihitung** dalam rekap | W |

---

## 5. Keamanan, privasi & ketersediaan

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| F-5.1 | Isi penilaian dienkripsi AES-256-GCM memakai Web Crypto, dengan IV acak 12 byte per catatan | W |
| F-5.2 | **Kunci enkripsi disimpan di dua tempat**: `localStorage` dan object store `meta` di IndexedDB yang sama dengan datanya | W |
| F-5.3 | Bila salah satu tempat penyimpanan kunci kosong, kunci dipulihkan dari yang lain sebelum kunci baru dibuat | W |
| F-5.4 | Bila Web Crypto tidak tersedia (konteks tidak aman), aplikasi tetap berfungsi tanpa enkripsi dan menyatakannya di layar Tentang | S |
| F-5.5 | Tidak ada data pribadi selain nama guide dan hasil penilaian; tidak ada lokasi, foto, atau identitas staff | W |
| F-5.6 | Endpoint server **tidak menyediakan cara membaca daftar penilaian**, karena web app dideploy dengan akses publik | W |
| F-5.7 | Data bersifat *append-only*: tidak ada endpoint untuk mengubah atau menghapus | W |
| F-5.8 | Server hanya menerima `guideId` yang terdaftar; kiriman lain ditolak | W |
| F-5.9 | Aplikasi **berfungsi 100% tanpa jaringan** setelah pemuatan pertama | W |
| F-5.10 | Service worker menyimpan app shell dan memperbaruinya di latar belakang | W |

> **Alasan F-5.2/F-5.3:** kunci di `localStorage` sedangkan data di IndexedDB
> adalah kombinasi berbahaya — browser dapat membersihkan keduanya secara
> terpisah. Sekali kunci hilang, seluruh penilaian lama menjadi tidak terbaca
> walau isinya masih utuh. Kejadian ini pernah terjadi di lapangan.

**Batasan yang diterima secara sadar:** alamat `/exec` tertanam di berkas yang
dapat dibaca publik dan web app dideploy dengan akses "Anyone", sehingga pihak
luar yang menemukannya dapat mengirim baris palsu. Yang tidak bisa dilakukan:
membaca, mengubah, atau menghapus data. Mitigasi yang berlaku: validasi
`guideId`, sifat append-only, dan kemampuan mencabut alamat kapan saja
(§15.4).

---

## 6. Kebutuhan antarmuka & non-fungsional

### 6.1 Antarmuka

| ID | Kebutuhan |
| --- | --- |
| N-6.1.1 | Target sentuh minimal **48 px**; tombol utama 56–84 px |
| N-6.1.2 | Ukuran teks minimal **16 px**; teks isi 17 px |
| N-6.1.3 | Alur menilai satu guide selesai dalam **satu layar**, tanpa perlu menggulir jauh |
| N-6.1.4 | Seluruh teks berbahasa Indonesia sehari-hari; **tidak ada istilah teknis** yang terlihat pengguna |
| N-6.1.5 | Status jaringan selalu terlihat di kanan atas |
| N-6.1.6 | Menu samping memuat seluruh layar aplikasi |
| N-6.1.7 | Tutorial 4 langkah pada pemakaian pertama, dan dapat dibuka lagi kapan saja |
| N-6.1.8 | Setiap pesan galat menyebutkan **apa yang harus dilakukan**, bukan sekadar apa yang salah |
| N-6.1.9 | Warna utama hijau `#0B5D3B` dan emas `#C8942B`, mengikuti identitas Kawasan Besakih |

### 6.2 Kinerja & ukuran

| ID | Kebutuhan |
| --- | --- |
| N-6.2.1 | Ukuran app shell ≤ **5 MB** |
| N-6.2.2 | Pemuatan pertama ≤ 3 detik pada jaringan 3G |
| N-6.2.3 | Pemuatan berikutnya ≤ 1 detik (dari cache) |
| N-6.2.4 | Menyimpan satu penilaian terasa seketika (≤ 200 ms) |
| N-6.2.5 | Layar tetap responsif dengan 1.000 penilaian tersimpan |
| N-6.2.6 | **Tanpa dependensi produksi**; tanpa framework dan tanpa CDN |

### 6.3 Kompatibilitas

| ID | Kebutuhan |
| --- | --- |
| N-6.3.1 | Chrome Android 90+, Safari iOS 14+, Chrome/Edge desktop |
| N-6.3.2 | Dapat dipasang sebagai PWA di Android maupun iOS |
| N-6.3.3 | Berfungsi pada `https://` dan `http://localhost`; keterbatasan pada konteks tak aman dinyatakan terbuka |

---

## 7. Model data

### 7.1 Penilaian (`Evaluation`)

Bentuk yang dikirim aplikasi ke server dan disimpan di perangkat:

```jsonc
{
  "evaluationId": "e796ff8a-7acb-4c47-b468-6aa256658def", // UUID v4, dibuat di perangkat
  "guideId":      "G-004",                                // wajib terdaftar di daftar guide
  "guideName":    "I Gede Darmayasa",                     // server menimpanya dengan nama resmi
  "pos":          3,                                       // 1, 2, atau 3
  "timestamp":    "2026-08-02T07:55:29.825Z",              // ISO 8601 UTC, jam perangkat
  "criteria": {
    "uniform": true,                                       // boolean; disimpan sebagai 1/0
    "idCard":  true,                                       // boolean; disimpan sebagai 1/0
    "review":  3                                           // bilangan bulat 0..20
  },
  "catatan": ""                                            // maksimal 500 huruf
}
```

**Aturan validasi (berlaku di aplikasi dan diulang di server):**

| Ruas | Aturan | Bila dilanggar |
| --- | --- | --- |
| `evaluationId` | Wajib, unik | Ditolak |
| `guideId` | Wajib, harus ada di daftar guide | Ditolak |
| `guideName` | Wajib; **server menimpanya** dengan nama resmi dari daftar guide | Diperbaiki diam-diam |
| `pos` | Salah satu dari 1, 2, 3 | Ditolak |
| `timestamp` | ISO 8601 yang dapat diurai | Ditolak |
| `criteria.uniform` | Boolean | Ditolak |
| `criteria.idCard` | Boolean | Ditolak |
| `criteria.review` | Angka ≥ 0 | Ditolak bila negatif; dipangkas bila > 20 |
| `catatan` | Teks | Dipangkas ke 500 huruf |

> **Alasan menimpa `guideName`:** perangkat yang masih memakai daftar guide lama
> dapat mengirim pasangan `guideId`/`guideName` yang tidak cocok. Karena rekap
> berpatokan pada `guideId`, baris seperti itu akan tampil dengan nama yang
> salah. Nama resmi selalu diambil dari daftar guide di server.

### 7.2 Guide

```jsonc
{
  "guideId":   "G-004",
  "guideName": "I Gede Darmayasa",
  "kategori":  "Asing",          // "Asing" | "Domestik" | "Asing, Domestik"
  "regu":      "A1, A2",         // satu atau lebih kode regu, dipisah koma
  "aktif":     true
}
```

Kode regu: `A1`, `A2` (Asing regu 1 dan 2), `D1`, `D2` (Domestik regu 1 dan 2).
Huruf pertama menentukan kategori, angka menentukan nomor regu.

### 7.3 Catatan di IndexedDB

```jsonc
{
  "evaluationId": "…",        // kunci utama
  "timestamp":    "…",        // tidak dienkripsi, dipakai untuk pengurutan
  "pos":          3,          // tidak dienkripsi
  "syncState":    0,          // 0 = menunggu, 1 = terkirim  (ada indeksnya)
  "attempts":     0,
  "lastError":    null,
  "enc":          true,       // isi dienkripsi?
  "iv":           "…",        // base64, 12 byte
  "payload":      "…"         // base64 ciphertext, atau objek mentah bila enc=false
}
```

Object store kedua, `meta`, berisi salinan kunci enkripsi (§5).

### 7.4 Baris di tab `Evaluations`

Sepuluh kolom, berurutan:

| # | Kolom | Contoh |
| --- | --- | --- |
| 1 | `evaluationId` | `e796ff8a-…` |
| 2 | `timestamp` | `2026-08-02T07:55:29.825Z` |
| 3 | `pos` | `3` |
| 4 | `guideId` | `G-004` |
| 5 | `guideName` | `I Gede Darmayasa` |
| 6 | `uniform` | `1` |
| 7 | `idCard` | `1` |
| 8 | `review` | `3` |
| 9 | `catatan` | |
| 10 | `receivedAt` | `2026-08-02T07:55:31.817Z` |

Urutan kolom `uniform` sebelum `idCard` mengikuti urutan pada berkas *NILAI
REWARD*, bukan urutan pada formulir.

---

## 8. Sinkronisasi

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| F-8.1 | Penilaian masuk antrean lokal begitu disimpan | W |
| F-8.2 | Pengiriman dipicu oleh: penyimpanan baru, jadwal tiap **1 menit**, jaringan kembali menyala, aplikasi kembali dibuka, dan tombol manual | W |
| F-8.3 | Kiriman bersifat **idempotent** berdasarkan `evaluationId`; pengiriman ulang tidak menggandakan baris | W |
| F-8.4 | Entri **hanya** ditandai terkirim bila server **menyebutkan `evaluationId` itu** dalam balasannya | W |
| F-8.5 | Kegagalan jaringan menghentikan sisa antrean pada putaran itu, lalu dijadwalkan ulang | S |
| F-8.6 | Jeda percobaan ulang naik berlipat: 2s, 4s, 8s, 16s, 32s, 64s, dengan batas atas **5 menit** | S |
| F-8.7 | Penolakan permanen (data tidak sah) ditandai gagal dan **tidak** diulang selamanya | W |
| F-8.8 | Balasan "server sedang sibuk" diperlakukan sebagai kegagalan **sementara** | W |
| F-8.9 | Status sinkronisasi terlihat di layar utama dan di tiap entri riwayat | W |
| F-8.10 | Permintaan jaringan memiliki batas waktu: 12 detik (REST), 30 detik (Apps Script) | S |

> **Alasan F-8.4:** Apps Script tetap membalas HTTP 200 walaupun penulisan ke
> spreadsheet gagal. Menandai terkirim hanya berdasarkan status 200 membuat
> data terhapus dari antrean padahal tidak pernah sampai — hilang tanpa jejak.

---

## 9. Strategi pengujian

| ID | Kebutuhan |
| --- | --- |
| T-9.1 | Logika backend dapat diuji **tanpa Google**, memakai tiruan API Apps Script |
| T-9.2 | Aplikasi dapat diuji **tanpa browser**, memakai DOM tiruan dan IndexedDB tiruan |
| T-9.3 | Tersedia uji lewat browser sungguhan untuk PWA, service worker, dan ukuran target sentuh |
| T-9.4 | Uji **wajib** mencakup simulasi putus jaringan dan pemulihannya |
| T-9.5 | Uji wajib mencakup pengiriman ulang: tidak boleh menggandakan data |
| T-9.6 | Tiruan `formatDate` pada uji **wajib menghormati zona waktu sungguhan**; tiruan yang selalu memakai UTC menyembunyikan kesalahan tanggal |
| T-9.7 | Seluruh perintah uji berjalan di Windows, macOS, dan Linux |
| T-9.8 | Tiap perbaikan gangguan disertai satu pemeriksaan baru yang gagal sebelum perbaikan |

---

## 10. Risiko & mitigasi

| # | Risiko | Dampak | Mitigasi wajib |
| --- | --- | --- | --- |
| R-1 | Data lokal rusak atau terhapus browser | Kehilangan penilaian | Cadangan berkala ke `localStorage`; pemulihan otomatis (F-4.4.4/5) |
| R-2 | **Kunci enkripsi hilang, data jadi tidak terbaca** | Riwayat tak terbaca | Kunci disimpan di dua tempat (F-5.2/5.3) |
| R-3 | Penyimpanan perangkat penuh | Gagal menyimpan | Indikator pemakaian + penghapusan data terkirim (F-4.4.6/7) |
| R-4 | Server membalas 200 tapi gagal menulis | **Data hilang tanpa jejak** | Konfirmasi berbasis `evaluationId` (F-8.4) |
| R-5 | Dua pos menulis bersamaan | Baris tertimpa | Penguncian di sisi server (F-12.6) |
| R-6 | **Rekap tidak pernah diperbarui** | Hasil dikira tidak masuk | Pembaruan otomatis + cap waktu + pemeriksa mandiri (§11.5–11.7) |
| R-7 | Nama guide ambigu tertebak salah | Penilaian atas nama orang keliru | Penolakan ketikan ambigu (F-4.2.8) |
| R-8 | Perbedaan zona waktu | Penilaian jatuh pada tanggal yang salah | Tanggal setempat untuk tampilan (F-4.3.6), zona spreadsheet untuk rekap (§11.2) |
| R-9 | Jam perangkat meleset | Baris masuk tanggal yang salah | `receivedAt` dicatat server sebagai pembanding; **belum ada koreksi otomatis** |
| R-10 | Perangkat memakai daftar guide lama | Nama tidak cocok di rekap | Nama diambil dari server; `guideId` asing ditolak (F-5.8) |
| R-11 | Aplikasi versi lama tertinggal di cache | Perbaikan tidak sampai | Pemeriksaan versi tiap jam + muat ulang otomatis |
| R-12 | Alamat server publik disalahgunakan | Baris palsu | Append-only, validasi `guideId`, alamat dapat dicabut (§15.4) |
| R-13 | Kuota harian Apps Script terlampaui | Pengiriman gagal sementara | Diperlakukan sebagai kegagalan sementara; antrean bertahan di perangkat |

---

## 11. Rekap bulanan

### 11.1 Bentuk keluaran

Untuk tiap bulan dibuat lima tab:

| Tab | Isi |
| --- | --- |
| `Rekap A1 YYYY-MM` | Asing regu 1 |
| `Rekap A2 YYYY-MM` | Asing regu 2 |
| `Rekap D1 YYYY-MM` | Domestik regu 1 |
| `Rekap D2 YYYY-MM` | Domestik regu 2 |
| `Rekap Kehadiran YYYY-MM` | Kehadiran harian tiap guide (§11.3a) |
| `Rekap per Pos YYYY-MM` | Rincian tiap guide dipisah per pos |

Susunan tab regu, meniru berkas *NILAI REWARD*:

```
Baris 1 : judul                                      … cap "Diperbarui: …" di kolom terakhir
Baris 2 : REGU: n (Kategori) │ TGL: d-m-yyyy (3 kolom) │ … │ TOTAL (3 kolom)
Baris 3 : NAME │ UNI FORM │ ID │ REVIEW │ … │ UNI FORM │ ID │ REVIEW
Baris 4 : (kosong)
Baris 5+: satu baris per guide anggota regu
```

| ID | Kebutuhan |
| --- | --- |
| F-11.1.1 | **Seluruh** anggota regu tercantum, termasuk yang belum pernah dinilai — agar terlihat siapa yang belum diperiksa |
| F-11.1.2 | Hanya tanggal yang benar-benar ada penilaiannya yang menjadi kolom |
| F-11.1.3 | Sel kosong berarti "tidak bertugas atau belum diperiksa", **berbeda** dari nilai `0` |
| F-11.1.4 | Kolom TOTAL berisi rumus `=SUM(...)` yang tetap hidup, sehingga koreksi manual ikut terhitung |
| F-11.1.5 | Baris 1–3 dan kolom nama dibekukan |
| F-11.1.6 | Judul **tidak boleh** di-merge melintasi batas kolom beku, karena pembekuan kolom akan gagal |

### 11.2 Penentuan tanggal

Tanggal dan bulan dihitung memakai **zona waktu spreadsheet**, bukan UTC dan
bukan zona perangkat. Satu penilaian pukul 23.30 WITA harus jatuh pada tanggal
itu juga, bukan keesokan harinya.

### 11.3 Aturan penggabungan (penting)

Satu guide dapat melewati beberapa pos pada hari yang sama. Untuk satu guide
pada satu tanggal:

| Kriteria | Nilai yang dipakai | Alasan |
| --- | --- | --- |
| UNI FORM | **Paling buruk** (`0` mengalahkan `1`) | Ketidaksesuaian di pos mana pun tetap ketidaksesuaian |
| ID | **Paling buruk** | Sama |
| REVIEW | **Tertinggi** | Review yang tercatat di salah satu pos tidak boleh hilang |

Rincian per pos tetap tersedia di tab `Rekap per Pos`.

**Aturan ini wajib diterapkan sama persis di Export Rekap CSV (F-4.6.5)**,
karena kegunaan utamanya adalah untuk disandingkan.

### 11.3a Kehadiran harian — satu pos bernilai satu

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| F-11.3a.1 | **Kehadiran seorang guide pada satu hari = jumlah POS BERBEDA yang memeriksanya**, bernilai 0 sampai 3 | W |
| F-11.3a.2 | Diperiksa lebih dari sekali di pos yang sama pada hari yang sama tetap dihitung **satu** | W |
| F-11.3a.3 | Penggabungan nilai dilakukan pada tingkat `(guide, pos, tanggal)` lebih dulu, baru dijumlahkan lintas pos | W |
| F-11.3a.4 | Kolom `Pn Hadir` pada tab per pos menghitung **jumlah hari** guide itu diperiksa di pos n, bukan jumlah penilaian | W |
| F-11.3a.5 | Tab `Rekap Kehadiran` memuat seluruh guide aktif; yang belum pernah hadir tetap tercantum dengan sel kosong | W |
| F-11.3a.6 | Tersedia kolom `TOTAL POS` (jumlah kehadiran pos sebulan) dan `HARI HADIR` (jumlah hari hadir), keduanya berupa rumus | S |
| F-11.3a.7 | Aplikasi **memperingatkan** bila guide yang sama akan dinilai lagi di pos yang sama pada hari yang sama, tetapi tetap mengizinkan — penilaian kedua kadang koreksi | W |
| F-11.3a.8 | Peringatan itu memakai riwayat perangkat sendiri; deteksi lintas perangkat tidak dimungkinkan karena §5 melarang endpoint pembacaan | S |

> **Alasan F-11.3a.2:** kehadiran dipakai untuk menghitung reward. Tanpa aturan
> ini, satu guide yang kebetulan diperiksa dua kali di pos yang sama akan
> terhitung hadir dua kali, sedangkan rekannya yang lewat sekali di tiap pos
> hanya terhitung tiga — angkanya jadi tidak sebanding.

### 11.4 Kapan rekap disusun

| Pemicu | Jadwal |
| --- | --- |
| Trigger berkala | tiap **5 menit**, hanya bila ada penilaian baru |
| Trigger harian | tiap malam pukul 23.00, sebagai jaring pengaman |
| Menu manual | saat itu juga |

| ID | Kebutuhan |
| --- | --- |
| F-11.4.1 | Penerimaan penilaian **menitipkan** bulan yang berubah, lalu trigger yang menyusunnya |
| F-11.4.2 | **Rekap tidak boleh disusun di dalam penanganan permintaan POST.** Menyusun empat tab memakan belasan detik; aplikasi di lapangan akan menganggap penilaian gagal |
| F-11.4.3 | Titipan dihapus **sebelum** penyusunan dimulai, agar penilaian yang masuk saat itu tercatat untuk putaran berikutnya |
| F-11.4.4 | Bila penyusunan gagal (mis. tidak mendapat kunci), bulan itu **ditandai ulang** — tidak boleh hilang begitu saja |
| F-11.4.5 | Trigger dipasang otomatis saat penyiapan awal, bukan langkah manual terpisah |

### 11.5 Cap waktu

Tiap tab rekap membawa tulisan `Diperbarui: <tanggal jam>` di **pojok kanan
atas**, di dalam baris yang dibekukan.

> **Alasan:** tanpa penanda ini, rekap yang basi terlihat persis sama dengan
> "memang belum ada data". Inilah sumber keluhan "hasil tidak masuk
> spreadsheet" yang sebenarnya hanya soal rekap belum disusun ulang.

### 11.6 Pemeriksaan mandiri

Bila terdapat penilaian pada bulan itu **tetapi tidak satu pun nilai harian
mendarat di tab regu**, penyusun rekap wajib mengeluarkan peringatan keras yang
menyebutkan kemungkinan penyebabnya (`guideId` tidak terdaftar). Rekap berisi
nol semua tanpa penjelasan tidak dapat diterima.

### 11.7 Perkakas diagnosis

Tersedia perintah **Periksa Kesehatan Data** yang melaporkan: jumlah penilaian
tersimpan, jumlah bulan berjalan, waktu penilaian terakhir masuk, jumlah
trigger aktif, jumlah guide terdaftar, dan daftar `guideId` yang tidak dikenal
— sekaligus menyusun ulang rekap.

### 11.8 Penyiapan ulang tab

Sebelum ditulis ulang, sel gabungan sisa susunan sebelumnya **wajib dilepas**.
Jumlah kolom tanggal berubah tiap hari, dan sisa gabungan dapat menggeser atau
menelan nilai yang baru ditulis.

---

## 12. Kontrak API

Aplikasi wajib mendukung **dua jenis backend** dan memilihnya otomatis dari
bentuk alamatnya.

### 12.1 Pemilihan backend

| Urutan | Sumber alamat |
| --- | --- |
| 1 | Diisi pengguna di Pengaturan |
| 2 | Alamat bawaan yang tertanam dalam aplikasi |
| 3 | Asal tempat aplikasi dibuka |

Bila alamat mengandung `script.google.com` → **mode Apps Script**, selain itu →
**mode REST**.

### 12.2 Titik akhir

| Kegunaan | Mode REST | Mode Apps Script |
| --- | --- | --- |
| Cek server | `GET /api/health` | `GET …/exec?action=health` |
| Daftar guide | `GET /api/guides` | `GET …/exec?action=guides` |
| Kirim penilaian | `POST /api/evaluations` | `POST …/exec` |

### 12.3 Balasan cek server

```json
{ "ok": true, "storage": "google-sheets", "total": 128,
  "serverTime": "2026-08-02T10:00:32.356Z" }
```

### 12.4 Balasan daftar guide

```json
{ "guides": [ { "guideId": "G-001", "guideName": "Gusti Alit Astawa",
                "kategori": "Asing", "regu": "A1", "aktif": true } ] }
```

### 12.5 Kirim penilaian

Badan permintaan: satu objek `Evaluation`, **atau** `{ "evaluations": [ … ] }`
untuk kiriman borongan (maksimal 200 entri).

Balasan:

```json
{
  "accepted": [ { "evaluationId": "…", "synced": true, "duplicate": false } ],
  "rejected": [ { "evaluationId": "…", "errors": ["pos harus 1, 2, atau 3"] } ],
  "total": 129
}
```

| Keadaan | Balasan | Sikap aplikasi |
| --- | --- | --- |
| Tersimpan | `accepted` memuat `evaluationId` | Tandai ✅ |
| Sudah pernah masuk | `accepted` dengan `duplicate: true` | Tandai ✅ |
| Tidak sah | `rejected` beserta alasannya | Tandai gagal permanen |
| Server terkunci | `{ "busy": true }` | Coba lagi nanti |
| Gagal menulis | `{ "error": "…" }` tanpa `accepted` | Coba lagi nanti |

### 12.6 Ketentuan sisi server

| ID | Kebutuhan |
| --- | --- |
| F-12.6.1 | Penulisan dilindungi kunci; batas tunggu 20 detik |
| F-12.6.2 | Bila kunci tidak diperoleh, balas `busy` — **jangan** mengaku tersimpan |
| F-12.6.3 | Kunci wajib dilepas dalam segala keadaan, termasuk saat terjadi galat |
| F-12.6.4 | Kegagalan penulisan **tidak boleh** dibalas sebagai `accepted` |
| F-12.6.5 | Seluruh baris ditulis dalam satu operasi, bukan satu per satu |
| F-12.6.6 | Badan permintaan dikirim sebagai `text/plain` pada mode Apps Script, karena Apps Script tidak dapat menjawab permintaan `OPTIONS` sehingga `application/json` akan diblokir CORS |

---

## 13. Arsitektur & teknologi

### 13.1 Ketentuan teknologi

| Lapisan | Ketentuan | Alasan |
| --- | --- | --- |
| Antarmuka | HTML + CSS + JavaScript murni | Tanpa proses build; siapa pun dapat memperbaikinya |
| Penyimpanan lokal | IndexedDB + Web Crypto | Tersedia di semua peramban sasaran |
| Mode offline | Service worker, *cache-first* untuk app shell | Syarat mutlak |
| Backend utama | Google Apps Script terikat spreadsheet | Gratis, tanpa pemeliharaan, rekap langsung di tempat |
| Backend alternatif | Node.js tanpa dependensi | Untuk pemakaian dalam jaringan lokal |
| Dependensi produksi | **Nol** | Menghindari pembusukan dependensi pada proyek yang jarang disentuh |

### 13.2 Struktur berkas

```
public/                aplikasi yang dipasang di perangkat staff
  index.html           seluruh tampilan
  config.js            alamat server bawaan
  guides.json          salinan bawaan daftar guide
  css/styles.css
  js/db.js             IndexedDB, enkripsi, cadangan
  js/sync.js           antrean, percobaan ulang, pemilihan backend
  js/app.js            kontroler layar, formulir, export
  sw.js                service worker
  manifest.webmanifest
server-gas/
  Code.gs              backend Apps Script
  test-gas.mjs         uji logika backend tanpa Google
server/                backend alternatif
test/                  uji aplikasi
docs/                  dokumentasi
```

### 13.3 Pembagian tanggung jawab

| Berkas | Tanggung jawab | Tidak boleh |
| --- | --- | --- |
| `db.js` | Penyimpanan, enkripsi, cadangan | Menyentuh jaringan atau DOM |
| `sync.js` | Antrean, jaringan, pemilihan backend | Menyentuh DOM |
| `app.js` | Layar, formulir, export | Menulis ke IndexedDB langsung |
| `sw.js` | Cache app shell | Menyentuh permintaan lintas host |

> **Ketentuan `sw.js`:** permintaan ke host lain wajib dilepas apa adanya.
> Mencegatnya membuat balasan `index.html` terkirim saat jaringan putus, lalu
> dibaca sebagai JSON dan gagal dengan pesan yang menyesatkan.

---

## 14. Kriteria penerimaan

Nomor AC-1…AC-8 dipertahankan dari versi 1.

| ID | Kriteria | Cara memeriksa |
| --- | --- | --- |
| **AC-1** | Aplikasi terbuka tanpa login | Tidak ada elemen sandi/masuk; layar utama langsung tampil |
| **AC-2** | Daftar guide ≥ 10 dan dapat dipilih | Hitung pilihan pada daftar |
| **AC-3** | Tiga kriteria dapat diisi dan tersimpan di perangkat | Isi formulir, periksa IndexedDB |
| **AC-4** | Saat jaringan hilang: antarmuka tetap jalan, tanda offline muncul, data tetap tersimpan | Matikan jaringan, simpan penilaian |
| **AC-5** | Saat jaringan kembali: antrean terkirim otomatis, status menjadi ✅ | Nyalakan jaringan, tunggu, periksa status |
| **AC-6** | Menu samping membuka seluruh layar | Buka tiap butir menu |
| **AC-7** | Target sentuh ≥ 48 px dan teks ≥ 16 px | Ukur lewat browser |
| **AC-8** | Dapat dipasang sebagai PWA | Manifest sah + service worker terdaftar |
| **AC-9** | Ketikan nama yang ambigu ditolak dan menawarkan pilihan | Ketik `Darta`, coba simpan |
| **AC-10** | Pengiriman ulang tidak menggandakan data | Kirim `evaluationId` yang sama dua kali |
| **AC-11** | HTTP 200 tanpa konfirmasi **tidak** dianggap terkirim | Tiruan server membalas 200 kosong |
| **AC-12** | Rekap disusun ulang otomatis ≤ 5 menit setelah penilaian masuk | Kirim penilaian, jalankan trigger |
| **AC-13** | Tiap tab rekap membawa cap "Diperbarui" | Periksa kolom terakhir baris 1 |
| **AC-14** | Rekap memperingatkan bila ada penilaian tetapi tidak ada yang masuk rekap | Isi penilaian dengan `guideId` asing |
| **AC-15** | Angka "hari ini" memakai tanggal setempat, bukan UTC | Uji dengan waktu 23.30 WITA |
| **AC-16** | Kunci enkripsi punya salinan di IndexedDB | Periksa object store `meta` |
| **AC-17** | Export CSV terbuka rapi di Excel berbahasa Indonesia | Periksa baris `sep=;` dan BOM |
| **AC-18** | Angka rekap CSV sama dengan rekap spreadsheet | Bandingkan satu tanggal |
| **AC-19** | Entri tidak terbaca tidak digambar sebagai nilai `0` | Rusakkan satu catatan, lihat Riwayat |
| **AC-20** | Guide dengan `aktif = FALSE` tidak muncul, datanya tetap utuh | Nonaktifkan satu guide |
| **AC-21** | Dua penilaian di pos yang sama pada hari yang sama dihitung sebagai kehadiran **1** | Nilai satu guide dua kali di Pos 1, lihat tab Kehadiran |
| **AC-22** | Tiga pos berbeda pada hari yang sama dihitung sebagai kehadiran **3** | Nilai satu guide di Pos 1, 2, dan 3 |
| **AC-23** | Aplikasi memperingatkan penilaian ganda tetapi tetap mengizinkan | Nilai guide yang sama dua kali di pos yang sama |

---

## 15. Rencana rilis & operasional

### 15.1 Tahapan

| Tahap | Isi | Selesai bila |
| --- | --- | --- |
| 1 | Kerangka antarmuka + penyimpanan lokal | AC-1, AC-2, AC-3, AC-6, AC-7 |
| 2 | Mode offline + PWA | AC-4, AC-8 |
| 3 | Sinkronisasi + backend | AC-5, AC-10, AC-11 |
| 4 | Rekap bulanan otomatis | AC-12, AC-13, AC-14 |
| 5 | Pengetatan & diagnosis | AC-9, AC-15…AC-20 |

### 15.2 Penyebaran

| Bagian | Cara | Catatan |
| --- | --- | --- |
| Aplikasi | Berkas statis via GitHub Pages | Otomatis pada setiap perubahan `public/` |
| Backend | Tempel `Code.gs` ke Apps Script, jalankan penyiapan | **Manual** — tidak ikut otomatis |
| Pembaruan backend | Deploy → Manage deployments → Edit → **New version** | Memakai *New deployment* akan mengubah alamat |

> Perbedaan cara ini adalah sumber gangguan yang mudah terlewat: aplikasi sudah
> terbarui sementara backend masih versi lama. Setiap catatan rilis wajib
> menyebutkan apakah `Code.gs` ikut berubah.

### 15.3 Penyiapan awal spreadsheet

1. Buat spreadsheet baru → Extensions → Apps Script
2. Tempel `Code.gs`, simpan
3. Jalankan fungsi penyiapan → tab dibuat, daftar guide terisi, trigger menyala
4. Deploy → New deployment → Web app · *Execute as*: **Me** · *Who has access*: **Anyone**
5. Salin alamat `/exec` ke berkas konfigurasi aplikasi

### 15.4 Mencabut alamat server

1. Apps Script → Deploy → Manage deployments → arsipkan yang lama
2. Buat deployment baru (menghasilkan alamat baru)
3. Perbarui berkas konfigurasi, sebarkan ulang aplikasi

### 15.5 Pemantauan

Tidak ada sistem pemantauan otomatis. Pemeriksaan berkala yang disarankan:

| Berkala | Yang diperiksa |
| --- | --- |
| Harian | Cap "Diperbarui" pada tab rekap masih segar |
| Mingguan | **Periksa Kesehatan Data** — trigger aktif, tidak ada `guideId` tercecer |
| Bulanan | Bandingkan rekap spreadsheet dengan Export Rekap CSV tiap perangkat |

---

## 16. Keputusan desain dan alasannya

| # | Keputusan | Alasan | Yang ditolak |
| --- | --- | --- | --- |
| K-1 | Tanpa login | Staff berganti-ganti, perangkat dipakai bersama; login menambah hambatan tanpa manfaat nyata | Akun per staff |
| K-2 | Spreadsheet sebagai basis data | Gratis, dikenal admin, rekap langsung di tempat yang sama | Basis data terkelola |
| K-3 | Tanpa framework | Proyek jarang disentuh; dependensi akan membusuk lebih dulu | React/Vue |
| K-4 | Append-only | Menghilangkan seluruh kelas gangguan konflik penyuntingan | Sinkronisasi dua arah |
| K-5 | UUID dibuat di perangkat | Memungkinkan idempotensi tanpa koordinasi dengan server | Nomor urut dari server |
| K-6 | Rekap di luar jalur POST | Balasan harus cepat; menyusun rekap butuh belasan detik | Menyusun rekap saat menerima data |
| K-7 | Nama guide ditimpa server | `guideId` adalah kebenaran; nama dari perangkat bisa usang | Percaya kiriman perangkat |
| K-8 | Ketikan ambigu ditolak | 14 nama mengandung "Darta"; menebak = mencatat orang yang salah | Menebak yang pertama cocok |
| K-9 | Kunci enkripsi di dua tempat | Pernah terjadi kehilangan nyata di lapangan | Kunci hanya di `localStorage` |
| K-10 | `text/plain` untuk POST | Apps Script tidak menjawab `OPTIONS`, `application/json` diblokir CORS | JSON dengan preflight |
| K-11 | CSV bertitik koma | Excel berbahasa Indonesia menumpuk berkas berkoma jadi satu kolom | CSV berkoma |
| K-12 | Nilai 1/0, bukan Ya/Tidak | Dapat langsung dijumlah, sama seperti *NILAI REWARD* | Teks TRUE/FALSE |
| K-13 | Cap waktu di tiap tab rekap | Rekap basi harus dapat dibedakan dari "belum ada data" | Tanpa penanda |

---

## 17. Di luar lingkup

Tidak termasuk dalam versi ini, dan **tidak boleh** dikerjakan tanpa
pembahasan ulang:

| # | Hal | Alasan |
| --- | --- | --- |
| L-1 | Akun dan peran pengguna | Bertentangan dengan K-1 |
| L-2 | Menyunting atau menghapus penilaian dari aplikasi | Bertentangan dengan K-4 |
| L-3 | Membaca daftar penilaian lewat endpoint | Bertentangan dengan F-5.6 |
| L-4 | Foto atau lampiran | Kuota dan penyimpanan perangkat |
| L-5 | Lokasi GPS | Tidak dibutuhkan; menambah beban privasi |
| L-6 | Notifikasi *push* | Tidak ada kebutuhan yang jelas |
| L-7 | Aplikasi Android/iOS *native* | PWA sudah memenuhi seluruh kebutuhan |
| L-8 | Laporan grafik di dalam aplikasi | Rekap sudah tersedia di spreadsheet |
| L-9 | Terjemahan bahasa lain | Seluruh pengguna berbahasa Indonesia |
| L-10 | Koreksi jam perangkat otomatis | Diketahui sebagai keterbatasan (R-9) |

---

## 18. Lampiran

### 18.1 Istilah

| Istilah | Arti |
| --- | --- |
| **Pos** | Titik pemeriksaan; ada tiga |
| **Regu** | Kelompok kerja guide: `A1`, `A2`, `D1`, `D2` |
| **Kategori** | `Asing` atau `Domestik`, menurut wisatawan yang dilayani |
| **NILAI REWARD** | Berkas Excel yang dipakai tim sebelum ada aplikasi; format rekap mengikutinya |
| **Append-only** | Hanya menambah baris; tidak pernah mengubah atau menghapus |
| **Idempotent** | Kiriman berulang menghasilkan keadaan yang sama |
| **App shell** | Berkas inti aplikasi yang disimpan agar dapat dibuka tanpa jaringan |
| **PWA** | Aplikasi web yang dapat dipasang seperti aplikasi biasa |

### 18.2 Nilai tetap

| Tetapan | Nilai |
| --- | --- |
| Jumlah pos | 3 |
| Batas nilai Review | 0–20 |
| Panjang catatan maksimal | 500 huruf |
| Maksimal entri per kiriman | 200 |
| Jadwal pengiriman berkala | 60 detik |
| Jeda percobaan ulang | 2s → 64s, batas 5 menit |
| Batas waktu permintaan | 12 detik (REST), 30 detik (Apps Script) |
| Selang penyusunan rekap | 5 menit |
| Jam penyusunan menyeluruh | 23.00 |
| Batas penyimpanan lokal | 10 MB |
| Selang pencadangan lokal | 5 menit |
| Ukuran app shell maksimal | 5 MB |

### 18.3 Riwayat dokumen

| Versi | Perubahan |
| --- | --- |
| 1.0 | PRD awal: §4 fungsional, §5 keamanan, §7 model data, §8 sinkronisasi, §9 pengujian, §10 risiko, AC-1…AC-8 |
| 2.0 | Kriteria Review menggantikan Etika; §11 rekap bulanan; §12 kontrak API; §16 keputusan desain; AC-9…AC-20; risiko R-2, R-4, R-6…R-13 ditambahkan setelah ditemukan di lapangan |
