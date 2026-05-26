import Link from 'next/link';
import { loadAllFiles, listAwaitingExtraction, filesViewerPath } from '@/lib/invoices';
import { folderLabel, folderVsDateMismatch } from '@/lib/folder-badges';
import type { FileWithChecks } from '@/lib/types';

export default async function FilesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const folderFilter = strParam(sp.folder);

  const [allFiles, awaiting] = await Promise.all([
    loadAllFiles(),
    listAwaitingExtraction(),
  ]);
  const files =
    folderFilter === undefined
      ? allFiles
      : allFiles.filter((f) => f.source_folder === folderFilter);

  const allFolders = unique(allFiles.map((f) => f.source_folder)).sort();
  const grouped = groupByFolder(files);

  const needsReviewCount = files.filter(
    (f) => f.overall_status !== 'ok' && f.overall_status !== 'ok-manual',
  ).length;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Files</h1>
        <p className="text-sm text-zinc-500 mt-1">
          {files.length} source PDFs · {needsReviewCount} need review
          {folderFilter !== undefined && (
            <span className="ml-2 text-zinc-400">
              · filtered to <span className="font-mono">{folderLabel(folderFilter)}</span>
            </span>
          )}
        </p>
      </header>

      <FolderChips folders={allFolders} active={folderFilter} />

      <AwaitingExtractionBanner awaiting={awaiting} folderFilter={folderFilter} />

      <div className="space-y-6">
        {grouped.map(({ folder, files: groupFiles }) => (
          <FolderGroup key={folder || '__root__'} folder={folder} files={groupFiles} />
        ))}
        {grouped.length === 0 && (
          <p className="text-sm text-zinc-500 italic">
            No files{folderFilter !== undefined ? ' in this folder' : ''}.
          </p>
        )}
      </div>
    </div>
  );
}

