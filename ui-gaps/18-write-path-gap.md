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
> **Still open:** deleting or implementing the misleading `ALL /*` gateway proxies for domains that
> still have no writes, and the `UNIMPLEMENTED` catalog rows. Note two of those rows
> (`compliance.breach.report` / `.notify`) are now definitively redundant: the HTTP path is the live
> one, so they should be **deleted**, not implemented.

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
