# COV-17: Command Reachability — 69 of 195 Commands Have No Path From the UI

**Priority:** P2 (cross-cutting) | **Risk:** 🟠 MEDIUM | **Type:** Audit + UI | **Effort:** L

> ## ✅ Re-run 2026-08-20 — 69 unreachable, and the method got two more corrections
>
> Acceptance criterion 3 ("re-run once the write paths land") is discharged. The gap has closed by 26
> since 18 August, and — as last time — part of that is real work and part was the scan lying.
>
> | | 2026-08-11 | 2026-08-18 | **2026-08-20** |
> |---|---|---|---|
> | Commands (catalogued ∪ validated) | 202 | 203 | **199** |
> | With a handler | 202 | 203 | **195** |
> | Reachable from the gateway | 81 | 83 | **87** |
> | Dispatched by the UI | 22 | 26 | **26** |
> | Dispatched by a job or consumer | — | 2 | **59** |
> | **Unreachable** | 108 | 95 | **69** |
> | Catalogued with no handler | 7 | 4 | **4** |
> | Handler with no catalog row | — | — | **0** |
>
> ### Two more dispatch forms the scan could not see
>
> The 2026-08-18 pass found three (ternary `commandName:`, wrapper factories, direct `submitCommand`).
> Re-deriving found two more, both of which had been inflating the gap:
>
> 1. **`dispatchCommand("ar.city_ledger.transfer", …)`** — a produced envelope that never writes the
>    words `commandName:`. `ar-event-consumer.ts` fires it on checkout. This spec *said* that command
>    was machine-dispatched; the scan still counted it unreachable.
> 2. **`commands/loyalty.points.${kind}`** — the interpolated UI dispatch. Resolving it by reading the
>    file (kind is only ever `earn` or `redeem`) is what brings the UI count to 26, which is the number
>    this spec verified by hand in August. That agreement is the check that the method is sound.
>
> And one correction in the other direction, which is why "with a handler" *fell* from 203 to 195:
> **`case` labels in event consumers are not command handlers.** `case "reservation.checked_in":` in an
> event consumer reads exactly like a command handler to a regex. The universe of commands is now taken
> from the two authoritative registries — the catalog seed and `command-validators.ts` — and a `case`
> label naming something in neither is not counted. The machine-dispatch count rising from 2 to 59 is
> the same correction seen from the other side: most of those 59 were always there, and the earlier
> pass only counted the two it happened to look at.
>
> ### What actually changed in the product
>
> - **`metasearch.config.create` / `.update` wired 2026-08-20.** Handlers, catalog rows and validators
>   existed; no gateway wrapper did, so neither could ever be dispatched. Now at
>   `/v1/tenants/:tenantId/channels/metasearch-config[-update]` and driven from the distribution screen
>   ([14](14-channel-distribution.md)).
> - **`billing.event.setup` / `.post_charges` added and reachable** ([13](13-sales-catering.md) item 6).
> - **`operations.maintenance.*` ×4 and `inventory.*` ×3 retired**, as this spec classified them.
> - **`reservation.mobile_checkin.*` ×2 retired** — REST was already the live path.
>
> ### 🐛 `guest.gdpr.export` was a command that never existed — removed 2026-08-20
>
> A payload schema and a registered validator, with **no catalog row and no handler**. Article 15
> export is a *read*: the gateway proxies `GET /v1/guests/:guestId/gdpr-export` to guests-service, and
> [19](19-gateway-proxy-mismatches.md) fixed that path in August. The command surface around it was
> left behind — a registry entry describing a write that does not exist. Deleted (validator + payload
> schema) on the precedent that removed `compliance.breach.report` and `operations.incident.report`.
>
> ### The retire list, with evidence
>
> `settings.value.set` / `.bulk_set` / `.approve` / `.revert` — **four commands, one dead path.**
> Verified 2026-08-20: each has a handler, a catalog row and a validator, **no gateway wrapper**, and
> the canonical write is REST — `POST /v1/settings/values` and `PATCH /v1/settings/values/:valueId` on
> `settings-catalog.ts`, which is what `features/settings/settings.ts:698` calls. The four service
> functions behind the commands (`setSettingsValue`, `bulkSetSettingsValues`, `approveSettingsValue`,
> `revertSettingsValue`) are referenced by **nothing but the command consumer**, and that consumer
> handles these four cases and nothing else.
>
> Retiring them means: 4 catalog rows, 4 validators, 4 payload schemas, the consumer file and its
> startup wiring in `core-service/src/index.ts`, and the four service functions. It is mechanical, but
> it touches service startup, so it is written down here as the next concrete step rather than tacked
> onto an audit.
>
> ### 🐛 A hot-reload listener with no producer
>
> Found while checking the above. `billing-service/src/plugins/business-calendar-settings.ts` subscribes
> to a `settings.events` topic and expects `{ type: "settings.value.set" }` to hot-reload the business
> calendar. **Nothing in core-service publishes to that topic** — not the REST path, not the command
> handler. So a settings change never reaches billing-service, and the business calendar keeps whatever
> it read at boot. Not a reachability item, but the same shape: a consumer for a message nobody sends.
>
> ### What the remaining 69 are blocked on
>
> | Namespace | n | Blocked on |
> |---|--:|---|
> | `revenue.*` | 27 | [05](05-revenue-module-status.md)'s build-or-retire call — still the single biggest lever |
> | `billing.*` | 13 | `accounts-gaps/` (deposits, chargebacks, suspense, group billing) |
> | `ar.*` | 7 | [03](03-ar-account-management.md)'s 9 deferred actions |
> | `reservation.*` | 7 | quote lifecycle + `walk_guest` need screens; three are machine-side |
> | `commission.*` | 4 | `accounts-gaps/` |
> | `settings.value.*` | 4 | **retire** — see above |
> | `group.*`, `operations.*`, `rooms.*`, `metasearch.click.record` | 7 | mixed: 2 product calls (labour scheduling), keys need a staff revoke path, click tracking is machine-side |
>
> **More than half of what remains is one decision and one backlog.** `revenue.*` (27) plus the
> `billing.*`/`ar.*`/`commission.*` set (24) is 51 of 69; neither is a UI problem.

