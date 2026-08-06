// Central configuration for the certificate queue refactor.
// Both the API (server.js) and the worker (server/worker.js) read from here so
// queue, storage, LibreOffice and Postgres settings stay in sync across processes.

import path from 'path';

const ROOT = process.cwd();

export const config = {
  // HTTP API
  port: parseInt(process.env.PORT || '3001', 10),

  // PostgreSQL
  databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/certificate',
  dbSsl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  pgPoolMax: parseInt(process.env.PG_POOL_MAX || '10', 10),

  // Redis (BullMQ). Supports redis:// with optional username:password@host:port/db,
  // or a tls: variant for managed providers (REDIS_TLS=true wraps the URL in TLS).
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  redisTls: process.env.REDIS_TLS === 'true',
  redisPassword: process.env.REDIS_PASSWORD || undefined,
  redisTlsCa: process.env.REDIS_TLS_CA || undefined,

  // BullMQ queue name
  certificateQueueName: process.env.CERTIFICATE_QUEUE_NAME || 'certificate-jobs',

  // Worker pool sizing. Each PM2 worker process runs up to WORKER_CONCURRENCY
  // certificate jobs at once; with 2 worker processes on the VPS this yields
  // 6-8 concurrent LibreOffice conversions max. BullMQ applies backpressure by
  // simply not picking up more jobs than this number of concurrent slots.
  workerConcurrency: parseInt(process.env.WORKER_CONCURRENCY || '3', 10),
  jobMaxAttempts: parseInt(process.env.JOB_MAX_ATTEMPTS || '3', 10),

  // LibreOffice
  sofficePath: process.env.SOFFICE_PATH || undefined,
  sofficeTimeoutMs: parseInt(process.env.SOFFICE_TIMEOUT_MS || '60000', 10),

  // Transient certificate storage. PDFs + preview PNGs live here ONLY while the
  // download/preview window is open; files and DB rows are removed after the
  // client downloads or after they age out of STORAGE_TTL_MS.
  storageDir: process.env.STORAGE_DIR || path.join(ROOT, 'storage', 'certificates'),
  storageTtlMs: parseInt(process.env.STORAGE_TTL_MS || String(60 * 60 * 1000), 10),
  storageSweepIntervalMs: parseInt(process.env.STORAGE_SWEEP_MS || String(5 * 60 * 1000), 10),

  // LibreOffice user profile dir. Using one profile per worker process avoids the
  // ".soffice already locked" error that plagues concurrent headless conversions
  // sharing a single profile. PID is unique per process, so workers never collide.
  loProfileDir: process.env.LO_PROFILE_DIR || path.join(ROOT, 'tmp', `lo_profile_${process.pid}`)
};

export const TMP_DIR = path.join(ROOT, 'tmp');
