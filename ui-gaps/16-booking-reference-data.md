# COV-16: Booking Reference Data — Allotments, Waitlist, Promo Codes, Companies

**Priority:** P2, **except companies — promoted to P0-blocking** | **Risk:** 🟡 MEDIUM | **Type:** Backend + UI | **Effort:** M

> ## ✅ Company CRUD shipped 2026-08-11
>
> **Why it jumped the queue:** COV-03's AR account management shipped, then the E2E run proved it
> unusable — `AR account management SKIP — no company record to attach to`. `ar.account.create`
> requires a `company_id` and nothing could create a company. A shipped feature was inert.
>
> Per [18-write-path-gap.md](18-write-path-gap.md)'s rule this is one service, one table, no fan-out →
> plain HTTP:
> - `POST /v1/companies`, `PUT /v1/companies/:companyId` in `routes/booking-config/company.ts`, with
>   `createCompany` / `updateCompany` in the matching service.
> - Gateway: a **bare `POST /v1/companies`**, because `ALL /v1/companies/*` does not match the bare
>   path — the identical trap that made police-report filing 404 — plus the query-or-body tenant
>   resolver, since `withTenantScope` refuses any request it cannot scope and creates carry `tenant_id`
>   in the body.
> - UI: inline **"+ New company"** inside the AR account form, which auto-selects the new company. That
>   is where the gap bites, so onboarding a corporate client is one flow instead of a DB insert.
>
> **Two bugs found while building:**
>
> 1. **`CompanyTypeEnum` in `@tartware/schemas` is UPPERCASE** (`CORPORATE`) while the table's CHECK
>    requires lowercase (`corporate`). Using the shared enum for writes would violate the constraint on
>    every insert. The request schema follows the DB; the mismatch is flagged in code and still wants
>    resolving.
> 2. **COV-03's company picker was bound to `c.id`, but the list returns `company_id`** — every option
>    value would have been empty, so no company was selectable even once they existed. Fixed. The E2E
>    suite has the same bug (`resp_first "id"`) and is queued for the same fix.
>
> **Deliberately not exposed:** the suspects/evidence-style wide columns on `companies`
> (contract dates, tier pricing, statistics) are machine-maintained or want their own editor. The write
> surface is the contract-and-contact information a person actually types.
>
> **Not yet verified live** — needs the run in flight to finish first.

> ## ✅ Promo codes + waitlist shipped 2026-08-13 — and both "duplicates" were misdiagnosed
>
> ### Step 1 resolved by investigation, not deletion
>
> **`/v1/group-bookings` is not a duplicate — it is the live surface.** `features/groups` reads it
> directly (`groups.ts:257`, `group-detail.ts:315`). Deleting it would have broken the groups screen.
>
> **`/v1/waitlist` is not a duplicate read either.** This spec cites
> "`GET /v1/tenants/:tenantId/reservations/waitlist`" as the competing read — that route is **POST**
> (`reservation.waitlist_add`), as is `…/convert`. So there is exactly one read surface
> (core-service) and one write surface (reservations-command-service) over one table, split across two
> services. Nothing to delete; what was missing was a screen. Built one at
> `UI/pms-ui/src/app/features/reservations/waitlist/`, reading from core and dispatching both commands.
>
> **Neither deletion in step 1 was correct.** The "this may remove a third of this spec" estimate was
> wrong in the other direction: both surfaces were load-bearing.
>
> ### Promo code CRUD (step 3)
>
> `POST/PUT/DELETE /v1/promo-codes` on core-service per [18](18-write-path-gap.md)'s rule, plus the
> bare `POST` at the gateway, and an admin screen at `features/rates/promo-codes/` routed at
> `/promo-codes` under the existing `rates` screen key. Delete is a soft delete that also clears
> `is_active` and sets `cancelled` — redemption history references the row, so it stays, but the code
> must stop validating. `promo_code` is not editable: guests already hold it, and rewriting it silently
> invalidates every email carrying the old one.
>
> ### Three live defects found while building
>
> 1. **`promo_code` was globally UNIQUE, not per-tenant.** `promo_code VARCHAR(100) UNIQUE NOT NULL`
>    creates a table-wide index, so the first tenant to create `SUMMER20` would have permanently
>    blocked every other tenant from using it — a cross-tenant collision on a value guests type.
>    Invisible until now precisely because nothing could create a code. Replaced with
>    `UNIQUE (tenant_id, promo_code)`.
> 2. **Three list filters compared `UPPER($n)` against lowercase CHECK columns**, so they matched
>    nothing: `promo_status`, and `block_status` / `group_type` on `/v1/group-bookings`. The groups
>    screen escaped this only because it filters client-side. The other `UPPER()` filters in
>    `booking-config/` are correct — those columns really are uppercase — so this was three specific
>    bugs, not a blanket rule.
> 3. **`POST /v1/promo-codes/validate` never worked through the gateway.** `/v1/promo-codes/*` was
>    query-scoped while validate carries `tenant_id` in the body, so `withTenantScope` refused it with
>    TENANT_ID_REQUIRED. This spec's "already works, so codes can be *used* but not *created*" was
>    wrong on both halves. Now query-or-body scoped.
>
> ### Enum drift, quantified
>
> `PromotionalCodeStatusEnum` and `PromotionalCodeDiscountTypeEnum` were both UPPERCASE against
> lowercase CHECK constraints, with values the constraints reject (`INACTIVE`, `SUSPENDED`, `AMENITY`)
> and values missing that they accept (`draft`, `paused`, `cancelled`). Corrected, and
> `PromotionalCodeTypeEnum` added.
>
> A repo-wide scan puts the real scale at **~53 unused enums** that disagree with an apparent
> constraint, plus **3 places that already compensate at the call site** with
> `.options.map(t => t.toLowerCase())` — `CompanyTypeEnum` and `CreditStatusEnum` in
> `booking-config/company.ts`, `TaxTypeEnum` in `billing-service/routes/finance-admin.ts`. So the
> codebase already knows these enums are wrong and works around them one call site at a time.
>
> **A conformance test was considered and rejected**: matching an enum to its column can only be done
> heuristically, and the fuzzy version produced obvious false pairs (`TenantStatusEnum` against
> `membership_status`, `SettingsValueStatusEnum` against `warranty_status`). Shipping it would have
> meant a test nobody trusts. The tractable fix is narrower — delete the unused enums, and have the
> three live ones read the constraint's case directly instead of lower-casing at each use.
>
> **Still open:** allotments write path (step 4), which needs the availability-guard decision, and the
> `ALL /*` proxies for domains that still have no writes (step 5).
>
> **Not yet built or exercised** — the user is running the build and tests separately. The uniqueness
> change needs `psql -f scripts/tables/06-integrations/71_promotional_codes.sql`.

