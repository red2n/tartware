# API ↔ UI Coverage — Gap Analysis

> **Source:** API ↔ UI Coverage Audit (static analysis of `pms-ui` + `guest-portal` against 9 backend services)
> **Verified against:** `main` @ `edbf3e9c` — every count below re-derived from route files, command consumers and the schema package
> **Audited:** 635 route registrations across `Apps/*/src/routes/**`, 202 commands across 11 command consumers, both Angular front-ends
> **Date:** 2026-08-11
> **Commit tag:** `COV-nn`

---

## Headline

**The audit's "no broken UI wiring" holds only one hop deep.** Every call `pms-ui` and `guest-portal`
make does resolve to a gateway route — but the audit never checked whether the gateway's target
service registers the path it forwards. It often did not. **16 gateway routes proxied to paths no
service implemented**, and two of them were called by `pms-ui`: guest GDPR export and the guest consent
ledger both 404ed for real users. All 16 are fixed as of 2026-08-11 and CI now enforces the invariant —
see [10-reports-coverage.md](10-reports-coverage.md)(a) and
[19-gateway-proxy-mismatches.md](19-gateway-proxy-mismatches.md).

Beyond that, the gap is one-directional as reported: backend surface that no screen can reach.

**The audit also understated one thing and overstated another**, both corrected below:

- **Understated:** several "no UI" domains are also **read-only on the backend** — there is no
  write API and no command handler either. Building a screen for them is not a UI task; it needs a
  write path first. See [18-write-path-gap.md](18-write-path-gap.md).
- **Overstated:** endpoint counts per domain included the API gateway's `GET` + `ALL /*` proxy pair,
  so a single downstream `GET` was counted as 2–6 endpoints. Real per-domain counts are in each spec.

And two findings the audit did not make at all:

- **8 gateway report endpoints proxied to core-service paths that do not exist** — they 404ed
  regardless of UI. **Fixed 2026-08-11**, with a conformance test to prevent recurrence. See
  [10-reports-coverage.md](10-reports-coverage.md).
- **That test then found 8 more mismatches elsewhere in the gateway**, including the two live
  user-facing 404s above and a command (`guest.consent.update`) that the gateway dispatched and nobody
  handled — accepted, 202, silently dropped. **All 8 fixed 2026-08-11**; the allowlist is empty and CI
  now holds all 127 proxied routes to a registered downstream path. See
  [19-gateway-proxy-mismatches.md](19-gateway-proxy-mismatches.md).

---

## What Already Works

- ✅ Reservations, rooms, housekeeping, guests, groups, rates, rate calendar, loyalty, packages — wired
- ✅ Accounts → Receivable (transaction-level), folios, invoices, payments, night audit, cashiering
- ✅ Command dispatch works through two paths: 22 direct `POST /commands/<name>` calls from the UI,
  plus 81 commands wrapped in REST action endpoints on the gateway (`commandName:` declarations)
- ✅ Reports screen is data-driven from `UI/pms-ui/src/app/features/reports/report-defs.ts` —
  adding a report is one table entry
- ✅ Guest portal covers search → book → lookup → check-in start/complete
- ✅ Flow-guard / command catalog conformance tests already fail the build on mis-wired commands

---

## Verified Numbers

| Metric | Audit | Verified | Note |
|---|---|---|---|
| UI calls hitting a missing route | 0 | 0 | confirmed |
| Backend endpoints | 428 | 635 raw registrations | raw count includes gateway proxy pairs |
| Commands total | 199 | **203** | `case` labels across 11 consumers (re-derived 2026-08-18) |
| Commands reachable from the gateway | 75 | **83** | incl. ternary and wrapper-factory forms a `commandName:` regex misses |
| Commands dispatched directly by UI | 21 | **26** | `/commands/<name>` in `UI/*`, incl. the resolved dynamic dispatch |
| Commands with **no** wrapper and **no** direct dispatch | — | **95** | structurally unreachable — all classified 2026-08-18 |
| Commands unreachable *from the UI* | 134 | **95** | was overstated: the scan missed two dispatch forms, see [17](17-command-reachability.md) |
| Domains with zero UI presence | 16 | 16 | confirmed by whole-word search |
| Catalogued commands with no handler anywhere | — | **4** | was 7; three deleted 2026-08-13 rather than implemented |

