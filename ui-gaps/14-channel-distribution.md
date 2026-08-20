# COV-14: Channel & Distribution — Connections, Mappings, Sources, Metasearch

**Priority:** P2 | **Risk:** 🟠 MEDIUM | **Type:** Backend + UI | **Effort:** L

> ## ✅ Step 1 shipped 2026-08-13 — channel health screen, no new backend logic
>
> This spec was right that step 1 was the cheapest real win. Four gateway REST wrappers in
> `booking-config-routes.ts` over commands that were already implemented in
> reservations-command-service:
>
> | Route | Command |
> |---|---|
> | `POST /v1/tenants/:tenantId/channels/sync` | `integration.ota.sync_request` |
> | `POST /v1/tenants/:tenantId/channels/rate-push` | `integration.ota.rate_push` |
> | `POST /v1/tenants/:tenantId/channels/content-sync` | `integration.ota.content_sync` |
> | `POST /v1/tenants/:tenantId/channels/webhook-retry` | `integration.webhook.retry` |
>
> Module gating is left to the command catalog, which already requires `marketing-channel` for all
> four — duplicating it on the wrapper would mean two places to keep in step.
>
> UI at `UI/pms-ui/src/app/features/channels/`, routed at `/channels` under a new `channels` screen
> key (added to `22_role_screen_permissions_seed.sql`; MANAGER and above by default, since the actions
> dispatch commands requiring MANAGER). Covers §3 items 1 and 2:
> - per-connection status, last sync and outcome, mapped rooms/rates, pending reservations, last error
> - Sync now / Push rates / Sync content / Retry webhook
> - sync history with a failures-only filter
> - **an unmapped-channel banner**: an active connection with no mapped rooms or rates cannot sell
>   whatever its status says, which is §3.3's point without the mapping editor
>
> The actions answer 202 — the work happens on the bus — so the screen reports acceptance and the
> operator refreshes, rather than being shown a fake success.
>
> ## ✅ §2 CRUD shipped 2026-08-13 — and "OTA connections" is not a domain
>
> ### `/v1/ota-connections` is a projection of `channel_mappings`
>
> **There is no `ota_connections` table.** `OTA_CONNECTION_LIST_SQL` selects from `channel_mappings`
> with `id as ota_connection_id`, `entity_type as channel_type`, `last_sync_status as
> connection_status`. So `/v1/ota-connections` and `/v1/channel-mappings` are two presentations of the
> same rows.
>
> This spec asks for `POST /v1/ota-connections` **and** channel-mapping create/delete alongside the
> existing `integration.mapping.update` command — three write paths onto one table, which is the
> duplicate-surface pattern [04](04-duplicate-ar-surface.md) and [07](07-lost-and-found.md) had to
> unpick. Not built. Instead:
>
> - **`integration.mapping.update` wrapped** at `POST /v1/tenants/:tenantId/channels/mapping-update`.
>   It was implemented and unwrapped, like the four in step 1. Editing a mapping fans out to OTA sync,
>   which is [18](18-write-path-gap.md)'s test for command-over-HTTP, so the command is the right
>   mechanism and no HTTP CRUD was added beside it.
> - **The connections view stays read-only** — it is a projection, and giving a projection its own
>   writes is how the two surfaces would drift apart.
>
> ### The real connections table is `ota_configurations`, and nothing served it
>
> Chasing §2's credential requirement found it: `ota_configurations` holds `api_key`, `api_secret`,
> `api_endpoint`, `hotel_id`, sync cadence and the push/pull feature flags. **It had no endpoint at
> all** — only reservations-command-service read it, internally.
>
> So the naming was actively misleading: the thing called `/v1/ota-connections` is the *mapping*
> table, and the actual connection records were invisible. `integration.ota.content_sync` takes an
> `ota_config_id` from `ota_configurations` — which means the channel-health screen shipped in step 1
> **had a bug**: it passed a `channel_mappings.id` as `ota_config_id`, targeting nothing. Found and
> fixed here.
>
> Added `GET /v1/ota-configurations` (core-service + gateway). **Credentials are excluded by the query
> itself**, not filtered in a mapper — `api_key`/`api_secret` are never selected, and a computed
> `has_credentials` boolean reports only whether a pair is stored. A secret cannot reach the service
> layer to be leaked by accident. That satisfies §2's "never return secrets on read" for the table that
> actually has secrets. The channel screen now resolves the config by matching `ota_code`, and refuses
> to dispatch content sync when no configuration exists rather than sending a wrong id.
>
> ### Booking sources and market segments (reference data → plain HTTP)
>
> `POST/PUT/DELETE` for both on core-service, bare `POST`s at the gateway, and the two wildcard proxies
> switched from query-only to query-or-body scoping — they would otherwise have refused every
> body-shaped write, the recurring trap.
>
> - Codes are **not editable** on either. Reservations carry `source_code` and `segment_code`, and
>   production reporting groups on them, so rewriting one orphans history.
> - Delete is a soft delete that also clears `is_bookable`: historic reservations still reference the
>   row for reporting, but nothing new should be able to pick it.
> - Retiring a market segment is **refused with 409 while sub-segments point at it** — orphaning them
>   would leave rows whose `segment_level` describes a hierarchy that no longer exists.
> - `segment_level` is derived from the parent at creation rather than being caller-supplied, and
>   re-parenting is deliberately not offered, since it would leave the level stale.
> - Performance columns (bookings, revenue, conversion) are absent from both write bodies — a
>   caller-supplied booking count is how channel-production reporting stops meaning anything.
>
> §2's own note that market segments are "already load-bearing for reporting" understated it:
> `/v1/reports/market-segment-production` has been grouping by a dimension **nothing could populate**.
>
> UI at `UI/pms-ui/src/app/features/settings/distribution/`, routed at `/settings/distribution` under
> the existing `settings` screen key — this spec is right that these belong in settings rather than
> their own area.
>
> **Closed 2026-08-19/20:** the mapping editor (§3.3), connections admin (§3.4 — it *is* the mapping
> editor, since `/v1/ota-connections` is a projection of the same rows) and metasearch (§3.6) all
> shipped into `/settings/distribution`, which now carries five tabs: booking sources, market
> segments, allotments, channel mappings, metasearch.
>
> ### 🐛 The screen had never been reachable
>
> `/settings/distribution` was declared **after** `settings/:categoryCode` in `app.routes.ts`, and
> Angular matches in declaration order — so from the day it shipped (2026-08-13) until 2026-08-20 the
> URL rendered the *settings catalogue* with `categoryCode="distribution"`. It was in the nav, it
> built, its screen key was seeded, and clicking it showed a different screen. Found by driving it in
> a browser; nothing else would have. Route moved above the parameterised one.
>
> This is the same defect class as the gateway proxy mismatches in
> [19-gateway-proxy-mismatches.md](19-gateway-proxy-mismatches.md), one layer further out: a
> capability that is registered, documented and shadowed.
>
> ### What the slice added
>
> - **Allotments** — the write path from [16](16-booking-reference-data.md) step 4, with the lifecycle
>   offered from `ALLOTMENT_LEGAL_TRANSITIONS` so a button cannot 409, and pickup shown against the
>   block. The card says plainly that a block does not yet reduce sellable availability, because it
>   does not.
> - **Channel mappings** — edit through `integration.mapping.update`, the command that had a wrapper
>   and no caller. Dispatch answers 202, so the list settles rather than patching in place.
> - **Metasearch** — `metasearch.config.create` and `.update` had handlers, catalog rows and payload
>   validators but **no gateway wrapper**, so neither could ever be dispatched. Two of the 95
>   unreachable commands in [17](17-command-reachability.md), wrapped at
>   `/v1/tenants/:tenantId/channels/metasearch-config[-update]` and now driven from this screen.
>
> ### Three things the browser caught that the build did not
>
> - **The shadowed route above.**
> - **`labelFor` did not lowercase first**, so `DEFINITE` rendered as `DEFINITE` beside a badge reading
>   "Definite". Invisible until now because sources and segments render the server's `*_display`
>   fields; the allotment and metasearch sections are the first here to label a raw enum. Exactly the
>   slip [13](13-sales-catering.md) records on the event booking detail.
> - **`.cell-primary` stretched its badges.** It is a column flex container, so a badge under the
>   identifier ran the full width of the cell — 234px for the word "Tour". Fixed in `shared.scss` with
>   `align-items: flex-start` rather than a component override, so the "Preferred" badge on booking
>   sources gets it too.
>
> **The screen also stopped re-declaring its data shapes.** It carried local `BookingSource` and
> `MarketSegment` types with 17 and 13 fields against read models of 31 and 38 — UI/AGENTS.md forbids
> exactly this, and the cost was that half of what the API returns was invisible to the screen. Both
> now import from `@tartware/schemas`.
> **Not yet exercised against a live stack**, and the new screen key needs
> `psql -f scripts/tables/01-core/22_role_screen_permissions_seed.sql` (idempotent) before it appears
> in the sidebar.