> ## ✅ Classified 2026-08-18 — 95 unreachable, not 108
>
> Acceptance criterion 1 is discharged: every unreachable command is now (a) an operator action
> needing UI, (b) a machine action correctly having no UI, or (c) dead surface to retire. The
> re-derivation also corrected the count and the method.
>
> ### The count was wrong because the scan missed two dispatch forms
>
> | | Audit | 2026-08-11 spec | Verified 2026-08-18 |
> |---|---|---|---|
> | Commands with a handler | 199 | 202 | **203** |
> | Reachable from the gateway | 75 | 81 | **83** |
> | Dispatched by the UI | 21 | 22 | **26** |
> | Dispatched by a job or consumer | — | — | **2** |
> | **Unreachable** | 134 | 108 | **95** |
>
> Three method corrections, each of which had been silently inflating the gap:
>
> 1. **`commandName:` is not always a string literal.** `command-helpers.ts` writes
>    `commandName: action === "release" ? "rooms.inventory.release" : "rooms.inventory.block"`.
>    A regex anchored on `commandName:\s*"` misses both. This is the same dynamic-assembly
>    weakness `00-CONSOLIDATED.md` already names for route paths — it applies to commands too.
> 2. **Wrapper factories hide the registration.** The five `integration.*` commands are wrapped by a
>    local `channelCommandRoute(path, summary, commandName)` helper, so the command name never appears
>    next to an `app.post`. They were wired by COV-14 on 2026-08-13 and this spec never caught up.
> 3. **`reservation.create` is reachable**, as this spec suspected but could not confirm.
>    `reservation-routes.ts` calls `submitCommand` directly rather than declaring a `commandName:`
>    wrapper. The suspicion was right; the tooling could not see it.
>
> Counter-correction in the other direction: **events and commands share the naming shape**, so a bare
> `"reservation.no_show"` in notification-service's event→template map reads as a dispatch and is not
> one. Machine dispatch is only counted where the shape is a real one (`commandName:` in a produced
> envelope, or a `dispatchCommand(` call).
>
> ### The classification
>
> | Namespace | n | Class | Basis |
> |---|--:|---|---|
> | `revenue.*` | 32 | **deferred** | Blocked on [05](05-revenue-module-status.md)'s build-or-retire call. Under Option B all 32 are (c); under Option A most are (a). Classifying them now would pre-empt the decision. |
> | `billing.*` | 17 | **(a)** ×15, **(b)** ×2 | Deposits, chargebacks, suspense, group billing and payment authorisation are clerk actions — owned by `accounts-gaps/` and [12](12-billing-partials.md). `billing.pricing.evaluate` / `.bulk_recommend` are machine-side, and [05](05-revenue-module-status.md) shows both ends of that feature are dead. |
> | `ar.*` | 10 | **(a)** ×9, **(b)** ×1 | Disputes, dunning, city-ledger and payment apply/unapply are AR-clerk actions ([03](03-ar-account-management.md) defers 9 `ar.*` actions — this is that set). `ar.aging.compute` is scheduled. Note `ar.city_ledger.transfer` is **already machine-dispatched** by `ar-event-consumer.ts` on checkout and is no longer in the unreachable set. |
> | `reservation.*` | 10 | **(a)** ×5, **(b)** ×3, **(c)** ×2 | See the breakdown below — this namespace is the most mixed. |
> | `operations.*` | 6 | **(c)** ×4 *(was (a) — see below)*, **decision** ×2 | Maintenance request/assign/complete/escalate is a core front-of-house workflow with no button; `features/housekeeping` already reaches `housekeeping.task.*` through wrappers, so the pattern to copy exists. `schedule.create` / `.update` need a product call on whether Tartware does labour scheduling at all. |
> | `commission.*` | 4 | **(a)** | Owned by `accounts-gaps/`. |
> | `settings.value.*` | 4 | **(c)** | REST is canonical and shipped: `settings-catalog.ts` registers `/v1/settings/values` + `/:valueId`, and `features/settings/settings.ts:693` PUTs to it. The four commands are a second write path nothing uses. |
> | `inventory.*` | 3 | **(c)** | The live path is **gRPC**, not the command bus — `reservations-command-service/src/clients/availability-guard-client.ts` calls `lockRoom` / `releaseRoom` directly. The guard's consumer still handles `inventory.lock.room` etc. and nothing dispatches them. This spec guessed "almost certainly internal"; it is internal *and* superseded. |
> | `metasearch.*` | 3 | **(a)** ×2, **(b)** ×1 | `config.create` / `.update` want a small admin screen ([14](14-channel-distribution.md) owns the metasearch UI). `click.record` is machine/public tracking. |
> | `rooms.*` | 3 | **(a)** | `key.issue` / `.revoke` and `rooms.move`. Keys are security-relevant and [11](11-self-service-coverage.md) proposes exposing keys to guests — **do not ship guest-visible keys without a staff revoke path.** `rooms.inventory.block` / `.release` are reachable and have left this set. |
> | `group.*` | 2 | **(a)** ×1, **(b)** ×1 | `group.billing.setup` → `accounts-gaps/17-group-master-billing.md`. `group.cutoff_enforce` is scheduled. |
> | `loyalty.points.expire_sweep` | 1 | **(b)**, unwired | See below. `loyalty.points.earn` / `.redeem` are reachable via the dynamic dispatch at `loyalty.ts:124` — `kind` is only ever `earn` or `redeem`, resolved by reading the file rather than by prefix match. |
>
> ### `reservation.*` in detail
>
> - **(a) needs UI** — `convert_quote`, `send_quote` (the quote lifecycle has no screen at all),
>   `walk_guest` (relocating an oversold guest; operationally critical, no button),
>   `waitlist_offer`, `generate_registration_card`.
> - **(b) machine** — `expire`, `batch_no_show`, `waitlist_expire_sweep`.
> - **(c) retire** — `mobile_checkin.start` / `.complete`. The guest portal reaches mobile check-in
>   over REST (`guest-api.service.ts` → `/v1/self-service/check-in/start`), which lands on
>   guests-service's `routes/checkin.ts`. The reservations-command-service commands are a third
>   entry point for the same operation and nothing dispatches them.
>
> ### ✅ `operations.maintenance.*` — write path **and screen** shipped 2026-08-18, commands now retirable