---

## Gap Summary — By Priority

### P0 — Statutory & Legal (2 gaps)

| # | Gap | File | Type | Effort |
|---|-----|------|------|--------|
| 01 | Data-breach register & regulator notification — **✅ shipped 2026-08-11** | [01-compliance-breach-incidents.md](01-compliance-breach-incidents.md) | UI | done |
| 02 | Police incident register was read-only — **✅ write path + UI shipped 2026-08-11** (premise corrected: not guest-registration reporting) | [02-police-reports.md](02-police-reports.md) | Backend+UI | done |

### P0 — Unblock Direct Billing (2 gaps)

| # | Gap | File | Type | Effort |
|---|-----|------|------|--------|
| 03 | AR account management — **✅ core slice shipped 2026-08-11** (create + terms + statement + aging); 9 `ar.*` actions deferred | [03-ar-account-management.md](03-ar-account-management.md) | UI | part |
| 04 | Two AR surfaces on two tables — **✅ decided: `ar_accounts` canonical**, collapse work in COV-03 | [04-duplicate-ar-surface.md](04-duplicate-ar-surface.md) | Decision+Backend | done |

### P1 — Product Decisions (2 gaps)

| # | Gap | File | Type | Effort |
|---|-----|------|------|--------|
| 05 | revenue-service — **✅ investigated + 4 working analyses shipped 2026-08-13**; only 5 of 20 reads return data, decision on the other 15 open | [05-revenue-module-status.md](05-revenue-module-status.md) | Decision | part |
| 18 | Read-only domains have no write path — **✅ mechanism decided, 13 phantom-write proxies closed + guardrail 2026-08-13**; converse guardrail closed 2026-08-18. Event bookings 2026-08-18, banquet orders 2026-08-19, and event billing 2026-08-19 — the first write to take the **command** branch of the rule rather than plain HTTP. Allotments still lack writes | [18-write-path-gap.md](18-write-path-gap.md) | Backend | part |

### P0 — Live Broken Endpoints (✅ closed 2026-08-11)

| # | Gap | File | Type | Effort |
|---|-----|------|------|--------|
| 19 | 8 gateway routes proxied to non-existent handlers — **all fixed**, allowlist empty, enforced in CI | [19-gateway-proxy-mismatches.md](19-gateway-proxy-mismatches.md) | Bug | done |

### P1 — Broken & Partial Coverage (3 gaps)

| # | Gap | File | Type | Effort |
|---|-----|------|------|--------|
| 10 | Reports — **✅ 8 gateway 404s fixed + 7 reports wired 2026-08-11**; `audit-trail` left to ACCT-23 | [10-reports-coverage.md](10-reports-coverage.md) | Bug+UI | done |
| 11 | Guest portal — **✅ all 14 self-service endpoints wired 2026-08-11** (checkout, keys, rewards, reg card, resume) | [11-self-service-coverage.md](11-self-service-coverage.md) | UI | done |
| 12 | Billing partials — **✅ approvals + flow-guard bypass log shipped 2026-08-11**; suspense/GL/audit trail owned by `accounts-gaps` | [12-billing-partials.md](12-billing-partials.md) | UI | part |

### P1 — Operations Domains (4 gaps)

| # | Gap | File | Type | Effort |
|---|-----|------|------|--------|
| 06 | Incident log — **✅ closed 2026-08-13**: module gate fixed (was 403 for every tenant), detail contract fixed, UI shipped | [06-incidents.md](06-incidents.md) | UI | done |
| 07 | Lost & found — **✅ shipped 2026-08-13**: duplicate deleted, gateway repointed, UI built | [07-lost-and-found.md](07-lost-and-found.md) | UI+cleanup | done |
| 08 | Front-desk shift handovers — **✅ write path + UI shipped 2026-08-13** | [08-shift-handovers.md](08-shift-handovers.md) | Backend+UI | done |
| 09 | Guest feedback — **✅ closed 2026-08-13**: write path, staff inbox and guest-portal intake all shipped | [09-guest-feedback.md](09-guest-feedback.md) | Backend+UI | done |

### P2 — Commercial Surfaces (4 gaps)

