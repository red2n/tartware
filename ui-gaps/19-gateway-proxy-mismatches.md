# COV-19: Gateway Routes Whose Downstream Handler Does Not Exist

**Priority:** P0 (items 1–2) / P2 (rest) | **Risk:** 🔴 HIGH | **Type:** Bug | **Effort:** S–M

Found by the conformance test added for [10-reports-coverage.md](10-reports-coverage.md)(a)
(`Apps/api-gateway/tests/proxy-route-conformance.test.ts`), which checks all 127 proxied gateway
routes, not just reports. Eight were found; the remainder are held in that test's
`KNOWN_MISMATCHES` allowlist. **The allowlist must only shrink** — remove an entry as it is fixed.

**Status: closed 2026-08-11**, but only after a live run. All eight path mismatches fixed;
`KNOWN_MISMATCHES` is empty and the conformance test asserts all 127 proxied routes resolve
downstream.

> ### ⚠️ Static verification was not enough — what the E2E run then found
>
> The conformance test proves a path *resolves*. It cannot prove the handler *works*. Making these
> routes reachable exposed four bugs in code that had never executed:
>
> 1. **`gdpr-export` returned 500, and always would have.** Four wrong column references in
>    `gdpr-export-service.ts`: `adults`/`children` (real: `number_of_adults`/`number_of_children`),
>    `booking_source` (real: `source`), `gdpr_consent_logs.guest_id` (real: `subject_id`), and
>    `loyalty_point_transactions.id` plus `in_app_notifications.id/channel/subject/status/sent_at` —
>    that table has none of those. **The 404 this spec fixed was masking a 500.** The DSAR export had
>    never worked in any environment.
> 2. **`POST /v1/police-reports` 404'd at the gateway.** `ALL /v1/police-reports/*` does not match the
>    bare path — Fastify's wildcard requires a further segment. A working core-service handler was
>    unreachable. Fixed by declaring the bare `POST`.
> 3. **Body-scoped writes were rejected outright.** These proxies resolved the tenant from the query
>    only, and `withTenantScope` refuses any request it cannot scope, so every write carrying
>    `tenant_id` in the body was refused before reaching core-service — **including COV-01's
>    breach-incident POST, which this backlog had already recorded as shipped.** Fixed with one shared
>    query-or-body resolver in `operations-routes.ts`.
> 4. **`getPoliceReportById` returned rows its own schema rejected** — `SELECT pr.*` omits the computed
>    `report_status_display` the row mapper requires. Invisible while the table was empty.
>
> Plus a Postgres type-inference error: `report_status = $3` alongside `$3 IN (…)` deduces two types for
> one parameter and rejects the statement. Both uses now cast `::text`.
>
> **Verified live after the fixes:** DSAR export 200 with real data (1 reservation, 9 payment
> transactions); consent round-trip 202 → `{"marketing_email":true,"analytics":false}`; police report
> POST 201 and status POST 200 with case number and derived `investigation_ongoing`.
>
> **The lesson for the rest of this backlog:** "typechecks + builds + a conformance test" is not
> evidence a path works. Every remaining spec that says *verified* on that basis should be treated as
> unproven until it has been exercised against a running stack.

## This corrects the audit's headline

The coverage audit reported "no broken wiring found — all 178 UI calls resolve to a route that
exists." That is true and it is not sufficient: it verified **UI → gateway**, never
**gateway → downstream service**. Two of the eight are called by `pms-ui` right now and 404 for real
users.

## 1. Guest GDPR export — ✅ fixed 2026-08-11

`UI/pms-ui/src/app/features/guests/guest-detail/guest-detail.ts:432` calls
`GET /v1/tenants/:tenantId/guests/:guestId/gdpr-export` (built by `guestUrl()` at line 311). The
gateway registers it and proxies to guests-service, which registers
**`/v1/guests/:guestId/gdpr-export`** (`Apps/guests-service/src/routes/privacy.ts:145`) — no tenant
prefix. Every click on "export guest data" 404s and shows "Failed to export guest data".

This is a GDPR Art. 15 data-subject access request path. It is the same class of statutory exposure as
[01-compliance-breach-incidents.md](01-compliance-breach-incidents.md), except here the product
appears to support it and silently does not.