Classified **(a)** above, and building it showed the classification was half right: the *capability*
was missing, but the four commands were the wrong vehicle for it.

State before: four handled commands nothing could dispatch, two `GET`s on housekeeping-service, and an
`app.get("/v1/maintenance/*")` wildcard at the gateway — one of the thirteen demoted on 2026-08-13. A
guest reported a fault and there was no way to log it, while `/v1/reports/maintenance-sla` reported on
a table nothing could fill.

**Built as HTTP, not as gateway command wrappers**, because [18](18-write-path-gap.md)'s rule puts them
there: every one of the four writes touches `maintenance_requests` in housekeeping-service alone — one
owner, one table, no fan-out, no outbox. That is the same call that **deleted the sibling
`operations.incident.report`** on 2026-08-13 in favour of the plain HTTP incident routes next door, and
maintenance is the identical shape in the same namespace and the same service.

- `POST /v1/maintenance/requests` — raise
- `POST /v1/maintenance/requests/:requestId/assign` · `/complete` · `/escalate`

They reuse `maintenance-command-service.ts` unchanged, so the command handlers and the routes cannot
drift. The gateway wildcard was promoted with `app.post` only — POST is all the service implements, and
a PUT/DELETE wildcard would recreate the phantom-write surface the sibling check guards against.

**Consequently the four commands move (a) → (c)**, on the incident precedent: keeping them would mean
two write paths for one table. They join the retirement list.

**Screen shipped the same day:** `UI/pms-ui/src/app/features/housekeeping/maintenance/`, route
`/housekeeping/maintenance`, nav entry under Housekeeping. It reuses the `housekeeping` screen key —
like the incidents and lost-and-found screens beside it — so no new permission seed was needed.

- **Raise** a fault: category, type, priority, room or free-text location, and an
  "stops the room being sold" flag.
- **Assign** to a technician (the `/users` picker `features/housekeeping` already uses, since
  `assigned_to` is a user id), **complete** with labour/parts cost and duration, **escalate** with a
  reason and optional new priority.
- Three banners, ordered by what costs money: **rooms out of service** on an unresolved fault first,
  then open safety/health issues, then anything urgent or above. Rooms held out of sale is the number
  a duty manager acts on, so it is a banner rather than a column.

`/v1/reports/maintenance-sla` now reports on a table the product can fill.

**Exercised end to end through the gateway before being called done** — the check COV-12's approvals
screen never got. All four writes returned cleanly (`201`, `204`, `204`, `204`) and a read-back
confirmed every field persisted, including `total_cost` derived from labour + parts. It found two
bugs that neither the build nor the type-checker could:

1. **Case drift on the wire.** `housekeeping-service.ts:257-265` lowercases `request_status`,
   `priority` and `issue_category` in its row mapper, while the column, its CHECK constraint and
   `MaintenanceRequestStatusEnum` are all UPPERCASE. The screen compared against the uppercase
   constants, so **all three banners would have read zero, "Open only" would have hidden every row,
   and every badge would have fallen through to the neutral style** — a page that looks right and is
   silently wrong. Invisible to TypeScript, because `MaintenanceRequestListItemSchema` types these as
   `z.string()`. This is the same drift `00-CONSOLIDATED.md` records for the 41 enums on 2026-08-13,
   reaching the API response rather than SQL. Filters were unaffected: the route's query schema
   `.toUpperCase()`s them.
2. **A banner keyed on a column nothing sets.** `room_out_of_service` is the actual OOS state, set
   when someone takes a room down; `affects_occupancy` is the reporter's claim that it cannot be sold,
   and is the only one a raise sets. The headline banner counted the former and would have sat at zero
   for every fault raised through the screen. It now counts both.

Neither is a coverage gap and neither would have been caught by any test in the repo. **This is the
argument for making "exercise one write against a running gateway" part of the definition of shipped
— see [12](12-billing-partials.md).**

**The converse guardrail earned itself here.** Removing the gateway `app.post` and re-running named all
four stranded writes exactly — the pairing that COV-18 noted "no test will remind you" about on
2026-08-17 is now enforced, and it was enforced on the first write path built after it existed.

