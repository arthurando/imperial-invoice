# Install Guide — Imperial Invoice

This guide does double-duty:
- **👤 Human steps** = read and follow these yourself, in your browser, file explorer, or by clicking things.
- **🤖 Claude Code steps** = paste this whole file into Claude Code; Claude will read it and execute these steps. After each 🤖 step Claude will report success or failure before moving on.

Total time to first dashboard: **~5 minutes** if your machine has Node + Claude Code already. **~15 minutes** if it doesn't.

---

## What you're installing

A local-first workbench for restaurant invoice PDFs. You drop scanned PDFs into a folder, your own Claude Code extracts structured data (supplier, line items, prices), and a small Next.js app at `http://localhost:3000` lets you browse, correct, and compare line items across months. **Nothing leaves your machine.** No API keys, no cloud, no subscriptions beyond Claude itself.

You will end up with two things on your computer:
1. **The app code** — cloned from GitHub. Lives wherever Claude puts it (you choose where).
2. **Your data folder** — a separate folder you control, containing your PDFs and extracted data. The app reads from here. **Picked at the end of step 4.**

---

## Step 0 — Prerequisites

### 👤 You need

- A Windows, Mac, or Linux computer.
- **Claude Code** installed and signed in. Get it at <https://docs.claude.com/en/docs/claude-code>.
- **A Claude subscription** — Pro ($20/month) is the minimum that works comfortably; Max is more comfortable if you're extracting hundreds of invoices a month. Sign up at <https://claude.ai/subscribe>. See "About your Claude subscription" below for what extraction actually costs.
- About 1 GB of free disk space.

### About your Claude subscription (read this once)

This app uses **your own Claude Code session** to extract data from PDFs — there is no separate API key, no per-extraction billing, no token meter inside this app. Extraction runs against your existing Claude usage allowance:

| Plan | Roughly what fits / month for THIS app |
|---|---|
| Free | A handful of PDFs to try it. Not enough for a real restaurant's monthly volume. |
| **Pro ($20/mo)** | **~200–400 PDFs/month comfortably.** Right plan for one restaurant. |
| Max ($100–200/mo) | 1000+ PDFs/month, parallel-friendly. Overkill for one restaurant; right for a multi-location operator. |

Each PDF takes ~15–30 seconds and consumes a small slice of your daily/weekly usage cap. You'll see the usage indicator in your Claude Code session — if you hit the cap, just wait until the window resets and re-run the extract prompt (it skips already-extracted files automatically, so it picks up where it left off).

**Same subscription, two sessions:** the install Claude session (running `pnpm dev`) consumes almost nothing — it's just shell commands. The extraction Claude session (reading PDFs) is where the usage goes. Both sessions share your one Claude subscription.

### 🤖 Claude — verify the system

Run these commands and report the output to the human. If any are missing, install them or stop and tell the human:

```bash
node --version       # require: v20.x or newer
pnpm --version       # require: any 8.x+ or 9.x
git --version        # require: any modern git
```

- If `node` is missing or older than v20: stop, tell the human to install from <https://nodejs.org> (pick the LTS version), then resume.
- If `pnpm` is missing: run `npm install -g pnpm` automatically — no need to halt for this.
- If `git` is missing: stop, tell the human to install from <https://git-scm.com>, then resume.

When all three are present, say to the human: **"Prerequisites OK. Continuing to step 1."**

---

## Step 1 — Clone the repository

### 👤 You

Sit back. Claude is about to clone the code onto your machine. You don't need to do anything in this step.

### 🤖 Claude

Pick a parent folder for the app code. **Default: `~/Documents` on Windows/Mac, `~/Projects` on Linux.** If the human prefers another location, ask first.

Then run:
```bash
cd "<parent-folder>"
git clone https://github.com/arthurando/imperial-invoice.git
cd imperial-invoice
```

If the human's git is configured for SSH and HTTPS fails, fall back to:
```bash
git clone git@github.com:arthurando/imperial-invoice.git
```

Report to the human: **"Cloned to `<full path>`. Continuing to step 2."**

---

## Step 2 — Install dependencies

### 👤 You

Wait ~30–60 seconds while Claude installs the Node packages. No action from you.

### 🤖 Claude

```bash
cd app          # if not already there
pnpm install
```

If pnpm prints "WARN" lines but exits 0, that's fine. If it errors out, share the error with the human and try `rm -rf node_modules && pnpm install` once before escalating.

Report: **"Dependencies installed. Continuing to step 3."**

---

## Step 3 — Start the app

### 🤖 Claude

```bash
pnpm dev
```

This will keep running until stopped — that's correct. Watch the output for a line like:

```
- Local:         http://localhost:3000
```

Note the actual port (it may be `3001` or higher if 3000 is busy). Then tell the human verbatim:

> **"App is running at http://localhost:`<port>`. Open that URL in your browser. Tell me when you see the page."**

Stand by until the human confirms.

### 👤 You

1. Open your browser (Chrome, Edge, Safari, or Firefox).
2. Type the URL Claude gave you (e.g. `http://localhost:3000`) into the address bar.
3. You should see a page with **"Imperial Invoice"** in the top-left and an amber **"⚙ Set data folder"** button in the top-right.
4. The middle of the page might be empty or show "No files yet" — that's expected. We're about to fix it.
5. Tell Claude: **"I see the page."**

