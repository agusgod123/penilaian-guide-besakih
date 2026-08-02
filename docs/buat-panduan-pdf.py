#!/usr/bin/env python3
"""
Membangun "Panduan Lengkap Aplikasi Penilaian Guide Kawasan Besakih" (PDF).

    python3 docs/buat-panduan-pdf.py

Dijalankan dari folder app/. Hasil: docs/Panduan-Aplikasi-Penilaian-Guide-Besakih.pdf
"""
import json
import os
from datetime import date

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (BaseDocTemplate, Frame, Image, KeepTogether,
                               ListFlowable, ListItem, NextPageTemplate,
                               PageBreak, PageTemplate, Paragraph, Spacer,
                               Table, TableStyle)

# ----------------------------------------------------------------- warna
HIJAU = colors.HexColor('#0B5D3B')
HIJAU_MUDA = colors.HexColor('#E7F3EC')
EMAS = colors.HexColor('#C8942B')
KRIM = colors.HexColor('#FFF6E0')
ABU = colors.HexColor('#5C6360')
GARIS = colors.HexColor('#D6DBD8')
MERAH = colors.HexColor('#B3261E')

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KELUARAN = os.path.join(BASE, 'docs', 'Panduan-Aplikasi-Penilaian-Guide-Besakih.pdf')
IKON = os.path.join(BASE, 'public', 'icons', 'icon-512.png')

URL_APP = 'https://agusgod123.github.io/penilaian-guide-besakih/'
URL_REPO = 'https://github.com/agusgod123/penilaian-guide-besakih'

with open(os.path.join(BASE, 'server', 'guides.json'), encoding='utf-8') as f:
    GUIDES = json.load(f)

# ----------------------------------------------------------------- gaya
ss = getSampleStyleSheet()


def gaya(nama, **kw):
    dasar = dict(fontName='Helvetica', fontSize=10.5, leading=15.5,
                 textColor=colors.HexColor('#12211A'), spaceAfter=6)
    dasar.update(kw)
    return ParagraphStyle(nama, **dasar)


S = {
    'judul': gaya('judul', fontName='Helvetica-Bold', fontSize=26, leading=31,
                  textColor=HIJAU, alignment=TA_CENTER, spaceAfter=10),
    'subjudul': gaya('subjudul', fontSize=13, leading=19, textColor=ABU,
                     alignment=TA_CENTER, spaceAfter=4),
    'h1': gaya('h1', fontName='Helvetica-Bold', fontSize=17, leading=22,
               textColor=HIJAU, spaceBefore=6, spaceAfter=9),
    'h2': gaya('h2', fontName='Helvetica-Bold', fontSize=12.5, leading=17,
               textColor=HIJAU, spaceBefore=12, spaceAfter=5),
    'h3': gaya('h3', fontName='Helvetica-Bold', fontSize=11, leading=15,
               spaceBefore=9, spaceAfter=3),
    'p': gaya('p', alignment=TA_JUSTIFY),
    'kecil': gaya('kecil', fontSize=9, leading=13, textColor=ABU),
    'kode': gaya('kode', fontName='Courier', fontSize=8.6, leading=12.5,
                 textColor=colors.HexColor('#084229')),
    'sel': gaya('sel', fontSize=9.5, leading=13.5, spaceAfter=0),
    'selJudul': gaya('selJudul', fontName='Helvetica-Bold', fontSize=9.5,
                     leading=13.5, textColor=colors.white, spaceAfter=0),
    'daftarIsi': gaya('daftarIsi', fontSize=11, leading=19),
}


def P(t, s='p'):
    return Paragraph(t, S[s])


def kotak(judul, isi, warna=KRIM, garis=EMAS):
    """Kotak sorotan untuk catatan penting."""
    dalam = [Paragraph(f'<b>{judul}</b>', S['sel'])]
    for baris in isi:
        dalam.append(Spacer(1, 3))
        dalam.append(Paragraph(baris, S['sel']))
    t = Table([[dalam]], colWidths=[165 * mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), warna),
        ('BOX', (0, 0), (-1, -1), 1.1, garis),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    return KeepTogether([Spacer(1, 4), t, Spacer(1, 8)])


def tabel(data, lebar, rata=None):
    isi = [[Paragraph(str(c), S['selJudul']) for c in data[0]]]
    for baris in data[1:]:
        isi.append([Paragraph(str(c), S['sel']) for c in baris])
    t = Table(isi, colWidths=lebar, repeatRows=1)
    st = [
        ('BACKGROUND', (0, 0), (-1, 0), HIJAU),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, HIJAU_MUDA]),
        ('GRID', (0, 0), (-1, -1), 0.5, GARIS),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]
    if rata:
        for kol, a in rata.items():
            st.append(('ALIGN', (kol, 0), (kol, -1), a))
    t.setStyle(TableStyle(st))
    return t


def langkah(items):
    return ListFlowable(
        [ListItem(P(t), leftIndent=16, value=i + 1) for i, t in enumerate(items)],
        bulletType='1', bulletFontName='Helvetica-Bold', bulletFontSize=10.5,
        leftIndent=16, bulletDedent=14, spaceAfter=8)


def poin(items):
    return ListFlowable(
        [ListItem(P(t), leftIndent=14) for t in items],
        bulletType='bullet', bulletChar='•', leftIndent=14,
        bulletDedent=10, spaceAfter=8)


# ----------------------------------------------------------------- halaman
def hias(canvas, doc):
    canvas.saveState()
    # garis kepala
    canvas.setStrokeColor(GARIS)
    canvas.setLineWidth(0.6)
    canvas.line(22 * mm, 283 * mm, 188 * mm, 283 * mm)
    canvas.setFont('Helvetica', 8)
    canvas.setFillColor(ABU)
    canvas.drawString(22 * mm, 286 * mm, 'Panduan Aplikasi Penilaian Guide Kawasan Besakih')
    # kaki
    canvas.line(22 * mm, 16 * mm, 188 * mm, 16 * mm)
    canvas.drawString(22 * mm, 11 * mm, f'Versi 1.1  ·  {date.today().strftime("%d %B %Y")}')
    canvas.drawRightString(188 * mm, 11 * mm, f'Halaman {doc.page - 1}')
    canvas.restoreState()


