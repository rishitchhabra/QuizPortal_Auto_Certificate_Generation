import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { Pool } from 'pg';
import basicAuth from 'express-basic-auth';

const PORT = process.env.PORT || 3001;
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/certificate';
const DB_SSL = process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false;

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin';

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));

const pool = new Pool({ connectionString: DATABASE_URL, ssl: DB_SSL });

const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function toBoolean(value) {
  return value === true || value === 1 || value === '1';
}

function requireIdentifier(value, label = 'identifier') {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value || '')) {
    const error = new Error(`Invalid ${label}. Use letters, numbers, and underscores, starting with a letter or underscore.`);
    error.statusCode = 400;
    throw error;
  }
  return value;
}

function quoteIdentifier(value) {
  return `"${requireIdentifier(value).replace(/"/g, '""')}"`;
}

function normalizeColumnType(type) {
  const normalized = String(type || '').trim().toUpperCase();
  const allowed = new Map([
    ['TEXT', 'TEXT'],
    ['INTEGER', 'INTEGER'],
    ['BIGINT', 'BIGINT'],
    ['NUMERIC', 'NUMERIC'],
    ['BOOLEAN', 'BOOLEAN'],
    ['DATE', 'DATE'],
    ['TIMESTAMP', 'TIMESTAMPTZ'],
    ['TIMESTAMPTZ', 'TIMESTAMPTZ'],
    ['JSON', 'JSONB'],
    ['JSONB', 'JSONB'],
    ['UUID', 'UUID']
  ]);
  if (!allowed.has(normalized)) {
    const error = new Error(`Unsupported column type "${type}"`);
    error.statusCode = 400;
    throw error;
  }
  return allowed.get(normalized);
}

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS quizzes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      is_published BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
      participant JSONB NOT NULL DEFAULT '{}'::jsonb,
      answers JSONB NOT NULL DEFAULT '{}'::jsonb,
      score INTEGER NOT NULL DEFAULT 0,
      total_points INTEGER NOT NULL DEFAULT 0,
      percent INTEGER NOT NULL DEFAULT 0,
      passed BOOLEAN NOT NULL DEFAULT false,
      time_taken INTEGER NOT NULL DEFAULT 0,
      question_results JSONB NOT NULL DEFAULT '[]'::jsonb,
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cert_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_config (
      id TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL DEFAULT '',
      admin_emails JSONB NOT NULL DEFAULT '[]'::jsonb,
      google_client_id TEXT NOT NULL DEFAULT '',
      is_setup BOOLEAN NOT NULL DEFAULT false,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query('CREATE INDEX IF NOT EXISTS submissions_quiz_id_idx ON submissions(quiz_id);');
  await migrateLegacyJson();
}

async function migrateLegacyJson() {
  const legacyPath = path.join(process.cwd(), 'data', 'db.json');
  if (!fs.existsSync(legacyPath)) return;

  try {
    const legacy = JSON.parse(fs.readFileSync(legacyPath, 'utf8') || '{}');
    const quizCount = await pool.query('SELECT COUNT(*)::int AS count FROM quizzes');
    if (quizCount.rows[0].count === 0 && Array.isArray(legacy.quizzes)) {
      for (const quiz of legacy.quizzes) await upsertQuiz(quiz);
    }

    const submissionCount = await pool.query('SELECT COUNT(*)::int AS count FROM submissions');
    if (submissionCount.rows[0].count === 0 && Array.isArray(legacy.submissions)) {
      for (const submission of legacy.submissions) await insertSubmission(submission);
    }

    const templateCount = await pool.query('SELECT COUNT(*)::int AS count FROM cert_templates');
    if (templateCount.rows[0].count === 0 && Array.isArray(legacy.certificateTemplates)) {
      for (const template of legacy.certificateTemplates) await upsertCertTemplate(template);
    }
  } catch (error) {
    console.warn('Legacy JSON migration skipped:', error.message);
  }
}

function mapQuiz(row) {
  return {
    ...(row.data || {}),
    id: row.id,
    title: row.title,
    description: row.description,
    isPublished: row.is_published
  };
}

function mapSubmission(row) {
  return {
    id: row.id,
    quizId: row.quiz_id,
    participant: row.participant || {},
    answers: row.answers || {},
    score: row.score,
    totalPoints: row.total_points,
    percent: row.percent,
    passed: row.passed,
    timeTaken: row.time_taken,
    questionResults: row.question_results || [],
    submittedAt: row.submitted_at?.toISOString?.() || row.submitted_at
  };
}

function mapCertTemplate(row) {
  return { ...(row.data || {}), id: row.id, name: row.name };
}

async function upsertQuiz(quiz) {
  const payload = { ...quiz, id: quiz.id || generateId() };
  await pool.query(
    `INSERT INTO quizzes (id, title, description, data, is_published, updated_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (id) DO UPDATE SET
       title = EXCLUDED.title,
       description = EXCLUDED.description,
       data = EXCLUDED.data,
       is_published = EXCLUDED.is_published,
       updated_at = now()`,
    [payload.id, payload.title || '', payload.description || '', payload, payload.isPublished !== false]
  );
  return payload;
}