| # | Gap | File | Type | Effort |
|---|-----|------|------|--------|
| 13 | Sales & catering — **✅ decided: build 2026-08-17**; meeting-room + event-booking write paths shipped and smoke-tested, event-billing decision **answered 2026-08-18** (`event_bookings.folio_id`), **UI items 1 + 2 + 4 shipped 2026-08-18**, banquet orders + BEO editor **2026-08-19**, the midnight limitation **closed 2026-08-19**, **event billing** and the **daily BEO / kitchen view shipped 2026-08-19**. Acceptance discharged and the UI list complete: function space can be booked, a BEO produced, the day worked from a printed sheet and recorded back, and event revenue lands on a folio | [13-sales-catering.md](13-sales-catering.md) | Backend+UI | **done** |
| 14 | Channel / distribution — **✅ health screen + reference-data CRUD shipped 2026-08-13**; `/v1/ota-connections` found to be a projection of `channel_mappings`, not a domain. Mapping/metasearch UI open | [14-channel-distribution.md](14-channel-distribution.md) | Backend+UI | part |
| 15 | Two booking engines — **✅ closed: `/v1/direct-booking` deleted** (unguarded write path, no callers) | [15-booking-engine-duplication.md](15-booking-engine-duplication.md) | Decision | done |
| 16 | Booking reference data — **✅ promo code CRUD + waitlist screen shipped 2026-08-13**; both "duplicates" were misdiagnosed and are load-bearing. Allotments still open | [16-booking-reference-data.md](16-booking-reference-data.md) | Backend+UI | part |

### P2 — Cross-Cutting (1 gap)

| # | Gap | File | Type | Effort |
|---|-----|------|------|--------|
| 17 | **✅ classified 2026-08-18**: 95 unreachable (not 108), split a/b/c. Found 3 sweeps with **no invoker at all** and 12 flow-declared commands that are unreachable | [17-command-reachability.md](17-command-reachability.md) | Audit+UI | part |

---

## Relationship to `accounts-gaps/`

These overlap and must not be double-implemented. `accounts-gaps/` owns the **billing correctness**
work; `ui-gaps/` owns **reachability**. Where both touch the same screen, `accounts-gaps` wins and
this backlog only records the coverage fact.

| ui-gaps | Overlaps | Resolution |
|---|---|---|
| COV-03 (AR account mgmt UI) | ACCT-17 group master billing | COV-03 owns `ar_accounts` CRUD; ACCT-17 owns group folio linkage |
| COV-12 (approvals UI) | ACCT-08 approval workflows | Backend shipped; COV-12 is the UI half of ACCT-08 |
| COV-12 (GL batch viewer, audit trail) | ACCT-23, ACCT-24 | Already specced there — COV-12 references, does not duplicate |
| COV-12 (suspense items) | ACCT-03 suspense account | Read endpoint exists; UI blocked on ACCT-03 |
| COV-05 (revenue module) | ACCT-13 FX locking | Independent |

---

## Dependency Chain

```
COV-18 (write paths) ──┬──► COV-02 (police reports UI)
                       ├──► COV-06 (incidents UI)
                       ├──► COV-08 (shift handovers UI)
                       ├──► COV-09 (guest feedback UI)
                       ├──► COV-13 (sales & catering UI)
                       ├──► COV-14 (channel/distribution UI)
                       └──► COV-16 (booking reference data UI)

COV-04 (canonical AR) ──► COV-03 (AR account management UI)
COV-05 (revenue decision) ──► 32 of the 108 unreachable commands in COV-17
ACCT-03 (suspense) ──► COV-12 (suspense UI)
ACCT-09 (audit trail) ──► COV-12 (audit trail UI)
```

Note the shape: **7 of the 16 zero-UI domains are blocked on the same backend gap (COV-18)**.
Doing COV-18 once unblocks them all; doing them one at a time re-litigates the same decision seven times.

---

## Recommended Implementation Order

**Phase 1 — Fix what is broken (days, not weeks)**
1. ~~COV-10a: 8 gateway report endpoints proxying to non-existent core paths~~ — **done 2026-08-11**,
   plus `proxy-route-conformance.test.ts` as the standing guardrail
