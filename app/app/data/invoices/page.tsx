import Link from 'next/link';
import { loadAllFiles, filesViewerPath } from '@/lib/invoices';
import { folderLabel } from '@/lib/folder-badges';
import { InvoiceFilters } from './InvoiceFilters';

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const folderFilter = strParam(sp.folder);
  const monthFilter = strParam(sp.month);
  const supplierFilter = strParam(sp.supplier);
  const typeFilter = strParam(sp.type);
  const locationFilter = strParam(sp.location);
  const checkFilter = strParam(sp.check);

  const files = await loadAllFiles();
  const rows = files
    .flatMap((f) =>
      f.invoices.map((inv) => ({
        filename: f.filename,
        source_folder: f.source_folder,
        batch: f.batch_label,
        page: inv.page_number,
        region: inv.source_region,
        date: inv.invoice_date,
        month: inv.invoice_date?.slice(0, 7) ?? null,
        supplier: inv.supplier_name,
        location: inv.location ?? 'unknown',
        type: inv.invoice_type,
        number: inv.invoice_number,
        total: inv.total,
        items: inv.items.length,
        check: inv.check.status,
      })),
    )
    .sort((a, b) =>
      (b.date ?? '0000-00-00').localeCompare(a.date ?? '0000-00-00'),
    );

  const folders = unique(rows.map((r) => r.source_folder)).sort();
  const months = unique(rows.map((r) => r.month).filter((m): m is string => m !== null)).sort().reverse();
  const suppliers = unique(rows.map((r) => r.supplier)).sort();
  const types = unique(rows.map((r) => r.type)).sort();
  const locations = unique(rows.map((r) => r.location)).sort();

  const filtered = rows.filter((r) => {
    if (folderFilter !== undefined && r.source_folder !== folderFilter) return false;
    if (monthFilter && r.month !== monthFilter) return false;
    if (supplierFilter && r.supplier !== supplierFilter) return false;
    if (typeFilter && r.type !== typeFilter) return false;
    if (locationFilter && r.location !== locationFilter) return false;
    if (checkFilter && r.check !== checkFilter) return false;
    return true;
  });

  const filteredTotal = filtered.reduce((a, r) => a + (r.total ?? 0), 0);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {filtered.length} of {rows.length} invoices · ${filteredTotal.toLocaleString('en-CA', { minimumFractionDigits: 2 })}
            {filtered.length !== rows.length && (
              <span className="text-zinc-400"> (filtered)</span>
            )}
          </p>
        </div>
      </header>

      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
        <InvoiceFilters
          folders={folders}
          months={months}
          suppliers={suppliers}
          types={types}
          locations={locations}
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 text-xs">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Folder</th>
              <th className="text-left px-3 py-2 font-medium">Date</th>
              <th className="text-left px-3 py-2 font-medium">Supplier</th>
              <th className="text-left px-3 py-2 font-medium">Type</th>
              <th className="text-left px-3 py-2 font-medium">Loc</th>
              <th className="text-left px-3 py-2 font-medium">Invoice #</th>
              <th className="text-right px-3 py-2 font-medium">Items</th>
              <th className="text-right px-3 py-2 font-medium">Total</th>
              <th className="text-center px-3 py-2 font-medium">Status</th>
              <th className="text-left px-3 py-2 font-medium">Source</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-zinc-950 divide-y divide-zinc-100 dark:divide-zinc-800">
            {filtered.map((r, idx) => {
              const folderMonth = r.source_folder
                ? r.source_folder.slice(0, 7).match(/^\d{4}-\d{2}$/)
                  ? r.source_folder.slice(0, 7)
                  : null
                : null;
              const mismatch = folderMonth && r.month && folderMonth !== r.month;
              return (
                <tr key={idx}>
                  <td className="px-3 py-2 text-xs">
                    <span className="font-mono text-zinc-600 dark:text-zinc-400">
                      {folderLabel(r.source_folder)}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono whitespace-nowrap">
                    {r.date ?? '—'}
                    {mismatch && (
                      <span
                        title={`Filed under ${r.source_folder} but invoice_date is ${r.date}`}
                        className="ml-1 text-amber-600"
                      >
                        ⚠︎
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">{r.supplier}</td>
                  <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                    {r.type}
                  </td>
                  <td className="px-3 py-2 font-mono">{r.location}</td>
                  <td className="px-3 py-2 font-mono text-xs text-zinc-500">
                    {r.number ?? '—'}
                  </td>
                  <td className="px-3 py-2 font-mono text-right">{r.items}</td>
                  <td className="px-3 py-2 font-mono text-right">
                    {r.total === null
                      ? '—'
                      : `$${r.total.toLocaleString('en-CA', { minimumFractionDigits: 2 })}`}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {r.check === 'ok' ? '✓' : r.check === 'warn' ? '⚠︎' : '⚠'}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <Link
                      href={filesViewerPath({ filename: r.filename, source_folder: r.source_folder })}
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {r.filename}
                    </Link>
                    <span className="text-zinc-400 ml-1">
                      · {r.region} p{r.page}
                    </span>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-zinc-500 italic">
                  No invoices match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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
