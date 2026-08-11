# COV-14: Channel & Distribution — Connections, Mappings, Sources, Metasearch

**Priority:** P2 | **Risk:** 🟠 MEDIUM | **Type:** Backend + UI | **Effort:** L

## Current State (Backend ⚠️ mostly read-only → UI ❌)

Four related surfaces, none reachable from the UI. None of `ota-connection`, `channel-mapping`,
`booking-source`, `metasearch` occurs in `UI/`.

### Reads

| Method | Path | Route file |
|---|---|---|
| GET | `/v1/ota-connections` | `Apps/core-service/src/routes/night-audit.ts:172` |
| GET | `/v1/ota-connections/:connectionId/sync-history` | `…/night-audit.ts:230` |
| GET | `/v1/channel-mappings`, `…/:mappingId` | `…/booking-config/distribution.ts` |
| GET | `/v1/booking-sources`, `…/:sourceId` | `…/booking-config/distribution.ts` |
| GET | `/v1/market-segments`, `…/:segmentId` | `…/booking-config/distribution.ts` |
| GET | `/v1/metasearch-configs`, `…/:configId`, `…/performance` | `…/booking-config/metasearch.ts` |

Gateway proxies each at `booking-config-routes.ts` (`GET` + `ALL /*`).

**No write routes exist for any of them.**

### Commands — these DO exist, and none is UI-reachable

`Apps/reservations-command-service/src/commands/command-center-consumer.ts`:

| Command | Purpose |
|---|---|
| `integration.ota.sync_request` | trigger a channel sync |
| `integration.ota.rate_push` | push rates to a channel |
| `integration.ota.content_sync` | push content |
| `integration.mapping.update` | update a channel ↔ room-type mapping |
| `integration.webhook.retry` | retry a failed inbound webhook |
| `metasearch.config.create` | create a metasearch config |
| `metasearch.config.update` | update one |
| `metasearch.click.record` | record a click (machine-called) |

8 commands, all handled, **none wrapped in a gateway REST action and none dispatched by the UI**
(see [17-command-reachability.md](17-command-reachability.md)). So config *mutation* has a command
path for mappings and metasearch, but connections and booking sources have no write path at all.

## Why It Matters

Channel distribution is where OTA revenue comes from, and it is the surface that breaks most often in
production: a mapping goes stale, a rate push fails, a sync stops. Today an operator cannot see
whether a channel is connected, when it last synced, or whether a push failed — and cannot retry.
`sync-history` exists and is invisible.

This is also the highest-frequency support burden of any gap in this backlog: every failure becomes an
engineering ticket because there is no operator-facing recovery action.

## Work Required

### 1. Wire the existing commands first (cheapest real win)

`integration.ota.sync_request`, `integration.ota.rate_push`, `integration.ota.content_sync` and
`integration.webhook.retry` are already implemented. Exposing them — via gateway REST wrappers or
direct `POST /commands/<name>` dispatch — plus the existing `sync-history` read gives an operator a
working channel-health screen **with no new backend logic**. Do this before building CRUD.

### 2. Backend write paths (per COV-18)

- **OTA connections:** `POST /v1/ota-connections`, `PUT …/:connectionId`,
  `POST …/:connectionId/enable|disable`, credential handling (never return secrets on read).
- **Booking sources:** `POST/PUT/DELETE /v1/booking-sources` — reference data.
- **Market segments:** same shape. Note `/v1/reports/market-segment-production` (COV-10) reads these,
  so they are already load-bearing for reporting.
- **Channel mappings:** `integration.mapping.update` exists; add create/delete, or extend the command.

### 3. UI — `UI/pms-ui/src/app/features/channels/`

1. **Channel health dashboard** (build this first) — per connection: enabled, last sync, last error,
   pending pushes, plus actions Sync now / Push rates / Sync content / Retry webhook.
2. **Sync history** — `…/:connectionId/sync-history`, filterable by outcome; the diagnostic view.
3. **Mapping editor** — room type × rate plan ↔ channel codes, with an unmapped-items warning. Stale
   mappings are the most common cause of channel failures, so surface unmapped combinations loudly.
4. **Connections admin** — CRUD, credentials write-only.
5. **Booking sources & market segments** — plain settings tables under `features/settings`, not their
   own area.
6. **Metasearch** — config CRUD via the existing commands + `…/performance` (impressions, clicks,
   conversions, cost). Lowest priority of the six.

### 4. Existing webhook screen

`features/webhooks` already exists in `pms-ui` and is a confirmed audit false positive (its paths are
dynamically assembled). Check what it covers before building anything webhook-shaped —
`integration.webhook.retry` may belong there rather than in the channel dashboard.

## Acceptance

- An operator can see channel status, trigger a sync or rate push, and retry a failed webhook without
  engineering help.
- Unmapped room-type/rate-plan combinations are visible before they cause a booking failure.
- Credentials are never returned by a read endpoint.

## Cross-reference

- [17-command-reachability.md](17-command-reachability.md) — 8 `integration.*`/`metasearch.*` commands.
- [18-write-path-gap.md](18-write-path-gap.md) — blocking for the CRUD half only, not for step 1.
- [16-booking-reference-data.md](16-booking-reference-data.md) — same `booking-config` read-only family.
- [10-reports-coverage.md](10-reports-coverage.md) — market-segment-production report.
