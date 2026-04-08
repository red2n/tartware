# 🏨 Property Management System (PMS)
## Business Analysis: Accounting & Financial Scenarios
### Version 2.0 | Production-Ready | Business Analyst Reference

---

> **Document Purpose:** This document defines real-world accounting scenarios for a PMS from a Business Analyst perspective. It covers business intent, actor responsibilities, system behaviors, business rules, acceptance criteria, integration touchpoints, risk ratings, and edge cases. It is intended as a source of truth for product, engineering, and QA teams.

---

## 📐 Document Conventions

| Symbol | Meaning |
|--------|---------|
| 🔴 | High Risk / Critical |
| 🟡 | Medium Risk |
| 🟢 | Low Risk |
| 🔒 | Requires Authorization / RBAC |
| 🔁 | Triggers downstream process |
| ⚡ | Real-time / Time-sensitive |

---

## 🧩 Actor Reference

| Actor | Role |
|-------|------|
| **Guest** | End consumer initiating or subject to financial activity |
| **Front Desk Agent** | Executes day-to-day folio and payment operations |
| **Night Auditor** | Runs daily financial closure and charge posting |
| **Finance Manager** | Approves adjustments, write-offs, and reopens |
| **Revenue Manager** | Oversees pricing, packages, and comp rules |
| **System (Auto)** | Automated processes: night audit, routing, tax engine |
| **Corporate/Company** | Third-party payer via direct billing |

---

## 🗂️ Table of Contents

