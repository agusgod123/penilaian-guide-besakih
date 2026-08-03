'use strict';
/**
 * Server Aplikasi Penilaian Guide Kawasan Besakih
 * Zero-dependency: hanya modul bawaan Node.js.
 *
 * Jalankan:  node server/server.js
 * Buka:      http://localhost:3000
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const store = require('./storage');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const GUIDES_FILE = path.join(__dirname, 'guides.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

/* ---------------------------- util ---------------------------- */
function send(res, status, body, headers = {}) {
  const payload = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
    ...headers,
  });
  res.end(payload);
}

function readBody(req, limitBytes = 1_000_000) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > limitBytes) { reject(new Error('payload terlalu besar')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
      catch (e) { reject(new Error('JSON tidak valid')); }
    });
    req.on('error', reject);
  });
}

/** Validasi satu entri penilaian sesuai model data PRD §7 */
function validateEvaluation(e) {
  const errors = [];
  if (!e || typeof e !== 'object') return ['body bukan objek'];
  if (!e.evaluationId || typeof e.evaluationId !== 'string') errors.push('evaluationId wajib (string/uuid)');
  if (!e.guideId || typeof e.guideId !== 'string') errors.push('guideId wajib');
  if (!e.guideName || typeof e.guideName !== 'string') errors.push('guideName wajib');
  if (![1, 2, 3].includes(Number(e.pos))) errors.push('pos harus 1, 2, atau 3');
  if (!e.timestamp || isNaN(Date.parse(e.timestamp))) errors.push('timestamp harus ISO8601');
  const c = e.criteria;
  if (!c || typeof c !== 'object') errors.push('criteria wajib');
  else {
    for (const k of ['idCard', 'uniform']) {
      if (typeof c[k] !== 'boolean') errors.push(`criteria.${k} harus boolean`);
    }
    // Review & Etika berupa angka (0 = tidak ada), bukan ya/tidak
    if (!Number.isFinite(Number(c.review)) || Number(c.review) < 0) {
      errors.push('criteria.review harus angka >= 0');
    }
    // Etika boleh tidak dikirim (dianggap 0) supaya perangkat berversi lama
    // tidak ditolak permanen dan datanya hilang.
    if (c.etika !== undefined && c.etika !== null &&
        (!Number.isFinite(Number(c.etika)) || Number(c.etika) < 0)) {
      errors.push('criteria.etika harus angka >= 0');
    }
  }
  return errors;
}

function toCsv(rows) {
  const head = ['evaluationId', 'timestamp', 'pos', 'guideId', 'guideName', 'uniform', 'idCard', 'review', 'etika', 'catatan'];
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [head.join(',')];
  for (const r of rows) {
    lines.push([
      r.evaluationId, r.timestamp, r.pos, r.guideId, r.guideName,
      r.criteria.uniform ? 1 : 0,
      r.criteria.idCard ? 1 : 0,
      Number(r.criteria.review) || 0,
      Number(r.criteria.etika) || 0,
      r.catatan || '',
    ].map(esc).join(','));
  }
  return '﻿' + lines.join('\r\n');
}

/* ------------------------- static files ------------------------- */
function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';
  const filePath = path.join(PUBLIC_DIR, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!filePath.startsWith(PUBLIC_DIR)) return send(res, 403, { error: 'terlarang' });

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA fallback
      return fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (e2, html) => {
        if (e2) return send(res, 404, { error: 'tidak ditemukan' });
        send(res, 200, html, { 'Content-Type': MIME['.html'] });
      });
    }
    const ext = path.extname(filePath).toLowerCase();
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
    // service worker & html jangan di-cache browser agar update cepat terdeteksi
    if (rel === '/sw.js' || ext === '.html') headers['Cache-Control'] = 'no-cache';
    send(res, 200, data, headers);
  });
}

/* ----------------------------- router ----------------------------- */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;

  if (req.method === 'OPTIONS') return send(res, 204, '');

  // Health check — dipakai aplikasi untuk memastikan server benar-benar reachable
  if (p === '/api/health' && req.method === 'GET') {
    return send(res, 200, { ok: true, storage: store.kind, total: store.count(), serverTime: new Date().toISOString() });
  }

  // Daftar guide aktif
  if (p === '/api/guides' && req.method === 'GET') {
    try {
      const all = JSON.parse(fs.readFileSync(GUIDES_FILE, 'utf8'));
      return send(res, 200, { guides: all.filter(g => g.aktif !== false) });
    } catch {
      return send(res, 500, { error: 'gagal membaca daftar guide' });
    }
  }

  // Terima penilaian — menerima 1 objek ATAU { evaluations: [...] } untuk batch
  if (p === '/api/evaluations' && req.method === 'POST') {
    let body;
    try { body = await readBody(req); }
    catch (e) { return send(res, 400, { error: e.message }); }

    const items = Array.isArray(body?.evaluations) ? body.evaluations : [body];
    if (items.length === 0) return send(res, 400, { error: 'tidak ada entri' });

    const accepted = [], rejected = [];
    for (const item of items) {
      const errs = validateEvaluation(item);
      if (errs.length) { rejected.push({ evaluationId: item?.evaluationId ?? null, errors: errs }); continue; }
      item.pos = Number(item.pos);
      const { duplicate } = store.saveEvaluation(item);
      accepted.push({ evaluationId: item.evaluationId, synced: true, duplicate });
    }

    const status = accepted.length === 0 ? 400 : 200;
    console.log(`[POST /api/evaluations] diterima=${accepted.length} ditolak=${rejected.length}`);
    return send(res, status, { accepted, rejected, total: store.count() });
  }

  // Rekap di server (untuk verifikasi/laporan)
  if (p === '/api/evaluations' && req.method === 'GET') {
    return send(res, 200, { evaluations: store.listEvaluations(Number(url.searchParams.get('limit')) || 500) });
  }

  if (p === '/api/evaluations.csv' && req.method === 'GET') {
    return send(res, 200, toCsv(store.listEvaluations(5000)), {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="penilaian-guide-besakih.csv"',
    });
  }

  if (p.startsWith('/api/')) return send(res, 404, { error: 'endpoint tidak dikenal' });

  serveStatic(req, res, p);
});

server.listen(PORT, () => {
  console.log('======================================================');
  console.log(' Penilaian Guide Kawasan Besakih — server berjalan');
  console.log(` Lokal   : http://localhost:${PORT}`);
  for (const [name, addrs] of Object.entries(require('os').networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family === 'IPv4' && !a.internal) console.log(` Jaringan: http://${a.address}:${PORT}  (${name})`);
    }
  }
  console.log('======================================================');
});
