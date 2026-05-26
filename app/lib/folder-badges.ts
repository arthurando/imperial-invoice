import type { FileWithChecks, Invoice } from './types';

/**
 * Try to extract a YYYY-MM month tag from a free-form folder name.
 *
 * Recognises:
 *   - "2025-06"           → "2025-06"
 *   - "2025-06-June"      → "2025-06"
 *   - "June 2025"         → "2025-06"
 *   - "Jun 2025"          → "2025-06"
 *   - "juin 2025"         → "2025-06"
 *   - "2025_06"           → "2025-06"
 *
 * Returns null when the folder name doesn't encode a recognisable month
 * (e.g. "unfiled", "misc", "Q2"). The UI treats that as "no opinion".
 */
export function folderMonthFromName(folder: string): string | null {
  if (!folder) return null;

  // YYYY-MM or YYYY_MM at the start of the name
  const isoMatch = folder.match(/^(\d{4})[-_/](\d{1,2})\b/);
  if (isoMatch) {
    const y = isoMatch[1];
    const monthNum = Number(isoMatch[2]);
    if (monthNum >= 1 && monthNum <= 12) {
      return `${y}-${String(monthNum).padStart(2, '0')}`;
    }
  }

  // Month-name + year (English / French abbreviations)
  const yearMatch = folder.match(/\b(\d{4})\b/);
  if (yearMatch) {
    const year = yearMatch[1];
    const monthIdx = monthFromWord(folder);
    if (monthIdx !== null) return `${year}-${String(monthIdx).padStart(2, '0')}`;
  }

  return null;
}

const MONTH_WORDS: { match: RegExp; index: number }[] = [
  { match: /\b(jan(uary)?|janv(ier)?)\b/i, index: 1 },
  { match: /\b(feb(ruary)?|f[eé]vr(ier)?)\b/i, index: 2 },
  { match: /\b(mar(ch)?|mars)\b/i, index: 3 },
  { match: /\b(apr(il)?|avr(il)?)\b/i, index: 4 },
  { match: /\b(may|mai)\b/i, index: 5 },
  { match: /\b(jun(e)?|juin)\b/i, index: 6 },
  { match: /\b(jul(y)?|juil(let)?)\b/i, index: 7 },
  { match: /\b(aug(ust)?|ao[uû]t|aout)\b/i, index: 8 },
  { match: /\b(sep(t(ember)?)?)\b/i, index: 9 },
  { match: /\b(oct(ober|obre)?)\b/i, index: 10 },
  { match: /\b(nov(ember|embre)?)\b/i, index: 11 },
  { match: /\b(dec(ember|embre)?|d[eé]c(embre)?)\b/i, index: 12 },
];

function monthFromWord(s: string): number | null {
  for (const m of MONTH_WORDS) if (m.match.test(s)) return m.index;
  return null;
}

/** YYYY-MM extracted from an invoice_date string ('YYYY-MM-DD'), or null. */
export function invoiceMonth(invoice: Pick<Invoice, 'invoice_date'>): string | null {
  if (!invoice.invoice_date) return null;
  const m = invoice.invoice_date.slice(0, 7);
  return /^\d{4}-\d{2}$/.test(m) ? m : null;
}

/**
 * True when a file's folder name encodes a month AND at least one of its
 * invoices has an invoice_date that falls outside that month. Used to surface
 * a "filed under <folder> but contains an invoice from <other month>" badge.
 */
export function folderVsDateMismatch(file: FileWithChecks): boolean {
  const folderMonth = folderMonthFromName(file.source_folder);
  if (!folderMonth) return false;
  for (const inv of file.invoices) {
    const im = invoiceMonth(inv);
    if (im && im !== folderMonth) return true;
  }
  return false;
}

/** Friendly label for the source_folder column / chip. */
export function folderLabel(source_folder: string): string {
  return source_folder || '— unfiled';
}