### ⚠️ Smoke test 2026-08-19: two defects and a platform-wide seed gap

`http_test/smoke-operations.sh` exercised the booking-source and market-segment
write paths for the first time since they shipped on 2026-08-13.

**1. `PUT` and `DELETE /v1/booking-sources/:sourceId` both returned 500:**
`column "updated_at" of relation "booking_sources" does not exist`. The table
carries `created_by`/`updated_by` but neither timestamp, where every sibling
reference table (`market_segments`, `promotional_codes`) carries all four and
AGENTS.md requires them. The write path's `SET updated_at = ...` therefore could
not run at all. Fixed by adding the columns to the canonical DDL with an
idempotent `ADD COLUMN IF NOT EXISTS` migration — the missing audit fields are
the defect, not the statement that names them.

**2. A duplicate code was a 500, on all three reference domains.**
`booking_sources`, `market_segments` and `promotional_codes` each carry a UNIQUE
constraint on their human-facing code and none of the three services caught
`23505`, so the most likely operator mistake — typing a code that already exists
— surfaced as a Postgres error string. The promo route's own OpenAPI description
promises codes are "unique per tenant". `ReferenceCodeConflictError` +
`isUniqueViolationOn` now live in `services/booking-config/common.ts`, lifted
from the pattern `createMeetingRoom` already used, and all three creates answer
409. Constraint names are matched exactly and were read from the database, not
guessed: they are not named after their columns
(`uk_booking_sources_code`, `uq_promotional_codes_tenant_code`).

**3. The seed grants no modules, so half the product 403s on a fresh database.**
The auth gate reads `tenants.config -> 'modules'`
(`tenant-module-service.ts` calls it "the source of truth"), and
`scripts/data/defaults/default_seed.json` had no `modules` key at all — so
`COALESCE(t.config -> 'modules', '["core"]')` left the demo tenant with `core`
only, and every route gated on `facility-maintenance`, `finance-automation`,
`revenue-management`, `loyalty` or `distribution` answered 403. Meanwhile
`seed-default-data.mjs` populated `user_tenant_associations.modules` — a
different column, which that gate does not read — with a list naming
`reservations`, `housekeeping` and `billing`, none of which are `MODULE_IDS`
entries. Both are fixed: the demo tenant's config now carries the full
`MODULE_IDS` list and the seeder's fallback matches it.

This is the third time a module gate has hidden a working domain
([06-incidents.md](06-incidents.md) was the first two), and the reason it keeps
happening is in that spec: the E2E sweep scores `403 TENANT_MODULE_NOT_ENABLED`
as a *skip*.

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
