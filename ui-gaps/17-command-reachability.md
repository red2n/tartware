# COV-17: Command Reachability — 108 of 202 Commands Have No Path From the UI

**Priority:** P2 (cross-cutting) | **Risk:** 🟠 MEDIUM | **Type:** Audit + UI | **Effort:** L

## Current State

The command bus is the write path for most of the system. The UI reaches it two ways:

1. **Direct dispatch** — `POST /tenants/:tenantId/commands/<name>`. **22 commands.**
2. **Gateway REST action wrappers** — e.g. `POST /v1/tenants/:id/reservations/:id/check-in` declares
   `commandName: "reservation.check_in"` and dispatches on the caller's behalf. **81 commands wrapped.**

Counting only direct dispatch would say 22 of 202 and badly understate coverage. Counting both,
**108 commands have neither a wrapper nor a direct dispatch** — they are structurally unreachable from
any client. A further ~26 have a wrapper the UI never calls, which is where the audit's figure of 134
comes from.

`features/command-management` does not change this: it reads `/commands/features` and PATCHes
enable/disable flags. It is a feature-flag admin screen, not a general command executor.

### Verified counts

| | Count | Source |
|---|---|---|
| Commands with a handler | **202** | `case "x.y"` across 11 `*command-center-consumer.ts` files |
| Wrapped in a gateway REST action | **81** | `commandName:` in `Apps/api-gateway/src/**` |
| Dispatched directly by the UI | **22** | `commands/<name>` in `UI/**` |
| Neither wrapped nor dispatched | **108** | set difference |
| Catalogued but **no handler at all** | **7** | `UNIMPLEMENTED` in `flow-command-catalog.test.ts` |

## Breakdown of the 108

| Namespace | Count | Owner spec |
|---|---|---|
| `revenue.*` | 32 | [05-revenue-module-status.md](05-revenue-module-status.md) |
| `billing.*` | 17 | `accounts-gaps/` + [12-billing-partials.md](12-billing-partials.md) |
| `ar.*` | 13 | [03-ar-account-management.md](03-ar-account-management.md) |
| `reservation.*` | 11 | this spec |
| `operations.*` | 6 | this spec (maintenance + staff scheduling) |
| `integration.*` | 5 | [14-channel-distribution.md](14-channel-distribution.md) |
| `rooms.*` | 5 | this spec |
| `commission.*` | 4 | `accounts-gaps/` |
| `settings.*` | 4 | see caveat below |
| `inventory.*` | 3 | this spec |
| `loyalty.*` | 3 | see caveat below |
| `metasearch.*` | 3 | [14-channel-distribution.md](14-channel-distribution.md) |
| `group.*` | 2 | `accounts-gaps/17-group-master-billing.md` |

### Two known false positives in that table

- **`loyalty.points.earn` / `.redeem` are reachable.** `UI/pms-ui/src/app/features/loyalty/loyalty.ts:124`
  dispatches `` `commands/loyalty.points.${kind}` `` — a dynamically assembled name the static scan
  cannot resolve. `loyalty.points.expire_sweep` is a sweep job, not a user action. Treat `loyalty.*` as
  covered.
- **`settings.value.*` capability exists over REST.** `features/settings` writes via
  `PUT /settings/values/:id`, not the command bus. The 4 commands are unused, not the capability. Decide
  whether the REST path or the command path is canonical and delete the other.

Apply the same scepticism to any single row before treating it as work: a dynamically built command
name or a REST equivalent will read as unreachable here.

## Genuinely Missing Operator Actions

These are the ones with no owner spec and no alternative path — the actionable residue of this audit.

### `reservation.*` (11)

`reservation.create`, `reservation.convert_quote`, `reservation.send_quote`, `reservation.batch_no_show`,
`reservation.generate_registration_card`, `reservation.walk_guest`, `reservation.expire`,
`reservation.waitlist_offer`, `reservation.waitlist_expire_sweep`, `reservation.mobile_checkin.start`,
`reservation.mobile_checkin.complete`.

**`reservation.create` is the notable one** — check-in, check-out, modify, cancel, assign-room and
walk-in check-in are all wrapped and used, so reservations are clearly being created somehow (likely a
REST create endpoint on the gateway). Confirm which path `features/reservations` uses; if it is a REST
create that bypasses the command, that is a consistency problem worth naming, not a missing screen.

Real gaps here: **quote lifecycle** (`send_quote` → `convert_quote`) has no UI at all, and
**`walk_guest`** (relocating an oversold guest to another property) is an operationally critical action
with no button. `batch_no_show` belongs in the night-audit flow. `expire` and `waitlist_expire_sweep`
are sweeps. `mobile_checkin.*` is the guest portal — see
[11-self-service-coverage.md](11-self-service-coverage.md).

### `operations.*` (6)

`operations.maintenance.request|assign|complete|escalate`, `operations.schedule.create|update`.

Handled in housekeeping-service, no wrapper, no UI. Maintenance is a core front-of-house workflow —
a guest reports a fault, someone must log and assign it. `features/housekeeping` exists and reaches
`housekeeping.task.*` through wrappers, so the pattern to copy is right there. Staff scheduling
(`schedule.*`) is a separate product question: decide whether Tartware does labour scheduling at all
before building it. Note `/v1/reports/maintenance-sla` (COV-10) reports on data nothing can create
through the product.

### `rooms.*` (5)

`rooms.inventory.block`, `rooms.inventory.release`, `rooms.key.issue`, `rooms.key.revoke`, `rooms.move`.

`rooms.status.update`, `rooms.out_of_order`, `rooms.out_of_service`, `rooms.features.update` and
`rooms.housekeeping_status.update` *are* wrapped, so the rooms screen is mostly covered. The gaps:
**inventory block/release** (holding rooms off sale for a reason other than OOO/OOS) and **key
issue/revoke** — the latter is a security matter, and COV-11 proposes exposing keys to guests. Do not
ship guest-visible keys without a staff revoke path.

### `inventory.*` (3)

`inventory.lock.room`, `inventory.release.room`, `inventory.release.bulk` — handled by
`availability-guard-service`. These are almost certainly internal (the guard locking inventory during a
booking transaction), not operator actions. **Verify, then exclude them from this count** rather than
building UI.

## Work Required

1. **Split the list by intent, once.** Every one of the 108 is exactly one of:
   (a) an operator action needing UI, (b) a machine/scheduled action correctly having no UI,
   (c) dead surface to retire. The audit cannot tell these apart; a person can, in an afternoon.
   Record the classification in this file.
2. **Discharge the ones with owner specs** through those specs — do not build a generic command
   console instead.
3. **Add a reachability check to CI.** `flow-command-catalog.test.ts` already asserts every catalogued
   command has a handler and a claimed target service. Extend the same idea: every handled command must
   be classified as operator-facing, machine-facing, or deprecated, with operator-facing ones required
   to have a wrapper or a UI dispatch. That turns this audit from a one-off into a standing invariant —
   otherwise it will need re-running in six months.
4. **Re-run after Phases 2–5** of `00-CONSOLIDATED.md`. Whatever is still unreachable and classified
   (c) gets deleted.

## Acceptance

- All 108 classified (a) / (b) / (c) in this file.
- Category (a) items have an owning spec or a shipped UI path.
- Category (c) items are deleted, along with their schemas and catalog rows.
- CI fails when a new operator-facing command lands with no reachable path.

## Cross-reference

Owner specs: 03 (ar), 05 (revenue), 12 (billing), 14 (integration/metasearch), 11 (mobile check-in),
plus `accounts-gaps/` for commission and group billing.