function AwaitingExtractionBanner({
  awaiting,
  folderFilter,
}: {
  awaiting: { source_folder: string; filename: string }[];
  folderFilter: string | undefined;
}) {
  const scoped =
    folderFilter === undefined
      ? awaiting
      : awaiting.filter((a) => a.source_folder === folderFilter);
  if (scoped.length === 0) return null;

  // Group counts by folder for the headline.
  const byFolder = new Map<string, number>();
  for (const a of scoped) byFolder.set(a.source_folder, (byFolder.get(a.source_folder) ?? 0) + 1);
  const folderSummary = [...byFolder.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([f, n]) => `${folderLabel(f)} (${n})`)
    .join(' · ');

  return (
    <section className="rounded-lg border border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-4 space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold text-blue-900 dark:text-blue-100 flex items-center gap-2">
          <span>⏳</span>
          {scoped.length} PDF{scoped.length === 1 ? '' : 's'} awaiting extraction
        </h2>
        <span className="text-xs font-mono text-blue-700 dark:text-blue-300">
          {folderSummary}
        </span>
      </div>
      <p className="text-sm text-blue-800 dark:text-blue-200">
        These PDFs are in your <code className="font-mono">invoice/</code> folder but don't have a
        matching extraction JSON yet. Open a Claude Code session at the data folder and run the
        prompt at <code className="font-mono">prompts/extract.md</code> — Claude will skip files
        that are already extracted.
      </p>
      {scoped.length <= 12 && (
        <ul className="text-xs text-blue-700 dark:text-blue-300 font-mono space-y-0.5">
          {scoped.map((a) => (
            <li key={`${a.source_folder}/${a.filename}`}>
              · {folderLabel(a.source_folder)} / {a.filename}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FolderGroup({ folder, files }: { folder: string; files: FileWithChecks[] }) {
  const needsReview = files.filter(
    (f) => f.overall_status !== 'ok' && f.overall_status !== 'ok-manual',
  );
  const reconciled = files.filter(
    (f) => f.overall_status === 'ok' || f.overall_status === 'ok-manual',
  );
  const total = files.reduce((a, f) => a + f.total_amount, 0);

  return (
    <section>
      <header className="flex items-baseline justify-between mb-3 border-b border-zinc-200 dark:border-zinc-800 pb-1">
        <h2 className="font-semibold flex items-center gap-2">
          <span className="font-mono text-sm bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
            {folderLabel(folder)}
          </span>
          <span className="text-sm font-normal text-zinc-500">
            {files.length} file{files.length === 1 ? '' : 's'}
            {needsReview.length > 0 && (
              <span className="ml-2 text-amber-700 dark:text-amber-300">
                · {needsReview.length} need review
              </span>
            )}
          </span>
        </h2>
        <div className="text-sm font-mono text-zinc-500">
          ${total.toLocaleString('en-CA', { minimumFractionDigits: 2 })}
        </div>
      </header>

      {needsReview.length > 0 && (
        <div className="space-y-2 mb-4">
          {needsReview.map((f) => (
            <FileCardCompact key={f.source_folder + '/' + f.filename} file={f} />
          ))}
        </div>
      )}

      {reconciled.length > 0 && (
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {reconciled.map((f) => (
            <li key={f.source_folder + '/' + f.filename}>
              <Link
                href={filesViewerPath(f)}
                className="block p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-400 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium truncate text-sm">{f.filename}</div>
                  <StatusBadge status={f.overall_status} />
                </div>
                <div className="text-xs text-zinc-500 mt-1 flex justify-between">
                  <span>
                    {f.invoices.length} inv · {f.page_count} pg
                  </span>
                  <span className="font-mono">
                    ${f.total_amount.toLocaleString('en-CA', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FileCardCompact({ file }: { file: FileWithChecks }) {
  const failingInvoices = file.invoices.filter(
    (i) => i.check.status !== 'ok' && i.check.status !== 'ok-manual',
  );
  const mismatch = folderVsDateMismatch(file);
  return (
    <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="px-4 py-2.5 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900 flex items-center gap-3">
        <StatusBadge status={file.overall_status} />
        <Link
          href={filesViewerPath(file)}
          className="font-medium text-blue-700 dark:text-blue-300 hover:underline truncate"
        >
          {file.filename}
        </Link>
        {mismatch && (
          <span
            className="text-xs px-1.5 py-0.5 rounded font-mono bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
            title="invoice_date falls outside the folder month"
          >
            folder ⚠︎ date
          </span>
        )}
        <span className="text-xs text-zinc-500 ml-auto whitespace-nowrap">
          {failingInvoices.length} of {file.invoices.length} flagged · {file.page_count} pg ·{' '}
          ${file.total_amount.toLocaleString('en-CA', { minimumFractionDigits: 2 })}
        </span>
      </div>
      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {failingInvoices.map((inv, idx) => (
          <li key={idx} className="px-4 py-2 text-xs flex items-start gap-3">
            <span
              className={inv.check.status === 'fail' ? 'text-red-600' : 'text-amber-600'}
            >
              {inv.check.status === 'fail' ? '⚠' : '⚠︎'}
            </span>
            <div className="font-mono text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
              {inv.invoice_date ?? '—'} · {inv.supplier_name} · #
              {inv.invoice_number ?? '—'}
            </div>
            <div className="text-zinc-600 dark:text-zinc-400 flex-1">
              {inv.check.notes.length === 0
                ? 'low extraction confidence — review fields'
                : inv.check.notes.join(' · ')}
            </div>
            <div className="font-mono whitespace-nowrap text-zinc-600 dark:text-zinc-400">
              {inv.total === null
                ? '—'
                : `$${inv.total.toLocaleString('en-CA', { minimumFractionDigits: 2 })}`}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FolderChips({ folders, active }: { folders: string[]; active: string | undefined }) {
  if (folders.length <= 1 && folders[0] === '' && active === undefined) {
    // Flat layout, no folders to choose from — don't clutter the UI.
    return null;
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm">
      <Chip href="/files" active={active === undefined}>
        All
      </Chip>
      {folders.map((f) => (
        <Chip
          key={f || '__root__'}
          href={`/files?folder=${encodeURIComponent(f)}`}
          active={active === f}
        >
          {folderLabel(f)}
        </Chip>
      ))}
    </div>
  );
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`px-2.5 py-1 rounded-full text-xs font-mono border ${
        active
          ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100'
          : 'bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-zinc-500'
      }`}
    >
      {children}
    </Link>
  );
}

function StatusBadge({ status }: { status: 'ok' | 'warn' | 'fail' | 'ok-manual' }) {
  const map = {
    ok: { label: '✓', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
    'ok-manual': { label: '✓M', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
    warn: { label: '⚠︎', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
    fail: { label: '⚠', cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  } as const;
  const s = map[status];
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${s.cls}`} title={status}>
      {s.label}
    </span>
  );
}

function groupByFolder(files: FileWithChecks[]): { folder: string; files: FileWithChecks[] }[] {
  const map = new Map<string, FileWithChecks[]>();
  for (const f of files) {
    const list = map.get(f.source_folder) ?? [];
    list.push(f);
    map.set(f.source_folder, list);
  }
  return [...map.entries()]
    .map(([folder, files]) => ({ folder, files }))
    .sort((a, b) => a.folder.localeCompare(b.folder));
}

function strParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}
