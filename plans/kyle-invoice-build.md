# Plan: Imperial Invoice — Local-First, Distributable

**Goal:** A local-first workbench to extract structured data from restaurant invoice PDFs, review and correct it, and compare cost across periods (Mar+Apr 2026 vs Jun+Jul 2025) to explain why food cost rose while individual prices held flat. Everything filesystem-local; nothing online. Shippable as a repo that a friend can `git clone && pnpm install && pnpm dev` and use on their own data.

## Stage history (where we've been)

| Stage | Outcome |
|---|---|
| **A — Extraction** ✅ | Claude Code session with 5 parallel Opus sub-agents extracted 45 PDFs into `prototype/extractions/*.json` (~10 min, $0). |
| **B — Local Next.js viewer** ✅ | Filesystem JSON → Next.js 16 server components → dashboard / files / invoices / items / compare. Editable fields write to `prototype/corrections.jsonl`. Auto-reconciliation, OK-manual override, add/remove line, weight column for meat lines all shipped. |
| ~~B2 — Supabase + Vercel + public repo pivot~~ ❌ Reversed 2026-05-23 | Schema applied 2026-05-20 (`imperial_invoice_*` tables) but app code was never wired to it. Reversed: friend will run pure-local on his own machine. Dormant Supabase tables left untouched for now. |
| **C — Distributable repo** 🛠️ | THIS PASS. Make the project a friend can install. |
| **Phase 2 — Local SQLite** ⏳ | Replace `lib/invoices.ts` filesystem IO with a SQLite store. Single file, no daemon, works on any laptop. |

## What this pass delivers (Stage C)

| File | Action | Purpose |
|------|--------|---------|
| `proj_kyle-invoice/.gitignore` | Created | Block `invoice/`, `prototype/extractions/`, `prototype/corrections.jsonl`, `app/public/invoices/`, `.env*`, `node_modules`, `.next`. |
| `proj_kyle-invoice/README.md` | Created | Real README at repo root: prereqs, install, ingestion workflow, page tour, privacy model. |
| `proj_kyle-invoice/prompts/extract.md` | Created | Canonical Claude Code extraction prompt (paste-in, no API key). |
| `invoice/.gitkeep` + `prototype/extractions/.gitkeep` + `app/public/invoices/.gitkeep` | Created | Dirs survive a fresh clone. |
| `app/app/upload/` | Deleted | Empty placeholder; friend ingestion is Claude Code, not browser upload. |
| `proj_kyle-invoice/plans/kyle-invoice-build.md` | Rewritten | This file. |

Not in this pass:
- No git commit. User decides when to commit.
- No push to a remote. User decides where to host.
- No Phase 2 SQLite work.
- No teardown of dormant Supabase `imperial_invoice_*` tables (separate pass if user wants).

## Architecture (after this pass)

```
proj_kyle-invoice/
├── README.md                         # Setup, ingestion, page tour
├── .gitignore                        # Protects private data
├── invoice/                          # USER PDFs (gitignored)
├── prototype/
│   ├── SCHEMA.md                     # Extraction JSON schema
│   ├── extractions/                  # Extracted JSON per PDF (gitignored)
│   └── corrections.jsonl             # Append-only manual edits (gitignored)
├── prompts/
│   └── extract.md                    # Claude Code extraction prompt
├── plans/kyle-invoice-build.md       # This file
└── app/                              # Next.js 16 frontend
    ├── app/                          # routes
    ├── lib/                          # checksum, reconcile, corrections, price-history, invoices, types
    ├── public/invoices/              # PDFs for in-browser viewer (gitignored)
    └── package.json
```

## Data flow (after this pass)

```
User drops PDF in invoice/
  └─> Claude Code session reads prompts/extract.md
        └─> Writes prototype/extractions/<name>.json
              └─> Next.js loadAllFiles() reads JSON
                    └─> applies prototype/corrections.jsonl
                          └─> reconcileInvoice() (historical price)
                                └─> checkInvoice() (math validation)
                                      └─> renders dashboard / files / invoices / items / compare
```

User edits a field in the viewer
  └─> POST /api/corrections
        └─> appends to prototype/corrections.jsonl
              └─> revalidatePath → next render re-applies → checksum re-runs

## Failure modes & stress test (Stage C)

1. **100x load** — n/a, single-user local app.
2. **External dep down** — n/a, no external deps. Claude Code is offline-from-the-app's-perspective (the user invokes it separately).
3. **Slow request (30s)** — Loader reads 45 small JSON files synchronously; render is sub-second. Extraction (10-30s per PDF) happens outside the dev server entirely.
4. **Concurrent users** — n/a, single-user. Phase 2 SQLite considers two reviewers on the same machine.
5. **Hostile input** — Malformed JSON in `prototype/extractions/` will throw at load. Acceptable for personal-use tool; if friend opens an issue we add a try/catch per file.
6. **Long uptime** — Dev server restarted on demand. `corrections.jsonl` grows monotonically (~few KB per edit). Not a concern at restaurant-invoice scale.

## Phase 2 plan (local SQLite — not in this pass)

**Why migrate from JSON files to SQLite:**
- Atomic correction writes — current append-to-JSONL is fine but corruption-prone if process dies mid-write
- Fast queries when month count grows (>12 months × 50 PDFs)
- Schema evolution without rewriting all extraction JSONs
- Single canonical store for cross-period comparisons

**Why NOT migrate yet:**
- Current JSON+JSONL works at 45 PDFs
- File-based store is human-debuggable + grep-able + git-friendly
- Adding a build step (better-sqlite3 native deps) raises friend's install friction

**When to do it:** When the user crosses 200+ PDFs total, OR when `/compare` page perf becomes noticeable, OR when correction races (rare) cause data loss.

**Sketch:**
- `app/lib/db.ts` opens `prototype/imperial.db` (SQLite via `better-sqlite3`)
- Tables mirror current schema in `app/lib/types.ts` + the 2026-05-20 Supabase migration
- Extractions still land as JSON files first (immutability guarantee). A migration script + a watcher upserts them into SQLite. JSON files remain the canonical source of truth.
- Corrections write straight to SQLite. JSONL becomes a one-time-import legacy.

## Open work (post-Stage C)

- `/compare` page: needs Jun+Jul 2025 PDFs ingested. Wireframe in place.
- Flagged invoices (20-ish out of 156): need human review (manual override + add-line UI already shipped).
- Categorization second pass: 92% BR, some `unknown` worth investigating.
- Phase 2 SQLite migration (see above).
- Decide what to do with the dormant `imperial_invoice_*` Supabase tables (drop them in a separate pass if user wants).

## Outcome

**Verify (Stage C):**
1. `git status` at `proj_kyle-invoice/` shows clean tree after init — no `.pdf` or extraction `.json` in tracked files
2. Fresh `git clone` of the repo onto a different machine boots `pnpm install && pnpm dev` cleanly with empty dashboard
3. `prompts/extract.md` paste-in flow produces extractions for a sample PDF and the dashboard shows it
4. README's setup walkthrough completes end-to-end in <10 minutes for a new user
