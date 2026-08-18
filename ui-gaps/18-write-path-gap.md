# COV-18: Read-Only Domains Have No Write Path — Root Cause

**Priority:** P1 | **Risk:** 🟠 MEDIUM | **Type:** Backend | **Effort:** L

> ## ✅ Write mechanism decided 2026-08-11
>
> **The discriminator is not "audit significance" — it is cross-service reach.**
>
> This spec first proposed: reference data → HTTP, anything audit- or workflow-significant → commands.
> Building COV-01 and COV-02 showed that rule misclassifies its own examples. The breach register is
> about as audit-significant as this system gets, and it is plain HTTP on core-service
> (`compliance.ts`) — correctly, because the write touches one table in one service with no fan-out.
> Police reports are the same shape.
>
> **The rule, restated:**
>
> | Write has… | Mechanism | Examples |
> |---|---|---|
> | one owning service, one table, no fan-out | **HTTP routes on the owning service** | breach incidents, police reports, lost & found, companies, promo codes, booking sources, market segments, meeting rooms |
> | cross-service effects, or needs idempotent replay / DLQ | **command + consumer + catalog row**, with a gateway REST wrapper for ergonomics | reservations, guest consent, housekeeping tasks, OTA sync, anything touching inventory or money |
>
> Audit trail is not the tiebreak: an HTTP write can call `recordAuditLog` just as a command handler
> does. Idempotency and replay are what the command bus actually buys, and a single-table register
> does not need them.
>
> **Applied so far:** COV-01 (existing HTTP write path, UI only) and COV-02 (three new HTTP routes on
> core-service). Remaining domains in the table below inherit the rule — no per-domain re-litigation.
>
> ### ✅ Items 2 and 3 closed 2026-08-13
>
> **The misleading `ALL /*` proxies are gone.** An audit of every wildcard proxy against its target's
> write registrations found **13 advertising a write surface nothing implements**: allotments, meeting
> rooms, event bookings, banquet orders, waitlist, group bookings, ota-connections, channel mappings,
> metasearch, dashboard, maintenance, cashier sessions and revenue.
>
> They fall into three groups and the fix is the same for all: **register `app.get`**, so an
> unsupported method is refused at the edge with a plain "no such route" instead of passing gateway
> auth and tenant scoping only to 404 inside a service.
>
> | Group | Domains |
> |---|---|
> | Writes go through the command bus (correct) | waitlist, group bookings, channel mappings, metasearch, maintenance, cashier sessions, revenue |
> | No write path built yet | allotments, meeting rooms, event bookings, banquet orders |
> | Read-only by nature | dashboard, ota-connections (a projection of `channel_mappings`) |
>
> **Guardrail:** `Apps/api-gateway/tests/wildcard-write-conformance.test.ts` — a wildcard may use
> `app.all` only if its target registers at least one write under that prefix. This closes the blind
> spot the proxy-conformance test leaves open by design: it skips wildcards, which is exactly where
> writes were being swallowed. Verified to fail by reverting one route and watching it catch it.
>
> ### ✅ The one-directional guardrail is closed — 2026-08-18
>
> It scans `app.all(...)` registrations only. So it catches **`app.all` with no downstream write**
> (a phantom write surface) but is blind to the converse: **a downstream write with only `app.get`
> at the gateway**. In that state PUT/DELETE are refused at the edge with "no such route" while the
> service implements them perfectly — the write is swallowed exactly as before, just one layer up.
>
> Found while building COV-13's meeting-room slice: reverting the gateway wildcard from `app.all`
> back to `app.get` left all 26 gateway tests green, with `PUT /v1/meeting-rooms/:roomId` dead.
>
> **Consequence for the remaining domains** (allotments, event bookings, banquet orders): the
> 2026-08-13 sweep demoted all 13 wildcards to `app.get`, so every one of them now needs its gateway
> registration promoted back to `app.all` *in the same commit* as its service write.
>
> **The converse check now enforces that pairing**, added 2026-08-18 as a second `describe` block in
> `Apps/api-gateway/tests/wildcard-write-conformance.test.ts`: for every wildcard the gateway proxies,
> each write its target implements under that prefix must have a gateway registration that accepts
> **that method**. Method-awareness is the load-bearing part — the first draft treated "some write
> method is registered on the prefix" as coverage, and demoting `app.post` while `app.patch` and
> `app.delete` remained slipped straight past it. Both directions were verified by reintroducing a
> regression and watching the suite fail.
>
> **It found two live strandings on its first run, both now fixed:**
>
> | Prefix | Stranded | Impact |
> |---|---|---|
> | `/v1/billing/*` | 7 POSTs + 1 PATCH + 1 DELETE in billing-service | **User-facing.** COV-12's approvals screen listed pending requests correctly, but every Approve / Reject / Cancel button issued `POST /v1/billing/approvals/:id/:action` into a gateway that registered only `app.get` for the prefix — "no such route". The screen shipped 2026-08-11 with dead actions. |
> | `/v1/guests/*` | 2 PUTs (CCPA opt-out, communication preferences) | Latent — MANAGER-gated privacy writes with no UI caller yet. |
>
> Gateway registrations were added for **exactly the methods each service implements** — POST/PATCH/DELETE
> for billing, PUT only for guests. Adding the rest would recreate the phantom-write surface the sibling
> check guards against. The billing wildcard takes `minRole: "STAFF"`, the least restrictive role any of
> those routes accepts; billing-service still enforces MANAGER on approve/reject, so the gateway does
> coarse scoping and the service does fine-grained authz.
>
> **A false positive worth recording:** `/v1/room-types/*` looked stranded until the check learned that a
> wildcard is commonly registered once per method (`app.get` + `app.put` + `app.patch` + `app.delete`)
> rather than as one `app.all`. Those writes were always reachable.
>
> **`UNIMPLEMENTED` is down from 7 to 4** — `compliance.breach.report`, `.notify` and
> `operations.incident.report` were deleted rather than implemented, because each described a write
> that already exists as plain HTTP on the owning service. The remaining four
> (`analytics.metric.ingest`, `analytics.report.schedule`, `operations.asset.update`,
> `operations.inventory.adjust`) are genuinely unbuilt and want a product decision.
>
> **Still open:** item 4 — per-domain writes for the three domains that have none.
> [13](13-sales-catering.md) decided **build** on 2026-08-17 and shipped meeting-room writes, so
> event bookings and banquet orders are unblocked and queued behind it; allotments is
> [16](16-booking-reference-data.md)'s, pending the availability-guard call.

