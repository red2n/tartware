# Reservation Management

## Reservation Lifecycle

```
┌─────────────────────────────────────────────────────────────────────┐
│                    RESERVATION STATE MACHINE                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌──────────┐                                                       │
│   │  INQUIRY │ ─── quote requested ──────────────────┐               │
│   └────┬─────┘                                       │               │
│        │ booking confirmed                           ▼               │
│        ▼                                      ┌──────────┐           │
│   ┌──────────┐                                │  QUOTED  │           │
│   │ RESERVED │ ◄── converted from quote ──────└────┬─────┘           │
│   └────┬─────┘                                     │ expired         │
│        │                                           ▼                 │
│        │ deposit received            ┌──────────────────┐            │
│        │ (optional)                  │     EXPIRED      │            │
│        ▼                             └──────────────────┘            │
│   ┌──────────┐                                                       │
│   │CONFIRMED │                                                       │
│   └────┬─────┘                                                       │
│        │                                                             │
│        ├── guest no-show ────────────────────────► ┌──────────┐     │
│        │                                           │ NO_SHOW  │     │
│        │                                           └──────────┘     │
│        │                                                             │
│        ├── cancellation ─────────────────────────► ┌──────────┐     │
│        │                                           │ CANCELED │     │
│        │                                           └──────────┘     │
│        │                                                             │
│        │ guest arrives                                               │
│        ▼                                                             │
│   ┌──────────┐                                                       │
│   │CHECKED_IN│ ─── early checkout ──┐                               │
│   └────┬─────┘                      │                               │
│        │                            │                               │
│        │ stay complete              │                               │
│        ▼                            ▼                               │
│   ┌────────────┐                                                     │
│   │CHECKED_OUT │ ◄──────────────────┘                               │
│   └────────────┘                                                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Reservation Types

| Type | Code | Description | Billing |
|------|------|-------------|---------|
| **Transient** | TRA | Individual guest bookings | Guest pays |
| **Corporate** | COR | Company rate negotiated bookings | Direct bill or guest |
| **Group** | GRP | 10+ rooms, common arrival, shared billing | Master folio |
| **Wholesale** | WHL | Tour operator pre-purchased inventory | Prepaid |
| **Package** | PKG | Room + services bundled | Bundled rate |
| **Comp** | CMP | Complimentary stay | No charge |
| **House Use** | HSE | Internal use (staff, maintenance) | Internal |
| **Day Use** | DAY | Same-day check-in/out (hourly) | Hourly rate |
| **Waitlist** | WTL | Pending availability confirmation | Pending |

## Reservation Data Elements

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `confirmation_number` | String | Unique booking identifier |
| `arrival_date` | Date | Check-in date |
| `departure_date` | Date | Check-out date |
| `room_type` | Reference | Requested/assigned room category |
| `rate_code` | String | Pricing rule applied |
| `guest_id` | Reference | Primary guest profile |
| `status` | Enum | Current reservation state |
| `booking_source` | String | Channel that created booking |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `room_number` | String | Specific room assignment |
| `adults` | Integer | Number of adults |
| `children` | Integer | Number of children |
| `special_requests` | Text | Guest preferences/notes |
| `eta` | Time | Estimated time of arrival |
| `payment_guarantee` | Reference | Card on file |
| `group_id` | Reference | Parent group booking |
| `company_id` | Reference | Corporate account |
| `travel_agent_id` | Reference | Booking agency |

## Confirmation Number Standards

| Format | Example | Use Case |
|--------|---------|----------|
| Sequential | 100001, 100002 | Simple properties |
| Date-based | 20260205-001 | Multi-property chains |
| Alphanumeric | R-A3B7X9 | Uniqueness across systems |
| Channel-prefixed | BDC-123456 | Source identification |
| Property-prefixed | HTL-NYC-001 | Multi-property portfolios |

## Modification Rules

| Change Type | Restrictions | Typical Fee |
|-------------|--------------|-------------|
| Date change | Subject to availability | Often free |
| Room type upgrade | Subject to availability | Rate difference |
| Room type downgrade | Subject to policy | May be free |
| Guest name change | Limited by policy | May incur fee |
| Add nights | Subject to availability | Standard rate |
| Reduce nights | Cancellation policy applies | May incur fee |

## Related Documents

- [Booking Sources](booking-sources.md) - Channel distribution
- [Group Bookings](group-bookings.md) - Group management standards
