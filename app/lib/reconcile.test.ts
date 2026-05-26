import { describe, it, expect } from 'vitest';
import { reconcileInvoice } from './reconcile';
import { buildPriceHistory } from './price-history';
import type { ExtractionFile, Invoice } from './types';

function inv(opts: {
  prices: number[];
  qtys: number[];
  declared: number;
  totals?: (number | null)[];
}): Invoice {
  const items = opts.prices.map((p, i) => ({
    line_number: i + 1,
    qty: opts.qtys[i],
    unit: 'unit',
    description_raw: `Item ${i}`,
    description: `Item ${i}`,
    description_normalized: `item_${i}`,
    unit_price: p,
    line_total: opts.totals?.[i] ?? Math.round(p * opts.qtys[i] * 100) / 100,
    category: null,
    confidence: 'high' as const,
    needs_review: false,
    bbox: null,
  }));
  return {
    page_number: 1,
    source_region: 'full-page',
    supplier_name_raw: 'Wah Hoa',
    supplier_name: 'Wah Hoa',
    supplier_normalized: 'wah_hoa',
    invoice_number: null,
    invoice_date: '2026-04-19',
    billing_period_start: null,
    billing_period_end: null,
    location: 'BR',
    location_evidence: null,
    invoice_type: 'Food',
    currency: 'CAD',
    subtotal: opts.declared,
    tax_gst: null,
    tax_qst: null,
    total: opts.declared,
    cheque_number: null,
    payment_status: null,
    items,
    field_confidence: {},
    extraction_confidence: 'medium',
    notes: null,
  };
}

function rename(i: Invoice, descs: string[]): Invoice {
  return {
    ...i,
    items: i.items.map((it, idx) => ({
      ...it,
      description: descs[idx],
      description_normalized: descs[idx].toLowerCase().replace(/\s+/g, '_'),
    })),
  };
}

