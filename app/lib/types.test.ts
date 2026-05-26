import { describe, it, expect } from 'vitest';
import type { ExtractionFile, InvoiceItem, Invoice } from './types';

describe('types', () => {
  it('ExtractionFile shape compiles and accepts a minimal valid extraction', () => {
    const e: ExtractionFile = {
      filename: 'x.pdf',
      source_path: 'invoice/x.pdf',
      batch_label: 'April 2026',
      extracted_at: '2026-05-20T00:00:00Z',
      extractor: 'claude-code-session',
      page_count: 1,
      invoices: [],
      errors: [],
    };
    expect(e.invoices).toEqual([]);
  });

  it('Invoice + InvoiceItem shape compiles with optional null fields', () => {
    const item: InvoiceItem = {
      line_number: 1,
      qty: 5,
      unit: 'CASE',
      description_raw: 'X',
      description: 'X',
      description_normalized: 'x',
      unit_price: 10.0,
      line_total: 50.0,
      category: 'Pantry',
      confidence: 'high',
      needs_review: false,
      bbox: null,
    };
    const inv: Invoice = {
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
      subtotal: 50.0,
      tax_gst: null,
      tax_qst: null,
      total: 50.0,
      cheque_number: null,
      payment_status: null,
      items: [item],
      field_confidence: { invoice_date: 'high' },
      extraction_confidence: 'high',
      notes: null,
    };
    expect(inv.items[0].line_total).toBe(50);
  });
});