> ### ✅ Maintenance write path shipped 2026-08-18
>
> `operations.maintenance.*` was the textbook case for this spec's rule, and the first write path built
> after the converse guardrail existed. Four handled commands with no dispatcher, two GETs, and a
> demoted `app.get` wildcard. All four writes touch `maintenance_requests` in one service with no
> fan-out, so they were built as **HTTP on housekeeping-service** — matching the
> `operations.incident.report` deletion of 2026-08-13 rather than adding a fifth gateway command wrapper.
>
> The gateway wildcard was promoted from `app.get` to `app.get` + `app.post` **in the same change** as
> the service writes. That is exactly the pairing this spec warned "no test will remind you" about, and
> the converse check now does: reverting the gateway registration names all four stranded writes.
>
> Remaining domains with no write path: allotments ([16](16-booking-reference-data.md)), event bookings
> and banquet orders ([13](13-sales-catering.md)).

> ### Related defect found 2026-08-11: `SELECT x.*` in every `*_BY_ID_SQL`
>
> While fixing COV-02 I hit a 400 from `getPoliceReportById`: `POLICE_REPORT_BY_ID_SQL` used
> `SELECT pr.*`, which does not carry the computed `INITCAP(REPLACE(...)) as x_display` labels that its
> row mapper's schema **requires**. The query returned rows its own parser rejected.
>
> The same pattern held in **five more** by-id queries in
> `Apps/core-service/src/sql/operations-queries.ts` — `cs.*`, `sh.*`, `lf.*`, `beo.*`, `gf.*`. Each
> `*_LIST_SQL` lists columns explicitly and computes the display labels; each `*_BY_ID_SQL` starred
> them and omitted the labels. So these five detail endpoints throw on any real row:
>
> - `GET /v1/cashier-sessions/:sessionId` (core-service)
> - `GET /v1/shift-handovers/:handoverId` — [08](08-shift-handovers.md)
> - `GET /v1/lost-and-found/:itemId` (core-service copy) — [07](07-lost-and-found.md)
> - `GET /v1/banquet-orders/:beoId` — [13](13-sales-catering.md)
> - `GET /v1/guest-feedback/:feedbackId` — [09](09-guest-feedback.md)
>
> All six now reuse their list query's explicit column set, keeping each by-id's own WHERE clause.
> **This is the same root cause as the write-path gap:** an endpoint nothing calls is an endpoint whose
> defects nobody sees. Every domain in the table below has a by-id read that has never returned a row,
> so assume the same class of breakage until each is exercised with data.
>
> A star select is also against the convention in that file — every other query there lists columns.

