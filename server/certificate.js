// Certificate generation core — the PPTX placeholder replacement pipeline moved
// out of server.js unchanged, plus orchestration that renders a PDF + preview PNG
// directly into the transient storage dir.
//
// No certificate bytes are ever held in memory beyond the (short-lived)
// Docxtemplater output buffer; the PDF is written to disk by LibreOffice and
// streamed by the API.

import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import crypto from 'crypto';
import { sofficeConvert } from './libreoffice.js';
import { pdfPath, pngPath, exists, remove } from './storage.js';
import { TMP_DIR } from './config.js';

// Replace {{name}}, {{quiz_title}}, {{score}}, ... in the PPTX template and write
// the modified copy to a unique tmp path. Returns { tmpPptxPath }.
export async function renderCertificatePptx({ pptxPath, data }) {
  const pptxBuffer = await fsp.readFile(pptxPath);
  const zip = new PizZip(pptxBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{{', end: '}}' }
  });

  const templateData = {
    name: data?.name || 'Participant',
    quiz_title: data?.quiz_title || 'Evaluation',
    score: String(data?.score ?? '0'),
    total: String(data?.total ?? '0'),
    percent: String(data?.percent ?? '0%'),
    date: data?.date || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    email: data?.email || '',
    org: data?.org || ''
  };

  doc.render(templateData);
  const modifiedBuffer = doc.getZip().generate({ type: 'nodebuffer' });

  const tmpPptx = path.join(TMP_DIR, `cert_${crypto.randomBytes(6).toString('hex')}.pptx`);
  await fsp.mkdir(TMP_DIR, { recursive: true });
  await fsp.writeFile(tmpPptx, modifiedBuffer);
  return { tmpPptxPath: tmpPptx };
}

// Full generation: render placeholders -> LibreOffice PDF -> preview PNG of the
// first slide. Converts into temp dirs (LibreOffice names outputs after the input
// file, not the jobId), then moves the produced PDF/PNG to the storage dir keyed
// by jobId. Returns the stored paths + a safe download filename. Throws on any
// failure (tmp files cleaned up either way).
export async function generateCertificate({ pptxPath, data, jobId }) {
  let tmpPptxPath = null;
  let pdfOutDir = null;
  let pngOutDir = null;
  try {
    const { tmpPptxPath: p } = await renderCertificatePptx({ pptxPath, data });
    tmpPptxPath = p;

    // PDF (first conversion; also validates soffice is present)
    pdfOutDir = path.join(TMP_DIR, `certpdf_${crypto.randomBytes(4).toString('hex')}`);
    const pdfFiles = await sofficeConvert({ inputPath: p, outputDir: pdfOutDir, convertTo: 'pdf' });
    if (!pdfFiles.length) {
      throw new Error('LibreOffice did not produce a PDF output file');
    }
    await fsp.rename(pdfFiles[0], pdfPath(jobId));

    // Preview PNG of slide 1 (best-effort — preview failures must not fail the job)
    try {
      pngOutDir = path.join(TMP_DIR, `certpng_${crypto.randomBytes(4).toString('hex')}`);
      const pngFiles = await sofficeConvert({ inputPath: p, outputDir: pngOutDir, convertTo: 'png' });
      const firstSlide = pickFirstSlidePng(pngFiles);
      if (firstSlide) await fsp.rename(firstSlide, pngPath(jobId));
    } catch {
      await remove(pngPath(jobId));
    }

    const cleanName = (data?.name || 'Participant').replace(/[^a-zA-Z0-9 ]/g, '');
    return {
      certificatePath: pdfPath(jobId),
      previewPath: (await exists(pngPath(jobId))) ? pngPath(jobId) : null,
      filename: `Certificate_${cleanName}.pdf`,
      ext: 'pdf'
    };
  } finally {
    if (tmpPptxPath) {
      try { await fsp.unlink(tmpPptxPath); } catch { }
    }
    if (pdfOutDir) { try { await fsp.rm(pdfOutDir, { recursive: true, force: true }); } catch { } }
    if (pngOutDir) { try { await fsp.rm(pngOutDir, { recursive: true, force: true }); } catch { } }
  }
}

// LibreOffice names multi-slide PNGs `{stem}-1.png`, `{stem}-2.png`, ... (single
// slide may be `{stem}.png`). Sort by that trailing index and return the first.
function pickFirstSlidePng(files) {
  if (!files.length) return null;
  const sorted = files.slice().sort((a, b) => {
    const na = parseInt((path.basename(a).match(/-(\d+)\.png$/i) || [])[1] || '0', 10);
    const nb = parseInt((path.basename(b).match(/-(\d+)\.png$/i) || [])[1] || '0', 10);
    return na - nb;
  });
  return sorted[0];
}
