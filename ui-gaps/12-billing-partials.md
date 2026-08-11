# COV-12: Billing — Endpoints Shipped Without Screens

**Priority:** P1 | **Risk:** 🟠 MEDIUM | **Type:** UI | **Effort:** M

> ## ✅ Approvals + flow-guard bypasses shipped 2026-08-11
>
> `UI/pms-ui/src/app/features/accounts/approvals/`, route `/approvals`, nav entry "Approvals", reusing
> the `billing` screen key (matches the endpoints' `MANAGER` minimum role, so no new seed).
>
> - **Pending queue** — operation, entity, requester, age, expiry countdown, required role. Requests
>   expiring within the hour are counted in a banner and marked in the row: a lapsed request has to be
>   raised again from scratch.
> - **Approve / reject / cancel**, with the operation payload rendered verbatim in the confirm step —
>   an approval given on a summary is not an approval of what will run.
> - **Reject requires a reason** (the API enforces a non-empty one); approve takes an optional note.
> - **Four-eyes mirrored in the UI.** I expected to find this unenforced and it is not:
>   `approval-service.ts` rejects a self-approval with `SELF_APPROVAL_FORBIDDEN`. The UI disables
>   Approve/Reject on your own request and offers Cancel instead, so the rule is visible rather than
>   discovered through an error.
> - **Flow-guard bypass log** — the `force`-override audit trail. **`flow_approvals` has 22 rows in the
>   dev database that nothing could read**, which is exactly the failure this spec described.
>
> **Corrected while building:** I first wrote the bypass table against guessed column names
> (`flow_id`, `justification`, `created_at`). The real shape from `flow-approval-repository.ts` is
> `flow_name`, `gate_name`, `reason_code`, `reason_notes`, `approved_at`, `role_at_approval` — a log
> rendering blanks because a field name was assumed would have been worse than no log. Fixed before
> the build.
>
> **Deferred:** the nav badge with a pending count. This spec argued a queue without one "is not
> checked", and that still holds — but it needs a shell-level poller rather than page-local state, so
> it is its own change. The count is on the page as a KPI tile meanwhile.
> Also deferred: the inline "settlement check bypassed by X" badge on the affected folio/reservation,
> which means touching those screens.
>
> **Verified:** `ng build` clean; E2E assertions added for both endpoints. **Not verified:** no
> live-stack run, and `approval_requests` is empty in dev (0 rows) so the queue has only been exercised
> against an empty list — the decision actions are untested against real data.

Billing is the best-covered area of the product, so what remains is specific rather than systemic.
Several of these are the **UI half of work already delivered on the backend** by recent PRs
(`#309` GL journal entries, `#310` gateway webhooks, `#311` flow guard).

**This spec does not re-open anything `accounts-gaps/` already owns.** Where an item is specced there,
it is listed and pointed at, not duplicated.

## Unwired endpoints

### Approvals / four-eyes — `Apps/billing-service/src/routes/approvals.ts` (6 endpoints)

| Method | Path |
|---|---|
| GET | `/v1/billing/approvals/pending` |
| GET | `/v1/billing/approvals/:id` |
| POST | `/v1/billing/approvals` |
| POST | `/v1/billing/approvals/:id/approve` |
| POST | `/v1/billing/approvals/:id/reject` |
| POST | `/v1/billing/approvals/:id/cancel` |

The backend for `accounts-gaps/08-approval-workflows.md` has landed; **the UI half has not.** An
approval queue nobody can see means privileged actions either block forever or the enforcement is
being bypassed.

**Work:** `features/accounts/approvals/` — a pending queue (requester, action, amount, age, reason),
detail with the full payload of the action awaiting approval, and approve / reject / cancel with a
mandatory comment. Surface the pending count in the shell nav; an approval queue without a badge is
not checked. Restrict to an approver role and enforce that requester ≠ approver in the UI as well as
the backend.

### Flow approvals — `Apps/billing-service/src/routes/flow-approvals.ts` (3 endpoints)

| Method | Path |
|---|---|
| GET | `/v1/billing/flow-approvals` |
| GET | `/v1/billing/flow-approvals/:entity_type/:entity_id` |
| POST | `/v1/billing/flow-approvals` |

This is the `force`-bypass audit record from the flow-guard work — when a guard is overridden, a row
lands here. Rows are being written (`folio_settlement_check`, `deposit_required_check`) and **nobody
can read them in the product**, which defeats the purpose of recording an override.

**Work:** a bypass log view — who overrode which guard, on which entity, when, with what
justification. Cheapest useful form is a filtered table plus an inline badge on the affected folio /
reservation showing "settlement check bypassed by X". Do the badge; the standalone table alone will
not be visited.

### GL batches & audit trail — `routes/finance-admin.ts` (5 endpoints)

`GET /v1/billing/gl-batches`, `…/:batchId/entries`, `…/:batchId/export.csv`, `…/:batchId/export.xml`,
`GET /v1/billing/audit-trail`.

**Already specced** — `accounts-gaps/24-ui-gl-viewer.md` (batches + entries + export) and
`accounts-gaps/23-ui-audit-log-viewer.md` (audit trail). Recorded here only as confirmation that the
backend now exists, so both are unblocked. Do not write a second spec.

### Billing reports — `routes/finance-admin.ts` (4 of 5 unwired)

`GET /v1/billing/reports/trial-balance`, `gl-trial-balance`, `tax-summary`, `commissions`.
Only `departmental-revenue` is in `report-defs.ts`.

**Work:** add them in [10-reports-coverage.md](10-reports-coverage.md)(b) with finance-role gating.
`gl-trial-balance` overlaps `trial-balance` — check whether both are meant to exist before wiring two
menu entries that disagree.

### Suspense items — `routes/ar.ts`

`GET /v1/billing/suspense-items` — unroutable charges parked for manual resolution.

**Blocked on `accounts-gaps/03-suspense-account.md`.** The read endpoint exists but the account
mechanics do not, so a screen would list an always-empty table. Sequence: ACCT-03 → this UI.

### Group billing summary — `routes/ar.ts`

`GET /v1/billing/groups/:groupId/summary`.

**Owned by `accounts-gaps/17-group-master-billing.md`.** `features/groups` exists and is wired; this
endpoint is the master-folio summary it does not yet show. Add it there, not as a new screen.

### Cashier shift summary — `Apps/housekeeping-service/src/routes/cashier.ts`

`GET /v1/billing/cashier-sessions/:sessionId/shift-summary` — the list and detail are wired, the
shift summary is not.

Note: `/v1/billing/cashier-sessions` and `…/:sessionId` are registered in **both**
`Apps/housekeeping-service/src/routes/cashier.ts` and `Apps/billing-service/src/routes/billing.ts` —
another duplicate surface (cf. COV-04, COV-07). Resolve ownership before adding the summary view;
housekeeping-service is the odd owner for a billing path.

**Work:** shift summary panel on cashier session close — opening float, transactions by method,
expected vs counted, variance, and the handover target. Pair with
[08-shift-handovers.md](08-shift-handovers.md) so a shift change is one flow.

### POS charges

The audit listed POS charges as a partial. There is no POS charge endpoint yet —
`accounts-gaps/05-pos-integration.md` owns building it. Nothing to wire.

## Acceptance

- Pending approvals and guard bypasses are visible in the product, with a nav badge for approvals.
- Every remaining item is either wired or explicitly assigned to its owning `accounts-gaps` spec.
- No duplicate spec exists for anything `accounts-gaps/` already covers.

## Cross-reference

`accounts-gaps/`: 03 (suspense), 05 (POS), 08 (approvals backend), 17 (group master billing),
23 (audit viewer), 24 (GL viewer). Plus [10-reports-coverage.md](10-reports-coverage.md) for the
billing reports.