**Fixed the other way round from what this spec first proposed.** Aligning guests-service to the
tenant-scoped shape looked right until the split became clear: in this codebase **reads are
`/v1/guests/…` scoped by a `tenant_id` query, and writes are `/v1/tenants/:tenantId/guests/:guestId/…`
dispatching a command.** Every other proxied guest read already follows the read shape; the two broken
routes were the only proxied reads using the write shape. So the gateway route became
`GET /v1/guests/:guestId/gdpr-export` with `tenantScopeFromQuery`, and the UI now builds read URLs
through a separate `guestReadUrl()` helper alongside the existing `guestUrl()` for writes — the shapes
are different and the code now says so.

New `guestIdParamsSchema` and `tenantQuerySchema` in `Apps/api-gateway/src/routes/schemas.ts` document
the params.

## 2. Guest consent ledger — ✅ fixed 2026-08-11

`guest-detail.ts:515` reads `GET …/guests/:guestId/consent` and `:527` writes it.

- **Read:** the gateway proxies to guests-service, which has **no consent route at all**. 404.
- **Write:** the gateway does *not* proxy — it dispatches `guest.consent.update`
  (`Apps/api-gateway/src/routes/guest-routes.ts:354`). **No consumer handles that command anywhere in
  `Apps/`.** It is accepted, returns 202, and is silently skipped — no error, no DLQ entry. The user
  sees success and nothing is recorded.

The consent ledger is the record of what a guest agreed to for marketing, analytics and third-party
sharing. A UI that reports success while storing nothing is worse than no UI. Worse still, the read
failure was invisible: `loadConsent()` swallows its error as "consent ledger optional", so the screen
showed empty toggles and saves that looked successful.

**Fix, as shipped:**

- **Read** — `GET /v1/guests/:guestId/consent` in `Apps/guests-service/src/routes/privacy.ts`, backed
  by `getGuestConsentLedger()`. The four ledger toggles turned out to map exactly onto `consent_type`
  values the `gdpr_consent_logs` CHECK constraint already allows (`marketing_email`, `marketing_sms`,
  `analytics`, `third_party_sharing`), so no schema change was needed — the table was designed for
  this. The ledger is the most recent **active** row per type, so a withdrawal reads back as `false`
  rather than vanishing.
- **Write** — `updateGuestConsent()` in `privacy-service.ts`, called by
  `updateGuestConsentDecision()` in `guest-command-service.ts`, wired as
  `case "guest.consent.update"` in the guests consumer. Consent is **append-only**: each decision
  inserts a row and marks the previous one `is_active = false` with `superseded_by_consent_id`, never
  updating in place — the log is the Art. 7(1) evidence of what was agreed and when. `withdrawal_date`
  lands on the row that records the withdrawal. `guests.marketing_consent` is kept in step with the
  email toggle, since notification sends read that flag.
- **Contract** — `GuestConsentUpdateCommandSchema` in `schema/src/events/commands/guests.ts`, a
  validator registration, and a catalog row in
  `scripts/tables/01-core/10_command_center.sql` naming `guests-service`. All six checks in
  `flow-command-catalog.test.ts` pass, which is what proves the command is now dispatchable *and*
  handled.
- **Tests** — `schema/tests/guest-consent-command.test.ts` pins the payload contract (partial updates
  legal, empty decision rejected, `updated_at` not caller-writable). The E2E suite now asserts the
  full round trip — read ledger, dispatch a consent change, read it back, then export — with strict
  assertions rather than the 404-tolerant sweep.

## 3. `/v1/availability*` — ✅ fixed 2026-08-11

`Apps/api-gateway/src/routes/room-routes.ts:399, 412, 425` proxy to rooms-service:

| Gateway path | rooms-service |
|---|---|
| `GET /v1/availability` | only `/v1/rooms/availability` exists |
| `GET /v1/availability/calendar` | nothing |
| `GET /v1/availability/room-types` | nothing |

No UI caller: both front-ends use `/rooms/availability` (`create-reservation.ts`,
`reservation-detail.ts`, `groups.ts`, `room-detail.ts`, guest-portal `search.ts`). The E2E sweep *did*
call all three — and passed them as `HTTP=404`.

**Fixed:** all three deleted, replaced by one explicit `GET /v1/rooms/availability` under the same ARI
tag. That endpoint was already working but reached rooms-service through the undeclared `/v1/rooms/*`
catch-all, so the availability tag now documents the endpoint that exists instead of three that never
did. The three sweep entries collapse into one against the real path.