2. ~~COV-19 items 1–2: guest GDPR export and consent ledger — live 404s on a statutory path, and a
   dispatched command with no handler~~ — **done 2026-08-11**; `guest.consent.update` now has a
   payload schema, validator, catalog row and handler, and consent is stored append-only
3. ~~COV-19 items 3–5: delete the 3 dead `/v1/availability*` routes, fix the cashier shift-summary
   target, drop the two bare-prefix registrations~~ — **done 2026-08-11**; cashiering resolved to
   billing-service and the housekeeping read duplicate deleted. Allowlist empty.
4. ~~COV-04: decide the canonical AR surface~~ — **decided 2026-08-11: `ar_accounts` is canonical.**
   Deprecated surface annotated; the collapse work moves into COV-03.
5. ~~COV-15: decide which booking engine is canonical~~ — **closed 2026-08-11: `/v1/direct-booking`
   deleted.** Tracing it found an unguarded write path, not just a duplicate.

**Phase 1 is complete.** Next up is Phase 2 (statutory): COV-01 breach-incident register UI, then
COV-18's police-reports slice + COV-02.

**Phase 2 — Statutory**
4. ~~COV-01: breach-incident register UI~~ — **done 2026-08-11**
5. ~~COV-18 (police-reports slice) + COV-02~~ — **done 2026-08-11.** COV-18's mechanism decision is
   recorded (the discriminator is cross-service reach, not audit significance) and COV-02 shipped a
   write path plus UI. **Phase 2 complete.**

**Note for Phase 3+:** COV-02's premise was wrong in the original audit read — `/v1/police-reports` is
a police *incident* register, not statutory guest-registration reporting. The latter has no table
anywhere and is a genuine unlogged gap if a jurisdiction requires it.

**Phase 3 — Unblock direct billing**
6. ~~COV-03: AR account management UI~~ — **core slice done 2026-08-11.** Accounts can be opened and
   their terms changed through the product, so `ar_accounts` is no longer structurally empty.
   Surfaced: `/v1/companies` is read-only, so COV-16's company CRUD is now a prerequisite for
   onboarding a corporate client.
7. ~~COV-12: approvals + flow-approvals UI~~ — **done 2026-08-11.** Found 22 unread `flow_approvals`
   rows in dev. **Phase 3 complete.**

**Phase 4 — Cheap coverage wins**
8. ~~COV-10b: missing entries in `report-defs.ts`~~ — **7 added 2026-08-11**
9. ~~COV-11: guest-portal check-out, keys, rewards, registration card~~ — **done 2026-08-11.** **Phase 4 complete.**

**Phase 5 — The revenue decision**
10. COV-05: build a front-end or retire the service. 32 commands and 20 endpoints hang on this.

**Phase 6 — Remaining write paths + screens**
11. ~~COV-07: lost & found~~ — **done 2026-08-13.** Started here because it was the only fully
    unblocked item; tracing it found the gateway proxying the domain to the *read-only* copy, so the
    complete backend in housekeeping-service had never been reachable. Two guardrail lessons:
    the proxy-conformance test skips `ALL /*` wildcards, which is exactly where writes get swallowed;
    and a bare `POST` needs its own gateway registration every time.
12. ~~COV-06, COV-08, COV-09, COV-14 step 1~~ — **done 2026-08-13.** Three write paths added, all
    plain HTTP per COV-18's rule, plus the channel-health screen over commands that already existed.
13. ~~COV-16 promo codes + waitlist~~ — **done 2026-08-13.** ~~COV-13~~ — **closed 2026-08-19**:
    meeting-room writes 2026-08-17, **event-booking writes, the event-billing decision, and UI items
    1 + 2 + 4 on 2026-08-18**, then banquet orders, the BEO editor, the midnight fix, event billing
    and the day sheet on 2026-08-19. Remaining: COV-16's allotments, COV-14's CRUD half, and the UI
    for both
14. COV-17: re-run reachability once the above land; whatever remains is dead surface to retire

**`UNIMPLEMENTED` is down from 7 to 4** — `compliance.breach.report`, `.notify` and
`operations.incident.report` were **deleted** (catalog row, payload schema, validator), because each
describes a write that already exists as plain HTTP on the owning service. Keeping them would have
meant two write paths for one table, one of which silently drops every message. That discharges most
of COV-18's third acceptance criterion.

