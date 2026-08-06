// Transient certificate storage.
//
// Generated PDFs + preview PNGs are written here so the API can stream them to
// the client without ever holding them in RAM (no base64). Files are NOT
// permanent: the download route removes the file (and its DB row) right after
// streaming, and sweepStaleFiles() reclaims anything abandoned by a crashed
// worker or a client that never downloaded.

import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { config } from './config.js';

export async function ensureStorageDir() {
  await fsp.mkdir(config.storageDir, { recursive: true });
}

export function pdfPath(jobId) {
  return path.join(config.storageDir, `${jobId}.pdf`);
}

export function pngPath(jobId) {
  return path.join(config.storageDir, `${jobId}.png`);
}

export async function exists(p) {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}

// Best-effort deletion; never throws (cleanup must not crash the caller).
export async function remove(p) {
  try {
    await fsp.rm(p, { force: true });
  } catch { /* ignore */ }
}

// Returns a readable stream for a stored file (or null if missing).
export function createFileStream(p) {
  if (!fs.existsSync(p)) return null;
  return fs.createReadStream(p);
}

export async function sizeOf(p) {
  try {
    const st = await fsp.stat(p);
    return st.size;
  } catch {
    return 0;
  }
}

// Called on an interval by the worker: delete any stored file whose DB row is
// old enough. Files without a matching job row (orphans from a crash) are also
// removed based on their mtime. This is what guarantees we never permanently
// accumulate generated PDFs on disk.
export async function sweepStaleFiles(jobsApi, now = Date.now()) {
  const cutoff = new Date(now - config.storageTtlMs).toISOString();
  const stale = await jobsApi.findStale(cutoff);

  for (const row of stale) {
    await remove(row.certificate_path);
    await remove(row.preview_path);
    await jobsApi.deleteJob(row.job_id);
  }

  try {
    const entries = await fsp.readdir(config.storageDir, { withFileTypes: true });
    const fileMtimes = [];
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const st = await fsp.stat(path.join(config.storageDir, entry.name));
      if (st.mtimeMs < now - config.storageTtlMs) fileMtimes.push(entry.name);
    }
    // Only remove orphan files; anything with a live job row is owned by findStale.
    const liveRows = await jobsApi.findByJobIds(fileMtimes.map((name) => path.parse(name).name));
    const liveSet = new Set(liveRows.map((r) => r.job_id));
    for (const name of fileMtimes) {
      const jobId = path.parse(name).name;
      if (!liveSet.has(jobId)) await remove(path.join(config.storageDir, name));
    }
  } catch { /* readdir race / missing dir */ }
}
