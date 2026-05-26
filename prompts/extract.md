# Extract Invoices — Claude Code Prompt

Paste this into a Claude Code session opened at the repo root. Claude will read every PDF under `invoice/` (including subfolders) and write one structured JSON file per PDF into the matching `prototype/extractions/<same-subfolder>/` location.

---

## The prompt

> You are extracting structured data from restaurant invoices for the Imperial Invoice workbench.
>
> **Source:** every PDF under `invoice/**/*.pdf` — printed, hybrid, and handwritten restaurant supplier invoices. **PDFs are organized by user-named month-folders** like `invoice/June 2025/`, `invoice/2025-07/`, or `invoice/unfiled/`. The folder name has no schema — treat it as a literal string.
> **Output:** One JSON file per source PDF at `prototype/extractions/<same-subfolder>/<source-stem>.json`. The subfolder MUST mirror the source PDF's parent folder. If a PDF sits directly in `invoice/` (no subfolder), its JSON sits directly in `prototype/extractions/`.
> **Schema:** Read and follow `prototype/SCHEMA.md` exactly. One PDF can contain multiple invoices (multi-receipt scans) — each gets its own object in `invoices[]`.
>
> **Process:**
>
> 1. Walk `invoice/` recursively. For every PDF, compute its mirrored output path under `prototype/extractions/`. Only extract PDFs whose target JSON doesn't already exist (skip-already-extracted check uses the FULL relative subpath, not just the filename).
> 2. For each remaining PDF, open it, read every receipt visible on every page, output a single JSON file per source PDF at its mirrored output path. Create the subfolder under `prototype/extractions/` if it doesn't exist yet.
> 3. Per receipt, fill every field in the schema. When a field is unknown, set it to `null` — never an empty string or "N/A".
> 4. Every numeric field MUST be a number, not a string. `$1,799.60` → `1799.60`.
> 5. Dates are ISO `YYYY-MM-DD`. Source is Quebec/French — dates are `dd/mm/yyyy`, never American `mm/dd/yyyy`.
> 6. Cheque number: if the source filename matches `cheq#NNNN`, capture it. Cross-check with any handwritten annotation on the page.
> 7. Location resolution order: printed customer address → handwritten "Imperial Brossard/Pointe-Claire" → `null` with `location_evidence: "not_specified"`.
> 8. Supplier normalization: strip "LTD.", "LTÉE.", "INC.", punctuation → snake_case. Same supplier across months MUST collapse to the same `supplier_normalized`.
> 9. Item normalization: lowercase, drop punctuation, snake_case. `"SUGAR WHITE FINE 20 KG"` and `"Sugar white fine 20KG"` both → `sugar_white_fine_20kg`. This is the join key for cross-month price tracking.
> 10. Weight-priced lines (meat, seafood — UNIT is LB or KG, or there's a Weight column): populate `weight` and `weight_unit`. Line check becomes `weight × unit_price`, not `qty × unit_price`. **Heuristic:** if existing `qty × unit_price` already equals `line_total`, do NOT add weight — the column on the receipt is descriptive (case-weight reference), not multiplicative. Examples: Asie-Montreal lb-priced lines DO need weight. Gi Ocean case-priced lines do NOT.
> 11. Every OCR field is a hypothesis. If on visual inspection the math doesn't reconcile, flag `needs_review: true` on the offending line rather than guessing — the auto-reconciler will try historical prices later.
> 12. **The subfolder is NOT authoritative for invoice_date.** Read the date off the receipt. The folder name is just the user's filing intent (mismatch with extracted invoice_date is fine — the UI flags it for them).
> 13. Use the Opus model for extraction. Sonnet confabulates phantom line items on dense handwritten invoices.
> 14. If you spawn parallel agents to process PDFs concurrently, do so with explicit Opus model + one-PDF-per-agent. Limit to 5 parallel. Each agent returns a one-paragraph summary; full output goes to disk.
> 15. After writing all JSONs, print a summary table: subfolder → file_count, invoice_count, total_amount, suppliers, extraction_confidence distribution.

---

## What you need locally

- `invoice/<your-month-folder>/*.pdf` — your source PDFs, organized however you like
- `prototype/SCHEMA.md` — schema spec
- A Claude Code session open at the repo root

That's it. No env vars. No API key. Output lands in `prototype/extractions/<same-folder>/`, the dev server picks it up on next render.

## Re-extracting

To re-extract a single PDF, delete its mirrored JSON in `prototype/extractions/<folder>/` and re-run the prompt. Claude skips PDFs that already have a JSON at the mirrored path, so re-running is safe and incremental.

## Renaming a month-folder

Rename BOTH `invoice/<old>/` AND `prototype/extractions/<old>/` to the new name. The app does no rename detection — it just walks subfolders and reads what's there.

## Common edge cases

| Receipt type | Note |
|---|---|
| Multi-receipt scans (Costco, Wah Hoa Tofu, daily-slip suppliers) | One PDF → N invoices in `invoices[]`. Use `source_region` ("top-left", "bottom-right", etc) to distinguish. |
| Utility bills (Hydro, Bell, Énergir, Videotron) | Single invoice per PDF. Populate `billing_period_start`/`end`. Some have a "Taxes" line item — checksum tolerates this when `items_sum == total`. |
| Meat / seafood (Viandes Francoeur, Asie-Montreal, Queen Seafood razor clams) | Use `weight × unit_price`. Populate `weight` and `weight_unit`. |
| Case-priced (all Gi Ocean) | UNIT=CS, PRIX=$/CS. Weight on receipt is descriptive only. `qty × unit_price` is the right check. |
| Daily-total slips (永利 / Poissonnerie Huu Loi) | No item breakdown. Single line per slip with `description: "daily delivery"`. |
| Handwritten cursive numbers | "2" frequently misread as "1" (Wah Hoa Tofu = $24/bucket, not $14). Cross-check against subtotal/total when ambiguous. |