def sampul(canvas, doc):
    """Seluruh kepala sampul digambar langsung agar tidak meluber ke halaman kedua."""
    canvas.saveState()
    canvas.setFillColor(HIJAU)
    canvas.rect(0, 192 * mm, 210 * mm, 105 * mm, stroke=0, fill=1)
    canvas.setFillColor(EMAS)
    canvas.rect(0, 188 * mm, 210 * mm, 4 * mm, stroke=0, fill=1)

    if os.path.exists(IKON):
        canvas.drawImage(IKON, 89 * mm, 246 * mm, width=32 * mm, height=32 * mm,
                         mask='auto')

    canvas.setFillColor(colors.white)
    canvas.setFont('Helvetica-Bold', 25)
    canvas.drawCentredString(105 * mm, 230 * mm, 'Aplikasi Penilaian Guide')
    canvas.drawCentredString(105 * mm, 219 * mm, 'Kawasan Besakih')

    canvas.setFont('Helvetica', 12)
    canvas.setFillColor(colors.HexColor('#BFE0CD'))
    canvas.drawCentredString(105 * mm, 206 * mm,
                             'Panduan Lengkap: dari Persiapan sampai Export Data')

    canvas.setFont('Helvetica', 9)
    canvas.setFillColor(ABU)
    canvas.drawCentredString(105 * mm, 18 * mm,
                             'Dokumen internal · Pengelolaan Kunjungan Kawasan Besakih')
    canvas.drawCentredString(105 * mm, 12 * mm,
                             f'Disusun {date.today().strftime("%d %B %Y")}  ·  Versi 1.1')
    canvas.restoreState()


doc = BaseDocTemplate(KELUARAN, pagesize=A4,
                      leftMargin=22 * mm, rightMargin=22 * mm,
                      topMargin=24 * mm, bottomMargin=22 * mm,
                      title='Panduan Aplikasi Penilaian Guide Kawasan Besakih',
                      author='Pengelolaan Kunjungan Kawasan Besakih')

bingkai = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id='n')
# Bingkai sampul dimulai di bawah pita hijau (188 mm) dan berhenti di atas catatan kaki
bingkaiSampul = Frame(doc.leftMargin, 26 * mm, doc.width, 155 * mm, id='c')
doc.addPageTemplates([
    PageTemplate(id='sampul', frames=[bingkaiSampul], onPage=sampul),
    PageTemplate(id='isi', frames=[bingkai], onPage=hias),
])

C = []  # cerita

# ================================================================ SAMPUL
C.append(Spacer(1, 14))
ringkas = [
    ['Jenis aplikasi', 'Progressive Web App (PWA) — dipasang di layar depan HP/tablet'],
    ['Untuk siapa', 'Staff lapangan di 3 pos pemeriksaan'],
    ['Yang dinilai', 'Uniform &amp; ID-Card (Ya/Tidak &#8594; 1/0), Review (angka)'],
    ['Jumlah guide', f'{len(GUIDES)} orang (Asing &amp; Domestik, 4 regu)'],
    ['Basis data', 'Google Spreadsheet'],
    ['Tanpa sinyal', 'Tetap bisa menilai — terkirim otomatis saat online'],
    ['Login', 'Tidak perlu'],
    ['Biaya', 'Gratis'],
]
C.append(tabel([['Hal', 'Keterangan']] + ringkas, [42 * mm, 124 * mm]))
C.append(Spacer(1, 12))
C.append(kotak('Ringkasan satu paragraf', [
    'Staff di pos memilih nama guide lalu menekan Ya/Tidak untuk Uniform dan ID-Card, '
    'serta mengisi jumlah Review. Penilaian tersimpan di HP walau tanpa sinyal, lalu '
    'terkirim sendiri ke Google Spreadsheet begitu ada koneksi. Tab rekap bulanan '
    'berformat NILAI REWARD tersusun otomatis setiap malam.',
], warna=HIJAU_MUDA, garis=HIJAU))
C.append(NextPageTemplate('isi'))
C.append(PageBreak())

# ================================================================ DAFTAR ISI
C.append(P('Daftar Isi', 'h1'))
isi_daftar = [
    '1. Untuk apa aplikasi ini',
    '2. Gambaran sistem',
    '3. Data guide',
    '4. Persiapan awal (sekali saja)',
    '5. Memasang aplikasi di HP staff',
    '6. Pemakaian harian oleh staff',
    '7. Cara kerja tanpa sinyal',
    '8. Melihat dan mengekspor data',
    '9. Perawatan rutin',
    '10. Keamanan dan batasannya',
    '11. Kalau ada masalah',
    '12. Lampiran: alamat penting &amp; hasil pengujian',
]
for baris in isi_daftar:
    C.append(Paragraph(baris, S['daftarIsi']))
C.append(Spacer(1, 10))
C.append(kotak('Cara membaca dokumen ini', [
    'Bagian <b>4 dan 5</b> hanya dikerjakan sekali oleh pengelola.',
    'Bagian <b>6</b> adalah yang dipakai staff setiap hari — cukup satu halaman, '
    'bisa dicetak dan ditempel di pos.',
    'Bagian <b>8</b> untuk pembuatan laporan.',
]))
C.append(PageBreak())

# ================================================================ 1
C.append(P('1. Untuk apa aplikasi ini', 'h1'))
C.append(P(
    'Selama ini penilaian kinerja guide dicatat di formulir kertas per regu. '
    'Cara itu menyulitkan rekapitulasi: lembarnya terpisah-pisah, tulisan tangan harus '
    'disalin ulang, dan hasilnya baru diketahui jauh setelah kejadian.'))
C.append(P(
    'Aplikasi ini menggantikan formulir tersebut. Staff di pos cukup memilih nama guide '
    'lalu menekan Ya atau Tidak untuk <b>Uniform</b> dan <b>ID-Card</b>, kemudian '
    'mengisi jumlah <b>Review</b> dengan tombol − dan +. Datanya langsung masuk ke '
    'satu spreadsheet pusat, dan tab rekap bulanan tersusun sendiri.'))

