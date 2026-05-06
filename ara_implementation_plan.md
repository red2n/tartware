# ARA — Accounts Receivable Analyst System
## Implementation Plan for tartware / billing-service

---

## Overview

ARA extends the existing `billing-service` to track and recover money owed after guest departure.
It covers both **corporate/city ledger (B2B debt)** and **group billing settlements** equally.

**Architecture principle:** No new microservice. All AR modules live inside `billing-service` as new command handlers, tables, and read endpoints — connected to the existing Kafka pipeline, night audit, notification service, and transactional outbox.

---

## Key Concepts

| Concept | Definition |
|---|---|
| **AR account** | A credit-extended entity (corporate client, travel agency, group master). Distinct from a folio. |
| **City ledger** | AR sub-ledger where unsettled post-departure charges live. Folio balance transfers here on direct-bill checkout. |
| **Aging** | Outstanding debt bucketed by overdue time: current, 0–30, 31–60, 61–90, 90+ days. |
| **Dunning** | Automated escalating reminders: email → statement → formal demand → collections handoff. |
| **Cash application** | Matching an incoming payment against one or more open invoices. Handles partial, overpayment, write-offs. |
| **DSO** | Days Sales Outstanding = `total AR balance ÷ avg daily revenue`. Primary KPI for an AR analyst. |
| **Credit limit enforcement** | Gate new folio/invoice creation against `getCreditLimitLeft()` per AR account in real-time. |
| **Dispute management** | Disputed invoice is frozen; collection is paused until resolution. |

---

## What Already Exists (do not rebuild)

- `billing.ar.create_account` / `billing.ar.post_payment` — extend, not replace
- `getCreditLimitLeft()` — wire into `ar.city_ledger.transfer` as pre-check gate
- Notification service + templates — dunning reuses this directly
- Night audit pipeline — aging compute plugs in as an additional step
- Transactional outbox — all new AR commands go through existing outbox

---

## Database Schema — 6 New Tables

```sql
-- 1. AR Accounts (extend existing)
ar_accounts (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  company_id UUID NOT NULL,
  credit_limit NUMERIC(15,2),
  payment_terms VARCHAR(10),  -- NET30 | NET45 | NET60
  status VARCHAR(20),         -- ACTIVE | SUSPENDED | COLLECTIONS
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

-- 2. City Ledger
ar_city_ledger (
  id UUID PRIMARY KEY,
  ar_account_id UUID REFERENCES ar_accounts(id),
  invoice_id UUID,
  folio_id UUID,
  original_amount NUMERIC(15,2),
  outstanding_amount NUMERIC(15,2),
  transfer_date DATE,
  due_date DATE,
  status VARCHAR(20),  -- OPEN | PARTIAL | SETTLED | WRITTEN_OFF | DISPUTED
  created_at TIMESTAMPTZ
);

-- 3. Aging Snapshots (nightly)
ar_aging_snapshots (
  id UUID PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  ar_account_id UUID REFERENCES ar_accounts(id),
  current_amt NUMERIC(15,2),
  bucket_30 NUMERIC(15,2),
  bucket_60 NUMERIC(15,2),
  bucket_90 NUMERIC(15,2),
  bucket_90plus NUMERIC(15,2),
  total_outstanding NUMERIC(15,2),
  dso_contribution NUMERIC(10,4),
  created_at TIMESTAMPTZ
);

-- 4. Dunning Events
ar_dunning_events (
  id UUID PRIMARY KEY,
  ar_account_id UUID REFERENCES ar_accounts(id),
  triggered_at TIMESTAMPTZ,
  bucket VARCHAR(10),       -- 30 | 60 | 90 | 90+
  action_taken VARCHAR(30), -- EMAIL | STATEMENT | FORMAL_NOTICE | COLLECTIONS
  template_code VARCHAR(50),
  status VARCHAR(20),       -- SENT | SUPPRESSED | FAILED
  created_at TIMESTAMPTZ
);

-- 5. Cash Applications
ar_cash_applications (
  id UUID PRIMARY KEY,
  payment_id UUID NOT NULL,
  ar_account_id UUID REFERENCES ar_accounts(id),
  applied_amount NUMERIC(15,2),
  application_date DATE,
  invoice_allocations JSONB,  -- [{invoice_id, amount}, ...]
  created_at TIMESTAMPTZ
);

-- 6. Disputes
ar_disputes (
  id UUID PRIMARY KEY,
  city_ledger_id UUID REFERENCES ar_city_ledger(id),
  raised_by UUID,
  reason TEXT,
  status VARCHAR(20),           -- OPEN | RESOLVED | ESCALATED
  disputed_amount NUMERIC(15,2),
  resolved_amount NUMERIC(15,2),
  resolution_notes TEXT,
  created_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
);
```

---

## New Kafka Commands

```
# City Ledger
ar.account.create              -- extends billing.ar.create_account
ar.account.update_terms        -- update credit_limit, payment_terms
ar.city_ledger.transfer        -- move folio balance to city ledger on checkout
ar.city_ledger.write_off       -- bad debt write-off + GL entry

# Aging
ar.aging.compute               -- triggered nightly by night_audit.advance_business_date

# Dunning
ar.dunning.trigger             -- fired by aging compute on bucket threshold breach
ar.dunning.suppress            -- manual override (account in active negotiation)
ar.dunning.escalate            -- force jump to next dunning level

# Cash Application
ar.payment.apply               -- match incoming payment to open invoices
ar.payment.unapply             -- reverse a misapplication

# Disputes
ar.dispute.raise               -- freeze city ledger entry
ar.dispute.resolve             -- partial or full resolution, triggers adjusted invoice
ar.dispute.escalate            -- escalate to legal/collections
```

