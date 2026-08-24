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

---

## 🐛 The four "shipped" analyses had never worked — measured and fixed 2026-08-24

This spec's 2026-08-13 entry claimed "the working fifth of revenue-service is now product" and set the
decision test as *if the analyses get used, fund the recommendation chain; if not, retire.* **That test
could never have run.** The first time a running stack touched the four report-defs entries, none of
them returned usable data:

| Report | HTTP | What the Reports screen rendered |
|---|---|---|
| Segment Analysis | **500** | error callout |
| Channel Profitability | **500** | error callout |
| Booking Pace | 200 | one row, columns `0`,`1`,`2`…, every cell `[object Object]` |
| Displacement Analysis | 200 | correct empty state |

So their non-use was never evidence about demand — it was evidence they were unreachable. **No
automated test has ever hit a revenue endpoint**: `run-api-tests.sh` never mentions revenue,
`revenue.http` is not in the runner, and `displacement-analysis` does not appear in `revenue.http` at
all. That is why six months of "shipped" survived unexamined.

### Defect 1 — a type declaration that lies about what the driver returns

`Apps/config/src/db.ts:44` registers a **global** parser mapping Postgres `int8` to a JS `BigInt`, so
any bare `COUNT(*)` reaching a client is a 500 — `JSON.stringify` throws on BigInt. Both failing
services *did* guard every field with a `toNumber`:

```ts
const toNumber = (v: string | number | null): number =>
  v == null ? 0 : typeof v === "string" ? Number(v) : v;
```

A `BigInt` is neither `string` nor `number`, so the ternary falls through and **returns the BigInt
unchanged**. The guard looks correct and does nothing. TypeScript cannot see it because the row type
declares the column `string | number | null`, which is not what `pg` hands back once the type parser is
installed — *the annotation, not the logic, is the defect.*

The repo already had the right helper (`toNumberOrFallback` in `Apps/config/src/numbers.ts`, explicit
about `bigint`, used by seven services). Three files had hand-rolled a narrower copy:
`segment-analysis-service.ts`, `channel-profitability-service.ts`, `group-evaluate-service.ts`. All
three now import the shared one. Note `lib/row-mappers.ts`'s `toNumber` was never affected — it takes
`unknown` and calls `Number(value)`, which handles BigInt incidentally.

### Defect 2 — the default response schema turns arrays into objects

`buildRouteSchema` (`Apps/openapi-utils/src/index.ts:204`) defaults `response` to
`{ 200: jsonObjectSchema }`. A handler returning a **bare array** is then serialized against an object
schema and emitted as `{"0":…,"1":…}`. The UI's `extractRows` finds no `data`/`rows`/`items`/`results`
array, falls to its scalar branch and wraps the whole thing as **one row whose column names are the
array indices**.

**70 of 590** route registrations omit an explicit `response`. Twelve of them returned bare arrays,
**all twelve in revenue-service** — including `booking-pace` and `demand-calendar`, both confirmed
live. Each now declares `response: { 200: jsonArraySchema }`, the helper that already existed beside
`jsonObjectSchema`. The rest of the 70 return objects and are unaffected; an accurate per-route sweep
of every other service found **0** cases, self-checked by confirming it re-identifies all 12
revenue routes.

### After the fix — verified through the gateway

All 20 revenue reads return well-formed payloads. `segment-analysis` → 18 rooms sold, 58 room nights,
4791.00 revenue, ADR 87.72. `channel-profitability` → DIRECT, 4791.00 gross, 4647.27 net, net ADR
80.13. `booking-pace` → a 61-element array. `demand-calendar` → a 15-element array. Typecheck,
`sql:contracts` (247 tables / 762 files / 0 violations), biome, lint, knip, gateway conformance (33)
and command-catalog conformance (16) all pass.

### What the evidence now says about build-or-retire

Measured against the dev database, not inferred:

- **8 of the 9 revenue-owned tables hold exactly 0 rows** — `pricing_rules`, `rate_recommendations`,
  `competitor_rates`, `competitor_properties`, `rate_restrictions`, `hurdle_rates`,
  `revenue_forecasts`, `revenue_goals`. Empty by construction, as this spec predicted statically.
- **`demand_calendar` is genuinely alive** — 60 rows, 274 room-nights across 4 properties, written by
  `reservation-event-consumer`. It is the one revenue-owned table with a real producer.
- **`demand_calendar.rooms_available` is 0 in every row.** `event-queries.ts:13` says "the periodic
  inventory sync job overwrites it with the property's actual sellable room count" — **that job does
  not exist anywhere in `Apps/`.** Nothing writes a real value. Every metric derived from it
  (occupancy forecast, RevPAR, rooms remaining) is therefore uncomputable, and `booking-pace` returns
  it as a permanent 0 alongside `pickup_last_7_days` / `pickup_last_30_days`, which only
  `revenue.booking_pace.snapshot` writes — an unreachable command.
- **Displacement Analysis is empty for a data reason, not a structural one.** It joins
  `reservations.group_booking_id`, which *is* written — by `group.upload_rooming_list`, dispatched
  from the UI at `group-detail.ts:518`. Dev has 96 rooms blocked and 0 picked up, so the join finds
  nothing. Pick up a rooming list and the report populates.
