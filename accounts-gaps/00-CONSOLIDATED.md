# Accounts & Billing — Gap Analysis

> **Reference:** `docs/pms_accounting_final_v3.md` (USALI 12th Ed, PCI-DSS v4.0, ASC 606)
> **Audited:** billing-service backend (50+ commands, 16 engines, 5 route files, 4 repos) + pms-ui (7 accounts features + billing)
> **Date:** 2026-04-09

---

## What Already Works Well

The billing-service has solid coverage for core operations:
- ✅ Payment lifecycle: capture, refund, void, authorize, increment auth
- ✅ Invoice lifecycle: create, adjust, finalize, reopen, void, credit note
- ✅ Charge lifecycle: post, void, transfer, split (with routing rules)
- ✅ Folio lifecycle: create, close, reopen, merge, transfer, windows
- ✅ Night audit: 8-step process with room charges, packages, OTA commissions, no-shows, trial balance
- ✅ AR: post, apply payment, age, write-off
- ✅ Chargebacks: record, state machine (RECEIVED → EVIDENCE_SUBMITTED → WON/LOST)
- ✅ Cashiering: open/close sessions, variance reconciliation
- ✅ Comp posting: with budget tracking and authorization
- ✅ Tax configuration: CRUD, compound taxes, jurisdictions
- ✅ Fiscal periods: close, lock, reopen
- ✅ Commission: calculate, approve, mark paid, statements
- ✅ Folio routing rules: CRUD, templates, evaluation engine
- ✅ 16 calculation engines: tax, commission, loyalty, yield, folio, proration, allowance, forex, authorization, rate, cancellation, revenue, revenue-forecast, comp, split, deposit
- ✅ Compliance: encryption requirements, retention policy, PCI-DSS data handling
- ✅ Express checkout, late checkout charge, no-show charge, cancellation penalty

---

## Gap Summary — By Priority

### P0 — Revenue Accuracy & Financial Integrity (5 gaps)

| # | Gap | File | Type | Effort |
|---|-----|------|------|--------|
| 01 | GL journal entries not wired (tables exist, no code writes to them) | [01-gl-journal-entries.md](01-gl-journal-entries.md) | Backend | XL |
| 04 | Payment gateway webhooks (no async notification endpoint) | [04-payment-gateway-webhooks.md](04-payment-gateway-webhooks.md) | Backend | L |
| 05 | POS/HTNG integration endpoint (no dedicated POS charge API) | [05-pos-integration.md](05-pos-integration.md) | Backend | M |
| 14 | Night audit atomicity (partial charges on mid-run failure) | [14-night-audit-atomicity.md](14-night-audit-atomicity.md) | Backend | L |
| 15 | Concurrent payment + checkout lock (race condition) | [15-concurrent-payment-checkout-lock.md](15-concurrent-payment-checkout-lock.md) | Backend | M |

### P1 — Compliance & Reporting (7 gaps)

| # | Gap | File | Type | Effort |
|---|-----|------|------|--------|
| 06 | GL/ERP batch export (no export mechanism) | [06-gl-erp-export.md](06-gl-erp-export.md) | Backend+UI | L (after GAP-01) |
| 08 | Approval workflows / four-eyes principle (no enforcement) | [08-approval-workflows.md](08-approval-workflows.md) | Backend+UI | L |
| 09 | Audit trail not written by billing-service | [09-audit-trail-writing.md](09-audit-trail-writing.md) | Backend | M |
| 10 | Overpayment handling (no detection or action) | [10-overpayment-handling.md](10-overpayment-handling.md) | Backend | S |
| 11 | Invoice/credit note sequential numbering (gap-free) | [11-invoice-sequential-numbering.md](11-invoice-sequential-numbering.md) | Backend+SQL | M |
| 13 | Multi-currency FX rate locking per transaction | [13-multi-currency-fx-locking.md](13-multi-currency-fx-locking.md) | Backend+SQL | L |
| 16 | USALI chart of accounts & GL code mapping | [16-usali-gl-code-mapping.md](16-usali-gl-code-mapping.md) | SQL+Backend | M |

### P1 — UI Gaps (Backend exists but no UI) (3 gaps)

| # | Gap | File | Type | Effort |
|---|-----|------|------|--------|
| 18 | Chargeback management screen | [18-ui-chargeback-management.md](18-ui-chargeback-management.md) | UI | M |
| 19 | Credit note management | [19-ui-credit-notes.md](19-ui-credit-notes.md) | UI | S |
| 20 | Folio detail view & actions (merge, reopen, transfer) | [20-ui-folio-detail-actions.md](20-ui-folio-detail-actions.md) | UI | L |

### P2 — Revenue Recognition & Guest Experience (4 gaps)

| # | Gap | File | Type | Effort |
|---|-----|------|------|--------|
| 02 | Advance deposit ledger (liability vs revenue) | [02-advance-deposit-ledger.md](02-advance-deposit-ledger.md) | Backend | L |
| 03 | Suspense account for unroutable charges | [03-suspense-account.md](03-suspense-account.md) | Backend | M |
| 07 | Loyalty program integration (commands + provider API) | [07-loyalty-integration.md](07-loyalty-integration.md) | Backend+UI | XL |
| 12 | Cancellation policy snapshot at booking time | [12-cancellation-policy-snapshot.md](12-cancellation-policy-snapshot.md) | Cross-service | M |

