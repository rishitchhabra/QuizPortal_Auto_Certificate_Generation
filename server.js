import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import fetch from 'node-fetch';

const PORT = process.env.PORT || 3001;
const DB_FILE = path.join(process.cwd(), 'data', 'gyan.db');

// Ensure data dir
fs.mkdirSync(path.join(process.cwd(), 'data'), { recursive: true });
const db = new Database(DB_FILE);

// Initialize schema
db.exec(`
CREATE TABLE IF NOT EXISTS quizzes (id TEXT PRIMARY KEY, json TEXT NOT NULL, createdAt TEXT);
CREATE TABLE IF NOT EXISTS submissions (id TEXT PRIMARY KEY, quizId TEXT, json TEXT NOT NULL, createdAt TEXT);
CREATE TABLE IF NOT EXISTS cert_templates (id TEXT PRIMARY KEY, json TEXT NOT NULL, createdAt TEXT);
CREATE TABLE IF NOT EXISTS admin_emails (email TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS config_kv (k TEXT PRIMARY KEY, v TEXT);
`);

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Helper: verify Google ID token and return payload
async function verifyIdToken(idToken) {
  if (!idToken) return null;
  try {
    const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!r.ok) return null;
    const payload = await r.json();
    return payload; // contains email, email_verified, aud, etc.
  } catch (e) {
    console.error('token verify error', e);
    return null;
  }
}

// Admin check middleware
async function requireAdmin(req, res, next) {
  const auth = req.headers['authorization'] || '';
  const parts = auth.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'missing token' });
  const token = parts[1];
  const payload = await verifyIdToken(token);
  if (!payload || !payload.email) return res.status(401).json({ error: 'invalid token' });
  const stmt = db.prepare('SELECT email FROM admin_emails WHERE email = ?');
  const row = stmt.get(payload.email.toLowerCase());
  if (!row) return res.status(403).json({ error: 'forbidden' });
  req.admin = { email: payload.email };
  next();
}

// Config endpoint
app.get('/api/config', (req, res) => {
  const stmt = db.prepare('SELECT v FROM config_kv WHERE k = ?');
  const row = stmt.get('googleClientId');
  const clientId = row ? row.v : '';
  const emails = db.prepare('SELECT email FROM admin_emails').all().map(r => r.email);
  res.json({ googleClientId: clientId, adminEmails: emails });
});

app.post('/api/config/googleClientId', requireAdmin, (req, res) => {
  const id = req.body.clientId || '';
  db.prepare('INSERT OR REPLACE INTO config_kv (k,v) VALUES (?,?)').run('googleClientId', id);
  res.json({ ok: true });
});

// Admin emails management
app.get('/api/admin/emails', requireAdmin, (req, res) => {
  const emails = db.prepare('SELECT email FROM admin_emails').all().map(r => r.email);
  res.json(emails);
});
app.post('/api/admin/emails', requireAdmin, (req, res) => {
  const email = (req.body.email || '').toLowerCase();
  if (!email) return res.status(400).json({ error: 'email required' });
  db.prepare('INSERT OR IGNORE INTO admin_emails (email) VALUES (?)').run(email);
  res.json({ ok: true });
});
app.delete('/api/admin/emails', requireAdmin, (req, res) => {
  const email = (req.body.email || '').toLowerCase();
  if (!email) return res.status(400).json({ error: 'email required' });
  db.prepare('DELETE FROM admin_emails WHERE email = ?').run(email);
  res.json({ ok: true });
});

// Quizzes CRUD (admin only for modifications)
app.get('/api/quizzes', (req, res) => {
  const rows = db.prepare('SELECT json FROM quizzes ORDER BY createdAt DESC').all();
  res.json(rows.map(r => JSON.parse(r.json)));
});
app.get('/api/quizzes/:id', (req, res) => {
  const r = db.prepare('SELECT json FROM quizzes WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'not found' });
  res.json(JSON.parse(r.json));
});
app.post('/api/quizzes', requireAdmin, (req, res) => {
  const quiz = req.body;
  if (!quiz.id) quiz.id = Date.now().toString(36) + Math.random().toString(36).slice(2,8);
  const now = new Date().toISOString();
  db.prepare('INSERT INTO quizzes (id,json,createdAt) VALUES (?,?,?)').run(quiz.id, JSON.stringify(quiz), now);
  res.json(quiz);
});
app.put('/api/quizzes/:id', requireAdmin, (req, res) => {
  const quiz = req.body;
  db.prepare('UPDATE quizzes SET json = ? WHERE id = ?').run(JSON.stringify(quiz), req.params.id);
  res.json(quiz);
});
app.delete('/api/quizzes/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM quizzes WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Submissions (public)
app.get('/api/submissions', (req, res) => {
  const quizId = req.query.quizId;
  let rows = db.prepare('SELECT json FROM submissions ORDER BY createdAt DESC').all();
  if (quizId) rows = db.prepare('SELECT json FROM submissions WHERE quizId = ? ORDER BY createdAt DESC').all(quizId);
  res.json(rows.map(r => JSON.parse(r.json)));
});
app.post('/api/submissions', (req, res) => {
  const sub = req.body;
  if (!sub.id) sub.id = Date.now().toString(36) + Math.random().toString(36).slice(2,8);
  const now = new Date().toISOString();
  db.prepare('INSERT INTO submissions (id,quizId,json,createdAt) VALUES (?,?,?,?)').run(sub.id, sub.quizId, JSON.stringify(sub), now);
  res.json(sub);
});

// Cert templates (admin modify)
app.get('/api/cert-templates', (req, res) => {
  const rows = db.prepare('SELECT json FROM cert_templates ORDER BY createdAt DESC').all();
  res.json(rows.map(r => JSON.parse(r.json)));
});
app.post('/api/cert-templates', requireAdmin, (req, res) => {
  const t = req.body; if (!t.id) t.id = Date.now().toString(36) + Math.random().toString(36).slice(2,8);
  const now = new Date().toISOString();
  db.prepare('INSERT INTO cert_templates (id,json,createdAt) VALUES (?,?,?)').run(t.id, JSON.stringify(t), now);
  res.json(t);
});
app.put('/api/cert-templates/:id', requireAdmin, (req, res) => {
  const t = req.body; db.prepare('UPDATE cert_templates SET json = ? WHERE id = ?').run(JSON.stringify(t), req.params.id); res.json(t);
});
app.delete('/api/cert-templates/:id', requireAdmin, (req, res) => { db.prepare('DELETE FROM cert_templates WHERE id = ?').run(req.params.id); res.json({ ok: true }); });

// Serve simple admin UI static (optional)
app.use('/admin-ui', express.static(path.join(process.cwd(), 'admin-ui')));

app.listen(PORT, () => console.log(`Server (SQLite) listening on port ${PORT}`));
