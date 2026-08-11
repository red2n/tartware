# COV-06: Incident Log — Read-Only Backend, Catalogued Command Unimplemented

**Priority:** P1 | **Risk:** 🟠 MEDIUM (safety / liability) | **Type:** Backend + UI | **Effort:** M

## Current State (Backend ⚠️ read-only → UI ❌)

`Apps/housekeeping-service/src/routes/incidents.ts`:

| Method | Path | Line |
|---|---|---|
| GET | `/v1/incidents` (list, `IncidentListQuery` filters) | 98 |
| GET | `/v1/incidents/:incidentId` | 151 |

Gateway proxies at `Apps/api-gateway/src/routes/housekeeping-routes.ts:236` (`GET` + `ALL /*`).
`incidents` does not occur in `UI/`.

**No write path exists.** `operations.incident.report` is in the command catalog and has a validator
registered (`schema/src/command-validators.ts:693`, payload
`OperationsIncidentReportCommandSchema` in `schema/src/events/commands/operations.ts`) — but it is
listed in the `UNIMPLEMENTED` set in
`Apps/command-consumer-utils/tests/flow-command-catalog.test.ts:169`, meaning **no consumer handles
it**. Dispatching it produces a command every consumer silently skips: no error, no DLQ entry.

> The audit reported "6 endpoints, full CRUD". That is wrong — 6 counted the gateway proxy pair on
> top of the two reads. There is no CRUD.

## Why It Matters

Guest and property incidents are the liability record: slips, injuries, altercations, damage, theft
allegations. A read-only log means incidents are recorded outside the system (paper, email, chat) and
the table stays empty — so nothing to produce when an insurer or a lawyer asks.

## Work Required

### 1. Backend write path

The payload schema already exists and is validated; what is missing is a handler. Two routes:

**Option A — implement the command handler (recommended, since the schema and validator exist):**
- Add `case "operations.incident.report"` to `Apps/housekeeping-service/src/commands/command-center-consumer.ts`
  (it already owns `operations.maintenance.*` and `operations.schedule.*`).
- Point the catalog row's target service at the service that claims it — the exact failure mode
  documented in `flow-command-catalog.test.ts` for `operations.maintenance.request`.
- Remove `operations.incident.report` from the `UNIMPLEMENTED` set in the same PR. The test comment is
  explicit: an entry means "not built yet", and a command with a handler must never appear there.
- Add follow-up commands for the lifecycle: assign, add note, resolve/close. Model them on
  `operations.maintenance.*`, which already has request → assign → complete → escalate.

**Option B — HTTP routes** on housekeeping-service. Faster to build, but leaves an orphaned catalog
row and validator to clean up, and diverges from how maintenance works in the same service.

### 2. UI — `UI/pms-ui/src/app/features/housekeeping/incidents/` (or a new `operations` feature)

1. **List** — date, type, severity, location/room, reported by, status, safety flag. Filters:
   severity, type, open/closed, date range, safety-issue-only.
2. **Report form** — from `OperationsIncidentReportCommandSchema`: property, room, category,
   description, priority, reported by/role, guest, reservation, location description,
   affects-occupancy, safety-issue flag.
3. **Detail** — timeline of notes and status changes, linked guest / reservation / room, attachments
   if the schema supports metadata.
4. **Actions** — assign, add note, escalate, resolve.
5. **Entry points** — "Report incident" from the room detail, reservation detail and guest detail
   screens, not only from a standalone list. Incidents are reported in context.

### 3. Relationship to maintenance

`operations.maintenance.*` (6 commands, already handled in housekeeping-service) covers property
faults. Incidents cover people and liability. Check whether `request_type: "GUEST_REPORTED"` on
maintenance is already being used as a stand-in for incidents — if so, decide the boundary before
building a second screen.

## Acceptance

- An incident can be reported, assigned, noted and closed through the product.
- The catalog conformance test passes with `operations.incident.report` removed from `UNIMPLEMENTED`.
- Safety-flagged incidents are filterable and visible without SQL.

## Cross-reference

- [18-write-path-gap.md](18-write-path-gap.md) — same root cause; `operations.asset.update` and
  `operations.inventory.adjust` are in the same `UNIMPLEMENTED` set.
- [07-lost-and-found.md](07-lost-and-found.md) — the sibling housekeeping surface, which *does* have
  writes and is the model to copy.