C.append(P('Masalah yang secara khusus dipecahkan', 'h2'))
C.append(tabel([
    ['Kendala di lapangan', 'Bagaimana aplikasi mengatasinya'],
    ['Sinyal lemah atau hilang di area pura',
     'Penilaian disimpan di HP dan dikirim sendiri begitu sinyal kembali. '
     'Staff tidak perlu menunggu atau mengulang.'],
    ['Staff kurang terbiasa dengan aplikasi',
     'Tanpa login, tombol besar, teks besar, seluruhnya bahasa Indonesia, '
     'dan ada panduan singkat saat pertama dibuka.'],
    ['Rekap manual memakan waktu',
     'Data langsung berbentuk tabel spreadsheet — tinggal dibuat PivotTable atau grafik.'],
    ['Guide banyak (296 orang)',
     'Staff memilih Kategori dan Regu dulu, sehingga daftar menyusut menjadi puluhan nama.'],
], [55 * mm, 111 * mm]))

C.append(P('Yang TIDAK dikerjakan aplikasi ini', 'h2'))
C.append(poin([
    'Tidak menghitung skor atau peringkat guide — hanya mencatat Ya/Tidak.',
    'Tidak mengirim notifikasi atau teguran ke guide.',
    'Tidak menggantikan poin pengantaran yang ada di formulir lama.',
]))
C.append(PageBreak())

# ================================================================ 2
C.append(P('2. Gambaran sistem', 'h1'))
C.append(P('Ada tiga bagian yang saling terhubung:'))

C.append(tabel([
    ['Bagian', 'Wujudnya', 'Fungsinya'],
    ['Aplikasi', 'Ikon di layar depan HP/tablet staff',
     'Tempat staff mengisi penilaian. Menyimpan data di HP dan mengirimkannya.'],
    ['Perantara', 'Google Apps Script',
     'Menerima kiriman dari HP lalu menuliskannya sebagai baris baru di spreadsheet.'],
    ['Basis data', 'Google Spreadsheet',
     'Menyimpan daftar guide dan seluruh hasil penilaian. Sumber untuk laporan.'],
], [26 * mm, 46 * mm, 94 * mm]))

C.append(Spacer(1, 8))
alur = Table([
    [Paragraph('<b>HP Staff</b><br/><font size=8 color="#5C6360">isi penilaian<br/>simpan di perangkat</font>', S['sel']),
     Paragraph('<font size=15 color="#0B5D3B"><b>→</b></font>', S['sel']),
     Paragraph('<b>Apps Script</b><br/><font size=8 color="#5C6360">terima &amp; validasi<br/>tulis ke sheet</font>', S['sel']),
     Paragraph('<font size=15 color="#0B5D3B"><b>→</b></font>', S['sel']),
     Paragraph('<b>Spreadsheet</b><br/><font size=8 color="#5C6360">tab Evaluations<br/>bahan laporan</font>', S['sel'])],
], colWidths=[45 * mm, 15 * mm, 46 * mm, 15 * mm, 45 * mm])
alur.setStyle(TableStyle([
    ('BOX', (0, 0), (0, 0), 1, HIJAU), ('BACKGROUND', (0, 0), (0, 0), HIJAU_MUDA),
    ('BOX', (2, 0), (2, 0), 1, HIJAU), ('BACKGROUND', (2, 0), (2, 0), HIJAU_MUDA),
    ('BOX', (4, 0), (4, 0), 1, HIJAU), ('BACKGROUND', (4, 0), (4, 0), HIJAU_MUDA),
    ('ALIGN', (0, 0), (-1, -1), 'CENTER'), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('TOPPADDING', (0, 0), (-1, -1), 9), ('BOTTOMPADDING', (0, 0), (-1, -1), 9),
]))
C.append(alur)
C.append(Spacer(1, 10))

C.append(kotak('Kenapa Google Spreadsheet, bukan server biasa', [
    'Gratis selamanya dan datanya tidak hilang saat sistem restart.',
    'Rekapnya sudah berbentuk spreadsheet — tidak perlu export dulu untuk membuat laporan.',
    'Tidak ada server yang perlu dirawat, dibayar, atau dijaga tetap menyala.',
    'Kekurangannya: responsnya 1–3 detik (bukan seketika). Ini tidak mengganggu karena '
    'pengiriman berjalan di latar belakang — staff tidak menunggu.',
]))

C.append(P('Di mana aplikasinya berada', 'h2'))
C.append(P(
    'Aplikasi disimpan di GitHub Pages dan diakses lewat alamat berikut. Alamat ini '
    'yang dibuka staff satu kali untuk memasangnya:'))
C.append(Paragraph(URL_APP, S['kode']))
C.append(Spacer(1, 4))
C.append(P(
    'Seluruh kode program tersimpan di GitHub sehingga bisa ditelusuri atau '
    'dikembangkan lagi di kemudian hari:', 'kecil'))
C.append(Paragraph(URL_REPO, S['kode']))
C.append(PageBreak())

# ================================================================ 3
C.append(P('3. Data guide', 'h1'))
C.append(P(
    f'Daftar guide diambil dari dua formulir register yang ada: <i>ASING BENCINGAH</i> '
    f'dan <i>DOMESTIK Becingah</i>. Dari 314 baris nama pada kedua berkas, setelah nama '
    f'ganda digabungkan tersisa <b>{len(GUIDES)} guide unik</b>.'))

from collections import Counter
hitung = Counter()
for g in GUIDES:
    for k in g['regu'].split(','):
        hitung[k.strip()] += 1
rangkap = [g for g in GUIDES if ',' in g['regu']]

C.append(tabel([
    ['Kategori', 'Regu', 'Jumlah guide'],
    ['Asing', 'Regu 1', str(hitung['A1'])],
    ['Asing', 'Regu 2', str(hitung['A2'])],
    ['Domestik', 'Regu 1', str(hitung['D1'])],
    ['Domestik', 'Regu 2', str(hitung['D2'])],
    ['<b>Total nama unik</b>', '', f'<b>{len(GUIDES)}</b>'],
], [45 * mm, 45 * mm, 76 * mm], rata={2: 'CENTER'}))

