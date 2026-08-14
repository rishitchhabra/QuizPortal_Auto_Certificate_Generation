import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import basicAuth from 'express-basic-auth';
import multer from 'multer';
import PizZip from 'pizzip';
import * as XLSX from 'xlsx';
import crypto from 'crypto';
import { createPool, initDb } from './server/db.js';
import { enqueueCertificateJob } from './server/queue.js';
import * as jobsApi from './server/jobs.js';
import { createFileStream, sizeOf, remove } from './server/storage.js';
import { config } from './server/config.js';

const PORT = config.port;

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin';

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));

// Ensure uploads directory exists for PPTX templates
const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'pptx-templates');
const QUESTION_IMAGES_DIR = path.join(process.cwd(), 'uploads', 'question-images');
const TMP_DIR = path.join(process.cwd(), 'tmp');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(QUESTION_IMAGES_DIR)) fs.mkdirSync(QUESTION_IMAGES_DIR, { recursive: true });
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

// Multer for PPTX file uploads
const pptxUpload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.pptx') {
      cb(null, true);
    } else {
      cb(new Error('Only .pptx files are allowed'));
    }
  }
});

const pool = createPool();

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

function parseJson(val, fallback = {}) {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return fallback; }
  }
  return fallback;
}

function mapQuiz(row) {
  const data = parseJson(row.data, {});
  return {
    ...data,
    id: row.id,
    title: row.title || data.title || '',
    description: row.description || data.description || '',
    isPublished: row.is_published !== false
  };
}

function mapSubmission(row) {
  return {
    id: row.id,
    quizId: row.quiz_id,
    participant: parseJson(row.participant, {}),
    answers: parseJson(row.answers, {}),
    score: row.score,
    totalPoints: row.total_points,
    percent: row.percent,
    passed: row.passed,
    timeTaken: row.time_taken,
    questionResults: parseJson(row.question_results, []),
    submittedAt: row.submitted_at?.toISOString?.() || row.submitted_at
  };
}

function mapCertTemplate(row) {
  const data = parseJson(row.data, {});
  return { ...data, id: row.id, name: row.name || data.name || '' };
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

  // Best-effort guard against rapid duplicate submissions (double-click, double-tab,
  // or a retry race) that would otherwise inflate reports. Each student is expected to
  // attempt a quiz once; the race window is short and placement is BEFORE the insert,
  // so 200-400 concurrent requests from distinct students are unaffected.
  const participant = payload.participant || {};
  const dupEmail = participant.email || null;
  const dupUserId = participant.userId || null;
  if (dupEmail || dupUserId) {
    const dup = await pool.query(
      `SELECT 1 FROM submissions
       WHERE quiz_id = $1
         AND submitted_at > now() - interval '30 seconds'
         AND (
           ($2::text IS NOT NULL AND participant->>'email' = $2)
           OR ($3::text IS NOT NULL AND LOWER(participant->>'userId') = LOWER($3))
         )
       LIMIT 1`,
      [payload.quizId, dupEmail, dupUserId]
    );
    if (dup.rows.length > 0) return payload; // duplicate in-flight; treat as idempotent OK
  }

  await pool.query(
    `INSERT INTO submissions
      (id, quiz_id, participant, answers, score, total_points, percent, passed, time_taken, question_results, submitted_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11::timestamptz, now()))
     ON CONFLICT (id) DO NOTHING`,
    [
      payload.id,
      payload.quizId,
      JSON.stringify(payload.participant || {}),
      JSON.stringify(payload.answers || {}),
      payload.score || 0,
      payload.totalPoints || 0,
      payload.percent || 0,
      !!payload.passed,
      payload.timeTaken || 0,
      JSON.stringify(payload.questionResults || []),
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
    [payload.id, payload.name || '', JSON.stringify(payload)]
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

// --- Session token auth ---
function randomToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function createSession(type, staffId, adminId) {
  const token = randomToken();
  await pool.query(
    `INSERT INTO sessions (token, type, staff_id, admin_id, expires_at) VALUES ($1, $2, $3, $4, now() + interval '7 days')`,
    [token, type, staffId || null, adminId || null]
  );
  return token;
}

async function deleteSession(token) {
  await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
}

// Returns { type, staff_id, admin_id } or null if invalid/expired
async function resolveSession(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : (req.headers['x-session-token'] || '');
  if (!token) return null;
  const result = await pool.query('SELECT * FROM sessions WHERE token = $1 AND expires_at > now()', [token]);
  return result.rows[0] || null;
}

const DEFAULT_ADMIN_PERMISSIONS = {
  dashboard: { view: true },
  quizzes: { view: true, create: true, edit: true, delete: true, publish: true, leaderboard: true },
  reports: { batchWise: true, quizWise: true, notAttempted: true, export: true },
  users: { view: true, add: true, edit: true, delete: true, import: true },
  settings: { manageStaff: true, manageRoles: true, manageTemplates: true, system: true }
};

const DEFAULT_TEACHER_PERMISSIONS = {
  dashboard: { view: true },
  quizzes: { view: true, create: false, edit: false, delete: false, publish: false, leaderboard: true },
  reports: { batchWise: true, quizWise: true, notAttempted: true, export: true },
  users: { view: false, add: false, edit: false, delete: false, import: false },
  settings: { manageStaff: false, manageRoles: false, manageTemplates: false, system: false }
};

function hasPermission(perms, moduleKey, action) {
  if (!perms) return false;
  const module = perms[moduleKey];
  if (!module) return false;
  if (module.full === true) return true;
  if (action) return module[action] === true;
  return Object.values(module).some(Boolean);
}

async function requireAuth(req) {
  const session = await resolveSession(req);
  if (!session) {
    const error = new Error('Not authorized');
    error.statusCode = 401;
    throw error;
  }
  return session;
}

async function requireStaffPermission(req, moduleKey, action) {
  const session = await requireAuth(req);
  if (session.type === 'admin') return session;
  const staff = await pool.query('SELECT * FROM staff WHERE id = $1', [session.staff_id]);
  if (!staff.rows[0]) throw Object.assign(new Error('staff not found'), { statusCode: 401 });
  const perms = parseJson(staff.rows[0].permissions, {});
  if (!hasPermission(perms, moduleKey, action)) {
    throw Object.assign(new Error('Permission denied'), { statusCode: 403 });
  }
  return session;
}

app.use('/admin-ui', basicAuth({ users: { [ADMIN_USER]: ADMIN_PASS }, challenge: true }));
app.get('/admin-ui', (req, res) => res.sendFile(path.join(process.cwd(), 'server-admin.html')));

app.get('/api/health', asyncHandler(async (req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true, database: 'postgres' });
}));

app.get('/api/time', (req, res) => {
  res.json({ now: new Date().toISOString(), timestamp: Date.now() });
});

function ensureArray(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch { }
  }
  return [];
}

