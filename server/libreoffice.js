// LibreOffice headless runner.
//
// BullMQ concurrency (WORKER_CONCURRENCY) is the ONLY cap on how many soffice
// processes may run at once per worker — there is deliberately no extra in-process
// semaphore, so the pool applies backpressure cleanly.
//
// Orphan protection: each conversion is spawned detached in its own process group
// and, on timeout/failure, the ENTIRE group is SIGKILLed — including any child
// soffice processes LibreOffice may have spawned. A per-process UserInstallation
// profile also prevents the classic ".soffice is locked" failure when several
// conversions run against one shared profile.

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

// Run a single soffice conversion. Returns the output file path(s) globbed from
// outputDir, or throws. Tries each candidate binary in order (mirrors the old
// libreoffice -> soffice -> mac path fallback). Never leaves a process behind.
export async function sofficeConvert({ inputPath, outputDir, convertTo }) {
  await fsp.mkdir(outputDir, { recursive: true });
  await fsp.mkdir(config.loProfileDir, { recursive: true });

  const args = [
    '--headless',
    '--norestore',
    '--nolockcheck',
    `-env:UserInstallation=file://${config.loProfileDir}`,
    '--convert-to', convertTo,
    '--outdir', outputDir,
    inputPath
  ];

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
      if (code === 0) done(resolve);
      else done(reject, new Error(`LibreOffice exited with code ${code} (${command})`));
    });
  });
}