C.append(Spacer(1, 8))
C.append(P(
    f'Penjumlahan per regu melebihi {len(GUIDES)} karena <b>{len(rangkap)} guide '
    f'terdaftar di lebih dari satu regu</b>. Mereka disimpan sebagai satu entri saja, '
    f'dengan kolom regu berisi beberapa kode sekaligus, dan tetap muncul di setiap regu '
    f'ketika staff memfilter.'))

C.append(P('Contoh guide yang merangkap regu', 'h3'))
contoh = [['Nama', 'Kategori', 'Regu']]
for g in rangkap[:6]:
    contoh.append([g['guideName'], g['kategori'], g['regu']])
C.append(tabel(contoh, [70 * mm, 46 * mm, 50 * mm]))

C.append(P('Kolom pada tab Guides', 'h2'))
C.append(tabel([
    ['Kolom', 'Isi', 'Contoh'],
    ['guideId', 'Nomor unik, dibuat otomatis', 'G-001'],
    ['guideName', 'Nama guide', 'I Wayan Suparta'],
    ['kategori', 'Asing, Domestik, atau keduanya', 'Asing, Domestik'],
    ['regu', 'Kode regu. A = Asing, D = Domestik', 'A2, D2'],
    ['aktif', 'TRUE = muncul di aplikasi. FALSE = disembunyikan', 'TRUE'],
], [30 * mm, 88 * mm, 48 * mm]))

C.append(kotak('Yang berubah dari formulir lama', [
    'Kolom <b>lisensi</b> ditiadakan karena tidak ada datanya pada berkas sumber. '
    'Sebagai gantinya ada <b>kategori</b> dan <b>regu</b> yang lebih berguna untuk '
    'menyaring nama.',
    'Penulisan nama dirapikan: huruf kapital yang tidak konsisten diperbaiki '
    '(mis. "I NENGAH SUDARTA" menjadi "I Nengah Sudarta") dan spasi ganda dihapus.',
    'Dua nama yang tercatat dobel di regu yang sama digabung menjadi satu.',
]))
C.append(PageBreak())

# ================================================================ 4
C.append(P('4. Persiapan awal (sekali saja)', 'h1'))
C.append(P(
    'Bagian ini sudah selesai dikerjakan. Isinya dicatat agar sistem bisa dibangun '
    'ulang bila suatu saat diperlukan — misalnya ketika berpindah akun Google.'))

C.append(P('A. Menyiapkan spreadsheet sebagai basis data', 'h2'))
C.append(langkah([
    'Buat spreadsheet baru di Google Drive.',
    'Buka menu <b>Extensions</b> (Ekstensi) → <b>Apps Script</b>.',
    'Hapus isi bawaannya, tempel seluruh isi berkas <font face="Courier" size="9">'
    'server-gas/Code.gs</font> dari repositori, lalu simpan.',
    'Pilih fungsi <b>setup</b> pada kotak di sebelah tombol Run, lalu tekan <b>Run</b>. '
    'Setujui izin akses yang diminta Google.',
    f'Tab <b>Guides</b> (berisi {len(GUIDES)} guide), <b>Evaluations</b>, dan '
    '<b>Petunjuk</b> akan terbentuk otomatis.',
]))

C.append(P('B. Menjadikannya dapat dihubungi aplikasi', 'h2'))
C.append(langkah([
    'Masih di Apps Script: <b>Deploy</b> → <b>New deployment</b>.',
    'Pilih jenis <b>Web app</b>.',
    '<b>Execute as</b>: Me. <b>Who has access</b>: Anyone.',
    'Tekan Deploy, setujui izin, lalu salin URL yang berakhiran '
    '<font face="Courier" size="9">/exec</font>.',
]))

C.append(kotak('Bila script diubah di kemudian hari', [
    'Gunakan <b>Deploy → Manage deployments → Edit (ikon pensil) → '
    'Version: New version</b>.',
    'Jangan memakai <i>New deployment</i>, karena itu menghasilkan URL baru dan '
    'seluruh perangkat staff harus diatur ulang satu per satu.',
]))

C.append(P('C. Menerbitkan aplikasinya', 'h2'))
C.append(P(
    'Aplikasi diterbitkan lewat GitHub Pages dan sudah aktif. Setiap perubahan kode '
    'yang dikirim ke repositori otomatis diterbitkan ulang dalam waktu satu menit, '
    'tanpa langkah manual.'))
C.append(PageBreak())

# ================================================================ 5
C.append(P('5. Memasang aplikasi di HP staff', 'h1'))
C.append(P('Dikerjakan sekali per perangkat, kira-kira dua menit.'))

C.append(P('Android (Chrome)', 'h2'))
C.append(langkah([
    f'Buka alamat <font face="Courier" size="9">{URL_APP}</font> di Chrome.',
    'Tekan menu titik tiga di pojok kanan atas.',
    'Pilih <b>Install app</b> atau <b>Add to Home screen</b>.',
    'Ikonnya kini ada di layar depan dan dibuka seperti aplikasi biasa.',
]))

C.append(P('iPhone / iPad (Safari)', 'h2'))
C.append(langkah([
    'Buka alamat yang sama di <b>Safari</b> (harus Safari, bukan Chrome).',
    'Tekan tombol Share (kotak dengan panah ke atas).',
    'Pilih <b>Add to Home Screen</b>.',
]))

C.append(kotak('Tidak ada pengaturan lain yang perlu diisi', [
    'Alamat server sudah tertanam di dalam aplikasi. Begitu dibuka, daftar '
    f'{len(GUIDES)} guide langsung termuat dan penilaian sudah bisa dikirim.',
    'Perangkat baru cukup: buka alamat → pasang ke layar depan → langsung dipakai.',
], warna=HIJAU_MUDA, garis=HIJAU))

