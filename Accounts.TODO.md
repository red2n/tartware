# Accounts & Billing — Implementation Roadmap

> Generated from BA compliance audit against [`pms_accounting_ba_v2.md`](docs/pms_accounting_ba_v2.md).
> Date: 2025-04-08

---

## Legend

| Icon | Meaning |
|------|---------|
| ✅ | Fully implemented |
| ⚠️ | Partially implemented (backend or UI missing) |
| ❌ | Not implemented |
| 🔴 | P0/P1 — must fix before production |
| 🟡 | P2 — important, schedule next |
| 🟢 | P3 — nice-to-have |

---

## Phase 1 — Critical Business Logic (P0)

These gaps represent financial correctness issues that would cause incorrect accounting or compliance failures.

### 1.1 🔴 General Financial Audit Trail (§12.1)

**Problem**: Only night audit operations are logged (`night_audit_log`). No immutable log covers folio modifications, payment reversals, charge voids, charge transfers, or invoice reopens.

**BA Requirement**: Every create/update/void/transfer/refund must produce an immutable audit record with actor, timestamp, before/after values.

**Implementation**:

1. **SQL** — Create `financial_audit_log` table in [`scripts/tables/04-financial/`](scripts/tables/04-financial/)
   ```
   financial_audit_log (
     id UUID PK,
     tenant_id UUID NOT NULL,
     property_id UUID,
     entity_type VARCHAR(50),    -- 'PAYMENT', 'CHARGE', 'FOLIO', 'INVOICE', 'AR'
     entity_id UUID,
     action VARCHAR(50),         -- 'CREATE', 'VOID', 'REFUND', 'TRANSFER', 'ADJUST', 'REOPEN'
     actor_id UUID,
     actor_name VARCHAR,
     before_state JSONB,
     after_state JSONB,
     reason TEXT,
     created_at TIMESTAMPTZ DEFAULT NOW()
   )
   ```
   - Index on `(tenant_id, entity_type, entity_id)`
   - Index on `(tenant_id, created_at)` for time-range queries
   - **IMMUTABLE**: no UPDATE/DELETE allowed (use RLS or trigger)

2. **Schema** — Add `FinancialAuditLogRow` in [`schema/src/api/billing-rows.ts`](schema/src/api/billing-rows.ts)

3. **Service** — Create `audit-log-service.ts` in [`Apps/billing-service/src/services/`](Apps/billing-service/src/services/)
   - `logFinancialEvent(tenantId, entityType, entityId, action, actorId, before, after, reason)`
   - Call from every command handler that mutates financial state

4. **Routes** — Add `GET /v1/billing/audit-log` with filters (entity_type, entity_id, date range, actor)
   - Proxy in [`Apps/api-gateway/src/routes/billing-routes.ts`](Apps/api-gateway/src/routes/billing-routes.ts)

5. **UI** — Add audit log viewer tab in Night Audit or as standalone component

**References**:
- BA §12.1 — Audit Trail Requirements
- [`Apps/billing-service/src/services/billing-commands/night-audit.ts`](Apps/billing-service/src/services/billing-commands/night-audit.ts) — existing night audit logging pattern
- [`scripts/tables/04-financial/`](scripts/tables/04-financial/) — financial table directory

---

### 1.2 🔴 Checkout Balance Gate (§6.1)

**Problem**: Checkout proceeds even when folio balance > 0 and no routing rule covers the remainder. BA explicitly forbids this.

**BA Requirement**: System prevents checkout if any folio has unpaid balance unless a routing rule covers a city-ledger/direct-bill transfer.

**Implementation**:

1. **Service** — Add balance validation in the checkout flow
   - In [`Apps/reservations-command-service/src/`](Apps/reservations-command-service/src/) checkout handler:
     - Call billing-service `GET /v1/billing/folios?reservationId=X` to get all folio balances
     - If any folio has `balance > 0`, check if a routing rule routes remainder to company/city-ledger folio
     - If no coverage → reject checkout with `FOLIO_BALANCE_OUTSTANDING` error
   - Allow override with `force: true` + MANAGER role

