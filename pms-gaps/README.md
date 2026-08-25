# pms-gaps — working agreement

> **Read this before touching anything in this folder.** It says what the files are, how to pick up
> work, and the house rules that apply to every item in here.

---

## What this folder is

Tartware graded against the **Hotel PMS Capability Atlas** — 479 capabilities across 21 domains,
with OPERA Cloud's functional surface as the spine, extended with what cloud-native vendors have made
table stakes and what PCI/PSD2/GDPR/fiscalization require by law.

**181 built · 144 partial · 154 missing.** The 298 non-built items are all written up here.

| File | What it is |
|---|---|
| [00-CONSOLIDATED.md](00-CONSOLIDATED.md) | Start here. Scoreboard, what's already strong, priority tables, phase plan. |
| [WORKSTREAMS.md](WORKSTREAMS.md) | **The fix specs.** 298 items collapse into 24 workstreams. This is where the actual engineering guidance lives. |
| `01-…21-*.md` | One file per domain. Every gap item as a card: what exists today, what to build, which workstream it belongs to. |
| [TRACKER.md](TRACKER.md) | The ledger. One checkbox per item, grouped P0 / P1 / P2. |
| `gaps.json` | Machine-readable — same 298 items with id, status, tier, priority, effort, workstream. Query this instead of re-deriving. |

**Companion artifact:** https://claude.ai/code/artifact/0d74fafd-a3fd-46b1-a425-887852d7342d —
all 479 items including the 181 built ones, filterable.

---

## How to pick up work

**Work the workstream, not the item.** Most items inside a workstream are the same change applied in
different places. Building them one at a time means designing the same thing twenty times and getting
twenty slightly different answers.

1. Open [00-CONSOLIDATED.md](00-CONSOLIDATED.md), pick the next workstream in the phase plan.
2. Read that workstream's spec in [WORKSTREAMS.md](WORKSTREAMS.md) — it carries the schema shape, SQL
   location, which service owns it, and the definition of done.
3. Read the individual item cards it closes (the **Closes** table links each one) for the per-item
   delta.
4. Build. Tick the boxes in [TRACKER.md](TRACKER.md) with the commit SHA when each item ships.

**If you only have an hour**, pick a P0 item whose workstream is already underway. Do not start a new
workstream in an hour.

---

## House rules that apply to every item here

These come from [`AGENTS.md`](../AGENTS.md). They are not restated in each item card — they apply
everywhere.

### Schema-first STOP GATE — non-negotiable

Before writing `type Foo = {`, `interface Foo {`, or any `z.object({})` in `Apps/`:

1. Search `schema/src/` — does the type exist?
2. If not, create it in `schema/` **first**, build, then import.
3. If yes, import from `@tartware/schemas`. Never redefine locally.

```bash
npx nx run @tartware/schemas:build --skip-nx-cache
```

Always `--skip-nx-cache` after adding or removing an exported type — NX caches stale results.

Provider contracts (`PaymentGateway`, `ChannelTransport`, `FiscalDevice`, `AccessControl`) are
**shared service interfaces** and belong in `schema/src/api/<domain>.ts`, not in the service that
happens to implement them first. Several workstreams start by moving one.

### SQL

- No date-prefixed migration files. Changes go into the canonical file under
  `scripts/tables/<category>/`.
