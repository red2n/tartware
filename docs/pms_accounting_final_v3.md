# 🏨 Property Management System — Accounting & Billing
## Final Production Reference Document
### Version 3.0 | Industry-Standard Aligned | Developer + Business Analyst Edition

---

> **Who is this for?**
> This document is for everyone who builds, tests, reviews, or maintains the financial engine of a Property Management System. Whether you're a developer writing a posting service, a QA engineer writing test cases, a product manager defining a feature, or a BA writing requirements — this document is your single source of truth.
>
> **Standards this document aligns with:**
> - **USALI 12th Revised Edition** (effective Jan 1, 2026) — Uniform System of Accounts for the Lodging Industry
> - **HTNG / OpenTravel Alliance** — Hotel Technology Next Generation messaging specs
> - **PCI-DSS v4.0** — Payment Card Industry Data Security Standard
> - **GAAP / IFRS** — Generally Accepted Accounting Principles
> - **ASC 606** — Revenue Recognition Standard

---

## 📋 How to Read This Document

Each scenario in this document is structured as:

```
SCENARIO TITLE
├── Plain English — What's happening in the real world
├── Why it matters — Business impact if we get it wrong
├── Who's involved — Actors and systems
├── The rules — Business rules, never negotiable
├── What the system does — Step-by-step system behavior
├── GL Impact — The double-entry accounting journal entries
├── Developer Notes — Implementation gotchas, patterns, edge cases
├── Test Cases — Concrete pass/fail acceptance criteria
└── Risk — How bad is it if this breaks?
```

**Risk Levels:**

| Level | Meaning | Example |
|-------|---------|---------|
| 🔴 CRITICAL | Financial data corruption or compliance breach possible | Night audit failure |
| 🟠 HIGH | Revenue loss or guest experience failure | Wrong charge posted |
| 🟡 MEDIUM | Operational friction, fixable manually | Routing misconfiguration |
| 🟢 LOW | Minor inconvenience | Late checkout grace period |

---

## 🧩 Actor Reference

| Actor | What They Do Financially |
|-------|--------------------------|
| **Guest** | The person whose money moves through the system |
| **Front Desk Agent** | Posts charges, takes payments, initiates corrections |
| **Night Auditor** | Runs the daily financial close — the most critical automated job |
| **Finance Manager** | Approves anything that changes finalized financial records |
| **Revenue Manager** | Owns rates, packages, and comp budgets |
| **System / Automation** | Night audit engine, tax engine, routing engine, POS bridge |
| **Corporate Account** | External entity that owes the hotel money post-stay |

---

## 🏦 The Four Ledgers — Understanding the Hotel's Money Map

Before diving into scenarios, every developer must understand the four ledgers that govern all hotel accounting. Think of these as four buckets that money flows between.

```
┌─────────────────────────────────────────────────────────┐
│                    HOTEL FINANCIAL LEDGERS               │
├─────────────────┬──────────────────────────────────────-┤
│ ADVANCE DEPOSIT │ Pre-arrival money. Hotel OWES this     │
│ LEDGER          │ back to the guest. It's a LIABILITY.   │
│                 │ GL: Debit Cash / Credit Deposit Liab.  │
├─────────────────┼───────────────────────────────────────┤
│ GUEST LEDGER    │ Currently checked-in guests. Hotel     │
│                 │ is OWED this money. It's an ASSET.     │
│                 │ GL: Debit A/R Guest / Credit Revenue   │
├─────────────────┼───────────────────────────────────────┤
│ CITY LEDGER     │ Post-checkout corporate accounts.      │
│ (A/R)           │ Hotel is still OWED this. Asset.       │
│                 │ GL: Debit A/R Corporate / Credit Guest │
├─────────────────┼───────────────────────────────────────┤
│ DEPOSIT LEDGER  │ Payments applied at checkout.          │
│ (Settlement)    │ Clears both A/R and Cash accounts.     │
│                 │ GL: Debit Cash / Credit A/R Guest      │
└─────────────────┴───────────────────────────────────────┘
```

**The Golden Rule of Hotel Accounting:**
Every transaction must balance. Every debit has a corresponding credit. If the trial balance doesn't zero out after night audit, something is wrong.

---

## 📊 USALI Chart of Accounts — Reference

These are the GL account codes your system must support per USALI 12th Edition. Map every transaction to one of these.

| GL Code | Account Name | Type | Usage |
|---------|-------------|------|-------|
| 1100 | Cash and Cash Equivalents | Asset | All cash payments |
| 1200 | Accounts Receivable — Guest | Asset | In-house guest balances |
| 1210 | Accounts Receivable — City Ledger | Asset | Corporate post-stay billing |
| 1300 | Advance Deposit Liability | Liability | Pre-arrival deposits |
| 4000 | Rooms Revenue | Revenue | Nightly room charges |
| 4010 | F&B Revenue | Revenue | Restaurant/bar charges |
| 4020 | Spa Revenue | Revenue | Spa/wellness charges |
| 4030 | Miscellaneous Revenue | Revenue | Late checkout, early arrival fees |
| 4040 | Cancellation & No-Show Revenue | Revenue | Penalty charges |
| 4050 | Other Operated Departments | Revenue | Parking, laundry, etc. |
| 2100 | Tax Payable — VAT/GST | Liability | Collected tax owed to government |
| 2110 | Tax Payable — City/Tourism Tax | Liability | Local levy |
| 5000 | Comp Allowance Expense | Expense | Offset for complimentary services |
| 5100 | Bad Debt Expense | Expense | Written-off AR |
| 5200 | Loyalty Program Expense | Expense | Points accrual cost |
| 6000 | Exchange Rate Variance | Revenue/Expense | FX gain/loss |

---

# 📌 PART 1: RESERVATION & PRE-ARRIVAL FINANCIALS

---

## 1.1 Advance Deposit Collection

**Plain English:**
A guest books a room and pays upfront — partially or in full — before they even arrive. This is common for peak season bookings, high-value reservations, and non-refundable rates. The hotel now holds the guest's money, but hasn't delivered the service yet. Until the guest checks in and stays, that money is a *liability*, not revenue.

**Why it matters if we get it wrong:**
If we record this as revenue immediately, the hotel's P&L looks inflated. Auditors will flag it. Worse, if the guest cancels and gets a refund, the revenue has to be reversed — which creates a mess.

**Actors:** Guest, Payment Gateway, System

**Risk:** 🟡 MEDIUM

---

**Business Rules:**
1. Deposit must be linked to a unique `reservation_id` — orphaned deposits are not allowed
2. Deposit amount cannot exceed the total reservation value
3. Post to GL account **1300 (Advance Deposit Liability)**, never to revenue
4. Deposit is consumed at check-in by transferring from liability → revenue
5. If cancelled before check-in: refund deposit minus any penalty per the active cancellation policy
6. Partial deposits are supported; multiple deposits can exist on one reservation

---

**GL Journal Entry — Deposit Received:**
```
DR  1100  Cash / Payment Gateway Clearing    $200.00
    CR  1300  Advance Deposit Liability       $200.00

Narrative: Advance deposit received — Reservation #RES-0042, Guest: John Smith
```

**GL Journal Entry — Deposit Applied at Check-In:**
```
DR  1300  Advance Deposit Liability          $200.00
    CR  1200  Accounts Receivable — Guest    $200.00

Narrative: Deposit applied to guest folio on check-in — Reservation #RES-0042
```

---

**System Behavior (Step by Step):**
1. Payment gateway authorizes and captures the deposit amount
2. System creates a `deposit` transaction record linked to `reservation_id`
3. Post debit to GL 1100, credit to GL 1300
4. Mark reservation with `deposit_status: RECEIVED` and `deposit_amount: $200`
5. Send deposit receipt to guest (email/SMS)
6. At check-in: create a folio transfer — debit GL 1300, credit GL 1200
7. Deposit now reduces the guest's outstanding folio balance

---

**Developer Notes:**
- **Idempotency:** Payment gateway retries are common. Use a `payment_idempotency_key` tied to `reservation_id + payment_attempt_number`. Do not process the same key twice.
- **Data Model:** `deposit` table needs: `id`, `reservation_id`, `amount`, `currency`, `gl_account`, `status (HELD/APPLIED/REFUNDED)`, `gateway_reference`, `created_at`, `applied_at`
- **Currency:** Store amounts in the smallest unit (paise, cents) as integers to avoid floating-point rounding errors. Never use `FLOAT` for money.
- **Timezone:** Store all timestamps in UTC. Display in hotel local time. Business date ≠ system clock.

**Test Cases:**
- [ ] Deposit of `$200` posts to GL 1300, not GL 4000
- [ ] Second deposit request with the same idempotency key returns the existing transaction, does not double-post
- [ ] Deposit amount `> reservation_total` is rejected with HTTP 422 and error code `DEPOSIT_EXCEEDS_RESERVATION_VALUE`
- [ ] At check-in, deposit of `$200` reduces folio balance by `$200`
- [ ] Deposit receipt is generated with `transaction_reference`, `amount`, `timestamp`

---

## 1.2 Cancellation with Refund

**Plain English:**
A guest cancels their booking. Depending on how far in advance they cancel, they might get a full refund, a partial refund, or no refund at all. The system must apply the policy that was in effect at the time of booking — not whatever the current policy is today.

**Why it matters if we get it wrong:**
Applying the wrong policy exposes the hotel to guest disputes and potential legal issues. Over-refunding loses revenue. Under-refunding causes chargebacks.

**Actors:** Guest, Front Desk Agent, System

**Risk:** 🟡 MEDIUM

---

**Business Rules:**
1. Cancellation policy is **locked at booking time** — amendments to the property's policy do not apply retroactively
2. Penalty calculation hierarchy: Fixed Fee > Percentage of Total > First Night Charge (policy-defined)
3. Free cancellation window is checked in **UTC** to prevent timezone gaming
4. Refund = Deposit Paid − Cancellation Penalty
5. If penalty > deposit, the difference is either written off or charged to card-on-file (property-level config)
6. Reservation status must transition to `CANCELLED` only after financial settlement is confirmed
7. A cancellation confirmation number must be generated and communicated to the guest

