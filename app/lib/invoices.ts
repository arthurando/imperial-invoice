import { promises as fs } from 'node:fs';
import path from 'node:path';
import type {
  ExtractionFile,
  FileWithChecks,
  CheckStatus,
  InvoiceWithCheck,
} from './types';
import { checkInvoice } from './checksum';
import { buildPriceHistory } from './price-history';
import { reconcileInvoice } from './reconcile';
import { loadCorrections, applyCorrectionsToInvoice, getStatusOverride } from './corrections';
import type { Correction } from './corrections';
import { extractionsDir, invoiceDir } from './config';

async function readJson<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw) as T;
}

interface JsonEntry {
  source_folder: string; // '' for root, otherwise the immediate subfolder name
  filename: string;      // JSON filename, e.g. 'Tofu.json'
  absPath: string;
}

async function listJsonFiles(rootDir: string): Promise<JsonEntry[]> {
  let entries: import('node:fs').Dirent[];
  try {
    entries = await fs.readdir(rootDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: JsonEntry[] = [];
  for (const e of entries) {
    if (e.isFile() && e.name.toLowerCase().endsWith('.json')) {
      out.push({ source_folder: '', filename: e.name, absPath: path.join(rootDir, e.name) });
      continue;
    }
    if (e.isDirectory()) {
      const subdir = e.name;
      let subEntries: string[];
      try {
        subEntries = await fs.readdir(path.join(rootDir, subdir));
      } catch {
        continue;
      }
      for (const sub of subEntries) {
        if (sub.toLowerCase().endsWith('.json')) {
          out.push({
            source_folder: subdir,
            filename: sub,
            absPath: path.join(rootDir, subdir, sub),
          });
        }
      }
    }
  }
  return out;
}

function decorateFile(
  raw: ExtractionFile,
  source_folder: string,
  history: ReturnType<typeof buildPriceHistory>,
  userCorrections: Correction[],
): FileWithChecks {
  const invoices: InvoiceWithCheck[] = raw.invoices.map((inv) => {
    // 1. Apply user corrections first (highest authority)
    const withUserEdits = applyCorrectionsToInvoice(inv, raw.filename, userCorrections);
    // 2. Then try historical auto-reconcile (only if still failing)
    const { reconciled, corrections } = reconcileInvoice(withUserEdits, history);
    const check = checkInvoice(reconciled);
    // 3. Apply human OK-manual override (highest authority over checksum)
    const override = getStatusOverride(reconciled, raw.filename, userCorrections);
    if (override.value === 'ok-manual') {
      check.status = 'ok-manual';
      check.notes.unshift(
        `Manually marked OK by ${override.corrected_by ?? 'user'} at ${override.corrected_at ?? '—'}`,
      );
    }
    return {
      ...reconciled,
      check,
      auto_corrections: corrections,
    };
  });

  const statuses = invoices.map((i) => i.check.status);
  const isPassing = (s: CheckStatus) => s === 'ok' || s === 'ok-manual';
  const overall: CheckStatus = statuses.includes('fail')
    ? 'fail'
    : statuses.includes('warn')
      ? 'warn'
      : statuses.every(isPassing)
        ? 'ok'
        : 'ok';

  const total_amount = invoices.reduce(
    (acc, i) => (i.total !== null ? acc + i.total : acc),
    0,
  );

  return { ...raw, invoices, overall_status: overall, total_amount, source_folder };
}

export async function loadAllFiles(): Promise<FileWithChecks[]> {
  const entries = await listJsonFiles(extractionsDir());
  const loaded = await Promise.all(
    entries.map(async (e) => ({
      raw: await readJson<ExtractionFile>(e.absPath),
      source_folder: e.source_folder,
    })),
  );

  // First pass: build price history from invoices whose math already reconciles.
  const history = buildPriceHistory(loaded.map((l) => l.raw));

  // Load any user corrections (manual edits made via the viewer)
  const userCorrections = await loadCorrections();

  // Second pass: apply user edits, then historical auto-reconciliation, then checksum.
  const decorated = loaded.map((l) =>
    decorateFile(l.raw, l.source_folder, history, userCorrections),
  );
  return decorated.sort((a, b) => {
    const fcmp = a.source_folder.localeCompare(b.source_folder);
    return fcmp !== 0 ? fcmp : a.filename.localeCompare(b.filename);
  });
}

export async function loadFileByFilename(
  filename: string,
  source_folder?: string,
): Promise<FileWithChecks | null> {
  const all = await loadAllFiles();
  return (
    all.find(
      (f) =>
        f.filename === filename &&
        (source_folder === undefined || f.source_folder === source_folder),
    ) ?? null
  );
}

export async function listFolders(): Promise<string[]> {
  const entries = await listJsonFiles(extractionsDir());
  const set = new Set<string>();
  for (const e of entries) set.add(e.source_folder);
  return [...set].sort();
}

export function pdfPublicPath(file: { filename: string; source_folder: string }): string {
  const parts = file.source_folder
    ? [file.source_folder, file.filename]
    : [file.filename];
  return `/api/pdf/${parts.map(encodeURIComponent).join('/')}`;
}

export function filesViewerPath(file: { filename: string; source_folder: string }): string {
  const parts = file.source_folder
    ? [file.source_folder, file.filename]
    : [file.filename];
  return `/files/${parts.map(encodeURIComponent).join('/')}`;
}

/**
 * Walk `invoice/` and report every PDF that does not yet have a matching JSON
 * under `prototype/extractions/<same-folder>/<stem>.json`. The friend uses this
 * to know "what's left to extract" — surfaced as a banner on `/files`.
 */
export async function listAwaitingExtraction(): Promise<
  { source_folder: string; filename: string }[]
> {
  const invRoot = invoiceDir();
  const extRoot = extractionsDir();

  // Collect every (folder, pdf) pair that exists under invoice/.
  const pdfs: { source_folder: string; filename: string }[] = [];
  let topEntries: import('node:fs').Dirent[];
  try {
    topEntries = await fs.readdir(invRoot, { withFileTypes: true });
  } catch {
    return [];
  }
  for (const e of topEntries) {
    if (e.isFile() && e.name.toLowerCase().endsWith('.pdf')) {
      pdfs.push({ source_folder: '', filename: e.name });
      continue;
    }
    if (e.isDirectory()) {
      let subs: string[];
      try {
        subs = await fs.readdir(path.join(invRoot, e.name));
      } catch {
        continue;
      }
      for (const sub of subs) {
        if (sub.toLowerCase().endsWith('.pdf')) {
          pdfs.push({ source_folder: e.name, filename: sub });
        }
      }
    }
  }

  // Check whether the matching extraction JSON exists.
  const awaiting: { source_folder: string; filename: string }[] = [];
  await Promise.all(
    pdfs.map(async (p) => {
      const stem = p.filename.replace(/\.pdf$/i, '');
      const target = p.source_folder
        ? path.join(extRoot, p.source_folder, `${stem}.json`)
        : path.join(extRoot, `${stem}.json`);
      try {
        await fs.access(target);
      } catch {
        awaiting.push(p);
      }
    }),
  );

  awaiting.sort((a, b) => {
    const f = a.source_folder.localeCompare(b.source_folder);
    return f !== 0 ? f : a.filename.localeCompare(b.filename);
  });
  return awaiting;
}