C.append(P('Memeriksa perangkat sudah benar', 'h2'))
C.append(langkah([
    'Buka aplikasi, tekan menu → <b>Daftar Guide</b>. Seharusnya tertulis '
    f'"{len(GUIDES)} dari {len(GUIDES)} guide".',
    'Bila tertulis "0 dari 0 guide", perangkat belum pernah tersambung internet '
    'sejak dipasang — sambungkan ke Wi-Fi lalu buka ulang aplikasinya.',
]))

C.append(P('Bila alamat server berubah', 'h2'))
C.append(P(
    'Alamat hanya berubah bila deployment Apps Script dibuat ulang. Bila itu terjadi, '
    'pengelola cukup memperbarui satu berkas '
    '(<font face="Courier" size="9">public/config.js</font>) dan seluruh perangkat '
    'ikut terbarui sendiri. Sebagai jalan darurat, alamat juga masih bisa ditimpa '
    'manual lewat menu <b>Pengaturan → Alamat Server</b> di masing-masing perangkat.'))
C.append(PageBreak())

# ================================================================ 6
C.append(P('6. Pemakaian harian oleh staff', 'h1'))
C.append(P('Halaman ini bisa dicetak dan ditempel di pos.', 'kecil'))
C.append(Spacer(1, 4))

C.append(P('Sekali di awal shift', 'h2'))
C.append(P(
    'Buka aplikasi, pastikan <b>Pos Pemeriksaan</b> di halaman depan sudah sesuai '
    '(Pos 1, 2, atau 3). Pilihan ini diingat sampai diubah, jadi tidak perlu diatur '
    'setiap kali menilai.'))

C.append(P('Setiap kali menilai seorang guide', 'h2'))
C.append(langkah([
    'Tekan tombol hijau besar <b>Penilaian Baru</b>.',
    'Pilih <b>Kategori</b> (Asing / Domestik) dan <b>Regu</b>. Daftar nama akan menyusut '
    'sehingga lebih cepat dicari. Pilihan ini juga diingat untuk penilaian berikutnya.',
    'Ketik beberapa huruf nama guide, lalu pilih dari daftar yang muncul. '
    'Nama yang terpilih ditampilkan dengan tanda centang beserta regunya — '
    'pastikan sudah benar.',
    'Tekan <b>Ya</b> atau <b>Tidak</b> untuk <b>Uniform</b> dan <b>ID-Card</b> '
    '(keduanya wajib diisi).',
    'Isi <b>Review</b> dengan tombol − dan +. Biarkan 0 bila guide tidak mendapat '
    'review pada hari itu.',
    'Isi <b>Catatan</b> bila perlu (boleh dikosongkan).',
    'Tekan <b>SIMPAN PENILAIAN</b>. Muncul pesan "Penilaian tersimpan" dan '
    'formulir siap untuk guide berikutnya.',
]))

C.append(kotak('Arti tanda di layar', [
    '<b>Online</b> (pojok kanan atas) — ada sinyal, data langsung terkirim.',
    '<b>Offline</b> — tidak ada sinyal. <b>Tetap lanjutkan menilai seperti biasa</b>; '
    'datanya aman tersimpan di HP.',
    '<b>Jam pasir</b> pada Riwayat — penilaian masih menunggu giliran dikirim.',
    '<b>Centang</b> pada Riwayat — sudah tersimpan di spreadsheet pusat.',
], warna=HIJAU_MUDA, garis=HIJAU))

C.append(P('Yang tidak boleh dilakukan', 'h2'))
C.append(poin([
    'Jangan menghapus (uninstall) aplikasi selama masih ada penilaian bertanda jam pasir '
    '— data yang belum terkirim akan ikut hilang.',
    'Jangan menyalakan <b>Mode Offline Paksa</b> di Pengaturan kecuali diminta pengelola. '
    'Mode itu menahan pengiriman meski ada sinyal.',
]))

C.append(P('Bila akhir shift masih ada tanda jam pasir', 'h2'))
C.append(P(
    'Cari lokasi bersinyal, buka aplikasi, lalu tekan <b>Kirim Sekarang</b> di halaman '
    'depan. Tunggu sampai semuanya bertanda centang sebelum menutup aplikasi.'))
C.append(PageBreak())

# ================================================================ 7
C.append(P('7. Cara kerja tanpa sinyal', 'h1'))
C.append(P(
    'Ini bagian terpenting untuk kondisi lapangan di Besakih. Penjelasan berikut '
    'membantu memahami mengapa data tidak akan hilang.'))

C.append(tabel([
    ['Tahap', 'Yang terjadi'],
    ['Saat disimpan',
     'Penilaian ditulis ke penyimpanan internal HP dan ditandai "menunggu kirim". '
     'Proses ini tidak memerlukan sinyal sama sekali.'],
    ['Saat ada sinyal',
     'Aplikasi mengirim antrean satu per satu. Setiap kiriman baru ditandai berhasil '
     'apabila server benar-benar membalas dengan nomor penilaian yang sama — '
     'bukan sekadar karena kiriman terkirim.'],
    ['Bila pengiriman gagal',
     'Dicoba lagi otomatis dengan jeda yang makin lama: 2 detik, 4, 8, 16, sampai '
     'maksimal 5 menit. Data tetap tersimpan selama proses ini.'],
    ['Bila dikirim dua kali',
     'Tidak menjadi baris ganda. Setiap penilaian punya nomor unik dan server '
     'mengabaikan nomor yang sudah pernah masuk.'],
    ['Cadangan',
     'Seluruh data disalin ke penyimpanan cadangan di HP setiap 5 menit. Bila '
     'penyimpanan utama rusak, data dipulihkan otomatis saat aplikasi dibuka.'],
], [34 * mm, 132 * mm]))

C.append(P('Kapan pengiriman dicoba', 'h2'))
C.append(poin([
    'Segera setelah sebuah penilaian disimpan (bila ada sinyal).',
    'Saat HP kembali mendapat sinyal.',
    'Setiap kali aplikasi dibuka kembali.',
    'Otomatis setiap satu menit selama aplikasi terbuka.',
    'Saat tombol <b>Kirim Sekarang</b> ditekan.',
]))