2. **Gateway** — No new routes needed; validation happens inside checkout command handler

3. **UI** — Show folio balance summary on checkout confirmation dialog
   - Display each folio's outstanding balance
   - Block "Confirm Check-Out" button if balance > 0 (unless MANAGER override)

**References**:
- BA §6.1 — Settlement Requirements
- [`Apps/billing-service/src/routes/billing.ts`](Apps/billing-service/src/routes/billing.ts) — folio list endpoint
- Reservation checkout flow in [`Apps/reservations-command-service/`](Apps/reservations-command-service/)

---

### 1.3 🔴 Tax Computation Engine (§10.1)

**Problem**: `tax_configurations` table has rules by jurisdiction/charge_type/date, but tax is never auto-computed. Callers manually supply `tax_amount` on charge postings.

**BA Requirement**: When a charge is posted, the system must look up applicable tax rules and compute tax automatically.

**Implementation**:

1. **Service** — Create `tax-engine-service.ts` in [`Apps/billing-service/src/services/`](Apps/billing-service/src/services/)
   ```
   computeTax(tenantId, propertyId, chargeCode, amount, date) → {
     taxDetails: Array<{ taxConfigId, taxName, rate, amount }>,
     totalTax: number
   }
   ```
   - Look up all active `tax_configurations` matching the charge's `charge_category`, `jurisdiction`, and date range
   - Support stacking (multiple taxes on same charge: state tax + city tax + tourism levy)
   - Support inclusive vs exclusive tax (is the charge amount pre-tax or post-tax?)

2. **Integration** — Hook into `billing.charge.post` command handler
   - After validating charge, call `computeTax()` automatically
   - Store breakdown in `charge_postings.tax_details` (JSONB) alongside computed `tax_amount`
   - Allow manual override with `tax_override: true` flag (audit logged)

3. **SQL** — Add `tax_details JSONB` column to `charge_postings` if not present
   - Stores array of `{ config_id, name, rate, amount }` for each applicable tax

4. **Schema** — Add `TaxComputationResult` type in [`schema/src/api/billing.ts`](schema/src/api/billing.ts)

**References**:
- BA §10.1 — Dynamic Tax Computation
- [`Apps/billing-service/src/services/billing-commands/`](Apps/billing-service/src/services/billing-commands/) — charge posting handler
- [`scripts/tables/04-financial/`](scripts/tables/04-financial/) — `tax_configurations` table

---

### 1.4 🔴 Payment Gateway Integration (§14)

**Problem**: `payment_gateway_configurations` and `payment_tokens` tables exist but there is zero integration code. Payments are recorded but never processed through an actual gateway.

**BA Requirement**: Authorize → Capture flow for card payments; tokenization for recurring; PCI DSS compliance.

**Implementation**:

1. **Service** — Create `payment-gateway-service.ts` in [`Apps/billing-service/src/services/`](Apps/billing-service/src/services/)
   - Provider interface: `PaymentGatewayProvider` with `authorize()`, `capture()`, `refund()`, `void()`, `tokenize()`
   - Adapter pattern: start with one provider (Stripe or Adyen), add others later
   - Use `payment_gateway_configurations` table to load provider config per property

2. **Commands** — Wire into existing payment commands:
   - `billing.payment.authorize` → call `provider.authorize()`; store auth code
   - `billing.payment.capture` → if authorization exists, call `provider.capture()`
   - `billing.payment.refund` → call `provider.refund()` with original transaction ref
   - `billing.payment.void` → call `provider.void()` if not yet settled

3. **Schema** — Add gateway response types in [`schema/src/api/billing.ts`](schema/src/api/billing.ts)
   - `PaymentGatewayResponse`, `AuthorizationResult`, `CaptureResult`

4. **Security** — Gateway credentials stored encrypted in `payment_gateway_configurations`
   - Never log card numbers; use tokenization for storage
   - PCI scope: only gateway service touches raw card data

5. **Gateway Routes** — Add dedicated routes for `billing.payment.authorize` and `billing.payment.authorize_increment` in [`Apps/api-gateway/src/routes/billing-routes.ts`](Apps/api-gateway/src/routes/billing-routes.ts)