describe('reconcileInvoice (historical-context auto-correct)', () => {
  it('auto-corrects a misread unit price using supplier price history (Tofu $14 → $24)', () => {
    // history: 2 prior receipts where Tofu was $24 with reconciling math
    const goodFile: ExtractionFile = {
      filename: 'good.pdf',
      source_path: '',
      batch_label: 'b',
      extracted_at: '',
      extractor: '',
      page_count: 1,
      invoices: [
        rename(inv({ prices: [24], qtys: [2], declared: 48 }), ['Tofu 1 bucket']),
        rename(inv({ prices: [24], qtys: [6], declared: 144 }), ['Tofu 1 bucket']),
      ],
      errors: [],
    };
    const history = buildPriceHistory([goodFile]);

    // suspect invoice: Tofu read as $14, math fails (4×14 + 16×3 = 104 vs declared 144)
    const suspect = rename(
      inv({
        prices: [14, 3],
        qtys: [4, 16],
        declared: 144,
        totals: [56, 48],
      }),
      ['Tofu 1 bucket', 'Soya milk 2L'],
    );

    const { reconciled, corrections } = reconcileInvoice(suspect, history);
    expect(corrections.length).toBeGreaterThan(0);
    const tofuCorrection = corrections.find((c) => c.field === 'unit_price' && c.line_number === 1);
    expect(tofuCorrection?.value_before).toBe(14);
    expect(tofuCorrection?.value_after).toBe(24);
    expect(reconciled.items[0].unit_price).toBe(24);
    expect(reconciled.items[0].line_total).toBe(96);
  });

  it('leaves invoice untouched when history does not help', () => {
    const history = buildPriceHistory([]);
    const suspect = inv({ prices: [5], qtys: [2], declared: 99 });
    const { reconciled, corrections } = reconcileInvoice(suspect, history);
    expect(corrections).toHaveLength(0);
    expect(reconciled.items[0].unit_price).toBe(5);
  });

  it('derives qty when unit_price swap alone does not reconcile (Wah Hoa #0081499 case)', () => {
    // history: Wah Hoa Tofu = $24
    const goodFile: ExtractionFile = {
      filename: 'good.pdf',
      source_path: '',
      batch_label: 'b',
      extracted_at: '',
      extractor: '',
      page_count: 1,
      invoices: [
        rename(inv({ prices: [24], qtys: [2], declared: 48 }), ['Tofu 1 bucket']),
        rename(inv({ prices: [24], qtys: [6], declared: 144 }), ['Tofu 1 bucket']),
      ],
      errors: [],
    };
    const history = buildPriceHistory([goodFile]);

    // suspect: qty 5 + price $14 + line_total 72, soya 32×3=96, declared 168.
    // unit_price swap alone: 5×24=120 → items 216 ≠ 168. Fails.
    // qty derivation from line_total: 72/24 = 3 → 3×24=72, total 72+96=168 ✓
    const suspect = rename(
      inv({
        prices: [14, 3],
        qtys: [5, 32],
        declared: 168,
        totals: [72, 96],
      }),
      ['Tofu 1 bucket', 'Soya milk 2L'],
    );

    const { reconciled, corrections } = reconcileInvoice(suspect, history);
    const tofuItem = reconciled.items[0];
    expect(tofuItem.unit_price).toBe(24);
    expect(tofuItem.qty).toBe(3);
    expect(tofuItem.line_total).toBe(72);

    const priceFix = corrections.find((c) => c.field === 'unit_price');
    const qtyFix = corrections.find((c) => c.field === 'qty');
    expect(priceFix?.value_after).toBe(24);
    expect(qtyFix?.value_after).toBe(3);
  });

  it('handles OCR errors in line_total too — recomputes from qty × modal_price (Wah Hoa #0082051 case)', () => {
    // History: Wah Hoa Tofu = $24, Soya milk 2L = $3
    const goodFile: ExtractionFile = {
      filename: 'good.pdf',
      source_path: '',
      batch_label: 'b',
      extracted_at: '',
      extractor: '',
      page_count: 1,
      invoices: [
        rename(inv({ prices: [24], qtys: [2], declared: 48 }), ['Tofu 1 bucket']),
        rename(inv({ prices: [24], qtys: [6], declared: 144 }), ['Tofu 1 bucket']),
        rename(inv({ prices: [3], qtys: [24], declared: 72 }), ['Soya milk 2L']),
        rename(inv({ prices: [3], qtys: [16], declared: 48 }), ['Soya milk 2L']),
      ],
      errors: [],
    };
    const history = buildPriceHistory([goodFile]);

    // suspect: my OCR wrote
    //   Tofu  qty=5  unit_price=$14  line_total=$70  (line_total wrong too: actual receipt shows $120)
    //   Soya  qty=8  unit_price=$3   line_total=$74  (line_total wrong: actual receipt shows $24)
    // Declared total $144. Correct: 5×24 + 8×3 = 120 + 24 = 144.
    const suspect = rename(
      inv({
        prices: [14, 3],
        qtys: [5, 8],
        declared: 144,
        totals: [70, 74],
      }),
      ['Tofu 1 bucket', 'Soya milk 2L'],
    );

    const { reconciled, corrections } = reconcileInvoice(suspect, history);

    // Both lines should be recomputed: tofu price fixed + tofu line_total fixed + soya line_total fixed
    expect(reconciled.items[0].unit_price).toBe(24);
    expect(reconciled.items[0].qty).toBe(5);
    expect(reconciled.items[0].line_total).toBe(120);
    expect(reconciled.items[1].unit_price).toBe(3);
    expect(reconciled.items[1].qty).toBe(8);
    expect(reconciled.items[1].line_total).toBe(24);

    const corrFields = corrections.map((c) => `${c.line_number}:${c.field}`);
    expect(corrFields).toContain('1:unit_price');
    expect(corrFields).toContain('1:line_total');
    expect(corrFields).toContain('2:line_total');
  });

  it('does not over-correct when math already reconciles', () => {
    const goodFile: ExtractionFile = {
      filename: 'good.pdf',
      source_path: '',
      batch_label: 'b',
      extracted_at: '',
      extractor: '',
      page_count: 1,
      invoices: [
        rename(inv({ prices: [24], qtys: [1], declared: 24 }), ['Tofu 1 bucket']),
        rename(inv({ prices: [24], qtys: [2], declared: 48 }), ['Tofu 1 bucket']),
      ],
      errors: [],
    };
    const history = buildPriceHistory([goodFile]);
    const suspect = rename(
      inv({ prices: [24], qtys: [3], declared: 72 }),
      ['Tofu 1 bucket'],
    );
    const { corrections } = reconcileInvoice(suspect, history);
    expect(corrections).toHaveLength(0);
  });
});
