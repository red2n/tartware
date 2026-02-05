# Financial Operations

## Folio Management

### Folio Types

| Type | Purpose | Owner |
|------|---------|-------|
| **Guest folio** | Individual room charges | Room guest |
| **Master folio** | Group charges | Meeting planner/company |
| **Incidental folio** | Non-room charges only | Event attendee |
| **House account** | Internal charges | Property |
| **City ledger** | Post-checkout receivables | Company/agency |

### Charge Posting

| Charge Type | Department | Revenue Category |
|-------------|------------|------------------|
| Room | Rooms | Room revenue |
| Tax | Rooms | Tax collected |
| F&B | Restaurant | Food & beverage |
| Telephone | Telecom | Telecom revenue |
| Minibar | Minibar | Other revenue |
| Parking | Parking | Other revenue |
| Spa | Spa | Other revenue |
| Laundry | Laundry | Other revenue |
| Misc | Misc | Other revenue |

### Routing Instructions

```
┌─────────────────────────────────────────────────────────────────┐
│                    ROUTING EXAMPLES                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Corporate Guest Routing:                                        │
│  ┌─────────────────┐   ┌─────────────────────┐                  │
│  │ Room + Tax      │──►│ Master Folio (Co.)  │                  │
│  └─────────────────┘   └─────────────────────┘                  │
│  ┌─────────────────┐   ┌─────────────────────┐                  │
│  │ Incidentals     │──►│ Guest Personal Card  │                  │
│  └─────────────────┘   └─────────────────────┘                  │
│                                                                  │
│  Group Attendee Routing:                                         │
│  ┌─────────────────┐   ┌─────────────────────┐                  │
│  │ Room + Tax +    │──►│ Group Master Bill   │                  │
│  │ Breakfast       │   └─────────────────────┘                  │
│  └─────────────────┘                                            │
│  ┌─────────────────┐   ┌─────────────────────┐                  │
│  │ All Other       │──►│ Individual Guest    │                  │
│  └─────────────────┘   └─────────────────────┘                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Payment Processing

### Payment Methods

| Method | Processing | Settlement |
|--------|------------|------------|
| Credit card | Authorization → Capture | T+1 to T+3 |
| Debit card | Real-time | T+1 |
| Cash | Manual | Immediate |
| Direct bill | Invoice | Net 30/60 |
| Gift card | Prepaid redemption | Immediate |
| Mobile wallet | NFC/digital | Same as card |
| Wire transfer | Bank | 1-3 days |
| Check | Deposit | Clear time |

### Credit Card Operations

| Operation | When | Purpose |
|-----------|------|---------|
| **Authorization** | Check-in | Guarantee payment |
| **Pre-authorization** | Check-in | Hold estimated total |
| **Incremental auth** | During stay | Increase hold |
| **Capture** | Checkout | Collect payment |
| **Void** | Before settle | Cancel auth |
| **Refund** | Post-settle | Return payment |
| **Chargeback** | Dispute | Bank reversal |

### Authorization Amounts

| Scenario | Auth Amount Formula |
|----------|---------------------|
| Standard | (Rate × Nights) + Tax + Estimated incidentals |
| Prepaid OTA | Incidentals only ($50-100) |
| Walk-in | 1 night + deposit |
| Extended stay | Weekly re-auth |

## Night Audit

### Night Audit Sequence

| Step | Process | Purpose |
|------|---------|---------|
| 1 | Block day-end transactions | Freeze activity |
| 2 | Post room and tax | Apply daily charges |
| 3 | Update guest balances | Accurate folios |
| 4 | Verify postings | QC check |
| 5 | Run trial balance | Debits = credits |
| 6 | Generate reports | Daily reports |
| 7 | Roll business date | Advance system date |
| 8 | Back up data | Data protection |
| 9 | Print/distribute reports | Distribution |
| 10 | Release for next day | Open new business date |

### Night Audit Reports

| Report | Purpose |
|--------|---------|
| Manager's report | Summary KPIs |
| Room revenue report | Room sales detail |
| Department revenue | All revenue by dept |
| Deposit ledger | Advance deposits |
| City ledger summary | A/R balances |
| No-show report | Failed arrivals |
| Forecast report | Next 7-30 days |
| Comp/adjustment report | Discounts given |

## Accounts Receivable

### City Ledger Accounts

| Type | Examples |
|------|----------|
| Corporate | Company direct bill accounts |
| Travel agency | Commission and receivables |
| Group | Post-event billing |
| Employee | Staff charges |
| Bad debt | Uncollectible accounts |

### AR Aging

| Bucket | Days Outstanding | Action |
|--------|------------------|--------|
| Current | 0-30 days | Normal collection |
| 30 days | 31-60 days | First reminder |
| 60 days | 61-90 days | Escalated collection |
| 90+ days | 91+ days | Write-off consideration |

## Revenue Recognition

### USALI Department Structure

| Department | Revenue Items |
|------------|---------------|
| Rooms | Room revenue, cancellation fees |
| F&B | Restaurant, bar, room service, banquet |
| Other operated | Spa, golf, parking, telecom |
| Rentals | Meeting room rental, equipment |
| Miscellaneous | Cancellation fees, forfeits |

### Daily Revenue Posting

| Timing | Revenue Type |
|--------|--------------|
| Real-time | Point of sale, POS |
| Night audit | Room and tax |
| Month-end | Adjustments, accruals |

---

[← Back to Overview](../README.md) | [Night Audit →](night-audit.md)