C.append(kotak('Sudah diuji sungguhan', [
    'Skenario berikut dijalankan pada aplikasi yang sudah terbit: satu penilaian dibuat '
    'saat sinyal dimatikan, lalu sinyal dinyalakan kembali. Data terkirim sendiri '
    '<b>15 detik</b> kemudian tanpa disentuh, dan barisnya muncul di spreadsheet.',
], warna=HIJAU_MUDA, garis=HIJAU))
C.append(PageBreak())

# ================================================================ 8
C.append(P('8. Melihat dan mengekspor data', 'h1'))
C.append(P('Ada empat cara, dipilih sesuai kebutuhan.'))

C.append(P('A. Langsung di spreadsheet — untuk laporan rutin', 'h2'))
C.append(P(
    'Buka spreadsheet <b>Penilaian Guide Besakih — Basis Data</b>, masuk ke tab '
    '<b>Evaluations</b>. Setiap baris adalah satu penilaian dengan kolom berikut:'))
C.append(tabel([
    ['Kolom', 'Isi'],
    ['evaluationId', 'Nomor unik penilaian'],
    ['timestamp', 'Waktu penilaian dibuat di lapangan'],
    ['pos', 'Pos pemeriksaan: 1, 2, atau 3'],
    ['guideId / guideName', 'Guide yang dinilai'],
    ['uniform / idCard', '1 = sesuai, 0 = tidak sesuai'],
    ['review', 'Jumlah review (angka, 0 bila tidak ada)'],
    ['catatan', 'Catatan tambahan dari staff'],
    ['receivedAt', 'Waktu data diterima server (bisa jauh setelah timestamp bila offline)'],
], [46 * mm, 120 * mm]))

C.append(P('Membuat rekap dengan PivotTable', 'h3'))
C.append(langkah([
    'Blok seluruh data di tab Evaluations.',
    'Menu <b>Insert</b> → <b>Pivot table</b> → <b>Create</b>.',
    'Contoh susunan: <b>Rows</b> = guideName, <b>Columns</b> = pos, '
    '<b>Values</b> = idCard (COUNTA atau COUNTIF).',
    'Untuk laporan bulanan, tambahkan filter pada kolom timestamp.',
]))

C.append(P('B. Tab rekap bulanan otomatis (format NILAI REWARD)', 'h2'))
C.append(P(
    'Spreadsheet menyusun sendiri tab rekap yang bentuknya sama persis dengan berkas '
    '<b>NILAI REWARD</b> yang selama ini dibuat manual. Tidak ada yang perlu diketik ulang.'))
C.append(tabel([
    ['Nama tab', 'Isinya'],
    ['Rekap A1 YYYY-MM', 'Seluruh guide Asing Regu 1'],
    ['Rekap A2 YYYY-MM', 'Seluruh guide Asing Regu 2'],
    ['Rekap D1 YYYY-MM', 'Seluruh guide Domestik Regu 1'],
    ['Rekap D2 YYYY-MM', 'Seluruh guide Domestik Regu 2'],
    ['Rekap per Pos YYYY-MM', 'Rincian capaian tiap guide dipisah per pos pemeriksaan'],
], [46 * mm, 120 * mm]))
C.append(P(
    'Susunan tiap tab: baris = nama guide, kolom = tanggal. Setiap tanggal punya tiga '
    'kolom kecil <b>UNI FORM</b>, <b>ID</b>, dan <b>REVIEW</b>. Di paling kanan ada blok '
    '<b>TOTAL</b> yang berisi rumus <font face="Courier">=SUM(...)</font> — jadi totalnya '
    'ikut berubah sendiri bila ada koreksi manual. Kolom nama dibekukan supaya tetap '
    'terlihat saat digeser ke kanan.'))
C.append(P('Kapan tab ini diperbarui', 'h3'))
C.append(langkah([
    '<b>Otomatis</b> setiap malam sekitar pukul 23.00.',
    '<b>Manual kapan saja</b>: menu <b>Penilaian Guide</b> → '
    '<b>Perbarui Rekap Bulan Ini</b> (atau <b>Bulan Lalu</b>).',
]))
C.append(kotak('Bila satu guide dinilai di lebih dari satu pos pada hari yang sama', [
    '<b>Uniform</b> dan <b>ID</b> diambil nilai yang <b>paling buruk</b> — '
    'sekali tidak sesuai tetap tercatat 0.',
    '<b>Review</b> diambil angka <b>tertinggi</b>, supaya review yang tercatat di '
    'salah satu pos tidak hilang.',
    'Rincian per pos tetap bisa dilihat di tab <b>Rekap per Pos</b>.',
], warna=HIJAU_MUDA, garis=HIJAU))
C.append(P(
    'Bulan baru membuat set tab baru sendiri, jadi rekap bulan-bulan sebelumnya '
    'tidak tertimpa.'))

C.append(P('C. Unduh CSV dari spreadsheet', 'h2'))
C.append(P(
    'Menu <b>File</b> → <b>Download</b> → <b>Comma-separated values (.csv)</b>. '
    'Berkasnya bisa dibuka di Excel. Pastikan tab Evaluations sedang aktif, karena '
    'Google mengunduh tab yang sedang terbuka saja.'))

C.append(P('D. Export CSV dari HP staff', 'h2'))
C.append(P(
    'Di aplikasi: menu → <b>Riwayat</b> → tombol <b>Export CSV</b>. '
    'Berisi penilaian yang tersimpan di perangkat itu saja, termasuk yang belum terkirim. '
    'Berguna ketika perlu bukti dari satu pos tertentu, atau saat perangkat bermasalah.'))

C.append(P('E. Cadangan JSON', 'h2'))
C.append(P(
    'Di aplikasi: menu → <b>Pengaturan</b> → <b>Export Cadangan JSON</b>. '
    'Berisi seluruh data mentah di perangkat. Format ini untuk keperluan teknis, '
    'bukan untuk laporan.'))

