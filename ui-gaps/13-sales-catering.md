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
> **Still to do in slice 1:** no UI yet (item 4 of the UI list below — meeting room admin), and no
> live smoke test; the routes are typechecked and conformance-tested but core-service and the gateway
> need a restart to serve them.
>
> **Decision still open before slice 2:** the billing-integration question in §2 below. Event revenue
> has to land on a folio, and that choice shapes event bookings. It must be answered before
> `POST /v1/event-bookings`, not after.

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

**Event bookings** (the booking itself):
`POST /v1/event-bookings`, `PUT …/:eventId`, plus lifecycle transitions — tentative → definite →
cancelled. Needs availability checking against meeting-room inventory; look at how
`availability-guard-service` guards room inventory before inventing a second mechanism.

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