### Two findings that fall out of the classification
>
> **(b) does not mean "fine". Three of the sweeps have no invoker at all.**
> Category (b) is only correct when a machine actually calls the thing. Checked one by one:
>
> | Command | Invoker | Verdict |
> |---|---|---|
> | `reservation.waitlist_expire_sweep` | `jobs/waitlist-sweep.ts` calls `waitlistExpireSweep()` **as a function**, bypassing the bus | Operation runs; the command is a redundant second entry point → really (c) |
> | `reservation.expire` | none | **Never ran → ✅ fixed 2026-08-18**, see below |
> | `loyalty.points.expire_sweep` | none | **Never ran → ✅ fixed 2026-08-18**, see below |
> | `reservation.batch_no_show` | night audit Step 5 | **False alarm — but it exposed a worse bug**, see below |
>
> So "unreachable from the UI" was hiding a second, worse category: **unreachable from anything.**
>
> ### ✅ Two sweeps built 2026-08-18
>
> Both were fully implemented command functions with no caller. Each needed the missing half — a job
> to find the rows and drive the existing function — not new business logic. Both follow
> `jobs/waitlist-sweep.ts`, including its RLS caveat: a cross-tenant scan takes a dedicated client and
> never RESETs the tenant GUC, because that leaves `app.current_tenant_id = ''` and breaks the `::uuid`
> cast for every later query on that pooled connection.
>
> - **`jobs/quote-expiry-sweep.ts`** (reservations-command-service, 5 min).
>   `reservations.quote_expires_at` is documented in the DDL as the *"auto-expire target"* and nothing
>   targeted it. The impact was worse than stale rows: `expireReservation` is what **releases the
>   availability-guard lock**, so every lapsed quote held inventory out of sale indefinitely.
> - **`jobs/loyalty-expiry-sweep.ts`** (guests-service, hourly). `expireLoyaltyPoints` was complete —
>   batched, `FOR UPDATE SKIP LOCKED`, writing an `expire` ledger row and decrementing the balance in
>   one statement — and `loyalty_point_transactions` even carries a **partial index**
>   (`WHERE expired = FALSE AND expires_at IS NOT NULL`) built for that exact query. Someone built the
>   index for a sweep that was never scheduled. Every balance was overstated.
>
> ### ⚠️ `reservation.batch_no_show`: the operation runs, but the wrong implementation won
>
> This one was **not** a missing sweep, and checking it before building is what caught that. Night
> audit Step 5 (`billing-service/src/services/billing-commands/night-audit.ts`) already marks no-shows,
> `billing.night_audit.execute` **is** dispatched by the roll scheduler, and its candidate query is
> character-for-character the same as `batchNoShowSweep`'s.
>
> But the two implementations are not equivalent. Night audit does a **raw `UPDATE`**; the reservations
> path (`markNoShow`) does three things night audit does not:
>
> | | `markNoShow` (reservations) | Night audit Step 5 |
> |---|---|---|
> | Sets status / `is_no_show` / fee | ✅ | ✅ |
> | Emits `reservation.no_show` via the outbox | ✅ | **✗** |
> | Releases the assigned room to `AVAILABLE` | ✅ | **✗** |
>
> So on the path that actually runs, **no domain event is emitted**, and everything downstream is
> silently skipped:
>
> - notification-service maps `reservation.no_show` → `NO_SHOW_NOTIFICATION`. The guest is never told.
> - revenue-service's `classifyUpdateEvent` keys on `metadata.is_no_show === true` to decrement
>   on-the-books in `demand_calendar`. It never fires, so demand data overstates occupancy for every
>   no-show — and `demand_calendar` is the one revenue table with a real producer, feeding the four
>   analyses COV-05 shipped.
> - The room is never released, so it stays out of sale exactly like the unexpired quotes above.
>
> **This was left as a decision, not a fix.** The obvious repair — have night audit stop hand-rolling
> the UPDATE and dispatch `reservation.batch_no_show` instead — is the right shape under COV-18's rule
> (cross-service effects → command) and would make the command reachable, discharging it from this
> spec. But it moves a step that currently runs **inside night audit's transaction** onto an async bus,
> which changes the atomicity of a financial close. That trade belongs to whoever owns night audit.
> Until then the defect stands: no-shows are marked, and nothing downstream learns.
>
> **12 commands are declared `requiredCommands` by a flow and are unreachable.**
> Cross-referencing `schema/src/flows/flow-registry.ts` against the unreachable set:
>
> `billing.ar.post` · `billing.payment.authorize` · `billing.pricing.evaluate` ·
> `reservation.generate_registration_card` · `reservation.mobile_checkin.start` · `.complete` ·
> `revenue.daily_close.process` · `revenue.pricing_rule.create` · `.update` · `.activate` ·
> `.deactivate` · `rooms.move`
>
> [05](05-revenue-module-status.md) made this point about `revenue.daily_close.process` alone — "a flow
> that declares a command nobody sends is a guardrail lying about what the system does". It is twelve,
> and two of them (`mobile_checkin.*`) are declared required while the real path is REST, so the flow
> manifest describes an architecture the product does not have.
>
> **This is the cheapest available guardrail and it should be next.** Unlike the a/b/c classification,
> "every `requiredCommands` entry resolves to a reachable command" needs no product judgement, has no
> false-positive problem, and `flow-command-catalog.test.ts` already parses both sides.