## Current State (Backend ⚠️ read-only → UI ❌)

The `booking-config` family in core-service is **entirely read-only**: 24 endpoints across 7 files,
and exactly one write (`POST /v1/promo-codes/validate`, which validates rather than mutates).

| Domain | Endpoints | Route file | UI |
|---|---|---|---|
| Allotments | `GET /v1/allotments`, `…/:allotmentId` | `booking-config/allotment.ts` | ❌ |
| Waitlist | `GET /v1/waitlist`, `…/:waitlistId` | `booking-config/group-waitlist-promo.ts` | ❌ (see below) |
| Promo codes | `GET /v1/promo-codes`, `…/:promoId`, `POST …/validate` | `booking-config/group-waitlist-promo.ts` | ❌ |
| Group bookings | `GET /v1/group-bookings`, `…/:groupBookingId` | `booking-config/group-waitlist-promo.ts` | ⚠️ `features/groups` exists |
| Companies | `GET /v1/companies`, `…/:companyId` | `booking-config/company.ts` | ❌ |
| Booking sources, market segments, channel mappings | — | `booking-config/distribution.ts` | → COV-14 |
| Meeting rooms, event bookings | — | `booking-config/event.ts` | → COV-13 |

Gateway proxies all of them at `Apps/api-gateway/src/routes/booking-config-routes.ts` as
`GET` + `ALL /*`. **The `/*` proxy forwards writes to core-service, where nothing answers them** — a
`POST /v1/allotments` passes gateway auth and then 404s downstream.

## Important exception — waitlist writes DO exist elsewhere

Reservations already owns a waitlist path, and it is partly wired:

- `GET /v1/tenants/:tenantId/reservations/waitlist` and
  `POST …/waitlist/:waitlistId/convert` — `Apps/api-gateway/src/routes/reservation-routes.ts:447, 474`
- Commands: `reservation.waitlist_add`, `reservation.waitlist_offer`, `reservation.waitlist_convert`,
  `reservation.waitlist_expire_sweep` — all handled in `reservations-command-service`

So `/v1/waitlist` in core-service is a **second read surface over the same concept** (cf. COV-04,
COV-07, COV-15). Do not build UI against it; use the reservations path and delete the duplicate.

## Per-Domain Assessment

**Companies** — highest value, and it is a dependency of [03-ar-account-management.md](03-ar-account-management.md):
corporate AR accounts link to a company. Needs `POST/PUT/DELETE /v1/companies` with negotiated rate
codes, credit terms, contacts. Build with COV-03, not separately.

**Allotments** — room blocks held for groups/events. `features/groups` and `features/rate-calendar`
exist; allotments are the inventory side of a group booking and belong inside the group detail screen
rather than as a standalone area. Needs create/release/adjust writes — and it must go through
`availability-guard-service`, since holding inventory is exactly what the guard protects. Also needed
by [13-sales-catering.md](13-sales-catering.md) for the rooms side of an event.

**Promo codes** — `POST /v1/promo-codes/validate` already works, so codes can be *used* but not
*created*. Needs CRUD (code, discount type/value, validity window, channel and rate-plan
restrictions, usage limits, redemption count). Small and self-contained; fits under
`features/rates` or `features/settings`.

**Group bookings** — `features/groups` is wired and dispatches `group.create`, `group.add_rooms`,
`group.check_in`, `group.upload_rooming_list`. The core-service `GET /v1/group-bookings` reads may be
another duplicate; check which surface `features/groups` actually calls before touching it.

## Work Required

1. **Resolve duplicates first** — `/v1/waitlist` vs the reservations waitlist; `/v1/group-bookings` vs
   whatever `features/groups` uses. Delete the loser. This may remove a third of this spec.
2. **Companies CRUD** — deliver with COV-03.
3. **Promo code CRUD + admin screen** — smallest independent win here.
4. **Allotments write path + group-detail integration** — via the availability guard.
5. **Remove or implement the misleading gateway `/*` proxies** — a proxy that advertises writes and
   404s downstream is the same defect class as COV-10(a) and should be covered by the same conformance
   test.

## Acceptance

- No two surfaces read the same booking concept.
- Companies and promo codes are fully manageable in the product.
- Allotments are visible and adjustable from the group they belong to, and respect the availability
  guard.
- No gateway route advertises a write with no downstream handler.

## Cross-reference

- [03-ar-account-management.md](03-ar-account-management.md) — companies dependency.
- [13-sales-catering.md](13-sales-catering.md) — allotments for events.
- [14-channel-distribution.md](14-channel-distribution.md) — the rest of the `booking-config` family.
- [18-write-path-gap.md](18-write-path-gap.md) — root cause and the full duplicate-surface list.
- [10-reports-coverage.md](10-reports-coverage.md) — the proxy-conformance test.
