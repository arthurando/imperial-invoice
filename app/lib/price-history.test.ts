import { describe, it, expect } from 'vitest';
import { buildPriceHistory, lookupModalPrice } from './price-history';
import type { ExtractionFile, Invoice } from './types';

function mkInv(
  supplier: string,
  items: { desc: string; qty: number; price: number; total: number }[],
): Invoice {
  return {
    page_number: 1,
    source_region: 'full-page',
    supplier_name_raw: supplier,
    supplier_name: supplier,
    supplier_normalized: supplier.toLowerCase(),
    invoice_number: null,
    invoice_date: '2026-04-01',
    billing_period_start: null,
    billing_period_end: null,
    location: 'BR',
    location_evidence: null,
    invoice_type: 'Food',
    currency: 'CAD',
    subtotal: null,
    tax_gst: null,
    tax_qst: null,
    total: null,
    cheque_number: null,
    payment_status: null,
    items: items.map((it, i) => ({
      line_number: i + 1,
      qty: it.qty,
      unit: 'unit',
      description_raw: it.desc,
      description: it.desc,
      description_normalized: it.desc.toLowerCase().replace(/\s+/g, '_'),
      unit_price: it.price,
      line_total: it.total,
      category: null,
      confidence: 'high',
      needs_review: false,
      bbox: null,
    })),
    field_confidence: {},
    extraction_confidence: 'high',
    notes: null,
  };
}

function mkFile(invs: Invoice[]): ExtractionFile {
  return {
    filename: 'f.pdf',
    source_path: 'f.pdf',
    batch_label: 'April 2026',
    extracted_at: '2026-05-20T00:00:00Z',
    extractor: 't',
    page_count: 1,
    invoices: invs,
    errors: [],
  };
}

describe('price-history', () => {
  it('returns modal price for an item with consistent prices', () => {
    const file = mkFile([
      mkInv('Wah Hoa', [{ desc: 'Tofu 1 bucket', qty: 1, price: 24, total: 24 }]),
      mkInv('Wah Hoa', [{ desc: 'Tofu 1 bucket', qty: 2, price: 24, total: 48 }]),
    ]);
    const hist = buildPriceHistory([file]);
    const lookup = lookupModalPrice(hist, 'wah_hoa', 'tofu_1_bucket');
    expect(lookup?.modal_unit_price).toBe(24);
    expect(lookup?.occurrences).toBe(2);
    expect(lookup?.confidence).toBe(1);
  });

  it('picks the mode when an outlier exists', () => {
    const file = mkFile([
      mkInv('Wah Hoa', [{ desc: 'Tofu 1 bucket', qty: 1, price: 24, total: 24 }]),
      mkInv('Wah Hoa', [{ desc: 'Tofu 1 bucket', qty: 1, price: 24, total: 24 }]),
      mkInv('Wah Hoa', [{ desc: 'Tofu 1 bucket', qty: 1, price: 14, total: 14 }]),
    ]);
    const hist = buildPriceHistory([file]);
    const lookup = lookupModalPrice(hist, 'wah_hoa', 'tofu_1_bucket');
    expect(lookup?.modal_unit_price).toBe(24);
    expect(lookup?.occurrences).toBe(3);
    expect(lookup?.confidence).toBeCloseTo(2 / 3, 2);
    expect(lookup?.outliers).toHaveLength(1);
    expect(lookup?.outliers[0]).toBe(14);
  });

  it('returns null for unknown (supplier, item)', () => {
    const hist = buildPriceHistory([]);
    expect(lookupModalPrice(hist, 'x', 'y')).toBeNull();
  });

  it('keeps separate histories per supplier', () => {
    const file = mkFile([
      mkInv('A', [{ desc: 'Same Item', qty: 1, price: 10, total: 10 }]),
      mkInv('B', [{ desc: 'Same Item', qty: 1, price: 20, total: 20 }]),
    ]);
    const hist = buildPriceHistory([file]);
    expect(lookupModalPrice(hist, 'a', 'same_item')?.modal_unit_price).toBe(10);
    expect(lookupModalPrice(hist, 'b', 'same_item')?.modal_unit_price).toBe(20);
  });
});
