# Domain 16 — Reporting & Analytics

> **Benchmark:** 19 capabilities · **Built** 9 · **Partial** 4 · **Missing** 6
> **Gap items in this file:** 10
> **Fix specs:** [WORKSTREAMS.md](WORKSTREAMS.md) · **Ledger:** [TRACKER.md](TRACKER.md)

## Already built — do not rebuild

Arrivals, departures, and in-house reports, Manager flash / daily operations report, Ledger balance reports, Cancellation and no-show reports, Cashier and shift reports, Forecast reports, Market segment and source production, Commission reports, KPI dashboards

---

## Gap items

| ID | Capability | Status | Tier | Pri | Effort | Workstream |
|---|---|---|---|---|---|---|
| [PMS-16-01](#pms-16-01) | Housekeeping status and discrepancy reports | PARTIAL | Table stakes | P0 | M | [WS-12](WORKSTREAMS.md#ws-12) |
| [PMS-16-02](#pms-16-02) | Export formats | PARTIAL | Table stakes | P0 | M | [WS-06](WORKSTREAMS.md#ws-06) |
| [PMS-16-03](#pms-16-03) | Statistics by month and year | PARTIAL | Competitive | P1 | S | [WS-20](WORKSTREAMS.md#ws-20) |
| [PMS-16-04](#pms-16-04) | Scheduled report distribution | MISSING | Competitive | P1 | M | [WS-20](WORKSTREAMS.md#ws-20) |
| [PMS-16-05](#pms-16-05) | Custom report builder | MISSING | Competitive | P1 | M | [WS-20](WORKSTREAMS.md#ws-20) |
| [PMS-16-06](#pms-16-06) | USALI-aligned statements | PARTIAL | Enterprise | P2 | M | [WS-20](WORKSTREAMS.md#ws-20) |
| [PMS-16-07](#pms-16-07) | Data warehouse / BI feed | MISSING | Enterprise | P2 | L | [WS-20](WORKSTREAMS.md#ws-20) |
| [PMS-16-08](#pms-16-08) | Ad-hoc query and custom views | MISSING | Enterprise | P2 | L | [WS-20](WORKSTREAMS.md#ws-20) |
| [PMS-16-09](#pms-16-09) | Benchmarking feed | MISSING | Enterprise | P2 | L | [WS-20](WORKSTREAMS.md#ws-20) |
| [PMS-16-10](#pms-16-10) | Embedded analytics | MISSING | Enterprise | P2 | L | [WS-20](WORKSTREAMS.md#ws-20) |

---

### PMS-16-01

**Housekeeping status and discrepancy reports** — PARTIAL · Table stakes · P0 · Effort M · [WS-12](WORKSTREAMS.md#ws-12)

**Today:** Status reporting exists; discrepancy does not.

**Fix:** Status reporting exists; discrepancy needs the detection job in WS-02.

### PMS-16-02

**Export formats** — PARTIAL · Table stakes · P0 · Effort M · [WS-06](WORKSTREAMS.md#ws-06)

**Today:** CSV and XML on GL batches only. No PDF or XLSX renderer in the repo.

**Fix:** Add PDF and XLSX writers next to the existing CSV/XML so every report can export.

### PMS-16-03

**Statistics by month and year** — PARTIAL · Competitive · P1 · Effort S · [WS-20](WORKSTREAMS.md#ws-20)

**Today:** Point-in-time KPIs; no period statistics.

**Fix:** Period aggregates rather than point-in-time KPIs.

### PMS-16-04

**Scheduled report distribution** — MISSING · Competitive · P1 · Effort M · [WS-20](WORKSTREAMS.md#ws-20)

**Today:** report_schedules table exists with no route and no runner.

**Fix:** `report_schedules` is a table with no route and no runner. Add both, then reuse the WS-06 renderer and WS-11 delivery.

### PMS-16-05

**Custom report builder** — MISSING · Competitive · P1 · Effort M · [WS-20](WORKSTREAMS.md#ws-20)

**Today:** Reports are fixed endpoints.

**Fix:** A saved-definition model over a constrained query surface — never raw SQL from the UI.

### PMS-16-06

**USALI-aligned statements** — PARTIAL · Enterprise · P2 · Effort M · [WS-20](WORKSTREAMS.md#ws-20)

**Today:** usali_category is on charge codes and GL entries; no USALI statement.

**Fix:** `usali_category` already sits on charge codes and GL entries — the statement is the missing piece.

### PMS-16-07

**Data warehouse / BI feed** — MISSING · Enterprise · P2 · Effort L · [WS-20](WORKSTREAMS.md#ws-20)

**Today:** No feed.

**Fix:** A change feed off the outbox into a warehouse.

### PMS-16-08

**Ad-hoc query and custom views** — MISSING · Enterprise · P2 · Effort L · [WS-20](WORKSTREAMS.md#ws-20)

**Today:** Not available.

**Fix:** Saved views over the same surface.

### PMS-16-09

**Benchmarking feed** — MISSING · Enterprise · P2 · Effort L · [WS-20](WORKSTREAMS.md#ws-20)

**Today:** Not available.

**Fix:** STR-style submission — needs the period statistics first.

### PMS-16-10

**Embedded analytics** — MISSING · Enterprise · P2 · Effort L · [WS-20](WORKSTREAMS.md#ws-20)

**Today:** Not available.

**Fix:** Depends on the warehouse feed.