- New table → new numbered file **and** an entry in `scripts/tables/00-create-all-tables.sql`.
- New column → edit the existing `CREATE TABLE` file, not a separate migration.
- Idempotent patterns: `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `ON CONFLICT DO NOTHING`.
- Additive first — nullable column, backfill, then tighten. Several items here (WS-01 especially)
  will break if done as a single destructive change.
- Every SQL file needs all six documentation elements (header banner, section banner, inline column
  comments, `COMMENT ON TABLE`, `COMMENT ON COLUMN`, `\echo`). Reference:
  `scripts/tables/01-core/01_tenants.sql`.
- Update the matching `verify-*.sql` after any table or column change.
- Add indexes for new filter/sort fields in `scripts/indexes/`.

### Writes

- High-volume domains (reservations, billing, housekeeping) use **commands** through the event
  pipeline + transactional outbox, not CRUD REST.
- CRUD REST is for low-velocity admin/config data and read-only endpoints.
- Every new command supports idempotency keys and dedup.
- New command streams get metrics (throughput, lag, error, DLQ) and a replay path by default.

### Testing

- **Always through the API Gateway on :8080.** Never call a service directly, never manipulate data
  with SQL to set up or verify a test.
- `http_test/*.http` or curl against `localhost:8080`.
- Direct DB access is read-only diagnostics only.
- Realdata E2E suites need a DB reset first — `setup-database.sh`.

### Completion gate

```bash
pnpm run build   # must exit 0 — lint + biome + knip + compile
```

**A task is not complete until this passes.** Before pushing, per affected service:
`npx biome check --write src/`, `npx knip`, `npx eslint src/`. Never push without asking.

### UI

`AGENTS.md` says to ignore UI changes unless explicitly asked. Items in this folder marked as needing
a screen are **backend-first**: build the API, then ask before building the screen. Existing UI
conventions if you do: grep `UI/shared-styles/shared.scss` before writing component SCSS, use
`.skeleton` classes rather than literal "Loading…" text, and verify in a real browser (Playwright
works here — see the `run-tartware-ui` skill).

---

## Conventions in this folder

- **Item IDs** are `PMS-<domain>-<nn>`, e.g. `PMS-01-07`. Stable — reference them in commit messages
  and GitHub issues.
- **Commit tag** `PMS-nn` in the subject line, matching how `ui-gaps/` uses `COV-nn` and
  `accounts-gaps/` uses `ACCT-nn`.
- **Status** is what the grading found: `PARTIAL` (data model exists but nothing enforces it, nothing
  routes to it, or the implementation is a stub) or `MISSING` (no trace anywhere).
- **Priority** derives from the benchmark tier — table stakes → P0, competitive → P1, enterprise →
  P2 — with overrides where the tier understates legal risk (fiscalization, key management).
- **Effort** is S / M / L / XL and indicative only. Treat the workstream's effort as the real number;
  per-item effort assumes the workstream's foundation already exists.

---

## What this grading is and isn't

It is static analysis across three layers — a table in `schema/src/schemas`, a route in `Apps/*/src`,
a screen in `UI/pms-ui/src/app/features` — with the code read wherever the three disagreed.

**It shows what exists, not whether it works.** An item graded Built can still be wrong at runtime,
and the grade says nothing about how well a screen does its job. Where a card makes a specific claim
about behaviour (`createReservation` never reads restrictions; the OTA push is simulated; billing
never calls a PSP) that claim came from reading the code, and the file is named so you can check it.

Tier labels are the benchmark's, unchanged. Where I disagreed with a tier I left it and overrode the
priority instead, so the mapping back to the benchmark stays honest.

---

## Related audits — do not duplicate

Several items here are already specced in more detail elsewhere. Build those specs, don't rewrite them.

| This folder | Already specced in |
|---|---|
| Deposit ledger (PMS-11-07) | `accounts-gaps/02-advance-deposit-ledger.md` |
| Payment gateway webhooks (WS-07 step 4) | `accounts-gaps/04-payment-gateway-webhooks.md` |
| POS integration (PMS-17-02, PMS-11-04) | `accounts-gaps/05-pos-integration.md` |
| GL/ERP export (PMS-12-05) | `accounts-gaps/06-gl-erp-export.md` |
| Legal invoice numbering (PMS-15-11) | `accounts-gaps/11-invoice-sequential-numbering.md` |
| Cancellation policy snapshot (PMS-01-06) | `accounts-gaps/12-cancellation-policy-snapshot.md` |
| Multi-currency FX locking (PMS-05-10) | `accounts-gaps/13-multi-currency-fx-locking.md` |
| UI reachability of existing APIs | `ui-gaps/00-CONSOLIDATED.md` |

The live backlog is GitHub issues, not `TODO.md`:

```bash
gh issue list --state open --limit 100 --json number,title,labels
```