**References**:
- BA §4.1 — Payment Authorization
- BA §14 — Integration Touchpoints
- [`scripts/tables/04-financial/`](scripts/tables/04-financial/) — `payment_gateway_configurations`, `payment_tokens` tables

---

## Phase 2 — Financial Compliance (P1)

### 2.1 🔴 Deposit Liability Accounting (§1.1)

**Problem**: Advance deposits are captured as regular `ADVANCE_DEPOSIT` payment types but immediately count as revenue. BA requires deposits to be held in a Deposit Liability GL account until stay consumption on each night.

**Implementation**:

1. **GL Entries** — When recording an advance deposit:
   - Debit: Cash/Bank account
   - Credit: **Deposit Liability** (not Revenue)
   - During night audit room charge posting: transfer proportional deposit from Liability → Revenue

2. **Service** — Add deposit liability tracking in `payment-service.ts`
   - On `billing.payment.capture` with `transaction_type=ADVANCE_DEPOSIT`:
     - Create GL entry crediting Deposit Liability
   - On night audit room charge posting:
     - Consume deposit: debit Deposit Liability, credit Room Revenue

3. **Schema** — Add GL account type enum values for `DEPOSIT_LIABILITY`

4. **SQL** — Ensure `general_ledger_entries` supports liability account categories

**References**:
- BA §1.1 — Advance Deposit Handling
- [`Apps/billing-service/src/services/billing-commands/night-audit.ts`](Apps/billing-service/src/services/billing-commands/night-audit.ts) — room charge posting
- USALI chart of accounts — Deposit Liability classification

---

### 2.2 🔴 Multi-Currency Support (§9.3)

**Problem**: `currency` columns exist on payments/folios/charges tables but there is zero exchange rate logic. No rate table, no rate locking, no conversion API.

**BA Requirement**: P1 High — support foreign currency payments with rate locking at transaction time.

**Implementation**:

1. **SQL** — Create `exchange_rates` table in [`scripts/tables/04-financial/`](scripts/tables/04-financial/)
   ```
   exchange_rates (
     id UUID PK,
     tenant_id UUID NOT NULL,
     property_id UUID,
     source_currency CHAR(3),
     target_currency CHAR(3),
     rate DECIMAL(18,8),
     effective_date DATE,
     expiry_date DATE,
     source VARCHAR(50),  -- 'MANUAL', 'API_FEED', 'CENTRAL_BANK'
     created_at TIMESTAMPTZ
   )
   ```

2. **Service** — Create `exchange-rate-service.ts`
   - `getRate(from, to, date)` → rate lookup with fallback chain
   - `convertAmount(amount, from, to, date)` → returns converted amount + rate used
   - `lockRate(transactionId, rate)` → stores the rate used at transaction time

3. **Integration** — Hook into payment capture:
   - When payment currency ≠ folio currency, look up rate, lock it, convert
   - Store both original and converted amounts + locked rate on payment record

4. **Routes** — Add `GET /v1/billing/exchange-rates` and admin CRUD for manual rate entry

5. **Schema** — Add `ExchangeRateRow`, `CurrencyConversion` types in [`schema/src/api/billing-rows.ts`](schema/src/api/billing-rows.ts)

**References**:
- BA §9.3 — Multi-Currency Processing
- BA §13.4 — Currency Fluctuation Edge Case
- [`schema/src/schemas/billing.ts`](schema/src/schemas/billing.ts) — existing currency fields

---

### 2.3 🔴 Four-Eyes Approval Workflow (§12.3)

**Problem**: Sensitive operations (void, write-off, invoice reopen, comp above threshold) require only a single authorized user. BA requires dual approval for high-risk financial actions.

**Implementation**:

1. **SQL** — Create `approval_requests` table
   ```
   approval_requests (
     id UUID PK,
     tenant_id UUID NOT NULL,
     request_type VARCHAR(50),     -- 'VOID', 'WRITE_OFF', 'INVOICE_REOPEN', 'COMP'
     entity_type VARCHAR(50),
     entity_id UUID,
     requested_by UUID,
     approved_by UUID,
     status VARCHAR(20),           -- 'PENDING', 'APPROVED', 'REJECTED'
     amount DECIMAL(14,2),
     reason TEXT,
     threshold_rule VARCHAR(100),
     created_at TIMESTAMPTZ,
     resolved_at TIMESTAMPTZ
   )
   ```

2. **Service** — Create `approval-service.ts`
   - Configurable thresholds per operation type (e.g., comp > $500 needs approval)
   - `requestApproval(type, entityId, amount, requestedBy)` → creates pending request
   - `resolveApproval(requestId, approvedBy, decision)` → APPROVED or REJECTED
   - Approved → execute the original command

3. **Commands** — Add `billing.approval.request`, `billing.approval.resolve`

4. **UI** — Add approval queue panel for Finance Managers

**References**:
- BA §12.3 — RBAC & Four-Eyes
- BA §8.3 — Write-Off Approval (CFO for large amounts)

---

## Phase 3 — Missing Features (P2)

### 3.1 🟡 POS Integration Endpoint (§2.2, §14)

**Problem**: No inbound API for POS systems (Micros, Aloha, etc.) to push charges to guest folios automatically.

**Implementation**:

1. **Routes** — Add `POST /v1/billing/pos-charges` in billing-service
   - Accepts: `{ terminalId, guestId, roomNumber, chargeCode, amount, items[], posTransactionId }`
   - Validates guest is in-house and has active folio
   - Routes charge to correct folio via routing rules
   - Returns confirmation with folio charge ID

2. **Auth** — POS uses API key auth (not JWT); separate `pos_api_keys` table per property

3. **Suspense Account** — If routing fails (guest not found, no active folio), post to suspense account for manual resolution

4. **Schema** — Add `PosChargeInput` in [`schema/src/events/commands/billing.ts`](schema/src/events/commands/billing.ts)

**References**:
- BA §2.2 — Ancillary Charges from POS
- BA §14 — POS Integration
- [`Apps/billing-service/src/services/billing-commands/`](Apps/billing-service/src/services/billing-commands/) — charge posting

---

### 3.2 🟡 Charge Adjustment (not just Void) (§2.3)

**Problem**: Only void exists. BA requires adjustment posting (negative charge with linked original ID + reason code) that preserves the original charge as-is on the ledger.

**Implementation**:

1. **Command** — Add `billing.charge.adjust` command
   - Creates a reversing entry (negative amount) linked to original charge via `original_charge_id`
   - Original charge remains with `status=ADJUSTED` (not deleted/voided)
   - Adjustment charge has `adjustment_reason` enum (PRICING_ERROR, WRONG_ROOM, DUPLICATE, OTHER)

2. **SQL** — Add `original_charge_id UUID REFERENCES charge_postings(id)` and `adjustment_reason` to `charge_postings`

3. **Schema** — Add `ChargeAdjustmentPayload` in [`schema/src/events/commands/billing.ts`](schema/src/events/commands/billing.ts)

4. **UI** — Add "Adjust" action alongside "Void" in Billing → Charges table

**References**:
- BA §2.3 — Charge Adjustment Requirements
- BA §12.1 — "Charges cannot be deleted from the ledger"

---

### 3.3 🟡 Chargeback Management UI (§4.4)

**Problem**: `billing.chargeback.record` and `billing.chargeback.update_status` commands exist. Status update has a gateway route. Recording has no dedicated gateway route. No UI at all.

**Implementation**:

1. **Gateway** — Add `POST /v1/billing/payments/:paymentId/chargeback` route for `billing.chargeback.record` in [`Apps/api-gateway/src/routes/billing-routes.ts`](Apps/api-gateway/src/routes/billing-routes.ts)

2. **Routes** — Add `GET /v1/billing/chargebacks` list endpoint in billing-service with filters (status, date range, amount range)