> ## ⚠️ Case-drift sweep — 2026-08-18
>
> Run after the maintenance screen was found comparing UPPERCASE constants against a lowercased API
> response. The question was whether that was a one-off. It was not.
>
> **25 fields across 8 files are case-folded by a service row mapper on the way out** — in both
> directions. `housekeeping-service` and most of `core-service/booking-config` lowercase; `event.ts`
> and `group-waitlist-promo.ts` uppercase. The column, the CHECK constraint and the Zod enum are
> generally the opposite of whatever the mapper emits.
>
> ### Live bug found: the dashboard's housekeeping tiles all read zero
>
> `/v1/housekeeping/tasks` emits `status: "in_progress"`, `priority: "high"` — lowercase.
> `features/dashboard/dashboard.ts` compared `=== "PENDING"`, `"IN_PROGRESS"`, `"COMPLETED"`,
> `"URGENT"`, `"HIGH"`. **All four tiles therefore counted zero against 16 real tasks.** Fixed
> 2026-08-18; the same data now reads 10 pending / 2 in progress / 4 complete / 6 urgent.
>
> **`features/housekeeping/housekeeping.ts` already worked around this** at `canComplete` and
> `canReopen` with `task.status?.toUpperCase()`. So the defect was known, patched locally, and never
> generalised — the dashboard reading the same endpoint never got the same treatment. That is the
> shape of this whole class: a local fix that does not travel.
>
> ### The deeper problem underneath the casing
>
> `housekeeping_tasks.status` stores **CLEAN / DIRTY / IN_PROGRESS** — a room-cleanliness vocabulary.
> Both the dashboard and `housekeeping.ts` expect **PENDING / ASSIGNED / COMPLETED / INSPECTED /
> CANCELLED** — a task-lifecycle vocabulary. The two do not overlap, and the table carries **no CHECK
> constraint on `status`**, so nothing in the database says which is canonical. That is why the drift
> was invisible.
>
> The consequence in `housekeeping.ts` is subtler than the dashboard's: `canComplete` returns
> `s !== "COMPLETED" && s !== "INSPECTED" && s !== "CANCELLED"`, so with CLEAN/DIRTY data it is
> **always true** — the Complete button always shows and Reopen never does. It fails open rather than
> failing visibly.
>
> ### ✅ Settled by evidence, not by decision — 2026-08-18
>
> No product call was needed. `housekeeping_tasks.status` is the Postgres enum type
> `housekeeping_status` (`NOT NULL DEFAULT 'DIRTY'`) — which is *why* there is no CHECK constraint, the
> type itself constrains it. Its values are **CLEAN, DIRTY, INSPECTED, IN_PROGRESS, DO_NOT_DISTURB**,
> the DDL column comment says the same, and the `housekeeping.task.*` handlers write `'CLEAN'`,
> `'DIRTY'`, `'INSPECTED'`.
>
> So the task-lifecycle vocabulary was never canonical — **PENDING, ASSIGNED, COMPLETED and CANCELLED
> are values the database cannot store.** Every comparison against them was dead code.
>
> | Fixed | Was | Now |
> |---|---|---|
> | `dashboard.ts` tiles | all four zero | DIRTY/DO_NOT_DISTURB = pending, CLEAN/INSPECTED = complete |
> | `housekeeping.ts` `canComplete` | `!== COMPLETED && !== INSPECTED && !== CANCELLED` → true for everything but INSPECTED | DIRTY / IN_PROGRESS / DO_NOT_DISTURB |
> | `housekeeping.ts` `canReopen` | matched only INSPECTED | CLEAN / INSPECTED |
>
> The room board in the same file already used the right values (DIRTY 11×, INSPECTED 7×, CLEAN 5×,
> DO_NOT_DISTURB 4×) — only the two task-lifecycle helpers were wrong, which is why nobody noticed.
>
> ### The durable fix: the missing enum
>
> **Root cause: housekeeping tasks was the only domain in `schema/src/api/housekeeping.ts` with no
> status enum.** Maintenance, incidents and lost-and-found all have one; tasks had `status: z.string()`,
> so the UI had nothing to import and hardcoded literals instead. That is precisely the drift the
> schema-first gate in `AGENTS.md` exists to prevent.
>
> `HousekeepingTaskStatusEnum` now exists in `schema/src/api/housekeeping.ts` with a `@database`
> annotation, and both screens import the type. **Verified: reintroducing `"COMPLETED"` is now a
> compile error** (`TS2322: Type '"COMPLETED"' is not assignable to ...`), so this class of bug cannot
> come back in these files.
>
> The list response still types `status` as `z.string()` deliberately — the row mapper lowercases on
> the way out, so parsing a real response against the uppercase enum would fail. That asymmetry is the
> remaining debt, and the fix is to stop case-folding in the mappers (25 sites).
>
> ### ✅ Scoped by data, not by refactor — 2026-08-18
>
> The plan was to strip case-folding from all 25 mapper sites. Sampling the actual columns first showed
> that would have been mostly wasted work and wide risk: **the fold only matters where the column
> stores uppercase**, and most do not.
>
> | Column | Stored | Folded to | Verdict |
> |---|---|---|---|
> | `housekeeping_tasks.status` | `DIRTY` | lower | **mismatch** — fixed |
> | `maintenance_requests.*` | `COMPLETED`, `URGENT` | lower | **mismatch** — fixed |
> | `booking_sources.source_type` | `DIRECT` | lower | **mismatch** — fixed below |
> | `market_segments.segment_type` | `CORPORATE` | lower | **mismatch** — fixed below |
> | `packages.package_type` | `romance` | lower | no-op, harmless |
> | others | no rows yet | — | undetermined; the fold is latent |
>
> The correct end state is the **lost-and-found pattern**: DB casing == wire casing == enum casing,
> no fold at all. `LostAndFoundItemStatusEnum` is lowercase, the service does not fold, and the
> response schema types the field with it. Every folded domain is a deviation from that.
>
> ### Third instance found: distribution edit forms silently rewrote records
>
> `features/settings/distribution` lists `SOURCE_TYPES` / `SEGMENT_TYPES` as uppercase `<option>`
> values — correct for writing, since the column stores upper. But `openEditSource` and
> `openEditSegment` populated the form with the **raw response value**, which the mapper had
> lowercased. The select matched no option, rendered empty, and **saving rewrote the record's type**.
>
> Worse than the dashboard's zeros: that one was visibly wrong and read-only, this one was invisible
> and destructive. Both edit paths now normalise on the way in.
>
> **Three instances of one root cause, in three different shapes** — a summary reading zero, two
> permission helpers inverted, and an edit form corrupting data. None was reachable by the type
> checker, because every one of these fields is typed `z.string()`.
>
> ### Why no conformance test
>
> The obvious guard — "a UI literal compared against field X must match the casing the mapper emits" —
> needs a reliable mapper→field→UI chain, and the scan that found this produced false positives on
> `priority` alone (the dashboard hit was housekeeping tasks, not maintenance; same field name, different
> endpoint). A test built on that would cry wolf, which `00-CONSOLIDATED.md` already rules out on
> 2026-08-13. **The durable fix is to stop case-folding in the mappers** so the wire matches the column
> and the enum, which is a backend change with 25 call sites and its own blast radius.

> ## ✅ 9 commands retired 2026-08-18
>
> All category (c). Each had a live alternative path already carrying the traffic, so nothing lost a
> capability.
>
> | Retired | Live path that replaced it |
> |---|---|
> | `inventory.lock.room` · `.release.room` · `.release.bulk` | **gRPC** — `LockRoom` / `ReleaseRoom` / `BulkRelease`, a 1:1 match calling the same functions |
> | `reservation.mobile_checkin.start` · `.complete` | **REST** on guests-service (`routes/checkin.ts`), which the guest portal calls |
> | `operations.maintenance.request` · `.assign` · `.complete` · `.escalate` | **HTTP** on housekeeping-service, shipped earlier the same day |
>
> Removed per command: catalog row, payload validator, consumer case. Plus
> `schema/src/events/commands/inventory.ts` and its barrel export, the two `mobile_checkin` entries in
> `flow-registry.ts`'s PRE_ARRIVAL flow and in `flow-manifest.ts`, and their `KNOWN_UNREACHABLE` rows.
>
> **Two whole consumers went with them**, because each existed solely for the deleted commands:
> `availability-guard-service/src/workers/command-center-consumer.ts` (491 lines) and the
> `guest-experience` consumer inside guests-service. availability-guard-service is no longer a command
> consumer at all — its work arrives over gRPC, which was always the live path.
>
> **Payload schemas were kept where they are still load-bearing.** The four
> `OperationsMaintenance*CommandSchema` objects are now the request-body contract for the HTTP routes
> that replaced the commands, so deleting them would have broken the very thing that made the commands
> redundant. Their name is now a misnomer — worth renaming when someone is next in that file.
>
> **Two guardrails fired during the work, both correctly.** `flow-command-catalog.test.ts` failed on a
> hardcoded consumer path that no longer existed, then again on its vacuity floor
> (`handled > 20`) once the real handler count fell from 26 to 19. The floor is a guard against the
> check going vacuous, not a claim about how many commands should exist, so it was lowered to 15 with
> that reasoning recorded inline.