app.get('/api/admin-config', asyncHandler(async (req, res) => {
  const row = await getAdminConfigRow();
  if (!row) return res.json({ isSetup: false });
  res.json({
    id: row.id,
    adminEmails: ensureArray(row.admin_emails),
    googleClientId: row.google_client_id || '',
    isSetup: row.is_setup
  });
}));

app.post('/api/admin-config', asyncHandler(async (req, res) => {
  const body = req.body || {};
  const existing = await getAdminConfigRow();
  const adminEmails = JSON.stringify(ensureArray(body.adminEmails || (existing?.admin_emails)));

  if (!existing) {
    if (!body.id || !body.passwordHash) return res.status(400).json({ error: 'id and passwordHash required' });
    await pool.query(
      `INSERT INTO admin_config (id, password_hash, admin_emails, google_client_id, is_setup, updated_at)
       VALUES ($1, $2, $3, $4, true, now())`,
      [body.id, body.passwordHash, adminEmails, body.googleClientId || '']
    );
    return res.json({ ok: true });
  }

  if (!body.currentPasswordHash) return res.status(401).json({ error: 'currentPasswordHash required' });
  if (body.currentPasswordHash !== existing.password_hash) return res.status(401).json({ error: 'invalid current password' });

  await pool.query(
    `UPDATE admin_config
     SET id = $1, password_hash = $2, admin_emails = $3, google_client_id = $4, is_setup = true, updated_at = now()
     WHERE id = $5`,
    [
      body.id || existing.id,
      body.passwordHash || existing.password_hash,
      adminEmails,
      body.googleClientId || existing.google_client_id || '',
      existing.id
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
  const token = await createSession('admin', null, row.id);
  res.json({ ok: true, token, type: 'admin', permissions: DEFAULT_ADMIN_PERMISSIONS });
}));

// Teacher / staff login — returns a session token
app.post('/api/staff-login', asyncHandler(async (req, res) => {
  const { userId, passwordHash } = req.body || {};
  const result = await pool.query('SELECT * FROM staff WHERE user_id = $1', [userId || '']);
  const staff = result.rows[0];
  if (!staff) return res.status(401).json({ error: 'invalid id or password' });
  if (staff.password_hash !== passwordHash) return res.status(401).json({ error: 'invalid id or password' });
  const token = await createSession('staff', staff.id, null);
  const perms = parseJson(staff.permissions, DEFAULT_TEACHER_PERMISSIONS);
  res.json({
    ok: true,
    token,
    type: 'staff',
    staff: {
      id: staff.id,
      name: staff.name,
      userId: staff.user_id,
      permissions: perms,
      assignedBatches: parseJson(staff.assigned_batches, [])
    }
  });
}));

// Validate a session token
app.get('/api/auth/me', asyncHandler(async (req, res) => {
  const session = await resolveSession(req);
  if (!session) return res.status(401).json({ error: 'Not authorized' });

  if (session.type === 'admin') {
    const row = await getAdminConfigRow();
    return res.json({ ok: true, type: 'admin', id: row?.id || session.admin_id, permissions: DEFAULT_ADMIN_PERMISSIONS });
  }

  const result = await pool.query('SELECT * FROM staff WHERE id = $1', [session.staff_id]);
  const staff = result.rows[0];
  if (!staff) return res.status(401).json({ error: 'staff not found' });
  res.json({
    ok: true,
    type: 'staff',
    staff: {
      id: staff.id,
      name: staff.name,
      userId: staff.user_id,
      permissions: parseJson(staff.permissions, DEFAULT_TEACHER_PERMISSIONS),
      assignedBatches: parseJson(staff.assigned_batches, [])
    }
  });
}));

// Log out — revoke the current token
app.post('/api/auth/logout', asyncHandler(async (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : (req.headers['x-session-token'] || '');
  if (token) await deleteSession(token);
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
  await requireStaffPermission(req, 'quizzes', 'create');
  res.json(await upsertQuiz(req.body || {}));
}));

app.put('/api/quizzes/:id', asyncHandler(async (req, res) => {
  await requireStaffPermission(req, 'quizzes', 'edit');
  res.json(await upsertQuiz({ ...(req.body || {}), id: req.params.id }));
}));

app.delete('/api/quizzes/:id', asyncHandler(async (req, res) => {
  await requireStaffPermission(req, 'quizzes', 'delete');
  await pool.query('DELETE FROM quizzes WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

app.get('/api/submissions', asyncHandler(async (req, res) => {
  const { quizId, email, userId } = req.query;
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
  if (userId) {
    params.push(userId);
    conditions.push(`participant->>'userId' = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await pool.query(`SELECT * FROM submissions ${where} ORDER BY submitted_at DESC`, params);
  res.json(result.rows.map(mapSubmission));
}));

app.post('/api/submissions', asyncHandler(async (req, res) => {
  const body = req.body || {};

  // Server-side batch enforcement for userid-auth quizzes
  if (body.quizId) {
    const quizResult = await pool.query('SELECT * FROM quizzes WHERE id = $1', [body.quizId]);
    const quizRow = quizResult.rows[0];
    if (quizRow) {
      const quizData = parseJson(quizRow.data, {});
      if (quizData.authMode === 'userid') {
        const allowedBatches = Array.isArray(quizData.allowedBatches) ? quizData.allowedBatches.filter(Boolean) : [];
        if (allowedBatches.length === 0) {
          return res.status(403).json({ error: 'This quiz has no batches mapped. The quiz creator must assign batches before students can submit.' });
        }
        const participantUserId = body.participant?.userId;
        if (participantUserId) {
          const userResult = await pool.query('SELECT class_section FROM users WHERE LOWER(user_id) = LOWER($1)', [participantUserId]);
          const studentRow = userResult.rows[0];
          if (studentRow && !allowedBatches.includes(studentRow.class_section)) {
            return res.status(403).json({ error: `This quiz is restricted to batches: ${allowedBatches.join(', ')}. You are in "${studentRow.class_section || 'Unassigned'}".` });
          }
        }
      }
    }
  }

  res.json(await insertSubmission(body));
}));

/* ============================================================
   Students (users master database)
   ============================================================ */

function generateUserId(name) {
  // Use only the FIRST name for the user ID
  const parts = (name || '').trim().split(/\s+/);
  const firstName = (parts[0] || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 20) || 'student';
  const suffix = Math.floor(100 + Math.random() * 900);
  return `${firstName}${suffix}`;
}

app.get('/api/users', asyncHandler(async (req, res) => {
  await requireStaffPermission(req, 'users', 'view');
  const { classSection, search } = req.query;
  const params = [];
  const conditions = [];
  if (classSection) {
    params.push(classSection);
    conditions.push(`class_section = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(name ILIKE $${params.length} OR user_id ILIKE $${params.length} OR parent_mobile ILIKE $${params.length})`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await pool.query(`SELECT * FROM users ${where} ORDER BY class_section, name LIMIT 2000`, params);
  res.json(result.rows.map(row => ({
    id: row.id,
    name: row.name,
    userId: row.user_id,
    classSection: row.class_section,
    parentMobile: row.parent_mobile,
    createdAt: row.created_at?.toISOString?.() || row.created_at
  })));
}));

app.post('/api/users', asyncHandler(async (req, res) => {
  await requireStaffPermission(req, 'users', 'add');
  const body = req.body || {};
  const name = (body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'name required' });
  const parentMobile = (body.parentMobile || '').trim();
  if (parentMobile) {
    const dup = await pool.query('SELECT 1 FROM users WHERE LOWER(name) = LOWER($1) AND parent_mobile = $2', [name, parentMobile]);
    if (dup.rows.length) return res.status(409).json({ error: 'A student with this name and mobile number already exists' });
  }
  let userId = (body.userId || '').trim();
  if (!userId) {
    // auto-generate, ensure uniqueness
    for (let i = 0; i < 10; i++) {
      const candidate = generateUserId(name);
      const dup = await pool.query('SELECT 1 FROM users WHERE user_id = $1', [candidate]);
      if (dup.rows.length === 0) { userId = candidate; break; }
    }
    if (!userId) return res.status(400).json({ error: 'could not generate unique user id' });
  }
  const result = await pool.query(
    `INSERT INTO users (id, name, user_id, class_section, parent_mobile)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id) DO UPDATE SET name = EXCLUDED.name, class_section = EXCLUDED.class_section, parent_mobile = EXCLUDED.parent_mobile
     RETURNING *`,
    [generateId(), name, userId, body.classSection || '', body.parentMobile || '']
  );
  res.json(result.rows[0]);
}));

app.delete('/api/users/:id', asyncHandler(async (req, res) => {
  await requireStaffPermission(req, 'users', 'delete');
  // Look up the user's user_id so we can cascade-delete their submissions
  const userRow = await pool.query('SELECT user_id FROM users WHERE id = $1', [req.params.id]);
  if (userRow.rows[0]) {
    const uid = userRow.rows[0].user_id;
    await pool.query(`DELETE FROM submissions WHERE LOWER(participant->>'userId') = LOWER($1)`, [uid]);
  }
  await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

app.post('/api/users/bulk-delete', asyncHandler(async (req, res) => {
  await requireStaffPermission(req, 'users', 'delete');
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  if (!ids.length) return res.status(400).json({ error: 'No IDs provided' });
  // Cascade-delete submissions for all users being removed
  const usersResult = await pool.query('SELECT user_id FROM users WHERE id = ANY($1)', [ids]);
  const userIds = usersResult.rows.map(r => r.user_id).filter(Boolean);
  if (userIds.length) {
    await pool.query(
      `DELETE FROM submissions WHERE LOWER(participant->>'userId') = ANY($1)`,
      [userIds.map(u => u.toLowerCase())]
    );
  }
  const result = await pool.query('DELETE FROM users WHERE id = ANY($1)', [ids]);
  res.json({ ok: true, deleted: result.rowCount });
}));

app.get('/api/batches', asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT DISTINCT class_section FROM users WHERE class_section <> '' ORDER BY class_section`
  );
  res.json(result.rows.map(r => r.class_section));
}));

// Bulk import students from Excel (xlsx) or CSV
const userUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
app.post('/api/users/import', userUpload.single('file'), asyncHandler(async (req, res) => {
  await requireStaffPermission(req, 'users', 'import');
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  let rows;
  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  } catch (e) {
    return res.status(400).json({ error: 'Could not parse file: ' + e.message });
  }

  if (!rows.length) return res.status(400).json({ error: 'No rows found in file' });

  let inserted = 0, skipped = 0, duplicates = 0, errors = [];
  const used = new Set();
  const usedCombos = new Set();       // name::mobile
  const usedNameClass = new Set();     // name::classSection (fallback when no mobile)
  const existing = await pool.query('SELECT user_id, name, parent_mobile, class_section FROM users');
  existing.rows.forEach(r => {
    used.add(r.user_id);
    const mob = (r.parent_mobile || '').trim();
    if (mob) usedCombos.add(`${String(r.name).toLowerCase()}::${mob}`);
    const cs = (r.class_section || '').trim();
    if (cs) usedNameClass.add(`${String(r.name).toLowerCase()}::${cs}`);
  });

  // --- Smart column detection ---
  // Handles common Excel headers: S.No / Sno / Sr No, Name / Student Name,
  // Batch / Class / Class-Section / Grade, Parent Mobile / Phone / Mobile No.
  const cols = Object.keys(rows[0]);
  const norm = cols.map(c => c.toLowerCase().replace(/[\s_\-().]/g, ''));

  // Detect S.No column first so we can exclude it from other matches
  const snoIdx = norm.findIndex(c => /^(sno|srno|sr|serial|slno|s)$/.test(c) || c.includes('serial'));

  // Detect Name column (must contain 'name' but NOT be the sno column)
  const nameIdx = norm.findIndex((c, i) => i !== snoIdx && (c.includes('name') || c === 'student'));

  // Detect Batch/Class column (must not collide with name or sno)
  const classIdx = norm.findIndex((c, i) => {
    if (i === snoIdx || i === nameIdx) return false;
    return /batch|class|section|grade|div/.test(c);
  });

  // Detect Mobile column (must not collide with other detected columns)
  const mobileIdx = norm.findIndex((c, i) => {
    if (i === snoIdx || i === nameIdx || i === classIdx) return false;
    return /mobile|phone|parent|contact|whatsapp/.test(c);
  });

  if (nameIdx < 0) return res.status(400).json({ error: 'Missing "Name" column. Found columns: ' + cols.join(', ') + '. Include a column header with "Name" in it.' });

  for (const row of rows) {
    const name = String(row[cols[nameIdx]] || '').trim();
    const classSection = classIdx >= 0 ? String(row[cols[classIdx]] || '').trim().replace(/\s+/g, ' ') : '';
    let parentMobile = mobileIdx >= 0 ? String(row[cols[mobileIdx]] || '').trim() : '';
    // Normalize mobile: remove non-digit chars except leading +
    parentMobile = parentMobile.replace(/[^0-9+]/g, '');

    if (!name) { skipped++; continue; }

    // --- Duplicate detection ---
    // 1. If mobile is present: check name+mobile combo
    if (parentMobile) {
      const combo = `${name.toLowerCase()}::${parentMobile}`;
      if (usedCombos.has(combo)) { duplicates++; continue; }
    }
    // 2. If class is present: check name+class combo
    if (classSection) {
      const nameClassKey = `${name.toLowerCase()}::${classSection}`;
      if (usedNameClass.has(nameClassKey)) { duplicates++; continue; }
    }
    // 3. If neither mobile nor class: check by exact name match in this import batch
    if (!parentMobile && !classSection) {
      const plainKey = `${name.toLowerCase()}::__noclass__`;
      if (usedNameClass.has(plainKey)) { duplicates++; continue; }
    }

    let userId = '';
    for (let i = 0; i < 20; i++) {
      const candidate = generateUserId(name);
      if (!used.has(candidate)) { userId = candidate; break; }
    }
    if (!userId) { errors.push(name); continue; }
    used.add(userId);
    if (parentMobile) usedCombos.add(`${name.toLowerCase()}::${parentMobile}`);
    if (classSection) usedNameClass.add(`${name.toLowerCase()}::${classSection}`);
    if (!parentMobile && !classSection) usedNameClass.add(`${name.toLowerCase()}::__noclass__`);

    try {
      await pool.query(
        `INSERT INTO users (id, name, user_id, class_section, parent_mobile) VALUES ($1,$2,$3,$4,$5)`,
        [generateId(), name, userId, classSection, parentMobile]
      );
      inserted++;
    } catch (e) {
      if (e.code === '23505') { duplicates++; } else { errors.push(name); }
    }
  }

  res.json({
    ok: true, inserted, skipped, duplicates,
    errors: errors.slice(0, 20),
    detectedColumns: { name: cols[nameIdx] || null, batch: classIdx >= 0 ? cols[classIdx] : null, mobile: mobileIdx >= 0 ? cols[mobileIdx] : null, sno: snoIdx >= 0 ? cols[snoIdx] : null },
    batches: await pool.query('SELECT DISTINCT class_section FROM users WHERE class_section <> \'\' ORDER BY class_section').then(r => r.rows.map(x => x.class_section))
  });
}));

// Look up a student by user ID (used by quiz User-ID login)
app.post('/api/users/verify', asyncHandler(async (req, res) => {
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'user id required' });
  const result = await pool.query('SELECT * FROM users WHERE LOWER(user_id) = LOWER($1)', [String(userId).trim()]);
  if (!result.rows[0]) return res.status(404).json({ error: 'User not found. Check your User ID and try again.' });
  const row = result.rows[0];
  res.json({ ok: true, user: { id: row.id, name: row.name, userId: row.user_id, classSection: row.class_section, parentMobile: row.parent_mobile } });
}));

/* ============================================================
   Staff / teachers
   ============================================================ */

app.get('/api/staff', asyncHandler(async (req, res) => {
  await requireStaffPermission(req, 'settings', 'manageStaff');
  const result = await pool.query('SELECT id, name, user_id, permissions, assigned_batches, created_at FROM staff ORDER BY created_at DESC');
  res.json(result.rows.map(row => ({
    id: row.id,
    name: row.name,
    userId: row.user_id,
    permissions: parseJson(row.permissions, DEFAULT_TEACHER_PERMISSIONS),
    assignedBatches: parseJson(row.assigned_batches, []),
    createdAt: row.created_at?.toISOString?.() || row.created_at
  })));
}));

app.post('/api/staff', asyncHandler(async (req, res) => {
  await requireStaffPermission(req, 'settings', 'manageStaff');
  const body = req.body || {};
  if (!body.name || !body.userId || !body.passwordHash) return res.status(400).json({ error: 'name, userId and passwordHash required' });
  const dup = await pool.query('SELECT 1 FROM staff WHERE user_id = $1', [body.userId]);
  if (dup.rows.length) return res.status(409).json({ error: 'User ID already exists' });
  await pool.query(
    `INSERT INTO staff (id, name, user_id, password_hash, permissions, assigned_batches) VALUES ($1,$2,$3,$4,$5,$6)`,
    [generateId(), body.name, body.userId, body.passwordHash, JSON.stringify(body.permissions || DEFAULT_TEACHER_PERMISSIONS), JSON.stringify(body.assignedBatches || [])]
  );
  res.json({ ok: true });
}));

app.put('/api/staff/:id', asyncHandler(async (req, res) => {
  await requireStaffPermission(req, 'settings', 'manageStaff');
  const body = req.body || {};
  const result = await pool.query('SELECT * FROM staff WHERE id = $1', [req.params.id]);
  if (!result.rows[0]) return res.status(404).json({ error: 'staff not found' });
  const current = result.rows[0];
  await pool.query(
    `UPDATE staff SET name = $1, user_id = $2, password_hash = $3, permissions = $4, assigned_batches = $5 WHERE id = $6`,
    [
      body.name || current.name,
      body.userId || current.user_id,
      body.passwordHash || current.password_hash,
      JSON.stringify(body.permissions || parseJson(current.permissions, {})),
      JSON.stringify(body.assignedBatches || parseJson(current.assigned_batches, [])),
      req.params.id
    ]
  );
  res.json({ ok: true });
}));

app.delete('/api/staff/:id', asyncHandler(async (req, res) => {
  await requireStaffPermission(req, 'settings', 'manageStaff');
  await pool.query('DELETE FROM staff WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

/* ============================================================
   Question Image Upload
   ============================================================ */

const questionImageUpload = multer({
  dest: QUESTION_IMAGES_DIR,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only image files (jpg, png, gif, webp) are allowed'));
  }
});

app.post('/api/question-images', questionImageUpload.single('image'), asyncHandler(async (req, res) => {
  await requireStaffPermission(req, 'quizzes', 'create');
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  const ext = path.extname(req.file.originalname).toLowerCase();
  const finalName = `${generateId()}${ext}`;
  const finalPath = path.join(QUESTION_IMAGES_DIR, finalName);
  fs.renameSync(req.file.path, finalPath);
  res.json({ ok: true, url: `/static/question-images/${finalName}` });
}));

/* ============================================================
   Reports (batch / class-wise and quiz-wise)
   ============================================================ */

app.get('/api/reports/:quizId', asyncHandler(async (req, res) => {
  const session = await requireAuth(req);
  const quizResult = await pool.query('SELECT * FROM quizzes WHERE id = $1', [req.params.quizId]);
  const quiz = quizResult.rows[0];
  if (!quiz) return res.status(404).json({ error: 'quiz not found' });
  const quizData = parseJson(quiz.data, {});

  // If a staff member, restrict to their assigned batches
  let allowedBatches = null;
  if (session.type === 'staff') {
    const staff = await pool.query('SELECT * FROM staff WHERE id = $1', [session.staff_id]);
    const perms = parseJson(staff.rows[0]?.permissions, {});
    if (!hasPermission(perms, 'reports', 'batchWise')) throw Object.assign(new Error('Permission denied'), { statusCode: 403 });
    const assigned = parseJson(staff.rows[0]?.assigned_batches, []);
    if (assigned.length) allowedBatches = assigned;
  }

  const subsResult = await pool.query('SELECT * FROM submissions WHERE quiz_id = $1 ORDER BY percent DESC, time_taken ASC', [req.params.quizId]);
  const subs = subsResult.rows.map(mapSubmission);

  // Quiz may restrict to certain batches (users data)
  let quizBatches = (quizData.allowedBatches || []).filter(Boolean);
  if (allowedBatches) quizBatches = quizBatches.filter(b => allowedBatches.includes(b));

  let users = [];
  if (quizBatches.length) {
    const usersResult = await pool.query('SELECT * FROM users WHERE class_section = ANY($1) ORDER BY class_section, name', [quizBatches]);
    users = usersResult.rows.map(r => ({ id: r.id, name: r.name, userId: r.user_id, classSection: r.class_section, parentMobile: r.parent_mobile }));
  }

  // Mark submissions by userId when available
  const attemptedSet = new Set();
  const byUser = {};
  subs.forEach(s => {
    const uid = s.participant?.userId || s.participant?.email;
    if (uid) { attemptedSet.add(String(uid).toLowerCase()); byUser[String(uid).toLowerCase()] = s; }
  });

  // Batch-wise report
  const batches = {};
  (quizBatches.length ? quizBatches : Array.from(new Set(users.map(u => u.classSection)))).forEach(b => {
    batches[b] = {
      batch: b,
      totalStudents: 0,
      attempted: 0,
      notAttempted: 0,
      passed: 0,
      avgPercent: 0,
      maxPercent: 0,
      minPercent: 0
    };
  });
  users.forEach(u => {
    const key = u.classSection;
    if (!batches[key]) batches[key] = { batch: key, totalStudents: 0, attempted: 0, notAttempted: 0, passed: 0, avgPercent: 0, maxPercent: 0, minPercent: 100 };
    const b = batches[key];
    b.totalStudents++;
    const attempted = attemptedSet.has(String(u.userId).toLowerCase());
    if (attempted) {
      b.attempted++;
      const sub = byUser[String(u.userId).toLowerCase()];
      if (sub.passed) b.passed++;
      b.avgPercent += sub.percent;
      b.maxPercent = Math.max(b.maxPercent, sub.percent);
      b.minPercent = Math.min(b.minPercent, sub.percent);
    } else {
      b.notAttempted++;
    }
  });
  Object.values(batches).forEach(b => {
    if (b.attempted > 0) b.avgPercent = Math.round(b.avgPercent / b.attempted);
    if (b.minPercent === 100 && b.attempted === 0) b.minPercent = 0;
  });

  // Student-level rows grouped by batch
  const studentRows = users.map(u => {
    const attempted = attemptedSet.has(String(u.userId).toLowerCase());
    const sub = byUser[String(u.userId).toLowerCase()];
    return {
      id: u.id,
      name: u.name,
      userId: u.userId,
      classSection: u.classSection,
      attempted,
      score: sub ? sub.score : null,
      totalPoints: sub ? sub.totalPoints : null,
      percent: sub ? sub.percent : null,
      passed: sub ? sub.passed : false,
      timeTaken: sub ? sub.timeTaken : null,
      submittedAt: sub ? sub.submittedAt : null
    };
  }).sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1));

  const attemptedRows = studentRows.filter(r => r.attempted);
  res.json({
    quiz: { id: quiz.id, title: quiz.title || quizData.title || '', questionsCount: quizData.questions?.length || 0 },
    totalStudents: studentRows.length,
    totalAttempted: attemptedRows.length,
    notAttemptedCount: studentRows.length - attemptedRows.length,
    overallAverage: attemptedRows.length ? Math.round(attemptedRows.reduce((s, r) => s + (r.percent || 0), 0) / attemptedRows.length) : 0,
    passCount: attemptedRows.filter(r => r.passed).length,
    batches: Object.values(batches),
    studentRows
  });
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
  // Also remove PPTX file from disk if exists
  const existing = await pool.query('SELECT * FROM cert_templates WHERE id = $1', [req.params.id]);
  if (existing.rows[0]) {
    const data = parseJson(existing.rows[0].data, {});
    if (data.pptxFilename) {
      const filePath = path.join(UPLOADS_DIR, data.pptxFilename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  }
  await pool.query('DELETE FROM cert_templates WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

// ========== PPTX Certificate Upload & Generation ==========

// Upload a PPTX file as a certificate template
app.post('/api/cert-templates/upload-pptx', pptxUpload.single('pptx'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const templateId = req.body.id || generateId();
  const templateName = req.body.name || 'Untitled PPTX Template';

  // Rename uploaded file to templateId.pptx
  const finalFilename = `${templateId}.pptx`;
  const finalPath = path.join(UPLOADS_DIR, finalFilename);
  fs.renameSync(req.file.path, finalPath);

  // Quick-validate the PPTX by trying to open it with PizZip
  try {
    const buf = fs.readFileSync(finalPath);
    new PizZip(buf);
  } catch (e) {
    fs.unlinkSync(finalPath);
    return res.status(400).json({ error: 'Invalid PPTX file: ' + e.message });
  }

  // Save template metadata to DB
  const payload = {
    id: templateId,
    name: templateName,
    type: 'pptx',
    pptxFilename: finalFilename,
    elements: [],
    backgroundImage: '',
    createdAt: new Date().toISOString()
  };
  await upsertCertTemplate(payload);

  res.json({ ok: true, id: templateId, name: templateName, type: 'pptx' });
}));

// Enqueue a certificate generation. Returns 202 + jobId immediately; the worker
// renders the PDF asynchronously and the client polls GET /api/certificate-status/:jobId.
app.post('/api/generate-certificate', asyncHandler(async (req, res) => {
  const { templateId, data } = req.body;
  if (!templateId) return res.status(400).json({ error: 'templateId required' });

  const result = await pool.query('SELECT * FROM cert_templates WHERE id = $1', [templateId]);
  if (!result.rows[0]) return res.status(404).json({ error: 'Template not found' });

  const template = mapCertTemplate(result.rows[0]);
  if (template.type !== 'pptx' || !template.pptxFilename) {
    return res.status(400).json({ error: 'Not a PPTX template' });
  }

  const pptxPath = path.join(UPLOADS_DIR, template.pptxFilename);
  if (!fs.existsSync(pptxPath)) {
    return res.status(404).json({ error: 'PPTX file not found on server' });
  }

  const jobId = generateId();
  await jobsApi.createJob({ jobId, templateId, data });
  try {
    await enqueueCertificateJob({ jobId, templateId, data });
  } catch (err) {
    // Redis/queue unavailable — record the failure so status polling reports it
    // instead of leaving a queued job that will never run.
    await jobsApi.updateJob(jobId, { status: 'failed', error: 'Queue unavailable: ' + (err.message || 'unknown') });
    throw err;
  }

  res.status(202).json({ success: true, jobId, status: 'queued' });
}));

// Polled by the client. Returns the current lifecycle status; when done, includes
// downloadUrl + previewUrl for streaming (no base64 payloads).
app.get('/api/certificate-status/:jobId', asyncHandler(async (req, res) => {
  const row = await jobsApi.getJob(req.params.jobId);
  if (!row) return res.status(404).json({ success: false, error: 'Job not found' });

  const status = row.status;
  const payload = { success: true, jobId: row.job_id, status };

  if (status === 'done') {
    payload.filename = row.filename || 'Certificate.pdf';
    payload.downloadUrl = `/api/download-certificate/${row.job_id}`;
    if (row.preview_path) payload.previewUrl = `/api/certificate-preview/${row.job_id}`;
  } else if (status === 'failed') {
    payload.error = row.error || 'Certificate generation failed';
  }
  res.json(payload);
}));

// Stream the generated PDF to the client, then remove the file + DB row so no
// certificate persists on disk. createReadStream keeps memory flat for large PDFs.
app.get('/api/download-certificate/:jobId', asyncHandler(async (req, res) => {
  const row = await jobsApi.getJob(req.params.jobId);
  if (!row || row.status !== 'done' || !row.certificate_path) {
    return res.status(404).json({ success: false, error: 'Certificate not found or not ready yet' });
  }

  const stream = createFileStream(row.certificate_path);
  if (!stream) {
    await jobsApi.deleteJob(row.job_id);
    return res.status(410).json({ success: false, error: 'Certificate file has expired' });
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${row.filename || 'Certificate.pdf'}"`);
  res.setHeader('Content-Length', await sizeOf(row.certificate_path));

  // Delete the transient file + row once the stream has flushed (or the client
  // disconnected), guaranteeing nothing is permanently stored.
  const cleanup = () => {
    remove(row.certificate_path);
    remove(row.preview_path);
    jobsApi.deleteJob(row.job_id);
  };
  res.on('close', cleanup);
  stream.on('error', () => { cleanup(); res.status(500).end(); });
  stream.pipe(res);
}));

// Stream the first-slide preview PNG (used by the <img> in the results panel).
app.get('/api/certificate-preview/:jobId', asyncHandler(async (req, res) => {
  const row = await jobsApi.getJob(req.params.jobId);
  if (!row || !row.preview_path) {
    return res.status(404).json({ success: false, error: 'Preview not available' });
  }

  const stream = createFileStream(row.preview_path);
  if (!stream) {
    return res.status(410).json({ success: false, error: 'Preview has expired' });
  }

  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'private, max-age=60');
  res.setHeader('Content-Length', await sizeOf(row.preview_path));
  stream.on('error', () => res.status(500).end());
  stream.pipe(res);
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

// Serve question images from uploads/question-images
app.use('/static/question-images', express.static(QUESTION_IMAGES_DIR));
app.use('/static', express.static(path.join(process.cwd(), 'public')));
app.use(express.static(path.join(process.cwd(), 'dist')));
app.get('*', (req, res) => res.sendFile(path.join(process.cwd(), 'dist', 'index.html')));

app.use((error, req, res, next) => {
  console.error(error);
  res.status(error.statusCode || 500).json({ error: error.message || 'Server error' });
});

initDb(pool)
  .then(() => migrateLegacyJson())
  .then(() => {
    app.listen(PORT, () => console.log(`PostgreSQL server listening on port ${PORT}`));
  })
  .catch((error) => {
    console.error('Failed to initialize PostgreSQL database:', error);
    process.exit(1);
  });