1. [Reservation & Pre-Arrival Financials](#1-reservation--pre-arrival-financials)
2. [In-Stay Charge Management](#2-in-stay-charge-management)
3. [Folio & Billing Structure](#3-folio--billing-structure)
4. [Payment Processing](#4-payment-processing)
5. [Invoice Lifecycle](#5-invoice-lifecycle)
6. [Checkout & Settlement](#6-checkout--settlement)
7. [Group & Corporate Billing](#7-group--corporate-billing)
8. [Accounts Receivable (AR)](#8-accounts-receivable-ar)
9. [Adjustments, Discounts & Special Cases](#9-adjustments-discounts--special-cases)
10. [Tax Handling](#10-tax-handling)
11. [Loyalty & Redemption](#11-loyalty--redemption)
12. [Audit & Compliance](#12-audit--compliance)
13. [Edge Cases & High-Risk Scenarios](#13-edge-cases--high-risk-scenarios)
14. [Integration Touchpoints](#14-integration-touchpoints)
15. [State Machine Reference](#15-state-machine-reference)
16. [Risk & Priority Matrix](#16-risk--priority-matrix)

---

# 📌 1. Reservation & Pre-Arrival Financials

## 1.1 Advance Deposit Collection
**Actors:** Guest, Front Desk Agent, System  
**Risk:** 🟡

**Business Context:**  
Guests pay partially or fully before arrival as a guarantee. This amount is a liability — not revenue — until the stay is consumed.

**Business Rules:**
- Deposit must be linked to a specific reservation ID
- Deposit amount must not exceed total reservation value
- Deposit is held in a "Deposit Liability" account, not a revenue account
- Partial deposits are allowed up to the configured deposit policy percentage

**System Behavior:**
1. Record payment as "Advance Deposit" against the reservation
2. Post to Deposit Liability GL account
3. Generate deposit receipt to guest
4. Flag reservation as "Deposit Received"

**Acceptance Criteria:**
- [ ] Deposit does not appear as room revenue until check-in/stay
- [ ] Deposit receipt is generated with transaction reference
- [ ] Reservation status updates to reflect deposit state
- [ ] Deposit is visible on the folio at check-in

**Expected Outcome:** Deposit held as liability; auto-applied to folio at check-in or refunded per policy.

---

## 1.2 Cancellation with Refund
**Actors:** Guest, Front Desk Agent, Finance Manager  
**Risk:** 🟡

**Business Context:**  
Guest cancels within or outside the free cancellation window. System must enforce the active cancellation policy.

**Business Rules:**
- Cancellation policy is determined at booking time and locked
- Penalty = fixed fee OR percentage of total OR first-night charge (policy-driven)
- Refund amount = Deposit paid – Cancellation penalty
- If penalty > deposit, no refund; balance may be charged if card on file exists
- Free cancellation window must be checked in UTC, not local hotel time

**System Behavior:**
1. Determine applicable cancellation policy
2. Calculate penalty
3. Initiate refund for eligible amount
4. Post penalty charge to reservation folio
5. Update reservation status to "Cancelled"
6. Generate cancellation confirmation with refund breakdown

**Acceptance Criteria:**
- [ ] Penalty is computed from policy active at time of booking
- [ ] Refund is traceable to the original payment method
- [ ] Net financial position is zero (deposit - refund - penalty = 0)
- [ ] System prevents double refund on same cancellation

**Expected Outcome:** Financial records reflect exact policy enforcement with full audit trail.

---

## 1.3 No-Show Handling
**Actors:** Night Auditor, System  
**Risk:** 🟡

**Business Context:**  
Guest does not arrive by end of day without cancellation. Property must capture the financial penalty.

**Business Rules:**
- No-show must be declared after night audit if reservation is still unconfirmed
- No-show policy is enforced (typically first night or full stay)
- If deposit on file covers penalty: auto-settle; else charge card on file
- No-show reservation must remain in system for reporting; not deleted

**System Behavior:**
1. Night audit flags reservations with no check-in and no cancellation
2. Apply no-show penalty charge to folio
3. Attempt charge against stored payment method
4. Mark reservation as "No-Show"
5. Generate no-show report

**Acceptance Criteria:**
- [ ] No-show is not processed before designated no-show time
- [ ] Penalty is posted to correct GL account
- [ ] Failed charge attempt is flagged for manual follow-up
- [ ] Revenue is recognized upon successful penalty collection

**Expected Outcome:** Loss mitigation with traceable financial records.

---

## 1.4 Reservation Amendment — Rate Change
**Actors:** Guest, Front Desk Agent  
**Risk:** 🟢

**Business Context:**  
Guest modifies dates or room type. Rate may change.

**Business Rules:**
- Rate change must be tied to active rate plan at time of amendment
- If amendment reduces total value, excess deposit becomes credit or is refunded
- If amendment increases total value, additional deposit may be required per policy
- Rate lock applies only if the rate plan specifies it

**Acceptance Criteria:**
- [ ] Amended folio reflects new rate from the effective date only
- [ ] Prior charges already posted are not retroactively modified
- [ ] Credit or additional charge delta is communicated to guest

---

# 📌 2. In-Stay Charge Management

## 2.1 Daily Room Charge Posting
**Actors:** System (Night Audit)  
**Risk:** 🔴 ⚡

**Business Context:**  
Room revenue is recognized per night. This is the most critical automated financial function.

**Business Rules:**
- Room charge = Nightly rate + applicable taxes
- Rate is locked per reservation at check-in; mid-stay rate changes require manager override 🔒
- Charges are posted in the hotel's business date, not system clock time
- If night audit fails, no charges are posted; manual rerun must be triggered
- Taxes are computed dynamically at time of posting, not at booking

**System Behavior:**
1. Night audit initiates room charge posting for all checked-in reservations
2. Retrieve current nightly rate per reservation
3. Apply tax rules based on room type, guest type, and jurisdiction
4. Post charge to primary folio
5. Roll business date forward
6. Generate night audit report

**Acceptance Criteria:**
- [ ] Every checked-in reservation has exactly one room charge per night
- [ ] Re-running night audit does not create duplicate charges (idempotent)
- [ ] Business date in all transactions matches the audit date
- [ ] Night audit report balances to zero (debits = credits)

**Expected Outcome:** Accurate, automated accumulation of stay revenue with no gaps or duplicates.

---

## 2.2 Ancillary Charges (POS Integration)
**Actors:** Guest, POS System, System  
**Risk:** 🟡 🔁

**Business Context:**  
Guest consumes F&B, spa, laundry, or minibar. Charges must flow from the outlet to the guest folio without manual intervention.

**Business Rules:**
- Charge routing from POS to PMS must use the room number + reservation ID as composite key
- Charges must post within a configurable tolerance window (e.g., ≤5 min)
- If room number is incorrect, charge must be held in a suspense account — not dropped
- POS transaction ID must be stored on the folio line for cross-system reconciliation
- Minibar charges may be auto-posted or require housekeeping confirmation (property-level config)

**Acceptance Criteria:**
- [ ] POS charge appears on folio within the tolerance window
- [ ] Failed routing is captured in suspense with alert to front desk
- [ ] POS transaction ID is searchable from the folio
- [ ] Double-posting from POS retry is blocked via idempotency key

**Expected Outcome:** Centralized guest billing across all hotel revenue centers.

---

## 2.3 Charge Adjustment / Correction
**Actors:** Front Desk Agent 🔒, Finance Manager 🔒  
**Risk:** 🔴

**Business Context:**  
Incorrect charge is identified and must be corrected post-posting.

**Business Rules:**
- Charges cannot be deleted from the ledger
- Correction = void (for same-day) OR adjustment posting (for prior-day)
- Void is only permitted on the current business date
- Prior-date adjustment requires Finance Manager approval 🔒
- Adjustment must state reason code; free-text alone is insufficient
- Tax adjustments must follow the original tax logic (not overridden manually)

**System Behavior:**
1. Agent selects charge and initiates correction
2. System checks business date; offers void or adjustment accordingly
3. Adjustment posts as a negative charge with linked original transaction ID
4. Reason code is captured
5. Audit log records actor, timestamp, reason, and delta

**Acceptance Criteria:**
- [ ] Original charge remains visible on folio (struck through or flagged)
- [ ] Net folio balance reflects the corrected amount
- [ ] Adjustment is visible in audit trail with full lineage
- [ ] Tax is reversed correctly in adjustment

**Expected Outcome:** Transparent correction without data loss or untracked manipulation.

---

## 2.4 Early Departure
**Actors:** Guest, Front Desk Agent  
**Risk:** 🟡

**Business Context:**  
Guest checks out before reserved departure date. Property may enforce an early departure fee.

**Business Rules:**
- Early departure policy must be communicated and acknowledged at check-in
- Fee applies if guest departs before minimum stay requirement
- If the room is resold on the vacated night(s), some properties waive the fee (property-level config)
- No future room charges should post after actual checkout date

**Acceptance Criteria:**
- [ ] Room charges cease from the night after early departure
- [ ] Early departure fee is posted before checkout is finalized
- [ ] Folio reflects actual vs reserved departure dates

---

# 📌 3. Folio & Billing Structure

## 3.1 Multiple Folios per Reservation
**Actors:** Front Desk Agent, Finance Manager  
**Risk:** 🟢

**Business Context:**  
Corporate guests may need separate billing: company pays room, guest pays personal charges.

**Business Rules:**
- Minimum one folio (primary) per reservation; additional folios are optional
- Each folio has its own payment method and settlement status
- Folio type codes must exist (e.g., Room, Incidentals, Corporate, Package)
- A folio cannot be closed with an outstanding balance unless explicitly written off

**Acceptance Criteria:**
- [ ] Creating multiple folios does not affect room charge routing (defaults to primary)
- [ ] Each folio can be settled independently
- [ ] Invoice generation is per folio, not per reservation (configurable)

---

## 3.2 Charge Routing Rules
**Actors:** System, Front Desk Agent  
**Risk:** 🟡 🔁

**Business Context:**  
Automated rules determine which folio or payer receives which charge type.

**Business Rules:**
- Routing rules are defined at: reservation level > room type level > property level (precedence order)
- Routing cannot be overridden without manager authorization 🔒
- Changes to routing rules mid-stay apply only to future charges, not retroactively
- Routing failure must post to a suspense account — never silently drop

**Acceptance Criteria:**
- [ ] All charge types have an explicit routing destination
- [ ] Unroutable charges appear in suspense queue with alert
- [ ] Routing rule changes are logged with effective timestamp

---

## 3.3 Charge Split
**Actors:** Front Desk Agent  
**Risk:** 🟡

**Business Context:**  
Multiple guests share a charge (e.g., shared room, shared dining).

**Business Rules:**
- Split can be by fixed amount OR percentage; both must sum to 100% / original amount
- Split creates new line items; original is marked as split-parent
- Partial split is allowed (e.g., one guest pays 60%, remainder stays on original folio)
- A split charge cannot be split again (one level only)

**Acceptance Criteria:**
- [ ] Sum of split lines = original charge amount (no rounding loss)
- [ ] Split preserves original transaction date and charge type
- [ ] Audit trail shows split lineage

---

## 3.4 Charge Transfer
**Actors:** Front Desk Agent  
**Risk:** 🟡

**Business Context:**  
Charge posted to wrong guest or folio.

**Business Rules:**
- Transfer moves charge from source folio to target folio
- Source folio must record a corresponding credit; target records a debit
- Transfer within same reservation = no approval required
- Transfer to a different reservation = manager approval required 🔒
- Transfer does not change the original posting date

**Acceptance Criteria:**
- [ ] Net hotel ledger position is unchanged after transfer
- [ ] Both source and target folios reflect the transfer with linked reference ID
- [ ] Transfer is reversible if error detected within same business day

---

## 3.5 Folio Merge
**Actors:** Finance Manager 🔒  
**Risk:** 🔴

**Business Context:**  
Two folios (same or different reservations) are consolidated post-stay for billing.

**Business Rules:**
- Merge requires Finance Manager authorization 🔒
- Merge is irreversible — charges move to target folio permanently
- Both folios must be in "Open" state to merge
- Tax totals must be recalculated post-merge

**Acceptance Criteria:**
- [ ] All charges from source appear in target with original transaction dates
- [ ] Source folio is marked "Merged" and locked (not deleted)
- [ ] Post-merge tax total is accurate

---

# 📌 4. Payment Processing

## 4.1 Multi-Mode Payment
**Actors:** Guest, Front Desk Agent  
**Risk:** 🟡

**Business Context:**  
Guest settles using a combination of cash, card, and voucher.

**Business Rules:**
- Each payment must be recorded as a separate transaction with its own payment method code
- Total payments must not exceed outstanding folio balance (prevents overpayment by default; configurable)
- Voucher payments must validate against voucher ID before posting
- Foreign currency cash payments must apply the exchange rate active at time of payment

**Acceptance Criteria:**
- [ ] Each payment line shows method, amount, currency, and authorization reference
- [ ] Folio balance updates after each payment in real time
- [ ] No payment is applied without a valid authorization or confirmation code

---

## 4.2 Overpayment Handling
**Actors:** Guest, Front Desk Agent  
**Risk:** 🟡

**Business Context:**  
Guest pays more than outstanding balance.

**Business Rules:**
- Overpayment is stored as a credit balance on the folio
- Credit can be: refunded immediately, applied to future charges, or transferred to another folio
- Overpayment credit cannot be converted to a voucher automatically without Finance Manager approval 🔒

**Acceptance Criteria:**
- [ ] Folio clearly shows negative balance (credit) state
- [ ] Refund of credit is traceable to original payment method
- [ ] Overpayment does not auto-close the folio

---

## 4.3 Refund Processing
**Actors:** Finance Manager 🔒, System  
**Risk:** 🔴

**Business Context:**  
Guest is eligible for a refund after payment has been processed.

**Business Rules:**
- Refund must be linked to the original payment transaction
- Refund amount cannot exceed original payment amount on that transaction
- Cash refunds above a configurable threshold require Finance Manager authorization 🔒
- Refund to original card only; refund to a different card requires documented exception
- Refund must be processed within PCI-compliant tokenized flow

**Acceptance Criteria:**
- [ ] Refund creates a new transaction record linked to the original payment ID
- [ ] Original payment record is not modified
- [ ] Folio balance reflects refund correctly
- [ ] Notification is sent to guest upon refund initiation

---

## 4.4 Chargeback Handling
**Actors:** Finance Manager 🔒, System  
**Risk:** 🔴

**Business Context:**  
Guest's bank disputes a charge. Property receives a chargeback notification.

**Business Rules:**
- Chargeback receipt triggers an automatic payment reversal on the folio
- Folio is reopened automatically 🔒 and flagged as "Disputed"
- Evidence package (authorization records, signed registration card, POS receipts) must be compilable from the PMS
- Chargeback status must be tracked through: Received → Evidence Submitted → Won / Lost
- If chargeback is lost, amount is written off with Finance Manager approval 🔒

**Acceptance Criteria:**
- [ ] Chargeback creates a traceable reversal against the original payment
- [ ] Folio balance is updated to reflect disputed amount as outstanding
- [ ] Chargeback log is exportable for bank dispute resolution
- [ ] Guest account is flagged for future risk assessment

---

## 4.5 Split Payment Reversal
**Actors:** Finance Manager 🔒  
**Risk:** 🔴

**Business Context:**  
A payment settled across multiple methods must be partially or fully reversed (e.g., partial card chargeback after multi-mode payment).

**Business Rules:**
- Reversal applies to the specific payment leg, not the entire multi-mode total
- Remaining payment legs are unaffected
- Reversal creates an outstanding balance that must be re-settled

**Acceptance Criteria:**
- [ ] Reversal is linked to its specific payment transaction only
- [ ] Net folio balance accurately reflects the outstanding amount post-reversal
- [ ] Audit trail shows which payment leg was reversed and why

---

# 📌 5. Invoice Lifecycle

## 5.1 Invoice Draft & Finalization
**Actors:** System, Front Desk Agent  
**Risk:** 🟡

**Business Context:**  
Invoice is prepared at checkout and locked once finalized.

**Business Rules:**
- Draft invoice is a preview only — no tax authority submission at this stage
- Finalization locks the invoice; no charge or payment modifications allowed post-finalization
- Invoice number is assigned only upon finalization (sequential, no gaps)
- Finalized invoice triggers revenue recognition in GL

**Acceptance Criteria:**
- [ ] Draft can be previewed without committing the invoice number
- [ ] Finalization is irreversible without Finance Manager authorization 🔒
- [ ] Invoice number sequence has no duplicates or gaps
- [ ] Tax line items are explicitly broken out per jurisdiction

---

## 5.2 Invoice Reopen
**Actors:** Finance Manager 🔒  
**Risk:** 🔴

**Business Context:**  
Post-checkout correction is required on a finalized invoice.

**Business Rules:**
- Reopen requires Finance Manager authorization 🔒
- All edits made during reopen state are logged with full audit trail
- Invoice must be re-finalized after correction; new version increments revision number
- Original version is preserved as "Superseded" — not deleted
- Tax implications of edits must be recomputed

**Acceptance Criteria:**
- [ ] Original finalized invoice is archived and accessible
- [ ] Revised invoice has incremented version number and references original
- [ ] Net financial impact of reopen is traceable

---

## 5.3 Credit Note Issuance
**Actors:** Finance Manager 🔒, System  
**Risk:** 🟡

**Business Context:**  
Post-checkout financial correction when a new charge can't be applied (invoice already finalized).

**Business Rules:**
- Credit note must reference the original invoice number
- Credit note cannot exceed the value of the original invoice
- Credit note triggers a corresponding reduction in AR (if direct billing) or refund (if guest payment)
- Credit note is issued as a separate document, not a modification of the original invoice

**Acceptance Criteria:**
- [ ] Credit note has its own sequential document number
- [ ] Credit note is linked to original invoice in the system
- [ ] AR or refund is automatically adjusted upon credit note issuance
- [ ] Tax reversal in credit note matches original tax computation

---

## 5.4 Invoice Void
**Actors:** Finance Manager 🔒  
**Risk:** 🔴

**Business Context:**  
Invoice was issued in error and must be nullified.

**Business Rules:**
- Void is only permitted if the invoice has not been paid or submitted to tax authorities
- Void marks invoice as "Void" — no deletion from system
- Void reverses all GL entries associated with the invoice
- A new invoice must be re-issued if the stay charges are still valid

**Acceptance Criteria:**
- [ ] Void invoice is retained in system with "Void" status
- [ ] GL reversal entries are auto-generated upon void
- [ ] Void reason is mandatory and stored
- [ ] Void is not possible if payment has been applied to the invoice

---

# 📌 6. Checkout & Settlement

## 6.1 Folio Settlement
**Actors:** Guest, Front Desk Agent  
**Risk:** 🔴 ⚡

**Business Context:**  
All outstanding charges on all folios must be cleared before checkout is finalized.

**Business Rules:**
- Checkout cannot complete with any folio in outstanding balance (unless routed to direct billing)
- Settlement must match payment to charges in FIFO order (unless override by agent 🔒)
- Partial settlement is only allowed if remainder is transferred to AR/City Ledger
- Express checkout (payment card on file) must run authorization before settlement

**Acceptance Criteria:**
- [ ] System prevents checkout if any folio balance > 0 and no routing rule covers remainder
- [ ] Settlement receipt is generated automatically at checkout
- [ ] All folio states transition to "Settled" or "Transferred to AR"

---

## 6.2 Late Checkout Charges
**Actors:** Guest, Front Desk Agent, System  
**Risk:** 🟢

**Business Context:**  
Guest remains past standard checkout time.

**Business Rules:**
- Late checkout grace period is configurable (e.g., 30 minutes)
- Charge tiers apply based on duration past grace period (e.g., hourly rate, half-day, full day)
- Late checkout charges are waived automatically for loyalty tier guests (configurable)
- System clock must use hotel local time for calculation

**Acceptance Criteria:**
- [ ] Charge is auto-applied once threshold is exceeded
- [ ] Tier calculation is transparent on the folio
- [ ] Waiver for loyalty tier is logged as a comp with reason

---

## 6.3 Express / Self-Checkout
**Actors:** Guest (via kiosk or app), System  
**Risk:** 🟡 ⚡

**Business Context:**  
Guest checks out without front desk interaction.

**Business Rules:**
- Express checkout is only available if: all charges are routable, card on file is valid, and no disputes exist on folio
- Authorization check on card on file must succeed before checkout completes
- Failed authorization must route to front desk queue immediately

**Acceptance Criteria:**
- [ ] Card authorization happens in real time before checkout confirmation
- [ ] Guest receives invoice digitally within configurable SLA (e.g., 2 minutes)
- [ ] Checkout failure creates a front desk alert, not a silent error

---

# 📌 7. Group & Corporate Billing

## 7.1 Group Master Billing
**Actors:** Group Coordinator, Finance Manager  
**Risk:** 🟡

**Business Context:**  
Event or tour groups book multiple rooms under one master folio.

**Business Rules:**
- Master folio holds charges designated as group-level (e.g., meeting room, group F&B)
- Individual folios hold personal charges (minibar, personal calls)
- Group billing instructions must be locked 48 hours before group arrival
- Individual checkout does not trigger group master settlement
- Group master is settled by the group coordinator or event planner, not individual guests

**Acceptance Criteria:**
- [ ] Room charges route to master or individual folio per billing instructions
- [ ] Master folio shows consolidated charges across all rooms
- [ ] Individual checkout is possible without settling master folio
- [ ] Master folio settlement generates one consolidated invoice

---

## 7.2 Group Block Pickup & Release
**Actors:** Revenue Manager, System  
**Risk:** 🟡

**Business Context:**  
Rooms are blocked for a group. Unconfirmed rooms must be released back to inventory by a deadline.

**Business Rules:**
- Block pickup deadline is a hard cutoff; unconfirmed rooms auto-release at end of day
- Released rooms return to available inventory immediately
- No financial transaction for unreleased blocks; penalty only if contracted
- Pickup status must be reportable at room-type level

**Acceptance Criteria:**
- [ ] Auto-release triggers at the configured cutoff time
- [ ] Released rooms appear in real-time availability
- [ ] Pickup report shows confirmed vs blocked vs released count

---

## 7.3 Direct Billing / City Ledger
**Actors:** Finance Manager, Corporate Account Manager  
**Risk:** 🟡 🔁

**Business Context:**  
Corporate client is invoiced post-stay instead of settling at checkout.

**Business Rules:**
- Direct billing must be pre-approved and linked to a corporate account
- Only charges covered by the direct billing agreement route to city ledger
- City ledger invoice is separate from the guest folio invoice
- Payment terms (net 30, net 60) are defined per corporate account

**Acceptance Criteria:**
- [ ] Charges not covered by agreement are flagged for guest payment at checkout
- [ ] City ledger invoice is generated with correct corporate billing address
- [ ] Outstanding city ledger balance feeds into AR aging automatically

---

# 📌 8. Accounts Receivable (AR)

## 8.1 AR Invoice Tracking
**Actors:** Finance Manager, Accounts Receivable Team  
**Risk:** 🟡

**Business Context:**  
Pending payments from corporate or group clients.

**Business Rules:**
- Every city ledger invoice must have a due date based on payment terms
- AR balance must reconcile to the sum of all open invoices
- Partial payments against an AR invoice must be applied and tracked
- AR invoices must support multiple contacts per corporate account

**Acceptance Criteria:**
- [ ] AR dashboard shows total outstanding, by account, and by due date
- [ ] Partial payment reduces invoice balance without closing it
- [ ] AR total reconciles to GL at end of business day

---

## 8.2 Aging & Collections
**Actors:** Finance Manager  
**Risk:** 🟡

**Business Context:**  
Overdue invoices require escalation.

**Business Rules:**
- Aging buckets: Current, 1–30 days, 31–60 days, 61–90 days, 90+ days
- Collection escalation is triggered automatically at configurable thresholds
- Communication log must be maintained per account
- Interest/penalty charges may apply per contract (property-level config)

**Acceptance Criteria:**
- [ ] Aging report is accurate as of end of business date
- [ ] Escalation trigger creates a task/alert in the system
- [ ] Interest charges, if applicable, are posted as separate line items with clear labeling

---

## 8.3 Bad Debt Write-Off
**Actors:** Finance Manager 🔒, CFO (for threshold above X)  
**Risk:** 🔴

**Business Context:**  
Payment is unrecoverable after collection efforts.

**Business Rules:**
- Write-off requires dual approval above a configurable amount threshold
- Write-off must have documented collection attempt history
- Write-off posts to Bad Debt Expense GL account
- Written-off AR is moved to a "Written Off" status — not deleted
- Guest/company account is flagged; future direct billing requires override 🔒

**Acceptance Criteria:**
- [ ] Write-off workflow enforces approval chain per threshold
- [ ] Original invoices remain accessible in "Written Off" state
- [ ] Bad debt balance is reportable separately from active AR

---

# 📌 9. Adjustments, Discounts & Special Cases

## 9.1 Complimentary Charges (Comps)
**Actors:** Revenue Manager 🔒, Front Desk Agent  
**Risk:** 🟡

**Business Context:**  
Services provided at no cost as goodwill or loyalty gesture.

**Business Rules:**
- Comp must be approved per configurable comp policy (amount / type limits by role)
- Comp posts at full value as revenue, then offset by a "Comp Allowance" expense line
- Reason code is mandatory for every comp
- Comps are tracked against a comp budget by department

**Acceptance Criteria:**
- [ ] Comp appears on folio with original charge value and offset
- [ ] Revenue reports include comps for accurate gross revenue view
- [ ] Comp limit enforcement is role-based and non-bypassable

---

## 9.2 Discounts & Packages
**Actors:** Revenue Manager, System  
**Risk:** 🟡

**Business Context:**  
Bundled pricing or promotional rates applied at booking or during stay.

**Business Rules:**
- Package rates are broken out into components for revenue reporting (room, F&B, spa portions)
- Discount is applied at line-item level, not as a folio-level deduction
- Package inclusions must post as charges + offsets (same as comps) for revenue integrity
- Discount codes must be validated at time of application

**Acceptance Criteria:**
- [ ] Package breakdown is visible on the folio
- [ ] Each package component posts to the correct revenue center GL
- [ ] Expired discount codes are rejected with a clear error message

---

## 9.3 Multi-Currency Handling
**Actors:** Guest, Front Desk Agent, System  
**Risk:** 🔴

**Business Context:**  
Foreign guest pays in a currency other than property's base currency.

**Business Rules:**
- Exchange rate must be locked at time of each transaction (not at checkout)
- Exchange rate source must be configurable (central bank feed, property-defined, or daily manual)
- Folio is maintained in base currency; foreign currency is for receipt display only
- Currency conversion for refunds uses the original transaction's exchange rate, not current rate
- Foreign currency cash must be counted and receipted separately

**Acceptance Criteria:**
- [ ] Each transaction stores both base currency amount and original currency amount + rate used
- [ ] Refund in foreign currency uses the original rate to prevent gaming
- [ ] Exchange rate variance report is available for end-of-day reconciliation

---

# 📌 10. Tax Handling

## 10.1 Dynamic Tax Computation
**Actors:** System, Tax Engine  
**Risk:** 🔴

**Business Context:**  
Tax rates vary by charge type, guest type, jurisdiction, and date.

**Business Rules:**
- Tax rules are maintained in a tax matrix (charge type × guest type × jurisdiction × date range)
- Taxes are computed at time of posting, not at booking
- Multiple tax components may stack on one charge (e.g., VAT + city tax + tourism levy)
- Tax rounding rule is configurable per jurisdiction (round half-up, truncate, etc.)

**Acceptance Criteria:**
- [ ] Tax computation is deterministic — same inputs always produce same tax output
- [ ] Tax breakdown is visible per line item on folio and invoice
- [ ] Tax rate change (effective future date) does not affect prior-posted charges

---

## 10.2 Tax-Exempt Billing
**Actors:** Front Desk Agent, Finance Manager 🔒  
**Risk:** 🔴

**Business Context:**  
Diplomatic guests, government agencies, or qualifying nonprofits may be tax-exempt.

**Business Rules:**
- Tax exemption requires verified documentation (tax exemption certificate, diplomatic ID)
- Exemption is applied at reservation level; retroactive exemption requires Finance Manager override 🔒
- Exemption must specify which tax components are excluded (not blanket unless documented)
- Exemption certificate number must be stored on the reservation

**Acceptance Criteria:**
- [ ] Tax-exempt reservations show zero tax with exemption reason code
- [ ] Exemption certificate reference is printed on the invoice
- [ ] Tax exemption is reportable separately for audit purposes
- [ ] Retroactive exemption creates a correcting adjustment, not a folio edit

---

## 10.3 Tax Reporting
**Actors:** Finance Manager, System  
**Risk:** 🔴

**Business Context:**  
Property must file tax returns and provide audit-ready tax records.

**Business Rules:**
- Tax report must be reconcilable to posted transactions at line-item level
- Tax figures must not change after business date is closed
- Report must segregate tax by jurisdiction and charge type

**Acceptance Criteria:**
- [ ] Tax report ties to GL tax account balances
- [ ] Voided or adjusted transactions are reflected in tax report with correction entries

---

# 📌 11. Loyalty & Redemption

## 11.1 Loyalty Points Accrual
**Actors:** System, Guest  
**Risk:** 🟢 🔁

**Business Context:**  
Guest earns points based on eligible spend during stay.

**Business Rules:**
- Points are accrued only on eligible charge types (typically room revenue; F&B/spa configurable)
- Points are accrued at checkout, not during stay (to handle mid-stay voids)
- Comp charges do not earn points
- Points accrual is posted to the loyalty provider's system via API — PMS holds accrual request status only

**Acceptance Criteria:**
- [ ] Points are calculated post-settlement, before checkout finalization
- [ ] Failed API call to loyalty provider is queued for retry — not silently dropped
- [ ] Comp charges are excluded from points calculation

---

## 11.2 Loyalty Points Redemption
**Actors:** Guest, Front Desk Agent  
**Risk:** 🟡

**Business Context:**  
Guest uses points to offset stay charges.

**Business Rules:**
- Redemption must be validated against loyalty provider in real time before application
- Redemption amount is expressed in hotel base currency at a fixed points-to-currency ratio (configurable)
- Redemption is treated as a payment type on the folio
- If stay is cancelled, redeemed points must be re-credited to the loyalty account (provider-side)
- Partial redemption is allowed; remaining balance settled by other payment method

**Acceptance Criteria:**
- [ ] Redemption validation failure prevents posting with a clear error message
- [ ] Redemption appears as a payment line on the folio
- [ ] Cancellation triggers automatic re-credit request to loyalty provider
- [ ] Points-to-currency conversion is auditable

---

# 📌 12. Audit & Compliance

## 12.1 Audit Trail
**Actors:** System, All Actors  
**Risk:** 🔴

**Business Context:**  
Every financial event must be traceable end-to-end.

**Business Rules:**
- Every create, update, void, transfer, or approval action is logged
- Log entries are immutable — no actor can edit or delete them
- Log must capture: actor ID, timestamp (UTC), action type, before/after values, terminal/IP
- Logs are retained for a minimum of 7 years (or per local regulatory requirement)

**Acceptance Criteria:**
- [ ] Any folio state can be reconstructed from audit log alone
- [ ] Audit log is exportable in CSV and structured JSON
- [ ] Unauthorized access attempts to audit log are separately flagged

---

## 12.2 Night Audit Process
**Actors:** Night Auditor, System  
**Risk:** 🔴 ⚡

**Business Context:**  
Daily financial closure to ensure day-wise revenue accuracy.

**Business Rules:**
- Night audit must be run once per business date — no skipping
- Night audit cannot run if open transactions are pending (configurable exception with override 🔒)
- Night audit generates: trial balance, room revenue report, tax summary, occupancy report
- Business date does not advance until night audit completes successfully
- Failed night audit: system rolls back all partial postings and alerts Night Auditor

**Acceptance Criteria:**
- [ ] Night audit is idempotent — re-running on same date does not duplicate postings
- [ ] Trial balance generated by night audit ties to GL
- [ ] Business date advancement is gated on successful audit completion

---

## 12.3 Role-Based Access Control (RBAC)
**Actors:** System Administrator  
**Risk:** 🔴

**Business Context:**  
Sensitive financial operations require restricted access by role.

**Business Rules:**
- All financial actions have an associated permission code
- Role assignments are managed by System Administrator only
- Elevated actions (void, write-off, reopen) require secondary approval (four-eyes principle)
- Session-level permissions must not persist across logout/login

**Acceptance Criteria:**
- [ ] Unauthorized action attempt returns clear rejection message + audit log entry
- [ ] Four-eyes approval workflow is enforced at system level, not by convention
- [ ] Role permission matrix is exportable for compliance review

---

## 12.4 Financial Period Close
**Actors:** Finance Manager 🔒  
**Risk:** 🔴

**Business Context:**  
Month-end or year-end close locks the accounting period.

**Business Rules:**
- Period close prevents any backdated postings to closed periods
- Adjustments to a closed period require a journal entry in the next open period
- Period close must be preceded by: AR reconciliation, GL reconciliation, night audit completion for all days
- Period close is irreversible without CFO authorization

**Acceptance Criteria:**
- [ ] Attempt to post to a closed period is rejected with clear error
- [ ] Reconciliation checklist must be completed before close is permitted
- [ ] Close action is logged with actor, timestamp, and period reference

---

# 📌 13. Edge Cases & High-Risk Scenarios

## 13.1 Partial Refund After Invoice Finalization
**Risk:** 🔴

**Scenario:** Guest disputes one line item after checkout. Invoice is finalized and the remaining charges are valid.

**Correct Behavior:**
- Do NOT reopen the invoice
- Issue a credit note for the disputed line item only
- Adjust AR or initiate partial refund linked to the credit note

**Risks:**
- Tax reporting inconsistency if credit note tax computation differs from original
- Double refund if credit note and chargeback both processed

**Acceptance Criteria:**
- [ ] System blocks refund if a chargeback is already open for the same transaction
- [ ] Credit note tax is computed using the original tax rate, not the current rate

---

## 13.2 Concurrent Payment & Checkout
**Risk:** 🔴 ⚡

**Scenario:** Guest pays via mobile app while front desk agent simultaneously processes checkout.

**Correct Behavior:**
- Idempotency key on payment ensures only one payment is posted
- Checkout reads folio balance after payment settlement confirmation
- Optimistic lock on folio prevents concurrent settlement conflicts

**Risks:**
- Double payment applied to folio
- Checkout completes before payment is confirmed — missed settlement

**Acceptance Criteria:**
- [ ] Payment processing is atomic — partial commit is not possible
- [ ] Folio balance check at checkout is performed after acquiring folio lock
- [ ] Duplicate payment detection is enforced via idempotency key, not just UI controls

---

## 13.3 Split + Transfer + Refund Combination
**Risk:** 🔴

**Scenario:** A charge is split between two guests. One portion is transferred to a corporate folio. The corporate folio is then partially refunded.

**Correct Behavior:**
- Each operation maintains a parent transaction reference
- Refund links back through transfer → split → original charge
- GL entries at each step are correct and sum to zero net impact if fully reversed

**Risks:**
- Broken audit lineage if any step doesn't store parent reference
- Tax reversal mismatch if each step recomputes independently

**Acceptance Criteria:**
- [ ] Full transaction lineage is traceable from refund back to original charge
- [ ] GL net impact of full reversal chain is zero

---

## 13.4 Currency Fluctuation During Stay
**Risk:** 🔴

**Scenario:** Guest checks in for 14 nights. Exchange rate changes mid-stay.

**Correct Behavior:**
- Each nightly charge locks the exchange rate at posting time
- At checkout, total in base currency is the sum of individual nightly amounts (not recalculated)
- No revaluation of prior nights is performed

**Risks:**
- Revenue mismatch if rate is applied at checkout for all nights
- Guest expectation mismatch on foreign currency total

**Acceptance Criteria:**
- [ ] Each transaction stores the exchange rate used at that moment
- [ ] Total invoice in foreign currency = sum of individual nightly foreign amounts
- [ ] Rate variance report shows day-over-day rate differences for audit

---

## 13.5 Reopening a Settled Folio with Multi-Mode Payments
**Risk:** 🔴

**Scenario:** Folio settled with cash + card must be reopened post-checkout for a correction.

**Correct Behavior:**
- Reopening suspends the settled status but does not automatically reverse payments
- Correction is made; folio re-finalized
- If correction reduces balance below total payments, partial refund is initiated
- Each payment leg is independently traceable to the refund

**Risks:**
- Ledger inconsistency if settlement reversal is partial
- Double refund if multiple agents process correction simultaneously

**Acceptance Criteria:**
- [ ] Folio reopen does not automatically reverse any payment
- [ ] Reopen acquires an exclusive lock — only one agent can operate on the folio at a time
- [ ] Any resulting refund is explicitly initiated by Finance Manager 🔒

---

## 13.6 System Failure During Night Audit
**Risk:** 🔴 ⚡

**Scenario:** Night audit fails midway through charge posting.

**Correct Behavior:**
- System detects partial completion and rolls back all postings for that night
- Business date does not advance
- Alert is sent to Night Auditor with failure details
- Manual rerun from a clean state is required

**Acceptance Criteria:**
- [ ] Partial night audit state is fully rollback-safe
- [ ] No reservation has a partial set of charges from the failed run
- [ ] Rerun produces identical results to a clean run (idempotent)

---

## 13.7 Loyalty Redemption + Chargeback
**Risk:** 🔴

**Scenario:** Guest redeems loyalty points to partially pay for stay, then initiates a chargeback on the card portion.

**Correct Behavior:**
- Chargeback reverses only the card payment leg
- Loyalty redemption is not reversed automatically — requires manual review
- System flags the case for Finance Manager + Loyalty team review

**Acceptance Criteria:**
- [ ] Chargeback is scoped to card payment only — does not touch points redemption line
- [ ] Case is flagged automatically for cross-team review
- [ ] Points re-credit to loyalty account requires explicit approval

---

# 📌 14. Integration Touchpoints

| System | Integration Type | Data Direction | Failure Behavior |
|--------|----------------|----------------|-----------------|
| POS (Restaurant/Spa/Minibar) | Real-time API | POS → PMS | Suspense account; front desk alert |
| Payment Gateway | Real-time API | Bidirectional | Timeout = retry with idempotency key |
| Loyalty Provider | Real-time API | Bidirectional | Queue for retry; no silent drop |
| Tax Engine | Internal / External | PMS → Tax Engine | Block transaction if tax compute fails |
| GL / ERP | Batch (EOD) | PMS → GL | Reconciliation mismatch report |
| AR / City Ledger | Near real-time | PMS → AR | Alert on routing failure |
| Channel Manager / OTA | Event-driven | Bidirectional | Reservation sync failure alert |
| Kiosk / Mobile Check-in | Real-time API | Bidirectional | Fallback to front desk queue |

---

# 📌 15. State Machine Reference

## Folio States
```
OPEN → SETTLED → CLOSED
OPEN → TRANSFERRED_TO_AR
OPEN ← REOPENED (from CLOSED, 🔒 required)
CLOSED → VOIDED (🔒 required, if no payment applied)
ANY → MERGED (into target folio, 🔒 required, irreversible)
```

## Invoice States
```
DRAFT → FINALIZED → CLOSED
FINALIZED ← REOPENED (🔒 required; creates new revision)
FINALIZED → VOIDED (🔒 required; if no payment applied)
CLOSED → CREDIT_NOTE_ISSUED (linked, does not reopen invoice)
```

## Payment States
```
PENDING → AUTHORIZED → CAPTURED → SETTLED
SETTLED → REFUNDED (partial or full)
SETTLED → CHARGEBACK_RECEIVED → EVIDENCE_SUBMITTED → WON / LOST
```

## Reservation States (Financial Perspective)
```
TENTATIVE → CONFIRMED (deposit received)
CONFIRMED → CHECKED_IN
CHECKED_IN → CHECKED_OUT
CONFIRMED → CANCELLED (refund / penalty applied)
CONFIRMED → NO_SHOW (penalty applied)
```

---

# 📌 16. Risk & Priority Matrix

| # | Scenario | Risk Level | Complexity | Priority |
|---|----------|-----------|------------|---------|
| 2.1 | Daily Room Charge Posting | 🔴 High | High | P0 |
| 12.2 | Night Audit | 🔴 High | High | P0 |
| 4.3 | Refund Processing | 🔴 High | Medium | P0 |
| 4.4 | Chargeback Handling | 🔴 High | High | P0 |
| 13.2 | Concurrent Payment & Checkout | 🔴 High | High | P0 |
| 13.6 | System Failure During Night Audit | 🔴 High | High | P0 |
| 5.1 | Invoice Finalization | 🔴 High | Medium | P1 |
| 5.2 | Invoice Reopen | 🔴 High | Medium | P1 |
| 10.1 | Dynamic Tax Computation | 🔴 High | High | P1 |
| 10.2 | Tax-Exempt Billing | 🔴 High | Medium | P1 |
| 8.3 | Bad Debt Write-Off | 🔴 High | Low | P1 |
| 9.3 | Multi-Currency Handling | 🔴 High | High | P1 |
| 12.4 | Financial Period Close | 🔴 High | Medium | P1 |
| 1.1 | Advance Deposit Collection | 🟡 Medium | Low | P2 |
| 1.2 | Cancellation with Refund | 🟡 Medium | Medium | P2 |
| 3.2 | Charge Routing Rules | 🟡 Medium | Medium | P2 |
| 7.3 | Direct Billing / City Ledger | 🟡 Medium | Medium | P2 |
| 11.2 | Loyalty Redemption | 🟡 Medium | High | P2 |
| 13.3 | Split + Transfer + Refund | 🔴 High | High | P2 |
| 6.2 | Late Checkout Charges | 🟢 Low | Low | P3 |
| 9.1 | Complimentary Charges | 🟡 Medium | Low | P3 |

---

## 🧠 Business Analyst Summary

A production-grade PMS accounting system must guarantee:

| Principle | Requirement |
|-----------|------------|
| **Accuracy** | Every transaction is correct, every balance reconciles |
| **Immutability** | Nothing is deleted — only reversed, voided, or superseded |
| **Traceability** | Full lineage from any transaction back to its origin |
| **Idempotency** | Retries and concurrent requests produce no duplicates |
| **Flexibility** | Supports all real-world billing structures and edge cases |
| **Compliance** | Tax, audit, and access control meet regulatory requirements |
| **Resilience** | System failure at any point leaves data in a consistent state |
| **Integration** | All external system failures degrade gracefully — no silent drops |

> A PMS that works only under ideal conditions will fail in production hotel operations. The most important scenarios to get right are the ones that happen at 2am during night audit with three concurrent checkouts and a chargeback in the queue.

---

*Document Version: 2.0 | Audience: Product Managers, Business Analysts, Engineering Leads, QA*  
*Review Cycle: Quarterly or upon major scope change*
