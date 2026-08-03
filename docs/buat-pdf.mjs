/**
 * Membangun versi PDF dari dokumentasi Markdown di folder docs/.
 *
 *   npm run docs:pdf                    # seluruh dokumen
 *   node docs/buat-pdf.mjs ALUR-APLIKASI.md
 *
 * Alurnya: Markdown -> HTML (diagram Mermaid ikut dirender) -> PDF lewat
 * Chrome headless. Chrome dipakai karena sudah terpasang di komputer kerja,
 * jadi tidak perlu mengunduh mesin peramban terpisah hanya untuk mencetak.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import url from 'node:url';
import { execFileSync } from 'node:child_process';
import { marked } from 'marked';

const DOCS = path.dirname(url.fileURLToPath(import.meta.url));
const AKAR = path.dirname(DOCS);

/* ------------------------------------------------------------------ */
/* Dokumen yang dibangun                                               */
/* ------------------------------------------------------------------ */
const DOKUMEN = [
  {
    sumber: 'PANDUAN-PEMAKAIAN.md',
    keluaran: 'Panduan-Pemakaian-Aplikasi-Penilaian-Guide.pdf',
    judul: 'Panduan Pemakaian',
    anak: 'Aplikasi Penilaian Guide Kawasan Besakih',
    catatan: 'Untuk staff pos pemeriksaan dan admin kantor',
  },
  {
    sumber: 'ALUR-APLIKASI.md',
    keluaran: 'Alur-Aplikasi-Penilaian-Guide.pdf',
    judul: 'Alur Aplikasi',
    anak: 'Aplikasi Penilaian Guide Kawasan Besakih',
    catatan: 'Dokumen teknis — 13 diagram alur kerja',
  },
  {
    sumber: 'PRD-APLIKASI.md',
    keluaran: 'PRD-Aplikasi-Penilaian-Guide.pdf',
    judul: 'Product Requirements Document',
    anak: 'Aplikasi Penilaian Guide Kawasan Besakih',
    catatan: 'Spesifikasi lengkap untuk membangun ulang dari nol',
  },
];

/* ------------------------------------------------------------------ */
/* Menemukan Chrome                                                    */
/* ------------------------------------------------------------------ */
function cariChrome() {
  const kandidat = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  for (const c of kandidat) if (fs.existsSync(c)) return c;
  throw new Error(
    'Chrome atau Edge tidak ditemukan. Setel CHROME_PATH ke lokasi peramban.\n' +
    'Sudah dicoba:\n  ' + kandidat.join('\n  '));
}

/* ------------------------------------------------------------------ */
/* Markdown -> HTML                                                    */
/* ------------------------------------------------------------------ */

/** Slug ala GitHub, supaya tautan daftar isi tetap hidup di dalam PDF. */
function slug(teks) {
  return String(teks).trim().toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s/g, '-');
}

function keHtml(markdown) {
  const renderer = new marked.Renderer();

  // Blok ```mermaid tidak diwarnai sebagai kode, melainkan diserahkan ke
  // mermaid untuk digambar menjadi diagram sungguhan.
  renderer.code = function ({ text, lang }) {
    if (lang === 'mermaid') {
      return `<div class="diagram"><pre class="mermaid">${escapeHtml(text)}</pre></div>`;
    }
    return `<pre class="kode"><code>${escapeHtml(text)}</code></pre>`;
  };

  renderer.heading = function ({ tokens, depth }) {
    const isi = this.parser.parseInline(tokens);
    return `<h${depth} id="${slug(isi)}">${isi}</h${depth}>\n`;
  };

  return marked.parse(markdown, { renderer, gfm: true, breaks: false });
}

const escapeHtml = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ------------------------------------------------------------------ */
/* Kerangka halaman                                                    */
/* ------------------------------------------------------------------ */
const HIJAU = '#0B5D3B';
const EMAS = '#C8942B';