**This is the systemic finding the coverage audit did not make.** Seven of the sixteen "no UI presence"
domains are not UI gaps at all: **there is no way to create the data through any API.** A screen cannot
be built over them without backend work first, and the same decision would otherwise be re-litigated
seven times.

## The Pattern

Domain implemented as: a schema file, a table, `GET` list + `GET` by id in a service, and a gateway
proxy pair (`GET` + `ALL /*`). No `POST`, no `PUT`, no `PATCH`, no `DELETE`, no command handler.

The `ALL /*` proxy makes this worse than an absent endpoint: `POST /v1/allotments` passes gateway auth
and tenant scoping, then 404s at core-service. The gateway's OpenAPI document advertises a write surface
the system does not have — the same defect class as the eight 404-ing report proxies in
[10-reports-coverage.md](10-reports-coverage.md)(a).

## Affected Domains

| Domain | Reads | Writes | Owner spec |
|---|---|---|---|
| `/v1/police-reports` | 2 | **0** | [02](02-police-reports.md) — statutory, P0 |
| `/v1/incidents` | 2 | **0** | [06](06-incidents.md) — validator exists, handler does not |
| `/v1/shift-handovers` | 2 | **0** | [08](08-shift-handovers.md) |
| `/v1/guest-feedback` | 2 | **0** | [09](09-guest-feedback.md) |
| `/v1/banquet-orders` | 2 | **0** | [13](13-sales-catering.md) |
| `/v1/meeting-rooms`, `/v1/event-bookings` | 4 | **0** | [13](13-sales-catering.md) |
| `/v1/ota-connections` | 2 | **0** (4 commands exist) | [14](14-channel-distribution.md) |
| `/v1/booking-sources`, `/v1/market-segments` | 4 | **0** | [14](14-channel-distribution.md) |
| `/v1/channel-mappings` | 2 | command only | [14](14-channel-distribution.md) |
| `/v1/metasearch-configs` | 3 | commands only | [14](14-channel-distribution.md) |
| `/v1/allotments` | 2 | **0** | [16](16-booking-reference-data.md) |
| `/v1/companies` | 2 | **0** | [16](16-booking-reference-data.md) |
| `/v1/promo-codes` | 2 + validate | **0** | [16](16-booking-reference-data.md) |
| `/v1/waitlist` | 2 | duplicate — writes live in reservations | [16](16-booking-reference-data.md) |
| `/v1/group-bookings` | 2 | duplicate — `group.*` commands exist | [16](16-booking-reference-data.md) |

`/v1/lost-and-found` is the counter-example: full CRUD in housekeeping-service. It shows the intended
end state and is the template to copy ([07](07-lost-and-found.md)).

## Related: 7 catalogued commands with no handler

