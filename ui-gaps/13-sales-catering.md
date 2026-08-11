# COV-13: Sales & Catering — Banquet Orders, Meeting Rooms, Event Bookings

**Priority:** P2 | **Risk:** 🟡 MEDIUM | **Type:** Backend + UI | **Effort:** L

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

**Meeting rooms** (reference data, smallest first):
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
