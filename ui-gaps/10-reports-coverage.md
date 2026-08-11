# COV-10: Reports — 8 Unwired, and 8 Gateway Endpoints That 404

**Priority:** P1 | **Risk:** 🟠 MEDIUM (a) / 🟡 LOW (b) | **Type:** Bug + UI | **Effort:** S–M

This spec has two halves. **(a) is a live defect** and should ship first; (b) is the cheapest
coverage win in the backlog.

**Status: (a) fixed 2026-08-11.** Four paths aligned with core-service, four unimplemented routes
removed, E2E sweep corrected, and `Apps/api-gateway/tests/proxy-route-conformance.test.ts` added so
the class of bug cannot recur. That test found 8 more mismatches elsewhere in the gateway, two of them
live user-facing 404s — see [19-gateway-proxy-mismatches.md](19-gateway-proxy-mismatches.md). **(b) done 2026-08-11** — 7 of the 8 unwired
core reports added to `report-defs.ts`: vip-arrivals, pace, market-segment-production,
guest-statistics, maintenance-sla, performance, revenue-forecast. Each query contract was read off the
route's Fastify schema rather than assumed (`performance` and `revenue-forecast` take a date range,
`guest-statistics` takes none). `audit-trail` is deliberately left out — `accounts-gaps/23-ui-audit-log-viewer.md`
specs a proper viewer, and a generic table would pre-empt it. The 4 unwired `/v1/billing/reports/*`
entries remain, gated on the finance-role question in [12-billing-partials.md](12-billing-partials.md).


> ### What the renames then exposed (2026-08-11 live runs)
>
> Making these paths resolve turned two of them from 404 into **500**, in SQL that had never executed:
>
> - **`/v1/reports/flash`** — `column "group_id" does not exist`; the reservations column is
>   `group_booking_id`.
> - **`/v1/reports/housekeeping-productivity`** — `invalid input value for enum housekeeping_status:
>   "COMPLETED"`. `housekeeping_tasks.status` is the room-cleanliness enum
>   (`CLEAN, DIRTY, INSPECTED, IN_PROGRESS, DO_NOT_DISTURB`); the report filtered on `COMPLETED`,
>   `PENDING` and `ASSIGNED`, none of which are members. Corrected to the vocabulary the writer uses —
>   `housekeeping-command-service.ts:116` treats CLEAN/INSPECTED as done.
>
> **The 500s also took out six unrelated endpoints.** Repeated failures tripped the gateway's circuit
> breaker (`circuit open — rejecting proxy request`), so properties, reservations, reservations-list,
> reservations-grid, modules and webhooks all returned 503. One bad report query looked like a
> platform outage — worth knowing when triaging a wall of 503s.
>
> Both fixed. Counting the DSAR export and the police-report by-id query, that is **four** endpoints
> where a reachability fix revealed a wrong column or enum name underneath.
---

## (a) BUG — 8 gateway report endpoints proxy to core-service paths that do not exist

`Apps/api-gateway/src/routes/reporting-routes.ts` registers these and forwards them to core-service
via `proxyCore`:

| Gateway path | core-service handler | Nearest real core route |
|---|---|---|
| `/v1/reports/no-show` | ❌ none | `/v1/reports/no-shows` (plural) |
| `/v1/reports/forecast` | ❌ none | `/v1/reports/demand-forecast` |
| `/v1/reports/manager-flash` | ❌ none | `/v1/reports/flash` |
| `/v1/reports/housekeeping-status` | ❌ none | `/v1/reports/housekeeping-productivity` |
| `/v1/reports/revenue-summary` | ❌ none | `/v1/reports/revenue-kpis`? |
| `/v1/reports/daily-revenue` | ❌ none | — |
| `/v1/reports/str-metrics` | ❌ none | — |
| `/v1/reports/night-audit-summary` | ❌ none | — |

Verified: `grep -rn '"/v1/reports/<name>"' Apps/core-service/src` returns 0 for all eight.

**Any caller of these eight gets a 404 from core-service through a route the gateway advertises in its
OpenAPI document.** The audit listed them as "missing UI"; they are worse than that — the UI could not
use them if it tried.

### Fix — ✅ done

