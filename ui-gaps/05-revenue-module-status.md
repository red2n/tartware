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

- Confirm the read endpoints return real data for a tenant with reservation history — the event
  consumer implies they should. If they return empty, the backend is less complete than it looks and
  Option B gets cheaper.
- Check whether `revenue.daily_close.process` is invoked by night audit or by nothing.
- Check overlap with `billing.pricing.evaluate` / `billing.pricing.bulk_recommend` in billing-service
  (UI-dispatched today) — if billing already does yield pricing, revenue-service may be a duplicate
  surface, which is a strong argument for Option B.

## Acceptance

Decision recorded in this file with a date and an owner. If Option A: items 1–2 shipped and
reachable. If Option B: service, routes, catalog rows and schemas removed in one PR.

## Cross-reference

- [17-command-reachability.md](17-command-reachability.md) — 32 of 108.
- [10-reports-coverage.md](10-reports-coverage.md) — the read-only revenue reports may belong there
  instead of in bespoke screens.
- `accounts-gaps/13-multi-currency-fx-locking.md` — independent.