function halaman(doc, isiHtml, mermaidJs) {
  return `<!doctype html>
<html lang="id"><head><meta charset="utf-8"><title>${doc.judul}</title>
<style>
  @page { size: A4; margin: 18mm 16mm 20mm 16mm; }

  :root { --hijau: ${HIJAU}; --emas: ${EMAS}; --abu: #5C6360; --garis: #D6DBD8; }

  * { box-sizing: border-box; }
  body {
    font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    font-size: 10.5pt; line-height: 1.55; color: #12211A; margin: 0;
  }

  /* ---------- sampul ---------- */
  .sampul {
    height: 247mm; display: flex; flex-direction: column;
    align-items: center; justify-content: center; text-align: center;
    page-break-after: always;
  }
  .sampul .lambang { font-size: 62pt; line-height: 1; margin-bottom: 10mm; }
  .sampul h1 { font-size: 30pt; color: var(--hijau); margin: 0 0 4mm; border: 0; padding: 0; }
  .sampul .anak { font-size: 14pt; color: var(--abu); margin-bottom: 12mm; }
  .sampul .catatan {
    font-size: 11pt; color: #12211A; background: #E7F3EC;
    border-left: 4px solid var(--emas); padding: 4mm 6mm; max-width: 120mm;
  }
  .sampul .kaki { margin-top: 14mm; font-size: 9pt; color: var(--abu); }

  /* ---------- judul ---------- */
  h1, h2, h3, h4 { color: var(--hijau); page-break-after: avoid; }
  h1 { font-size: 19pt; margin: 0 0 5mm; padding-bottom: 2mm; border-bottom: 2px solid var(--hijau); }
  h2 {
    font-size: 15pt; margin: 0 0 4mm; padding: 3mm 0 2mm;
    border-bottom: 1px solid var(--garis); page-break-before: always;
  }
  /* Judul pertama sesudah sampul tidak perlu halaman baru lagi */
  .isi > h2:first-child, .isi > h1 + h2 { page-break-before: avoid; }
  h3 { font-size: 12pt; margin: 6mm 0 2mm; }
  h4 { font-size: 10.5pt; margin: 5mm 0 2mm; color: #12211A; }

  p { margin: 0 0 3mm; }
  a { color: var(--hijau); text-decoration: none; }

  /* ---------- daftar ---------- */
  ul, ol { margin: 0 0 3mm; padding-left: 6mm; }
  li { margin-bottom: 1.2mm; }

  /* ---------- tabel ---------- */
  table {
    width: 100%; border-collapse: collapse; margin: 3mm 0 5mm;
    font-size: 9.5pt; page-break-inside: avoid;
  }
  th {
    background: var(--hijau); color: #fff; text-align: left;
    padding: 2mm 2.5mm; font-weight: 600; border: 1px solid var(--hijau);
  }
  td { padding: 1.8mm 2.5mm; border: 1px solid var(--garis); vertical-align: top; }
  tbody tr:nth-child(even) { background: #F5F9F7; }

  /* ---------- kode ---------- */
  pre.kode {
    background: #F5F9F7; border: 1px solid var(--garis); border-left: 3px solid var(--emas);
    padding: 3mm 4mm; font-family: "Consolas", "Courier New", monospace;
    font-size: 8.5pt; line-height: 1.45; overflow-x: hidden;
    white-space: pre-wrap; word-break: break-word; page-break-inside: avoid;
  }
  code { font-family: "Consolas", "Courier New", monospace; font-size: 9pt;
         background: #EEF4F1; padding: 0.3mm 1.2mm; border-radius: 2px; }
  pre.kode code { background: none; padding: 0; font-size: inherit; }

  /* ---------- kutipan ---------- */
  blockquote {
    margin: 3mm 0; padding: 2.5mm 5mm; background: #FFF6E0;
    border-left: 4px solid var(--emas); page-break-inside: avoid;
  }
  blockquote p:last-child { margin-bottom: 0; }

  /* ---------- diagram ---------- */
  .diagram {
    margin: 3mm 0 5mm; text-align: center; page-break-inside: avoid;
    border: 1px solid var(--garis); border-radius: 3px; padding: 3mm 2mm; background: #FCFDFC;
  }
  /* Tinggi dibatasi supaya diagram yang panjang mengecil agar muat satu
     halaman. Tanpa batas ini diagram terdorong ke halaman berikutnya dan
     meninggalkan halaman nyaris kosong di belakang judulnya. */
  .diagram svg {
    max-width: 100% !important;
    max-height: 205mm !important;
    width: auto !important;
    height: auto !important;
  }

  hr { border: 0; border-top: 1px solid var(--garis); margin: 6mm 0; }

  /* Jangan tinggalkan judul sendirian di kaki halaman */
  h2 + p, h2 + table, h3 + p, h3 + table, h3 + .diagram { page-break-before: avoid; }
</style></head>
<body>

<div class="sampul">
  <div class="lambang">&#128726;</div>
  <h1>${doc.judul}</h1>
  <div class="anak">${doc.anak}</div>
  <div class="catatan">${doc.catatan}</div>
  <div class="kaki">Berkas sumber: docs/${doc.sumber}</div>
</div>

<div class="isi">
${isiHtml}
</div>

<script>${mermaidJs}</script>
<script>
  mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    themeVariables: {
      primaryColor: '#E7F3EC', primaryTextColor: '#12211A', primaryBorderColor: '${HIJAU}',
      lineColor: '#5C6360', secondaryColor: '#FFF6E0', tertiaryColor: '#F5F9F7',
      fontFamily: 'Segoe UI, Helvetica Neue, Arial, sans-serif', fontSize: '13px',
    },
    flowchart: { htmlLabels: true, useMaxWidth: true },
    sequence: { useMaxWidth: true },
  });
  // Penanda bagi Chrome bahwa seluruh diagram selesai digambar
  mermaid.run({ querySelector: '.mermaid' })
    .then(() => { document.title = document.title + ' [siap]'; })
    .catch(e => { document.title = document.title + ' [gagal: ' + e.message + ']'; });
</script>
</body></html>`;
}