async function insertSubmission(submission) {
  const payload = { ...submission, id: submission.id || generateId() };
  await pool.query(
    `INSERT INTO submissions
      (id, quiz_id, participant, answers, score, total_points, percent, passed, time_taken, question_results, submitted_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11::timestamptz, now()))
     ON CONFLICT (id) DO NOTHING`,
    [
      payload.id,
      payload.quizId,
      payload.participant || {},
      payload.answers || {},
      payload.score || 0,
      payload.totalPoints || 0,
      payload.percent || 0,
      !!payload.passed,
      payload.timeTaken || 0,
      payload.questionResults || [],
      payload.submittedAt || null
    ]
  );
  return payload;
}

async function upsertCertTemplate(template) {
  const payload = { ...template, id: template.id || generateId() };
  await pool.query(
    `INSERT INTO cert_templates (id, name, data, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       data = EXCLUDED.data,
       updated_at = now()`,
    [payload.id, payload.name || '', payload]
  );
  return payload;
}

async function getAdminConfigRow() {
  const result = await pool.query('SELECT * FROM admin_config LIMIT 1');
  return result.rows[0] || null;
}

async function verifyAdminPassword(req) {
  const provided = req.body?.currentPasswordHash || req.headers['x-admin-password-hash'];
  const admin = await getAdminConfigRow();
  if (!admin || !admin.password_hash) {
    const error = new Error('admin not configured');
    error.statusCode = 401;
    throw error;
  }
  if (!provided || provided !== admin.password_hash) {
    const error = new Error('invalid admin password');
    error.statusCode = 401;
    throw error;
  }
}

app.use('/admin-ui', basicAuth({ users: { [ADMIN_USER]: ADMIN_PASS }, challenge: true }));
app.get('/admin-ui', (req, res) => res.sendFile(path.join(process.cwd(), 'server-admin.html')));

app.get('/api/health', asyncHandler(async (req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true, database: 'postgres' });
}));

app.get('/api/admin-config', asyncHandler(async (req, res) => {
  const row = await getAdminConfigRow();
  if (!row) return res.json({ isSetup: false });
  res.json({
    id: row.id,
    adminEmails: row.admin_emails || [],
    googleClientId: row.google_client_id || '',
    isSetup: row.is_setup
  });
}));

app.post('/api/admin-config', asyncHandler(async (req, res) => {
  const body = req.body || {};
  const existing = await getAdminConfigRow();

  if (!existing) {
    if (!body.id || !body.passwordHash) return res.status(400).json({ error: 'id and passwordHash required' });
    await pool.query(
      `INSERT INTO admin_config (id, password_hash, admin_emails, google_client_id, is_setup, updated_at)
       VALUES ($1, $2, $3, $4, true, now())`,
      [body.id, body.passwordHash, body.adminEmails || [], body.googleClientId || '']
    );
    return res.json({ ok: true });
  }

  if (!body.currentPasswordHash) return res.status(401).json({ error: 'currentPasswordHash required' });
  if (body.currentPasswordHash !== existing.password_hash) return res.status(401).json({ error: 'invalid current password' });

  await pool.query(
    `UPDATE admin_config
     SET id = $1, password_hash = $2, admin_emails = $3, google_client_id = $4, is_setup = true, updated_at = now()`,
    [
      body.id || existing.id,
      body.passwordHash || existing.password_hash,
      body.adminEmails || existing.admin_emails || [],
      body.googleClientId || existing.google_client_id || ''
    ]
  );
  res.json({ ok: true });
}));

app.post('/api/admin-login', asyncHandler(async (req, res) => {
  const { id, passwordHash } = req.body || {};
  const row = await getAdminConfigRow();
  if (!row || !row.password_hash) return res.status(401).json({ error: 'not configured' });
  if (row.id !== id) return res.status(401).json({ error: 'invalid id' });
  if (row.password_hash !== passwordHash) return res.status(401).json({ error: 'invalid password' });
  res.json({ ok: true });
}));

app.get('/api/quizzes', asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT * FROM quizzes ORDER BY created_at DESC');
  res.json(result.rows.map(mapQuiz));
}));

app.get('/api/quizzes/:id', asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT * FROM quizzes WHERE id = $1', [req.params.id]);
  if (!result.rows[0]) return res.status(404).json({ error: 'not found' });
  res.json(mapQuiz(result.rows[0]));
}));

app.post('/api/quizzes', asyncHandler(async (req, res) => {
  res.json(await upsertQuiz(req.body || {}));
}));

app.put('/api/quizzes/:id', asyncHandler(async (req, res) => {
  res.json(await upsertQuiz({ ...(req.body || {}), id: req.params.id }));
}));

