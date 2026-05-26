import type { ExtractionFile } from './types';

export interface ModalPrice {
  supplier_normalized: string;
  description_normalized: string;
  modal_unit_price: number;
  occurrences: number;
  confidence: number;
  outliers: number[];
  all_prices: number[];
}

export type PriceHistory = Map<string, ModalPrice>;

function key(supplier: string, item: string): string {
  return `${supplier}::${item}`;
}

function pickMode(prices: number[]): { mode: number; modeCount: number } {
  const counts = new Map<number, number>();
  for (const p of prices) counts.set(p, (counts.get(p) ?? 0) + 1);
  let best = prices[0];
  let bestCount = 0;
  for (const [val, n] of counts) {
    if (n > bestCount) {
      best = val;
      bestCount = n;
    }
  }
  return { mode: best, modeCount: bestCount };
}

export function buildPriceHistory(files: ExtractionFile[]): PriceHistory {
  const buckets = new Map<string, { supplier: string; item: string; prices: number[] }>();
  for (const f of files) {
    for (const inv of f.invoices) {
      for (const it of inv.items) {
        if (it.unit_price === null || it.qty === null || it.line_total === null)
          continue;
        const expected = Math.round(it.qty * it.unit_price * 100) / 100;
        const matches = Math.abs(expected - it.line_total) <= 0.02;
        if (!matches) continue;
        const k = key(inv.supplier_normalized, it.description_normalized);
        const bucket =
          buckets.get(k) ??
          { supplier: inv.supplier_normalized, item: it.description_normalized, prices: [] };
        bucket.prices.push(it.unit_price);
        buckets.set(k, bucket);
      }
    }
  }

  const hist: PriceHistory = new Map();
  for (const [k, b] of buckets) {
    const { mode, modeCount } = pickMode(b.prices);
    const outliers = b.prices.filter((p) => p !== mode);
    hist.set(k, {
      supplier_normalized: b.supplier,
      description_normalized: b.item,
      modal_unit_price: mode,
      occurrences: b.prices.length,
      confidence: modeCount / b.prices.length,
      outliers,
      all_prices: b.prices,
    });
  }
  return hist;
}

export function lookupModalPrice(
  hist: PriceHistory,
  supplier_normalized: string,
  description_normalized: string,
): ModalPrice | null {
  return hist.get(key(supplier_normalized, description_normalized)) ?? null;
}
