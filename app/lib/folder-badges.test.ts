import { describe, it, expect } from 'vitest';
import {
  folderMonthFromName,
  invoiceMonth,
  folderVsDateMismatch,
  folderLabel,
} from './folder-badges';
import type { FileWithChecks } from './types';

describe('folderMonthFromName', () => {
  it('parses YYYY-MM', () => {
    expect(folderMonthFromName('2025-06')).toBe('2025-06');
    expect(folderMonthFromName('2025-06-June')).toBe('2025-06');
    expect(folderMonthFromName('2025_06')).toBe('2025-06');
  });

  it('parses English month names with year', () => {
    expect(folderMonthFromName('June 2025')).toBe('2025-06');
    expect(folderMonthFromName('Jun 2025')).toBe('2025-06');
    expect(folderMonthFromName('December 2024')).toBe('2024-12');
  });

  it('parses French month names with year', () => {
    expect(folderMonthFromName('juin 2025')).toBe('2025-06');
    expect(folderMonthFromName('décembre 2024')).toBe('2024-12');
    expect(folderMonthFromName('aout 2025')).toBe('2025-08');
  });

  it('returns null for unrecognised names', () => {
    expect(folderMonthFromName('')).toBeNull();
    expect(folderMonthFromName('unfiled')).toBeNull();
    expect(folderMonthFromName('misc')).toBeNull();
    expect(folderMonthFromName('Q2')).toBeNull();
  });

  it('rejects invalid month numbers', () => {
    expect(folderMonthFromName('2025-13')).toBeNull();
    expect(folderMonthFromName('2025-00')).toBeNull();
  });
});

describe('invoiceMonth', () => {
  it('extracts YYYY-MM from invoice_date', () => {
    expect(invoiceMonth({ invoice_date: '2025-06-14' })).toBe('2025-06');
    expect(invoiceMonth({ invoice_date: '2024-12-31' })).toBe('2024-12');
  });

  it('returns null for missing date', () => {
    expect(invoiceMonth({ invoice_date: null })).toBeNull();
  });
});

function fakeFile(source_folder: string, dates: (string | null)[]): FileWithChecks {
  // Cast through unknown — these tests only exercise the two fields the helper reads.
  return {
    filename: 'fake.json',
    source_path: 'fake.pdf',
    batch_label: 'test',
    extracted_at: '2025-01-01',
    extractor: 'test',
    page_count: 1,
    invoices: dates.map((d, i) => ({ invoice_date: d, page_number: i + 1 })) as never,
    errors: [],
    source_folder,
    overall_status: 'ok',
    total_amount: 0,
  } as unknown as FileWithChecks;
}

describe('folderVsDateMismatch', () => {
  it('returns false when folder is unparseable', () => {
    expect(folderVsDateMismatch(fakeFile('unfiled', ['2025-06-14']))).toBe(false);
    expect(folderVsDateMismatch(fakeFile('', ['2025-06-14']))).toBe(false);
  });

  it('returns false when invoice month matches folder month', () => {
    expect(folderVsDateMismatch(fakeFile('2025-06', ['2025-06-14']))).toBe(false);
    expect(folderVsDateMismatch(fakeFile('June 2025', ['2025-06-01', '2025-06-29']))).toBe(false);
  });

  it('returns true when any invoice falls outside the folder month', () => {
    expect(folderVsDateMismatch(fakeFile('2025-06', ['2025-07-02']))).toBe(true);
    expect(folderVsDateMismatch(fakeFile('June 2025', ['2025-06-14', '2025-05-30']))).toBe(true);
  });

  it('ignores invoices with null invoice_date', () => {
    expect(folderVsDateMismatch(fakeFile('2025-06', [null, '2025-06-14']))).toBe(false);
    expect(folderVsDateMismatch(fakeFile('2025-06', [null]))).toBe(false);
  });
});

describe('folderLabel', () => {
  it('returns the folder name verbatim when set', () => {
    expect(folderLabel('June 2025')).toBe('June 2025');
    expect(folderLabel('2025-06')).toBe('2025-06');
  });

  it('returns a "— unfiled" placeholder for empty folder', () => {
    expect(folderLabel('')).toBe('— unfiled');
  });
});