## Current State

The command bus is the write path for most of the system. The UI reaches it two ways:

1. **Direct dispatch** — `POST /tenants/:tenantId/commands/<name>`. **22 commands.**
2. **Gateway REST action wrappers** — e.g. `POST /v1/tenants/:id/reservations/:id/check-in` declares
   `commandName: "reservation.check_in"` and dispatches on the caller's behalf. **81 commands wrapped.**

Counting only direct dispatch would say 22 of 202 and badly understate coverage. Counting both,
**108 commands have neither a wrapper nor a direct dispatch** — they are structurally unreachable from
any client. A further ~26 have a wrapper the UI never calls, which is where the audit's figure of 134
comes from.

`features/command-management` does not change this: it reads `/commands/features` and PATCHes
enable/disable flags. It is a feature-flag admin screen, not a general command executor.

### Verified counts

| | Count | Source |
|---|---|---|
| Commands with a handler | **202** | `case "x.y"` across 11 `*command-center-consumer.ts` files |
| Wrapped in a gateway REST action | **81** | `commandName:` in `Apps/api-gateway/src/**` |
| Dispatched directly by the UI | **22** | `commands/<name>` in `UI/**` |
| Neither wrapped nor dispatched | **108** | set difference |
| Catalogued but **no handler at all** | **7** | `UNIMPLEMENTED` in `flow-command-catalog.test.ts` |

## Breakdown of the 108

| Namespace | Count | Owner spec |
|---|---|---|
| `revenue.*` | 32 | [05-revenue-module-status.md](05-revenue-module-status.md) |
| `billing.*` | 17 | `accounts-gaps/` + [12-billing-partials.md](12-billing-partials.md) |
| `ar.*` | 13 | [03-ar-account-management.md](03-ar-account-management.md) |
| `reservation.*` | 11 | this spec |
| `operations.*` | 6 | this spec (maintenance + staff scheduling) |
| `integration.*` | 5 | [14-channel-distribution.md](14-channel-distribution.md) |
| `rooms.*` | 5 | this spec |
| `commission.*` | 4 | `accounts-gaps/` |
| `settings.*` | 4 | see caveat below |
| `inventory.*` | 3 | this spec |
| `loyalty.*` | 3 | see caveat below |
| `metasearch.*` | 3 | [14-channel-distribution.md](14-channel-distribution.md) |
| `group.*` | 2 | `accounts-gaps/17-group-master-billing.md` |

### Two known false positives in that table

- **`loyalty.points.earn` / `.redeem` are reachable.** `UI/pms-ui/src/app/features/loyalty/loyalty.ts:124`
  dispatches `` `commands/loyalty.points.${kind}` `` — a dynamically assembled name the static scan
  cannot resolve. `loyalty.points.expire_sweep` is a sweep job, not a user action. Treat `loyalty.*` as
  covered.
- **`settings.value.*` capability exists over REST.** `features/settings` writes via
  `PUT /settings/values/:id`, not the command bus. The 4 commands are unused, not the capability. Decide
  whether the REST path or the command path is canonical and delete the other.

Apply the same scepticism to any single row before treating it as work: a dynamically built command
name or a REST equivalent will read as unreachable here.

## Genuinely Missing Operator Actions

These are the ones with no owner spec and no alternative path — the actionable residue of this audit.

### `reservation.*` (11)

`reservation.create`, `reservation.convert_quote`, `reservation.send_quote`, `reservation.batch_no_show`,
`reservation.generate_registration_card`, `reservation.walk_guest`, `reservation.expire`,
`reservation.waitlist_offer`, `reservation.waitlist_expire_sweep`, `reservation.mobile_checkin.start`,
`reservation.mobile_checkin.complete`.

**`reservation.create` is the notable one** — check-in, check-out, modify, cancel, assign-room and
walk-in check-in are all wrapped and used, so reservations are clearly being created somehow (likely a
REST create endpoint on the gateway). Confirm which path `features/reservations` uses; if it is a REST
create that bypasses the command, that is a consistency problem worth naming, not a missing screen.

Real gaps here: **quote lifecycle** (`send_quote` → `convert_quote`) has no UI at all, and
**`walk_guest`** (relocating an oversold guest to another property) is an operationally critical action
with no button. `batch_no_show` belongs in the night-audit flow. `expire` and `waitlist_expire_sweep`
are sweeps. `mobile_checkin.*` is the guest portal — see
[11-self-service-coverage.md](11-self-service-coverage.md).

### `operations.*` (6)

`operations.maintenance.request|assign|complete|escalate`, `operations.schedule.create|update`.

Handled in housekeeping-service, no wrapper, no UI. Maintenance is a core front-of-house workflow —
a guest reports a fault, someone must log and assign it. `features/housekeeping` exists and reaches
`housekeeping.task.*` through wrappers, so the pattern to copy is right there. Staff scheduling
(`schedule.*`) is a separate product question: decide whether Tartware does labour scheduling at all
before building it. Note `/v1/reports/maintenance-sla` (COV-10) reports on data nothing can create
through the product.

### `rooms.*` (5)

`rooms.inventory.block`, `rooms.inventory.release`, `rooms.key.issue`, `rooms.key.revoke`, `rooms.move`.

`rooms.status.update`, `rooms.out_of_order`, `rooms.out_of_service`, `rooms.features.update` and
`rooms.housekeeping_status.update` *are* wrapped, so the rooms screen is mostly covered. The gaps:
**inventory block/release** (holding rooms off sale for a reason other than OOO/OOS) and **key
issue/revoke** — the latter is a security matter, and COV-11 proposes exposing keys to guests. Do not
ship guest-visible keys without a staff revoke path.

### `inventory.*` (3)

`inventory.lock.room`, `inventory.release.room`, `inventory.release.bulk` — handled by
`availability-guard-service`. These are almost certainly internal (the guard locking inventory during a
booking transaction), not operator actions. **Verify, then exclude them from this count** rather than
building UI.

## Work Required

1. **Split the list by intent, once.** Every one of the 108 is exactly one of:
   (a) an operator action needing UI, (b) a machine/scheduled action correctly having no UI,
   (c) dead surface to retire. The audit cannot tell these apart; a person can, in an afternoon.
   Record the classification in this file.
