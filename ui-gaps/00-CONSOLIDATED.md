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
| Commands total | 199 | **202** | `case` labels across 11 consumers |
| Commands wrapped in gateway REST actions | 75 | **81** | `commandName:` in `Apps/api-gateway` |
| Commands dispatched directly by UI | 21 | **22** | `/commands/<name>` in `UI/*` |
| Commands with **no** wrapper and **no** direct dispatch | — | **108** | structurally unreachable |
| Commands unreachable *from the UI* | 134 | 108–134 | 26 have a wrapper the UI never calls |
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
| 18 | Read-only domains have no write path — **✅ mechanism decided 2026-08-11**; per-domain writes remain | [18-write-path-gap.md](18-write-path-gap.md) | Backend | part |

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
| 09 | Guest feedback — **✅ write path + staff inbox shipped 2026-08-13**; portal intake still open | [09-guest-feedback.md](09-guest-feedback.md) | Backend+UI | part |

### P2 — Commercial Surfaces (4 gaps)

| # | Gap | File | Type | Effort |
|---|-----|------|------|--------|
| 13 | Sales & catering — banquet orders, meeting rooms, event bookings | [13-sales-catering.md](13-sales-catering.md) | Backend+UI | L |
| 14 | Channel / distribution — **✅ channel health screen shipped 2026-08-13** (4 existing commands wired); CRUD half open | [14-channel-distribution.md](14-channel-distribution.md) | Backend+UI | part |
| 15 | Two booking engines — **✅ closed: `/v1/direct-booking` deleted** (unguarded write path, no callers) | [15-booking-engine-duplication.md](15-booking-engine-duplication.md) | Decision | done |
| 16 | Booking reference data — **✅ promo code CRUD + waitlist screen shipped 2026-08-13**; both "duplicates" were misdiagnosed and are load-bearing. Allotments still open | [16-booking-reference-data.md](16-booking-reference-data.md) | Backend+UI | part |

### P2 — Cross-Cutting (1 gap)

| # | Gap | File | Type | Effort |
|---|-----|------|------|--------|
| 17 | 108 commands structurally unreachable; 26 more wrapped but uncalled | [17-command-reachability.md](17-command-reachability.md) | Audit+UI | L |

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
13. ~~COV-16 promo codes + waitlist~~ — **done 2026-08-13.** Then COV-18 (remainder), COV-13,
    COV-16's allotments, COV-14's CRUD half and COV-09's portal intake
14. COV-17: re-run reachability once the above land; whatever remains is dead surface to retire

**`UNIMPLEMENTED` is down from 7 to 4** — `compliance.breach.report`, `.notify` and
`operations.incident.report` were **deleted** (catalog row, payload schema, validator), because each
describes a write that already exists as plain HTTP on the owning service. Keeping them would have
meant two write paths for one table, one of which silently drops every message. That discharges most
of COV-18's third acceptance criterion.

**A recurring defect worth naming: schema enums drifting from their CHECK constraints.** Measured
2026-08-13: **~53 unused enums** in `schema/` disagree with an apparent constraint, and **3 live call
sites already compensate** with `.options.map(t => t.toLowerCase())` — `CompanyTypeEnum` and
`CreditStatusEnum` in `booking-config/company.ts`, `TaxTypeEnum` in `finance-admin.ts`. Named
instances so far: `CompanyTypeEnum`, `LostFoundStatusEnum` (COV-07), `ShiftHandoverStatusEnum`
(COV-08), `PromotionalCodeStatusEnum` and `PromotionalCodeDiscountTypeEnum` (COV-16).

**It is not purely cosmetic.** COV-16 found three list filters comparing `UPPER($n)` against
lowercase CHECK columns, which matched nothing — the drift reaching live SQL.

**A conformance test was tried and rejected**: enum→column matching is only heuristic, and the fuzzy
version paired `TenantStatusEnum` with `membership_status` and `SettingsValueStatusEnum` with
`warranty_status`. A test that cries wolf is worse than none. The tractable fix is to delete the
unused enums and let the three live ones carry the constraint's own case.

**Third guardrail added 2026-08-13** — `tenant-scope-module-conformance.test.ts` asserts every
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
