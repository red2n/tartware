# COV-05: revenue-service Has No Front-End — Build or Retire

**Priority:** P1 (decision) | **Risk:** 🟠 MEDIUM | **Type:** Decision, then XL or delete | **Effort:** XL or delete

## Current State (Backend ✅ → UI ❌, completely)

`revenue-service` is a fully built service with **zero UI reach**. `/v1/revenue` does not occur
anywhere in `UI/`, and there is no `features/revenue` directory. The word "revenue" appears in the UI
only in report names like `revenue-kpis`, which belong to core-service.

### 20 read endpoints

`Apps/revenue-service/src/routes/pricing.ts` — `pricing-rules`, `pricing-rules/:ruleId`,
`rate-recommendations`, `competitor-rates`, `demand-calendar`, `rate-restrictions`, `hurdle-rates`,
`rate-shopping`, `competitive-response-rules`

`Apps/revenue-service/src/routes/reports.ts` — `forecasts`, `goals`, `kpis`, `compset-indices`,
`displacement-analysis`, `budget-variance`, `managers-report`, `booking-pace`, `forecast-accuracy`,
`segment-analysis`, `channel-profitability`

Gateway exposes them at `Apps/api-gateway/src/routes/revenue-routes.ts` (`GET /v1/revenue/pricing-rules`
plus `ALL /v1/revenue/*`), so they are reachable — nothing calls them.

### 32 commands

All of `revenue.*` in `Apps/revenue-service/src/commands/command-center-consumer.ts`: recommendation
generate/approve/bulk_approve/reject/apply, pricing_rule CRUD + activate/deactivate, restriction
set/bulk_set/remove, hurdle_rate set/calculate, competitor record/bulk_import/configure_compset/
auto_collect, competitive_response.configure, forecast compute/adjust/evaluate, booking_pace.snapshot,
demand update/import_events, goal CRUD + track_actual, group.evaluate, daily_close.process.

**None has a gateway REST wrapper and none is dispatched by the UI** — 32 of the 108 structurally
unreachable commands in [17-command-reachability.md](17-command-reachability.md) are this service.

The service does consume reservation events (`consumers/reservation-event-consumer.ts`), so it is not
inert — it accumulates data nobody can see or act on.

## The Decision

This is a product decision and it is the largest single item in this backlog. Right now revenue
management is neither shipped nor retired: it costs build time, deploy surface, schema and test
weight, and returns nothing.

**Option A — build the front-end (XL).** A revenue-management module is a premium PMS feature and the
backend is the expensive half. Minimum viable scope, in order:

1. **Rate recommendations worklist** — `GET /v1/revenue/rate-recommendations` +
   `revenue.recommendation.approve` / `.reject` / `.bulk_approve` / `.apply`. This alone makes the
   service useful; everything else is analysis around it.
2. **Demand calendar** — `demand-calendar` + `revenue.demand.update`, `revenue.demand.import_events`.
   Pairs naturally with the existing rate calendar screen.
3. **Pricing rules admin** — `pricing-rules` CRUD + activate/deactivate.
4. **Restrictions** — `rate-restrictions` + set/bulk_set/remove; consider merging into the existing
   rate-calendar UI rather than a new screen.
5. **Forecast & pace dashboard** — `forecasts`, `booking-pace`, `forecast-accuracy`, `budget-variance`.
6. **Compset / rate shopping** — `competitor-rates`, `compset-indices`, `rate-shopping` +
   competitor commands.
7. **Goals** — `goals` + goal commands.
8. **Manager's report** — `managers-report`, `segment-analysis`, `channel-profitability`,
   `displacement-analysis`. These are read-only and fit the data-driven reports screen
   (see [10-reports-coverage.md](10-reports-coverage.md)) more cheaply than bespoke screens.

Items 1–2 are the smallest slice that turns the service from cost into product. Ship that first and
re-decide the rest.

**Option B — retire the service.** Delete `Apps/revenue-service`, its gateway routes, its 32 catalog
rows and command schemas, and its tables. Keeps the system honest and removes a whole deploy target.
Reversible from git if revenue management is later funded.

**Option C — freeze it.** Mark the service internal/experimental, exclude it from the coverage audit
so it stops reappearing as a gap, and keep the event consumer so history accumulates for a later
front-end. Cheapest, but it is the status quo with a label.

## Recommendation

Take **Option A limited to items 1–2**, or **Option B**. Do not leave it as it stands: the current
state is the only one with no upside.

## Work Required Before Deciding

- ~~Confirm the read endpoints return real data~~ — **answered 2026-08-13, below.**
- ~~Check whether `revenue.daily_close.process` is invoked by night audit or by nothing.~~ — **nothing.**
- ~~Check overlap with `billing.pricing.evaluate` / `billing.pricing.bulk_recommend`.~~ — **answered.**

## Pre-Decision Investigation — 2026-08-13 (static)

### 1. Only one revenue-owned table has a producer

`consumers/reservation-event-consumer.ts` writes **`demand_calendar` and nothing else** — three
statements, all incrementing/decrementing on-the-books on book, cancel and check-out. Every other
revenue-owned table (`pricing_rules`, `rate_recommendations`, `competitor_rates`, `rate_restrictions`,
`hurdle_rates`, `revenue_forecasts`, `revenue_goals`) is written **only** by the 32 `revenue.*`
commands, and nothing dispatches any of them. So those tables are empty by construction, not by
accident.

Splitting the 20 reads by what they actually query:

| Returns real data today | Empty by construction |
|---|---|
| `demand-calendar`, `booking-pace` (demand_calendar) | `pricing-rules`, `rate-recommendations`, `rate-shopping`, `competitive-response-rules` |
| `segment-analysis`, `channel-profitability` (reservations) | `competitor-rates`, `compset-indices` |
| `displacement-analysis` (reservations + charge_postings + group_blocks) | `rate-restrictions`, `hurdle-rates` |
| | `forecasts`, `forecast-accuracy`, `goals`, `budget-variance`, `managers-report` |

