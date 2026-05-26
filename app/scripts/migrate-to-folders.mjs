// One-off migration: move the flat layout (45 PDFs + 45 JSONs) into per-month
// subfolders derived from each extraction's invoice_date. Files with no date
// land in `unfiled/`. Multi-invoice files use the modal month. Idempotent —
// safe to re-run; already-bucketed files are left alone.
//
// Usage (from app/): `node scripts/migrate-to-folders.mjs`

import { promises as fs } from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const INVOICE_DIR = path.join(REPO_ROOT, 'invoice');
const EXTRACTIONS_DIR = path.join(REPO_ROOT, 'prototype', 'extractions');
const PUBLIC_INVOICES_DIR = path.join(REPO_ROOT, 'app', 'public', 'invoices');

function modalMonth(invoices) {
  const counts = new Map();
  for (const inv of invoices) {
    const d = inv.invoice_date;
    if (!d || !/^\d{4}-\d{2}/.test(d)) continue;
    const m = d.slice(0, 7);
    counts.set(m, (counts.get(m) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  let best = null;
  let bestN = 0;
  for (const [m, n] of counts) {
    if (n > bestN) {
      bestN = n;
      best = m;
    }
  }
  return best;
}

async function safeMove(src, dest) {
  await fs.mkdir(path.dirname(dest), { recursive: true });
  try {
    await fs.access(src);
  } catch {
    return false;
  }
  try {
    await fs.access(dest);
    console.log(`  SKIP (dest exists): ${dest}`);
    return false;
  } catch {
    // ok
  }
  await fs.rename(src, dest);
  return true;
}

async function main() {
  const entries = await fs.readdir(EXTRACTIONS_DIR, { withFileTypes: true });
  const flatJsons = entries.filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.json'));

  if (flatJsons.length === 0) {
    console.log('No flat-layout JSONs to migrate.');
    return;
  }

  console.log(`Migrating ${flatJsons.length} flat extractions...`);

  let moved = 0;
  for (const entry of flatJsons) {
    const jsonPath = path.join(EXTRACTIONS_DIR, entry.name);
    let raw;
    try {
      raw = JSON.parse(await fs.readFile(jsonPath, 'utf8'));
    } catch (err) {
      console.log(`  SKIP (unreadable JSON): ${entry.name} — ${err.message}`);
      continue;
    }

    const month = modalMonth(raw.invoices ?? []);
    const bucket = month ?? 'unfiled';

    const stem = entry.name.replace(/\.json$/i, '');
    const pdfName = raw.filename ?? `${stem}.pdf`;

    const destJson = path.join(EXTRACTIONS_DIR, bucket, entry.name);
    const destPdf = path.join(INVOICE_DIR, bucket, pdfName);
    const srcPdf = path.join(INVOICE_DIR, pdfName);
    const srcPublicPdf = path.join(PUBLIC_INVOICES_DIR, pdfName);

    const jsonMoved = await safeMove(jsonPath, destJson);
    const pdfMoved = await safeMove(srcPdf, destPdf);
    // Public copy is no longer needed (the /api/pdf route serves from invoice/).
    // Just delete it if it exists, so we don't keep stale copies around.
    try {
      await fs.unlink(srcPublicPdf);
    } catch {
      // not present — fine
    }

    if (jsonMoved || pdfMoved) {
      moved++;
      console.log(`  ${bucket}/  ←  ${pdfName}${month ? '' : ' (no invoice_date)'}`);
    }
  }

  console.log(`\nDone. Moved ${moved} files into per-month folders.`);
  console.log(`Folders now in ${EXTRACTIONS_DIR}:`);
  const after = await fs.readdir(EXTRACTIONS_DIR, { withFileTypes: true });
  for (const e of after.filter((x) => x.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const sub = await fs.readdir(path.join(EXTRACTIONS_DIR, e.name));
    console.log(`  ${e.name}/  (${sub.length} files)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