---

**GL Journal Entry — Free Cancellation (full refund):**
```
DR  1300  Advance Deposit Liability          $200.00
    CR  1100  Cash / Payment Gateway         $200.00

Narrative: Full refund on cancellation — Reservation #RES-0042, within free window
```

**GL Journal Entry — Cancellation with Penalty:**
```
DR  1300  Advance Deposit Liability          $200.00
    CR  4040  Cancellation Revenue            $50.00
    CR  1100  Cash / Payment Gateway         $150.00

Narrative: Partial refund — $50 penalty retained per cancellation policy P-007
```

---

**Developer Notes:**
- **Policy Snapshot:** At booking, snapshot the full cancellation policy object and store it on the reservation. Never recalculate from the current policy at cancellation time.
- **Timezone trap:** `2024-12-31 23:30 GMT+5:30` is `2024-12-31 18:00 UTC` — still within the free window. A hotel in Mumbai calculating in local time might incorrectly apply a penalty.
- **Refund to original method only.** Refunding to a different card requires an explicit finance override with documented reason.
- **Race condition:** Prevent double-cancellation. Use a pessimistic lock on the reservation record during cancellation processing.

**Test Cases:**
- [ ] Cancellation 72h before arrival (free window = 48h) → full refund to original payment method
- [ ] Cancellation 24h before arrival (free window = 48h) → penalty applied, partial refund
- [ ] Cancellation after policy change → original policy applies, not new policy
- [ ] Cancellation attempted on already-cancelled reservation → HTTP 409 `ALREADY_CANCELLED`
- [ ] Cancellation confirmation number generated and stored on reservation

---

## 1.3 No-Show Handling

**Plain English:**
It's 6am, the guest never arrived, and they never cancelled. The room sat empty. The hotel needs to capture the penalty and protect against revenue loss.

**Why it matters if we get it wrong:**
If no-shows aren't captured, the hotel loses revenue. If they're processed too early (before the designated no-show time), the guest could legitimately still arrive.

**Actors:** Night Auditor, System

**Risk:** 🟠 HIGH

---

**Business Rules:**
1. No-show can only be declared **after** the hotel's configured no-show time (typically post-midnight, property-level)
2. No-show penalty = typically first night's room charge + tax (policy-defined)
3. Auto-charge card-on-file; if declined → flag for manual follow-up, do not drop silently
4. If deposit on file covers penalty → auto-settle from deposit; return remainder
5. Revenue is recognized in GL **only upon successful charge**, not upon no-show declaration
6. Reservation remains in system with status `NO_SHOW` — never deleted

---

**GL Journal Entry — No-Show Penalty (card charged successfully):**
```
DR  1100  Cash / Payment Gateway             $150.00
    CR  4040  Cancellation & No-Show Revenue $136.36
    CR  2100  Tax Payable                     $13.64

Narrative: No-show penalty collected — Reservation #RES-0099, Rate $136.36 + 10% tax
```

**Developer Notes:**
- No-show processing should run as a **background job** triggered by the night audit engine after the property's configured no-show cutoff time.
- Failed charge attempts must generate a `FOLLOW_UP_REQUIRED` task in the front office queue — not a silent failure.
- Business date for no-show charges = the date of expected arrival, not the date of processing.

**Test Cases:**
- [ ] No-show job does not run before configured cutoff time
- [ ] Penalty posts to GL 4040 (not GL 4000 Room Revenue — per USALI)
- [ ] Declined card → task created in front office queue, reservation flagged `CHARGE_FAILED`
- [ ] No-show on reservation with full deposit → deposit consumed, net zero cash movement
- [ ] No-show reservation is searchable and reportable 90 days later

---

## 1.4 Reservation Amendment — Financial Impact

**Plain English:**
Guest changes dates or room type. Maybe they're extending, shortening, or upgrading. The rate might change. We need to handle this without corrupting the existing financial record.

**Business Rules:**
1. Rate change applies from the **amendment effective date** — not retroactively
2. Charges already posted are **not modified** — only future charges change
3. If amendment reduces stay value and excess deposit exists → offer refund or credit
4. Rate lock applies only if the rate plan explicitly specifies it

**Test Cases:**
- [ ] Extending stay by 2 nights → 2 additional nightly charges at amended rate
- [ ] Shortening stay → no retroactive charge modification; early departure fee may apply
- [ ] Upgrade mid-stay → new rate applied from next business date only

---

# 📌 PART 2: IN-STAY CHARGE MANAGEMENT

---

## 2.1 Daily Room Charge Posting (Night Audit)

**Plain English:**
Every night, the system must charge every checked-in guest for their room. This is the single most important automated financial operation in the PMS. It runs once per business date, after midnight, and it must be **perfect** — no duplicates, no gaps, no partial runs.

**Why it matters if we get it wrong:**
A failed or duplicated night audit means either guests aren't charged (revenue loss) or charged twice (guest dispute, chargeback risk). A partial run is the worst case — some guests charged, some not, business date out of sync.

**Actors:** System (Night Audit Engine)

**Risk:** 🔴 CRITICAL

---

**Business Rules:**
1. Exactly **one room charge per checked-in reservation per business date** — no more, no less
2. Rate is **locked at check-in** — mid-stay rate changes require Finance Manager override with audit log
3. Charges use the **hotel's business date**, not the system clock. Business date is a property-level setting.
4. Taxes are computed **at time of posting** using the active tax matrix — not at booking
5. Night audit is **atomic** — it either completes fully or rolls back entirely. No partial states.
6. Night audit is **idempotent** — re-running on the same business date produces no new charges
7. Business date does not advance until night audit completes successfully

---

**GL Journal Entry — Nightly Room Charge:**
```
DR  1200  Accounts Receivable — Guest        $200.00
    CR  4000  Rooms Revenue                  $181.82
    CR  2100  Tax Payable — GST               $18.18

Narrative: Room charge — Room 301, 2024-12-31, Rate Plan: BAR, Reservation #RES-0042
```

---

**System Behavior (Step by Step):**
1. Night audit job is triggered (manually by Night Auditor or scheduled)
2. System acquires an exclusive **night audit lock** — prevents concurrent audit runs
3. System queries all reservations with `status = CHECKED_IN` for the current business date
4. For each reservation:
   a. Retrieve nightly rate (locked at check-in)
   b. Compute applicable taxes via tax engine
   c. Create a `charge` record with `type=ROOM`, `business_date`, `idempotency_key=reservation_id+business_date`
   d. Post GL entries: DR 1200 / CR 4000 / CR 2100
5. Generate night audit reports: Trial Balance, Room Revenue Report, Tax Summary, Occupancy Report
6. Advance business date by 1
7. Release night audit lock
8. If any step fails → rollback all postings for this run, do NOT advance business date, alert Night Auditor

---

**Developer Notes:**
- **Idempotency Key:** `SHA256(reservation_id + business_date + "ROOM_CHARGE")` — store on the `charge` record. On re-run, check for existing record with this key before inserting.
- **Transaction Isolation:** Run all charge postings within a single database transaction (or a saga with compensating actions). Use `SERIALIZABLE` isolation level for the night audit ledger writes.
- **Failure Modes to Handle:**
  - DB timeout during posting → rollback, alert, retry from clean state
  - Tax engine unavailable → block audit, do not post without tax computation
  - Partial reservation list (pagination bug) → always validate total charged count matches `checked_in_count` before committing
- **Performance:** For large properties (1000+ rooms), process in batches of 50 with a configurable delay between batches to avoid DB lock contention.
- **Business Date vs System Date:** Store `business_date` as a `DATE` type (not `TIMESTAMP`). A charge posted at 2am on Jan 1 for "Dec 31 night" has `business_date = 2024-12-31`.

**Test Cases:**
- [ ] 100 checked-in reservations → exactly 100 room charge records created, 100 GL debit entries to 1200
- [ ] Night audit run twice on same business date → second run creates 0 new records (idempotency)
- [ ] Night audit with tax engine timeout → all postings rolled back, business date NOT advanced
- [ ] Business date advances only after all charges and reports are complete
- [ ] Trial balance report: total debits = total credits (net zero)
- [ ] Reservation checked in at 11:59 PM → included in that night's audit

---

## 2.2 Ancillary Charges (POS Integration)

**Plain English:**
A guest orders a burger at the hotel restaurant. The POS system needs to immediately add that charge to the guest's hotel bill. This sounds simple, but it's one of the most common sources of bugs in PMS integration — charges get lost, posted to wrong guests, or posted twice.

**Why it matters if we get it wrong:**
Lost charges = revenue leakage. Wrong guest = billing dispute. Duplicate charges = chargeback.

**Actors:** Guest, POS System, PMS Integration Layer

**Risk:** 🟠 HIGH

---

**Business Rules:**
1. POS must send: `room_number`, `reservation_id`, `pos_transaction_id`, `amount`, `tax_breakdown`, `outlet_code`, `timestamp`
2. PMS uses **both** `room_number` AND `reservation_id` as a composite key for routing (room number alone is unreliable — could have multiple reservations sharing a room)
3. If routing fails → charge goes to **suspense account** (GL 9999), never dropped silently
4. POS `transaction_id` must be stored on the folio line for cross-system reconciliation
5. Charge must appear on the folio within the configured tolerance window (default: 5 minutes)
6. Duplicate detection: same `pos_transaction_id` = same charge, reject with `DUPLICATE_TRANSACTION` — do not post again

---

**GL Journal Entry — POS Charge (Restaurant):**
```
DR  1200  Accounts Receivable — Guest         $55.00
    CR  4010  F&B Revenue                      $50.00
    CR  2100  Tax Payable                        $5.00

Narrative: Restaurant charge — POS Ref: POS-7741, Room 301, Reservation #RES-0042
```

**GL Journal Entry — Failed Routing (Suspense):**
```
DR  9999  Suspense — Unrouted POS Charge      $55.00
    CR  4010  F&B Revenue                      $50.00
    CR  2100  Tax Payable                        $5.00

Narrative: UNROUTED — POS Ref: POS-7741, Room 303 (no active reservation found)
Alert: Front desk notified for manual resolution
```