---

## Sprint Plan

### Sprint 1 — AR Account & City Ledger Foundation

**Goal:** Automated transfer of unsettled folio balances into city ledger on checkout.

**Deliverables:**
- Tables: `ar_accounts`, `ar_city_ledger`
- Commands: `ar.account.create`, `ar.account.update_terms`, `ar.city_ledger.transfer`, `ar.city_ledger.write_off`
- Wire `reservation.checked_out` event: if folio has a direct-bill routing rule → auto-fire `ar.city_ledger.transfer`
- Pre-check `getCreditLimitLeft()` before every transfer

**Acceptance criteria:**
- Direct-bill checkout creates a city ledger entry atomically via outbox
- Transfer is idempotent (deduplicated by folio_id + ar_account_id)
- Credit limit exceeded → checkout blocked, error surfaced to front desk

---

### Sprint 2 — Aging Engine

**Goal:** Nightly aging snapshot per AR account; the foundation for dunning and analytics.

**Deliverables:**
- Table: `ar_aging_snapshots`
- Command: `ar.aging.compute` (triggered inside `night_audit.advance_business_date`)
- For each open city ledger entry: compute `CURRENT_DATE - due_date`, slot into bucket, write snapshot

**Acceptance criteria:**
- Aging runs atomically inside night audit transaction (or is explicitly idempotent if outside)
- Snapshot exists for every AR account with outstanding balance after each night audit
- Aging report endpoint returns correct bucket totals

---

### Sprint 3 — Dunning Engine

**Goal:** Automated, rule-driven collection reminders based on aging bucket.

**Deliverables:**
- Tables: `ar_dunning_rules` (config), `ar_dunning_events`
- Commands: `ar.dunning.trigger`, `ar.dunning.suppress`, `ar.dunning.escalate`
- Dunning rules config: per-bucket action + template_code + delay_days
- Integration: reuse existing notification-service for all outbound comms

**Dunning escalation path:**
```
0–30 days  → EMAIL (reminder)
31–60 days → STATEMENT (formal statement)
61–90 days → FORMAL_NOTICE (legal-style demand)
90+ days   → COLLECTIONS (handoff flag)
```

**Acceptance criteria:**
- Disputed city ledger entries are excluded from dunning runs automatically
- Suppressed accounts skip dunning until suppression is lifted
- Every dunning action is logged to `ar_dunning_events` via outbox

---

### Sprint 4 — Cash Application & Dispute Management

**Goal:** Match incoming payments to invoices; freeze and resolve disputed charges.

**Deliverables:**
- Tables: `ar_cash_applications`, `ar_disputes`
- Commands: `ar.payment.apply`, `ar.payment.unapply`, `ar.dispute.raise`, `ar.dispute.resolve`, `ar.dispute.escalate`

**Cash application rules:**
- Oldest invoice first by default (FIFO)
- Partial payment → update `outstanding_amount` on city ledger entry
- Overpayment → credit note issued via existing invoice handler
- Misapplication → `ar.payment.unapply` reverses and re-opens invoices

**Dispute rules:**
- `ar.dispute.raise` → sets city ledger entry status to `DISPUTED`, excludes from dunning
- `ar.dispute.resolve` → partial or full; if partial, creates adjusted invoice for remainder
- `ar.dispute.escalate` → sets account status to `COLLECTIONS`

**Acceptance criteria:**
- Cash application is idempotent (deduplicated by payment_id)
- Disputed entries excluded from aging contribution to dunning
- Write-off creates a corresponding GL entry (double-entry: debit bad-debt expense, credit AR)

---

### Sprint 5 — Analytics & Read Endpoints

**Goal:** Give the AR analyst a dashboard-ready data layer.

**New endpoints under `/v1/billing/ar/`:**

| Endpoint | Description |
|---|---|
| `GET /aging-report` | Aging buckets per account + property totals |
| `GET /dso` | DSO for tenant, rolling 30/60/90 day |
| `GET /collection-rate` | % collected within terms per period |
| `GET /dunning-effectiveness` | Dunning actions vs amount recovered |
| `GET /accounts/:id/statement` | Full account statement (ledger + payments + disputes) |
| `GET /accounts/:id/risk-score` | Computed: DSO contribution + aging bucket + dispute history |

**DSO formula:**
```
DSO = (total_outstanding / total_revenue_last_90_days) * 90
```

**Risk score components:**
- Days in 90+ bucket (weighted highest)
- Number of open disputes
- Payment history (avg days to pay vs terms)
- DSO contribution vs account average

---

## Integration Points

```
reservation.checked_out
  └─► ar.city_ledger.transfer (if direct-bill routing)

night_audit.advance_business_date
  └─► ar.aging.compute
        └─► ar.dunning.trigger (per account crossing threshold)
              └─► notification.send (existing service)

billing.payment.received
  └─► ar.payment.apply (if payment linked to AR account)
```

---

## Non-Functional Requirements

| Requirement | Specification |
|---|---|
| Idempotency | All AR commands deduplicated by natural key via outbox |
| Atomicity | City ledger transfer + GL entry in single transaction |
| Audit trail | Every state change logged with actor, timestamp, reason |
| RBAC | AR write commands: `AR_MANAGER` role minimum; read endpoints: `AR_ANALYST` |
| Aging accuracy | Snapshot must reflect end-of-business-day balance, not real-time |
| Dispute freeze | Disputed entries must be excluded from dunning within same transaction as dispute creation |