---

## Step 4 — Pick your data folder

This is where your PDFs and extracted data will live. Pick somewhere you'll remember — your business records will accumulate here over time.

### 👤 You

1. **Click the amber "⚙ Set data folder" button** in the top-right of the app.
2. You're now on the Settings page. You'll see a text input labelled "Data folder".
3. **Type or paste an absolute path** in the input. An absolute path starts with `C:\` on Windows or `/` on Mac/Linux. Examples:
   - Windows: `C:\Users\<YourName>\imperial-data`
   - Mac/Linux: `/Users/<YourName>/imperial-data`

   Replace `<YourName>` with your actual computer username. If you don't know your username, ask Claude — he can run `whoami` to find out.

4. **Click "Save".**

The page will reload. You should now see:
- A green "user-set" badge next to "Data folder"
- Four stat cards showing **0 month folders / 0 PDFs / 0 extraction folders / 0 extractions** — all zero because we haven't added any files yet
- A workflow reminder at the bottom

The folder was created automatically. The app also created `invoice/` and `prototype/extractions/` subfolders inside it.

Tell Claude: **"Data folder is set."**

### 🤖 Claude

The human is interacting with the browser in this step. Don't run any shell commands. Just wait for the human to confirm.

Once they confirm, optionally verify by running:
```bash
ls "<data-folder-path>"
# expect to see: invoice  prototype
```

Report to the human: **"Data folder set. Continuing to step 5."**

---

## Step 5 — Create your first month folder and drop in PDFs

### 👤 You

1. Open your file explorer (**Windows: File Explorer**, **Mac: Finder**) and navigate to your data folder.
2. Open the `invoice/` subfolder inside it.
3. **Create a new folder** named for the batch of invoices you're about to ingest. Use any naming convention — the app handles all of these:
   - `2025-06` (recommended — sortable and unambiguous)
   - `June 2025`
   - `juin 2025`
   - `Q2-2025`
   - `unfiled` (for "I'll sort later")
4. **Copy your PDF invoices** for that month into this new folder.
5. (Optional) Repeat for additional months — you can have as many month folders as you want.

For your first time, **start small** — try 5 to 10 PDFs in one folder. You can always add more later.

Tell Claude: **"PDFs are in place. I have `<N>` PDFs in folder `<folder-name>`."**

### 🤖 Claude

Wait for the human. Once they confirm, optionally run:
```bash
ls "<data-folder>/invoice"
ls "<data-folder>/invoice/<folder-name>" | head
```
to verify the structure looks right. If the folder is flat (PDFs directly in `invoice/` with no subfolder), gently suggest creating a subfolder first — the app supports flat layout but the per-month features won't work.

Report: **"Found `<N>` PDFs in `<folder>`. Continuing to step 6."**

---

## Step 6 — Extract data from the PDFs

This is where Claude reads your PDFs and creates structured data. **You will open a SECOND Claude Code session** for this step — separate from the install session that's running the dev server.

Why two sessions? The install session is busy running `pnpm dev`. We need a fresh session, pointed at your **data folder** (not the app folder), to do the extraction.

### 👤 You

1. **Leave the first Claude Code session running.** Don't close it — it has the dev server.
2. **Open a NEW Claude Code session.** (How exactly depends on your Claude Code install. If it's CLI: open a new terminal and run `claude`. If it's the desktop app: open a new window.)
3. In this NEW session, navigate to your **data folder** (NOT the app folder):
   ```
   cd "<your-data-folder>"
   ```
   e.g. `cd C:\Users\YourName\imperial-data`
4. In the new session, paste the contents of the file `prompts/extract.md` from the cloned repo. To find it, the path is `<wherever-claude-cloned-the-repo>/prompts/extract.md` — your first Claude session can `cat` it for you.
5. The new Claude session will start reading your PDFs. **This takes ~30 seconds per PDF.** Watch the progress. When it's done, it will print a summary table.
6. Switch back to your browser tab with the app and **refresh the page**.

Tell the install Claude session: **"Extraction done."**

### 🤖 Install-session Claude

If the human asks you to print the extraction prompt: run `cat prompts/extract.md` from the repo root and show them the full content.

While the human is in the OTHER session running extraction, you have nothing to do. Just stand by.

If extraction takes longer than expected, suggest the human check that the new session is using **Opus** (not Sonnet — Sonnet hallucinates phantom line items on handwritten invoices). Limit parallel agents to **5 maximum**, one PDF per agent.

### 🤖 Extraction-session Claude (this section is for the NEW Claude Code session at the data folder)

You were invoked at the user's data folder. The user has just pasted instructions from `<repo>/prompts/extract.md`. Follow that prompt exactly. Key reminders:

- **Walk `invoice/` recursively**, including all month subfolders.
- **Skip PDFs that already have a matching JSON** at `prototype/extractions/<same-folder>/<stem>.json`. The check uses the FULL subpath, not just the filename.
- **Use the Opus model.** Sonnet confabulates on dense handwritten invoices.
- **Limit to 5 parallel agents**, one PDF per agent.
- After writing all JSONs, **print a summary table**: subfolder → file_count, invoice_count, total_amount, suppliers, extraction_confidence distribution.

---

## Step 7 — Browse your data

### 👤 You

1. In your browser, you should now see file groups under the **Files** tab — one section per month folder, with each file showing a status badge (✓ for clean, ⚠ for needs review).
2. **Click any file** to see a split view: the PDF on the left, the extracted data on the right. You can click any number or text on the right to edit it — your edits save automatically to `prototype/corrections.jsonl` in your data folder.
3. **Switch to the Data tab** (top of the page). You should see:
   - **Overview** — totals by folder, supplier, location, type.
   - **Invoices** — flat sortable table with filters.
   - **Items** — line items rolled up by item name, with price ranges.
   - **Compare** — pick two month folders, see the Δ in spend, broken down by category and item.
4. If you see **"⏳ N PDFs awaiting extraction"** at the top of the Files tab, those PDFs didn't get extracted. Re-run the extraction prompt in the second Claude session — it will only process the missing ones.

If everything looks right, you're done with the install. **Tell Claude: "Looks good."**

### 🤖 Claude

Confirm success by asking the human:
1. Do you see your month folder(s) on the Files tab? (Yes/No)
2. On the Data tab → Overview, is the total spend showing a positive dollar amount? (Yes/No)
3. Is the "⏳ awaiting extraction" banner gone? (Yes/No)

If all three are Yes, say: **"Install complete. You're ready to use Imperial Invoice."**

If any are No, troubleshoot:
- "No files on Files tab" → check that JSONs were actually written under `<data-folder>/prototype/extractions/<month-folder>/`. If the folder is empty, extraction didn't run. Re-do step 6.
- "Total spend is $0 or empty" → JSONs exist but invoices array is empty. Likely an extraction error — check one of the JSON files for an `errors` array.
- "Awaiting extraction banner won't go away" → the PDFs listed don't have matching JSONs. Re-run extraction; it's incremental and won't redo work.

---

## Day-2 workflow (every time you have new invoices)

### 👤 You

1. Drop new PDFs into the appropriate month folder under `<data folder>/invoice/`.
2. Open a Claude Code session **at your data folder** (not the app).
3. Paste the extract prompt (or just say "run the extract prompt at `<path>/prompts/extract.md`" and Claude will fetch it).
4. Refresh the app in your browser.

To stop the dev server: in the install Claude session (the one running `pnpm dev`), press **Ctrl+C**. The data on disk is not affected.

To restart later: open Claude Code, `cd <repo>/app`, run `pnpm dev`.

### 🤖 Claude

If a returning user asks for help running extraction again: don't re-do the whole install — just walk them through step 6 again.

If they say "the app isn't loading", check whether the dev server is still running. Many users close the terminal accidentally. Re-running `pnpm dev` in the app folder is the fix.

---

## Troubleshooting

### "Port 3000 is in use"
The dev server picks the next free port automatically (3001, 3002, …). Read the actual URL from the dev output. If you want port 3000 free: find what's using it and stop it.

### `pnpm dev` errors with "Cannot find module" or build errors
Run, in the `app/` directory:
```bash
rm -rf node_modules .next
pnpm install
pnpm dev
```

### Folder filter shows nothing, but the JSONs are there
Check that the JSONs are inside a **subfolder** of `prototype/extractions/`, not at the root. The app expects `prototype/extractions/<month-folder>/<file>.json`.

### PDF viewer in the app shows "404" or blank
The JSON references a filename, but the matching PDF isn't in `invoice/<same-folder>/<same-name>.pdf`. Check that you copied both the PDF and didn't move just one.

### "Awaiting extraction" banner won't go away
Those PDFs in `invoice/<folder>/` don't have matching JSONs in `prototype/extractions/<folder>/`. Either:
1. Run extraction again (it's incremental).
2. Or, if those PDFs aren't actual invoices (e.g. you put a random PDF there), move them out of `invoice/`.

### Changed the data folder path, app still shows old data
Browser cache. Hard refresh: **Ctrl+Shift+R** (Windows/Linux) or **Cmd+Shift+R** (Mac).

### Extraction quality is poor (wrong numbers, missing line items)
Make sure the extraction Claude session is using **Opus**, not Sonnet. Sonnet hallucinates on handwritten invoices. You can also manually fix any field by clicking it in the app — the correction overrides the extraction.

### Need to start over with a fresh data folder
1. Open the Settings tab.
2. Paste a new path in the data folder input.
3. Click Save.

Your old data is untouched on disk — it's just no longer the active folder.

---

## Files Claude should NOT touch

- Anything under the user's data folder (`<data-folder>/invoice/`, `<data-folder>/prototype/`). Those are real business records.
- `~/.imperial-invoice/config.json` — the path picker writes here; don't edit by hand.
- `prototype/corrections.jsonl` — append-only audit log; never rewrite.

---

## Need help beyond this guide?

Open an issue at <https://github.com/arthurando/imperial-invoice/issues>, or ask the user who shared this repo with you.
