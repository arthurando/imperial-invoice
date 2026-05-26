# Plan: Imperial Invoice — Stage D: Electron Windows App + Folder-by-Month

**Goal:** (1) Wrap the existing Next.js workbench in Electron and ship a Windows installer (.exe) the friend can double-click. (2) Reorganize invoice storage so files live in **per-month subfolders** the friend names himself, with the app auto-discovering folders and filtering by them. All data still lives on his disk; extraction still runs through his own Claude Code session.

## Why this stage

Stage C made the repo `pnpm install && pnpm dev` clean. That's still a developer workflow — friend needs Node 20, pnpm, and a terminal. Stage D removes that floor: he runs `ImperialInvoice-Setup.exe`, gets a Start Menu shortcut, opens the app, drops PDFs into a month-named folder, runs his own Claude Code session against that folder, and the app picks up the new extractions filtered by month.

## Data layout (NEW in Stage D)

**Source of folder structure: the friend.** Free-form folder names — he can use `June 2025`, `2025-06`, `juin`, `Q2-2025`, whatever. App treats every direct subfolder of `invoice/` as a month-group and displays the folder name verbatim. No regex, no parsing.

```
%APPDATA%\imperial-invoice\
├── invoice\
│   ├── June 2025\
│   │   ├── Tofu.pdf
│   │   └── Kar wah cheq#5650.pdf
│   ├── July 2025\
│   │   └── ...
│   └── unfiled\          # optional bucket for not-yet-sorted PDFs
└── prototype\
    ├── extractions\
    │   ├── June 2025\
    │   │   ├── Tofu.json
    │   │   └── Kar wah cheq#5650.json
    │   └── July 2025\
    │       └── ...
    └── corrections.jsonl
```

**Mirroring rule:** Extractions live in `prototype/extractions/<same-folder-name>/<filename>.json` — same subfolder as the source PDF. Renaming a folder = rename both sides; the extraction prompt enforces this on next run. JSON files stay immutable and grep-friendly.

**Source of truth for grouping:** **Folder name wins by default**, but `invoice_date` is shown alongside and selectable as an alternate group-by. Reason: friend's filing intent is deterministic; OCR-extracted `invoice_date` on handwritten invoices is fallible. Folder-vs-invoice-date mismatches surface in the UI as a data-quality signal (small badge on rows where `invoice_date`'s month differs from folder name).

**Schema impact:** No change to extraction JSON files. A `source_folder` field is **derived at load time** from the file path. The `ExtractionFile` JSON shape stays exactly as `prototype/SCHEMA.md` documents it.

## Architecture choice (locked)

**Approach:** Embed Next.js **standalone production build** in Electron. Electron's main process spawns the standalone Node server on a random free port, then opens a `BrowserWindow` pointed at `http://127.0.0.1:<port>`.

**Why not static export:** App reads `prototype/extractions/*.json` via server components on every render — converting to client-side fetches would refactor 5 routes for no real win. The standalone server is ~70MB on top of Electron and boots in <1s.

**Why not Next dev server:** Slow start, hot-reload noise the user doesn't need, and `next dev` has no asar story.