---

**Developer Notes:**
- **API Contract (HTNG-aligned):** POST `/api/v1/charges/pos`
  ```json
  {
    "pos_transaction_id": "POS-7741",
    "room_number": "301",
    "reservation_id": "RES-0042",
    "outlet_code": "REST-01",
    "line_items": [
      { "description": "Burger", "amount": 4545, "tax": 455, "gl_code": "4010" }
    ],
    "timestamp": "2024-12-31T19:30:00Z"
  }
  ```
- **Amounts in integers (cents/paise).** Never floats.
- **Retry handling:** POS systems retry on timeout. Your endpoint must be idempotent — same `pos_transaction_id` returns `200 OK` with existing transaction data, does not re-post.
- **Suspense Queue:** Build a front-desk alert and manual resolution workflow for suspense items. Suspense items older than 24h must escalate.

**Test Cases:**
- [ ] Valid POS charge → appears on folio within 5 minutes, GL 1200 debited
- [ ] Same `pos_transaction_id` sent twice → second request returns `200` with original transaction, no duplicate charge
- [ ] Room number with no active reservation → charge in suspense, front desk alert generated
- [ ] POS charge with incorrect tax amount → reject with `TAX_MISMATCH` error, do not post partial
- [ ] Suspense item resolved manually → correct GL entries created, suspense entry cleared

---

## 2.3 Charge Adjustment / Correction

**Plain English:**
A guest was charged $200 for a suite they never used — they stayed in a standard room. Someone needs to fix this without destroying the evidence that the wrong charge was ever posted. The trail must remain intact.

**Why it matters if we get it wrong:**
Deleting charges, even accidental ones, destroys the audit trail. Tax authorities and auditors expect to see the full financial history.

**Actors:** Front Desk Agent, Finance Manager (for prior-date)

**Risk:** 🟠 HIGH

---

**Business Rules:**
1. **Charges are never deleted.** Period. Full stop.
2. **Same-day correction (void):** Allowed by Front Desk Agent. Allowed only if the charge was posted on today's business date.
3. **Prior-date correction (adjustment):** Requires Finance Manager approval. Creates a new negative charge record referencing the original.
4. Every correction requires a mandatory **reason code** from a predefined list (e.g., `WRONG_ROOM_TYPE`, `DUPLICATE_POST`, `GUEST_DISPUTE`)
5. Tax must be reversed using the **original tax rate** — not the current rate
6. Adjustment record must store: `original_charge_id`, `reason_code`, `approving_actor_id`, `approved_at`

---

**GL Journal Entry — Void (same-day):**
```
-- Original charge:
DR  1200  Accounts Receivable — Guest        $200.00
    CR  4000  Rooms Revenue                  $181.82
    CR  2100  Tax Payable                     $18.18

-- Void entry:
DR  4000  Rooms Revenue                      $181.82
DR  2100  Tax Payable                         $18.18
    CR  1200  Accounts Receivable — Guest    $200.00

Narrative: VOID — Charge ID CHG-441, Reason: WRONG_ROOM_TYPE, Agent: FD-007
```

---

