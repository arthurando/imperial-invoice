import Link from 'next/link';
import { loadAllFiles } from '@/lib/invoices';
import { folderLabel } from '@/lib/folder-badges';
import type { FileWithChecks } from '@/lib/types';

type Agg = {
  description_normalized: string;
  description: string;
  category: string | null;
  qty: number;
  spend: number;
  prices: number[];
};

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const a = strParam(sp.a);
  const b = strParam(sp.b);

  const allFiles = await loadAllFiles();
  const folders = unique(allFiles.map((f) => f.source_folder)).sort();

  if (a === undefined || b === undefined || a === b) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-4">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Compare</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Pick two folders to see Δ qty / Δ price / Δ spend per item, supplier, and category.
          </p>
        </header>
        <FolderPicker
          folders={folders}
          a={a}
          b={b}
          note={
            a !== undefined && a === b
              ? 'Pick two different folders to compare.'
              : undefined
          }
        />
      </div>
    );
  }

  const filesA = allFiles.filter((f) => f.source_folder === a);
  const filesB = allFiles.filter((f) => f.source_folder === b);

  const aggA = aggregate(filesA);
  const aggB = aggregate(filesB);
  const keys = new Set<string>([...aggA.keys(), ...aggB.keys()]);
  const rows = [...keys].map((k) => {
    const ra = aggA.get(k);
    const rb = aggB.get(k);
    const avgA = ra && ra.prices.length ? ra.prices.reduce((x, y) => x + y, 0) / ra.prices.length : null;
    const avgB = rb && rb.prices.length ? rb.prices.reduce((x, y) => x + y, 0) / rb.prices.length : null;
    return {
      key: k,
      description: ra?.description ?? rb?.description ?? k,
      category: ra?.category ?? rb?.category ?? null,
      qtyA: ra?.qty ?? 0,
      qtyB: rb?.qty ?? 0,
      spendA: ra?.spend ?? 0,
      spendB: rb?.spend ?? 0,
      priceA: avgA,
      priceB: avgB,
      deltaSpend: (rb?.spend ?? 0) - (ra?.spend ?? 0),
      deltaQty: (rb?.qty ?? 0) - (ra?.qty ?? 0),
      deltaPricePct:
        avgA && avgB && avgA > 0 ? ((avgB - avgA) / avgA) * 100 : null,
    };
  });
  rows.sort((x, y) => Math.abs(y.deltaSpend) - Math.abs(x.deltaSpend));

  const totalA = filesA.reduce((s, f) => s + f.total_amount, 0);
  const totalB = filesB.reduce((s, f) => s + f.total_amount, 0);
  const deltaTotal = totalB - totalA;

  const byCategoryA = rollupCategory(aggA);
  const byCategoryB = rollupCategory(aggB);
  const categoryRows = mergeRollups(byCategoryA, byCategoryB);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Compare</h1>
          <p className="text-sm text-zinc-500 mt-1">
            <span className="font-mono">{folderLabel(a)}</span> vs{' '}
            <span className="font-mono">{folderLabel(b)}</span>
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Δ Total spend
          </div>
          <div
            className={`text-2xl font-semibold font-mono ${
              deltaTotal > 0
                ? 'text-red-600 dark:text-red-400'
                : deltaTotal < 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : ''
            }`}
          >
            {deltaTotal >= 0 ? '+' : ''}$
            {deltaTotal.toLocaleString('en-CA', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-zinc-500 mt-0.5 font-mono">
            ${totalA.toLocaleString('en-CA', { minimumFractionDigits: 2 })} → $
            {totalB.toLocaleString('en-CA', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </header>

      <FolderPicker folders={folders} a={a} b={b} />

      <section className="space-y-2">
        <h2 className="font-semibold text-sm uppercase tracking-wide text-zinc-500">
          By category
        </h2>
        <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 text-xs">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Category</th>
                <th className="text-right px-3 py-2 font-medium">{folderLabel(a)}</th>
                <th className="text-right px-3 py-2 font-medium">{folderLabel(b)}</th>
                <th className="text-right px-3 py-2 font-medium">Δ spend</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-zinc-950 divide-y divide-zinc-100 dark:divide-zinc-800">
              {categoryRows.map((r) => (
                <tr key={r.label}>
                  <td className="px-3 py-2">{r.label}</td>
                  <td className="px-3 py-2 font-mono text-right">
                    ${r.a.toLocaleString('en-CA', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2 font-mono text-right">
                    ${r.b.toLocaleString('en-CA', { minimumFractionDigits: 2 })}
                  </td>
                  <td
                    className={`px-3 py-2 font-mono text-right ${
                      r.b - r.a > 0
                        ? 'text-red-600 dark:text-red-400'
                        : r.b - r.a < 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : ''
                    }`}
                  >
                    {r.b - r.a >= 0 ? '+' : ''}$
                    {(r.b - r.a).toLocaleString('en-CA', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-sm uppercase tracking-wide text-zinc-500">
          By line item (top movers)
        </h2>
        <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 text-xs">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Item</th>
                <th className="text-right px-3 py-2 font-medium">
                  {folderLabel(a)} qty
                </th>
                <th className="text-right px-3 py-2 font-medium">
                  {folderLabel(b)} qty
                </th>
                <th className="text-right px-3 py-2 font-medium">Δ qty</th>
                <th className="text-right px-3 py-2 font-medium">Δ unit price</th>
                <th className="text-right px-3 py-2 font-medium">Δ spend</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-zinc-950 divide-y divide-zinc-100 dark:divide-zinc-800">
              {rows.slice(0, 50).map((r) => (
                <tr key={r.key}>
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.description}</div>
                    <div className="text-xs text-zinc-500 font-mono">{r.key}</div>
                  </td>
                  <td className="px-3 py-2 font-mono text-right">
                    {r.qtyA.toLocaleString('en-CA')}
                  </td>
                  <td className="px-3 py-2 font-mono text-right">
                    {r.qtyB.toLocaleString('en-CA')}
                  </td>
                  <td
                    className={`px-3 py-2 font-mono text-right ${
                      r.deltaQty > 0
                        ? 'text-red-600 dark:text-red-400'
                        : r.deltaQty < 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : ''
                    }`}
                  >
                    {r.deltaQty >= 0 ? '+' : ''}
                    {r.deltaQty.toLocaleString('en-CA')}
                  </td>
                  <td className="px-3 py-2 font-mono text-right">
                    {r.deltaPricePct === null
                      ? '—'
                      : `${r.deltaPricePct >= 0 ? '+' : ''}${r.deltaPricePct.toFixed(1)}%`}
                  </td>
                  <td
                    className={`px-3 py-2 font-mono text-right ${
                      r.deltaSpend > 0
                        ? 'text-red-600 dark:text-red-400'
                        : r.deltaSpend < 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : ''
                    }`}
                  >
                    {r.deltaSpend >= 0 ? '+' : ''}$
                    {r.deltaSpend.toLocaleString('en-CA', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-zinc-500 italic">
                    No line items in either folder.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {rows.length > 50 && (
          <p className="text-xs text-zinc-500">
            Showing top 50 of {rows.length} items by |Δ spend|.
          </p>
        )}
      </section>
    </div>
  );
}

function aggregate(files: FileWithChecks[]): Map<string, Agg> {
  const map = new Map<string, Agg>();
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
            qty: 0,
            spend: 0,
            prices: [],
          } as Agg);
        row.qty += it.qty ?? 0;
        row.spend += it.line_total ?? 0;
        if (it.unit_price !== null) row.prices.push(it.unit_price);
        map.set(key, row);
      }
    }
  }
  return map;
}

function rollupCategory(agg: Map<string, Agg>): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of agg.values()) {
    const k = r.category ?? 'uncategorized';
    out.set(k, (out.get(k) ?? 0) + r.spend);
  }
  return out;
}

function mergeRollups(
  a: Map<string, number>,
  b: Map<string, number>,
): { label: string; a: number; b: number }[] {
  const keys = new Set<string>([...a.keys(), ...b.keys()]);
  return [...keys]
    .map((k) => ({ label: k, a: a.get(k) ?? 0, b: b.get(k) ?? 0 }))
    .sort((x, y) => Math.abs(y.b - y.a) - Math.abs(x.b - x.a));
}

function FolderPicker({
  folders,
  a,
  b,
  note,
}: {
  folders: string[];
  a: string | undefined;
  b: string | undefined;
  note?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FolderColumn label="A (baseline)" param="a" current={a} other={b} folders={folders} />
        <FolderColumn label="B (current)" param="b" current={b} other={a} folders={folders} />
      </div>
      {note && <p className="text-sm text-amber-700 dark:text-amber-300">{note}</p>}
      <p className="text-xs text-zinc-500">
        Tip: red Δ means cost went UP from A→B. Green Δ means cost went DOWN.
      </p>
    </div>
  );
}

function FolderColumn({
  label,
  param,
  current,
  other,
  folders,
}: {
  label: string;
  param: 'a' | 'b';
  current: string | undefined;
  other: string | undefined;
  folders: string[];
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {folders.map((f) => {
          const otherParam = param === 'a' ? 'b' : 'a';
          const href = `/data/compare?${param}=${encodeURIComponent(f)}${
            other !== undefined ? `&${otherParam}=${encodeURIComponent(other)}` : ''
          }`;
          const active = current === f;
          return (
            <Link
              key={f || '__root__'}
              href={href}
              className={`px-2.5 py-1 rounded-full text-xs font-mono border ${
                active
                  ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100'
                  : 'bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-zinc-500'
              }`}
            >
              {folderLabel(f)}
            </Link>
          );
        })}
        {folders.length === 0 && (
          <span className="text-xs text-zinc-500 italic">No folders yet.</span>
        )}
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
