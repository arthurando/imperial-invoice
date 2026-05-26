import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadFileByFilename, pdfPublicPath } from '@/lib/invoices';
import { folderLabel, folderVsDateMismatch } from '@/lib/folder-badges';
import type { InvoiceWithCheck, InvoiceItem } from '@/lib/types';
import { EditableCell } from './EditableCell';
import { OverrideButton } from './OverrideButton';
import { AddLineRow } from './AddLineRow';

export default async function FileDetailPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  // Catch-all gives us either [filename] (legacy flat) or [folder, filename].
  const decoded = slug.map((s) => decodeURIComponent(s));
  const filename = decoded[decoded.length - 1] ?? '';
  const source_folder = decoded.length > 1 ? decoded.slice(0, -1).join('/') : '';
  const file = await loadFileByFilename(filename, source_folder);
  if (!file) notFound();
  const sourceFilename = filename;
  const mismatch = folderVsDateMismatch(file);

  return (
    <div className="h-[calc(100vh-49px)] flex flex-col">
      <div className="px-6 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center gap-4">
        <Link
          href="/files"
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ← Files
        </Link>
        <h1 className="text-lg font-semibold truncate">{file.filename}</h1>
        <span className="text-xs px-2 py-0.5 rounded font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
          {folderLabel(file.source_folder)}
        </span>
        {mismatch && (
          <span
            className="text-xs px-2 py-0.5 rounded font-mono bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
            title="At least one invoice in this file has an invoice_date outside the folder month"
          >
            ⚠︎ folder vs invoice date
          </span>
        )}
        <span className="text-xs text-zinc-500 ml-auto font-mono">
          {file.invoices.length} invoice
          {file.invoices.length === 1 ? '' : 's'} · {file.page_count} pages ·
          batch {file.batch_label}
        </span>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_1fr] min-h-0">
        <div className="border-r border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 min-h-0">
          <iframe
            src={pdfPublicPath(file)}
            className="w-full h-full"
            title={file.filename}
          />
        </div>
        <div className="overflow-y-auto bg-zinc-50 dark:bg-zinc-950">
          <div className="p-4 space-y-4">
            {file.invoices.map((inv, idx) => (
              <InvoiceCard key={idx} invoice={inv} filename={sourceFilename} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function InvoiceCard({
  invoice,
  filename,
}: {
  invoice: InvoiceWithCheck;
  filename: string;
}) {
  const statusColor =
    invoice.check.status === 'ok'
      ? 'border-emerald-300 dark:border-emerald-800'
      : invoice.check.status === 'ok-manual'
        ? 'border-blue-300 dark:border-blue-800'
        : invoice.check.status === 'warn'
          ? 'border-amber-300 dark:border-amber-800'
          : 'border-red-300 dark:border-red-800';

  const hasWeight = invoice.items.some((it) => it.weight != null);

  return (
    <div
      className={`rounded-lg border-2 ${statusColor} bg-white dark:bg-zinc-900 overflow-hidden`}
    >
      <header className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-3">
        <CheckBadge status={invoice.check.status} />
        <div className="min-w-0">
          <div className="font-semibold truncate">{invoice.supplier_name}</div>
          <div className="text-xs text-zinc-500 font-mono">
            {invoice.invoice_date ?? '— no date —'} · #
            {invoice.invoice_number ?? '—'} · {invoice.source_region} · page{' '}
            {invoice.page_number}
          </div>
        </div>
        <OverrideButton
          filename={filename}
          page_number={invoice.page_number}
          source_region={invoice.source_region}
          currentStatus={invoice.check.status}
        />
        <div className="ml-auto text-right">
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Total
          </div>
          <div className="font-mono font-semibold">
            <EditableCell
              filename={filename}
              page_number={invoice.page_number}
              source_region={invoice.source_region}
              line_number={null}
              field="total"
              initialValue={invoice.total}
              display={
                invoice.total === null
                  ? '—'
                  : `$${invoice.total.toLocaleString('en-CA', { minimumFractionDigits: 2 })}`
              }
            />
          </div>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 px-4 py-3 text-xs">
        <Field label="Location" value={invoice.location ?? '—'} hint={invoice.location_evidence} />
        <Field label="Type" value={invoice.invoice_type} />
        {invoice.billing_period_start && (
          <Field
            label="Billing period"
            value={`${invoice.billing_period_start} → ${invoice.billing_period_end ?? '—'}`}
          />
        )}
        {invoice.cheque_number && (
          <Field label="Cheque #" value={invoice.cheque_number} />
        )}
        {invoice.subtotal !== null && (
          <Field
            label="Subtotal"
            value={`$${invoice.subtotal.toFixed(2)}`}
          />
        )}
        {(invoice.tax_gst ?? 0) + (invoice.tax_qst ?? 0) > 0 && (
          <Field
            label="Tax (GST+QST)"
            value={`$${(((invoice.tax_gst ?? 0) + (invoice.tax_qst ?? 0)) || 0).toFixed(2)}`}
          />
        )}
      </dl>

      {invoice.auto_corrections.length > 0 && (
        <div className="mx-4 mb-3 rounded p-2 text-xs bg-blue-50 text-blue-900 dark:bg-blue-950/40 dark:text-blue-200 border border-blue-200 dark:border-blue-900">
          <div className="font-semibold mb-1">
            Auto-corrected from price history ({invoice.auto_corrections.length})
          </div>
          <ul className="space-y-1">
            {invoice.auto_corrections.map((c, i) => (
              <li key={i}>
                · Line {c.line_number}: unit_price{' '}
                <span className="line-through text-blue-700/60">
                  ${c.value_before?.toFixed(2)}
                </span>{' '}
                → <span className="font-semibold">${c.value_after.toFixed(2)}</span>{' '}
                <span className="text-blue-700/70">— {c.basis}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {invoice.check.notes.length > 0 && (
        <div
          className={`mx-4 mb-3 rounded p-2 text-xs ${
            invoice.check.status === 'fail'
              ? 'bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-200'
              : 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
          }`}
        >
          <div className="font-semibold mb-1">
            Checksum {invoice.check.status === 'fail' ? 'failed' : 'warning'}
          </div>
          <ul className="space-y-0.5">
            {invoice.check.notes.map((n, i) => (
              <li key={i}>· {n}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-t border-zinc-100 dark:border-zinc-800">
        <table className="w-full text-xs">
          <thead className="bg-zinc-50 dark:bg-zinc-900 text-zinc-500">
            <tr>
              <th className="text-left px-3 py-1.5 font-medium">#</th>
              <th className="text-left px-3 py-1.5 font-medium">Qty</th>
              <th className="text-left px-3 py-1.5 font-medium">Unit</th>
              {hasWeight && (
                <th className="text-right px-3 py-1.5 font-medium">Weight</th>
              )}
              <th className="text-left px-3 py-1.5 font-medium">Description</th>
              <th className="text-right px-3 py-1.5 font-medium">Unit price</th>
              <th className="text-right px-3 py-1.5 font-medium">Line total</th>
              <th className="text-center px-3 py-1.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {invoice.items.map((it) => {
              const lc = invoice.check.line_checks.find(
                (l) => l.line_number === it.line_number,
              );
              return (
                <tr
                  key={it.line_number}
                  className={
                    it.needs_review
                      ? 'bg-amber-50/60 dark:bg-amber-950/20'
                      : ''
                  }
                >
                  <td className="px-3 py-1.5 font-mono">{it.line_number}</td>
                  <td className="px-3 py-1.5 font-mono">
                    <EditableCell
                      filename={filename}
                      page_number={invoice.page_number}
                      source_region={invoice.source_region}
                      line_number={it.line_number}
                      field="qty"
                      initialValue={it.qty}
                      align="left"
                    />
                  </td>
                  <td className="px-3 py-1.5 font-mono text-zinc-500">
                    {it.unit ?? '—'}
                  </td>
                  {hasWeight && (
                    <td className="px-3 py-1.5 font-mono text-right">
                      <EditableCell
                        filename={filename}
                        page_number={invoice.page_number}
                        source_region={invoice.source_region}
                        line_number={it.line_number}
                        field="weight"
                        initialValue={it.weight}
                        display={
                          it.weight === null
                            ? '—'
                            : `${it.weight.toFixed(2)} ${it.weight_unit ?? ''}`.trim()
                        }
                      />
                    </td>
                  )}
                  <td
                    className="px-3 py-1.5"
                    title={it.description_raw}
                  >
                    <span className={confidenceClass(it.confidence)}>
                      {it.description}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 font-mono text-right">
                    <EditableCell
                      filename={filename}
                      page_number={invoice.page_number}
                      source_region={invoice.source_region}
                      line_number={it.line_number}
                      field="unit_price"
                      initialValue={it.unit_price}
                      display={it.unit_price === null ? '—' : `$${it.unit_price.toFixed(2)}`}
                    />
                  </td>
                  <td className="px-3 py-1.5 font-mono text-right">
                    <EditableCell
                      filename={filename}
                      page_number={invoice.page_number}
                      source_region={invoice.source_region}
                      line_number={it.line_number}
                      field="line_total"
                      initialValue={it.line_total}
                      display={it.line_total === null ? '—' : `$${it.line_total.toFixed(2)}`}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    {lc?.status === 'ok'
                      ? '✓'
                      : lc?.status === 'warn'
                        ? '⚠︎'
                        : lc?.status === 'fail'
                          ? '⚠'
                          : '—'}
                  </td>
                </tr>
              );
            })}
            <AddLineRow
              filename={filename}
              page_number={invoice.page_number}
              source_region={invoice.source_region}
              colCount={hasWeight ? 8 : 7}
            />
          </tbody>
        </table>
      </div>

      {invoice.notes && (
        <div className="px-4 py-2 text-xs text-zinc-500 border-t border-zinc-100 dark:border-zinc-800">
          <span className="font-semibold">Notes:</span> {invoice.notes}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string | null;
}) {
  return (
    <>
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-right font-mono truncate" title={hint ?? undefined}>
        {value}
      </dd>
    </>
  );
}

function CheckBadge({ status }: { status: 'ok' | 'warn' | 'fail' | 'ok-manual' }) {
  const styles = {
    ok: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    'ok-manual': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    warn: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    fail: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  }[status];
  const label = {
    ok: '✓ OK',
    'ok-manual': '✓ OK-manual',
    warn: '⚠︎ Warn',
    fail: '⚠ Fail',
  }[status];
  return (
    <span className={`text-xs font-mono px-2 py-1 rounded ${styles}`}>
      {label}
    </span>
  );
}

function confidenceClass(c: InvoiceItem['confidence']) {
  if (c === 'low') return 'underline decoration-red-500 decoration-wavy';
  if (c === 'medium')
    return 'underline decoration-amber-500 decoration-dotted';
  return '';
}