**Developer Notes:**
- Never use `UPDATE` or `DELETE` on charge records. Always `INSERT` a new correcting record.
- The folio display should show the original charge struck-through with the void/adjustment linked below it.
- Prior-date adjustments need an **approval workflow**: agent submits → Finance Manager approves → system posts. Use an async queue for this.
- Prevent circular corrections: you cannot void an adjustment (you'd just create another adjustment).

**Test Cases:**
- [ ] Same-day void → folio balance reduced, original charge visible as voided, GL reversed
- [ ] Prior-date correction without Finance Manager approval → HTTP 403 `INSUFFICIENT_PRIVILEGES`
- [ ] Correction without reason code → HTTP 422 `REASON_CODE_REQUIRED`
- [ ] Tax on void uses original 18% rate, not current 20% rate
- [ ] Original charge record has `voided = true`, `void_ref = CHG-441-V`

---

## 2.4 Early Departure

**Plain English:**
A guest checks out 3 days earlier than planned. The hotel's early departure policy may charge them for the unused nights. The system must stop posting future room charges immediately.

**Business Rules:**
1. Early departure fee = typically 1 night's room charge (policy-defined)
2. Future room charges must cease from the night after actual departure
3. Early departure acknowledgment should be captured at check-in (not at departure)
4. If room is resold on vacated nights → property may waive fee (configurable)

**Test Cases:**
- [ ] Early departure on Day 3 of a 7-night stay → Days 4–7 have no room charges
- [ ] Early departure fee posted before checkout confirmation
- [ ] Folio shows `actual_departure ≠ reserved_departure` flag

---

## 2.5 Late Checkout Charges

**Plain English:**
Checkout time is noon. At 3pm, the guest is still in the room. Depending on how late and the property's policy, they get charged an hourly rate, a half-day rate, or a full night's rate.

**Business Rules (USALI):**
- Late checkout fees post to GL **4030 (Miscellaneous Revenue)**, NOT GL 4000 (Rooms Revenue) — this is a common USALI compliance mistake
- Grace period is configurable (typically 30 min post-checkout time)
- Loyalty tier guests may have automatic waiver (config-driven, logged as comp)

**Test Cases:**
- [ ] Late checkout charge posts to GL 4030, not GL 4000
- [ ] Loyalty gold tier guest → late checkout waived, logged as comp with reason `LOYALTY_BENEFIT`

---

# 📌 PART 3: FOLIO & BILLING STRUCTURE

---

## 3.1 The Folio Data Model

**Plain English:**
A folio is the running tab for a guest. It's like a bank statement for their stay — every charge, every payment, every adjustment appears here. Understanding the data model is critical before building anything else in billing.

**Developer Notes — Recommended Schema:**

```sql
-- Core tables (simplified)

CREATE TABLE folios (
  id              UUID PRIMARY KEY,
  reservation_id  UUID NOT NULL,
  folio_type      ENUM('PRIMARY', 'INCIDENTALS', 'CORPORATE', 'PACKAGE'),
  status          ENUM('OPEN', 'SETTLED', 'CLOSED', 'TRANSFERRED_AR', 'MERGED', 'VOIDED'),
  currency        CHAR(3) NOT NULL,         -- ISO 4217
  balance         BIGINT NOT NULL DEFAULT 0, -- in cents
  payment_method  VARCHAR(50),
  created_at      TIMESTAMPTZ NOT NULL,
  closed_at       TIMESTAMPTZ,
  version         INT NOT NULL DEFAULT 1    -- optimistic locking
);

CREATE TABLE charge_lines (
  id               UUID PRIMARY KEY,
  folio_id         UUID NOT NULL REFERENCES folios(id),
  type             ENUM('CHARGE', 'PAYMENT', 'ADJUSTMENT', 'VOID', 'TRANSFER_IN', 'TRANSFER_OUT'),
  description      TEXT NOT NULL,
  amount           BIGINT NOT NULL,          -- positive = charge, negative = credit
  tax_amount       BIGINT NOT NULL DEFAULT 0,
  gl_account       VARCHAR(10) NOT NULL,
  business_date    DATE NOT NULL,
  pos_ref          VARCHAR(100),             -- external POS reference
  parent_charge_id UUID REFERENCES charge_lines(id), -- for adjustments/voids
  idempotency_key  VARCHAR(255) UNIQUE,
  reason_code      VARCHAR(50),
  created_by       UUID,                     -- actor ID
  created_at       TIMESTAMPTZ NOT NULL,
  is_voided        BOOLEAN DEFAULT FALSE
);

CREATE TABLE tax_lines (
  id              UUID PRIMARY KEY,
  charge_line_id  UUID NOT NULL REFERENCES charge_lines(id),
  tax_code        VARCHAR(20) NOT NULL,
  tax_name        VARCHAR(100) NOT NULL,
  tax_rate        DECIMAL(5,4) NOT NULL,    -- e.g., 0.1800 for 18%
  taxable_amount  BIGINT NOT NULL,
  tax_amount      BIGINT NOT NULL,
  gl_account      VARCHAR(10) NOT NULL
);
```

---

## 3.2 Multiple Folios per Reservation

**Plain English:**
A corporate guest's employer pays for the room and business meals. The guest pays for their own minibar and personal calls. These need to appear on separate bills — one going to the company, one to the guest's personal card.

**Business Rules:**
1. Every reservation has exactly **one primary folio** — created automatically at check-in
2. Additional folios can be created manually; maximum configurable per property (default: 10)
3. Folio type codes must exist: `PRIMARY`, `INCIDENTALS`, `CORPORATE`, `PACKAGE`
4. A folio with outstanding balance (non-zero) **cannot be closed** unless explicitly transferred to AR
5. Each folio generates a separate invoice

**Test Cases:**
- [ ] Creating secondary folio does not change primary folio's room charge routing
- [ ] Closing a folio with $50 balance (no AR routing) → HTTP 422 `OUTSTANDING_BALANCE`
- [ ] Each folio settles and invoices independently

---

## 3.3 Charge Routing Rules

**Plain English:**
When a room charge is posted, the system needs to know: which folio does it go to? When a spa charge comes in, does it go to the guest or the company? Routing rules are the answer.

**Business Rules:**
1. Routing rule precedence: Reservation-level > Room Type-level > Property-level (first match wins)
2. Routing rule components: `charge_type` → `destination_folio_type`
3. Rule changes mid-stay apply to **future charges only** — past charges are not re-routed
4. Unroutable charge (no matching rule) → **suspense account**, never silently dropped

**Developer Notes:**
- Evaluate routing rules as a rule chain, not as a database lookup. Use a strategy pattern.
- Store routing rules as versioned snapshots on the reservation — so mid-stay rule changes don't retroactively affect posted charges.

---

## 3.4 Charge Split

**Plain English:**
Four colleagues shared a dinner charged to one room. They want to split the $400 bill evenly across their four folios.

**Business Rules:**
1. Split by: fixed amount OR percentage; split values must sum exactly to original amount
2. Original charge becomes `SPLIT_PARENT` status — it is no longer active on the folio
3. Split lines are new charge records, each with `parent_charge_id` pointing to the original
4. Maximum one level of split — you cannot split a split
5. Tax is distributed proportionally across split lines

**GL Impact:** Split is internal folio movement — no new GL entries needed. The GL entries from the original charge remain. Only AR subledger entries change.

**Test Cases:**
- [ ] Split $400 as 25%/25%/25%/25% → four records of $100 each
- [ ] Split $100 as $60/$40 → sum = $100, original shows `SPLIT_PARENT`
- [ ] Split $100 as $60/$60 → rejected: `SPLIT_AMOUNTS_EXCEED_ORIGINAL`
- [ ] Attempting to split an already-split charge → `CANNOT_SPLIT_CHILD`

---

## 3.5 Charge Transfer

**Plain English:**
A spa charge of $80 was accidentally posted to Room 301 instead of Room 302. We need to move it without deleting anything.

**Business Rules:**
1. Transfer = debit target folio + credit source folio (both with reference to original charge)
2. Net GL impact = zero (no revenue impact, just AR subledger movement)
3. Transfer within same reservation → Front Desk Agent can do
4. Transfer to different reservation → Finance Manager approval required
5. Original posting date is preserved on the transferred charge

**GL Journal Entry:**
```
DR  1200  A/R Guest (Room 302 folio)         $80.00
    CR  1200  A/R Guest (Room 301 folio)     $80.00

Narrative: Charge transfer — CHG-991 from Folio F-301 to F-302, Reason: WRONG_ROOM
```

**Test Cases:**
- [ ] Transfer reduces source folio balance, increases target folio balance
- [ ] Net change to total hotel AR = zero
- [ ] Transfer to different reservation without manager approval → HTTP 403

---

## 3.6 Folio Merge

**Plain English:**
A couple had two separate reservations that were billing separately. Post-checkout they want a single invoice. Finance needs to merge the two folios into one consolidated bill.

**Business Rules:**
1. Merge requires Finance Manager authorization — this is irreversible
2. Both folios must be in `OPEN` state
3. All charges from source folio move to target folio with **original transaction dates preserved**
4. Source folio is marked `MERGED` and locked — not deleted
5. Tax totals must be recalculated on the merged folio

**Test Cases:**
- [ ] Source folio charges appear in target folio with original business dates
- [ ] Source folio status = `MERGED`, balance = 0, locked for further transactions
- [ ] Merge attempted on a `CLOSED` folio → `FOLIO_NOT_OPEN`

---

# 📌 PART 4: PAYMENT PROCESSING

---

## 4.1 Multi-Mode Payment

**Plain English:**
A guest's total bill is $500. They pay $200 cash, $200 from a gift voucher, and $100 on their Visa card. All three need to be recorded separately and the folio must balance to zero.

**Actors:** Guest, Front Desk Agent, Payment Gateway

**Risk:** 🟡 MEDIUM

---

**Business Rules:**
1. Each payment leg is a **separate transaction record** with its own `payment_method_code`
2. Total payments must not exceed folio balance (prevent overpayment by default — configurable)
3. Voucher payments must validate voucher ID against the voucher service before posting
4. Each payment must have an `authorization_reference` or `payment_reference` — no reference = no post
5. Foreign currency cash: exchange rate locked at payment time

---

**GL Journal Entries — Multi-Mode Payment:**
```
-- Cash payment:
DR  1100  Cash                               $200.00
    CR  1200  A/R Guest                      $200.00

-- Voucher payment:
DR  2200  Voucher Liability                  $200.00
    CR  1200  A/R Guest                      $200.00

-- Credit card payment:
DR  1105  Credit Card Clearing               $100.00
    CR  1200  A/R Guest                      $100.00

Narrative: Final settlement — Reservation #RES-0042, multi-mode
```

---

**Developer Notes (PCI-DSS Compliance):**
- **Never store raw card numbers (PAN).** Use tokenization via your payment gateway (Stripe, Adyen, etc.)
- Card data in your system = only the payment token, last 4 digits, expiry, and card type
- PCI-DSS v4.0 requires encryption in transit (TLS 1.2+) and at rest for all cardholder data
- Cash and voucher payments do not touch the payment gateway — they are direct ledger entries

**Test Cases:**
- [ ] Three-leg payment summing to folio balance → folio balance = 0, status = `SETTLED`
- [ ] Three-leg payment summing to > folio balance → final leg rejected: `EXCEEDS_OUTSTANDING_BALANCE`
- [ ] Voucher with invalid ID → `INVALID_VOUCHER`, payment not posted
- [ ] Each payment leg has distinct `payment_method_code` and `reference`

---

## 4.2 Overpayment Handling

**Plain English:**
A guest hands over $600 cash for a $550 bill. The extra $50 belongs to them. We need to store it, communicate it clearly, and either refund it or credit it to a future stay.

**Business Rules:**
1. Overpayment creates a **negative folio balance** (credit state)
2. Credit options: immediate cash refund, apply to another folio, hold as guest credit for next stay
3. Converting credit to a voucher requires Finance Manager approval
4. Folio with a credit balance does NOT auto-close

**GL Journal Entry:**
```
DR  1100  Cash                               $600.00
    CR  1200  A/R Guest                      $600.00

(Folio balance is now -$50, meaning hotel owes guest $50)

-- If immediately refunded:
DR  1200  A/R Guest                           $50.00
    CR  1100  Cash                             $50.00
```

**Test Cases:**
- [ ] Overpayment of $50 → folio shows `-$50` (credit), not zero
- [ ] Credit refund linked to original cash payment transaction
- [ ] Folio in credit state → system does not auto-close or generate invoice

---

## 4.3 Refund Processing

**Plain English:**
A guest was charged for a room they didn't use due to a system error. They want their money back. We need to trace the refund to the exact payment, issue it through the same channel, and document everything.

**Actors:** Finance Manager (approval for amounts above threshold), Payment Gateway

**Risk:** 🔴 CRITICAL

---

**Business Rules:**
1. Refund must reference the **original payment transaction ID**
2. Refund amount cannot exceed the amount on that specific payment leg
3. Refund to original payment method only — different method requires Finance Manager override + written justification
4. Cash refunds above configurable threshold (e.g., ₹5,000) require Finance Manager approval
5. Refund creates a **new transaction record** — original payment is never modified
6. Guest notification (email/SMS) is triggered on refund initiation, not on completion

---

**GL Journal Entry — Card Refund:**
```
DR  1200  A/R Guest                          $200.00
    CR  1105  Credit Card Clearing           $200.00

Narrative: Refund — Payment PAY-331, Reason: SYSTEM_ERROR, Auth: FM-Admin
```

---

**Developer Notes:**
- **Refund idempotency:** Use the same pattern as payments — idempotency key on the refund request.
- **Settlement timing:** Card refunds may take 3–7 business days to appear on the guest's statement. Refund `status` should track: `INITIATED` → `SUBMITTED_TO_GATEWAY` → `COMPLETED` / `FAILED`.
- **Block double-refund:** Check if an open chargeback exists on the same payment before issuing a refund (otherwise both the refund AND the chargeback could process).

**Test Cases:**
- [ ] Refund of $200 on a payment of $200 → succeeds, payment status = `REFUNDED`
- [ ] Refund of $250 on a payment of $200 → rejected: `REFUND_EXCEEDS_PAYMENT`
- [ ] Cash refund of ₹10,000 without Finance Manager approval → `APPROVAL_REQUIRED`
- [ ] Refund when chargeback already open → `CHARGEBACK_IN_PROGRESS`, refund blocked
- [ ] Original payment record unchanged; new refund record created with `parent_payment_id`

---

## 4.4 Chargeback Handling

**Plain English:**
A guest calls their bank and says "I didn't authorize this charge." The bank reverses the money and sends the hotel a chargeback notice. This is serious — the hotel needs to fight it with evidence or write off the loss.

**Actors:** Finance Manager, System, Payment Gateway

**Risk:** 🔴 CRITICAL

---

**Business Rules:**
1. Chargeback receipt triggers **automatic payment reversal** on the folio
2. Folio is **reopened** and flagged `DISPUTED` — locked for normal operations
3. Evidence package must be compilable from PMS: authorization records, registration card signature, POS receipts, check-in/checkout timestamps
4. Chargeback lifecycle: `RECEIVED` → `EVIDENCE_SUBMITTED` → `WON` / `LOST`
5. If **LOST**: Finance Manager approves write-off, amount posts to GL 5100 (Bad Debt Expense)
6. Guest account flagged `HIGH_RISK` — future direct billing requires override

---

**GL Journal Entry — Chargeback Received:**
```
DR  4000  Rooms Revenue (reversal)           $200.00
DR  2100  Tax Payable (reversal)              $20.00
    CR  1105  Credit Card Clearing           $220.00

Narrative: Chargeback — Payment PAY-331, CB Ref: CB-2024-001, Status: RECEIVED
```

**GL Journal Entry — Chargeback Lost (write-off):**
```
DR  5100  Bad Debt Expense                   $220.00
    CR  1200  A/R Guest                      $220.00

Narrative: Chargeback lost — CB Ref: CB-2024-001, written off per FM approval FM-044
```

**Test Cases:**
- [ ] Chargeback received → folio reopens, payment reversed, folio flagged `DISPUTED`
- [ ] Evidence package export → contains all required documents with timestamps
- [ ] Chargeback won → folio returns to `SETTLED`, no financial impact
- [ ] Chargeback lost → write-off requires Finance Manager approval, posts to GL 5100
- [ ] Concurrent refund attempt while chargeback is open → blocked: `CHARGEBACK_IN_PROGRESS`

---

## 4.5 Split Payment Reversal

**Plain English:**
A guest paid with both cash ($300) and card ($200) for a $500 bill. They then dispute the card payment via chargeback. Only the card leg should reverse — the cash leg is untouched.

**Business Rules:**
1. Reversal is scoped to the **specific payment transaction ID** only
2. Other payment legs on the same folio are unaffected
3. Reversal creates an outstanding balance that requires re-settlement
4. Finance Manager approval required for reversals on settled/closed folios

**Test Cases:**
- [ ] Card reversal of $200 → folio balance = +$200, cash payment unchanged
- [ ] Attempting to reverse the cash leg separately → independent action possible, same rules apply

---

# 📌 PART 5: INVOICE LIFECYCLE

---

## 5.1 Invoice Draft & Finalization

**Plain English:**
When a guest checks out, the system prepares their final bill. First it's a draft (the guest can review it). Once confirmed, it's locked forever — the original document cannot be changed.

**Why it matters if we get it wrong:**
Mutable invoices are a compliance failure. Tax authorities require that once an invoice is issued, it cannot be silently modified.

**Risk:** 🟠 HIGH

---

**Business Rules:**
1. **Draft** = preview only, no invoice number assigned, not a legal document
2. **Finalization** = invoice number assigned (sequential, no gaps, no reuse), document locked
3. Invoice number is assigned using a **database sequence** — never generate in application code
4. Finalized invoices trigger **revenue recognition** in GL
5. Tax line items must be explicitly itemized by tax type (VAT, GST, City Tax, Tourism Levy)
6. Post-finalization: no charge or payment modifications on the folio without reopening

---

**Invoice Number Generation (Developer Note):**
```sql
-- PostgreSQL example
CREATE SEQUENCE invoice_seq START 100001 INCREMENT 1 NO CYCLE;

-- At finalization:
UPDATE invoices 
SET invoice_number = nextval('invoice_seq'), status = 'FINALIZED', finalized_at = NOW()
WHERE id = :invoice_id AND status = 'DRAFT';
-- If no rows updated, concurrent finalization attempt — return conflict error
```

**Test Cases:**
- [ ] Draft invoice has no invoice number
- [ ] Two simultaneous finalization attempts → exactly one succeeds, one returns `409 ALREADY_FINALIZED`
- [ ] Invoice numbers are sequential with no gaps after 1000 finalizations
- [ ] Invoice includes separate tax line per tax type
- [ ] Folio is locked for edits after finalization

---

## 5.2 Invoice Reopen

**Plain English:**
A corporate client was invoiced with the wrong company name. The invoice is finalized. We need to fix it — but we must not destroy the original document.

**Business Rules:**
1. Reopen requires Finance Manager authorization — logged with reason
2. Original version is archived as `SUPERSEDED` — permanently accessible
3. Revised invoice gets version number (e.g., Invoice #10042 Rev 2)
4. All edits during reopen state are logged individually
5. Invoice must be re-finalized — it cannot remain in `REOPENED` state

**Test Cases:**
- [ ] Reopen without Finance Manager auth → `403 INSUFFICIENT_PRIVILEGES`
- [ ] After edit, original Invoice #10042 still retrievable with `status=SUPERSEDED`
- [ ] Revised invoice shows `Rev 2` and references original invoice number
- [ ] Invoice left in `REOPENED` state generates a daily alert to Finance Manager

---

## 5.3 Credit Note Issuance

**Plain English:**
A guest was overcharged on a finalized, paid invoice. We can't reopen the invoice — they've already received it. Instead, we issue a credit note: a separate document that says "we owe you $X back."

**Business Rules:**
1. Credit note references original invoice number — mandatory field
2. Credit note amount cannot exceed original invoice total
3. Separate sequential document number (different series from invoices)
4. Triggers: AR reduction (if corporate billing) OR refund initiation (if guest payment)
5. Tax reversal on credit note must use the **original tax rate** from the invoice

**GL Journal Entry:**
```
DR  4000  Rooms Revenue                      $100.00
DR  2100  Tax Payable                         $10.00
    CR  1210  A/R Corporate                  $110.00

Narrative: Credit note CN-0041, references Invoice INV-10042, Reason: BILLING_ERROR
```

**Test Cases:**
- [ ] Credit note amount > invoice total → `CREDIT_EXCEEDS_INVOICE`
- [ ] Credit note triggers AR balance reduction automatically
- [ ] Credit note tax = original invoice tax rate, even if current rate has changed

---

## 5.4 Invoice Void

**Plain English:**
An invoice was generated for a reservation that was cancelled hours earlier — a timing bug in the system. The invoice should never have existed. We need to void it.

**Business Rules:**
1. Void only permitted if: invoice NOT yet paid AND NOT submitted to tax authorities
2. Void marks invoice `VOIDED` — never deletes from database
3. All GL entries from the invoice are reversed
4. A replacement invoice must be issued if the underlying charges are still valid
5. Void reason is mandatory

**Test Cases:**
- [ ] Void unpaid invoice → `VOIDED`, GL reversed, folio unlocked for re-invoicing
- [ ] Void a paid invoice → `PAYMENT_EXISTS_CANNOT_VOID` — issue credit note instead
- [ ] Voided invoice remains searchable and displayable (auditors must be able to see it)

---

# 📌 PART 6: CHECKOUT & SETTLEMENT

---

## 6.1 Folio Settlement

**Plain English:**
Checkout time. The guest wants to pay and leave. The system must ensure every dollar of every charge has a corresponding payment — and only then can the folio close.

**Risk:** 🔴 CRITICAL ⚡

---

**Business Rules:**
1. **No checkout with an outstanding balance** — unless the balance is explicitly routed to direct billing (AR) or corporate account
2. Settlement applies payments to charges in **FIFO order** (oldest charge first) — override by agent requires manager approval
3. Card-on-file express checkout: authorization check must succeed **before** checkout confirmation
4. Settlement is **atomic** — partial settlement cannot leave the folio half-open, half-closed

---

**Settlement Validation Checklist (System Logic):**
```
Before allowing checkout:
1. Calculate total charges on all folios
2. Calculate total payments on all folios
3. For any outstanding balance:
   a. Is there an active AR/corporate routing rule? → Transfer to City Ledger
   b. Is there a card-on-file? → Attempt authorization
   c. Neither? → Block checkout, show agent alert
4. If all folios = zero balance → proceed to finalize invoices → close folios
```

**Test Cases:**
- [ ] Checkout with $200 outstanding (no AR routing, no card on file) → blocked: `OUTSTANDING_BALANCE`
- [ ] Checkout with corporate routing → remainder transferred to city ledger, folio closes
- [ ] Express checkout card auth failure → front desk alert created, checkout blocked
- [ ] Settlement receipt auto-generated at checkout

---

## 6.2 Express / Self-Checkout

**Plain English:**
Guest checks out via the hotel app at 6am without going to the front desk. The system charges their card, emails the invoice, and releases their room key.

**Business Rules:**
1. Express checkout only available if: all charges are routable AND card on file is valid AND no disputed charges
2. Card authorization must succeed **in real time** before checkout completes
3. Failed authorization → alert front desk queue, do NOT leave folio in limbo

**Test Cases:**
- [ ] Express checkout with valid card → invoice emailed within 2 minutes
- [ ] Express checkout with expired card → front desk alert, guest notified, checkout incomplete
- [ ] Express checkout with disputed charge → blocked, front desk must resolve first

---

# 📌 PART 7: GROUP & CORPORATE BILLING

---

## 7.1 Group Master Billing

**Plain English:**
A company books 30 rooms for a conference. The company pays for all the rooms and the conference meals. Each guest pays their own minibar and personal calls. This requires a master folio for the company charges and individual folios for personal charges.

**Business Rules:**
1. Master folio holds group-level charges (meeting room, group F&B, AV equipment)
2. Individual room folios hold personal charges
3. Billing instructions (what goes where) must be **locked 48 hours before group arrival**
4. Individual checkout does NOT trigger or require master folio settlement
5. Master folio is settled by the group coordinator — generates one consolidated invoice

**Test Cases:**
- [ ] Room charges route to master folio per billing instructions
- [ ] Individual guest checks out → folio closes; master folio unaffected
- [ ] Billing instruction change after lock time → requires Finance Manager override

---

## 7.2 Direct Billing / City Ledger

**Plain English:**
XYZ Corp has an account with the hotel. When their employees stay, the hotel doesn't ask them to pay at checkout — instead, the hotel bills XYZ Corp monthly. This is direct billing.

**Business Rules:**
1. Direct billing requires pre-approved corporate account — no ad-hoc direct billing
2. Charges not covered by the agreement must be paid by the guest at checkout
3. City ledger invoice includes corporate billing address, PO number (if required), and itemized charges
4. Payment terms (Net 30, Net 60) are set per corporate account

**GL Journal Entry — Transfer to City Ledger:**
```
DR  1210  A/R Corporate — XYZ Corp          $850.00
    CR  1200  A/R Guest                      $850.00

Narrative: City ledger transfer — Reservation #RES-0042, Account: XYZ-CORP-001
```

**Test Cases:**
- [ ] Charges not covered by corporate agreement → blocked from city ledger, flagged for guest payment
- [ ] City ledger invoice shows correct PO number and billing address from corporate account
- [ ] Outstanding city ledger balance feeds into AR aging report automatically

---

# 📌 PART 8: ACCOUNTS RECEIVABLE (AR)

---

## 8.1 AR Invoice Tracking

**Business Rules:**
1. Every city ledger invoice has a `due_date` = invoice date + payment terms
2. Partial payment reduces invoice balance (does not close it until fully paid)
3. AR total must reconcile to GL 1210 at end of each business day

**Key Metrics:**
- **DSO (Days Sales Outstanding)** = (Outstanding AR / Total Revenue) × 365 — track this
- **AR Turnover** = Total Revenue / Average AR — monitor monthly

**Test Cases:**
- [ ] Partial payment of $500 on $850 invoice → invoice balance = $350, status = `PARTIALLY_PAID`
- [ ] End-of-day AR total = sum of all open invoice balances (reconciliation check)

---

## 8.2 Aging & Collections

**Plain English:**
How long has money been owed? The older the debt, the harder it is to collect. Aging reports bucket outstanding invoices by how overdue they are.

**USALI Aging Buckets:**

| Bucket | Days Outstanding |
|--------|-----------------|
| Current | 0–30 days |
| Overdue 1 | 31–60 days |
| Overdue 2 | 61–90 days |
| Overdue 3 | 91+ days |

**Business Rules:**
1. Aging is calculated from `invoice_due_date`, not `invoice_date`
2. Escalation triggers at configurable thresholds per bucket
3. Interest charges (if contracted) post as separate charge lines with their own GL code

**Test Cases:**
- [ ] Invoice due Jan 1, checked on Feb 15 → bucket `31–60 days`
- [ ] Escalation trigger at 60+ days → task created in collections queue
- [ ] Interest charge posts to GL 4030, not GL 4000

---

## 8.3 Bad Debt Write-Off

**Plain English:**
XYZ Corp owes $5,000. They went bankrupt. After 6 months of collection attempts, the Finance team needs to write this off as an unrecoverable loss.

**Risk:** 🔴 CRITICAL

**Business Rules:**
1. Requires dual approval: Finance Manager + CFO for amounts above threshold
2. Must have documented collection history (minimum 3 attempts logged in system)
3. Posts to GL 5100 (Bad Debt Expense)
4. AR invoice moves to `WRITTEN_OFF` status — never deleted
5. Corporate account flagged — future direct billing requires explicit re-approval

**GL Journal Entry:**
```
DR  5100  Bad Debt Expense                  $5,000.00
    CR  1210  A/R Corporate                 $5,000.00

Narrative: Bad debt write-off — Account: XYZ-CORP-001, approved by FM-Admin + CFO
```

**Test Cases:**
- [ ] Write-off below threshold → Finance Manager only
- [ ] Write-off above threshold without CFO approval → `DUAL_APPROVAL_REQUIRED`
- [ ] Write-off with < 3 collection attempts logged → `INSUFFICIENT_COLLECTION_HISTORY`
- [ ] Written-off AR still appears in reports with `WRITTEN_OFF` status

---

# 📌 PART 9: ADJUSTMENTS, DISCOUNTS & SPECIAL CASES

---

## 9.1 Complimentary Charges (Comps)

**Plain English:**
A guest complained about a noisy room. As a goodwill gesture, the Front Desk Manager comps their breakfast (marks it as free). But the breakfast still happened — the revenue center still delivered the service. We need to record both the revenue AND the comp expense.

**Why it matters (USALI requirement):**
Comps must appear as **gross revenue** with an offsetting **comp expense** — not simply omitted. This is critical for accurate KPIs. If you just delete the charge, your Revenue per Available Room (RevPAR) and Average Daily Rate (ADR) look artificially higher than they are.

**GL Journal Entry — Comp:**
```
-- Original charge remains:
DR  1200  A/R Guest                          $50.00
    CR  4010  F&B Revenue                    $50.00

-- Comp offset:
DR  5000  Comp Allowance Expense             $50.00
    CR  1200  A/R Guest                      $50.00

Net effect: F&B revenue = $50, guest balance = $0, comp expense = $50
```

**Business Rules:**
1. Comp requires reason code + approval per role-based comp limit (e.g., FD Agent: up to $100/stay, Manager: up to $500)
2. Comp limit is **enforced by the system**, not by convention
3. Comps are tracked against a departmental comp budget
4. Loyalty points are **not accrued** on comped charges

**Test Cases:**
- [ ] Agent comps $150 (agent limit = $100) → `COMP_LIMIT_EXCEEDED`, requires manager approval
- [ ] Comp charge shows full value in revenue report, offset in expense report
- [ ] Loyalty points not calculated on comped lines

---

## 9.2 Discounts & Packages

**Plain English:**
A guest books a "Honeymoon Package" for $500 that includes: $300 room + $100 dinner + $100 spa. For accounting purposes, each component must be broken out and posted to its own revenue account — not all $500 to rooms.

**Business Rules (USALI):**
1. Package components must be **broken out** per USALI revenue centers: Room, F&B, Spa
2. Breakdown allocation is defined in the package configuration
3. Each component posts to its own GL account (4000, 4010, 4020)
4. Discount is applied at line-item level — NOT as a folio-level deduction
5. Package inclusions post as charge + offset (same as comp pattern)

**GL Journal Entries — Package:**
```
DR  1200  A/R Guest                          $500.00
    CR  4000  Rooms Revenue                  $300.00
    CR  4010  F&B Revenue                    $100.00
    CR  4020  Spa Revenue                    $100.00

Narrative: Honeymoon Package — Rate Plan: HONEY-01
```

**Test Cases:**
- [ ] Package total = sum of components (no rounding leakage)
- [ ] Each component in correct GL account for revenue reporting
- [ ] Expired package code rejected at time of application, not at checkout

---

## 9.3 Multi-Currency Handling

**Plain English:**
A Japanese tourist pays in Yen. The hotel's base currency is INR. We need to record the transaction in both currencies, lock the exchange rate at the moment of payment, and ensure refunds use the original rate — not today's rate.

**Risk:** 🔴 CRITICAL

---

**Business Rules:**
1. Exchange rate is **locked at transaction time** — never recalculated retroactively
2. Folio is maintained in **base currency** (INR) — foreign currency is for receipt display only
3. Refunds in foreign currency use the **original transaction's exchange rate**
4. Rate source is configurable: central bank feed, property-defined rate, or manual daily entry
5. FX gain/loss from rounding posts to GL 6000 (Exchange Rate Variance)

---

**GL Journal Entry — Foreign Currency Payment:**
```
-- Guest pays ¥15,000 at rate 0.60 INR/JPY = INR 9,000

DR  1100  Cash                              ₹9,000.00
    CR  1200  A/R Guest                     ₹9,000.00

Metadata: foreign_currency=JPY, foreign_amount=15000, exchange_rate=0.60, rate_date=2024-12-31
```

**Developer Notes:**
- Store on every FX transaction: `base_currency_amount`, `foreign_currency`, `foreign_amount`, `exchange_rate`, `rate_source`, `rate_locked_at`
- **Refund calculation:** `refund_foreign = refund_base / original_exchange_rate` — use stored rate, not current rate
- **Rounding:** Round to 2 decimal places in base currency. Any rounding difference goes to GL 6000.

**Test Cases:**
- [ ] ¥15,000 at 0.60 → INR 9,000 posted to folio
- [ ] Refund of ¥5,000 → INR 3,000 refunded (using original 0.60 rate, not current rate)
- [ ] Rate change between check-in and checkout → each night's charge uses its own nightly rate

---

# 📌 PART 10: TAX HANDLING

---

## 10.1 Dynamic Tax Computation

**Plain English:**
Tax is complicated. The same room charge might attract 18% GST for a regular guest but 0% for a diplomat. A second cup of coffee in the restaurant has a different tax than the room service version. Taxes change on budget day. The system must handle all of this correctly every time.

**Risk:** 🔴 CRITICAL

---

**Tax Matrix Structure:**

| Dimension | Examples |
|-----------|---------|
| Charge Type | ROOM, F&B, SPA, LAUNDRY, TELECOM |
| Guest Type | REGULAR, CORPORATE, DIPLOMATIC, GOVERNMENT |
| Jurisdiction | National, State, City, Tourism Zone |
| Date Range | Effective from → to (handles budget changes) |
| Rate Plan | Some plans may include tax or be tax-exempt |

**Business Rules:**
1. Tax computed at **time of posting** — not at booking
2. Multiple tax components can stack on one charge (e.g., GST 18% + City Tourism Levy 5%)
3. Tax rounding rule is configurable per jurisdiction (round half-up is most common)
4. Tax rate change (new budget) takes effect on configured date — does not affect prior-posted charges
5. Tax engine unavailability = **block the transaction** (do not post without tax)

---

**Developer Notes:**
- Tax engine should be a **separate service** — not inline with charge posting. Call it synchronously, but make it independently deployable.
- Cache tax rules in-memory with TTL = 1 hour. On cache miss, fetch from DB.
- Tax rule versioning: every rule has `effective_from` and `effective_to`. Query by `business_date` to get the correct rate.
- **Tax determinism test:** Same inputs always produce the same output. Run this as part of your CI pipeline.

```python
# Example tax computation test
assert compute_tax("ROOM", "REGULAR", "MUMBAI", date(2024,12,31), 10000) == {
    "GST": 1800,        # 18%
    "city_levy": 100    # 1%
}
```

**Test Cases:**
- [ ] Room charge on Dec 31 (18% GST) → correct tax amount
- [ ] Same room charge on Jan 1 (new budget: 20% GST) → new rate applied to new charges only
- [ ] Diplomatic guest → zero tax, exemption reason code stored
- [ ] Tax engine timeout during night audit → audit blocked, partial postings rolled back
- [ ] Tax breakdown on invoice shows each component separately (GST + City Levy as separate lines)

---

## 10.2 Tax-Exempt Billing

**Plain English:**
The US Consulate is staying for a diplomatic conference. Under treaty, they pay zero tax. But we still need to document this carefully — tax authorities will audit it.

**Business Rules:**
1. Tax exemption requires **verified documentation** (certificate number, issue date, issuing authority)
2. Exemption applied at reservation level — retroactive application requires Finance Manager override
3. Exemption specifies which taxes are excluded (not blanket unless documentation says so)
4. Certificate reference number is **printed on the invoice** — mandatory for audit

**Test Cases:**
- [ ] Tax-exempt reservation → invoice shows "TAX EXEMPT — Cert #DIPL-2024-007"
- [ ] Retroactive exemption without Finance Manager → `403 APPROVAL_REQUIRED`
- [ ] Partial exemption (only GST exempt, City Levy still applies) → correct tax computation

---

## 10.3 Financial Period Close (Tax Lock)

**Plain English:**
At month-end, the finance team "closes the books." Once closed, no one can backdate a transaction to that month — because the tax report for that month has already been filed.

**Business Rules:**
1. Period close requires: AR reconciled + GL reconciled + all business dates in period have night audit completed
2. Close is **irreversible** without CFO approval
3. Backdated posting to closed period → `PERIOD_CLOSED` error — must journal-entry into next open period
4. Close locks the tax report for that period

**Test Cases:**
- [ ] Backdated charge to closed month → `PERIOD_CLOSED_USE_JOURNAL_ENTRY`
- [ ] Period close attempt with unreconciled AR → `RECONCILIATION_PENDING`
- [ ] Close generates immutable tax report export (PDF + JSON)

---

# 📌 PART 11: LOYALTY & REDEMPTION

---

## 11.1 Loyalty Points Accrual

**Plain English:**
Every $1 a guest spends on eligible charges earns them hotel loyalty points. But we don't award points mid-stay — what if they return a charge? We award points at checkout, after final settlement.

**Business Rules:**
1. Points accrue on **eligible charge types** only (Room revenue standard; F&B/Spa configurable)
2. Points calculated **post-settlement**, before invoice finalization
3. **Comped charges do not earn points**
4. Accrual is a request to the loyalty provider API — PMS stores the request status only
5. Failed API call → queued for retry (max 3 attempts, 1h apart) — never silently dropped

**USALI Note:** Loyalty program costs post to GL 5200 (Loyalty Program Expense) — not as revenue deductions.

**Test Cases:**
- [ ] $500 room revenue → 500 points accrual request sent to loyalty provider
- [ ] Comped $50 breakfast → 0 points for that line
- [ ] Loyalty API timeout → retry queued, not dropped; PMS shows `PENDING` accrual status

---

## 11.2 Loyalty Points Redemption

**Plain English:**
A repeat guest wants to use 10,000 points (worth $100) to pay for part of their stay. We validate the points balance with the loyalty provider, apply the credit to the folio, and track it like any other payment.

**Business Rules:**
1. Redemption validated in **real-time** against loyalty provider before posting
2. Redemption amount calculated at **fixed conversion rate** (e.g., 100 points = $1), rate is configurable
3. Redemption posted as a **payment line** on the folio (not a discount)
4. Cancellation → automatic re-credit request sent to loyalty provider
5. Partial redemption allowed — remainder settled by another payment method

**GL Journal Entry:**
```
DR  5200  Loyalty Program Expense           $100.00
    CR  1200  A/R Guest                     $100.00

Narrative: Points redemption — 10,000 pts @ $0.01/pt, Member ID: LY-98712
```

**Test Cases:**
- [ ] Redemption validation failure → `INSUFFICIENT_POINTS`, payment not posted
- [ ] Cancellation after redemption → loyalty provider re-credit request sent, status tracked
- [ ] Points-to-currency conversion rate stored on the transaction for auditing

---

# 📌 PART 12: AUDIT & COMPLIANCE

---

## 12.1 Immutable Audit Trail

**Plain English:**
Every financial action, approval, correction, and login must leave a permanent, tamper-proof record. If anything is ever questioned — by a guest, an auditor, a court — you can reconstruct exactly what happened, when, and by whom.

**Risk:** 🔴 CRITICAL

---

**What Must Be Logged:**
- Every charge creation, void, adjustment
- Every payment, refund, chargeback
- Every folio state change
- Every invoice creation, finalization, reopen, void
- Every approval (who approved, what they approved, timestamp)
- Every login/logout for users with financial permissions
- Every failed authorization attempt

**Audit Log Record Structure:**
```json
{
  "id": "uuid",
  "event_type": "CHARGE_VOIDED",
  "entity_type": "CHARGE",
  "entity_id": "CHG-441",
  "actor_id": "FD-007",
  "actor_role": "FRONT_DESK_AGENT",
  "timestamp_utc": "2024-12-31T14:30:00Z",
  "business_date": "2024-12-31",
  "terminal_id": "FD-TERMINAL-03",
  "ip_address": "192.168.1.10",
  "before_state": { "amount": 20000, "status": "POSTED" },
  "after_state": { "amount": 20000, "status": "VOIDED" },
  "reason_code": "WRONG_ROOM_TYPE",
  "metadata": {}
}
```

**Business Rules:**
1. Audit log records are **immutable** — no actor can modify or delete them (including DBAs via application layer)
2. Retention minimum: **7 years** (or local regulatory requirement, whichever is longer)
3. Audit log must be exportable in CSV and structured JSON
4. Unauthorized access attempts to audit log are separately flagged

**Developer Notes:**
- Use an **append-only table** for audit logs. No `UPDATE` or `DELETE` permissions on this table — even for DB admins via the application role.
- Consider a separate audit log database or service to prevent cross-contamination with operational data.
- Use `TIMESTAMPTZ` (with timezone) for all audit timestamps. Store in UTC.

**Test Cases:**
- [ ] Any folio state can be fully reconstructed from audit log alone
- [ ] Direct `DELETE` on audit_log table → permission denied at DB level
- [ ] Audit log export for a given date range returns all events in chronological order

---

## 12.2 Role-Based Access Control (RBAC) — Financial Permissions

**The Four-Eyes Principle:**
Certain high-risk financial operations require two people to approve. This isn't optional — it's a built-in fraud prevention mechanism.

**RBAC Matrix — Key Financial Permissions:**

| Permission | Front Desk | Night Auditor | Finance Manager | CFO |
|------------|-----------|---------------|-----------------|-----|
| Post charge | ✅ | ✅ | ✅ | ✅ |
| Same-day void | ✅ | ❌ | ✅ | ✅ |
| Prior-date adjustment | ❌ | ❌ | ✅ | ✅ |
| Issue refund < threshold | ✅ | ❌ | ✅ | ✅ |
| Issue refund ≥ threshold | ❌ | ❌ | ✅ (initiator) | ✅ (approver) |
| Reopen invoice | ❌ | ❌ | ✅ | ✅ |
| Write-off < threshold | ❌ | ❌ | ✅ | ✅ |
| Write-off ≥ threshold | ❌ | ❌ | ✅ (initiator) | ✅ (required) |
| Period close | ❌ | ❌ | ✅ (initiator) | ✅ (required) |
| Access audit log | ❌ | ❌ | ✅ (read-only) | ✅ |

**Developer Notes:**
- Permissions are evaluated **server-side** — never trust client-side role checks alone
- Four-eyes workflow: `PENDING_APPROVAL` → `APPROVED` / `REJECTED` — with full audit trail at each step
- Session-level permissions must not persist after logout/login cycle

---

# 📌 PART 13: EDGE CASES & HIGH-RISK SCENARIOS

---

## 13.1 Night Audit System Failure Mid-Run

**Scenario:** Night audit has processed 400 out of 1000 reservations when the database server crashes.

**What will go wrong without protection:**
400 guests have room charges. 600 do not. Business date has advanced (or not — race condition). The hotel wakes up to financial chaos.

**Correct Design:**
1. All 1000 charge postings happen within a **single database transaction**
2. If transaction commits → all 1000 charges posted, business date advances
3. If transaction fails at any point → **complete rollback**, 0 charges posted, business date unchanged
4. Alert generated with full failure log (which reservation caused the failure, error message, timestamp)
5. Re-run from clean state → idempotency keys prevent any duplication

**Test Cases:**
- [ ] Simulate DB failure at charge #500 → audit rolls back completely, charge count = 0
- [ ] Re-run after failure → exactly 1000 charges created, no duplicates
- [ ] Business date NOT advanced after failed run

---

## 13.2 Concurrent Payment & Checkout

**Scenario:** Guest pays via mobile app while a front desk agent simultaneously runs the checkout and applies a different payment.

**What will go wrong without protection:**
- Double payment applied to folio ($1,000 collected for $500 bill)
- Or: checkout completes before mobile payment lands → folio closed, payment in limbo

**Correct Design:**
- Folio has a **version/optimistic lock counter**
- Any write to the folio (charge, payment, settlement) must include the current version
- If version mismatch on write → `409 CONFLICT`, requester must re-read folio and retry
- Payment gateway idempotency key prevents duplicate capture even if two payment requests are submitted

**Developer Notes:**
```sql
-- Optimistic lock pattern
UPDATE folios 
SET balance = balance - :amount, version = version + 1
WHERE id = :folio_id AND version = :expected_version;

-- If 0 rows affected → concurrent modification, return 409
```

**Test Cases:**
- [ ] Concurrent payment + checkout → only one succeeds, other gets `409 CONCURRENT_MODIFICATION`
- [ ] Retry after `409` → reads latest folio state, completes correctly
- [ ] Final folio balance = correct settled amount, no double-payment

---

## 13.3 Split + Transfer + Refund Chain

**Scenario:** A $300 charge is split into $150/$150. One $150 is transferred to a corporate folio. The corporate folio is later partially refunded $75.

**The Challenge:** The refund of $75 needs to trace all the way back to the original $300 charge for audit purposes.

**Required Data Chain:**
```
Original Charge CHG-100 ($300)
    ├── Split Child CHG-101 ($150) → Folio F-Guest
    └── Split Child CHG-102 ($150) → transferred to Folio F-Corp as CHG-103
            └── Refund REF-001 ($75) → linked to CHG-103 → linked to CHG-102 → linked to CHG-100
```

**Business Rules:**
1. Every transaction stores `parent_transaction_id`
2. Refund lineage must be traversable to the original charge
3. Total refund across all children cannot exceed original charge amount

**Test Cases:**
- [ ] Full audit trail from REF-001 → CHG-103 → CHG-102 → CHG-100 is traversable via API
- [ ] Attempting to refund $200 on a $150 leg → `REFUND_EXCEEDS_PARENT`
- [ ] GL impact of full reversal chain = net zero

---

## 13.4 Loyalty Redemption + Chargeback

**Scenario:** Guest used 10,000 points ($100) + Visa ($400) to pay for a $500 stay. They then chargeback the Visa charge.

**Correct Behavior:**
1. Chargeback reverses **only the $400 Visa payment leg**
2. Loyalty redemption ($100) is NOT automatically reversed — it requires human review
3. System flags: "Chargeback received — loyalty redemption on same folio requires manual review"
4. Finance Manager + Loyalty Team jointly decide: re-credit points or leave as is (depending on chargeback outcome)

**Test Cases:**
- [ ] Chargeback on card leg → only card payment reversed, loyalty line unchanged
- [ ] Alert generated for Finance + Loyalty team review
- [ ] If chargeback WON → points re-credit to loyalty provider after explicit FM approval

---

## 13.5 Currency Fluctuation Over a 30-Night Stay

**Scenario:** Guest checks in for 30 nights. Exchange rate changes significantly during the stay.

**Correct Behavior:**
- Night 1 room charge: ¥15,000 at rate 0.60 = ₹9,000
- Night 15 room charge: ¥15,000 at rate 0.65 = ₹9,750
- Night 30 room charge: ¥15,000 at rate 0.58 = ₹8,700

- Total invoice in INR = ₹9,000 + ₹9,750 + ₹8,700 + ... (sum of each night's actual INR amount)
- Total invoice in JPY shown on receipt = sum of nightly JPY amounts (all ¥15,000 = consistent)

**Wrong approach (DO NOT DO):** Apply today's rate to all 30 nights at checkout. This is wrong and will cause revenue mismatches.

**Test Cases:**
- [ ] 30-night stay with varying FX → INR total = sum of 30 individual nightly INR amounts
- [ ] Each charge record stores its own exchange rate used
- [ ] FX variance report shows daily rate delta for the stay

---

# 📌 PART 14: INTEGRATION SPECIFICATIONS

---

## 14.1 POS Integration (HTNG Standard)

**Endpoint:** `POST /api/v1/charges/pos`

**Required Fields:**
```json
{
  "pos_transaction_id": "string (unique, idempotency key)",
  "room_number": "string",
  "reservation_id": "string (use with room_number for dual-key routing)",
  "outlet_code": "string (REST-01, SPA-01, etc.)",
  "business_date": "date (YYYY-MM-DD)",
  "line_items": [
    {
      "description": "string",
      "gl_code": "string",
      "amount": "integer (cents)",
      "tax_breakdown": [
        { "tax_code": "GST", "rate": 0.18, "amount": "integer" }
      ]
    }
  ],
  "timestamp": "ISO 8601 UTC"
}
```

**Response Codes:**
- `200 OK` — already processed (idempotent replay)
- `201 Created` — new charge posted
- `422` — validation error (missing field, amount mismatch)
- `409` — routing conflict (suspense)
- `503` — PMS temporarily unavailable (POS should retry with backoff)

---

## 14.2 Payment Gateway Integration

**Pattern:** Tokenize → Authorize → Capture — never store raw PAN

**Webhook Events to Handle:**
| Event | PMS Action |
|-------|-----------|
| `payment.captured` | Post payment to folio |
| `payment.failed` | Alert front desk, block checkout |
| `refund.completed` | Update refund status to `COMPLETED` |
| `chargeback.received` | Open chargeback case, reverse payment |
| `chargeback.won` | Close case, restore settled status |
| `chargeback.lost` | Initiate write-off workflow |

**Retry Policy:** Exponential backoff — 1s, 2s, 4s, 8s, max 3 retries. After 3 failures → queue for manual processing.

---

## 14.3 GL / ERP Integration

**Pattern:** Batch export at end-of-day (after night audit completes)

**Export Format (HTNG Back Office Integration):**
```json
{
  "business_date": "2024-12-31",
  "property_id": "PROP-001",
  "journal_entries": [
    {
      "gl_account": "4000",
      "account_name": "Rooms Revenue",
      "debit": 0,
      "credit": 150000,
      "department": "ROOMS",
      "reference": "NIGHT_AUDIT_2024-12-31"
    }
  ],
  "control_totals": {
    "total_debits": 300000,
    "total_credits": 300000
  }
}
```

**Reconciliation Check:** `total_debits == total_credits` must be true before export is sent. If not — do not export; alert Finance Manager.

---

## 14.4 Loyalty Provider Integration

| Operation | Method | Timeout | On Failure |
|-----------|--------|---------|------------|
| Validate redemption | Sync | 3s | Block redemption |
| Post accrual | Async | 5s | Queue for retry |
| Re-credit on cancellation | Async | 5s | Queue for retry |
| Check balance | Sync | 2s | Allow with warning |

---

# 📌 PART 15: STATE MACHINES

---

## Folio State Machine

```
          ┌─────────────────────────────────────────────┐
          │                                             │
   [Created]                                           │
       │                                               │
       ▼                                               │
    OPEN ──────── (add charges/payments) ──────► OPEN  │
       │                                               │
       ├─── [all charges paid] ──────────► SETTLED     │
       │                                    │          │
       ├─── [transfer to AR] ──► TRANSFERRED_AR        │
       │                                    │          │
       │                         [invoice finalized]   │
       │                                    ▼          │
       │                                 CLOSED ───────┤
       │                                    │          │
       │                         [FM approval] ────────┤
       │                                    ▼          │
       │                               REOPENED        │
       │                                    │          │
       │                         [re-finalized]        │
       │                                    ▼          │
       │                                 CLOSED        │
       │                                               │
       └─── [merge into another folio] ──► MERGED      │
                                                       │
                                        (irreversible) ┘
```

## Invoice State Machine

```
  DRAFT ──── [finalize] ──── FINALIZED ──── [close] ──── CLOSED
                                  │                         │
                          [void, no payment]          [credit note]
                                  │                         │
                               VOIDED                 CREDIT_NOTE_ISSUED
                                  │
                          [FM reopen] ──── REOPENED ──── [re-finalize] ──── CLOSED (Rev 2)
```

## Payment State Machine

```
  PENDING ──► AUTHORIZED ──► CAPTURED ──► SETTLED
                                              │
                                    ┌─────────┤──────────┐
                                    │                     │
                             [refund]              [chargeback]
                                    │                     │
                                REFUNDED       CHARGEBACK_RECEIVED
                              (PARTIAL /           │
                               FULL)         EVIDENCE_SUBMITTED
                                                    │
                                         ┌──────────┴──────────┐
                                         │                     │
                                   CHARGEBACK_WON      CHARGEBACK_LOST
                                   (settle restored)   (write-off initiated)
```

---

# 📌 PART 16: RISK & PRIORITY MATRIX

---

| Priority | Scenario | Risk | Complexity | Blocks What? |
|---------|----------|------|-----------|-------------|
| **P0** | Night audit idempotency | 🔴 | High | Revenue accuracy |
| **P0** | Night audit atomicity (rollback) | 🔴 | High | Financial integrity |
| **P0** | Concurrent payment + checkout lock | 🔴 | High | Double payment |
| **P0** | Payment refund to original method only | 🔴 | Medium | PCI compliance |
| **P0** | Chargeback reversal + evidence package | 🔴 | High | Fraud management |
| **P0** | Tax computation determinism | 🔴 | High | Tax compliance |
| **P0** | POS idempotency (no duplicate charges) | 🔴 | Medium | Revenue accuracy |
| **P0** | Audit log immutability | 🔴 | Medium | Compliance |
| **P1** | Invoice finalization (sequential numbers) | 🟠 | Medium | Tax authority compliance |
| **P1** | Invoice reopen versioning | 🟠 | Medium | Audit trail |
| **P1** | Multi-currency FX rate locking | 🔴 | High | Revenue accuracy |
| **P1** | USALI GL code mapping | 🟠 | Medium | Financial reporting |
| **P1** | Bad debt write-off dual approval | 🔴 | Low | Fraud prevention |
| **P1** | Period close (no backdating) | 🔴 | Medium | Tax filing |
| **P2** | Advance deposit liability (not revenue) | 🟡 | Low | Revenue recognition |
| **P2** | Cancellation policy snapshot | 🟡 | Medium | Guest disputes |
| **P2** | Charge routing to suspense (no drops) | 🟡 | Medium | Revenue leakage |
| **P2** | Comp as gross revenue + offset | 🟡 | Low | KPI accuracy |
| **P2** | Loyalty accrual retry queue | 🟡 | Medium | Guest experience |
| **P2** | Group master billing separation | 🟡 | Medium | Corporate billing |
| **P3** | Late checkout fee to GL 4030 (not 4000) | 🟢 | Low | USALI compliance |
| **P3** | Express checkout SLA | 🟢 | Low | Guest experience |

---

# 🧠 Summary: The Principles That Drive Everything

If you remember nothing else from this document, remember these:

---

### 1. Money is Never Deleted — Only Reversed
Every financial mistake is corrected by adding a new entry, not removing the old one. A voided charge is still in the database with `is_voided = true`. An audit trail without gaps is the foundation of trust.

### 2. The Business Date is Not the Clock
A charge posted at 2am on January 1 might belong to December 31's business date. Always use the hotel's business date — not `NOW()` — for financial record-keeping.

### 3. Idempotency Saves You at 3am
Night audits fail. POS systems retry. Payment gateways time out and retry. Design every financial write operation to be idempotent. If you can run it twice and get the same result, you're safe.

### 4. Liability Before Revenue
An advance deposit is not income until the service is delivered. A prepaid package is not revenue until check-in. Getting this wrong inflates financial statements and causes tax problems.

### 5. Tax is Computed at Posting Time, Not Booking Time
The budget changes tax rates. What was 18% when booked might be 20% when the stay happens. Tax is always computed when the charge is posted — using the rate active on the business date.

### 6. USALI is the Language
Late checkout fees are Miscellaneous Revenue (GL 4030), not Rooms Revenue (GL 4000). Comps appear as both revenue and expense — not as a deduction. If your GL codes don't match USALI, your reporting is wrong even if your math is right.

### 7. The Four Ledgers Always Balance
Advance Deposit + Guest Ledger + City Ledger + Settlement = zero net. If your trial balance doesn't zero out, there's a bug somewhere.

### 8. Integration Failure Must Degrade Gracefully
A POS that can't reach the PMS puts the charge in suspense — it doesn't drop it. A loyalty API that times out queues the accrual for retry — it doesn't silently fail. Every external integration must have a defined failure behavior.

---

*Document Version: 3.0*
*Standards: USALI 12th Edition (effective Jan 1, 2026), HTNG, PCI-DSS v4.0, GAAP, ASC 606*
*Audience: Developers, Business Analysts, QA Engineers, Product Managers, Finance Teams*
*Review Cycle: Quarterly or upon any regulatory/standards update*
*Last Updated: 2026*
