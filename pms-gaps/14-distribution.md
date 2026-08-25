# Domain 14 — Distribution & Channel Management

> **Benchmark:** 19 capabilities · **Built** 2 · **Partial** 9 · **Missing** 8
> **Gap items in this file:** 17
> **Fix specs:** [WORKSTREAMS.md](WORKSTREAMS.md) · **Ledger:** [TRACKER.md](TRACKER.md)

## Already built — do not rebuild

Rate and room type mapping, Direct booking engine

---

## Gap items

| ID | Capability | Status | Tier | Pri | Effort | Workstream |
|---|---|---|---|---|---|---|
| [PMS-14-01](#pms-14-01) | Channel manager connectivity | PARTIAL | Table stakes | P0 | XL | [WS-09](WORKSTREAMS.md#ws-09) |
| [PMS-14-02](#pms-14-02) | Reservation delivery with retry | PARTIAL | Table stakes | P0 | M | [WS-09](WORKSTREAMS.md#ws-09) |
| [PMS-14-03](#pms-14-03) | Modification and cancellation handling | PARTIAL | Table stakes | P0 | M | [WS-09](WORKSTREAMS.md#ws-09) |
| [PMS-14-04](#pms-14-04) | OTA connectivity | PARTIAL | Competitive | P1 | S | [WS-09](WORKSTREAMS.md#ws-09) |
| [PMS-14-05](#pms-14-05) | Channel-specific restrictions and sell limits | MISSING | Competitive | P1 | M | [WS-02](WORKSTREAMS.md#ws-02) |
| [PMS-14-06](#pms-14-06) | Duplicate detection | MISSING | Competitive | P1 | M | [WS-09](WORKSTREAMS.md#ws-09) |
| [PMS-14-07](#pms-14-07) | OTA virtual credit card handling | MISSING | Competitive | P1 | M | [WS-09](WORKSTREAMS.md#ws-09) |
| [PMS-14-08](#pms-14-08) | Channel production reporting | PARTIAL | Competitive | P1 | S | [WS-09](WORKSTREAMS.md#ws-09) |
| [PMS-14-09](#pms-14-09) | Content distribution | PARTIAL | Competitive | P1 | S | [WS-09](WORKSTREAMS.md#ws-09) |
| [PMS-14-10](#pms-14-10) | Stop-sell propagation SLA | MISSING | Competitive | P1 | M | [WS-02](WORKSTREAMS.md#ws-02) |
| [PMS-14-11](#pms-14-11) | Commission reconciliation per channel | PARTIAL | Competitive | P1 | S | [WS-09](WORKSTREAMS.md#ws-09) |
| [PMS-14-12](#pms-14-12) | Cancellation and no-show policy sync | MISSING | Competitive | P1 | M | [WS-08](WORKSTREAMS.md#ws-08) |
| [PMS-14-13](#pms-14-13) | GDS connectivity | PARTIAL | Enterprise | P2 | M | [WS-09](WORKSTREAMS.md#ws-09) |
| [PMS-14-14](#pms-14-14) | Metasearch | PARTIAL | Enterprise | P2 | M | [WS-09](WORKSTREAMS.md#ws-09) |
| [PMS-14-15](#pms-14-15) | Wholesale and bedbank contracts | MISSING | Enterprise | P2 | L | [WS-09](WORKSTREAMS.md#ws-09) |
| [PMS-14-16](#pms-14-16) | Corporate booking tools / TMC | MISSING | Enterprise | P2 | L | [WS-09](WORKSTREAMS.md#ws-09) |
| [PMS-14-17](#pms-14-17) | Central reservation system | MISSING | Enterprise | P2 | L | [WS-23](WORKSTREAMS.md#ws-23) |

---

### PMS-14-01

**Channel manager connectivity** — PARTIAL · Table stakes · P0 · Effort XL · [WS-09](WORKSTREAMS.md#ws-09)

**Today:** otaSyncRequest / otaRatePush are written and logged, but the file says the push itself is simulated. Nothing leaves the building.

**Fix:** Replace the simulated push in `ota-integration.ts` with a `ChannelTransport` interface in schema and one real adapter. Everything around it — queueing, mapping, logging — already works.

### PMS-14-02

**Reservation delivery with retry** — PARTIAL · Table stakes · P0 · Effort M · [WS-09](WORKSTREAMS.md#ws-09)

**Today:** A queue and a retry command exist against a simulated transport.

**Fix:** The retry command exists; it needs a real transport to retry against and a DLQ.

### PMS-14-03

**Modification and cancellation handling** — PARTIAL · Table stakes · P0 · Effort M · [WS-09](WORKSTREAMS.md#ws-09)

**Today:** Inbound queue processing exists; modify and cancel mapping is not implemented.

**Fix:** Inbound modify/cancel mapping onto the reservation commands.

### PMS-14-04

**OTA connectivity** — PARTIAL · Competitive · P1 · Effort S · [WS-09](WORKSTREAMS.md#ws-09)

**Today:** Configuration and mapping tables are complete; no live OTA.

**Fix:** Per-OTA adapters behind the same transport.

### PMS-14-05

**Channel-specific restrictions and sell limits** — MISSING · Competitive · P1 · Effort M · [WS-02](WORKSTREAMS.md#ws-02)

**Today:** Restrictions are property-wide and unenforced.

**Fix:** Restriction scope of `CHANNEL` — depends on WS-09 for the push.

### PMS-14-06

**Duplicate detection** — MISSING · Competitive · P1 · Effort M · [WS-09](WORKSTREAMS.md#ws-09)

**Today:** No dedupe on inbound channel reservations.

**Fix:** Dedupe inbound by channel reference before creating; today a redelivery would double-book.

### PMS-14-07

**OTA virtual credit card handling** — MISSING · Competitive · P1 · Effort M · [WS-09](WORKSTREAMS.md#ws-09)

**Today:** Not modelled.

**Fix:** VCC capture windows and amounts — depends on WS-07.

### PMS-14-08

**Channel production reporting** — PARTIAL · Competitive · P1 · Effort S · [WS-09](WORKSTREAMS.md#ws-09)

**Today:** Channel profitability exists; no production by channel.

**Fix:** Production by channel from delivered reservations.

### PMS-14-09

**Content distribution** — PARTIAL · Competitive · P1 · Effort S · [WS-09](WORKSTREAMS.md#ws-09)

**Today:** content-sync command against the same simulated transport.

**Fix:** Content sync over the real transport.

### PMS-14-10

**Stop-sell propagation SLA** — MISSING · Competitive · P1 · Effort M · [WS-02](WORKSTREAMS.md#ws-02)

**Today:** No stop-sell push, so no SLA.

**Fix:** Once restrictions are enforced and WS-09 pushes, measure edit→ack latency and alert on breach.

### PMS-14-11

**Commission reconciliation per channel** — PARTIAL · Competitive · P1 · Effort S · [WS-09](WORKSTREAMS.md#ws-09)

**Today:** channel_commission_rules table with no consumer.

**Fix:** `channel_commission_rules` has no consumer; reconcile against `commission_tracking`.

### PMS-14-12

**Cancellation and no-show policy sync** — MISSING · Competitive · P1 · Effort M · [WS-08](WORKSTREAMS.md#ws-08)

**Today:** Policies are not pushed to channels.

**Fix:** Policies (WS-05) pushed to channels (WS-09) and printed on fiscal documents.

### PMS-14-13

**GDS connectivity** — PARTIAL · Enterprise · P2 · Effort M · [WS-09](WORKSTREAMS.md#ws-09)

**Today:** gds_connections, gds_message_log, gds_reservation_queue tables; no protocol implementation.

**Fix:** The three GDS tables exist; needs an actual protocol implementation.

### PMS-14-14

**Metasearch** — PARTIAL · Enterprise · P2 · Effort M · [WS-09](WORKSTREAMS.md#ws-09)

**Today:** Configs, click log and a performance endpoint; no bidding or rate feed.

**Fix:** Configs and click log exist; needs a rate feed and bid management.

### PMS-14-15

**Wholesale and bedbank contracts** — MISSING · Enterprise · P2 · Effort L · [WS-09](WORKSTREAMS.md#ws-09)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Contracted allotments at net rates — depends on WS-15.

### PMS-14-16

**Corporate booking tools / TMC** — MISSING · Enterprise · P2 · Effort L · [WS-09](WORKSTREAMS.md#ws-09)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** GDS-dependent.

### PMS-14-17

**Central reservation system** — MISSING · Enterprise · P2 · Effort L · [WS-23](WORKSTREAMS.md#ws-23)

**Today:** No CRS layer.

**Fix:** A CRS layer over cross-property availability and central rates; the chain-level sibling of WS-09's channel work.