## 4. Cashier shift summary — ✅ fixed 2026-08-11

`GET /v1/billing/cashier-sessions/:sessionId/shift-summary` is proxied to **billing-service**
(`billing-routes.ts`) but implemented in **housekeeping-service**
(`Apps/housekeeping-service/src/routes/cashier.ts`).

Note the related duplication: `/v1/billing/cashier-sessions` and `…/:sessionId` were registered in
*both* services, so the list and detail worked while the summary did not.

**Ownership resolved: billing-service**, on two independent signals — the command catalog routes
`billing.cashier.open/close/handover` to `billing-service`, and the gateway already proxies all three
cashier reads there. The housekeeping-service copy was unreachable through the gateway either way.

**Fixed:** `SHIFT_SUMMARY_SQL` and `getShiftSummary` moved into billing-service
(`sql/billing-queries.ts`, `services/billing-service.ts`) and the route registered in
`routes/billing.ts`; housekeeping-service's `routes/cashier.ts`, `services/cashier-service.ts` and
`sql/cashier-queries.ts` deleted along with their `server.ts` registration. The ported SQL was run
against a real `cashier_sessions` row to confirm it still returns the reconciliation figures.

**Left in place, and worth its own item:** housekeeping-service's command consumer still has
`billing.cashier.open`, `.close` and `.handover` cases. The catalog targets billing-service, so those
handlers can never fire — dead write-path code, and a different risk class from the read routes fixed
here. Deleting them means first confirming billing-service's implementations are the ones in use.
Note also that the two services returned *different shapes* for the same path (billing returns raw
rows; housekeeping mapped them to `CashierSessionListItem` with display fields) — the UI consumes
billing's shape, which is the one the gateway has always served.

The shift-summary panel in [12-billing-partials.md](12-billing-partials.md) is now unblocked.

## 5. `ALL /v1/auth` and `ALL /v1/settings` — ✅ fixed 2026-08-11

core-service owns the sub-paths (`/v1/auth/login`, `/v1/auth/context`, `/v1/settings/values`, …) but
not the bare path. The sibling `/*` registrations carry all real traffic, so nothing was broken; the
bare routes 404'd while appearing in the OpenAPI document as endpoints.

**Fixed:** both bare registrations deleted, `/*` catch-alls kept — the auth one retains its stricter
rate limit. The E2E sweep's `SYS settings` smoke now hits `/v1/settings/values` instead of the bare
path it was passing as a 404.

## Acceptance

- ~~GDPR export and the consent ledger work from the guest detail screen, and `guest.consent.update`
  has a handler.~~ ✅ done; verified by typecheck, the schema contract test, the catalog conformance
  suite, and the consent SQL run against a real `gdpr_consent_logs` row (insert → supersede →
  projection, inside a rolled-back transaction).
- ~~`KNOWN_MISMATCHES` in `proxy-route-conformance.test.ts` is empty.~~ ✅ empty.
- ~~No gateway route advertises a path its target service does not register.~~ ✅ enforced in CI
  across all 127 proxied routes.
- **Not yet verified:** none of this has run against a live stack — the services were down. Run
  `executables/test-accounts-realdata/test-multi-tenant.sh` and confirm the new assertions pass:
  five under "GDPR Consent & Subject Access", two for the cashier shift summary, and the corrected
  `rooms-availability` / `SYS settings values` sweep entries.

## Follow-up opened by this work

`billing.cashier.*` handlers in housekeeping-service's command consumer are dead code (see item 4).
The mirror of this whole spec — a *command* with a handler nobody routes to — belongs with
[17-command-reachability.md](17-command-reachability.md)'s classification pass.

## Cross-reference

- [10-reports-coverage.md](10-reports-coverage.md)(a) — same defect class; the test came from there.
- [18-write-path-gap.md](18-write-path-gap.md) — the `ALL /*` proxies that advertise writes with no
  downstream handler are the same problem seen from the write side.
- [12-billing-partials.md](12-billing-partials.md) — cashier ownership.
- [17-command-reachability.md](17-command-reachability.md) — `guest.consent.update` is a command with
  a *caller* and no *handler*, the mirror image of the 108 with handlers and no callers.
