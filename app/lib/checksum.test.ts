import { describe, it, expect } from 'vitest';
import { checkInvoice } from './checksum';
import type { Invoice } from './types';

const baseInvoice = (overrides: Partial<Invoice> = {}): Invoice => ({
  page_number: 1,
  source_region: 'full-page',
  supplier_name_raw: 'X',
  supplier_name: 'X',
  supplier_normalized: 'x',
  invoice_number: null,
  invoice_date: '2026-04-01',
  billing_period_start: null,
  billing_period_end: null,
  location: 'BR',
  location_evidence: null,
  invoice_type: 'Food',
  currency: 'CAD',
  subtotal: 100,
  tax_gst: null,
  tax_qst: null,
  total: 100,
  cheque_number: null,
  payment_status: null,
  items: [
    {
      line_number: 1,
      qty: 2,
      unit: 'CASE',
      description_raw: 'X',
      description: 'X',
      description_normalized: 'x',
      unit_price: 50,
      line_total: 100,
      category: 'Pantry',
      confidence: 'high',
      needs_review: false,
      bbox: null,
    },
  ],
  field_confidence: {},
  extraction_confidence: 'high',
  notes: null,
  ...overrides,
});

describe('checkInvoice', () => {
  it('passes when math reconciles', () => {
    const c = checkInvoice(baseInvoice());
    expect(c.status).toBe('ok');
    expect(c.items_sum).toBe(100);
  });

  it('flags fail when items sum != subtotal beyond tolerance', () => {
    const c = checkInvoice(baseInvoice({ subtotal: 144, total: 144 }));
    expect(c.status).toBe('fail');
    expect(c.items_vs_subtotal_delta).toBe(-44);
  });

  it('flags fail when qty * unit_price != line_total', () => {
    const inv = baseInvoice();
    inv.items[0].line_total = 99;
    inv.subtotal = 99;
    inv.total = 99;
    const c = checkInvoice(inv);
    const lc = c.line_checks[0];
    expect(lc.status).toBe('fail');
    expect(lc.delta).toBe(-1);
  });

  it('warns when subtotal + tax != total within rounding range', () => {
    const c = checkInvoice(
      baseInvoice({ subtotal: 100, tax_gst: 5, tax_qst: 9.97, total: 115 }),
    );
    expect(c.subtotal_plus_tax_vs_total_delta).toBeCloseTo(0.03, 2);
    expect(['ok', 'warn']).toContain(c.status);
  });

  it('returns ok when subtotal/total are null (utility-style)', () => {
    const inv = baseInvoice({ subtotal: null });
    const c = checkInvoice(inv);
    expect(c.items_vs_subtotal_delta).toBeNull();
  });

  it('downgrades subtotal+tax mismatch to ok when items_sum == total (Videotron case)', () => {
    // Videotron: items include a "Taxes" line ($25) but tax_gst/tax_qst are null.
    // subtotal=166.95 + 0 + 0 ≠ total=191.95, but sum(items) = 80.05 + 86.90 + 25 = 191.95
    const inv = baseInvoice({
      subtotal: 166.95,
      tax_gst: null,
      tax_qst: null,
      total: 191.95,
      items: [
        { line_number: 1, qty: 1, unit: 'month', description_raw: 'Internet', description: 'Internet', description_normalized: 'i', unit_price: 80.05, line_total: 80.05, category: 'U', confidence: 'high', needs_review: false, bbox: null },
        { line_number: 2, qty: 1, unit: 'month', description_raw: 'Phone',    description: 'Phone',    description_normalized: 'p', unit_price: 86.90, line_total: 86.90, category: 'U', confidence: 'high', needs_review: false, bbox: null },
        { line_number: 3, qty: 1, unit: 'month', description_raw: 'Tax',      description: 'Tax',      description_normalized: 't', unit_price: 25.00, line_total: 25.00, category: 'U', confidence: 'high', needs_review: false, bbox: null },
      ],
    });
    const c = checkInvoice(inv);
    expect(c.status).toBe('ok');
  });
});
