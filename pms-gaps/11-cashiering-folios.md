# Domain 11 — Cashiering, Folios & Billing

> **Benchmark:** 33 capabilities · **Built** 18 · **Partial** 8 · **Missing** 7
> **Gap items in this file:** 15
> **Fix specs:** [WORKSTREAMS.md](WORKSTREAMS.md) · **Ledger:** [TRACKER.md](TRACKER.md)

## Already built — do not rebuild

Multi-window folios, Transaction (charge) code configuration, Manual posting, Automatic tax generation, Payment posting, Adjustments and corrections, Folio splitting, Transfer postings, Settlement, Refunds, Posting journal, Cashier shift close, Package allowance handling, Pre-stay and post-stay charging, Void folio, credit bill, debit bill, Credit / floor limit monitoring, Gratuity and service charge, Comp accounting

---

## Gap items

| ID | Capability | Status | Tier | Pri | Effort | Workstream |
|---|---|---|---|---|---|---|
| [PMS-11-01](#pms-11-01) | Folio generation and printing | PARTIAL | Table stakes | P0 | L | [WS-06](WORKSTREAMS.md#ws-06) |
| [PMS-11-02](#pms-11-02) | Folio styles | MISSING | Competitive | P1 | M | [WS-06](WORKSTREAMS.md#ws-06) |
| [PMS-11-03](#pms-11-03) | Multi-language and multi-currency folios | PARTIAL | Competitive | P1 | S | [WS-06](WORKSTREAMS.md#ws-06) |
| [PMS-11-04](#pms-11-04) | POS interface postings | PARTIAL | Competitive | P1 | S | [WS-10](WORKSTREAMS.md#ws-10) |
| [PMS-11-05](#pms-11-05) | Rebates, allowances, and service recovery | PARTIAL | Competitive | P1 | S | [WS-17](WORKSTREAMS.md#ws-17) |
| [PMS-11-06](#pms-11-06) | Folio history and archive | PARTIAL | Competitive | P1 | S | [WS-17](WORKSTREAMS.md#ws-17) |
| [PMS-11-07](#pms-11-07) | Deposit ledger | PARTIAL | Competitive | P1 | S | [WS-17](WORKSTREAMS.md#ws-17) |
| [PMS-11-08](#pms-11-08) | Auto folio settlement | MISSING | Competitive | P1 | M | [WS-17](WORKSTREAMS.md#ws-17) |
| [PMS-11-09](#pms-11-09) | Currency exchange and rate management | PARTIAL | Competitive | P1 | S | [WS-17](WORKSTREAMS.md#ws-17) |
| [PMS-11-10](#pms-11-10) | Receipt history | PARTIAL | Competitive | P1 | S | [WS-06](WORKSTREAMS.md#ws-06) |
| [PMS-11-11](#pms-11-11) | Batch charges | MISSING | Competitive | P1 | M | [WS-17](WORKSTREAMS.md#ws-17) |
| [PMS-11-12](#pms-11-12) | Gift and prepaid cards | MISSING | Enterprise | P2 | L | [WS-17](WORKSTREAMS.md#ws-17) |
| [PMS-11-13](#pms-11-13) | Internal charge numbers | MISSING | Enterprise | P2 | L | [WS-17](WORKSTREAMS.md#ws-17) |
| [PMS-11-14](#pms-11-14) | Pro-forma and advance billing | MISSING | Enterprise | P2 | L | [WS-06](WORKSTREAMS.md#ws-06) |
| [PMS-11-15](#pms-11-15) | Daily covers adjustment | MISSING | Enterprise | P2 | L | [WS-01](WORKSTREAMS.md#ws-01) |

---

### PMS-11-01

**Folio generation and printing** — PARTIAL · Table stakes · P0 · Effort L · [WS-06](WORKSTREAMS.md#ws-06)

**Today:** Folio data and totals are complete; no rendered document (no PDF path anywhere in the repo).

**Fix:** The anchor item. Build one document service that renders a typed payload to PDF and HTML; folio is its first template.

### PMS-11-02

**Folio styles** — MISSING · Competitive · P1 · Effort M · [WS-06](WORKSTREAMS.md#ws-06)

**Today:** Single folio format.

**Fix:** Template variants selected per property or per AR account.

### PMS-11-03

**Multi-language and multi-currency folios** — PARTIAL · Competitive · P1 · Effort S · [WS-06](WORKSTREAMS.md#ws-06)

**Today:** Currency is carried on every posting; folio output has no language or currency presentation layer.

**Fix:** Template locale + presentation currency on the same renderer.

### PMS-11-04

**POS interface postings** — PARTIAL · Competitive · P1 · Effort S · [WS-10](WORKSTREAMS.md#ws-10)

**Today:** POST /billing/charges/pos accepts postings; no POS vendor adapter or interface health.

**Fix:** Same.

### PMS-11-05

**Rebates, allowances, and service recovery** — PARTIAL · Competitive · P1 · Effort S · [WS-17](WORKSTREAMS.md#ws-17)

**Today:** comp_transactions with authorizers covers comps; no rebate or service-recovery code.

**Fix:** Distinct charge codes and an authorisation ladder, separate from comps.

### PMS-11-06

**Folio history and archive** — PARTIAL · Competitive · P1 · Effort S · [WS-17](WORKSTREAMS.md#ws-17)

**Today:** Live folios only; no archive.

**Fix:** Archive closed folios with a retrieval path.

### PMS-11-07

**Deposit ledger** — PARTIAL · Competitive · P1 · Effort S · [WS-17](WORKSTREAMS.md#ws-17)

**Today:** Deposits post as payments; no separate deposit ledger with transfer-to-revenue on arrival.

**Fix:** Deposits are liabilities until arrival. Separate ledger with a transfer-to-revenue step — already specced in `accounts-gaps/02-advance-deposit-ledger.md`.

### PMS-11-08

**Auto folio settlement** — MISSING · Competitive · P1 · Effort M · [WS-17](WORKSTREAMS.md#ws-17)

**Today:** No auto-settle at check-out.

**Fix:** Settle to the stored payment method at check-out through WS-07.

### PMS-11-09

**Currency exchange and rate management** — PARTIAL · Competitive · P1 · Effort S · [WS-17](WORKSTREAMS.md#ws-17)

**Today:** fx_rates CRUD; no exchange transaction.

**Fix:** An exchange transaction with a till, spread and its own posting — `fx_rates` is only the rate table.

### PMS-11-10

**Receipt history** — PARTIAL · Competitive · P1 · Effort S · [WS-06](WORKSTREAMS.md#ws-06)

**Today:** Payments are recorded; no receipt document history.

**Fix:** Render and store a receipt document per settlement.

### PMS-11-11

**Batch charges** — MISSING · Competitive · P1 · Effort M · [WS-17](WORKSTREAMS.md#ws-17)

**Today:** No bulk posting.

**Fix:** Post one charge to many folios in one command.

### PMS-11-12

**Gift and prepaid cards** — MISSING · Enterprise · P2 · Effort L · [WS-17](WORKSTREAMS.md#ws-17)

**Today:** Not modelled.

**Fix:** Issue, load and redeem as a payment method.

### PMS-11-13

**Internal charge numbers** — MISSING · Enterprise · P2 · Effort L · [WS-17](WORKSTREAMS.md#ws-17)

**Today:** Not modelled.

**Fix:** Internal reference per posting for back-office matching.

### PMS-11-14

**Pro-forma and advance billing** — MISSING · Enterprise · P2 · Effort L · [WS-06](WORKSTREAMS.md#ws-06)

**Today:** No pro-forma document.

**Fix:** Pro-forma template over the projected folio.

### PMS-11-15

**Daily covers adjustment** — MISSING · Enterprise · P2 · Effort L · [WS-01](WORKSTREAMS.md#ws-01)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Covers per night belong on `reservation_nights` alongside adults/children.