3. **UI** — Create `chargeback-management` component under billing
   - List view with status badges (RECEIVED, EVIDENCE_SUBMITTED, WON, LOST)
   - Record new chargeback (link to payment, bank reference, amount, reason)
   - Submit evidence action
   - Update outcome (WON → reverse chargeback; LOST → write off)

4. **Schema** — Add `ChargebackRow` in [`schema/src/api/billing-rows.ts`](schema/src/api/billing-rows.ts) if not present

**References**:
- BA §4.4 — Chargeback Handling
- [`Apps/billing-service/src/services/billing-commands/chargeback-commands.ts`](Apps/billing-service/src/services/billing-commands/) — existing handlers

---

### 3.4 🟡 Charge Transfer Gateway Route (§3.4)

**Problem**: `billing.charge.transfer` command handler exists in billing-service but has no dedicated gateway route. Currently only reachable via generic `/v1/commands/billing.charge.transfer/execute`.

**Implementation**:

1. **Gateway** — Add dedicated route in [`Apps/api-gateway/src/routes/billing-routes.ts`](Apps/api-gateway/src/routes/billing-routes.ts):
   ```
   POST /v1/billing/charges/:chargeId/transfer
   Body: { targetFolioId, reason }
   ```

2. **UI** — Add "Transfer" action in Billing → Charges table action menu
   - Modal: select target folio from reservation's folio list
   - Reason field (required)

**References**:
- BA §3.4 — Charge Transfer Between Folios
- [`Apps/billing-service/src/services/billing-commands/`](Apps/billing-service/src/services/billing-commands/) — transfer handler

---

### 3.5 🟡 Fiscal Periods Read Endpoint (§12.4)

**Problem**: `billing.fiscal_period.close/lock/reopen` commands exist. UI component exists. But there is **no GET endpoint** to list fiscal periods — the UI has no data source.

**Implementation**:

1. **Route** — Add `GET /v1/billing/fiscal-periods` in billing-service routes
   - Query params: `status`, `year`, `page`, `limit`
   - Returns: `{ data: FiscalPeriod[], total, page, limit }`

2. **Repository** — Add `listFiscalPeriods()` query in billing repository

3. **Gateway** — Proxy the GET endpoint in [`Apps/api-gateway/src/routes/billing-routes.ts`](Apps/api-gateway/src/routes/billing-routes.ts)

4. **Schema** — Add `FiscalPeriodRow` and list query schema

**References**:
- BA §12.4 — Financial Period Close
- [`scripts/tables/04-financial/`](scripts/tables/04-financial/) — `fiscal_periods` table
- UI component: [`UI/pms-ui/src/app/features/billing/fiscal-periods/`](UI/pms-ui/src/app/features/billing/fiscal-periods/)

---

### 3.6 🟡 Invoice Reopen UI (§5.2)

**Problem**: `billing.invoice.reopen` command and gateway route exist. No UI button to trigger it.

**Implementation**:

1. **UI** — Add "Reopen" action in Invoices component for finalized invoices
   - Only visible to MANAGER role
   - Requires reason text (mandatory)
   - Confirmation dialog: "This will reopen a finalized invoice. Continue?"

**References**:
- BA §5.2 — Invoice Lifecycle
- Gateway route: `POST /v1/billing/invoices/:id/reopen`

---

### 3.7 🟡 Tax Exemption UI (§10.2)

**Problem**: `billing.tax_exemption.apply` command and gateway route exist. No UI.

**Implementation**:

1. **UI** — Add "Apply Tax Exemption" action on folio detail
   - Form: exemption type (GOVERNMENT, DIPLOMATIC, NON_PROFIT, OTHER), certificate number, expiry date
   - Show exemption badge on folio header when active

**References**:
- BA §10.2 — Tax-Exempt Billing
- Gateway route: `POST /v1/billing/folios/:id/tax-exemption`

---

### 3.8 🟡 Comp Management UI (§9.1)

**Problem**: `billing.comp.post` command and gateway route exist. `comp_accounting` table tracks comp budgets. No UI.

**Implementation**:

1. **UI** — Add "Post Comp" action in charge posting form
   - Comp type selection (ROOM, FB, SPA, MINIBAR, OTHER)
   - Authorization code field
   - Comp reason (required)
   - Show comp budget remaining for department (from `comp_accounting`)

2. **Routes** — Add `GET /v1/billing/comp-budgets` endpoint for department-level comp tracking

**References**:
- BA §9.1 — Complimentary Charges
- [`scripts/tables/04-financial/`](scripts/tables/04-financial/) — `comp_accounting` table

---

## Phase 4 — Advanced Features (P3)

### 4.1 🟢 Discount & Package Engine (§9.2)

**Problem**: No structured discount/promo system. `discount_amount` exists on charges but no package breakdown or discount rule engine.

**Implementation**:

1. **SQL** — Create `discount_rules` and `packages` tables
2. **Service** — Discount engine: validate promo codes, date-range checks, stacking rules
3. **Integration** — Hook into charge posting to auto-apply qualifying discounts
4. **UI** — Discount management screen under Finance Admin

**References**:
- BA §9.2 — Discounts & Packages

---

### 4.2 🟢 GL/ERP Export (§14)

**Problem**: `general_ledger_entries` and `general_ledger_batches` tables exist. Night audit writes GL entries. But no batch export to external ERP (SAP, Oracle, QuickBooks).

**Implementation**:

1. **Service** — Create `gl-export-service.ts`
   - Batch GL entries by date range into export format (CSV, XML, JSON)
   - Mark exported entries to prevent re-export
2. **Route** — `POST /v1/billing/gl/export` with date range params
3. **UI** — Export button in Night Audit → Reports tab

**References**:
- BA §14 — GL/ERP Integration
- [`scripts/tables/04-financial/`](scripts/tables/04-financial/) — `general_ledger_entries`, `general_ledger_batches` tables

---

### 4.3 🟢 Loyalty Workflow Integration (§11)

**Problem**: Calculation engine exists (`moneyToPoints`, `pointsToMoney`, `processRedemption`) but no integration with checkout or payment flow.

**Implementation**:

1. **Checkout Hook** — After successful checkout, call `moneyToPoints()` to compute earned points
2. **Payment Type** — Add `LOYALTY_REDEMPTION` as payment method; call `processRedemption()` during capture
3. **UI** — Show loyalty points summary on checkout dialog; "Pay with Points" option in payment capture

**References**:
- BA §11 — Loyalty & Redemption
- [`Apps/calculation-service/`](Apps/calculation-service/) — loyalty calculation routes

---

### 4.4 🟢 Early Departure Fee (§2.4)

**Problem**: No early departure handling. BA requires configurable early departure policy and automatic fee posting.

**Implementation**:

1. **Config** — Add early departure policy to rate plan or booking config
2. **Command** — `billing.early_departure.charge` — calculate fee based on remaining nights × policy percentage
3. **Integration** — Trigger on checkout when departure date < original departure date

**References**:
- BA §2.4 — Early Departure

---

### 4.5 🟢 Late Checkout UI (§6.2)

**Problem**: `billing.late_checkout.charge` command and gateway route exist. No UI.

**Implementation**:

1. **UI** — Add late checkout charge button on reservation detail (checkout flow)
   - Auto-calculate based on time past checkout (configurable tiers: 50% half-day, 100% full-day)
   - Show computed amount before confirmation

**References**:
- BA §6.2 — Late Checkout
- Gateway route: `POST /v1/billing/reservations/:id/late-checkout-charge`

---

### 4.6 🟢 Folio State Machine Alignment (§15)

**Problem**: Backend uses OPEN/CLOSED/SUSPENDED. BA defines OPEN→SETTLED→CLOSED (SETTLED = all charges posted and paid, CLOSED = invoice generated and account finalized).

**Implementation**:

1. **SQL** — Add `SETTLED` to folio status enum
2. **Logic** — After all charges are posted and balance = 0, transition to SETTLED. After invoice finalization, transition to CLOSED.
3. **Schema** — Update `FolioStatus` enum in [`schema/src/schemas/billing.ts`](schema/src/schemas/billing.ts)