- `revenue.daily_close.process` is still in `NIGHT_AUDIT.requiredCommands`
  (`flow-registry.ts:125`) and dispatched by nothing; it is carried in the
  `KNOWN_UNREACHABLE` allowlist in `flow-command-catalog.test.ts`.

**The decision is still open, but it is now decidable.** The four analyses work for the first time, so
whether they get used is finally a question the product can answer.

### The lesson, which is not new here

This backlog already records that a command can have a catalog row, a validator, a handler and full
conformance coverage and still never have executed; and that a screen can be shipped, seeded,
navigable and unreachable. This is the same shape one layer over: **a report can be shipped, wired,
module-gated, role-gated and correct in SQL, and still have never returned a row to anyone.** Every
gate passed — typecheck, `sql:contracts`, both conformance suites — because not one of them serializes
a response. The cheapest thing that would have caught it is a single authenticated `GET`.

**No guardrail was added for either class and both are cheap to regrow.** The array/response-schema
mismatch is statically detectable — handler return type vs. declared response — and the sweep written
for this pass found all 12 with no false positives, so a conformance test is buildable and is the
obvious next step. The BigInt class is narrower now that the three local copies are gone, but nothing
stops the fourth from being written.

---

## ✅ Guardrails + smoke built 2026-08-24 — and the smoke found a crash on its first run

The two defects above were fixed but nothing stopped them recurring, and the root cause — *no
automated test has ever called a revenue endpoint* — was untouched. Both are now closed.

**`response-schema-conformance.test.ts`** (`Apps/api-gateway/tests/`, already the home for the
cross-service route scanners and already run by `ci-guardrails.yml` on every branch). It pairs each
route's handler with that function's **declared** return type and fails when a bare `T[]` relies on
`buildRouteSchema`'s default object response. Detection is deliberately narrow — only a direct
`return someFunction(...)`, only an unambiguous `T[]` or `Array<T>`; a wrapped result or a union is
skipped. It under-reports rather than over-reports. Verified by re-introducing the `booking-pace`
defect and watching it name the route, the function and the file.

**`smoke-revenue.sh`** (`pnpm run smoke:revenue`) — 44 assertions over all 20 reads. It asserts
**shape, not just status**, because a status-only check would have passed `booking-pace` for the whole
eleven days it was broken: every payload is classified `array` / `items` / `object` / `INDEX-KEYED`,
and the last is always a failure. It also asserts the aggregate fields are JSON numbers, since a 200
carrying a stringified count is still the BigInt defect. Verified by re-introducing both original
defects and watching it report `expected 200 got 500` and `expected array got INDEX-KEYED`.

All four smoke suites now have entry points (`pnpm run smoke`, `smoke:revenue`, `smoke:operations`,
`smoke:events`, `smoke:accounts`). They had none — no script, no workflow, no mention in
`http_test/AGENTS.md` — which is the same "the check exists but nothing runs it" gap this backlog keeps
recording. They stay out of `ci-guardrails.yml` deliberately: that workflow carries only what needs
neither a database nor a running stack.

### 🐛 One authenticated GET on a missing record killed the service

`smoke-revenue.sh`'s last assertion — *unknown pricing rule id → not found* — returned its 404 and
then **revenue-service exited**. Health went 200 → connection refused, reproducibly, on a single
request. `GET /v1/billing/invoices/<unknown-uuid>` did the same to billing-service.

```ts
reply.notFound("PRICING_RULE_NOT_FOUND");
return;                                   // ← resolves with undefined
```

Fastify treats an async handler's resolved value as the payload. The 404 is written, the handler then
resolves `undefined`, and Fastify sends **again** on a socket whose headers are already out — logging
*"Reply was already sent, did you forget to `return reply`?"* and throwing `ERR_HTTP_HEADERS_SENT`.
That throw happens after the reply lifecycle has ended, so the route's error handler never sees it and
it reaches the process.

**Ten call sites across four services** were in that state — billing-service ×7, core-service ×2,
revenue-service ×1 — every one of them on the most ordinary path a client has: asking for a record
that is not there. Any authenticated user could stop billing-service by requesting an invoice id that
does not exist. All ten now `return reply.…`; verified by five consecutive 404s against both services
with health checked between each.

**Why nothing found it.** `run-api-tests.sh` only requests ids it has just created, so it never asks
for a missing one. Typecheck cannot see it — `reply.notFound()` returns a value the handler is free to
discard. `sql:contracts` reads SQL. The conformance suites never start a server. It took one `GET` for
an absent row, which is the cheapest test there is and the one nobody had written.

`reply-lifecycle-conformance.test.ts` now asserts the shape can never return. Detection is exact
rather than heuristic — a `reply.<sender>(…)` statement followed immediately by a bare `return;` is
unambiguous — so unlike the operator-facing classifications elsewhere in this backlog it needs no
judgement. Verified by re-introducing the crash and watching the check name it.

**The pattern worth carrying forward:** the smoke suite paid for itself on its first execution, and
not on the defect it was written for. The two bugs it was built to catch were already fixed; what it
actually found was a remote crash that had been reachable in four services the whole time.
