import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Invoice } from './types';
import { correctionsPath } from './config';

// Kept as a named export for tests that read the path; computed lazily.
export const CORRECTIONS_PATH = correctionsPath();

export interface Correction {
  filename: string;
  page_number: number;
  source_region: string;
  line_number: number | null;
  field:
    | 'unit_price'
    | 'qty'
    | 'weight'
    | 'line_total'
    | 'description'
    | 'invoice_date'
    | 'total'
    | 'status_override'
    | 'new_line'
    | 'remove_line';
  value_before: number | string | null;
  value_after: number | string | null;
  reason?: string;
  corrected_by?: string;
  corrected_at?: string;
}

export async function appendCorrection(c: Correction): Promise<void> {
  const line = JSON.stringify({
    ...c,
    corrected_at: c.corrected_at ?? new Date().toISOString(),
  });
  const p = correctionsPath();
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.appendFile(p, line + '\n', 'utf8');
}

export async function loadCorrections(): Promise<Correction[]> {
  try {
    const raw = await fs.readFile(correctionsPath(), 'utf8');
    return raw
      .split('\n')
      .filter((l) => l.trim().length > 0)
      .map((l) => JSON.parse(l) as Correction);
  } catch {
    return [];
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function getStatusOverride(
  invoice: Invoice,
  filename: string,
  corrections: Correction[],
): { value: 'ok-manual' | null; corrected_by?: string; corrected_at?: string } {
  const overrides = corrections
    .filter(
      (c) =>
        c.filename === filename &&
        c.page_number === invoice.page_number &&
        c.source_region === invoice.source_region &&
        c.line_number === null &&
        c.field === 'status_override',
    )
    .sort((a, b) => (a.corrected_at ?? '').localeCompare(b.corrected_at ?? ''));

  const last = overrides[overrides.length - 1];
  if (!last) return { value: null };
  if (last.value_after === 'ok-manual') {
    return {
      value: 'ok-manual',
      corrected_by: last.corrected_by,
      corrected_at: last.corrected_at,
    };
  }
  return { value: null };
}

export function applyCorrectionsToInvoice(
  invoice: Invoice,
  filename: string,
  corrections: Correction[],
): Invoice {
  const scopedAll = corrections.filter(
    (c) =>
      c.filename === filename &&
      c.page_number === invoice.page_number &&
      c.source_region === invoice.source_region &&
      c.field !== 'status_override',
  );
  if (scopedAll.length === 0) return invoice;

  // Handle line additions: new_line with value_after = JSON-serialized item.
  // Handle line removals: remove_line with value_after = line_number to remove.
  const additions = scopedAll.filter((c) => c.field === 'new_line' && typeof c.value_after === 'string');
  const removals = new Set<number>(
    scopedAll
      .filter((c) => c.field === 'remove_line' && typeof c.value_after === 'number')
      .map((c) => c.value_after as number),
  );

  let workingInvoice: Invoice = {
    ...invoice,
    items: invoice.items.filter((it) => !removals.has(it.line_number)),
  };

  for (const add of additions) {
    try {
      const parsed = JSON.parse(add.value_after as string);
      const nextLineNumber =
        workingInvoice.items.reduce((m, it) => Math.max(m, it.line_number), 0) + 1;
      const newItem = {
        line_number: nextLineNumber,
        qty: typeof parsed.qty === 'number' ? parsed.qty : null,
        unit: typeof parsed.unit === 'string' ? parsed.unit : null,
        weight: typeof parsed.weight === 'number' ? parsed.weight : null,
        weight_unit: typeof parsed.weight_unit === 'string' ? parsed.weight_unit : null,
        description_raw: typeof parsed.description === 'string' ? parsed.description : 'manual-add',
        description: typeof parsed.description === 'string' ? parsed.description : 'manual-add',
        description_normalized: (typeof parsed.description === 'string' ? parsed.description : 'manual_add')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, ''),
        unit_price: typeof parsed.unit_price === 'number' ? parsed.unit_price : null,
        line_total:
          typeof parsed.line_total === 'number'
            ? parsed.line_total
            : typeof parsed.qty === 'number' && typeof parsed.unit_price === 'number'
              ? round2(parsed.qty * parsed.unit_price)
              : null,
        category: typeof parsed.category === 'string' ? parsed.category : null,
        confidence: 'high' as const,
        needs_review: false,
        bbox: null,
      };
      workingInvoice = { ...workingInvoice, items: [...workingInvoice.items, newItem] };
    } catch {
      /* malformed payload — skip */
    }
  }

  const matching = scopedAll.filter(
    (c) => c.field !== 'new_line' && c.field !== 'remove_line',
  );
  if (matching.length === 0) return workingInvoice;

  const items = workingInvoice.items.map((it) => {
    const lineCorrections = matching
      .filter((c) => c.line_number === it.line_number)
      .sort((a, b) => (a.corrected_at ?? '').localeCompare(b.corrected_at ?? ''));
    if (lineCorrections.length === 0) return it;

    let patched = { ...it };
    for (const c of lineCorrections) {
      if (c.field === 'unit_price' && typeof c.value_after === 'number') {
        patched.unit_price = c.value_after;
      } else if (c.field === 'qty' && typeof c.value_after === 'number') {
        patched.qty = c.value_after;
      } else if (c.field === 'weight' && typeof c.value_after === 'number') {
        patched.weight = c.value_after;
      } else if (c.field === 'line_total' && typeof c.value_after === 'number') {
        patched.line_total = c.value_after;
      } else if (c.field === 'description' && typeof c.value_after === 'string') {
        patched.description = c.value_after;
      }
    }
    // If user updated unit_price / qty / weight without also updating line_total,
    //  recompute line_total to keep math consistent.
    // Weight takes precedence over qty when both are present (meat-style pricing).
    const userTouched = new Set(lineCorrections.map((c) => c.field));
    if (!userTouched.has('line_total') && patched.unit_price !== null) {
      if (patched.weight !== null) {
        patched.line_total = round2(patched.weight * patched.unit_price);
      } else if (patched.qty !== null) {
        patched.line_total = round2(patched.qty * patched.unit_price);
      }
    }
    return patched;
  });

  let invoicePatched = { ...workingInvoice, items };
  const invoiceLevel = matching.filter((c) => c.line_number === null);
  for (const c of invoiceLevel) {
    if (c.field === 'total' && typeof c.value_after === 'number') {
      invoicePatched.total = c.value_after;
    } else if (c.field === 'invoice_date' && typeof c.value_after === 'string') {
      invoicePatched.invoice_date = c.value_after;
    }
  }
  return invoicePatched;
}
