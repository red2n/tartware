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
> **Still open:** the `ALL /*` proxies for domains that still have no writes (step 5).
>
> ### ✅ Allotments: the availability-guard question, answered 2026-08-19
>
> This spec's step 4 says allotments "must go through `availability-guard-service`, since holding
> inventory is exactly what the guard protects", and that they "belong inside the group detail
> screen". Checked before building, as COV-13 learned to: **both premises are wrong, and the table
> says so.**
>
> **1. The guard is a booking-funnel lock, not an inventory ledger.** `inventory_locks_shadow` holds
> `reservation_id`, `room_type_id`, `stay_start`/`stay_end`, `ttl_seconds` and `expires_at` — a
> seconds-long hold that stops two concurrent quotes taking the last room. Its only caller
> (`quote-management.ts`) logs "Availability lock failed … proceeding without guard" and continues.
> An allotment is a contracted block running for weeks with a cutoff date, attrition clause, elastic
> limit and pickup tracking. Nothing in the lock table can express it. Same finding COV-13 reached
> about meeting rooms, reached the same way.
>
> **2. An allotment is not the inventory side of a group booking, because it cannot point at one.**
> `allotments` has no `group_booking_id`. Its foreign keys are `users`, `booking_sources`,
> `market_segments` and `folios`. What *is* the inventory side of a group is **`group_room_blocks`** —
> `group_booking_id NOT NULL`, one row per room type per date, `available_rooms` GENERATED as
> `blocked_rooms - picked_rooms` — and it already has live writers in `reservations-command-service`
> (`group.create`, `group.add_rooms`). The two are not duplicates: one is the agreement, the other is
> the per-night inventory it consumes.
>
> **3. So an allotment is a distribution contract.** `booking_source_id`, `market_segment_id`,
> `channel`, `commission_percentage`, `attrition_clause`, `elastic_limit`: rooms allocated to a tour
> operator, wholesaler or corporate account and attributed to a source. That makes it
> [14-channel-distribution.md](14-channel-distribution.md)'s family, not this spec's group family, and
> it belongs beside booking sources and market segments rather than inside the group screen.
>
> **Mechanism: plain HTTP on core-service**, per [18-write-path-gap.md](18-write-path-gap.md) — one
> table, one service, no fan-out, exactly like the booking sources and market segments it sits beside
> in `booking-config`.
>
> ### ✅ Blocks hold inventory — closed 2026-08-20
>
> The open question below is answered. `searchAvailableRooms` — the query behind
> `/v1/rooms/availability`, which both the guest portal and staff booking go through — now
> subtracts held block rooms per room type, in exactly the way it already subtracted unassigned
> reservations. Both are demand against a *type* with no physical room attached yet, so both push the
> same per-type row number.
>
> - **Group blocks** (`group_room_blocks`): `blocked_rooms − picked_rooms`, taken as the **MAX** across
>   the nights in the window rather than the sum — a stay needs one spare room on *every* night, so the
>   tightest night is the constraint. Released when the parent group is cancelled/turndown/completed,
>   when the block row is released or sold out, or when `release_unsold_rooms` is set and the cutoff
>   has passed.
> - **Allotments**: `COALESCE(rooms_per_night, total_rooms_blocked) − rooms_picked_up`, held while the
>   status is TENTATIVE/DEFINITE/ACTIVE/PICKUP_IN_PROGRESS and the cutoff has not lapsed.
> - **Pickup is unaffected.** The rooming-list upload writes reservations directly and never comes
>   through this query, so a group can still draw down its own block.
>
> **Proved live rather than asserted** — `http_test/smoke-operations.sh` grew 11 assertions that walk
> the whole behaviour against a real room type: a 2-room block takes availability from 4 to 2,
> recording pickup of one returns a room, a cutoff moved into the past releases the block entirely,
> restoring the cutoff re-applies it, cancelling releases everything, and a window the block does not
> cover is untouched.
>
> **Still not held: an allotment with no `room_type_id`.** Such a block reserves rooms of no particular
> type; charging it against every type would over-hold the house several times over. The query skips
> them, and this is the honest remaining gap — it wants a property-level hold, which the per-type
> subtraction cannot express.
>
> **Also unchanged:** `rooms-service/src/sources/available-rooms-source.ts`, the recommendation
> pipeline's own candidate query, still reads reservations and rooms alone. It feeds recommendations
> rather than the booking gate, so it can suggest a room a block is holding.
>
> ### ⚠️ The question this answered (kept for the record)
>
> `available-rooms-source.ts` computes availability from `reservations` and `rooms` alone. No caller
> subtracts blocked-but-unsold allotment rooms, so creating an allotment today reserves no inventory —
> it records a commitment the booking engine will happily sell out from under.
>
> Making a block reduce sellable inventory until its cutoff, then release the remainder, is the
> standard behaviour and is what `cutoff_date`, `cutoff_days_prior` and `rooms_available` exist for.
> It is also a change to what the booking funnel sells, which is a booking-correctness change rather
> than a reachability one: it belongs to whoever owns availability, with its own tests. Recorded here
> with the insertion point rather than bolted onto a reference-data write path.
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

---

## 🐛 Group bookings sent no confirmation notification — fixed 2026-08-21

`features/groups` dispatches `group.create` and `group.add_rooms`, both fully wired and shipped. Their
handlers emit `group.created` and `group.rooms_added` into `transactional_outbox` with
`aggregate_type = 'group_booking'`, and **reservations-command-service's dispatcher claimed
`'reservation'` only** — so neither event was ever published.

notification-service subscribes to `reservations.events` and maps `group.created` →
`GROUP_BOOKING_CONFIRMED`. It never received one. **Every group booking made through the product
silently failed to send its confirmation**, from whenever the mapping shipped until today; 16 stranded
rows were still in the dev database, the oldest from 2026-08-20.

Nothing surfaced it because nothing was broken in the usual sense: the command succeeded, the group
booking was created correctly, `group_bookings` and `group_room_blocks` hold the right rows, and the
API returned 200. Only the notification was missing, and a notification that never arrives looks
identical to one that was never configured.

Fixed by naming all five aggregate types the service enqueues in `DISPATCHED_AGGREGATE_TYPES`;
verified live by watching the 16 stranded rows drain to DELIVERED on restart. The rule this exposed is
in [18](18-write-path-gap.md) and the conformance check in [17](17-command-reachability.md).

**Worth pairing with this spec's other group finding.** The 2026-08-20 show-stopper was that a group
block held no inventory; this one is that creating the group told nobody. Both are on the same shipped
flow, and neither was visible from the screen that drives it.
