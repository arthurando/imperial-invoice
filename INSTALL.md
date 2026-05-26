# Install — Imperial Invoice

Paste this entire file into a Claude Code session opened at any folder on the target machine. Claude will read it top-to-bottom and run the steps.

---

## What this installs

A local-first invoice workbench. You drop restaurant invoice PDFs into a folder, your own Claude Code extracts structured data from them, and a Next.js app at `http://localhost:3000` lets you browse, correct, and compare line items across months. **Nothing goes to a cloud. Your supplier data stays on your machine.**

---

## Prerequisites Claude must check / install

Claude: check these before continuing. If any are missing, install them (or stop and tell the human which one needs attention):

1. **Node.js 20 or newer** — check with `node --version`. Install from <https://nodejs.org> if missing.
2. **pnpm** — check with `pnpm --version`. Install with `npm install -g pnpm` if missing.
3. **Git** — check with `git --version`. Install from <https://git-scm.com> if missing.
4. **Claude Code itself** — you are Claude Code, so this is fine. The human needs a Claude subscription so you can call the extraction prompt later. No API key is used.

---

## Install steps

Claude: run each step. Pause and report if anything fails.

### 1. Pick a parent folder for the app

Default: `~/Documents/` on Windows, `~/Projects/` on macOS/Linux. Confirm with the human if you want a different location.

```bash
cd "<chosen parent folder>"
```

### 2. Clone the repository

```bash
git clone git@github.com:arthurando/imperial-invoice.git
cd imperial-invoice
```

If SSH isn't set up, use HTTPS: `git clone https://github.com/arthurando/imperial-invoice.git`

### 3. Install dependencies

```bash
cd app
pnpm install
```

### 4. Start the dev server

```bash
pnpm dev
```

Wait until you see `Ready in <ms>ms` and a `Local: http://localhost:3000` (or `:3001` if 3000 is taken) line. Tell the human to open that URL.

### 5. Set the data folder (in the browser, via the Settings tab)

On first open the app shows an amber "⚙ Set data folder" button in the top right. The human should:

1. Click **⚙ Set data folder**.
2. Paste an absolute path for where their invoices will live, e.g. `C:\Users\<them>\imperial-data` on Windows or `/Users/<them>/imperial-data` on macOS. The folder will be created if it doesn't exist; `invoice/` and `prototype/extractions/` subfolders are auto-created.
3. Click **Save**.

The Settings page then shows live stats (folder count, PDF count, extraction count). They start at zero — that's expected.

### 6. Drop the first batch of PDFs

The human creates **per-month** subfolders inside the data folder, named however they like. Examples that the app will recognise:

```
<data folder>/invoice/2025-06/
<data folder>/invoice/June 2025/
<data folder>/invoice/juin 2025/
<data folder>/invoice/unfiled/      ← for "not sorted yet"
```

Then they drop PDFs into the appropriate month folder.

### 7. Extract — Claude reads the PDFs

Once PDFs are in place, the human asks you (Claude Code) to run the extraction prompt. **In a NEW Claude Code session opened at the data folder**, the human pastes the prompt from `prompts/extract.md` inside the cloned repo. You will:

- Walk `<data folder>/invoice/**.pdf` recursively
- Write one structured JSON per PDF to `<data folder>/prototype/extractions/<same-folder>/<stem>.json`
- Skip PDFs that already have a JSON (incremental and safe to re-run)

**Use the Opus model.** Sonnet hallucinates phantom line items on dense handwritten invoices. Limit to 5 parallel agents max.

### 8. Browse the data

The human refreshes `http://localhost:3000`. They should see:

- **Files tab** — folder groups with status badges per file. Click a file → split-view PDF + editable extracted fields.
- **Data tab** — Overview dashboard, Invoices table, Items rollup, Compare (folder A vs folder B Δ).

---

## Day-2 workflow

1. Drop new PDFs into a month folder.
2. In a Claude Code session at the data folder, paste the extract prompt again. Claude only extracts new files.
3. Refresh the app. New data appears.

To compare two months: **Data tab → Compare → pick folder A and folder B**. The app shows Δ total spend, Δ by category, and the top 50 line items by |Δ spend|.

To edit a value: click any field on a file's detail page → type → press Enter or click outside. The edit appends to `<data folder>/prototype/corrections.jsonl` and is applied on the next render.

---

## Files Claude should NOT touch

- Anything under the user's data folder (`<data folder>/invoice/`, `<data folder>/prototype/`). Those are real business records.
- `~/.imperial-invoice/config.json` — the path picker writes here; don't edit by hand.
- `prototype/corrections.jsonl` — append-only audit log; never rewrite.

---

## If something breaks

- **`pnpm dev` errors** — check Node version (`node --version`, must be ≥ 20), then `rm -rf node_modules .next && pnpm install`.
- **Folder filter shows nothing** — the data folder is empty. Drop PDFs and re-run extraction.
- **PDF viewer 404** — the JSON exists but the PDF doesn't. Check that the PDF lives at `<data folder>/invoice/<folder>/<filename>.pdf` matching the JSON's filename field.
- **"Awaiting extraction" banner won't go away** — those PDFs still need extraction. Run the prompt.

Report any other error back to the human with the exact log line.