**Five of twenty work.** The audit's "20 endpoints" counts 15 readers over tables that have never held
a row. The backend is materially less complete than the endpoint count implies.

### 2. `revenue.daily_close.process` is invoked by nothing

It is seeded in the command catalog ("triggered after night audit") and listed as a **required command
of the `NIGHT_AUDIT` flow** in `schema/src/flows/flow-registry.ts`. Neither core-service's nor
billing-service's night audit dispatches it. Nothing does — a whole-repo search for a dispatched
`revenue.*` command name outside revenue-service's own files, the validators and the flow manifests
returns **zero hits**. The flow registry declares a dependency the running system does not honour.

### 3. The overlap is real, and both ends are dead

`billing.pricing.evaluate` reads **`pricing_rules`** — the same table `revenue.pricing_rule.*` writes —
and writes the result to `availability.room_availability.dynamic_price`. So billing owns the *evaluator*
and revenue owns the *rule editor* for one table.

**Correction to this spec's premise:** `billing.pricing.evaluate` and `billing.pricing.bulk_recommend`
are **not** UI-dispatched. Neither occurs anywhere in `UI/`, and neither has a gateway REST wrapper.
They are in COV-17's unreachable set like the rest.

The consequence: dynamic pricing is dead end to end. No rule can be created (revenue commands
unreachable), and the evaluator that would consume one cannot be triggered (billing commands
unreachable). This is not a duplicate surface — it is one feature split across two services with
neither half connected.

## ✅ Cheap slice shipped 2026-08-13 — decision on the rest still open

The four analyses that already return real numbers are now entries in
`UI/pms-ui/src/app/features/reports/report-defs.ts`: `segment-analysis`, `channel-profitability`,
`booking-pace`, `displacement-analysis`. Their query contracts matched the existing `range` shape, so
each is one table entry and the nav picks them up automatically — no new screens, no backend, no
commands. **The working fifth of revenue-service is now product.**

They are gated `revenue-management` at the gateway and ADMIN downstream; the reports screen already
renders both refusals as callouts. 

**✅ The `displacement-analysis` module gate was aligned 2026-08-18.** It required
`finance-automation` downstream while the gateway gates all of `/v1/revenue/*` on
`revenue-management`, so a tenant with revenue-management and not finance-automation passed the edge
and 403d at the service. Fixed downstream rather than at the gateway, for two reasons: the gateway's
`revenue-management` check already makes the route unreachable for a finance-automation-only tenant,
so the old value could *only* cost tenants who had already passed; and displacement analysis ships
beside `segment-analysis`, `channel-profitability` and `booking-pace` on the reports screen, all three
of which are `revenue-management`. All four shipped analyses now gate identically.

**Still mismatched, deliberately left alone:** `forecasts`, `goals`, `kpis`, `compset-indices`,
`budget-variance` and `managers-report` require `finance-automation` downstream behind the same
`revenue-management` gateway gate — so they effectively require *both* modules. None is reachable from
the UI yet, and requiring both may be intentional for a premium reporting tier. That is a product
decision, not a bug, and it should be recorded either way before any of them ships.

No conformance test was added for this class. Asserting gateway and service modules must match would
fire on those six legitimate both-module routes, and a test that cries wolf is worse than none — the
same lesson the enum sweep recorded on 2026-08-13. A trustworthy version needs the tiering decision
made first.

**Still yours to decide:** the other 15 endpoints and 32 commands. Build the recommendation chain
(generate → approve → apply plus the pricing-rule editor, which is three items, not one) or retire
them under Option B. And `revenue.daily_close.process` should either be dispatched or come out of the
`NIGHT_AUDIT` flow's `requiredCommands`.

## Recommendation after investigating — 2026-08-13

**Option A as written is worse value than it looks**, because item 1 (rate recommendations worklist)
sits on `rate_recommendations`, a table with no producer — the worklist would be empty until
`revenue.recommendation.generate` is also wired, and that reads `pricing_rules`, which is also empty.
Item 1 is really three items.

**The cheap, high-confidence slice is item 8, not items 1–2.** `segment-analysis`,
`channel-profitability`, `displacement-analysis` and `booking-pace` already compute real numbers from
`reservations`, `charge_postings` and `demand_calendar`. Their query contracts (`start_date` +
`end_date` + `property_id`) match the `range` shape `report-defs.ts` already supports, so each is
**one table entry** on the existing data-driven reports screen — no new screens, no new backend, no
commands. That turns the working fifth of the service into product this week.

Then decide the rest on that evidence: if the analyses get used, fund the recommendation chain
(generate → approve → apply, plus the pricing-rule editor); if not, retire the remaining 15 endpoints
and the 32 commands under Option B, keeping the reservation event consumer only if `demand_calendar`
is worth accumulating.

**Whichever way it goes, `revenue.daily_close.process` should come out of the `NIGHT_AUDIT` flow's
`requiredCommands` or start being dispatched.** A flow that declares a command nobody sends is a
guardrail lying about what the system does.

## Acceptance

Decision recorded in this file with a date and an owner. If Option A: items 1–2 shipped and
reachable. If Option B: service, routes, catalog rows and schemas removed in one PR.

## Cross-reference

- [17-command-reachability.md](17-command-reachability.md) — 32 of 108.
- [10-reports-coverage.md](10-reports-coverage.md) — the read-only revenue reports may belong there
  instead of in bespoke screens.
- `accounts-gaps/13-multi-currency-fx-locking.md` — independent.
