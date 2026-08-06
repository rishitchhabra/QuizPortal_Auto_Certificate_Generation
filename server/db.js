// PostgreSQL pool singleton + schema bootstrap.
// server.js (API) and server/worker.js each create their OWN pool via createPool()
// because they are separate processes. Within a process the pool is cached on
// globalThis so repeated imports never leak extra clients.

import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

let cachedPool = null;

export function createPool() {
  if (cachedPool) return cachedPool;
  cachedPool = new Pool({
    connectionString: config.databaseUrl,
    ssl: config.dbSsl,
    max: config.pgPoolMax,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });
  cachedPool.on('error', (err) => {
    console.error('[pg] Unexpected pool error:', err.message);
  });
  return cachedPool;
}

// certificate_jobs tracks the lifecycle of every certificate generation so the
// API can answer GET /api/certificate-status/:jobId without round-tripping into
// Redis, and so abandoned files can be swept from disk deterministically.
const CREATE_CERTIFICATE_JOBS_SQL = `
  CREATE TABLE IF NOT EXISTS certificate_jobs (
    job_id TEXT PRIMARY KEY,
    template_id TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'queued',
    attempts INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    certificate_path TEXT,
    preview_path TEXT,
    filename TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

export async function initDb(pool = createPool()) {
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      user_id TEXT NOT NULL UNIQUE,
      class_section TEXT NOT NULL DEFAULT '',
      parent_mobile TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS staff (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      user_id TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL DEFAULT '',
      permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
      assigned_batches JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      type TEXT NOT NULL DEFAULT 'admin',
      staff_id TEXT,
      admin_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '7 days'
    );
  `);

  await pool.query(CREATE_CERTIFICATE_JOBS_SQL);
  await pool.query('CREATE INDEX IF NOT EXISTS submissions_quiz_id_idx ON submissions(quiz_id);');
  await pool.query('CREATE INDEX IF NOT EXISTS certificate_jobs_status_idx ON certificate_jobs(status);');
}