1. **Four near-misses renamed on the gateway** to match core-service, which is what implements them:
   `no-show` → `no-shows`, `forecast` → `demand-forecast`, `manager-flash` → `flash`,
   `housekeeping-status` → `housekeeping-productivity`.
2. **Four with no implementation deleted** (`revenue-summary`, `daily-revenue`, `str-metrics`,
   `night-audit-summary`). An advertised endpoint that 404s is worse than an absent one, and the
   surviving `GET /v1/reports/*` catch-all picks them up automatically if core-service implements them
   later. `revenue-summary` and `daily-revenue` may belong in revenue-service, which already has
   `channel-profitability`, `segment-analysis` and `managers-report` — see
   [05-revenue-module-status.md](05-revenue-module-status.md).
3. **Conformance test added** — `Apps/api-gateway/tests/proxy-route-conformance.test.ts`, modelled on
   `Apps/command-consumer-utils/tests/flow-command-catalog.test.ts`: for every non-wildcard gateway
   route delegating to a `proxy*` helper, the target service must register that path. Parameter names
   are normalised (`:tenantId` ≡ `:id`); `app.all` is satisfied by any method. Verified to fail when a
   mismatch is reintroduced.
4. **E2E sweep corrected** in `executables/test-accounts-realdata/test-multi-tenant.sh` — it had been
   passing all eight as `HTTP=404`, because `api_smoke` treats 404 as a pass (an unknown tenant or
   property legitimately 404s). That tolerance is why the bug survived green runs. The four deleted
   paths were dropped from the sweep and `revenue-summary` replaced with the real `revenue-kpis`.

---

## (b) 8 of 17 core reports have no UI entry

`Apps/core-service/src/routes/reports.ts` implements 17 reports.
`UI/pms-ui/src/app/features/reports/report-defs.ts` wires 10 (9 core + `billing/reports/departmental-revenue`).

**Wired:** occupancy, revenue-kpis, arrivals, departures, in-house, demand-forecast, flash,
no-shows, housekeeping-productivity.

**Not wired:**

| Report | Path |
|---|---|
| Performance | `/v1/reports/performance` |
| Booking pace | `/v1/reports/pace` |
| Revenue forecast | `/v1/reports/revenue-forecast` |
| VIP arrivals | `/v1/reports/vip-arrivals` |
| Guest statistics | `/v1/reports/guest-statistics` |
| Market segment production | `/v1/reports/market-segment-production` |
| Maintenance SLA | `/v1/reports/maintenance-sla` |
| Audit trail | `/v1/reports/audit-trail` |

Also unwired on the billing side: `/v1/billing/reports/trial-balance`, `gl-trial-balance`,
`tax-summary`, `commissions` (only `departmental-revenue` is in `report-defs.ts`).

### Fix

The reports screen is data-driven — each report is one entry in `report-defs.ts`. Per report:

1. Add the definition (id, title, endpoint, params, column defs, permissions).
2. Confirm the response shape fits the generic renderer. Where it does not (nested groups, multi-section
   reports like `performance` and `maintenance-sla`), either extend the renderer once or note the
   report as needing a bespoke view — do not fork the renderer per report.
3. Check the permission/module gating so finance reports are not visible to all STAFF.

Suggested order — highest value per unit of effort: `vip-arrivals` (daily operational use),
`pace`, `market-segment-production`, `guest-statistics`, `maintenance-sla`, `performance`,
`revenue-forecast`. Leave `audit-trail` to `accounts-gaps/23-ui-audit-log-viewer.md`, which specs a
proper viewer rather than a generic table.

## Acceptance

- (a) No gateway route proxies to a non-existent downstream path; a test enforces it.
- (b) Every core-service report either appears in `report-defs.ts` or is explicitly recorded here as
  deliberately unexposed.

## Cross-reference

- `accounts-gaps/23-ui-audit-log-viewer.md` and `accounts-gaps/24-ui-gl-viewer.md` own the audit-trail
  and GL viewers — do not duplicate them in `report-defs.ts`.
- [05-revenue-module-status.md](05-revenue-module-status.md) — revenue-service's 11 read-only reports
  are candidates for `report-defs.ts` rather than bespoke screens.
- [12-billing-partials.md](12-billing-partials.md) — the unwired `/v1/billing/reports/*` entries.