C.append(kotak('Mana yang dipakai untuk laporan resmi', [
    'Gunakan <b>spreadsheet</b> (cara A atau B). Isinya lengkap dari ketiga pos.',
    'Export dari HP (cara C dan D) hanya berisi data perangkat tersebut — '
    'jangan dipakai sebagai rekap keseluruhan.',
]))
C.append(PageBreak())

# ================================================================ 9
C.append(P('9. Perawatan rutin', 'h1'))

C.append(P('Menambah guide baru', 'h2'))
C.append(P(
    'Buka tab <b>Guides</b>, tambahkan satu baris di bawah baris terakhir. Isi kolom '
    'guideId dengan nomor lanjutan (mis. G-297), lalu nama, kategori, regu, dan '
    'TRUE pada kolom aktif. Tidak perlu mengubah kode apa pun.'))
C.append(P(
    'Guide baru akan muncul di HP staff setelah aplikasi dibuka ulang dalam kondisi '
    'ada sinyal.', 'kecil'))

C.append(P('Menonaktifkan guide', 'h2'))
C.append(P(
    'Ubah kolom <b>aktif</b> menjadi <b>FALSE</b>. Namanya hilang dari pilihan di '
    'aplikasi, tetapi <b>riwayat penilaiannya tetap utuh</b>. Cara ini lebih baik '
    'daripada menghapus barisnya.'))

C.append(P('Memindahkan guide antar regu', 'h2'))
C.append(P(
    'Ubah isi kolom <b>regu</b>. Untuk guide yang bertugas di dua regu, tulis kodenya '
    'dipisah koma, contoh: <font face="Courier" size="9">A1, D1</font>.'))

C.append(P('Memuat ulang seluruh daftar guide', 'h2'))
C.append(P(
    'Bila tab Guides kacau dan ingin dikembalikan ke daftar awal: buka Apps Script, '
    'pilih fungsi <b>resetGuides</b>, tekan Run. Tab Guides ditulis ulang dari nol, '
    'sementara <b>tab Evaluations tidak tersentuh</b>.'))

C.append(P('Mengubah nama pos pemeriksaan', 'h2'))
C.append(P(
    'Nama pos ("Pos 1 — Pintu Masuk" dan seterusnya) tertulis di dalam kode '
    'aplikasi. Perubahannya perlu dilakukan oleh yang menguasai teknis, pada berkas '
    '<font face="Courier" size="9">public/index.html</font>.'))

C.append(P('Pembaruan aplikasi di HP staff', 'h2'))
C.append(P(
    'Berlangsung otomatis. Ketika versi baru terbit, aplikasi memuat ulang sendiri saat '
    'dibuka dalam kondisi ada sinyal. Staff tidak perlu menghapus dan memasang ulang.'))

C.append(kotak('Pemeriksaan berkala yang disarankan', [
    '<b>Setiap minggu</b> — buka tab Evaluations, pastikan ada data dari ketiga pos. '
    'Pos yang tidak pernah mengirim bisa jadi tanda perangkatnya bermasalah.',
    '<b>Setiap bulan</b> — cocokkan jumlah baris dengan perkiraan jumlah pemeriksaan. '
    'Selisih besar patut ditelusuri.',
    '<b>Setiap semester</b> — perbarui daftar guide sesuai register terbaru.',
]))
C.append(PageBreak())

# ================================================================ 10
C.append(P('10. Keamanan dan batasannya', 'h1'))
C.append(P(
    'Bagian ini ditulis apa adanya supaya keputusan ke depan diambil dengan informasi '
    'yang benar.'))

C.append(P('Yang sudah diamankan', 'h2'))
C.append(poin([
    'Data di HP <b>dienkripsi</b> (AES-256). Isi penilaian tidak terbaca meski '
    'penyimpanan aplikasi dibongkar lewat peramban.',
    'Aplikasi diakses melalui <b>HTTPS</b>.',
    'Data bersifat <b>hanya-tambah</b>: aplikasi tidak pernah mengubah atau menghapus '
    'baris yang sudah masuk ke spreadsheet.',
    'Spreadsheet-nya sendiri terlindungi izin Google Drive — hanya yang diberi '
    'akses yang bisa membukanya.',
]))

C.append(P('Batasan yang perlu disadari', 'h2'))
C.append(tabel([
    ['Batasan', 'Akibatnya', 'Yang bisa dilakukan'],
    ['Alamat server tertanam di kode yang bersifat publik',
     'Pihak yang menemukannya bisa mengirim baris penilaian palsu ke spreadsheet. '
     'Ini konsekuensi yang dipilih agar aplikasi siap pakai tanpa pengaturan manual.',
     'Bila terjadi penyalahgunaan: Apps Script → Manage deployments → arsipkan '
     'deployment lama, buat yang baru, perbarui config.js. Baris palsu dihapus '
     'manual dari spreadsheet.'],
    ['Enkripsi di HP bersifat ringan',
     'Melindungi dari keisengan, bukan dari orang yang benar-benar menguasai perangkat.',
     'Beri kunci layar pada HP dinas.'],
    ['Tidak ada catatan siapa yang menilai',
     'Yang tercatat hanya pos, bukan nama petugas.',
     'Bila perlu, tambahkan kolom petugas di versi berikutnya.'],
    ['Data belum terkirim ada di HP',
     'HP hilang atau rusak sebelum sinkron = data itu hilang.',
     'Biasakan menekan Kirim Sekarang di akhir shift.'],
], [38 * mm, 62 * mm, 66 * mm]))

C.append(P('Batasan teknis Google', 'h2'))
C.append(poin([
    'Waktu proses maksimal 6 menit per permintaan — jauh di atas kebutuhan '
    '(satu kiriman kurang dari 2 detik).',
    'Kuota harian aman untuk ratusan penilaian per hari.',
    'Pengecekan data ganda membaca seluruh kolom nomor penilaian setiap kiriman. '
    'Bila baris melewati sekitar 50.000, arsipkan per tahun ke tab terpisah.',
]))
C.append(PageBreak())

