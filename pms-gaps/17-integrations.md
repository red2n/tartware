# Domain 17 — Integrations & Interfaces

> **Benchmark:** 25 capabilities · **Built** 3 · **Partial** 11 · **Missing** 11
> **Gap items in this file:** 22
> **Fix specs:** [WORKSTREAMS.md](WORKSTREAMS.md) · **Ledger:** [TRACKER.md](TRACKER.md)

## Already built — do not rebuild

Open REST API, Webhooks / event streaming, Police and immigration reporting

---

## Gap items

| ID | Capability | Status | Tier | Pri | Effort | Workstream |
|---|---|---|---|---|---|---|
| [PMS-17-01](#pms-17-01) | Door lock system | MISSING | Table stakes | P0 | L | [WS-10](WORKSTREAMS.md#ws-10) |
| [PMS-17-02](#pms-17-02) | Point of sale | PARTIAL | Table stakes | P0 | M | [WS-10](WORKSTREAMS.md#ws-10) |
| [PMS-17-03](#pms-17-03) | Payment gateway | PARTIAL | Table stakes | P0 | M | [WS-07](WORKSTREAMS.md#ws-07) |
| [PMS-17-04](#pms-17-04) | Channel manager and CRS | PARTIAL | Competitive | P1 | S | [WS-09](WORKSTREAMS.md#ws-09) |
| [PMS-17-05](#pms-17-05) | Revenue management system | MISSING | Competitive | P1 | M | [WS-10](WORKSTREAMS.md#ws-10) |
| [PMS-17-06](#pms-17-06) | CRM and marketing automation | PARTIAL | Competitive | P1 | S | [WS-10](WORKSTREAMS.md#ws-10) |
| [PMS-17-07](#pms-17-07) | Guest messaging platforms | MISSING | Competitive | P1 | M | [WS-11](WORKSTREAMS.md#ws-11) |
| [PMS-17-08](#pms-17-08) | Guest Wi-Fi / captive portal | MISSING | Competitive | P1 | M | [WS-10](WORKSTREAMS.md#ws-10) |
| [PMS-17-09](#pms-17-09) | Reputation management | PARTIAL | Competitive | P1 | S | [WS-10](WORKSTREAMS.md#ws-10) |
| [PMS-17-10](#pms-17-10) | Accounting / ERP | PARTIAL | Competitive | P1 | S | [WS-10](WORKSTREAMS.md#ws-10) |
| [PMS-17-11](#pms-17-11) | Identity verification | MISSING | Competitive | P1 | M | [WS-10](WORKSTREAMS.md#ws-10) |
| [PMS-17-12](#pms-17-12) | Sandbox environment | MISSING | Competitive | P1 | M | [WS-10](WORKSTREAMS.md#ws-10) |
| [PMS-17-13](#pms-17-13) | Interface health monitoring | PARTIAL | Competitive | P1 | S | [WS-10](WORKSTREAMS.md#ws-10) |
| [PMS-17-14](#pms-17-14) | PBX and call accounting | PARTIAL | Enterprise | P2 | M | [WS-10](WORKSTREAMS.md#ws-10) |
| [PMS-17-15](#pms-17-15) | Spa, golf, and activity systems | PARTIAL | Enterprise | P2 | M | [WS-10](WORKSTREAMS.md#ws-10) |
| [PMS-17-16](#pms-17-16) | In-room technology | PARTIAL | Enterprise | P2 | M | [WS-10](WORKSTREAMS.md#ws-10) |
| [PMS-17-17](#pms-17-17) | Minibar systems | PARTIAL | Enterprise | P2 | M | [WS-10](WORKSTREAMS.md#ws-10) |
| [PMS-17-18](#pms-17-18) | Parking and valet | MISSING | Enterprise | P2 | L | [WS-10](WORKSTREAMS.md#ws-10) |
| [PMS-17-19](#pms-17-19) | Procurement and materials control | MISSING | Enterprise | P2 | L | [WS-10](WORKSTREAMS.md#ws-10) |
| [PMS-17-20](#pms-17-20) | Labour management and payroll | MISSING | Enterprise | P2 | L | [WS-10](WORKSTREAMS.md#ws-10) |
| [PMS-17-21](#pms-17-21) | HTNG / OTA XML message support | MISSING | Enterprise | P2 | L | [WS-09](WORKSTREAMS.md#ws-09) |
| [PMS-17-22](#pms-17-22) | Partner certification programme | MISSING | Enterprise | P2 | L | [WS-10](WORKSTREAMS.md#ws-10) |

---

### PMS-17-01

**Door lock system** — MISSING · Table stakes · P0 · Effort L · [WS-10](WORKSTREAMS.md#ws-10)

**Today:** No door-lock interface. This is the single most-requested PMS interface and there is no trace of it.

**Fix:** The highest-value missing interface. Define an `AccessControl` provider in schema (issue, cancel, read audit), one vendor adapter, and wire `mobile_keys` and room-move to it.

### PMS-17-02

**Point of sale** — PARTIAL · Table stakes · P0 · Effort M · [WS-10](WORKSTREAMS.md#ws-10)

**Today:** An inbound posting endpoint, no vendor interface.

**Fix:** The inbound posting endpoint works; add a POS vendor adapter and interface health.

### PMS-17-03

**Payment gateway** — PARTIAL · Table stakes · P0 · Effort M · [WS-07](WORKSTREAMS.md#ws-07)

**Today:** See domain 15 — one adapter, wrong service.

**Fix:** Same as above — the interface belongs in schema, the adapters in one place.

### PMS-17-04

**Channel manager and CRS** — PARTIAL · Competitive · P1 · Effort S · [WS-09](WORKSTREAMS.md#ws-09)

**Today:** Simulated.

**Fix:** Covered by this workstream and WS-23.

### PMS-17-05

**Revenue management system** — MISSING · Competitive · P1 · Effort M · [WS-10](WORKSTREAMS.md#ws-10)

**Today:** No connector.

**Fix:** Outbound RMS connector — depends on WS-21 for what to send.

### PMS-17-06

**CRM and marketing automation** — PARTIAL · Competitive · P1 · Effort S · [WS-10](WORKSTREAMS.md#ws-10)

**Today:** marketing_campaigns and campaign_segments tables; no connector.

**Fix:** Connector over `marketing_campaigns` / `campaign_segments`.

### PMS-17-07

**Guest messaging platforms** — MISSING · Competitive · P1 · Effort M · [WS-11](WORKSTREAMS.md#ws-11)

**Today:** No connector; SMS and WhatsApp are declared as channels but only the console and webhook providers implement them.

**Fix:** WhatsApp / SMS platform adapters — the channel enums exist but only console and webhook providers implement them.

### PMS-17-08

**Guest Wi-Fi / captive portal** — MISSING · Competitive · P1 · Effort M · [WS-10](WORKSTREAMS.md#ws-10)

**Today:** Not modelled.

**Fix:** Room + name authentication against in-house reservations, premium tier charging through POS posting.

### PMS-17-09

**Reputation management** — PARTIAL · Competitive · P1 · Effort S · [WS-10](WORKSTREAMS.md#ws-10)

**Today:** sentiment_analysis, social_media_mentions and review templates; no review-platform connector.

**Fix:** Review-platform connector feeding `sentiment_analysis` and the response templates.

### PMS-17-10

**Accounting / ERP** — PARTIAL · Competitive · P1 · Effort S · [WS-10](WORKSTREAMS.md#ws-10)

**Today:** File export only.

**Fix:** Connector on top of the existing GL batch export.

### PMS-17-11

**Identity verification** — MISSING · Competitive · P1 · Effort M · [WS-10](WORKSTREAMS.md#ws-10)

**Today:** No connector.

**Fix:** ID/passport scan provider — pairs with the next item.

### PMS-17-12

**Sandbox environment** — MISSING · Competitive · P1 · Effort M · [WS-10](WORKSTREAMS.md#ws-10)

**Today:** No sandbox tenant or test mode.

**Fix:** A test-mode tenant with fixture data and non-live adapters.

### PMS-17-13

**Interface health monitoring** — PARTIAL · Competitive · P1 · Effort S · [WS-10](WORKSTREAMS.md#ws-10)

**Today:** Service registry heartbeats cover internal services; data_sync_status is unused.

**Fix:** One health model for every outbound interface, reusing the service-registry heartbeat pattern. `data_sync_status` is the table for it.

### PMS-17-14

**PBX and call accounting** — PARTIAL · Enterprise · P2 · Effort M · [WS-10](WORKSTREAMS.md#ws-10)

**Today:** Tables only.

**Fix:** `pbx_configurations` and `call_records` exist; needs a call-record ingest and posting rule.

### PMS-17-15

**Spa, golf, and activity systems** — PARTIAL · Enterprise · P2 · Effort M · [WS-10](WORKSTREAMS.md#ws-10)

**Today:** spa_appointments and spa_treatments tables; no connector.

**Fix:** Adapter posting to the folio through the POS path.

### PMS-17-16

**In-room technology** — PARTIAL · Enterprise · P2 · Effort M · [WS-10](WORKSTREAMS.md#ws-10)

**Today:** smart_room_devices, room_energy_usage, device_events_log tables; no connector.

**Fix:** `smart_room_devices` and energy tables exist; needs an ingest adapter.

### PMS-17-17

**Minibar systems** — PARTIAL · Enterprise · P2 · Effort M · [WS-10](WORKSTREAMS.md#ws-10)

**Today:** Tables only.

**Fix:** Vendor adapter.

### PMS-17-18

**Parking and valet** — MISSING · Enterprise · P2 · Effort L · [WS-10](WORKSTREAMS.md#ws-10)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Adapter + folio posting.

### PMS-17-19

**Procurement and materials control** — MISSING · Enterprise · P2 · Effort L · [WS-10](WORKSTREAMS.md#ws-10)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Adapter; low priority for a hotel PMS core.

### PMS-17-20

**Labour management and payroll** — MISSING · Enterprise · P2 · Effort L · [WS-10](WORKSTREAMS.md#ws-10)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Adapter over `staff_schedules`.

### PMS-17-21

**HTNG / OTA XML message support** — MISSING · Enterprise · P2 · Effort L · [WS-09](WORKSTREAMS.md#ws-09)

**Today:** No message support.

**Fix:** Message adapters over the same transport.

### PMS-17-22

**Partner certification programme** — MISSING · Enterprise · P2 · Effort L · [WS-10](WORKSTREAMS.md#ws-10)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Process, not code — needs the sandbox in WS-22 first.

