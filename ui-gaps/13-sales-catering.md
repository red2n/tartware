# COV-13: Sales & Catering — Banquet Orders, Meeting Rooms, Event Bookings

**Priority:** P2 | **Risk:** 🟡 MEDIUM | **Type:** Backend + UI | **Effort:** L

> ## ✅ Decision 2026-08-17: **build**
>
> Tartware is selling function space. The retire option below is closed; the three surfaces and
> their tables stay. Work proceeds one domain at a time in the order this spec already recommends —
> meeting rooms → event bookings → banquet orders — because each is the previous one's prerequisite.
>
> **Slice 1 — meeting-room writes: shipped 2026-08-17.** `POST /v1/meeting-rooms`,
> `PUT /v1/meeting-rooms/:roomId`, `DELETE /v1/meeting-rooms/:roomId` on core-service, plain HTTP
> per COV-18's rule (meeting rooms are named explicitly in its reference-data row). Gateway
> re-registered: bare `POST` plus `app.all` on the wildcard, replacing the `app.get` that the
> 2026-08-13 sweep left behind.
>
> Details worth carrying into slices 2 and 3:
>
> - **Delete is soft.** `event_bookings` and `banquet_event_orders` both reference
>   `meeting_rooms(room_id)` `ON DELETE RESTRICT`, so a hard delete fails as soon as a room has any
>   history. Retiring sets `is_deleted` + `is_active = false`.
> - **`room_code` is editable**, unlike a booking source's `source_code` — both FKs point at
>   `room_id`, not the code. It is still `UNIQUE (tenant_id, property_id, room_code)`, so the service
>   maps `23505` to a 409 rather than letting it surface as a 500.
> - **Zod bounds mirror the table's CHECK constraints** (`max_capacity > 0`, `area_* > 0`,
>   `hourly_rate >= 0`, setup/teardown/turnover `>= 0`) so a bad payload is a 400, not a 23514.
> - **The enums were already aligned** — `MeetingRoomTypeEnum` and `MeetingRoomStatusEnum` match
>   `meeting_rooms_room_type_check` / `_room_status_check` exactly. No drift to fix here.
>
> **Smoke-tested live 2026-08-18** — `http_test/smoke-events.sh`, 31 assertions green through the
> gateway. Every meeting-room path behaved as specified first time: create, duplicate `room_code` →
> 409, list, detail, update, retire, retire-again → 404.
>
> **Still to do in slice 1:** no UI yet (item 4 of the UI list below — meeting room admin).
>
> ### ✅ §2 billing decision 2026-08-18: **the event's own folio, `event_bookings.folio_id`**
>
> The gate this spec set before slice 2. **The data model had already answered it** — both options
> exist as columns and they are not alternatives:
>
> | Column | Comment in DDL | Role |
> |---|---|---|
> | `folio_id` | *"Reference to folios for charges"* | where event revenue posts |
> | `group_booking_id` | *"If part of group block"* | links the event to a group, when there is one |
>
> Both are nullable and independent, so an event billed on its own folio and an event inside a group
> block are the same shape with a different field populated. Choosing the group master folio *instead*
> would have meant ignoring `folio_id`, and choosing a bespoke event-folio table would have meant
> ignoring both. Neither is a real option against this table.
>
> **Slice 2 does not post charges** — that is UI item 6. What it does is stop foreclosing the choice:
> `folio_id` and `group_booking_id` are both accepted on create and update, so the billing work in
> item 6 has its linkage already populated. `accounts-gaps/17-group-master-billing.md` owns the group
> folio itself; this spec owns only the pointer.
>
> ### ✅ Slice 2 — event booking writes: shipped 2026-08-18
>
> `POST /v1/event-bookings`, `PUT /v1/event-bookings/:eventId`, and
> `POST /v1/event-bookings/:eventId/status` on core-service, plain HTTP per COV-18's rule.
>
> **Gateway had the same swallowing bug slice 1 found**, one layer along: `/v1/event-bookings` and
> `/v1/event-bookings/*` were *both* registered `app.get`, so every write would have 404ed at the
> gateway. Now a bare `POST` plus `app.all` on the wildcard, matching meeting rooms.
>
> **Availability: checked the guard first, as this spec asked.** `availability-guard-service` touches
> only `inventory_locks_shadow` and `inventory_lock_audits` — guest-room inventory — and has no
> concept of meeting rooms. It is the wrong mechanism for function space, so double-booking is a
> half-open overlap query on `event_bookings` itself: a booking ending at 12:00 does not collide with
> one starting at 12:00, and setup/teardown windows are included via
> `COALESCE(setup_start_time, start_time)` / `COALESCE(teardown_end_time, end_time)` so a room being
> dressed is not sold to someone else. `CANCELLED` and `NO_SHOW` release the space.
>
> **Lifecycle is enforced in the service, not the table.** The CHECK constrains the *value*, not the
> movement, so `LEGAL_TRANSITIONS` holds the ordering: `COMPLETED`/`NO_SHOW` are terminal, `CANCELLED`
> is reachable from any live status, and an illegal move is a 409. The transition also stamps
> `confirmed_date` / `cancellation_date` so the read model's key dates stay truthful.
>
> Details worth carrying into slice 3:
>
> - **`EventBookingStatusEnum`, `EventTypeEnum` and `EventSetupTypeEnum` already matched their CHECK
>   constraints exactly** — no case drift to fix, unlike the domains in the 2026-08-13 sweep.
>   `booking_status` in `EventBookingListItemSchema` was still typed `z.string()`, the untyped shape
>   that made the drift invisible to the type checker; **tightened to `EventBookingStatusEnum`
>   2026-08-18** after checking the CHECK holds exactly those eight spellings.
> - **`teardown_end_time` is not in the read model**, so an update that did not restate it would have
>   checked availability against a shorter window than the row actually holds. The service reads the
>   stored hold window from the table rather than from `EventBookingListItem`.
> - **The two cancellation columns are `cancellation_date` (TIMESTAMP) and `cancellation_notes`** —
>   not `cancelled_date` / `cancellation_reason` as the obvious guess would have it. TypeScript cannot
>   catch a wrong column name in a SQL string; every column in the new statements was checked against
>   the DDL by hand.
> - **`event_number` has no unique constraint**, so unlike `room_code` there is no 409 path for it.
>
> ### ⚠️ Smoke test 2026-08-18: two bugs that only a running stack could find
>
> `http_test/smoke-events.sh` — 31 assertions through the gateway, added with this run. Slice 1 was
> clean. **Slice 2 was broken in both of its new code paths**, and neither the type checker nor the
> conformance suites could see it:
>
> **1. Every successful write returned 500.** The three write routes declared the bare
> `EventBookingListItem` as their success response while the handlers reply `{ data, message }` —
> so fast-json-stringify rejected the payload with `"event_id" is required!`. The insert had
> *already committed* by then, so the caller saw a 500 for a booking that existed. The fix is
> `EventBookingWriteResponseSchema` in `schema/src/api/events.ts` (the envelope, mirroring
> `AmenityResponseSchema`), not the local `z.object` the STOP GATE forbids. A sweep of every route
> block in `Apps/*/src` that declares a 2xx schema and sends an envelope found no other instance —
> `settings-catalog` uses a permissive `jsonObjectSchema` and `settings-amenities` already declares
> the envelope.
>
> Worth noting *why* the meeting-room routes escaped: they declare **no** success response at all,
> which is the house convention here (`distribution.ts`, `group-waitlist-promo.ts` do the same). The
> event routes were the ones that tried to be more precise and got it wrong.
>
> **2. Every lifecycle transition returned 500.** `UPDATE … SET booking_status = $3, confirmed_date =
> CASE WHEN $3 = 'CONFIRMED' …` makes Postgres deduce `character varying` from the assignment and
> `text` from the comparison, and it refuses the statement: `inconsistent types deduced for parameter
> $3`. Casting every use (`$3::text`) fixes it. This is invisible until the statement is actually
> prepared — the whole of `LEGAL_TRANSITIONS`, the terminal-status rules and the `confirmed_date` /
> `cancellation_date` stamping had never once executed. Swept for `CASE WHEN $n` without a cast
> across all services: no other occurrence.
>
> With both fixed, the behaviour the spec claims is now demonstrated rather than asserted: half-open
> overlap (a 12:00 start does not collide with a 12:00 end), setup and teardown windows holding the
> room, `CANCELLED` releasing the slot for a rebooking, an illegal transition returning 409, and a
> `PUT` that extends a booking into its neighbour returning 409.
>
> **Still to do in slice 2:** no UI yet.

