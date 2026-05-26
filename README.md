# Imperial Invoice

A local-first workbench for extracting, reviewing, and comparing structured data from restaurant invoices (printed, hybrid, and handwritten). Built for restaurants tracking cost-of-goods over time.

Everything runs on your machine. Nothing is uploaded anywhere. Your supplier prices, invoice scans, and corrections never leave your laptop.

## Quick install (for Claude Code users)

Open a Claude Code session on the target machine and paste the contents of [`INSTALL.md`](INSTALL.md). Claude reads it top-to-bottom: clones this repo, installs Node deps, starts the dev server, then walks you through picking a data folder and running the extraction prompt. Total time to first dashboard: ~5 minutes.

## What it does

- Drop PDFs into `invoice/`
- Extract structured data with a Claude Code session (no API key, no cloud)
- Browse a dashboard, side-by-side PDF + extracted data viewer, line-item explorer
- Catch OCR errors with checksum validation + historical-price auto-reconciliation
- Compare cost ranges across months (e.g. why food cost rose between Q2 2025 and Q2 2026)

## Prereqs

- **Node.js 20+** and **pnpm** ([install](https://pnpm.io/installation))
- **Claude Code** ([install](https://docs.claude.com/en/docs/claude-code)) — the extraction backend. Free with a Claude subscription, $0 marginal cost per extraction.

## Install (manual)

If you'd rather not delegate to Claude Code, the steps are:

```bash
git clone https://github.com/arthurando/imperial-invoice.git
cd imperial-invoice/app
pnpm install
pnpm dev
```

Open the URL the dev server prints (usually <http://localhost:3000>). The first time you load the app, click **⚙ Set data folder** in the top-right and paste an absolute path for where your invoices will live — the app creates `invoice/` and `prototype/extractions/` subfolders for you.

## Ingest your first PDFs

1. Inside your data folder, create **per-month subfolders** under `invoice/`. Use any naming convention — `2025-06`, `June 2025`, `juin 2025`, `unfiled`, all work. The app auto-discovers them.
2. Drop PDFs into the appropriate month folder.
3. Open a Claude Code session **at your data folder** and paste the prompt from `prompts/extract.md` (inside this repo). Claude will walk every subfolder, write one structured JSON per PDF to `prototype/extractions/<same-folder>/<stem>.json`, and follow the schema in `prototype/SCHEMA.md`. Already-extracted PDFs are skipped.
4. Refresh the app. Your data appears, grouped by folder.

> **Why Claude Code, not an API?** Pure-local commitment: no API key floating around, no per-extraction cost, no data sent to a cloud you didn't already trust. If you have a Claude subscription, this is the right path.

## Where things live

```
imperial-invoice/                     # ← this repo (the app code)
├── INSTALL.md                        # The "paste me into Claude Code" install script
├── README.md
├── prompts/extract.md                # The extraction prompt
├── prototype/SCHEMA.md               # Extraction JSON schema
├── plans/                            # Architecture + roadmap notes
└── app/                              # Next.js 16 frontend
    ├── app/                          # routes
    │   ├── page.tsx                  # Redirects to /files
    │   ├── files/                    # Folder browser + PDF/data viewer
    │   ├── data/                     # Aggregates (Overview / Invoices / Items / Compare)
    │   ├── settings/                 # Data folder picker
    │   └── api/                      # corrections, config, pdf streaming
    └── lib/                          # config, invoices, checksum, reconcile, corrections, types

<YOUR data folder>/                   # e.g. C:\Users\you\imperial-data (NEVER in the repo)
├── invoice/
│   ├── 2025-06/                      # YOUR PDFs grouped by month (any naming)
│   └── 2025-07/
└── prototype/
    ├── extractions/
    │   ├── 2025-06/                  # YOUR extracted JSON (mirrors invoice/)
    │   └── 2025-07/
    └── corrections.jsonl             # YOUR manual edits (append-only)
```

## The two top tabs

- **`/files`** — Folder groups, status badge per file, "awaiting extraction" banner counting PDFs without matching JSONs. Click a file → split-view PDF + editable extracted fields. Inline edit any field; Save writes to `corrections.jsonl`.
- **`/data`** — Aggregates with sub-nav:
  - **Overview** — spend totals, by folder, by supplier, by location, by type. Folder filter chips.
  - **Invoices** — flat sortable table.
  - **Items** — every line item rolled up by `description_normalized`, with min/max/modal price and volatility flag.
  - **Compare** — folder A vs folder B Δ (category, supplier, line item).
- **`/invoices`** — Flat sortable table of every extracted invoice.
- **`/items`** — Every line item rolled up by `description_normalized`, with min/max/modal price and a volatility flag.
- **`/compare`** — Period A vs Period B delta (by category, supplier, line item). Helpful answer to "why did my food cost rise?"

## Manual corrections — how the data heals

Every manual edit you make in the viewer appends a row to `prototype/corrections.jsonl`. On the next page render the loader:

1. Applies your edits (highest authority — beats the extractor and the auto-reconciler)
2. Recomputes line totals when you change qty / unit price / weight without also editing the line total
3. Runs historical auto-reconciliation for any line still failing checksum, using the modal price for that supplier + item across all invoices that already reconcile
4. Re-runs checksum

Supported edit types: `unit_price`, `qty`, `weight`, `line_total`, `description`, `invoice_date`, `total`, `status_override` (Mark OK manual), `new_line` (add a missing line item), `remove_line`.

JSON files in `prototype/extractions/` stay immutable. Everything is auditable.

## Updating the dataset

Drop new PDFs into `<data folder>/invoice/<month-folder>/`, run the Claude Code extraction prompt again at the data folder. Claude only extracts files not already in `<data folder>/prototype/extractions/<same-month-folder>/`. To re-extract a single PDF, delete its JSON and re-run.

## Privacy / what's gitignored

The repo ships **empty of data** by design. Your business records live in a data folder OUTSIDE this repo, picked via the Settings tab. Inside the repo, these are gitignored just in case:

- `invoice/*.pdf` — any PDFs you accidentally drop next to the code
- `prototype/extractions/*.json` — same for extractions
- `prototype/corrections.jsonl` — your manual edits
- `app/public/invoices/*.pdf` — legacy mirror (no longer used by the app)
- `.env*` — any secrets

Verify before committing: `git status` should never list a `.pdf` or a real-data `.json`.

## Roadmap

- **Now (Stage D — Phase 0 + 0.5):** Two-tab layout (Files / Data), in-app data folder picker, folder-by-month support. You're here.
- **Later:** Optional Electron packaging if friends want a double-clickable .exe instead of `pnpm dev`.
- **Maybe:** Local SQLite as the read layer if month count grows past ~12. Extractions still land as JSON files first (immutability + grep-ability).

See `plans/kyle-invoice-electron.md` for the full architecture history.

## License

Private to you and whoever you choose to share the repo with.
