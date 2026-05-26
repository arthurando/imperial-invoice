import Link from 'next/link';
import { loadAllFiles } from '@/lib/invoices';
import { folderLabel } from '@/lib/folder-badges';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const folderFilter = strParam(sp.folder);

  const allFiles = await loadAllFiles();
  const files =
    folderFilter === undefined
      ? allFiles
      : allFiles.filter((f) => f.source_folder === folderFilter);

  const folders = unique(allFiles.map((f) => f.source_folder)).sort();

  const invoiceCount = files.reduce((a, f) => a + f.invoices.length, 0);
  const itemCount = files.reduce(
    (a, f) => a + f.invoices.reduce((b, i) => b + i.items.length, 0),
    0,
  );
  const totalSpend = files.reduce((a, f) => a + f.total_amount, 0);
  const filesNeedingReview = files.filter((f) => f.overall_status !== 'ok').length;
  const flaggedInvoiceCount = files.reduce(
    (a, f) => a + f.invoices.filter((i) => i.check.status !== 'ok').length,
    0,
  );

  const byType = new Map<string, number>();
  const bySupplier = new Map<string, number>();
  const byLoc = new Map<string, number>();
  const byFolder = new Map<string, number>();
  for (const f of files) {
    for (const i of f.invoices) {
      byType.set(i.invoice_type, (byType.get(i.invoice_type) ?? 0) + (i.total ?? 0));
      bySupplier.set(i.supplier_name, (bySupplier.get(i.supplier_name) ?? 0) + (i.total ?? 0));
      byLoc.set(i.location ?? 'unknown', (byLoc.get(i.location ?? 'unknown') ?? 0) + (i.total ?? 0));
    }
    byFolder.set(
      folderLabel(f.source_folder),
      (byFolder.get(folderLabel(f.source_folder)) ?? 0) + f.total_amount,
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {files.length} source PDFs · {invoiceCount} invoices ·{' '}
            {itemCount} line items
            {folderFilter !== undefined && (
              <span className="ml-2 text-zinc-400">
                · filtered to <span className="font-mono">{folderLabel(folderFilter)}</span>
              </span>
            )}
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Total spend (extracted)
          </div>
          <div className="text-2xl font-semibold">
            ${totalSpend.toLocaleString('en-CA', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </header>

      <FolderChips folders={folders} active={folderFilter} />

      {filesNeedingReview > 0 && (
        <section className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 flex items-center gap-3">
          <span className="text-red-600 text-xl">⚠</span>
          <div className="flex-1">
            <div className="font-semibold text-amber-900 dark:text-amber-100">
              {filesNeedingReview} file{filesNeedingReview === 1 ? '' : 's'} need
              review
            </div>
            <div className="text-sm text-amber-800/80 dark:text-amber-200/80">
              {flaggedInvoiceCount} invoice
              {flaggedInvoiceCount === 1 ? '' : 's'} with checksum or
              low-confidence flags
            </div>
          </div>
          <Link
            href={
              folderFilter !== undefined
                ? `/files?folder=${encodeURIComponent(folderFilter)}`
                : '/files'
            }
            className="text-sm font-medium text-blue-700 dark:text-blue-300 hover:underline whitespace-nowrap"
          >
            Open Files →
          </Link>
        </section>
      )}

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card title="By folder" rows={[...byFolder.entries()]} />
        <Card title="By invoice type" rows={[...byType.entries()]} />
        <Card title="By supplier" rows={[...bySupplier.entries()]} />
        <Card title="By location" rows={[...byLoc.entries()]} />
      </section>
    </div>
  );
}

function FolderChips({
  folders,
  active,
}: {
  folders: string[];
  active: string | undefined;
}) {
  if (folders.length === 0) return null;
  if (folders.length === 1 && folders[0] === '' && active === undefined) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm">
      <Chip href="/data" active={active === undefined}>
        All
      </Chip>
      {folders.map((f) => (
        <Chip
          key={f || '__root__'}
          href={`/data?folder=${encodeURIComponent(f)}`}
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

function Card({ title, rows }: { title: string; rows: [string, number][] }) {
  const sorted = [...rows].sort((a, b) => b[1] - a[1]);
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
      <h3 className="font-semibold text-sm uppercase tracking-wide text-zinc-500 mb-3">
        {title}
      </h3>
      <ul className="space-y-1 text-sm">
        {sorted.map(([k, v]) => (
          <li key={k} className="flex justify-between gap-3">
            <span className="truncate">{k}</span>
            <span className="font-mono text-zinc-600 dark:text-zinc-400">
              ${v.toLocaleString('en-CA', { minimumFractionDigits: 2 })}
            </span>
          </li>
        ))}
        {sorted.length === 0 && (
          <li className="text-zinc-500 italic">No data.</li>
        )}
      </ul>
    </div>
  );
}

function strParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}