> ### ✅ UI items 1 + 2 + 4 — shipped 2026-08-18
>
> `UI/pms-ui/src/app/features/events/`, the three the spec says to ship first. Reachable from a new
> **Events** nav section; screen keys `events` (the calendar and detail) and `meeting-rooms` (the
> admin), split that way because the backend already draws the same line — booking an event is
> `STAFF`, editing function space inventory is `MANAGER`.
>
> | Item | Screen | Route |
> |---|---|---|
> | 1 | Function space calendar — rooms × days, modelled on `features/rate-calendar` | `/events/calendar` |
> | 2 | Event booking detail — space, client, attendance, money, lifecycle | `/events/bookings/:eventId` |
> | 4 | Meeting room admin — settings-style CRUD | `/events/meeting-rooms` |
>
> **The read model had to grow first.** `EventBookingListItem` carries what a calendar cell needs;
> a detail screen needs the contact, what was promised, and where the money lands. The by-id query
> already *selected* most of it and the shared mapper threw it away — zod strips unknown keys. So
> `EventBookingDetailSchema` extends the list item with `teardown_end_time`, the three `contact_*`
> fields, `setup_details`, `special_requests`, `internal_notes`, the `billing_*` fields, the two
> cancellation columns, and the §2 linkage `folio_id` / `group_booking_id` — the last two being why
> the spec asks for a linked group booking on this screen at all. `folio_id`, `billing_*`,
> `cancellation_date` and `cancellation_notes` were added to the SQL; the rest were already selected.
>
> **`LEGAL_TRANSITIONS` moved into `@tartware/schemas`** as `EVENT_BOOKING_LEGAL_TRANSITIONS`. The
> detail screen offers exactly the moves the service will accept, so it can never show a button that
> 409s; a second copy in the UI would have drifted the first time the rule changed.
>
> **Driven end to end in a real browser, not just screenshotted:** create a booking from the calendar
> (chip count 9 → 10), collide with it deliberately (the 409's "already booked" message reaches the
> user as a toast), then move Tentative → Definite from the detail screen and watch the offered
> transitions become Confirmed / In Progress / Cancelled. Typecheck, biome, 97/97 contrast pairings,
> light and dark.
>
> Two things the screenshots caught that no test would have:
>
> - **`labelFor` did not lowercase first**, so every enum label rendered as the raw constant — the
>   lifecycle buttons shouted `DEFINITE` next to a badge reading "Definite", because the badge comes
>   from the server's own display label and the button did not.
> - **The day columns sized themselves to content**, so one long event name widened its column and
>   pushed the rest of the fortnight out of alignment. `table-layout: fixed` plus a two-line chip
>   (time above name) — a one-line chip left about six characters for the name at 118px.
>
> **Still open here:** item 3 (BEO editor), 5 (daily BEO print) and 6 (event billing) all wait on
> slice 3. `folio_id` is displayed but nothing posts to it yet — that is item 6.

