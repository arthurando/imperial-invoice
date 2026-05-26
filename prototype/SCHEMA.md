# Extraction JSON Schema

One JSON file per source PDF, written to `prototype/extractions/<source-stem>.json`.

```jsonc
{
  "filename": "Kar wah cheq#5626.pdf",         // original PDF filename
  "source_path": "invoice/Kar wah cheq#5626.pdf",
  "batch_label": "April 2026",                  // folder hint, NOT authoritative
  "extracted_at": "2026-05-20T14:00:00Z",
  "extractor": "claude-code-session",           // vs "claude-api" later
  "page_count": 1,
  "invoices": [
    {
      "page_number": 1,                         // which page of the source PDF
      "source_region": "full-page",             // "top-left", "top-right" etc for multi-receipt scans
      "supplier_name_raw": "LA CIE COMMERCIALE KAR WAH LTÉE.",
      "supplier_name": "Kar Wah Trading",       // cleaned for grouping
      "supplier_normalized": "kar_wah",         // snake_case key for joins
      "invoice_number": "409000",
      "invoice_date": "2026-03-04",             // ISO. dd/mm/yyyy on the page reading. For utilities, the bill issue date.
      "billing_period_start": null,             // ISO date, null for non-utilities
      "billing_period_end": null,               // ISO date, null for non-utilities
      "location": "BR",                         // "PC" | "BR" | null
      "location_evidence": "Imperial Brossard, 8245 Taschereau A15-16",
      "invoice_type": "Food",                   // Food | Service | Equipment | Utilities | Takeout box | Cleaning | Other
      "currency": "CAD",
      "subtotal": 1799.60,
      "tax_gst": 0.00,
      "tax_qst": 0.00,
      "total": 1799.60,
      "cheque_number": "5626",                  // from handwritten annotation if visible
      "payment_status": "paid",                 // paid | open | unknown
      "items": [
        {
          "line_number": 1,
          "qty": 10,
          "unit": "BAG",                        // BAG | CASE | CUBE | EA | KG | L | ...
          "description_raw": "SUGAR WHITE FINE 20 KG",
          "description": "Sugar, white, fine, 20kg bag",
          "description_normalized": "sugar_white_fine_20kg",  // for cross-month matching
          "unit_price": 28.99,
          "line_total": 289.90,
          "category": "Pantry/Sugar",           // Produce | Meat | Seafood | Dairy | Pantry/* | Beverage | Cleaning | Equipment | Other
          "confidence": "high",                 // per-field: high | medium | low
          "needs_review": false,
          "bbox": { "x": 0.12, "y": 0.34, "w": 0.55, "h": 0.03 }  // 0-1 normalized region on the page image, for UI overlay
        }
      ],
      "field_confidence": {
        "invoice_date": "high",
        "supplier_name": "high",
        "location": "high",
        "total": "high"
      },
      "extraction_confidence": "high",          // overall: high | medium | low
      "notes": "Yellow customer copy. Handwritten 'cheq#5626' annotation."
    }
  ],
  "errors": []                                  // per-page extraction failures
}
```

## Correction / learning table

Every manual edit a user makes in the viewer writes a row here. Future extractions for the
same supplier inject these as hints into the model prompt, so accuracy compounds over time.

```sql
create table kyle_corrections (
  id              uuid primary key,
  item_id         uuid references kyle_invoice_items(id),  -- nullable (for invoice-level edits)
  invoice_id      uuid references kyle_invoices(id),
  supplier_normalized text not null,
  field_name      text not null,                -- description | qty | unit_price | line_total | invoice_date | supplier_name | location | total
  value_before    text,                         -- what the extractor produced
  value_after     text not null,                -- what the user typed
  reason          text,                         -- optional: "smudged ink", "supplier wrote 12 but receipt shows 21"
  corrected_by    text,                         -- user identifier
  corrected_at    timestamptz default now()
);
create index on kyle_corrections (supplier_normalized, field_name);
```

When extracting a new PDF, the prompt includes a digest of past corrections for that supplier:
> "Known patterns for `wah_hoa`: line items are always one of `Tofu 12 units / Tofu 1 bucket / Tofu 1 units / Soya milk 2L / Soya milk 1L / Fried Tofu / ...`. Standard prices: bucket = $14, soya 2L = $3."
```

## Rules

1. **One PDF → N invoices.** Costco / Tofu / Wah Hoa scans pack multiple receipts on one page; each gets its own object in `invoices[]`.
2. **Dates are ISO.** Source is usually `dd/mm/yyyy` (Quebec/French) — never American `mm/dd/yyyy`. Always confirm by checking the day part exceeds 12 if available.
3. **Location resolution order:**
   - Customer address printed on invoice → "9401-0378 Quebec Inc, 8245 Taschereau" = BR; "2115 Transcanadienne" = PC
   - Handwritten "Imperial Brossard" / "Imperial Pointe-Claire" on top
   - If neither → `null` and `location_evidence: "not_specified"`
4. **Supplier normalization:** strip "LTD.", "LTÉE.", "INC.", spaces → lowercase snake_case. Same supplier across months MUST collapse to the same `supplier_normalized`.
5. **Item normalization:** lowercase, drop punctuation, sort tokens deterministically. Goal: "SUGAR WHITE FINE 20 KG" and "Sugar white fine 20KG" both → `sugar_white_fine_20kg`. This is the join key for price-trend analysis.
6. **Numbers as numbers, not strings.** $1,799.60 → 1799.60.
7. **Missing data → `null`, never empty string or "N/A".**
8. **Cheque number from filename:** if the source filename matches `cheq#NNNN`, capture as `cheque_number`. Verify against any handwritten annotation on the page itself.

## Invoice type heuristics

| Supplier hint | Type |
|---|---|
| Kar Wah, Asie Montreal, Marche C&T, T&T, mayrand, Costco, Walmart, Tofu/Wah Hoa, Viandes Francoeur, Gi Ocean, Queen seafood, Yue, Sun, Hakimi, Les Huiles Vegetales, Les Produits Quotidiens, Pro pomage, GLG, A&B, CNPY, TFI, TTBY, Uni-One, Le Groupe Provincial, Asian markets | Food |
| AW Extermination, Antiflamme-Purafiltre, Alarme ankaa, Matrec | Service |
| Rona, Dollarama (review per item) | Equipment / Other |
| utility.pdf, Hydro, Bell, Energir | Utilities |
| Shoppers (review) | Other |
| 杂项 (miscellaneous) | Review case-by-case |
| 永利 (Wing Lee — likely takeout box / packaging supplier) | Takeout box (verify) |
