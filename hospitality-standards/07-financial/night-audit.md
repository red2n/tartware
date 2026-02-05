# Night Audit Deep Dive

## Audit Timeline

```
┌──────────────────────────────────────────────────────────────────────┐
│                     NIGHT AUDIT TIMELINE                              │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  11:00 PM          12:00 AM           2:00 AM           6:00 AM      │
│  ────┬────────────────┬─────────────────┬────────────────┬────       │
│      │                │                 │                │           │
│      ▼                ▼                 ▼                ▼           │
│  Pre-close        Roll Date        Post-audit       Day Start        │
│  - Balance        - Post room      - Reports        - Open for       │
│  - Corrections    - Advance date   - Distribution     business       │
│                   - Backup                                           │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

## Pre-Audit Checklist

| Task | Verification |
|------|--------------|
| All outlets closed | POS batched and balanced |
| Room service | All checks posted |
| Banquet | Event charges finalized |
| Housekeeping | All room statuses updated |
| Front desk | Pending arrivals resolved |
| Cashier | Cash drawer balanced |
| Guest folios | Zero-balance reviewed |

## Room & Tax Posting

### Posting Logic

| Condition | Action |
|-----------|--------|
| Occupied room | Post room + tax to folio |
| Complimentary | Post at $0 (track as comp) |
| House use | Post to house account |
| Day use | Checkout before audit |
| No-show | Post one night + cancel |
| Stay-over | Regular posting |

### Tax Calculations

| Tax Type | Basis |
|----------|-------|
| Transient occupancy | Room revenue |
| Sales tax | Room + taxable items |
| Tourism levy | Per room-night or % |
| State/local | Varies by jurisdiction |

## Balancing Procedures

### Trial Balance

```
Debits (Guest Balances) = Credits (Revenue + Payments)

Example:
Guest Ledger Balance:     $45,000
+ City Ledger Balance:    $15,000
= Total Receivables:      $60,000

Room Revenue:             $35,000
+ F&B Revenue:            $12,000
+ Other Revenue:          $5,000
+ Deposits Received:      $8,000
= Total Credits:          $60,000
```

### Common Discrepancies

| Issue | Resolution |
|-------|------------|
| Unposted charges | Locate and post |
| Double posting | Reverse duplicate |
| Incorrect rate | Adjust with reason |
| Missing payment | Locate and apply |
| Wrong room | Transfer to correct folio |

## Report Generation

### Manager's Report

| Section | Content |
|---------|---------|
| Occupancy | Rooms sold, OOO, available, % |
| Revenue | Room, F&B, other, total |
| ADR/RevPAR | Rate performance |
| Market segment | Mix analysis |
| Comp/House | Non-revenue rooms |
| Comparison | DOW LY, MTD, YTD |

### Operational Reports

| Report | Audience | Content |
|--------|----------|---------|
| Arrivals | Front desk | Today's check-ins |
| Departures | Front desk | Today's check-outs |
| In-house | All departments | Current guests |
| VIP list | Front office | Special attention |
| Trace report | All | Outstanding tasks |
| Maintenance | Engineering | Open work orders |

### Financial Reports

| Report | Purpose |
|--------|---------|
| Revenue by department | Department performance |
| Payment journal | All payments received |
| Deposit ledger | Advance deposits |
| City ledger | A/R details |
| Adjustment report | Rate changes, refunds |
| Void report | Cancelled transactions |
| Cashier report | Cash activity |

## End-of-Day Processing

### Bucket Check

| Bucket | Expected State |
|--------|----------------|
| Due out (yesterday) | Empty (all departed) |
| Due out (today) | Some may extend |
| Due in (yesterday) | Empty or no-show |
| Stay-over | Verified in-house |

### Occupancy Verification

```
Physical Discrepancy Check:
- System shows OCC, room vacant → Update to VD
- System shows VC, room occupied → Investigate (walk-in? error?)
- Room status doesn't match → Housekeeping verification
```

## Automated vs. Manual Audit

| Function | Automated | Manual |
|----------|-----------|--------|
| Room posting | Yes | Override if needed |
| Balancing | Calculate | Verify |
| Report generation | Yes | Review |
| Exception handling | Flag | Resolve |
| Date roll | System | Initiate |

## Post-Audit Tasks

| Task | Responsible |
|------|-------------|
| Distribute reports | Night audit |
| Flag issues for AM | Night audit |
| Update forecast | Revenue manager |
| Review KPIs | GM/DOS |
| Month-end close | Accounting |

---

[← Back to Financial Operations](README.md)
