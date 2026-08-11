# COV-07: Lost & Found — Complete CRUD, Duplicated, No UI

**Priority:** P1 | **Risk:** 🟡 MEDIUM | **Type:** UI + backend cleanup | **Effort:** M

## Current State (Backend ✅ → UI ❌)

This is the one zero-UI operations domain where the backend is genuinely complete.

### Full lifecycle — `Apps/housekeeping-service/src/routes/lost-and-found.ts`

| Method | Path |
|---|---|
| GET | `/v1/lost-and-found` (filters) |
| GET | `/v1/lost-and-found/:itemId` |
| POST | `/v1/lost-and-found` (register an item) |
| PUT | `/v1/lost-and-found/:itemId` |
| POST | `/v1/lost-and-found/:itemId/claim` |
| POST | `/v1/lost-and-found/:itemId/return` |

Backed by `services/lost-and-found-service.ts`; table under `schema/src/schemas/05-operations/lost-and-found.ts`.

### Duplicated read-only copy — `Apps/core-service/src/routes/operations.ts:287, 380`

core-service **also** registers `GET /v1/lost-and-found` and `GET /v1/lost-and-found/:itemId`.

**Two services answer the same two paths.** Which one a caller reaches depends entirely on the
gateway's proxy target for that path — `housekeeping-routes.ts` proxies to housekeeping-service, so
the core-service copy is unreachable through the gateway but live if core-service is called directly
(as the E2E suites do). If the two read from the same table the risk is only drift in response shape;
if they read different tables it is worse.

`lost-and-found` does not occur in `UI/`.

## Work Required

### 1. Remove the duplicate (do this first, it is small)

- Confirm both read the same table.
- Delete the two `GET` handlers from `Apps/core-service/src/routes/operations.ts` and their service
  functions, or — if core-service is the intended owner — move the writes there and delete the
  housekeeping copy. Housekeeping is the better owner: room attendants find the items.
- Check `executables/` and `http_test/` for callers pinned to the core-service port before deleting.

### 2. UI — `UI/pms-ui/src/app/features/housekeeping/lost-and-found/`

Pure UI work; no backend needed beyond step 1.

1. **Item list** — found date, description, category, found location / room, storage location,
   status (held / claimed / returned / disposed), days in storage. Filters: status, category, date
   range, room.
2. **Register item form** — `POST /v1/lost-and-found`. Fields from the route's body schema. Should be
   reachable from the room detail screen and from a housekeeping task.
3. **Item detail** — full record, photo/metadata if supported, linked room and reservation.
4. **Claim flow** — `POST …/:itemId/claim`: claimant name, contact, ID reference, matched
   reservation. This is the one that needs care — it is a chain-of-custody record.
5. **Return flow** — `POST …/:itemId/return`: returned to, method (in person / courier), tracking
   reference, returned by staff member.
6. **Edit** — `PUT …/:itemId` for corrections and storage-location moves.
7. **Retention view** — items past the property's retention window, for disposal decisions. Sort by
   days in storage; this is the practical daily use of the screen.

### 3. Guest-facing follow-on (optional, P3)

A guest enquiry path ("I left my charger in 412") currently has no route. Out of scope here; note it
if the guest portal is extended.

## Acceptance

- One service owns `/v1/lost-and-found`; the duplicate is gone and no test targets it.
- An item can be registered, edited, claimed and returned entirely through the UI.
- Items past retention are listable without SQL.

## Cross-reference

- [06-incidents.md](06-incidents.md) — same service, opposite problem (no writes there).
- [04-duplicate-ar-surface.md](04-duplicate-ar-surface.md) — the same duplicate-surface pattern in
  billing; worth checking whether more exist (see [18-write-path-gap.md](18-write-path-gap.md)).
