'use strict';
/**
 * Lapisan penyimpanan server.
 * Memakai SQLite bawaan Node (node:sqlite, Node >= 22.5).
 * Bila tidak tersedia, otomatis fallback ke penyimpanan file JSON.
 * Tidak ada dependensi npm sama sekali.
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

/* ------------------------------------------------------------------ */
/* Implementasi SQLite                                                  */
/* ------------------------------------------------------------------ */
function createSqliteStore() {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(path.join(DATA_DIR, 'besakih.db'));

  db.exec(`
    CREATE TABLE IF NOT EXISTS evaluations (
      evaluationId TEXT PRIMARY KEY,
      guideId      TEXT NOT NULL,
      guideName    TEXT NOT NULL,
      pos          INTEGER NOT NULL,
      timestamp    TEXT NOT NULL,
      idCard       INTEGER NOT NULL,
      uniform      INTEGER NOT NULL,
      review       INTEGER NOT NULL DEFAULT 0,
      catatan      TEXT,
      receivedAt   TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_eval_ts ON evaluations(timestamp);
  `);

  const insert = db.prepare(`
    INSERT OR IGNORE INTO evaluations
      (evaluationId, guideId, guideName, pos, timestamp, idCard, uniform, review, catatan, receivedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Beberapa sistem berkas (mis. folder jaringan) mengizinkan pembuatan tabel
  // tapi menolak penulisan. Kalau itu terjadi, seluruh penilaian akan ditolak
  // tanpa pesan yang jelas — jadi kemampuan menulis diuji lebih dulu di sini.
  const uji = '__uji_tulis__';
  insert.run(uji, '-', '-', 1, '-', 0, 0, 0, '', new Date().toISOString());
  db.prepare('DELETE FROM evaluations WHERE evaluationId = ?').run(uji);

  return {
    kind: 'sqlite',
    saveEvaluation(e) {
      const info = insert.run(
        e.evaluationId, e.guideId, e.guideName, e.pos, e.timestamp,
        e.criteria.idCard ? 1 : 0, e.criteria.uniform ? 1 : 0, Number(e.criteria.review) || 0,
        e.catatan || '', new Date().toISOString()
      );
      return { duplicate: info.changes === 0 };
    },
    listEvaluations(limit = 500) {
      return db.prepare(
        'SELECT * FROM evaluations ORDER BY timestamp DESC LIMIT ?'
      ).all(limit).map(rowToEval);
    },
    count() {
      return db.prepare('SELECT COUNT(*) AS n FROM evaluations').get().n;
    },
  };
}

function rowToEval(r) {
  return {
    evaluationId: r.evaluationId,
    guideId: r.guideId,
    guideName: r.guideName,
    pos: r.pos,
    timestamp: r.timestamp,
    criteria: { idCard: !!r.idCard, uniform: !!r.uniform, review: Number(r.review) || 0 },
    catatan: r.catatan || '',
    receivedAt: r.receivedAt,
  };
}

/* ------------------------------------------------------------------ */
/* Implementasi file JSON (fallback)                                    */
/* ------------------------------------------------------------------ */
function createJsonStore() {
  const FILE = path.join(DATA_DIR, 'evaluations.json');
  let rows = [];
  try {
    if (fs.existsSync(FILE)) rows = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch { rows = []; }

  const flush = () => fs.writeFileSync(FILE, JSON.stringify(rows, null, 2));

  return {
    kind: 'json',
    saveEvaluation(e) {
      if (rows.some(r => r.evaluationId === e.evaluationId)) return { duplicate: true };
      rows.push({ ...e, receivedAt: new Date().toISOString() });
      flush();
      return { duplicate: false };
    },
    listEvaluations(limit = 500) {
      return [...rows].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, limit);
    },
    count() { return rows.length; },
  };
}

let store;
try {
  store = createSqliteStore();
  console.log('[storage] menggunakan SQLite (node:sqlite)');
} catch (err) {
  store = createJsonStore();
  console.log('[storage] SQLite tidak dapat dipakai -> fallback file JSON (' + err.message + ')');
}

module.exports = store;
