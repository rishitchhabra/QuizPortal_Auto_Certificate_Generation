// LibreOffice headless runner.
//
// BullMQ concurrency (WORKER_CONCURRENCY) is the ONLY cap on how many soffice
// processes may run at once per worker — there is deliberately no extra in-process
// semaphore, so the pool applies backpressure cleanly.
//
// Orphan protection: each conversion is spawned detached in its own process group
// and, on timeout/failure, the ENTIRE group is SIGKILLed — including any child
// soffice processes LibreOffice may have spawned.
//
// Concurrency safety: every conversion gets its OWN UserInstallation profile
// (unique dir). Shared profiles deadlock under concurrent headless conversion —
// the second soffice to start waits on the profile .lock of the first, which is
// exactly what pegged both CPUs and starved the queue under load. Unique profile
// per conversion removes all contention; the dir is deleted in a finally block.

import crypto from 'crypto';
import { spawn } from 'child_process';
import fsp from 'fs/promises';
import path from 'path';
import { config } from './config.js';

const CANDIDATE_PATHS = [
  'libreoffice',
  'soffice',
  '/usr/bin/libreoffice',
  '/usr/bin/soffice',
  '/opt/libreoffice/program/soffice',
  '/Applications/LibreOffice.app/Contents/MacOS/soffice'
];

function sofficeCandidates() {
  if (config.sofficePath) return [config.sofficePath];
  return CANDIDATE_PATHS;
}

// Cheap sanity probe (soffice --version) used at worker startup. Non-fatal: the
// worker still starts, but a missing/broken LibreOffice surfaces immediately in
// the logs instead of only failing jobs.
export async function probeSoffice() {
  for (const cmd of sofficeCandidates()) {
    try {
      const code = await runWithKill(cmd, ['--version'], 15000);
      if (code === 0) return { binary: cmd, ok: true };
    } catch { /* try next */ }
  }
  return { binary: null, ok: false };
}

// Run a single soffice conversion. Returns the output file path(s) globbed from
// outputDir, or throws. Tries each candidate binary in order (mirrors the old
// libreoffice -> soffice -> mac path fallback). Never leaves a process behind.
export async function sofficeConvert({ inputPath, outputDir, convertTo }) {
  await fsp.mkdir(outputDir, { recursive: true });

  // Unique profile per conversion (see header comment). Parent dir is per-process
  // so worker A and worker B never touch each other's profiles.
  const profileDir = path.join(config.loProfileDir, crypto.randomBytes(6).toString('hex'));
  await fsp.mkdir(profileDir, { recursive: true });

  const args = [
    '--headless',
    '--norestore',
    '--nolockcheck',
    `-env:UserInstallation=file://${profileDir}`,
    '--convert-to', convertTo,
    '--outdir', outputDir,
    inputPath
  ];

  try {
    let lastError = null;
    for (const cmd of sofficeCandidates()) {
      try {
        await runWithKill(cmd, args, config.sofficeTimeoutMs);
        // Collect produced files.
        const names = await fsp.readdir(outputDir);
        const ext = convertTo.toLowerCase();
        return names
          .filter((name) => path.extname(name).toLowerCase() === '.' + ext)
          .map((name) => path.join(outputDir, name));
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error('LibreOffice conversion failed');
  } finally {
    // Best-effort cleanup of the throwaway profile.
    try { await fsp.rm(profileDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

// spawn detached + kill entire process group on timeout. execFile's built-in
// timeout only kills the direct child, which can orphan soffice's own children.
function runWithKill(command, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { detached: true, stdio: 'ignore' });
    let settled = false;

    const done = (fn, arg) => {
      if (settled) return;
      settled = true;
      fn(arg);
    };

    const timer = setTimeout(() => {
      try {
        process.kill(-child.pid, 'SIGKILL'); // kill whole group
      } catch { /* already gone */ }
      done(reject, new Error(`LibreOffice timed out after ${timeoutMs}ms (${command})`));
    }, timeoutMs);

    child.on('error', (err) => {
      clearTimeout(timer);
      done(reject, err);
    });

    child.on('exit', (code) => {
      clearTimeout(timer);
      done(resolve, code);
    });
  });
}
