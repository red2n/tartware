# COV-01: Data-Breach Register & Regulator Notification — No UI

**Priority:** P0 | **Risk:** 🔴 HIGH (statutory) | **Type:** UI only | **Effort:** M

> ## ✅ Shipped 2026-08-11
>
> `UI/pms-ui/src/app/features/compliance/breach-incidents/` — list, report form, detail panel and the
> notify action, wired to all four existing endpoints. Route `compliance/breach-incidents` behind
> `screenGuard("compliance")`, nav entry "Data breach register", and a `compliance` screen key seeded
> for OWNER/ADMIN only (MANAGER/STAFF/VIEWER excluded, like `settings`) in
> `scripts/tables/01-core/22_role_screen_permissions_seed.sql`. `ng build` compiles the template and
> the chunk is emitted; the screen key is seeded into the running dev DB.
>
> **The 72-hour clock is the server's.** `notification_deadline` already comes back on the list rows
> from `data_breach_incidents`, so the UI renders and sorts against it rather than recomputing from
> `discovered_at` — overdue incidents sort to the top, are counted in a banner above the table, and are
> badged in the row.
>
> **Correction 2026-08-11 (after the live run):** the breach-report POST **did not work** as first
> shipped. The gateway's `ALL /v1/compliance/breach-incidents` resolved the tenant from the query only,
> and this screen sends `tenant_id` in the body, so `withTenantScope` refused the request before
> core-service saw it. Fixed by the shared query-or-body resolver — see
> [19-gateway-proxy-mismatches.md](19-gateway-proxy-mismatches.md). The original "shipped" note below
> was based on typecheck + build alone, which could not have caught this.
>
> **Not verified:** no run against a live stack (services down). Worth a look when they are up: the
> `/v1/compliance/breach-incidents` routes in `Apps/core-service/src/routes/compliance.ts` declare no
> `withTenantScope` preHandler — tenant scoping is enforced at the gateway
> (`operations-routes.ts:194`), unlike `guests-service/src/routes/privacy.ts`, which scopes in the
> service too. Calling core-service directly would not be scoped. Worth confirming and, if real,
> raising as its own item.

## Current State (Backend ✅ → UI ❌)

`Apps/core-service/src/routes/compliance.ts` implements the full breach lifecycle:

| Method | Path |
|---|---|
| GET | `/v1/compliance/breach-incidents` (list, filterable) |
| GET | `/v1/compliance/breach-incidents/:incidentId` |
| POST | `/v1/compliance/breach-incidents` (report a breach) |
| PUT | `/v1/compliance/breach-incidents/:incidentId/notify` (regulator notification) |

Proxied by the gateway at `Apps/api-gateway/src/routes/operations-routes.ts:194` (`ALL` + `/*`).
Payload schemas exist in `schema/src/events/commands/compliance.ts`
(`ComplianceBreachReportCommandSchema`, `ComplianceBreachNotifyCommandSchema`) with severity,
breach type, affected data categories, affected systems and subject counts.

**The word `compliance` occurs in `UI/` only in the guest-detail tab and a PCI-DSS settings
description — neither touches these endpoints.** There is no screen, route, or service client.

> The audit reported "0 / 7 endpoints". The real surface is **4 endpoints**; 7 counted the gateway
> `ALL` + `/*` proxy pair. The conclusion is unchanged: none are reachable.

## Why This Is P0

GDPR Art. 33 requires notification to the supervisory authority **within 72 hours** of becoming
aware of a personal-data breach. The backend can record and notify; a human being cannot, because
there is no way to reach it outside of curl. A statutory clock with no operator-facing entry point
is the same as not having the capability.

## Work Required

### UI — `UI/pms-ui/src/app/features/compliance/breach-incidents/`

1. **List view** — columns: title, severity, breach type, discovered at, subjects affected,
   notification status. Filters: severity, breach type, notified / not notified, date range.
2. **Report form** — mirror `ComplianceBreachReportCommandSchema` exactly: title, description,
   severity (`low | medium | high | critical`), breach type (9-value enum), discovered at,
   occurred at, data categories affected (multi), systems affected (multi), subjects affected count.
3. **Detail view** — full record plus a prominent **72-hour countdown from `discovered_at`**.
4. **Notify action** — calls `PUT …/notify`; capture regulator reference and notified-at, and make
   the action irreversible in the UI (it is a legal filing).
5. **Overdue indicator** — any un-notified incident past 72 h since discovery surfaces at the top of
   the list and on the dashboard.

### Routing & permissions

- New screen module id (see how `settings-screen-permissions.ts` registers screens) restricted to
  a compliance/DPO role — not general STAFF.
- The gateway proxy uses `tenantScopeFromQuery`; the UI must pass `tenant_id`.

### Not required

`compliance.breach.report` / `compliance.breach.notify` appear in the command catalog but are in the
`UNIMPLEMENTED` set in `Apps/command-consumer-utils/tests/flow-command-catalog.test.ts` — **no
consumer handles them**. Do not dispatch these commands. The HTTP write path above is the live one.
Either drop those two catalog rows or leave them; that is COV-18's call, not a blocker here.

## Acceptance

- A staff user can file a breach, see it listed, open it, and record regulator notification without
  leaving the product.
- An un-notified incident older than 72 h is visibly flagged.
- Screen permission denies the role that should not see it.

## Cross-reference

Independent of `accounts-gaps/`. Related: [02-police-reports.md](02-police-reports.md) is the other
statutory reporting obligation, and it does **not** have a working write path.