# ================================================================ 11
C.append(P('11. Kalau ada masalah', 'h1'))
C.append(tabel([
    ['Gejala', 'Kemungkinan sebab', 'Yang dilakukan'],
    ['Daftar guide kosong ("0 dari 0 guide")',
     'Perangkat belum pernah terhubung internet sejak aplikasi dipasang, sehingga '
     'daftar guide belum sempat diunduh.',
     'Sambungkan ke Wi-Fi, buka ulang aplikasi. Bila perlu: Pengaturan → '
     'Tes Koneksi Server.'],
    ['Muncul peringatan kuning "Alamat server belum diisi"',
     'Alamat bawaan terhapus atau ditimpa kosong di perangkat itu.',
     'Pengaturan → kosongkan kolom Alamat Server → tutup dan buka ulang aplikasi, '
     'agar kembali memakai alamat bawaan.'],
    ['Tanda jam pasir tidak berubah jadi centang',
     'Tidak ada sinyal, atau Mode Offline Paksa menyala.',
     'Periksa sinyal; pastikan Mode Offline Paksa mati; tekan Kirim Sekarang.'],
    ['Tes Koneksi Server gagal',
     'URL salah, atau deployment Apps Script berubah.',
     'Cocokkan URL dengan yang tercatat di Lampiran. Bila tetap gagal, buat '
     'deployment baru dan perbarui semua perangkat.'],
    ['Nama guide tidak ditemukan',
     'Filter Kategori/Regu terlalu sempit, atau guide berstatus FALSE.',
     'Kosongkan filter menjadi "Semua". Bila tetap tidak ada, periksa tab Guides.'],
    ['Data tidak muncul di spreadsheet',
     'Masih di antrean, atau deployment memakai versi lama.',
     'Periksa Riwayat di HP. Bila sudah centang tapi tidak ada di sheet, '
     'periksa versi deployment Apps Script.'],
    ['Aplikasi terasa versi lama',
     'Berkas lama masih tersimpan di perangkat.',
     'Tutup aplikasi sepenuhnya lalu buka lagi dalam kondisi ada sinyal.'],
], [42 * mm, 47 * mm, 77 * mm]))

C.append(kotak('Prinsip yang menenangkan', [
    'Selama aplikasi <b>belum dihapus</b> dari HP, penilaian yang sudah disimpan '
    'tidak akan hilang — sekalipun berhari-hari tanpa sinyal.',
    'Bila ragu, jangan menghapus aplikasi. Bawa perangkatnya ke lokasi bersinyal '
    'dan tekan Kirim Sekarang.',
], warna=HIJAU_MUDA, garis=HIJAU))
C.append(PageBreak())

# ================================================================ 12
C.append(P('12. Lampiran', 'h1'))

C.append(P('Alamat penting', 'h2'))
C.append(tabel([
    ['Keperluan', 'Alamat'],
    ['Aplikasi untuk staff', URL_APP],
    ['Kode program', URL_REPO],
    ['Spreadsheet basis data', 'Google Drive → Urusan Pengelolaan Kunjungan →<br/>'
     '"Penilaian Guide Besakih — Basis Data"'],
    ['URL server (/exec)', 'Tertanam di <font face="Courier" size="8">public/config.js</font>.<br/>'
     'Dapat dilihat juga di Apps Script → Deploy → Manage deployments.'],
], [42 * mm, 124 * mm]))

C.append(P('Hasil pengujian', 'h2'))
C.append(P(
    'Aplikasi diuji otomatis setiap kali kodenya berubah. Rinciannya:'))
C.append(tabel([
    ['Yang diuji', 'Jumlah pemeriksaan', 'Hasil'],
    ['Aplikasi di perangkat (termasuk simulasi putus sinyal)', '53', 'Lulus semua'],
    ['Logika server Apps Script', '25', 'Lulus semua'],
    ['<b>Total</b>', '<b>78</b>', '<b>Lulus semua</b>'],
], [92 * mm, 40 * mm, 34 * mm], rata={1: 'CENTER', 2: 'CENTER'}))

C.append(Spacer(1, 6))
C.append(P('Termasuk di dalamnya:', 'h3'))
C.append(poin([
    'Penilaian tetap tersimpan ketika sinyal dimatikan.',
    'Antrean terkirim sendiri begitu sinyal kembali.',
    'Pengiriman ulang tidak menghasilkan baris ganda.',
    'Data tidak sah ditolak dan tidak dicoba terus-menerus.',
    'Nama guide di penyimpanan HP benar-benar terenkripsi.',
    'Filter Kategori dan Regu menyaring dengan benar, termasuk untuk guide '
    'yang merangkap dua regu.',
]))

C.append(P('Kesesuaian dengan dokumen kebutuhan (PRD)', 'h2'))
C.append(tabel([
    ['Kode', 'Kriteria', 'Status'],
    ['AC-1', 'Dibuka tanpa login', 'Terpenuhi'],
    ['AC-2', 'Daftar guide dapat dipilih', f'Terpenuhi — {len(GUIDES)} guide'],
    ['AC-3', 'Tiga penilaian Ya/Tidak tersimpan di perangkat', 'Terpenuhi'],
    ['AC-4', 'Tetap berfungsi dan ada tanda saat tanpa sinyal', 'Terpenuhi'],
    ['AC-5', 'Terkirim otomatis saat kembali online', 'Terpenuhi'],
    ['AC-6', 'Menu memuat seluruh layar', 'Terpenuhi'],
    ['AC-7', 'Tombol besar dan teks mudah dibaca', 'Terpenuhi'],
    ['AC-8', 'Dapat dipasang sebagai aplikasi', 'Terpenuhi'],
], [16 * mm, 100 * mm, 50 * mm]))

C.append(Spacer(1, 10))
C.append(P(
    'Dokumen ini dibuat berdasarkan keadaan sistem pada '
    f'{date.today().strftime("%d %B %Y")}. Bila aplikasi dikembangkan lebih lanjut, '
    'perbarui juga dokumen ini agar tetap sesuai.', 'kecil'))

doc.build(C)
print('PDF dibuat:', KELUARAN)
print('ukuran   :', os.path.getsize(KELUARAN), 'byte')
