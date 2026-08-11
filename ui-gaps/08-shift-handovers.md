# COV-08: Front-Desk Shift Handovers — Read-Only, No UI

**Priority:** P1 | **Risk:** 🟡 MEDIUM | **Type:** Backend + UI | **Effort:** M

## Current State (Backend ⚠️ read-only → UI ❌)

`Apps/core-service/src/routes/operations.ts`:

| Method | Path | Line |
|---|---|---|
| GET | `/v1/shift-handovers` | 157 |
| GET | `/v1/shift-handovers/:handoverId` | 233 |

Gateway proxies at `Apps/api-gateway/src/routes/operations-routes.ts:59` (`GET` + `ALL /*`).
`shift-handover` does not occur in `UI/`. No POST/PUT and no command handler — see
[18-write-path-gap.md](18-write-path-gap.md).

## Why It Matters

The shift handover note is how the front desk transfers open issues across shifts: VIP arriving late,
room 312 complaint unresolved, cash discrepancy pending, a guest awaiting a callback. Without it,
handover happens verbally or in a notebook and open items get dropped at every shift change.

There is an adjacent capability that already works: **`billing.cashier.handover`** is a live command
handled in both billing-service and housekeeping-service, and cashier sessions are UI-wired
(`/v1/billing/cashier-sessions`). That covers the *money* handover only. This gap is the
*operational* handover, and the two should meet in one screen.

## Work Required

### 1. Backend write path

Follow whatever COV-18 settles. Consistent with the reads living on core-service:

- `POST /v1/shift-handovers` — open a handover for a shift (property, shift type, from-user)
- `PUT /v1/shift-handovers/:handoverId` — add / edit notes and open items while the shift runs
- `POST /v1/shift-handovers/:handoverId/acknowledge` — incoming staff member signs off, capturing
  who and when

Derive the payload from the existing row type — read the response shape of the two `GET`s and the
table under `schema/src/schemas/05-operations/` before designing fields. Do not invent a new model.

An open item should be able to reference a reservation, room, guest or incident, so the handover is
a set of links rather than free text.

### 2. UI — `UI/pms-ui/src/app/features/operations/shift-handovers/` (new `operations` feature area)

1. **Current shift panel** — the open handover for this property and shift, editable in place: open
   items, pending callbacks, notes, cash position.
2. **Acknowledge on sign-in** — the incoming user sees the outgoing shift's handover and must
   acknowledge it. This is the whole point of the feature; a list nobody is prompted to read is not
   worth building.
3. **History** — past handovers, filterable by date and shift, read-only.
4. **Open-item carry-forward** — unresolved items roll into the next shift's handover rather than
   disappearing.
5. **Merge with cashier close** — when a cashier session closes (`billing.cashier.close` /
   `billing.cashier.handover`, both already live), offer the operational handover in the same flow.
   One shift-change action, not two.

### 3. Dashboard hook

Unacknowledged handover from the previous shift belongs on the dashboard, like the overdue indicators
in COV-01/COV-02.

## Acceptance

- A handover can be opened, filled, acknowledged and reviewed through the product.
- Unresolved open items appear on the next shift's handover.
- Cashier close and operational handover are reachable from one place.

## Cross-reference

- [18-write-path-gap.md](18-write-path-gap.md) — blocking.
- `accounts-gaps/` cashiering work — `billing.cashier.*` is already wired; do not rebuild it.
