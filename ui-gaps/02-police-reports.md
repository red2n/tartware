# COV-02: Police / Statutory Guest Reporting — Read-Only Backend, No UI

**Priority:** P0 | **Risk:** 🔴 HIGH (statutory) | **Type:** Backend + UI | **Effort:** L

## Current State (Backend ⚠️ read-only → UI ❌)

`Apps/core-service/src/routes/operations.ts`:

| Method | Path | Line |
|---|---|---|
| GET | `/v1/police-reports` | ~673 |
| GET | `/v1/police-reports/:reportId` | ~767 |

Gateway proxies both at `Apps/api-gateway/src/routes/operations-routes.ts:167` (`GET` + `ALL /*`).

**There is no POST, PUT or PATCH anywhere, and no command handler.** The `/*` proxy will happily
forward a write to core-service, where nothing is registered to answer it. `police` does not occur
anywhere in `UI/`.

> The audit reported 2 endpoints and classified this as a UI gap. It is not: **there is no way to
> create a police report through any API.** Rows can only appear via direct SQL or seed data.

## Why This Is P0

Guest registration reporting to police / immigration authorities is a legal requirement in many
jurisdictions (e.g. Schengen states, India Form C, UAE, Thailand TM30) with statutory deadlines
measured in hours after check-in. A read-only view over a table nothing writes to is not a feature.

## Work Required

### 1. Backend write path — pick one and be consistent with COV-18

**Option A — HTTP routes on core-service (recommended, matches compliance.ts):**
- `POST /v1/police-reports` — create a report for a reservation / guest
- `PUT /v1/police-reports/:reportId` — correct a report before submission
- `POST /v1/police-reports/:reportId/submit` — mark as filed, capture authority reference + filed-at
- `POST /v1/police-reports/generate` — batch-generate from a business date's arrivals

**Option B — commands** (`statutory.police_report.create` / `.submit`) with schemas in
`schema/src/events/commands/`, a consumer case in core-service, and a catalog row with a claimed
target service. Heavier; only choose this if the audit trail must flow through the command bus.

Whichever is chosen, the existing `GET` shapes define the response contract — do not change them.

### 2. Read the actual schema first

The table backing these reads is under `schema/src/schemas/05-operations/`. The required fields are
jurisdiction-specific (passport number, visa, nationality, arrival/departure dates, address of
origin). Derive the write payload from the existing row type rather than inventing one, and confirm
which fields the reads already expose.

### 3. UI — `UI/pms-ui/src/app/features/compliance/police-reports/`

1. **Daily worklist** — arrivals for the business date with reporting status: not started / draft /
   submitted, and time remaining against the jurisdiction deadline.
2. **Report form** — prefilled from the reservation and guest profile; only the statutory fields
   that are missing require input.
3. **Submit action** — records authority reference; irreversible in UI.
4. **Batch generate** — one action per business date, mirroring how night audit is triggered.
5. **Overdue banner** — unsubmitted reports past deadline, surfaced on the dashboard.

### 4. Guest-data dependency

Passport / visa / nationality fields must exist on the guest profile before a report can be
complete. Verify coverage in `UI/pms-ui/src/app/features/guests/guest-detail/` — the compliance tab
already exists there and is the natural place to fill gaps.

## Acceptance

- A report can be created, corrected and submitted through the product, API-only end to end.
- Arrivals with no report for the business date are visible as a worklist, not discoverable only by
  querying the table.
- E2E coverage in `executables/test-accounts-realdata/` exercises create → submit.

## Cross-reference

- Blocked by / co-delivered with [18-write-path-gap.md](18-write-path-gap.md) — same root cause as
  COV-06, COV-08, COV-09, COV-13, COV-14, COV-16.
- Sibling statutory item: [01-compliance-breach-incidents.md](01-compliance-breach-incidents.md)
  (backend complete there — this one is not).
