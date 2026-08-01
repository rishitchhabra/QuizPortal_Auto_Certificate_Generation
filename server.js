import express from 'express';
import cors from 'cors';
import path from 'path';
import Database from 'better-sqlite3';
import basicAuth from 'express-basic-auth';

const PORT = process.env.PORT || 3001;
const DB_FILE = path.join(process.cwd(), 'data', 'gyan.db');

// Admin credentials (set via env or default)
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin';

const app = express();
app.use(cors());
app.use(express.json());

// Open DB and init tables
const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.prepare(`CREATE TABLE IF NOT EXISTS quizzes (
  id TEXT PRIMARY KEY,
  title TEXT,
  description TEXT,
  data TEXT,
  isPublished INTEGER DEFAULT 1
)`).run();
db.prepare(`CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  quizId TEXT,
  participant TEXT,
  answers TEXT,
  score INTEGER,
  totalPoints INTEGER,
  percent INTEGER,
  passed INTEGER,
  timeTaken INTEGER,
  questionResults TEXT,
  submittedAt TEXT
)`).run();
db.prepare(`CREATE TABLE IF NOT EXISTS cert_templates (
  id TEXT PRIMARY KEY,
  name TEXT,
  data TEXT
)`).run();

// Migrate legacy JSON if present and tables empty
import fs from 'fs';
const legacyPath = path.join(process.cwd(), 'data', 'db.json');
try {
  if (fs.existsSync(legacyPath)) {
    const raw = fs.readFileSync(legacyPath, 'utf8');
    const legacy = JSON.parse(raw || '{}');
    const qCount = db.prepare('SELECT COUNT(1) as c FROM quizzes').get().c;
    if (qCount === 0 && Array.isArray(legacy.quizzes)) {
      const insQ = db.prepare('INSERT INTO quizzes (id, title, description, data, isPublished) VALUES (@id,@title,@description,@data,@isPublished)');
      for (const q of legacy.quizzes) {
        insQ.run({ id: q.id, title: q.title || '', description: q.description || '', data: JSON.stringify(q), isPublished: q.isPublished ? 1 : 0 });
      }
    }
    const sCount = db.prepare('SELECT COUNT(1) as c FROM submissions').get().c;
    if (sCount === 0 && Array.isArray(legacy.submissions)) {
      const insS = db.prepare('INSERT INTO submissions (id, quizId, participant, answers, score, totalPoints, percent, passed, timeTaken, questionResults, submittedAt) VALUES (@id,@quizId,@participant,@answers,@score,@totalPoints,@percent,@passed,@timeTaken,@questionResults,@submittedAt)');
      for (const s of legacy.submissions) {
        insS.run({ id: s.id, quizId: s.quizId, participant: JSON.stringify(s.participant || {}), answers: JSON.stringify(s.answers || {}), score: s.score || 0, totalPoints: s.totalPoints || 0, percent: s.percent || 0, passed: s.passed ? 1 : 0, timeTaken: s.timeTaken || 0, questionResults: JSON.stringify(s.questionResults || []), submittedAt: s.submittedAt || new Date().toISOString() });
      }
    }
    const tCount = db.prepare('SELECT COUNT(1) as c FROM cert_templates').get().c;
    if (tCount === 0 && Array.isArray(legacy.certificateTemplates)) {
      const insT = db.prepare('INSERT INTO cert_templates (id, name, data) VALUES (@id,@name,@data)');
      for (const t of legacy.certificateTemplates) insT.run({ id: t.id, name: t.name || '', data: JSON.stringify(t) });
    }
  }
} catch (e) { console.warn('Migration error', e); }

// Basic auth middleware for admin GUI
app.use('/admin-ui', basicAuth({ users: { [ADMIN_USER]: ADMIN_PASS }, challenge: true }));

// Serve a simple admin GUI (single file)
app.get('/admin-ui', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'server-admin.html'));
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Quizzes
app.get('/api/quizzes', (req, res) => {
  const rows = db.prepare('SELECT id, title, description, data, isPublished FROM quizzes ORDER BY ROWID DESC').all();
  const quizzes = rows.map(r => ({ id: r.id, title: r.title, description: r.description, isPublished: !!r.isPublished, ...JSON.parse(r.data || '{}') }));
  res.json(quizzes);
});