**References**:
- BA §15 — State Machines
- [`scripts/02-enum-types.sql`](scripts/02-enum-types.sql)

---

### 4.7 🟢 Overpayment Detection (§4.2)

**Problem**: No validation prevents posting a payment exceeding folio balance. No credit balance display or refund-of-excess workflow.

**Implementation**:

1. **Validation** — In `billing.payment.capture`, compare payment amount against folio balance
   - If `amount > balance`: reject by default; allow with `allow_overpayment: true` flag
   - If overpayment allowed: store credit balance on folio
2. **UI** — Show credit balance badge on folio; "Refund Excess" button

**References**:
- BA §4.2 — Overpayment Handling

---

### 4.8 🟢 Transaction Lineage Chain (§13.3)

**Problem**: Split, transfer, and refund are independent operations with no parent transaction reference linking them.

**Implementation**:

1. **SQL** — Add `parent_transaction_id` and `transaction_chain_id` to `payments` and `charge_postings`
2. **Service** — When splitting/transferring/refunding, set parent reference to original transaction
3. **UI** — Show transaction chain visualization on charge/payment detail

**References**:
- BA §13.3 — Split+Transfer+Refund Chain

---

## Summary Matrix

| Phase | Items | Priority | Estimated Scope |
|-------|-------|----------|----------------|
| **Phase 1** — Critical Business Logic | 4 items | 🔴 P0 | SQL + Service + Routes + UI |
| **Phase 2** — Financial Compliance | 3 items | 🔴 P1 | SQL + Service + Routes |
| **Phase 3** — Missing Features | 8 items | 🟡 P2 | Routes + UI + minor backend |
| **Phase 4** — Advanced Features | 8 items | 🟢 P3 | Full stack |

### What's Already Working Well ✅

- 46+ command handlers covering full billing vocabulary
- Idempotent command processing via deduplication table
- Night audit with pre-audit checks, bucket check, trial balance, date management
- Full AR lifecycle (aging, payment, write-off, aging summary)
- Fiscal period management with state machine (close/lock/reopen)
- Routing rule engine with priority-ordered evaluation and stop-on-match
- Tax configuration CRUD with jurisdiction/type/date specificity
- Commission tracking (calculate, approve, mark paid)
- Cashier session management (open/close/handover with variance tracking)
- Credit limit enforcement in payment capture
- Express checkout command
- No-show charge automation via night audit
- Credit note issuance against finalized invoices
- Comprehensive Zod schemas centralized in `@tartware/schemas`

---

## Key File References

| Area | Files |
|------|-------|
| **Billing Service Routes** | [`Apps/billing-service/src/routes/`](Apps/billing-service/src/routes/) |
| **Billing Command Handlers** | [`Apps/billing-service/src/services/billing-commands/`](Apps/billing-service/src/services/billing-commands/) |
| **Gateway Billing Routes** | [`Apps/api-gateway/src/routes/billing-routes.ts`](Apps/api-gateway/src/routes/billing-routes.ts) |
| **Financial SQL Tables** | [`scripts/tables/04-financial/`](scripts/tables/04-financial/) |
| **Billing Schemas** | [`schema/src/schemas/billing.ts`](schema/src/schemas/billing.ts) |
| **Billing API Types** | [`schema/src/api/billing.ts`](schema/src/api/billing.ts) |
| **Billing Row Types** | [`schema/src/api/billing-rows.ts`](schema/src/api/billing-rows.ts) |
| **Command Payloads** | [`schema/src/events/commands/billing.ts`](schema/src/events/commands/billing.ts) |
| **Enum Types SQL** | [`scripts/02-enum-types.sql`](scripts/02-enum-types.sql) |
| **BA Spec Document** | [`docs/pms_accounting_ba_v2.md`](docs/pms_accounting_ba_v2.md) |
| **UI Billing Components** | [`UI/pms-ui/src/app/features/billing/`](UI/pms-ui/src/app/features/billing/) |
| **UI Accounts Components** | [`UI/pms-ui/src/app/features/accounts/`](UI/pms-ui/src/app/features/accounts/) |