### P2 — UI Gaps (4 gaps)

| # | Gap | File | Type | Effort |
|---|-----|------|------|--------|
| 17 | Group master billing management | [17-group-master-billing.md](17-group-master-billing.md) | Backend+UI | L |
| 21 | Folio routing rules management UI | [21-ui-routing-rules.md](21-ui-routing-rules.md) | UI | M |
| 22 | Deposit schedule management UI | [22-ui-deposit-management.md](22-ui-deposit-management.md) | UI | S |
| 23 | Financial audit log viewer UI | [23-ui-audit-log-viewer.md](23-ui-audit-log-viewer.md) | UI | S (after GAP-09) |

### P3 — Nice to Have (1 gap)

| # | Gap | File | Type | Effort |
|---|-----|------|------|--------|
| 24 | General ledger batch viewer UI | [24-ui-gl-viewer.md](24-ui-gl-viewer.md) | UI | M (after GAP-06) |

---

## Dependency Chain

```
GAP-01 (GL entries) ─────► GAP-06 (GL export) ───► GAP-24 (GL viewer UI)
                    ─────► GAP-16 (USALI mapping)

GAP-09 (Audit trail) ───► GAP-23 (Audit viewer UI)
GAP-02 (Deposits)    ───► GAP-22 (Deposit UI)
GAP-03 (Suspense)    ───► GAP-05 (POS integration, failure path)
```

---

## Recommended Implementation Order

**Phase 1 — P0 Financial Integrity (ship-blocking)**
1. GAP-15: Concurrent payment+checkout lock (S-M, immediate risk)
2. GAP-14: Night audit atomicity (L, wrap in transaction)
3. GAP-09: Audit trail writing (M, compliance baseline)
4. GAP-10: Overpayment handling (S, payment pipeline fix)
5. GAP-11: Invoice sequential numbering (M, tax compliance)

**Phase 2 — P0-P1 Core Infrastructure**
6. GAP-16: USALI chart of accounts + GL mapping (M, foundation for GL)
7. GAP-01: GL journal entry posting (XL, biggest single gap)
8. GAP-06: GL/ERP batch export (L, follows GAP-01)
9. GAP-04: Payment gateway webhooks (L, async payment lifecycle)
10. GAP-08: Approval workflows (L, fraud prevention)

**Phase 3 — P1 UI Catch-Up**
11. GAP-20: Folio detail view & actions (L)
12. GAP-18: Chargeback management UI (M)
13. GAP-19: Credit note UI (S)

**Phase 4 — P2 Revenue Recognition**
14. GAP-05: POS integration endpoint (M)
15. GAP-02: Advance deposit ledger (L)
16. GAP-03: Suspense account (M)
17. GAP-13: Multi-currency FX locking (L)
18. GAP-12: Cancellation policy snapshot (M)

**Phase 5 — P2 UI & Integrations**
19. GAP-17: Group master billing (L)
20. GAP-21: Routing rules UI (M)
21. GAP-22: Deposit UI (S)
22. GAP-07: Loyalty integration (XL)
23. GAP-23: Audit log viewer UI (S)
24. GAP-24: GL viewer UI (M)

---

## Effort Key
- **S** = 1-2 days (small scope, clear path)
- **M** = 3-5 days (moderate complexity)
- **L** = 1-2 weeks (significant work, multiple files)
- **XL** = 2-4 weeks (cross-cutting, many touch points)

---

## Cross-Reference to Doc Parts

| Doc Part | Status |
|----------|--------|
| Part 1: Reservation & Pre-Arrival | Partial (deposits gap: 02, cancellation snapshot: 12) |
| Part 2: In-Stay Charges | Partial (POS: 05, GL: 01) |
| Part 3: Folio & Billing | Good (routing rules ✅, missing suspense: 03) |
| Part 4: Payment Processing | Good (missing webhooks: 04, overpayment: 10, locking: 15) |
| Part 5: Invoice Lifecycle | Good (missing sequential numbering: 11) |
| Part 6: Checkout & Settlement | Good (express ✅, missing locking: 15) |
| Part 7: Group & Corporate | Partial (routing rules ✅, auto-workflow missing: 17) |
| Part 8: Accounts Receivable | Good (AR ✅, aging ✅, write-off ✅, missing approval: 08) |
| Part 9: Adjustments/Discounts | Good (comp ✅, FX calculation ✅, missing FX locking: 13) |
| Part 10: Tax Handling | Good (config ✅, compound ✅, fiscal periods ✅) |
| Part 11: Loyalty | Missing (calculation only, no commands: 07) |
| Part 12: Audit & Compliance | Partial (table exists, not written: 09, no approval: 08) |
| Part 13: Edge Cases | Partial (night audit recovery: 14, concurrent lock: 15, FX locking: 13) |
| Part 14: Integrations | Missing (POS: 05, webhooks: 04, GL export: 06, loyalty API: 07) |
| Part 15: State Machines | Good (all state machines implemented) |
| Part 16: Risk Matrix | Mapped to priorities above |
