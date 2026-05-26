import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  appendCorrection,
  loadCorrections,
  applyCorrectionsToInvoice,
  CORRECTIONS_PATH,
} from './corrections';
import type { Invoice } from './types';

const sampleInvoice: Invoice = {
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
      category: null,
      confidence: 'high',
      needs_review: false,
      bbox: null,
    },
  ],
  field_confidence: {},
  extraction_confidence: 'high',
  notes: null,
};

const testKey = { filename: 'test.pdf', page_number: 1, source_region: 'full-page' };

describe('corrections store', () => {
  beforeEach(async () => {
    try {
      await fs.unlink(CORRECTIONS_PATH);
    } catch {
      /* file may not exist */
    }
  });
  afterEach(async () => {
    try {
      await fs.unlink(CORRECTIONS_PATH);
    } catch {
      /* file may not exist */
    }
  });

  it('appends a correction and reads it back', async () => {
    await appendCorrection({
      ...testKey,
      line_number: 1,
      field: 'unit_price',
      value_before: 50,
      value_after: 55,
      corrected_by: 'arthur',
      reason: 'fixed reading',
    });
    const all = await loadCorrections();
    expect(all).toHaveLength(1);
    expect(all[0].value_after).toBe(55);
  });

  it('applies corrections to a matching invoice', async () => {
    await appendCorrection({
      ...testKey,
      line_number: 1,
      field: 'unit_price',
      value_before: 50,
      value_after: 60,
    });
    const corrections = await loadCorrections();
    const patched = applyCorrectionsToInvoice(sampleInvoice, 'test.pdf', corrections);
    expect(patched.items[0].unit_price).toBe(60);
    expect(patched.items[0].line_total).toBe(120);
  });

  it('does not apply corrections from a different file', async () => {
    await appendCorrection({
      filename: 'OTHER.pdf',
      page_number: 1,
      source_region: 'full-page',
      line_number: 1,
      field: 'unit_price',
      value_before: 50,
      value_after: 60,
    });
    const corrections = await loadCorrections();
    const patched = applyCorrectionsToInvoice(sampleInvoice, 'test.pdf', corrections);
    expect(patched.items[0].unit_price).toBe(50);
  });

  it('applies the latest correction when multiple target same field', async () => {
    await appendCorrection({
      ...testKey,
      line_number: 1,
      field: 'unit_price',
      value_before: 50,
      value_after: 60,
    });
    await appendCorrection({
      ...testKey,
      line_number: 1,
      field: 'unit_price',
      value_before: 60,
      value_after: 65,
    });
    const corrections = await loadCorrections();
    const patched = applyCorrectionsToInvoice(sampleInvoice, 'test.pdf', corrections);
    expect(patched.items[0].unit_price).toBe(65);
  });
});