app.get('/api/quizzes/:id', (req, res) => {
  const row = db.prepare('SELECT data FROM quizzes WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json(JSON.parse(row.data));
});

app.post('/api/quizzes', (req, res) => {
  const q = req.body;
  if (!q.id) q.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const stmt = db.prepare('INSERT OR REPLACE INTO quizzes (id,title,description,data,isPublished) VALUES (@id,@title,@description,@data,@isPublished)');
  stmt.run({ id: q.id, title: q.title || '', description: q.description || '', data: JSON.stringify(q), isPublished: q.isPublished ? 1 : 0 });
  res.json(q);
});

app.put('/api/quizzes/:id', (req, res) => {
  const q = req.body;
  const stmt = db.prepare('UPDATE quizzes SET title=@title,description=@description,data=@data,isPublished=@isPublished WHERE id=@id');
  stmt.run({ id: req.params.id, title: q.title || '', description: q.description || '', data: JSON.stringify(q), isPublished: q.isPublished ? 1 : 0 });
  res.json(q);
});

app.delete('/api/quizzes/:id', (req, res) => {
  db.prepare('DELETE FROM quizzes WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Submissions
app.get('/api/submissions', (req, res) => {
  const quizId = req.query.quizId;
  let rows = db.prepare('SELECT * FROM submissions ORDER BY ROWID DESC').all();
  if (quizId) rows = db.prepare('SELECT * FROM submissions WHERE quizId = ? ORDER BY ROWID DESC').all(quizId);
  const subs = rows.map(r => ({ id: r.id, quizId: r.quizId, participant: JSON.parse(r.participant || '{}'), answers: JSON.parse(r.answers || '{}'), score: r.score, totalPoints: r.totalPoints, percent: r.percent, passed: !!r.passed, timeTaken: r.timeTaken, questionResults: JSON.parse(r.questionResults || '[]'), submittedAt: r.submittedAt }));
  res.json(subs);
});

app.post('/api/submissions', (req, res) => {
  const s = req.body;
  if (!s.id) s.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const stmt = db.prepare('INSERT INTO submissions (id,quizId,participant,answers,score,totalPoints,percent,passed,timeTaken,questionResults,submittedAt) VALUES (@id,@quizId,@participant,@answers,@score,@totalPoints,@percent,@passed,@timeTaken,@questionResults,@submittedAt)');
  stmt.run({ id: s.id, quizId: s.quizId, participant: JSON.stringify(s.participant || {}), answers: JSON.stringify(s.answers || {}), score: s.score || 0, totalPoints: s.totalPoints || 0, percent: s.percent || 0, passed: s.passed ? 1 : 0, timeTaken: s.timeTaken || 0, questionResults: JSON.stringify(s.questionResults || []), submittedAt: s.submittedAt || new Date().toISOString() });
  res.json(s);
});

// Certificate templates
app.get('/api/cert-templates', (req, res) => {
  const rows = db.prepare('SELECT * FROM cert_templates ORDER BY ROWID DESC').all();
  const templates = rows.map(r => ({ id: r.id, name: r.name, ...JSON.parse(r.data || '{}') }));
  res.json(templates);
});

app.post('/api/cert-templates', (req, res) => {
  const t = req.body;
  if (!t.id) t.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  db.prepare('INSERT OR REPLACE INTO cert_templates (id,name,data) VALUES (@id,@name,@data)').run({ id: t.id, name: t.name || '', data: JSON.stringify(t) });
  res.json(t);
});

app.put('/api/cert-templates/:id', (req, res) => {
  const t = req.body;
  db.prepare('UPDATE cert_templates SET name=@name,data=@data WHERE id=@id').run({ id: req.params.id, name: t.name || '', data: JSON.stringify(t) });
  res.json(t);
});

app.delete('/api/cert-templates/:id', (req, res) => {
  db.prepare('DELETE FROM cert_templates WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Dynamic table management
app.get('/api/tables', (req, res) => {
  try {
    const rows = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
    res.json(rows.map(r => r.name));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Create table with raw SQL (admin only)
app.post('/api/tables', basicAuth({ users: { [ADMIN_USER]: ADMIN_PASS }, challenge: true }), (req, res) => {
  const { sql } = req.body || {};
  if (!sql) return res.status(400).json({ error: 'sql required' });
  try {
    db.prepare(sql).run();
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Get rows from a table
app.get('/api/tables/:name/rows', (req, res) => {
  const name = req.params.name;
  try {
    const rows = db.prepare(`SELECT rowid AS rowid, * FROM "${name}"`).all();
    res.json(rows);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Insert a row into table (admin only)
app.post('/api/tables/:name/rows', basicAuth({ users: { [ADMIN_USER]: ADMIN_PASS }, challenge: true }), (req, res) => {
  const name = req.params.name;
  const data = req.body || {};
  const cols = Object.keys(data);
  if (!cols.length) return res.status(400).json({ error: 'no data' });
  try {
    const stmt = db.prepare(`INSERT INTO "${name}" (${cols.map(c => `"${c}"`).join(',')}) VALUES (${cols.map(() => '?').join(',')})`);
    const info = stmt.run(...cols.map(c => data[c]));
    res.json({ ok: true, lastInsertRowid: info.lastInsertRowid });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Delete row by rowid (admin only)
app.delete('/api/tables/:name/rows/:rowid', basicAuth({ users: { [ADMIN_USER]: ADMIN_PASS }, challenge: true }), (req, res) => {
  const name = req.params.name; const rowid = req.params.rowid;
  try {
    db.prepare(`DELETE FROM "${name}" WHERE rowid = ?`).run(rowid);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Drop table (admin only)
app.delete('/api/tables/:name', basicAuth({ users: { [ADMIN_USER]: ADMIN_PASS }, challenge: true }), (req, res) => {
  const name = req.params.name;
  try {
    db.prepare(`DROP TABLE IF EXISTS "${name}"`).run();
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Simple admin API protection for destructive actions
app.use('/api', (req, res, next) => {
  // allow read-only GETs without auth
  if (req.method === 'GET') return next();
  // require basic auth for POST/PUT/DELETE
  return basicAuth({ users: { [ADMIN_USER]: ADMIN_PASS }, challenge: true })(req, res, next);
});

// Serve admin static assets (if any)
app.use('/static', express.static(path.join(process.cwd(), 'public')));

// Serve Vite build
app.use(express.static(path.join(process.cwd(), "dist")));

app.get("*", (req, res) => {
  res.sendFile(path.join(process.cwd(), "dist", "index.html"));
});

app.listen(PORT, () => console.log(`SQLite server listening on port ${PORT}`));
