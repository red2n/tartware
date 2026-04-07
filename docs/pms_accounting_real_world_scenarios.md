# 🏨 Property Management System (PMS) – Business Analysis: Real-World Accounting Scenarios

This document presents real-world accounting scenarios in a Property Management System (PMS) from a **Business Analyst perspective**. It focuses on business intent, system behavior, and expected outcomes.

---

# 📌 1. Reservation & Pre-Arrival Financials

## 1.1 Advance Deposit Collection
**Business Context:**
Guests often pay partially or fully before arrival.

**System Behavior:**
- Record payment as "Advance Deposit"
- Link deposit to reservation
- Do not recognize as revenue yet

**Expected Outcome:**
- Deposit is consumed during stay or refunded

---

## 1.2 Cancellation with Refund
**Business Context:**
Guest cancels booking based on policy.

**System Behavior:**
- Apply cancellation rules
- Refund full/partial deposit
- Retain penalty if applicable

**Expected Outcome:**
- Financial records reflect policy enforcement

---

# 📌 2. In-Stay Charge Management

## 2.1 Daily Room Charge Posting
**Business Context:**
Room charges are applied per night.

**System Behavior:**
- Auto-post charges during night audit
- Apply taxes dynamically

**Expected Outcome:**
- Accurate accumulation of stay charges

---

## 2.2 Ancillary Charges (POS Integration)
**Business Context:**
Guest uses restaurant, spa, minibar.

**System Behavior:**
- Charges posted from POS systems
- Linked to guest folio

**Expected Outcome:**
- Centralized billing across services

---

## 2.3 Charge Adjustment / Correction
**Business Context:**
Incorrect charge applied.

**System Behavior:**
- Modify or void charge
- Maintain audit trail

**Expected Outcome:**
- Transparency without data loss

---

# 📌 3. Folio & Billing Structure

## 3.1 Multiple Folios per Reservation
**Business Context:**
Separate billing for room, company, extras.

**System Behavior:**
- Create multiple folios
- Assign charges accordingly

**Expected Outcome:**
- Flexible billing structure

---

## 3.2 Charge Routing Rules
**Business Context:**
Company pays room, guest pays incidentals.

**System Behavior:**
- Auto-transfer charges based on rules

**Expected Outcome:**
- Reduced manual intervention

---

## 3.3 Charge Split
**Business Context:**
Multiple guests share cost.

**System Behavior:**
- Split by amount/percentage

**Expected Outcome:**
- Fair distribution of charges

---

## 3.4 Charge Transfer
**Business Context:**
Charge assigned to wrong guest.

**System Behavior:**
- Transfer between folios

**Expected Outcome:**
- Accurate billing without deletion

---

# 📌 4. Payment Processing

## 4.1 Multi-Mode Payment
**Business Context:**
Guest pays using multiple methods.

**System Behavior:**
- Record each payment separately

**Expected Outcome:**
- Accurate reconciliation

---

## 4.2 Overpayment Handling
**Business Context:**
Guest pays excess amount.

**System Behavior:**
- Store as credit or refund

**Expected Outcome:**
- No financial discrepancy

---

## 4.3 Refund Processing
**Business Context:**
Guest eligible for refund.

**System Behavior:**
- Issue refund linked to payment

**Expected Outcome:**
- Traceable reversal of funds

---

## 4.4 Chargeback Handling
**Business Context:**
Bank disputes a transaction.

**System Behavior:**
- Reverse payment
- Flag account

**Expected Outcome:**
- Risk and fraud visibility

---

# 📌 5. Invoice Lifecycle

## 5.1 Invoice Draft & Finalization
**Business Context:**
Bill is prepared and confirmed at checkout.

**System Behavior:**
- Generate draft invoice
- Finalize and lock

**Expected Outcome:**
- Immutable financial document

---

## 5.2 Invoice Reopen
**Business Context:**
Post-checkout correction needed.

**System Behavior:**
- Allow reopen with permissions
- Log all changes

**Expected Outcome:**
- Controlled corrections

---

## 5.3 Credit Note Issuance
**Business Context:**
Refund after invoice closure.

**System Behavior:**
- Generate credit note
- Link to original invoice

**Expected Outcome:**
- Compliance with accounting standards

---

## 5.4 Invoice Void
**Business Context:**
Invoice issued incorrectly.