## Current State (Backend ⚠️ read-only → UI ❌)

Three related read-only surfaces with no UI, forming one absent product area.

| Method | Path | Route file |
|---|---|---|
| GET | `/v1/banquet-orders` | `Apps/core-service/src/routes/operations.ts:434` |
| GET | `/v1/banquet-orders/:beoId` | `…/operations.ts:503` |
| GET | `/v1/meeting-rooms` | `…/booking-config/event.ts` |
| GET | `/v1/meeting-rooms/:roomId` | `…/booking-config/event.ts` |
| GET | `/v1/event-bookings` | `…/booking-config/event.ts` |
| GET | `/v1/event-bookings/:eventId` | `…/booking-config/event.ts` |

Gateway: `operations-routes.ts:113` (banquet) and `booking-config-routes.ts:170, 196`
(meeting rooms, event bookings), each as `GET` + `ALL /*`.

Schemas exist — `schema/src/schemas/02-inventory/banquet-event-orders.ts`,
`meeting-rooms.ts`, `event-bookings.ts` — so the data model is designed. **No POST/PUT/PATCH/DELETE
anywhere and no commands.** None of `banquet`, `meeting-room`, `event-booking` occurs in `UI/`.

> The audit counted 2 + 1 + 1 = 4 endpoints. The real read surface is 6; writes are 0.

