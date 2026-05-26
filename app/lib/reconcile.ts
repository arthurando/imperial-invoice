import type { Invoice, InvoiceItem, AutoCorrection, CheckStatus } from './types';
import type { PriceHistory } from './price-history';
import { lookupModalPrice } from './price-history';
import { checkInvoice } from './checksum';

const CENT_TOLERANCE = 0.02;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface ReconcileResult {
  reconciled: Invoice;
  corrections: AutoCorrection[];
}

/**
 * Reconciler that distrusts every OCR'd field.
 *
 * For each line item with a historical modal unit price, generate candidate
 * (qty, unit_price, line_total) tuples:
 *   - keep original
 *   - keep qty, apply modal price, recompute line_total = qty × modal_price
 *   - keep line_total, apply modal price, derive qty = line_total / modal_price (must be integer-ish)
 *
 * For lines with no history: only the "keep original" candidate.
 *
 * Search across the product of candidates per line; pick the combination whose
 *  sum(line_total) ≈ declared_total (or whose overall checksum becomes ok).
 * Each adopted change is reported as an AutoCorrection with traceable basis.
 */
export function reconcileInvoice(
  invoice: Invoice,
  history: PriceHistory,
): ReconcileResult {
  const initial = checkInvoice(invoice);
  if (initial.status === 'ok') {
    return { reconciled: invoice, corrections: [] };
  }

  const declared = invoice.total ?? invoice.subtotal;
  if (declared === null) {
    return { reconciled: invoice, corrections: [] };
  }

  const perLineCandidates = invoice.items.map((it) => buildLineCandidates(it, invoice.supplier_normalized, history));

  // Prune: if any line has too many variants, cap by ranking on closeness to declared/n
  const product = cartesian(perLineCandidates);
  if (product.length === 0) return { reconciled: invoice, corrections: [] };

  let bestStatus: CheckStatus = checkInvoice(invoice).status;
  let bestCombo: LineVariant[] = perLineCandidates.map((opts) => opts[0]);
  let bestInvoice = invoice;

  for (const combo of product) {
    const patched: Invoice = {
      ...invoice,
      items: invoice.items.map((it, idx) => ({
        ...it,
        unit_price: combo[idx].unit_price,
        qty: combo[idx].qty,
        line_total: combo[idx].line_total,
      })),
    };
    const c = checkInvoice(patched);
    const changes = combo.filter((v) => v.kind !== 'original').length;
    const prevChanges = bestCombo.filter((v) => v.kind !== 'original').length;

    const wins =
      betterStatus(c.status, bestStatus) ||
      (c.status === bestStatus && changes < prevChanges);

    if (wins) {
      bestStatus = c.status;
      bestCombo = combo;
      bestInvoice = patched;
      if (c.status === 'ok' && changes === 0) break;
    }
  }

  const corrections: AutoCorrection[] = [];
  bestCombo.forEach((variant, idx) => {
    const it = invoice.items[idx];
    if (variant.kind === 'original') return;
    if (variant.unit_price !== it.unit_price) {
      corrections.push({
        line_number: it.line_number,
        field: 'unit_price',
        value_before: it.unit_price,
        value_after: variant.unit_price as number,
        basis: variant.basis,
        history_occurrences: variant.history_occurrences,
        history_confidence: variant.history_confidence,
      });
    }
    if (variant.qty !== it.qty) {
      corrections.push({
        line_number: it.line_number,
        field: 'qty',
        value_before: it.qty,
        value_after: variant.qty as number,
        basis: variant.basis,
        history_occurrences: variant.history_occurrences,
        history_confidence: variant.history_confidence,
      });
    }
    if (variant.line_total !== it.line_total) {
      corrections.push({
        line_number: it.line_number,
        field: 'line_total',
        value_before: it.line_total,
        value_after: variant.line_total as number,
        basis: variant.basis,
        history_occurrences: variant.history_occurrences,
        history_confidence: variant.history_confidence,
      });
    }
  });

  return { reconciled: bestInvoice, corrections };
}

