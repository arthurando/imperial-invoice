export type Location = 'PC' | 'BR' | null;

export type InvoiceType =
  | 'Food'
  | 'Service'
  | 'Equipment'
  | 'Utilities'
  | 'Takeout box'
  | 'Cleaning'
  | 'Other';

export type Confidence = 'high' | 'medium' | 'low';

export interface Bbox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface InvoiceItem {
  line_number: number;
  qty: number | null;
  unit: string | null;
  weight: number | null;          // total weight on this line (kg or lb), for weight-priced items like meat
  weight_unit: string | null;     // "kg" | "lb"
  description_raw: string;
  description: string;
  description_normalized: string;
  unit_price: number | null;
  line_total: number | null;
  category: string | null;
  confidence: Confidence;
  needs_review: boolean;
  bbox: Bbox | null;
}

export interface FieldConfidence {
  invoice_date?: Confidence;
  supplier_name?: Confidence;
  location?: Confidence;
  total?: Confidence;
}

export interface Invoice {
  page_number: number;
  source_region: string;
  supplier_name_raw: string;
  supplier_name: string;
  supplier_normalized: string;
  invoice_number: string | null;
  invoice_date: string | null;
  billing_period_start: string | null;
  billing_period_end: string | null;
  location: Location;
  location_evidence: string | null;
  invoice_type: InvoiceType;
  currency: string;
  subtotal: number | null;
  tax_gst: number | null;
  tax_qst: number | null;
  total: number | null;
  cheque_number: string | null;
  payment_status: string | null;
  items: InvoiceItem[];
  field_confidence: FieldConfidence;
  extraction_confidence: Confidence;
  notes: string | null;
}

export interface ExtractionFile {
  filename: string;
  source_path: string;
  batch_label: string;
  extracted_at: string;
  extractor: string;
  page_count: number;
  invoices: Invoice[];
  errors: string[];
}

export type CheckStatus = 'ok' | 'warn' | 'fail' | 'ok-manual';

export interface LineCheck {
  line_number: number;
  qty: number | null;
  unit_price: number | null;
  line_total: number | null;
  computed: number | null;
  delta: number | null;
  status: CheckStatus;
}

export interface InvoiceCheck {
  items_sum: number | null;
  declared_subtotal: number | null;
  declared_total: number | null;
  taxes_sum: number | null;
  items_vs_subtotal_delta: number | null;
  subtotal_plus_tax_vs_total_delta: number | null;
  status: CheckStatus;
  notes: string[];
  line_checks: LineCheck[];
}

export interface AutoCorrection {
  line_number: number | null;
  field: 'unit_price' | 'line_total' | 'qty';
  value_before: number | null;
  value_after: number;
  basis: string;
  history_occurrences: number;
  history_confidence: number;
}

export interface InvoiceWithCheck extends Invoice {
  check: InvoiceCheck;
  auto_corrections: AutoCorrection[];
}

export interface FileWithChecks extends ExtractionFile {
  invoices: InvoiceWithCheck[];
  overall_status: CheckStatus;
  total_amount: number;
  // Derived at load time from the JSON file's location relative to extractionsDir.
  // '' when the file sits at the extractions root (legacy flat layout).
  // Otherwise the immediate subfolder name, e.g. '2025-06' or 'June 2025'.
  source_folder: string;
}