## Assessment

This is a **product-scope question, not a bug**. Sales & catering (function space booking, BEOs,
event billing) is a substantial PMS module — typically its own product alongside rooms. What exists
today is the read half of a data model, with no way to put anything into it.

Before building, answer: **is Tartware selling function space?** If not, the honest move is to retire
these three surfaces along with their tables and schemas, exactly as
[05-revenue-module-status.md](05-revenue-module-status.md) asks about revenue-service. Half a module
is worse than none: it appears in the OpenAPI document as capability the product does not have.

## If Building — Work Required

### 1. Backend write paths (per COV-18)

**Meeting rooms** (reference data, smallest first): ✅ **shipped 2026-08-17**
`POST/PUT/DELETE /v1/meeting-rooms` — capacity, layouts, area, features, rate basis.

**Event bookings** (the booking itself): ✅ **shipped 2026-08-18**
`POST /v1/event-bookings`, `PUT …/:eventId`, `POST …/:eventId/status` for the lifecycle —
tentative → definite → cancelled. The guard was checked first as instructed and found to be the wrong
mechanism (guest-room inventory only, no concept of meeting rooms), so availability is an overlap
query on `event_bookings` itself.

**Banquet orders** (BEO — the operational document):
`POST /v1/banquet-orders`, `PUT …/:beoId`, `POST …/:beoId/publish` (freeze for kitchen/ops),
`POST …/:beoId/revise` (versioned, since BEO revisions are the whole point).

Derive every payload from the existing schema files, not from scratch.

### 2. Billing integration — decide early

Event revenue must land somewhere. Options: charges posted to a group master folio
(`accounts-gaps/17-group-master-billing.md`), or a dedicated event folio. This decision shapes the
whole module and must be made **before** the UI, not after. Also confirm F&B revenue mapping against
`accounts-gaps/16-usali-gl-code-mapping.md` — USALI treats banquet F&B separately from rooms.

### 3. UI — `UI/pms-ui/src/app/features/events/`

1. **Function space calendar** — meeting rooms × time, the primary working view. Model it on the
   existing `features/rate-calendar` grid rather than a new calendar component.
2. **Event booking detail** — client, contact, dates, spaces held, attendee counts, status, linked
   group booking, linked rooms block (`/v1/allotments`, see COV-16).
3. **BEO editor** — timeline of the event: setup, F&B courses and timings, AV, layout, staffing,
   special instructions. Revision history with a published/draft distinction.
4. **Meeting room admin** — settings-style CRUD.
5. **Daily BEO print / kitchen view** — what the operation actually uses each morning.
6. **Event billing** — charges to the folio chosen in step 2.

Ship 1 + 2 + 4 first; a BEO editor without bookings to attach to is unusable.

## Acceptance

- Decision recorded here: build or retire, with a date.
- If retiring: routes, gateway proxies, schemas and tables removed in one PR.
- If building: function space can be booked and a BEO produced end to end, with event revenue landing
  on a folio.

## Cross-reference

- [18-write-path-gap.md](18-write-path-gap.md) — blocking if building.
- [16-booking-reference-data.md](16-booking-reference-data.md) — `/v1/allotments`, `/v1/group-bookings`
  and `/v1/companies` are the same read-only pattern and are needed for the rooms side of an event.
- `accounts-gaps/17-group-master-billing.md`, `accounts-gaps/16-usali-gl-code-mapping.md`.