2. **Discharge the ones with owner specs** through those specs — do not build a generic command
   console instead.
3. **Add a reachability check to CI.** `flow-command-catalog.test.ts` already asserts every catalogued
   command has a handler and a claimed target service. Extend the same idea: every handled command must
   be classified as operator-facing, machine-facing, or deprecated, with operator-facing ones required
   to have a wrapper or a UI dispatch. That turns this audit from a one-off into a standing invariant —
   otherwise it will need re-running in six months.
4. **Re-run after Phases 2–5** of `00-CONSOLIDATED.md`. Whatever is still unreachable and classified
   (c) gets deleted.

## Acceptance

- ~~All 108 classified (a) / (b) / (c) in this file.~~ — **done 2026-08-18.** 95, not 108;
  the classification is the table at the top.
- Category (a) items have an owning spec or a shipped UI path. — **partly.** Every (a) item now
  names its owner. `operations.maintenance.*` (4) is the largest with no spec of its own.
- Category (c) items are deleted, along with their schemas and catalog rows. — **open.**
  9 identified: `settings.value.*` (4), `inventory.*` (3), `reservation.mobile_checkin.*` (2),
  plus `reservation.waitlist_expire_sweep` once its job is confirmed canonical.
- ~~CI fails when a new operator-facing command lands with no reachable path.~~ — **partly done
  2026-08-18.** `flow-command-catalog.test.ts` now asserts every `requiredCommands` entry is
  dispatchable, with a `KNOWN_UNREACHABLE` allowlist seeded at 12 that may only shrink. Verified to
  fail in both directions: removing an entry that is still unreachable, and allowlisting one that has
  become reachable.

  **The broader check — "every operator-facing command must have a reachable path" — was not built,
  and should not be until the (a)/(b)/(c) split is machine-readable.** It needs the classification as
  data, not prose, or it cannot tell a missing screen from a correctly headless sweep. The flow-registry
  check was buildable now precisely because `requiredCommands` is already a declared list: the system
  states the requirement itself, so the test needs no judgement.

## New work this classification created

1. ~~**Three operations never run.**~~ — **two fixed 2026-08-18** (quote expiry, loyalty points
   expiry; both were missing schedulers, not missing logic). The third, `reservation.batch_no_show`,
   turned out to run via night audit — but by an implementation that emits no event and releases no
   room. **That is now the open item**, and it needs a call from whoever owns the night-audit
   transaction. It is a correctness bug, not a coverage gap, and belongs to no existing spec.
2. **Retire the 9 category (c) commands**, with their payload schemas, validators and catalog rows —
   the same shape as the three deletions recorded in `00-CONSOLIDATED.md` on 2026-08-13.
3. **Decide `operations.schedule.*`** — whether Tartware does labour scheduling at all. Two commands
   and a table hang on it.
4. **Shrink `KNOWN_UNREACHABLE`** as owners wire their commands. Six of the twelve are
   `revenue.*` / `billing.pricing.*` and clear themselves the moment COV-05 is decided either way.

## Cross-reference

Owner specs: 03 (ar), 05 (revenue), 12 (billing), 14 (integration/metasearch), 11 (mobile check-in),
plus `accounts-gaps/` for commission and group billing.

---

## ✅ `settings.value.*` ×4 retired — 2026-08-21

The step this spec named as "the next concrete step" is done. All four commands
(`settings.value.set` / `.bulk_set` / `.approve` / `.revert`) are gone: 4 catalog rows, 4 validator
registrations, the payload schema module (`schema/src/events/commands/settings.ts`) and its barrel
export, the consumer, the command service, the local re-export shim in `core-service/src/schemas/`,
the consumer metrics module, and the startup wiring in `core-service/src/index.ts`.

**The one capability check worth recording.** `approveSettingsValue` did something the surviving REST
path does not: it expired the previously-ACTIVE sibling value at the same scope in the same statement.
That is not a live regression — nothing creates `PENDING` rows (the settings screen PATCHes the row in
place, and `POST` defaults to `ACTIVE`), the resolver already breaks ties with
`ORDER BY updated_at DESC`, and `settings_values` has no uniqueness constraint to violate. But if an
approval workflow is ever wanted for settings, it is a REST concern now, and the sibling-expiry is the
part to re-implement rather than the command.

Guardrails after the removal: `sql:contracts` 0 violations across 247 tables / 760 files, gateway
conformance 33/33, command-catalog conformance 11/11 (including "registers a payload validator for
every catalogued command" and "seeds a catalog entry for every command a consumer handles" — the two
that would fail on a half-finished retirement), core-service 182/182.

**Unreachable is now 65 of 191.**

### 🐛 The orphan hot-reload listener was worse than "no producer" — fixed 2026-08-21

This spec recorded billing-service subscribing to `settings.events` for a message nobody sends. The
producer *does* exist: `settings-values-repository.ts` enqueues the exact envelope billing expects into
`transactional_outbox` inside the write transaction. What was missing is a **relay**. The rows carry
`aggregate_type = 'setting'`, and the only dispatcher in the system claimed
`aggregate_type = 'reservation'` — so they were written and never drained.

Fixed with `core-service/src/jobs/settings-outbox-dispatcher.ts`, which claims `setting` rows and
publishes them to `settings.events`. Core-service's Kafka surface, which existed only to feed the
retired command consumer, now carries this instead.

**Verified against a running stack**, per the lesson this backlog has now recorded three times:
outbox row → `DELIVERED` on the first poll → message present on `settings.events` in the expected
envelope → billing-service's consumer group at offset 1/1, **lag 0**. Every hop observed, not inferred.

### 🐛 Five aggregate types were being enqueued and never dispatched — fixed 2026-08-21

Found while checking the outbox table for the above. `reservations-command-service` enqueues five
aggregate types and its dispatcher claimed **one**:

| Aggregate type | Events | Consumer that never heard them |
|---|---|---|
| `group_booking` | `group.created`, `group.rooms_added` | notification-service → `GROUP_BOOKING_CONFIRMED` |
| `ota_sync` | `integration.ota.availability_synced`, `.rates_pushed`, `.content_synced` | — |
| `webhook` | `integration.webhook.retried` | — |
| `integration_mapping` | `integration.mapping.updated` | — |

