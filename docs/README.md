# Dokumentasi Aplikasi Penilaian Guide Kawasan Besakih

**Mulai dari sini.** Halaman ini menerangkan berkas mana yang harus dibuka
untuk keperluan apa.

---

## Saya ingin…

| Keperluan | Buka berkas ini |
| --- | --- |
| **Memakai aplikasinya** — memasang di HP, menilai guide, melihat hasil | [`PANDUAN-PEMAKAIAN.md`](PANDUAN-PEMAKAIAN.md) |
| **Membaca hasil di spreadsheet** — arti tiap tab dan tiap angka | [`PANDUAN-PEMAKAIAN.md`](PANDUAN-PEMAKAIAN.md) bagian 7 |
| **Menangani gangguan** — hasil tidak muncul, data rusak, server tak terhubung | [`PANDUAN-PEMAKAIAN.md`](PANDUAN-PEMAKAIAN.md) bagian 9 |
| **Memahami cara kerja aplikasi** — 13 diagram alur | [`ALUR-APLIKASI.md`](ALUR-APLIKASI.md) |
| **Membangun ulang dari nol** — spesifikasi lengkap | [`PRD-APLIKASI.md`](PRD-APLIKASI.md) |
| **Menjalankan & men-deploy** | [`../README.md`](../README.md) |

---

## Isi folder ini

Tiap dokumen punya **dua bentuk dengan isi yang sama persis**: Markdown untuk
dibaca di GitHub atau editor, dan PDF untuk dicetak atau dikirim lewat WhatsApp.

| Markdown | PDF | Untuk siapa |
| --- | --- | --- |
| [`PANDUAN-PEMAKAIAN.md`](PANDUAN-PEMAKAIAN.md) | `Panduan-Pemakaian-Aplikasi-Penilaian-Guide.pdf` | **Staff & admin** |
| [`ALUR-APLIKASI.md`](ALUR-APLIKASI.md) | `Alur-Aplikasi-Penilaian-Guide.pdf` | Pengembang |
| [`PRD-APLIKASI.md`](PRD-APLIKASI.md) | `PRD-Aplikasi-Penilaian-Guide.pdf` | Pengembang |

**Yang boleh diedit hanya berkas Markdown-nya.** PDF adalah hasil olahan yang
akan tertimpa. Untuk membangun ulang seluruh PDF setelah Markdown diubah:

```bash
npm run docs:pdf
```

Perinciannya ada di [`buat-pdf.mjs`](buat-pdf.mjs).

---

## Arsip

| Berkas | Keterangan |
| --- | --- |
| [`RENCANA-BACKEND-GOOGLE-SHEETS.md`](RENCANA-BACKEND-GOOGLE-SHEETS.md) | ⚠️ **Rancangan awal, sudah tidak sesuai kode.** Disimpan hanya sebagai catatan kenapa spreadsheet dipilih jadi backend. Jangan dipakai sebagai acuan — lihat penanda di bagian atas berkasnya. |

Dua berkas berikut **sudah dihapus** karena isinya bertentangan dengan
dokumentasi sekarang; masih bisa dipulihkan dari riwayat git bila diperlukan:

- `Panduan-Aplikasi-Penilaian-Guide-Besakih.pdf` — panduan lama, digantikan
  `Panduan-Pemakaian-Aplikasi-Penilaian-Guide.pdf`
- `buat-panduan-pdf.py` — pembuat PDF lama berbasis Python/reportlab,
  digantikan `buat-pdf.mjs`
