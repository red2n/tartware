# COV-02: Police / Statutory Guest Reporting — Read-Only Backend, No UI

**Priority:** P0 | **Risk:** 🟠 MEDIUM-HIGH (liability) | **Type:** Backend + UI | **Effort:** L

> ## ⚠️ This spec's premise was wrong — corrected 2026-08-11
>
> I wrote this assuming `/v1/police-reports` was **statutory guest-registration reporting** to police
> or immigration (Schengen, India Form C, UAE, Thailand TM30) with deadlines in hours after check-in.
> It is not. Reading `scripts/tables/07-analytics/75_police_reports.sql` and the row mapper shows a
> **police incident report register**: a crime reported to the police, with `agency_name`,
> `responding_officer_name`/`badge`, `police_case_number`, `incident_type`
> (theft / assault / vandalism / …), suspects, victims, witnesses, stolen property and loss value.
> It is the legal-evidence sibling of [06-incidents.md](06-incidents.md), which it links to via
> `incident_id` — not a statutory filing on a clock.
>
> So the "72-hour deadline", "arrivals worklist", "passport/visa fields" and "batch generate from a
> business date" work below **does not apply** and has not been built.
>
> **Guest-registration reporting remains a genuine, separate gap:** no table, no route and no schema
> anywhere in the repo. If Tartware sells into a jurisdiction that requires it, that is new work with
> its own spec — not this one.
>
> ## ✅ Shipped 2026-08-11 — what the register actually needed
>
> **Backend** (`Apps/core-service/src/routes/operations.ts`, `services/operations-service.ts`):
> - `POST /v1/police-reports` — file a report. `report_number` is generated server-side as
>   `PR-YYYYMMDD-XXXX`; it is `UNIQUE NOT NULL` and a caller-supplied value is how two reports end up
>   fighting over one identifier.
> - `PUT /v1/police-reports/:reportId` — correct a report. Every field optional, `COALESCE` keeps the
>   stored value, so a screen can send only what changed.
> - `POST /v1/police-reports/:reportId/status` — move status and record `police_case_number`,
>   lead investigator and follow-up. `investigation_ongoing` is derived from the status rather than
>   being a second field to keep in step.
>
> The suspects/victims/witnesses/evidence JSONB columns are deliberately **not** exposed yet: they
> want a dedicated editor, and guessing a shape now would be harder to change later than adding it
> when a screen needs it.
>
> **UI** — `UI/pms-ui/src/app/features/compliance/police-reports/`: list with status and type filters,
> file/correct form, status action, and a banner counting open reports with no police case number
> recorded (a report the force cannot trace back is the failure mode here). Route
> `compliance/police-reports` reusing the `compliance` screen key from COV-01 — same statutory area,
> same OWNER/ADMIN restriction — plus a nav entry.
>
> **Verified:** core-service typechecks; `ng build` compiles the template; the insert and status SQL
> were run against the real `police_reports` table (rolled back) to confirm the CHECK constraints and
> `report_status` transition. E2E assertions added for file → status → read-back.
> **Not verified:** no run against a live stack.

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