**Schema enums drifting from their CHECK constraints — ✅ closed 2026-08-13.**

Found in five specs (COV-07, COV-08, COV-16 twice, plus `CompanyTypeEnum`), then measured across the
repo: **41 enums** whose value set matched a constraint modulo case, and **3 live call sites** papering
over it with `.options.map(t => t.toLowerCase())` — `CompanyTypeEnum`, `CreditStatusEnum`, `TaxTypeEnum`.

**It was not cosmetic.** COV-16 found three list filters comparing `UPPER($n)` against lowercase CHECK
columns, matching nothing — the drift reaching live SQL.

**Fixed by aligning, not deleting.** The earlier note here recommended deleting the unused ones; that
was wrong. Most carry `@database <column>` annotations, so they are meant to be the canonical enum for
that column — deleting them invites the next author to re-invent them in UPPERCASE, which is how this
started. 38 were rewritten to the constraint's exact spelling (plus a companion label map keyed by the
old values), the 3 live call sites dropped their `.toLowerCase()` folding, and all 20 projects
typecheck. Three were left alone (`InAppNotificationPriorityEnum`, `CriticalityLevelEnum`,
`ImpactLevelEnum`): several constraints share their value set with different spellings, so the column
pairing is ambiguous and wants a human decision.

**No conformance test.** One was built and thrown away: enum→column matching is only heuristic, and the
fuzzy version paired `TenantStatusEnum` with `membership_status` and `SettingsValueStatusEnum` with
`warranty_status`. A test that cries wolf is worse than none. The alignment above removes the standing
defect; a future guard would need an explicit enum↔column annotation to be trustworthy.

**Typecheck + conformance is not evidence that a write path runs — measured 2026-08-13 … 2026-08-18.**

COV-13's two shipped slices were both fully typechecked and passed the gateway conformance suites.
The first time a running stack touched them (`http_test/smoke-events.sh`, 2026-08-18), meeting rooms
were clean and **every event-booking write returned 500** — for two independent reasons, each of a
kind that only exists at runtime:

- **A response schema that does not match what the handler sends.** Fastify compiles the declared
  success schema into a serializer, so `{ data, message }` against a declared bare item fails
  *after* the handler has run — the row is already committed when the caller gets its 500. The type
  checker sees the route's declared schema and the handler's `.send()` argument as unrelated values.
- **SQL that will not prepare.** `booking_status = $3` alongside `CASE WHEN $3 = 'CONFIRMED'` makes
  Postgres deduce two types for one parameter and reject the statement. Nothing outside a live
  database evaluates a SQL string.

The lesson for the remaining write paths (banquet orders, allotments): budget the smoke test as part
of the slice, not as follow-up hygiene. Both bugs took minutes to find with a stack running and were
invisible to every gate that ran without one.

**Seven write paths, first run — measured 2026-08-19.**

`http_test/smoke-operations.sh` (52 assertions) was built to answer one question: what is wrong with
the write paths shipped on 2026-08-11 and 2026-08-13 that nothing has ever executed? `run-api-tests.sh`
reaches all of them, with `GET` only. The first run failed 11 of 52, in three distinct ways:

| Finding | Domain | Shape |
|---|---|---|
| `PUT`/`DELETE` 500: `column "updated_at" does not exist` | booking sources ([14](14-channel-distribution.md)) | The table is missing two audit columns AGENTS.md requires and every sibling table has |
| Duplicate code → 500 instead of 409 | booking sources, market segments, promo codes | No service caught `23505`, on the most likely operator mistake there is |
| `POST` 400 `closed_at Required` *after* the insert committed | incidents ([06](06-incidents.md)) | `toIsoString` answers `undefined`; the schema says `.nullable()` |

All fixed; 52/52 now, and `smoke-events.sh` still 133/133.

