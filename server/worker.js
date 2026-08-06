// BullMQ worker process — consumes certificate jobs.
//
// PM2 runs 2 instances of this file (cluster mode, 2 vCPUs). Each instance
// processes up to WORKER_CONCURRENCY jobs at once (default 3) for a ceiling of
// ~6 concurrent LibreOffice conversions across the VPS. BullMQ only pulls a new
// job into a free concurrency slot, which is what produces backpressure instead
// of an unbounded soffice spawn storm.

import path from 'path';
import { fileURLToPath } from 'url';
import { Worker } from 'bullmq';
import { createPool, initDb } from './db.js';
import { config } from './config.js';
import { generateCertificate } from './certificate.js';
import { updateJob } from './jobs.js';
import * as jobsApi from './jobs.js';
import { ensureStorageDir, sweepStaleFiles } from './storage.js';
import { redisConnection } from './redis.js';

const pool = createPool();
const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'pptx-templates');

let worker = null;

async function loadTemplate(templateId) {
  const result = await pool.query('SELECT * FROM cert_templates WHERE id = $1', [templateId]);
  if (!result.rows[0]) {
    const err = new Error('Certificate template not found');
    err.statusCode = 404;
    throw err;
  }
  const data = result.rows[0].data || {};
  let parsed = data;
  if (typeof parsed === 'string') { try { parsed = JSON.parse(parsed); } catch { parsed = {}; } }
  return { ...parsed, id: result.rows[0].id, name: result.rows[0].name || parsed.name || '' };
}

async function processCertificateJob(job) {
  const { templateId, data } = job.data;
  const jobId = job.id;

  await updateJob(jobId, { status: 'processing', attempts: job.attemptsMade + 1 });

  const template = await loadTemplate(templateId);
  if (template.type !== 'pptx' || !template.pptxFilename) {
    throw new Error('Not a PPTX certificate template');
  }

  const pptxPath = path.join(UPLOADS_DIR, template.pptxFilename);
  const result = await generateCertificate({ pptxPath, data, jobId });

  await updateJob(jobId, {
    status: 'done',
    certificate_path: result.certificatePath,
    preview_path: result.previewPath,
    filename: result.filename
  });

  return {
    jobId,
    status: 'done',
    filename: result.filename,
    downloadUrl: `/api/download-certificate/${jobId}`,
    previewUrl: result.previewPath ? `/api/certificate-preview/${jobId}` : null
  };
}

async function main() {
  await initDb(pool);
  await ensureStorageDir();

  worker = new Worker(config.certificateQueueName, processCertificateJob, {
    concurrency: config.workerConcurrency,
    connection: redisConnection()
  });

  worker.on('completed', (job) => {
    console.log(`[worker] job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    const jobId = job?.id;
    const attemptsMade = job?.attemptsMade ?? 1;
    const exhausted = attemptsMade >= config.jobMaxAttempts;
    console.error(`[worker] job ${jobId} failed (attempt ${attemptsMade}/${config.jobMaxAttempts}):`, err?.message);
    if (jobId) {
      updateJob(jobId, { status: exhausted ? 'failed' : 'processing', error: err?.message || 'Unknown error' })
        .catch((e) => console.error('[worker] failed to record job failure:', e.message));
    }
  });

  worker.on('error', (err) => {
    console.error('[worker] queue error:', err.message);
  });

  console.log(`[worker] pid ${process.pid} listening on queue "${config.certificateQueueName}" (concurrency ${config.workerConcurrency})`);

  // Storage TTL sweep: only the first PM2 cluster instance runs it, so the two
  // worker processes never race on the same rows.
  if (process.env.NODE_APP_INSTANCE === '0' || process.env.NODE_APP_INSTANCE === undefined) {
    setInterval(() => {
      sweepStaleFiles(jobsApi).catch((err) => console.error('[worker] storage sweep failed:', err.message));
    }, config.storageSweepIntervalMs).unref();
  }

  const shutdown = async () => {
    console.log('[worker] shutting down...');
    try { await worker?.close(); } catch { }
    try { await pool.end(); } catch { }
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('[worker] fatal startup error:', err);
  process.exit(1);
});