**System Behavior:**
- Mark invoice as void
- Preserve audit trail

**Expected Outcome:**
- No data deletion

---

# 📌 6. Checkout & Settlement

## 6.1 Folio Settlement
**Business Context:**
Guest clears all dues.

**System Behavior:**
- Match payments to charges

**Expected Outcome:**
- Zero balance folio

---

## 6.2 Late Checkout Charges
**Business Context:**
Guest overstays.

**System Behavior:**
- Add additional charges

**Expected Outcome:**
- Revenue protection

---

## 6.3 No-Show & Cancellation Charges
**Business Context:**
Guest does not arrive.

**System Behavior:**
- Apply penalty charges

**Expected Outcome:**
- Loss mitigation

---

# 📌 7. Group & Corporate Billing

## 7.1 Group Master Billing
**Business Context:**
Multiple rooms under one booking.

**System Behavior:**
- Create master folio
- Link individual folios

**Expected Outcome:**
- Consolidated billing

---

## 7.2 Direct Billing (City Ledger)
**Business Context:**
Company pays later.

**System Behavior:**
- Move invoice to AR

**Expected Outcome:**
- Deferred payment tracking

---

# 📌 8. Accounts Receivable (AR)

## 8.1 AR Invoice Tracking
**Business Context:**
Pending payments from companies.

**System Behavior:**
- Track outstanding invoices

**Expected Outcome:**
- Visibility into receivables

---

## 8.2 Aging & Collections
**Business Context:**
Invoices overdue.

**System Behavior:**
- Categorize into aging buckets

**Expected Outcome:**
- Efficient collections

---

## 8.3 Bad Debt Write-off
**Business Context:**
Unrecoverable payment.

**System Behavior:**
- Write-off with approval

**Expected Outcome:**
- Clean financial reporting

---

# 📌 9. Adjustments & Special Cases

## 9.1 Complimentary Charges
**Business Context:**
Free services offered.

**System Behavior:**
- Record as comp

**Expected Outcome:**
- Revenue analysis accuracy

---

## 9.2 Discounts & Packages
**Business Context:**
Bundled pricing or promotions.

**System Behavior:**
- Apply rules-based pricing

**Expected Outcome:**
- Consistent pricing logic

---

## 9.3 Multi-Currency Handling
**Business Context:**
Foreign payments.

**System Behavior:**
- Apply exchange rates
- Record rate at transaction time

**Expected Outcome:**
- Financial consistency

---

# 📌 10. Audit & Compliance

## 10.1 Audit Trail
**Business Context:**
Track all financial changes.

**System Behavior:**
- Log every action

**Expected Outcome:**
- Full traceability

---

## 10.2 Night Audit
**Business Context:**
Daily financial closure.

**System Behavior:**
- Post daily charges
- Generate reports

**Expected Outcome:**
- Day-wise financial accuracy

---

## 10.3 Role-Based Access Control
**Business Context:**
Restrict sensitive operations.

**System Behavior:**
- Permission-based actions

**Expected Outcome:**
- Fraud prevention

---

# 📌 11. Edge Case & High-Risk Scenarios

## 11.1 Partial Refund After Invoice Finalization
**System Behavior:**
- Issue credit note
- Adjust AR or payments

**Risk:**
- Tax and reporting inconsistency

---

## 11.2 Concurrent Payment & Checkout
**System Behavior:**
- Ensure idempotency

**Risk:**
- Double payment or missed settlement

---

## 11.3 Split + Transfer + Refund Combination
**System Behavior:**
- Maintain correct ledger mapping

**Risk:**
- Broken financial traceability

---

## 11.4 Currency Fluctuation During Stay
**System Behavior:**
- Lock rate per transaction

**Risk:**
- Revenue mismatch

---

## 11.5 Reopening Closed Folio with Payments
**System Behavior:**
- Reverse settlement
- Allow controlled edits

**Risk:**
- Ledger inconsistency

---

# 🧠 Business Analyst Summary

A PMS accounting system must ensure:

- **Accuracy** → Every transaction is correct
- **Traceability** → Nothing is deleted, only reversed
- **Flexibility** → Supports real-world scenarios
- **Compliance** → Meets tax and audit requirements
- **Resilience** → Handles concurrency and edge cases

A system that works only in ideal scenarios will fail in real hotel operations.
