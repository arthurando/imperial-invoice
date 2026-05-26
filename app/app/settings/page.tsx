import { promises as fs } from 'node:fs';
import path from 'node:path';
import Link from 'next/link';
import { getConfig, extractionsDir, invoiceDir } from '@/lib/config';
import { DataDirForm } from './DataDirForm';

export const dynamic = 'force-dynamic';

interface Diag {
  ok: boolean;
  message: string;
  invoiceFolders: number;
  invoicePdfs: number;
  extractionFolders: number;
  extractions: number;
}

async function inspectDataDir(): Promise<Diag> {
  const invRoot = invoiceDir();
  const extRoot = extractionsDir();

  let invoiceFolders = 0;
  let invoicePdfs = 0;
  let extractionFolders = 0;
  let extractions = 0;

  let invoiceExists = false;
  let extractionsExists = false;

  try {
    const invEntries = await fs.readdir(invRoot, { withFileTypes: true });
    invoiceExists = true;
    for (const e of invEntries) {
      if (e.isFile() && e.name.toLowerCase().endsWith('.pdf')) invoicePdfs++;
      if (e.isDirectory()) {
        invoiceFolders++;
        try {
          const subs = await fs.readdir(path.join(invRoot, e.name));
          invoicePdfs += subs.filter((n) => n.toLowerCase().endsWith('.pdf')).length;
        } catch {
          // unreadable subdir — skip
        }
      }
    }
  } catch {
    // root doesn't exist or unreadable — handled below
  }

  try {
    const extEntries = await fs.readdir(extRoot, { withFileTypes: true });
    extractionsExists = true;
    for (const e of extEntries) {
      if (e.isFile() && e.name.toLowerCase().endsWith('.json')) extractions++;
      if (e.isDirectory()) {
        extractionFolders++;
        try {
          const subs = await fs.readdir(path.join(extRoot, e.name));
          extractions += subs.filter((n) => n.toLowerCase().endsWith('.json')).length;
        } catch {
          // unreadable subdir — skip
        }
      }
    }
  } catch {
    // root doesn't exist or unreadable
  }

  let ok = true;
  let message = 'Ready to ingest.';
  if (!invoiceExists && !extractionsExists) {
    ok = false;
    message = 'No `invoice/` or `prototype/extractions/` subfolders found yet. They will be created when you save a path.';
  } else if (invoicePdfs === 0 && extractions === 0) {
    ok = false;
    message = 'Folders exist but are empty. Drop PDFs into `invoice/<month-folder>/` and run the Claude Code extract prompt.';
  } else if (extractions === 0) {
    ok = false;
    message = `${invoicePdfs} PDFs detected but no extractions yet — run the extract prompt to populate them.`;
  } else if (invoicePdfs === 0) {
    ok = false;
    message = `${extractions} extractions detected but no source PDFs — the viewer will 404 on PDF previews.`;
  }

  return { ok, message, invoiceFolders, invoicePdfs, extractionFolders, extractions };
}

export default async function SettingsPage() {
  const cfg = getConfig();
  const diag = await inspectDataDir();

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Where your invoice data lives on this machine.
        </p>
      </header>

      <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Data folder</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Absolute path on your machine. The app reads invoices, extractions,
              and corrections from <code className="font-mono">{'<this path>/{invoice,prototype}'}</code>.
            </p>
          </div>
          <SourceBadge source={cfg.source} />
        </div>

        <DataDirForm currentDataDir={cfg.dataDir} />

        <dl className="text-xs grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 pt-2">
          <dt className="text-zinc-500">Active path</dt>
          <dd className="font-mono break-all">{cfg.dataDir}</dd>
          <dt className="text-zinc-500">Config file</dt>
          <dd className="font-mono break-all text-zinc-500">{cfg.configFile}</dd>
        </dl>

        {cfg.source === 'env' && (
          <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded p-2">
            ⚠︎ <code>IMPERIAL_DATA_DIR</code> is set in the environment — it overrides any path
            saved here. Unset it (or restart without it) to use the path picker.
          </p>
        )}
      </section>

      <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
        <h2 className="font-semibold">What we found at this path</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Stat label="Month folders" value={String(diag.invoiceFolders)} />
          <Stat label="PDFs" value={String(diag.invoicePdfs)} />
          <Stat label="Extraction folders" value={String(diag.extractionFolders)} />
          <Stat label="Extractions" value={String(diag.extractions)} />
        </div>
        <p
          className={`text-sm ${
            diag.ok
              ? 'text-emerald-700 dark:text-emerald-300'
              : 'text-amber-700 dark:text-amber-300'
          }`}
        >
          {diag.ok ? '✓' : '⚠︎'} {diag.message}
        </p>
        <div className="text-xs text-zinc-500 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          Workflow reminder:
          <ol className="list-decimal list-inside mt-1 space-y-0.5">
            <li>Drop PDFs into <code className="font-mono">{`<data folder>/invoice/<your-month-folder>/`}</code>.</li>
            <li>Open Claude Code in that folder and run the prompt at <code className="font-mono">prompts/extract.md</code>.</li>
            <li>Extractions land in <code className="font-mono">{`<data folder>/prototype/extractions/<same-folder>/`}</code>.</li>
            <li>
              <Link href="/files" className="underline">Back to Files</Link> — the dashboard re-renders on every page load.
            </li>
          </ol>
        </div>
      </section>
    </div>
  );
}

function SourceBadge({ source }: { source: 'env' | 'config' | 'default' }) {
  const map = {
    env: { label: 'env override', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' },
    config: { label: 'user-set', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' },
    default: { label: 'default (repo)', cls: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300' },
  } as const;
  const s = map[source];
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-mono whitespace-nowrap ${s.cls}`}>
      {s.label}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-zinc-200 dark:border-zinc-800 px-3 py-2">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="text-xl font-semibold font-mono">{value}</div>
    </div>
  );
}
