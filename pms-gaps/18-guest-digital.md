# Domain 18 — Guest-Facing Digital

> **Benchmark:** 19 capabilities · **Built** 6 · **Partial** 7 · **Missing** 6
> **Gap items in this file:** 13
> **Fix specs:** [WORKSTREAMS.md](WORKSTREAMS.md) · **Ledger:** [TRACKER.md](TRACKER.md)

## Already built — do not rebuild

Booking engine, Confirmation and pre-arrival email, Online check-in, Digital registration card, Post-stay survey and review solicitation, Guest app or web portal

---

## Gap items

| ID | Capability | Status | Tier | Pri | Effort | Workstream |
|---|---|---|---|---|---|---|
| [PMS-18-01](#pms-18-01) | Booking modification and cancellation self-service | PARTIAL | Table stakes | P0 | M | [WS-09](WORKSTREAMS.md#ws-09) |
| [PMS-18-02](#pms-18-02) | Contactless check-out and emailed folio | PARTIAL | Competitive | P1 | S | [WS-06](WORKSTREAMS.md#ws-06) |
| [PMS-18-03](#pms-18-03) | In-stay messaging | MISSING | Competitive | P1 | M | [WS-11](WORKSTREAMS.md#ws-11) |
| [PMS-18-04](#pms-18-04) | Service request tracking | PARTIAL | Competitive | P1 | S | [WS-11](WORKSTREAMS.md#ws-11) |
| [PMS-18-05](#pms-18-05) | Pre-arrival upsell | PARTIAL | Competitive | P1 | S | [WS-05](WORKSTREAMS.md#ws-05) |
| [PMS-18-06](#pms-18-06) | Multi-language guest communications | PARTIAL | Competitive | P1 | S | [WS-11](WORKSTREAMS.md#ws-11) |
| [PMS-18-07](#pms-18-07) | Accessibility to WCAG 2.2 AA | PARTIAL | Competitive | P1 | S | [WS-24](WORKSTREAMS.md#ws-24) |
| [PMS-18-08](#pms-18-08) | Mobile key | PARTIAL | Enterprise | P2 | M | [WS-10](WORKSTREAMS.md#ws-10) |
| [PMS-18-09](#pms-18-09) | Kiosk check-in | MISSING | Enterprise | P2 | L | [WS-06](WORKSTREAMS.md#ws-06) |
| [PMS-18-10](#pms-18-10) | Attribute-based selling | MISSING | Enterprise | P2 | L | [WS-03](WORKSTREAMS.md#ws-03) |
| [PMS-18-11](#pms-18-11) | Digital compendium | MISSING | Enterprise | P2 | L | [WS-11](WORKSTREAMS.md#ws-11) |
| [PMS-18-12](#pms-18-12) | In-room and F&B ordering | MISSING | Enterprise | P2 | L | [WS-11](WORKSTREAMS.md#ws-11) |
| [PMS-18-13](#pms-18-13) | Digital tipping | MISSING | Enterprise | P2 | L | [WS-11](WORKSTREAMS.md#ws-11) |

---

### PMS-18-01

**Booking modification and cancellation self-service** — PARTIAL · Table stakes · P0 · Effort M · [WS-09](WORKSTREAMS.md#ws-09)

**Today:** Self-service can search, book, check in and check out; a guest cannot modify or cancel.

**Fix:** Guest-side modify/cancel over the existing self-service routes — reuses the same reservation commands.

### PMS-18-02

**Contactless check-out and emailed folio** — PARTIAL · Competitive · P1 · Effort S · [WS-06](WORKSTREAMS.md#ws-06)

**Today:** Contactless check-out works; the emailed folio needs a folio document, which does not exist.

**Fix:** Check-out already works; the email needs the rendered folio.

### PMS-18-03

**In-stay messaging** — MISSING · Competitive · P1 · Effort M · [WS-11](WORKSTREAMS.md#ws-11)

**Today:** in_app_notifications are staff-facing; no guest thread.

**Fix:** Same thread, guest-portal side.

### PMS-18-04

**Service request tracking** — PARTIAL · Competitive · P1 · Effort S · [WS-11](WORKSTREAMS.md#ws-11)

**Today:** contactless_requests is captured; no status track for the guest.

**Fix:** Guest-visible status on the same log.

### PMS-18-05

**Pre-arrival upsell** — PARTIAL · Competitive · P1 · Effort S · [WS-05](WORKSTREAMS.md#ws-05)

**Today:** recommendations exist; no pre-arrival offer flow.

**Fix:** Same accept path, triggered from the pre-arrival message in WS-11.

### PMS-18-06

**Multi-language guest communications** — PARTIAL · Competitive · P1 · Effort S · [WS-11](WORKSTREAMS.md#ws-11)

**Today:** Templates have a language column; the staff UI is fully localized, guest comms are not.

**Fix:** Templates have a language column; select by guest language and fall back to property default.

### PMS-18-07

**Accessibility to WCAG 2.2 AA** — PARTIAL · Competitive · P1 · Effort S · [WS-24](WORKSTREAMS.md#ws-24)

**Today:** ARIA attributes are used across the UI; no audit or stated conformance.

**Fix:** Same audit, guest-facing surfaces.

### PMS-18-08

**Mobile key** — PARTIAL · Enterprise · P2 · Effort M · [WS-10](WORKSTREAMS.md#ws-10)

**Today:** mobile_keys and a keys endpoint; no lock system to issue against.

**Fix:** Issue through the same provider.

### PMS-18-09

**Kiosk check-in** — MISSING · Enterprise · P2 · Effort L · [WS-06](WORKSTREAMS.md#ws-06)

**Today:** Not built.

**Fix:** Kiosk surface over the existing self-service check-in; needs the rendered registration card and key issue (WS-10).

### PMS-18-10

**Attribute-based selling** — MISSING · Enterprise · P2 · Effort L · [WS-03](WORKSTREAMS.md#ws-03)

**Today:** Room types only.

**Fix:** Sell room attributes rather than room types — a resolution-layer change, not a new table.

### PMS-18-11

**Digital compendium** — MISSING · Enterprise · P2 · Effort L · [WS-11](WORKSTREAMS.md#ws-11)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Property content in the guest portal.

### PMS-18-12

**In-room and F&B ordering** — MISSING · Enterprise · P2 · Effort L · [WS-11](WORKSTREAMS.md#ws-11)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Ordering in the guest portal, posting through the POS path (WS-10).

### PMS-18-13

**Digital tipping** — MISSING · Enterprise · P2 · Effort L · [WS-11](WORKSTREAMS.md#ws-11)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Tip capture posting through WS-07.