interface LineVariant {
  kind: 'original' | 'price_swap_keep_qty' | 'price_swap_derive_qty';
  unit_price: number | null;
  qty: number | null;
  line_total: number | null;
  basis: string;
  history_occurrences: number;
  history_confidence: number;
}

function buildLineCandidates(
  item: InvoiceItem,
  supplier: string,
  history: PriceHistory,
): LineVariant[] {
  const variants: LineVariant[] = [
    {
      kind: 'original',
      unit_price: item.unit_price,
      qty: item.qty,
      line_total: item.line_total,
      basis: '',
      history_occurrences: 0,
      history_confidence: 0,
    },
  ];

  const modal = lookupModalPrice(history, supplier, item.description_normalized);
  if (modal === null || modal.confidence < 0.5) return variants;

  const modePrice = modal.modal_unit_price;
  const basisCore = `Historical modal price for ${supplier} / ${item.description_normalized}: $${modePrice.toFixed(2)} (${Math.round(modal.confidence * modal.occurrences)}/${modal.occurrences} prior receipts)`;

  // Variant A: keep qty, apply modal price, recompute line_total.
  //  Generated whenever the resulting (qty × modal_price) differs from the OCR'd line_total
  //  — which means EITHER unit_price was wrong OR line_total itself was an OCR error.
  if (item.qty !== null) {
    const recomputed = round2(item.qty * modePrice);
    const differsFromCurrent = recomputed !== item.line_total || modePrice !== item.unit_price;
    if (differsFromCurrent) {
      variants.push({
        kind: 'price_swap_keep_qty',
        unit_price: modePrice,
        qty: item.qty,
        line_total: recomputed,
        basis: `${basisCore}; trusted extracted qty=${item.qty}, recomputed line_total = ${item.qty} × $${modePrice.toFixed(2)} = $${recomputed.toFixed(2)}`,
        history_occurrences: modal.occurrences,
        history_confidence: modal.confidence,
      });
    }
  }

  // Variant B: keep line_total, derive qty from modal price
  if (item.line_total !== null) {
    const derivedQty = item.line_total / modePrice;
    const roundedQty = Math.round(derivedQty);
    if (roundedQty > 0 && Math.abs(derivedQty - roundedQty) < 0.05) {
      const isNoop = modePrice === item.unit_price && roundedQty === item.qty;
      if (!isNoop) {
        variants.push({
          kind: 'price_swap_derive_qty',
          unit_price: modePrice,
          qty: roundedQty,
          line_total: round2(roundedQty * modePrice),
          basis: `${basisCore}; trusted extracted line_total=$${item.line_total}, derived qty=${roundedQty}`,
          history_occurrences: modal.occurrences,
          history_confidence: modal.confidence,
        });
      }
    }
  }

  return variants;
}

function cartesian<T>(arrs: T[][]): T[][] {
  if (arrs.length === 0) return [];
  if (arrs.some((a) => a.length === 0)) return [];
  // Cap combinatorial blowup
  const total = arrs.reduce((acc, a) => acc * a.length, 1);
  if (total > 2048) {
    return arrs.map((a) => [a[a.length - 1]]).reduce<T[][]>((acc, opts) => {
      if (acc.length === 0) return opts.map((o) => [o]);
      return acc.flatMap((prev) => opts.map((o) => [...prev, o]));
    }, []);
  }
  return arrs.reduce<T[][]>(
    (acc, opts) => acc.flatMap((prev) => opts.map((o) => [...prev, o])),
    [[]],
  );
}

function betterStatus(a: CheckStatus, b: CheckStatus): boolean {
  const rank: Record<CheckStatus, number> = { fail: 0, warn: 1, ok: 2, 'ok-manual': 2 };
  return rank[a] > rank[b];
}
