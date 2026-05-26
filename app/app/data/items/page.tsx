import Link from 'next/link';
import { loadAllFiles } from '@/lib/invoices';
import { folderLabel } from '@/lib/folder-badges';

type Row = {
  description_normalized: string;
  description: string;
  category: string | null;
  suppliers: Set<string>;
  occurrences: number;
  total_qty: number;
  total_spend: number;
  prices: number[];
  min_price: number;
  max_price: number;
  avg_price: number;
  sources: { filename: string; date: string | null; qty: number; price: number }[];
};

export default async function ItemsPage({
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
  const map = new Map<string, Row>();

  for (const f of files) {
    for (const inv of f.invoices) {
      for (const it of inv.items) {
        const key = it.description_normalized || it.description;
        const row =
          map.get(key) ??
          ({
            description_normalized: key,
            description: it.description,
            category: it.category,
            suppliers: new Set<string>(),
            occurrences: 0,
            total_qty: 0,
            total_spend: 0,
            prices: [],
            min_price: Infinity,
            max_price: -Infinity,
            avg_price: 0,
            sources: [],
          } as Row);
        row.suppliers.add(inv.supplier_name);
        row.occurrences += 1;
        row.total_qty += it.qty ?? 0;
        row.total_spend += it.line_total ?? 0;
        if (it.unit_price !== null) {
          row.prices.push(it.unit_price);
          row.min_price = Math.min(row.min_price, it.unit_price);
          row.max_price = Math.max(row.max_price, it.unit_price);
        }
        row.sources.push({
          filename: f.filename,
          date: inv.invoice_date,
          qty: it.qty ?? 0,
          price: it.unit_price ?? 0,
        });
        map.set(key, row);
      }
    }
  }

  for (const r of map.values())
    r.avg_price =
      r.prices.length === 0
        ? 0
        : r.prices.reduce((a, b) => a + b, 0) / r.prices.length;

  const rows = [...map.values()].sort((a, b) => b.total_spend - a.total_spend);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Line items</h1>
        <p className="text-sm text-zinc-500 mt-1">
          {rows.length} unique items (by normalized description). Sorted by
          total spend.
          {folderFilter !== undefined && (
            <span className="ml-2 text-zinc-400">
              · filtered to <span className="font-mono">{folderLabel(folderFilter)}</span>
            </span>
          )}
        </p>
      </header>

      <FolderChips folders={folders} active={folderFilter} />

      <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 text-xs">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Item</th>
              <th className="text-left px-3 py-2 font-medium">Category</th>
              <th className="text-left px-3 py-2 font-medium">Suppliers</th>
              <th className="text-right px-3 py-2 font-medium">Times bought</th>
              <th className="text-right px-3 py-2 font-medium">Total qty</th>
              <th className="text-right px-3 py-2 font-medium">Avg price</th>
              <th className="text-right px-3 py-2 font-medium">Price range</th>
              <th className="text-right px-3 py-2 font-medium">Total spend</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-zinc-950 divide-y divide-zinc-100 dark:divide-zinc-800">
            {rows.map((r) => {
              const range =
                r.prices.length > 1
                  ? `$${r.min_price.toFixed(2)} – $${r.max_price.toFixed(2)}`
                  : r.prices.length === 1
                    ? `$${r.prices[0].toFixed(2)}`
                    : '—';
              const volatile =
                r.prices.length > 1 && r.max_price > r.min_price * 1.1;
              return (
                <tr key={r.description_normalized}>
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.description}</div>
                    <div className="text-xs text-zinc-500 font-mono">
                      {r.description_normalized}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400 text-xs">
                    {r.category ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {[...r.suppliers].join(', ')}
                  </td>
                  <td className="px-3 py-2 font-mono text-right">
                    {r.occurrences}
                  </td>
                  <td className="px-3 py-2 font-mono text-right">
                    {r.total_qty.toLocaleString('en-CA')}
                  </td>
                  <td className="px-3 py-2 font-mono text-right">
                    {r.avg_price > 0 ? `$${r.avg_price.toFixed(2)}` : '—'}
                  </td>
                  <td
                    className={`px-3 py-2 font-mono text-right ${volatile ? 'text-amber-600 dark:text-amber-400 font-semibold' : ''}`}
                  >
                    {range}
                  </td>
                  <td className="px-3 py-2 font-mono text-right">
                    $
                    {r.total_spend.toLocaleString('en-CA', {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-zinc-500 italic">
                  No items in this folder.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-zinc-500">
        Amber price range = item has &gt;10% spread across appearances.
        Compare two folders side-by-side on the{' '}
        <Link href="/data/compare" className="underline">
          Compare
        </Link>{' '}
        page.
      </p>
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
      <Chip href="/data/items" active={active === undefined}>
        All
      </Chip>
      {folders.map((f) => (
        <Chip
          key={f || '__root__'}
          href={`/data/items?folder=${encodeURIComponent(f)}`}
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

function strParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}
