// certificate_jobs table helpers. Shared by the API (create/read) and the worker
// (status transitions + cleanup). All queries go through the shared pool.

import { createPool } from './db.js';

function pool() {
  return createPool();
}

export async function createJob({ jobId, templateId, data }) {
  await pool().query(
    `INSERT INTO certificate_jobs (job_id, template_id, data, status, created_at, updated_at)
     VALUES ($1, $2, $3, 'queued', now(), now())
     ON CONFLICT (job_id) DO NOTHING`,
    [jobId, templateId, JSON.stringify(data || {})]
  );
}

export async function updateJob(jobId, fields) {
  const sets = [];
  const values = [];
  const allowed = ['status', 'attempts', 'error', 'certificate_path', 'preview_path', 'filename'];
  for (const key of allowed) {
    if (key in fields) {
      values.push(fields[key]);
      sets.push(`${key} = $${values.length}`);
    }
  }
  if (!sets.length) return;
  values.push(jobId);
  await pool().query(
    `UPDATE certificate_jobs SET ${sets.join(', ')}, updated_at = now() WHERE job_id = $${values.length}`,
    values
  );
}

export async function getJob(jobId) {
  const result = await pool().query('SELECT * FROM certificate_jobs WHERE job_id = $1', [jobId]);
  return result.rows[0] || null;
}

export async function findStale(cutoffIso) {
  const result = await pool().query(
    `SELECT * FROM certificate_jobs
     WHERE status IN ('done', 'failed')
       AND updated_at < $1
     ORDER BY updated_at ASC
     LIMIT 500`,
    [cutoffIso]
  );
  return result.rows;
}

export async function findByJobIds(jobIds) {
  if (!jobIds.length) return [];
  const result = await pool().query(
    `SELECT job_id FROM certificate_jobs WHERE job_id = ANY($1)`,
    [jobIds]
  );
  return result.rows;
}

export async function deleteJob(jobId) {
  await pool().query('DELETE FROM certificate_jobs WHERE job_id = $1', [jobId]);
}
