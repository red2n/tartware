# Domain 12 — Accounts Receivable & Back Office

> **Benchmark:** 21 capabilities · **Built** 13 · **Partial** 4 · **Missing** 4
> **Gap items in this file:** 8
> **Fix specs:** [WORKSTREAMS.md](WORKSTREAMS.md) · **Ledger:** [TRACKER.md](TRACKER.md)

## Already built — do not rebuild

AR account master, Direct bill transfer, Invoice generation, Payment application, Aging report, Invoice editing and finalizing, Statements, Reminder / dunning letters, Commission calculation, GL account mapping, Back-office export, Daily revenue journal, Write-off and bad debt

---

## Gap items

| ID | Capability | Status | Tier | Pri | Effort | Workstream |
|---|---|---|---|---|---|---|
| [PMS-12-01](#pms-12-01) | Payment reversal and unapply | PARTIAL | Competitive | P1 | S | [WS-07](WORKSTREAMS.md#ws-07) |
| [PMS-12-02](#pms-12-02) | Credit hold | PARTIAL | Competitive | P1 | S | [WS-18](WORKSTREAMS.md#ws-18) |
| [PMS-12-03](#pms-12-03) | AR traces and follow-up | MISSING | Competitive | P1 | M | [WS-18](WORKSTREAMS.md#ws-18) |
| [PMS-12-04](#pms-12-04) | Commission holds and payment run | PARTIAL | Competitive | P1 | S | [WS-18](WORKSTREAMS.md#ws-18) |
| [PMS-12-05](#pms-12-05) | Accounting / ERP integration | PARTIAL | Competitive | P1 | S | [WS-10](WORKSTREAMS.md#ws-10) |
| [PMS-12-06](#pms-12-06) | Invoice compression and decompression | MISSING | Enterprise | P2 | L | [WS-06](WORKSTREAMS.md#ws-06) |
| [PMS-12-07](#pms-12-07) | AR credit card transfer | MISSING | Enterprise | P2 | L | [WS-18](WORKSTREAMS.md#ws-18) |
| [PMS-12-08](#pms-12-08) | Owner statements and rental pool | MISSING | Enterprise | P2 | L | [WS-18](WORKSTREAMS.md#ws-18) |

---

### PMS-12-01

**Payment reversal and unapply** — PARTIAL · Competitive · P1 · Effort S · [WS-07](WORKSTREAMS.md#ws-07)

**Today:** Void and refund exist; applied payments cannot be unapplied.

**Fix:** Unapply an applied payment back to unallocated without voiding it.

### PMS-12-02

**Credit hold** — PARTIAL · Competitive · P1 · Effort S · [WS-18](WORKSTREAMS.md#ws-18)

**Today:** credit_limits and an AR risk score exist; no hold that blocks posting.

**Fix:** `credit_limits` and the AR risk score exist; a hold must actually block posting and new bookings.

### PMS-12-03

**AR traces and follow-up** — MISSING · Competitive · P1 · Effort M · [WS-18](WORKSTREAMS.md#ws-18)

**Today:** Dunning rules only; no per-account follow-up task.

**Fix:** Dated follow-up tasks per AR account, like reservation traces.

### PMS-12-04

**Commission holds and payment run** — PARTIAL · Competitive · P1 · Effort S · [WS-18](WORKSTREAMS.md#ws-18)

**Today:** Calculation and statements exist; no hold or payment run.

**Fix:** Hold a commission and pay a batch; calculation and statements already exist.

### PMS-12-05

**Accounting / ERP integration** — PARTIAL · Competitive · P1 · Effort S · [WS-10](WORKSTREAMS.md#ws-10)

**Today:** GL batches export as CSV and XML with USALI categories; no connector to any ERP.

**Fix:** Same.

### PMS-12-06

**Invoice compression and decompression** — MISSING · Enterprise · P2 · Effort L · [WS-06](WORKSTREAMS.md#ws-06)

**Today:** Not modelled.

**Fix:** Summarised vs itemised invoice rendering off the same data.

### PMS-12-07

**AR credit card transfer** — MISSING · Enterprise · P2 · Effort L · [WS-18](WORKSTREAMS.md#ws-18)

**Today:** Not modelled.

**Fix:** Settle an AR balance to a stored card through WS-07.

### PMS-12-08

**Owner statements and rental pool** — MISSING · Enterprise · P2 · Effort L · [WS-18](WORKSTREAMS.md#ws-18)

**Today:** Not modelled.

**Fix:** Condo/owner accounting — only if the product targets mixed ownership.