app.delete('/api/quizzes/:id', asyncHandler(async (req, res) => {
  await pool.query('DELETE FROM quizzes WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

app.get('/api/submissions', asyncHandler(async (req, res) => {
  const { quizId, email } = req.query;
  const params = [];
  const conditions = [];

  if (quizId) {
    params.push(quizId);
    conditions.push(`quiz_id = $${params.length}`);
  }
  if (email) {
    params.push(email);
    conditions.push(`participant->>'email' = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await pool.query(`SELECT * FROM submissions ${where} ORDER BY submitted_at DESC`, params);
  res.json(result.rows.map(mapSubmission));
}));

app.post('/api/submissions', asyncHandler(async (req, res) => {
  res.json(await insertSubmission(req.body || {}));
}));

app.get('/api/cert-templates', asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT * FROM cert_templates ORDER BY created_at DESC');
  res.json(result.rows.map(mapCertTemplate));
}));

app.post('/api/cert-templates', asyncHandler(async (req, res) => {
  res.json(await upsertCertTemplate(req.body || {}));
}));

app.put('/api/cert-templates/:id', asyncHandler(async (req, res) => {
  res.json(await upsertCertTemplate({ ...(req.body || {}), id: req.params.id }));
}));

app.delete('/api/cert-templates/:id', asyncHandler(async (req, res) => {
  await pool.query('DELETE FROM cert_templates WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

app.get('/api/tables', asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  res.json(result.rows.map((row) => row.table_name));
}));

app.get('/api/tables/:name/schema', asyncHandler(async (req, res) => {
  const table = requireIdentifier(req.params.name, 'table name');
  const result = await pool.query(
    `SELECT column_name, data_type, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [table]
  );
  res.json(result.rows);
}));

app.post('/api/tables', asyncHandler(async (req, res) => {
  await verifyAdminPassword(req);
  const table = quoteIdentifier(req.body?.name);
  const columns = Array.isArray(req.body?.columns) ? req.body.columns : [];
  if (!columns.length) return res.status(400).json({ error: 'columns required' });

  const columnSql = columns.map((column) => {
    const name = quoteIdentifier(column.name);
    const type = normalizeColumnType(column.type);
    const nullable = column.required ? 'NOT NULL' : '';
    return `${name} ${type} ${nullable}`.trim();
  });

  await pool.query(`CREATE TABLE IF NOT EXISTS ${table} (
    id BIGSERIAL PRIMARY KEY,
    ${columnSql.join(',\n    ')},
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  res.json({ ok: true });
}));

app.get('/api/tables/:name/rows', asyncHandler(async (req, res) => {
  const table = quoteIdentifier(req.params.name);
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const result = await pool.query(`SELECT * FROM ${table} ORDER BY 1 DESC LIMIT $1`, [limit]);
  res.json(result.rows);
}));

app.post('/api/tables/:name/rows', asyncHandler(async (req, res) => {
  await verifyAdminPassword(req);
  const table = quoteIdentifier(req.params.name);
  const data = { ...(req.body || {}) };
  delete data.currentPasswordHash;

  const columns = Object.keys(data).filter((column) => column !== 'id' && column !== 'created_at');
  if (!columns.length) return res.status(400).json({ error: 'no row data provided' });

  columns.forEach((column) => requireIdentifier(column, 'column name'));
  const placeholders = columns.map((_, index) => `$${index + 1}`);
  const values = columns.map((column) => data[column]);
  const result = await pool.query(
    `INSERT INTO ${table} (${columns.map(quoteIdentifier).join(', ')})
     VALUES (${placeholders.join(', ')})
     RETURNING *`,
    values
  );
  res.json(result.rows[0]);
}));

app.delete('/api/tables/:name/rows/:id', asyncHandler(async (req, res) => {
  await verifyAdminPassword(req);
  const table = quoteIdentifier(req.params.name);
  await pool.query(`DELETE FROM ${table} WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
}));

app.delete('/api/tables/:name', asyncHandler(async (req, res) => {
  await verifyAdminPassword(req);
  const tableName = requireIdentifier(req.params.name, 'table name');
  if (['admin_config', 'cert_templates', 'quizzes', 'submissions'].includes(tableName)) {
    return res.status(400).json({ error: 'Core app tables cannot be dropped from the GUI' });
  }
  await pool.query(`DROP TABLE IF EXISTS ${quoteIdentifier(tableName)}`);
  res.json({ ok: true });
}));

app.use('/static', express.static(path.join(process.cwd(), 'public')));
app.use(express.static(path.join(process.cwd(), 'dist')));
app.get('*', (req, res) => res.sendFile(path.join(process.cwd(), 'dist', 'index.html')));

app.use((error, req, res, next) => {
  console.error(error);
  res.status(error.statusCode || 500).json({ error: error.message || 'Server error' });
});

initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`PostgreSQL server listening on port ${PORT}`));
  })
  .catch((error) => {
    console.error('Failed to initialize PostgreSQL database:', error);
    process.exit(1);
  });
