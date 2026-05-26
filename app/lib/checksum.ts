import type {
  Invoice,
  InvoiceCheck,
  LineCheck,
  CheckStatus,
} from './types';

const CENT_TOLERANCE = 0.02;
const WARN_THRESHOLD = 0.05;

function statusFromDelta(delta: number | null): CheckStatus {
  if (delta === null) return 'ok';
  const abs = Math.abs(delta);
  if (abs <= CENT_TOLERANCE) return 'ok';
  if (abs <= WARN_THRESHOLD) return 'warn';
  return 'fail';
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function checkInvoice(inv: Invoice): InvoiceCheck {
  const notes: string[] = [];

  const lineChecks: LineCheck[] = inv.items.map((it) => {
    // Weight-priced items (meat, produce by lb/kg): expected = weight × unit_price
    // Quantity-priced items: expected = qty × unit_price
    let computed: number | null = null;
    if (it.weight != null && it.unit_price != null) {
      computed = round2(it.weight * it.unit_price);
    } else if (it.qty != null && it.unit_price != null) {
      computed = round2(it.qty * it.unit_price);
    }
    const delta =
      computed !== null && it.line_total !== null
        ? round2(it.line_total - computed)
        : null;
    return {
      line_number: it.line_number,
      qty: it.qty,
      unit_price: it.unit_price,
      line_total: it.line_total,
      computed,
      delta,
      status: statusFromDelta(delta),
    };
  });

  const itemsSum = inv.items.reduce(
    (acc, it) => (it.line_total !== null ? acc + it.line_total : acc),
    0,
  );
  const itemsSumRounded = round2(itemsSum);

  const itemsVsSub =
    inv.subtotal !== null && inv.items.length > 0
      ? round2(itemsSumRounded - inv.subtotal)
      : null;

  const taxesSum =
    (inv.tax_gst ?? 0) + (inv.tax_qst ?? 0);
  const subPlusTaxVsTotal =
    inv.subtotal !== null && inv.total !== null
      ? round2(inv.subtotal + taxesSum - inv.total)
      : null;

  const itemsSumMatchesTotal =
    inv.total !== null &&
    inv.items.length > 0 &&
    Math.abs(itemsSumRounded - inv.total) <= CENT_TOLERANCE;

  const subPlusTaxStatus = itemsSumMatchesTotal
    ? 'ok'
    : statusFromDelta(subPlusTaxVsTotal);
  const itemsVsSubStatus = itemsSumMatchesTotal
    ? statusFromDelta(itemsVsSub) === 'fail'
      ? 'warn'
      : statusFromDelta(itemsVsSub)
    : statusFromDelta(itemsVsSub);

  const statuses: CheckStatus[] = [
    itemsVsSubStatus,
    subPlusTaxStatus,
    ...lineChecks.map((l) => l.status),
  ];

  const overall: CheckStatus = statuses.includes('fail')
    ? 'fail'
    : statuses.includes('warn')
      ? 'warn'
      : 'ok';

  if (itemsVsSub !== null && Math.abs(itemsVsSub) > CENT_TOLERANCE) {
    notes.push(
      `Items sum ${itemsSumRounded.toFixed(2)} vs declared subtotal ${inv.subtotal!.toFixed(2)} differs by ${itemsVsSub.toFixed(2)}`,
    );
  }
  if (
    subPlusTaxVsTotal !== null &&
    Math.abs(subPlusTaxVsTotal) > CENT_TOLERANCE
  ) {
    notes.push(
      `Subtotal+tax ${(inv.subtotal! + taxesSum).toFixed(2)} vs total ${inv.total!.toFixed(2)} differs by ${subPlusTaxVsTotal.toFixed(2)}`,
    );
  }
  lineChecks
    .filter((l) => l.status !== 'ok')
    .forEach((l) =>
      notes.push(
        `Line ${l.line_number}: ${l.qty} × ${l.unit_price} = ${l.computed} but line_total is ${l.line_total} (Δ ${l.delta})`,
      ),
    );

  return {
    items_sum: inv.items.length > 0 ? itemsSumRounded : null,
    declared_subtotal: inv.subtotal,
    declared_total: inv.total,
    taxes_sum: round2(taxesSum),
    items_vs_subtotal_delta: itemsVsSub,
    subtotal_plus_tax_vs_total_delta: subPlusTaxVsTotal,
    status: overall,
    notes,
    line_checks: lineChecks,
  };
}