`Apps/command-consumer-utils/tests/flow-command-catalog.test.ts` already tracks these in its
`UNIMPLEMENTED` set:

`analytics.metric.ingest`, `analytics.report.schedule`, `operations.incident.report`,
`operations.asset.update`, `operations.inventory.adjust`, `compliance.breach.report`,
`compliance.breach.notify`

Each has a payload schema and a registered validator in `schema/src/command-validators.ts`, so the
gateway will accept and dispatch them — and every consumer silently skips them: no error, no DLQ entry.
The test's own comment is the rule to follow: an entry means "not built yet", and a command with a
handler must never appear in the list.

Note `compliance.breach.report` / `.notify` are **not** blocking — core-service already implements the
HTTP write path for breach incidents ([01](01-compliance-breach-incidents.md)). Those two rows are
redundant and are candidates for deletion, not implementation.

## The Decision to Make Once

**Which write mechanism does a new domain use?** The codebase currently does all three:

| Mechanism | Example | When |
|---|---|---|
| HTTP routes on the owning service | `compliance.ts`, `lost-and-found.ts`, `dunning-rules.ts` | Reference data, low velocity, no cross-service effects |
| Command + consumer + catalog row | `housekeeping.task.*`, `reservation.*` | Anything with side effects, audit requirements, or cross-service fan-out |
| Command + gateway REST wrapper | `reservation.check_in` via `POST …/check-in` | Command semantics with an ergonomic REST surface for the UI |

**Recommendation:** reference-data domains (companies, promo codes, booking sources, market segments,
meeting rooms) get plain HTTP CRUD on the owning service. Domains with audit or workflow significance
(police reports, incidents, shift handovers, guest feedback, event bookings, BEOs, allotments,
OTA connections) get commands with gateway wrappers, because they need the audit trail and the
idempotency the command bus already provides.

Record the decision here and apply it consistently. Nine domains done nine ways is a worse outcome than
either mechanism chosen uniformly.

## Work Required

1. **Record the mechanism decision** (above) with a date.
2. **Delete the misleading gateway `ALL /*` proxies** for every domain with no downstream write handler,
   or implement the writes. Do not leave a proxy advertising a capability that 404s.
3. **Add the proxy-conformance test** from [10](10-reports-coverage.md)(a): for every non-wildcard
   gateway route proxying to service X, assert X registers that path and method. This catches both this
   gap class and the report 404s, and prevents recurrence.
4. **Deliver write paths in the owner specs**, prioritised there — not all at once here. This spec owns
   the decision and the guardrail; the domain specs own the code.
5. **Resolve the four duplicate surfaces** found while verifying this audit, since each is a write-path
   question too:
   - `/v1/lost-and-found` in core-service **and** housekeeping-service ([07](07-lost-and-found.md))
   - `/v1/billing/accounts-receivable` vs `/v1/billing/ar/*` ([04](04-duplicate-ar-surface.md))
   - `/v1/direct-booking` vs `/v1/self-service` ([15](15-booking-engine-duplication.md))
   - `/v1/billing/cashier-sessions` in billing-service **and** housekeeping-service
     ([12](12-billing-partials.md))
   - plus `/v1/waitlist` and `/v1/group-bookings` vs their reservations equivalents
     ([16](16-booking-reference-data.md))

## Acceptance

- Write mechanism decided and recorded.
- No gateway route advertises a write with no downstream handler; a test enforces it.
- `UNIMPLEMENTED` in `flow-command-catalog.test.ts` is empty, or every remaining entry has a dated
  decision to implement or delete.
- Each affected domain's owner spec either has a write path or a recorded decision to retire.

## Cross-reference

Blocks the UI half of: [02](02-police-reports.md), [06](06-incidents.md), [08](08-shift-handovers.md),
[09](09-guest-feedback.md), [13](13-sales-catering.md), [14](14-channel-distribution.md),
[16](16-booking-reference-data.md). Related guardrail: [10](10-reports-coverage.md)(a),
[17](17-command-reachability.md).