**16 rows were sitting PENDING in the dev database, the oldest for a day.** So every group booking
made through `group.create` — a shipped, reachable flow — silently failed to send its confirmation
notification. The `integration.*` four are the commands COV-14's distribution screen drives.

`claimOutboxBatch` now takes a set as well as a single type, and the dispatcher names all five in
`DISPATCHED_AGGREGATE_TYPES` with the rule written next to it. Verified live: on restart the
dispatcher drained all 16 stranded rows to `DELIVERED`, and a second restart logs zero errors and zero
warnings.

**The shape to remember:** an outbox row is written inside the business transaction, so the write
looks completely successful — the command succeeds, the row is committed, the API returns 200. The
only symptom is a consumer that stays quiet. Nothing in a type checker, a conformance suite or an API
test can see it; the evidence is `SELECT aggregate_type, status, count(*) FROM transactional_outbox
GROUP BY 1,2`, which is worth running after any command work.

**A guardrail is possible here and is not yet built.** Every `aggregateType:` literal in a service's
`enqueueOutboxRecord*` calls must appear in that service's dispatcher filter — both halves are
literals in the source, so the check needs no judgement, unlike the operator-facing classification
this spec declined to automate.

### ❓ Open decision: the settings screen and settings enforcement use different stores

Surfaced while trying to drive the settings write path end to end. `core-service` picks its settings
store from `SETTINGS_DATA_SOURCE`, which defaults to `"seed"` and **is set to `db` nowhere** — not in
any `dev:*` script, compose file, workflow or manifest; `.env.example` pins it to `seed`. So today:

| | Store |
|---|---|
| `GET`/`POST`/`PATCH /v1/settings/values` — what the settings screen uses | in-process array built from `data/settings-values.ts` |
| `settings-resolver-service` — what enforcement uses | `settings_values` in Postgres, no seed branch |
| billing-service's business-calendar loader | the REST endpoint, so the seed store |

Two consequences, both verified against the dev database, where `settings_definitions` and
`settings_values` hold **0 rows each**:

1. **A value saved in the settings screen is lost on restart** and never reaches the resolver.
   `password-policy-service` is the resolver's only consumer, and it falls back to the PCI defaults
   with `Math.max(configured, PCI_MIN_LENGTH)` — so this **fails safe, not open**: a tenant hardening
   its password policy through the UI simply gets no hardening. It is a silently inert setting, not a
   weakened one.
2. **The outbox enqueue in `settings-values-repository.ts` only runs in `db` mode**, so the
   hot-reload path fixed above is correct and proven but dormant under the default configuration.

**This is a product decision, not a bug to fix quietly:** either `settings_values` is canonical and
the seed store is a fixture (turn `SETTINGS_DATA_SOURCE=db` on and seed the catalogue —
`settings_definitions` needs `category_id` and `section_id`, so it is three tables, not one), or the
seed file is canonical and the DB-backed half — repository, resolver, outbox enqueue and the
`settings_values` table — is dead surface of exactly the kind this spec retires. It cannot be both,
and it currently is.

### ✅ Guardrail built — `outbox-dispatch-conformance.test.ts`, 2026-08-21

Lives in `Apps/command-consumer-utils/tests/`, so the existing "Command catalog conformance" step in
`ci-guardrails.yml` already runs it on every branch. Needs no database and no running stack.

Four assertions: the scan finds enqueue sites and dispatchers at all (a scanner matching nothing
reports green forever); every `aggregateType:` is readable as a **literal**; every service that polls
declares `DISPATCHED_AGGREGATE_TYPES`; and no enqueued type goes unclaimed.

**Literal-only on both sides, deliberately.** Resolving identifiers and config lookups would mean
evaluating the code to be right, and this repo has already thrown away one fuzzy matcher for pairing
`TenantStatusEnum` with `membership_status`. A non-literal `aggregateType` therefore *fails* the check
rather than being skipped — core-service's own enqueue was changed from a constant back to `"setting"`
to satisfy it.

**One exemption, and it is self-justifying.** `command` rows are never claimed: api-gateway publishes
on the request path and settles by event id, so the row is a durability record, not a queue entry.
`INLINE_SETTLED_AGGREGATE_TYPES` records that with its reason, and a companion test fails if nothing
calls `markOutboxDeliveredByEventId` any more, or if the exemption names a type nobody enqueues — so
the exemption cannot outlive its mechanism or quietly become permission.

**Verified to fail in both directions**, by re-introducing each bug it was written for: dropping
`group_booking` from the reservations list reports *"enqueues "group_booking" but its dispatcher does
not claim it"*, and emptying core-service's list reports both the missing declaration and the stranded
`setting` type.

#### Decision: `settings_values` is canonical — recorded 2026-08-21, implementation not started

Delegated back and decided rather than left open. The DB half wins on the evidence:

- **Enforcement already reads it.** `settings-resolver-service` has no seed branch, and it is what
  `password-policy-service` calls. Making the seed file canonical means either rewriting the resolver
  or accepting that no tenant can ever override a password policy.
- **The seed store loses writes on restart** — it is a module-level array. A settings screen that
  forgets what you saved is not shippable, whichever store is nominally canonical.
- **The DDL is clearly the designed home**: scope hierarchy, `inheritance_path`,
  `inherited_from_value_id`, `effective_from`/`_to`, `locked_until` for approvals. The seed store
  implements a fraction of that.
- Billing's business-calendar loader reads over REST either way, so it is neutral on the choice — but
  its hot-reload only functions on the DB path.

**Sizing, so this is not mistaken for a flag flip.** 144 definitions across 13 files
(`core-service/src/data/catalog/`, ~1,900 lines) plus 14 values, and `settings_definitions` requires
`category_id` and `section_id`, so `settings_categories` and `settings_sections` have to be seeded
first. The work is: generate the SQL seed from the existing TS catalogue, set
`SETTINGS_DATA_SOURCE=db` in the dev scripts / compose / workflows, then verify in a browser that the
settings screen still renders all 13 categories and that a save survives a restart — the screen is the
only consumer that would notice a partial migration, and it will not be visible to any API test.

Until that lands, `seed` remains the default and both halves stay as they are: the DB path is correct
and proven but dormant, exactly as the outbox dispatcher above is.