**And one finding bigger than the suite.** Before any of the above was reachable, lost & found and
incidents answered **403 `TENANT_MODULE_NOT_ENABLED`** for every call. The auth gate reads
`tenants.config -> 'modules'`, and the demo tenant seed has no `modules` key — so a freshly seeded
database grants `core` alone and every route gated on `facility-maintenance`, `finance-automation`,
`revenue-management`, `loyalty` or `distribution` is dark. `seed-default-data.mjs` meanwhile populated
a *different* column (`user_tenant_associations.modules`) with three ids that are not `MODULE_IDS`
entries. Both fixed.

The reason this survives is recorded in [06](06-incidents.md) and worth repeating here: **the E2E
sweep scores `403 TENANT_MODULE_NOT_ENABLED` as a skip.** A whole domain can be switched off and every
suite stays green.

**Two commands nobody could have run — measured 2026-08-19.**

COV-13's event-billing slice (UI item 6) is the first write in this module that crosses services, so it
is the first to go on the command bus per COV-18. Building it over the existing billing handlers turned
up two defects in code that typechecks, passes every conformance suite, and cannot work:

- **`billing.charge.post` added a CREDIT posting to the folio balance instead of subtracting it.** The
  table's own comment defines the opposite, `comp-post.ts` has always subtracted, and the same handler
  already swaps the GL pair for a credit — only the balance update was unconditional. Every refund,
  allowance and the room-move `DOWNGRADE_CREDIT` raised the bill. The event discount is what exposed
  it: −550 arrived as +550 and the folio came out 1100 high.
- **`billing.group.setup` never ran.** `ON CONFLICT (tenant_id, folio_number)` names two of the three
  columns in `uk_folios_number`, which is not a valid inference target, so the statement does not
  prepare and every dispatch failed. It was found by *reading* it as the model for the event folio —
  the same class as slice 2's `CASE WHEN $3` cast, and the same blind spot: nothing that does not
  execute SQL can see it.

Both are fixed. The general point is narrower than "run a smoke test": **the existing handler you are
about to model yours on may never have executed.** A command's catalog row, validator, handler and
conformance coverage all being present says nothing about whether it has ever been dispatched, and
`command_features` seeds new commands `disabled`, so "unused" is the default state rather than an
anomaly worth noticing.

**A CHECK constraint can be the bug — measured 2026-08-19.**

COV-13's midnight limitation was not code: `end_time > start_time` on bare `TIME` columns is a table
refusing to store an ordinary evening wedding. Two things are worth carrying forward. First, the
constraint hid a second, worse defect — the double-booking check filtered `event_date = $3`, so
collisions between *neighbouring* days were invisible; nobody could see it while the data that would
expose it was unstorable. Second, the fix was a **convention plus two generated columns**, not a
column type change: `event_date + TIME` can express a midnight crossing perfectly well once something
says which side of midnight each time falls on, and putting that rule in Postgres means no query
re-derives it. The rule exists in exactly two places — the generated columns and
`@tartware/schemas` — and the service and all three screens consume the second.

**Third and fourth guardrails added 2026-08-13** — `tenant-scope-module-conformance.test.ts` asserts every
`requiredModules:` literal in `Apps/*/src` is a real `MODULE_IDS` entry. It was written after finding
the incident write path gated on a module that does not exist, 403ing for every tenant since it
shipped. Note the E2E sweep *cannot* find this class of bug: `api_smoke` scores
`403 TENANT_MODULE_NOT_ENABLED` as a skip.

---

## Method & Known Weakness

Route counts come from a regex sweep of `.get/.post/.put/.patch/.delete/.all` registrations across
`Apps/*/src/routes/**/*.ts`, including generic-typed registrations. Commands come from `case "x.y"`
labels in `*command-center-consumer.ts`. UI references come from path-shaped string literals in both
front-ends.

**Dynamically assembled paths are the known weakness.** Code like
`` `/tenants/${id}/webhooks${suffix}` `` cannot be resolved statically and registers as "no UI
reference" even when the screen exists. Confirmed false positives of this kind: webhooks,
`billing/folios/:id`, `billing/invoices/:id` — all genuinely wired.

Every gap in this backlog was therefore re-verified by whole-word search for the domain name across
both front-ends (`.ts` and `.html`), not by path matching alone. Where a spec says "zero UI
presence", the word itself does not occur.

Infrastructure surfaces — `/v1/registry`, `/v1/locks`, `/v1/system`, service health — are out of
scope and are not expected to have UI.