**Data dir resolution:**
- Env var `IMPERIAL_DATA_DIR` set by Electron main before spawning the Next server.
- Production target: `app.getPath('userData')` → `%APPDATA%\imperial-invoice\` on Windows.
- Subfolders auto-created on first run: `invoice/`, `prototype/extractions/`, `prototype/corrections.jsonl` (empty file).
- Dev fallback: when env var unset, current behavior (resolve relative to repo root).

**PDF serving:**
- Old: `/invoices/Tofu.pdf` served from `public/invoices/` (won't work post-packaging).
- New: `/api/pdf/[name]` route streams the file from `${IMPERIAL_DATA_DIR}/invoice/<name>` with path-traversal guard.
- `pdfPublicPath()` returns `/api/pdf/<encoded-name>` instead of `/invoices/<encoded-name>`.

## File Map

### Folder-by-month (Phase 0)
| File | Action | Purpose |
|------|--------|---------|
| `app/lib/types.ts` | Edit | Add `source_folder: string` to derived file/invoice types (NOT to the persisted JSON shape — derived in loader). |
| `app/lib/invoices.ts` | Edit | Make `loadAllFiles()` walk `extractions/` recursively (one level deep). Tag each loaded file with `source_folder = path.relative(extractionsRoot, dirname(file))` (or `""` for legacy flat files). Add `listFolders()` → sorted unique folder names. Change `pdfPublicPath()` to return `/api/pdf/${encodeURIComponent(source_folder)}/${encodeURIComponent(filename)}` (or `/api/pdf/_/<filename>` when folder is empty). |
| `app/app/page.tsx` (dashboard) | Edit | Add folder filter chip-row + group-by toggle (folder / invoice_date). Read selected folder from search param `?folder=`. All dashboard aggregates respect the filter. |
| `app/app/invoices/page.tsx` | Edit | Add `Folder` column + folder filter dropdown. |
| `app/app/items/page.tsx` | Edit | Add folder filter; price-history rollup respects it. |
| `app/app/compare/page.tsx` | Edit | Primary picker becomes Folder A vs Folder B (was period A vs B). Keep date-range as advanced mode. |
| `app/app/files/page.tsx` | Edit | Group by `source_folder` instead of (or in addition to) current grouping. Show folder header + count. |
| `app/app/files/[filename]/page.tsx` | Edit | URL becomes `/files/[folder]/[filename]` (catch-all `[...slug]`) or keep flat with disambiguation if collisions. Prefer catch-all for clarity. |
| `app/lib/folder-badges.ts` | Create | `folderVsDateMismatch(invoice)` helper → boolean. UI uses it for the data-quality badge. |
| `prompts/extract.md` | Edit | Walk subdirs of `invoice/`. Write extractions preserving the subfolder. Skip-already-extracted check uses the full subpath. |

### Path abstraction + PDF route (Phase 1)
| File | Action | Purpose |
|------|--------|---------|
| `app/lib/paths.ts` | Create | Single source: `dataDir()`, `invoiceDir()`, `extractionsDir()`, `correctionsPath()`, `invoicePdfPath(folder, filename)`, `ensureDataDirs()`. Reads `process.env.IMPERIAL_DATA_DIR`; falls back to repo-relative for dev. |
| `app/lib/invoices.ts` | Edit | Swap hardcoded `EXTRACTIONS_DIR` for `extractionsDir()`. Make resolution lazy (per-request) so env var picks up. |
| `app/lib/corrections.ts` | Edit | Swap hardcoded `CORRECTIONS_PATH` for `correctionsPath()`. |
| `app/app/api/pdf/[...path]/route.ts` | Create | Catch-all GET route. Decodes `[folder, filename]` (or just `[filename]` for legacy flat). Rejects `..`, absolute paths, non-`.pdf` extensions. Streams `application/pdf` from `invoicePdfPath()`. 404 on missing. |
| `app/next.config.ts` | Edit | Add `output: 'standalone'`. |

### Electron shell (Phase 2)
| File | Action | Purpose |
|------|--------|---------|
| `app/electron/main.ts` | Create | Resolve userData dir, ensure subfolders, find free port, spawn `node .next/standalone/server.js` with `PORT` + `IMPERIAL_DATA_DIR` + `HOSTNAME=127.0.0.1`, create BrowserWindow, load URL when ready. Single-instance lock. Clean shutdown of child on window-all-closed. Menu item: "Open data folder" → `shell.openPath(dataDir)`. |
| `app/electron/preload.ts` | Create | Empty preload (no Node API exposed to renderer). |
| `app/electron/tsconfig.json` | Create | CommonJS target for main/preload. |
| `app/package.json` | Edit | Add `electron`, `electron-builder`, `get-port`, `wait-on`. Scripts: `electron:build`, `electron:dev`, `dist`. `main: "electron/dist/main.js"`. |

### Packaging + docs (Phases 3-4)
| File | Action | Purpose |
|------|--------|---------|
| `app/electron-builder.yml` | Create | appId `hk.sttmall.imperial-invoice`, Windows nsis target, include `.next/standalone/**`, `.next/static/**`, `public/**`, `electron/dist/**`, `package.json`. Output to `app/release/`. |
| `.gitignore` | Edit | Add `app/electron/dist/`, `app/release/`. |
| `README.md` | Edit | Top: download installer → run → app opens. "Where to put your files": `%APPDATA%\imperial-invoice\invoice\<your-month-folder>\`. Extraction step: open Claude Code in the data folder, run `prompts/extract.md`. Old pnpm flow → "Building from source" section. |
| `plans/kyle-invoice-build.md` | Edit | Add Stage D row; link this plan. |

**Total: 22 files** (13 edit, 9 create across `app/lib`, `app/app`, `app/electron`, prompts, plans, root). **Pause-gate trip** — wait for go before touching anything but this plan file.

## Phases

### Phase 0 — Folder-by-month data layout ✅ DONE (2026-05-27)
Teach the loader + UI to discover subfolders and filter by them. Behavior change visible in dev mode before any Electron work.

- [x] One-time local migration: `app/scripts/migrate-to-folders.mjs` moved the 45 flat extractions + PDFs into 3 month folders (`2026-03/` 6 files, `2026-04/` 38 files, `2026-05/` 1 file) by reading each file's modal `invoice_date`.
- [x] Edit `app/lib/types.ts` — `source_folder: string` added to `FileWithChecks` (load-derived; JSON schema unchanged).
- [x] Rewrote `app/lib/invoices.ts` — `loadAllFiles()` walks one level deep, every file gets `source_folder`, sorted by folder then filename. Added `listFolders()` + `filesViewerPath()`. `pdfPublicPath()` now takes the file object and returns `/api/pdf/<folder>/<filename>`.
- [x] Created `app/lib/folder-badges.ts` + 5-block test contract — `folderMonthFromName` (parses `2025-06`, `June 2025`, `juin 2025`, etc.; null on unrecognised), `invoiceMonth`, `folderVsDateMismatch`, `folderLabel`.
- [x] Edit `app/app/page.tsx` — folder filter chips + new "By folder" card on the dashboard.
- [x] Edit `app/app/invoices/page.tsx` — folder column with mismatch ⚠︎ marker + folder dropdown in `InvoiceFilters`.
- [x] Edit `app/app/items/page.tsx` — folder filter chip-row.
- [x] Rebuilt `app/app/compare/page.tsx` — folder A vs folder B picker, Δ category rollup, top-50 line-item movers with Δ qty / Δ unit-price / Δ spend (red = up, green = down).
- [x] Edit `app/app/files/page.tsx` — grouped by `source_folder`, with per-folder needs-review + reconciled lists.
- [x] Restructured `app/app/files/[filename]/` → `app/app/files/[...slug]/`. Page now accepts `[filename]` (legacy) or `[folder, filename]`. Internal links across all pages use `filesViewerPath(file)`.
- [x] Added `app/app/api/pdf/[...path]/route.ts` + test — streams from `invoice/<folder>/<file>` with traversal guard, non-.pdf rejection, root-confinement check.
- [x] Edit `prompts/extract.md` — walks subdirs, preserves subfolder in output path, skip-existing uses full subpath. Notes folder name is NOT authoritative for invoice_date.
- [x] Made `lib/corrections.ts` respect `IMPERIAL_DATA_DIR` so dev/Electron paths stay consistent.

**Verify Phase 0 (run 2026-05-27):**
- `pnpm build` clean (TypeScript + Turbopack). 9 routes detected, including new `/api/pdf/[...path]` and `/files/[...slug]`.
- `pnpm dev` + curl: `/?folder=2026-03` returns filtered view; `/files` shows 3 folder groups; `/compare?a=2026-03&b=2026-04` renders Δ Total + By category + By line item tables; `/items?folder=...` filters; `/api/pdf/2026-04/Tofu.pdf` streams 3.74 MB as `application/pdf`; `/files/2026-04/Tofu.pdf` viewer page renders folder badge + iframe.
- All 45 files visible across the 3 month-folders. Existing corrections.jsonl still applied (loader path unchanged for repo-relative dev).

### Phase 0.5 — Dev-mode UX restructure ✅ DONE (2026-05-27)
Added in mid-stream after Arthur deferred Electron and asked for "local dev, test end to end" with an in-app data-path picker + two-tab Files/Data layout.

- [x] `app/lib/config.ts` + test — single source for `dataDir()`, `extractionsDir()`, `invoiceDir()`, `correctionsPath()`, `getConfig()`, `setConfigDataDir()`. Resolver order: `IMPERIAL_DATA_DIR` env > `~/.imperial-invoice/config.json` > repo-relative dev fallback. Sync file I/O (the config file is tiny).
- [x] `app/lib/invoices.ts`, `app/lib/corrections.ts`, `app/app/api/pdf/[...path]/route.ts` — all now import their paths from `lib/config`. Inline env-var resolvers deleted.
- [x] `app/app/api/config/route.ts` + test — GET returns current `{dataDir, source, configFile}`; POST validates path exists + is a directory, pre-creates `invoice/` and `prototype/extractions/` subfolders, writes config, calls `revalidatePath('/', 'layout')`.
- [x] `app/app/settings/page.tsx` + `DataDirForm.tsx` (client) + tests — text input for the absolute path, Save button, server-rendered diagnostics (month folder count, PDF count, extraction folder count, extraction count + a "ready / fix this" message), source badge (env override / user-set / default).
- [x] `app/app/layout.tsx` — replaced 5-link nav with two-tab `<TopNav>` (Files / Data) + header bar showing active dataDir + ⚙ Settings link (amber-highlighted when source is default).
- [x] `app/app/TopNav.tsx` (client) + test — active-tab styling using `usePathname()`.
- [x] `app/app/page.tsx` — replaced dashboard content with `redirect('/files')`. Old dashboard content now lives at `/data`.
- [x] Moved `app/app/{invoices,items,compare,page.tsx}` → `app/app/data/{invoices,items,compare,page.tsx}`. Internal hrefs updated (`/items` → `/data/items`, `/compare` → `/data/compare`, `/?folder=…` → `/data?folder=…`).
- [x] `app/app/data/layout.tsx` + `DataSubNav.tsx` (client) + tests — secondary nav with Overview / Invoices / Items / Compare and active-link styling.

**Verify Phase 0.5 (run 2026-05-27):**
- `pnpm build` clean — 12 routes registered (`/`, `/files`, `/files/[...slug]`, `/data`, `/data/invoices`, `/data/items`, `/data/compare`, `/settings`, `/api/config`, `/api/corrections`, `/api/pdf/[...path]`, `/_not-found`).
- `/ → 307` redirect to `/files`. All other routes return 200.
- `/api/config` GET returns `{source:'default', dataDir:<repo>, configFile:~/.imperial-invoice/config.json}`. POST with `{dataDir:"C:\\Users\\user\\Claude Project\\proj_kyle-invoice"}` flips source to `'config'`, persists in `~/.imperial-invoice/config.json`, and `revalidatePath` re-renders subsequent requests.
- `/settings` renders the form, current path, config-file location, source badge, and the 4 stat cards: **3 month folders / 45 PDFs / 3 extraction folders / 45 extractions**.
- `/api/pdf/2026-04/Tofu.pdf` → 200, 3.74 MB.
- Switching between top tabs (Files / Data) preserves the URL state; secondary nav inside /data routes between Overview / Invoices / Items / Compare with active styling.

### Phase 1 — Path abstraction (no Electron yet)
Refactor data-path access so the app keeps working in dev mode AND respects `IMPERIAL_DATA_DIR` when set. Built on top of Phase 0 so the path helpers already understand folders.

- [ ] Create `app/lib/paths.ts` with: `dataDir()`, `invoiceDir()`, `extractionsDir()`, `correctionsPath()`, `invoicePdfPath(folder, filename)`, `ensureDataDirs()`. Reads `IMPERIAL_DATA_DIR` env, falls back to `path.resolve(process.cwd(), '..')` for repo-relative dev.
- [ ] Edit `app/lib/invoices.ts`: replace `EXTRACTIONS_DIR` constant with call to `extractionsDir()`. Lazy resolution (function call inside `loadAllFiles`) so env var resolves at request time, not import time.
- [ ] Edit `app/lib/corrections.ts`: same pattern for `CORRECTIONS_PATH`.
- [ ] Create `app/app/api/pdf/[...path]/route.ts` — catch-all, traversal guard, stream `application/pdf` from `invoicePdfPath(folder, filename)`.
- [ ] Edit `app/next.config.ts`: add `output: 'standalone'`.
- **Verify Phase 1:** `pnpm dev` still shows dashboard with all invoices across folders; PDFs load via `/api/pdf/<folder>/<name>`; `IMPERIAL_DATA_DIR=C:\tmp\test pnpm dev` shows empty dashboard. All tests pass.

### Phase 2 — Electron shell
Add Electron without packaging yet — proves the spawn-server-and-load-URL flow works on dev.

- [ ] Create `app/electron/main.ts` — userData dir resolution, `ensureDataDirs()` shim that mirrors `paths.ts`, free port via `get-port`, spawn standalone server with env, `BrowserWindow` with `webPreferences: { contextIsolation: true, nodeIntegration: false }`, error handling on child exit.
- [ ] Create `app/electron/preload.ts` — currently empty.
- [ ] Create `app/electron/tsconfig.json` — `module: "commonjs"`, `outDir: "./dist"`, `target: "es2022"`.
- [ ] Edit `app/package.json` — add deps + scripts + `main`.
- [ ] Run `pnpm install`.
- [ ] Run `pnpm build` (Next standalone) + compile electron TS.
- [ ] Run `pnpm electron:dev` — Electron window opens, loads dashboard, all 5 pages work, correction edit appends to a `corrections.jsonl` inside `%APPDATA%\imperial-invoice\prototype\`.
- **Verify Phase 2:** End-to-end manual test: launch from electron, navigate all 5 pages, edit a field on `/files/<name>`, confirm `%APPDATA%\imperial-invoice\prototype\corrections.jsonl` got a new row.

### Phase 3 — Packaging
Produce the Windows installer.

- [ ] Create `app/electron-builder.yml` with nsis target, oneClick: false (let user pick install dir), include patterns above.
- [ ] Run `pnpm dist`.
- [ ] Inspect `app/release/` — expect `ImperialInvoice Setup <version>.exe`, ~150MB.
- [ ] Install on this machine via the installer (different user dir to simulate fresh user). Confirm Start Menu shortcut works.
- [ ] Verify the installed copy:
  - opens to empty dashboard (because `%APPDATA%\imperial-invoice\` is empty on first run)
  - dropping a JSON into `%APPDATA%\imperial-invoice\prototype\extractions\` makes it appear after a page refresh
  - dropping a PDF with matching filename into `%APPDATA%\imperial-invoice\invoice\` makes the PDF viewer work
- **Verify Phase 3:** Uninstaller cleanly removes app but leaves `%APPDATA%\imperial-invoice\` data intact (user's invoices survive uninstall).

### Phase 4 — Docs + handoff
Make the friend-install path obvious.

- [ ] Edit `README.md` — top section becomes: 1) Download installer, 2) Run it, 3) Open data folder (button in app? or documented path), 4) Drop PDFs, 5) Run Claude Code prompt against the data folder, 6) Refresh app. Move pnpm/dev section under "Building from source".
- [ ] Edit `plans/kyle-invoice-build.md` — add Stage D row, link this plan.
- [ ] Optional: add a "Open data folder" menu item to Electron (uses `shell.openPath`). Defer if time-boxed.
- **Verify Phase 4:** Hand the installer + README to a fresh Windows user (or simulate); 10-minute install-to-first-invoice test passes.

## Failure modes & stress test

This is a single-user local desktop app — most stress-test questions are n/a, but worth naming:

1. **100x load** — n/a, single user, single window. Standalone server handles many invoices fine; load-time is bounded by number of JSON files (currently 45, will grow to a few hundred over years).
2. **External dep down** — Claude Code unreachable only blocks NEW extractions; existing data + UI keeps working. Network optional; no telemetry, no remote fetch.
3. **Slow request (30s)** — Loader reads all JSON synchronously. At 200+ files this could approach 100ms; still fine. Hard cliff would be 10K+ files — out of scope.
4. **Concurrent users** — n/a. Two app windows on same machine would race `corrections.jsonl` writes; we don't support that, and Electron defaults to single-instance via `app.requestSingleInstanceLock()` — add this in main.ts.
5. **Hostile input** — Malformed extraction JSON currently throws at load. New `/api/pdf/[name]` route MUST reject `..`, absolute paths, and non-`.pdf` extensions before reading. Test these.
6. **Long uptime** — Friend will close + reopen the app daily. Standalone Node server has no long-lived state we depend on. Memory growth bounded by Electron itself (Chromium); acceptable.

**Mitigations included:** path-traversal guard on `/api/pdf/`, single-instance lock, child-process kill on window-all-closed, `ensureDataDirs()` creates missing folders before server starts.
**Mitigations explicitly deferred:** JSON parse error per-file try/catch (acceptable risk — extraction is authored by Claude Code, low malformed-input rate); auto-update mechanism (manual reinstall is fine for v1).

## Outcome

**Verify (Stage D):**
1. `app/release/ImperialInvoice Setup <version>.exe` exists and installs cleanly on a fresh Windows user account
2. Installed app opens to dashboard within 3s of double-click
3. Creating two subfolders `June 2025/` and `July 2025/` in `%APPDATA%\imperial-invoice\invoice\` and dropping PDFs + matching JSONs in `prototype\extractions\June 2025\` etc. produces a folder filter chip-row in the app, and switching between them updates all aggregates
4. /compare lets you diff `June 2025` vs `July 2025`
5. A row whose extracted `invoice_date` month differs from its folder name shows a mismatch badge
6. Editing a field in the viewer appends to `%APPDATA%\imperial-invoice\prototype\corrections.jsonl`
7. README's "install + first invoice" walkthrough completes in <10 minutes for a fresh user
8. Uninstall removes the app but preserves the data dir