/* ------------------------------------------------------------------ */
/* Bangun                                                              */
/* ------------------------------------------------------------------ */
const chrome = cariChrome();
const mermaidJs = fs.readFileSync(
  path.join(AKAR, 'node_modules', 'mermaid', 'dist', 'mermaid.min.js'), 'utf8');

const diminta = process.argv.slice(2);
const daftar = diminta.length
  ? DOKUMEN.filter(d => diminta.some(a => d.sumber.includes(a.replace(/\.md$/, ''))))
  : DOKUMEN;

if (!daftar.length) {
  console.error('Tidak ada dokumen yang cocok. Pilihan: ' + DOKUMEN.map(d => d.sumber).join(', '));
  process.exit(1);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-panduan-'));
let gagal = 0;

for (const doc of daftar) {
  const sumber = path.join(DOCS, doc.sumber);
  if (!fs.existsSync(sumber)) { console.error(`X  ${doc.sumber} tidak ada`); gagal++; continue; }

  const html = halaman(doc, keHtml(fs.readFileSync(sumber, 'utf8')), mermaidJs);
  const berkasHtml = path.join(tmp, doc.sumber.replace(/\.md$/, '.html'));
  fs.writeFileSync(berkasHtml, html, 'utf8');

  const keluaran = path.join(DOCS, doc.keluaran);
  execFileSync(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--no-pdf-header-footer',
    '--run-all-compositor-stages-before-draw',
    // Waktu maya dimajukan agar Chrome menunggu diagram selesai digambar
    // sebelum mencetak, tanpa benar-benar menunggu selama itu.
    '--virtual-time-budget=30000',
    `--print-to-pdf=${keluaran}`,
    url.pathToFileURL(berkasHtml).href,
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  if (!fs.existsSync(keluaran)) { console.error(`X  ${doc.keluaran} gagal dibuat`); gagal++; continue; }

  const isi = fs.readFileSync(keluaran);
  const halamanPdf = (isi.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  console.log(`OK ${doc.keluaran} — ${halamanPdf} halaman, ${(isi.length / 1024 / 1024).toFixed(2)} MB`);
}

fs.rmSync(tmp, { recursive: true, force: true });
process.exit(gagal ? 1 : 0);
