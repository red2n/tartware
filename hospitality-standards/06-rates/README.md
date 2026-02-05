# Rate Management

## Rate Code Structure

### Rate Code Naming Conventions

| Pattern | Example | Description |
|---------|---------|-------------|
| BAR | BAR | Best Available Rate |
| AAA | AAARATE | Auto association discount |
| CORP + ID | CORP1234 | Corporate negotiated |
| PKG + type | PKGBFAST | Package with inclusion |
| PROMO + date | PROMO2024 | Promotional rate |
| GOV | GOVRATE | Government rate |
| GROUP + ID | GRP12345 | Group block rate |

### Rate Categories

| Category | Description | Yield Impact |
|----------|-------------|--------------|
| **Rack** | Published maximum rate | Baseline |
| **BAR** | Dynamic best available | Demand-based |
| **Corporate** | Negotiated company rate | Volume commitment |
| **Wholesale** | Net rate for packages | Marked up by seller |
| **Promotional** | Limited-time offer | Demand generation |
| **Package** | Rate + inclusions | Bundled value |
| **Member** | Loyalty program rate | Direct booking incentive |

## Rate Structures

### Single vs. Derived Rates

| Type | Description | Example |
|------|-------------|---------|
| **Flat rate** | Fixed amount | $199/night |
| **Tiered rate** | Varies by LOS | Day 1-2: $199, Day 3+: $179 |
| **Derived rate** | % off parent | Member: BAR - 10% |
| **Component rate** | Add-ons priced separately | Room + breakfast + parking |

### Rate Qualifications

| Qualifier | Description | Enforcement |
|-----------|-------------|-------------|
| Advance purchase | Book X days ahead | Non-refundable often |
| Minimum LOS | Stay X+ nights | Restriction |
| Closed to arrival | Cannot arrive on date | Inventory control |
| Maximum LOS | Stay no more than X | Revenue management |
| Day of week | Specific days | F/S different from M-Th |

## Rate Rules & Restrictions

| Rule | Description | Use Case |
|------|-------------|----------|
| **CTA** | Closed to Arrival | Control arrival pattern |
| **CTD** | Closed to Departure | Control checkout pattern |
| **Min LOS** | Minimum stay required | High demand periods |
| **Max LOS** | Maximum stay allowed | Extended stay limits |
| **Min advance** | Book X days before | Yield protection |
| **Max advance** | Book no more than X days | Inventory control |
| **Day of week** | Rate varies by day | Business vs. leisure |

## Cancellation Policies

| Policy Type | Description | Industry Term |
|-------------|-------------|---------------|
| Flexible | Cancel by 6 PM local | Standard |
| Moderate | Cancel 24-48 hours ahead | 24HR CANX |
| Strict | Cancel 72+ hours ahead | 72HR CANX |
| Non-refundable | No cancel, forfeit payment | NREF |
| Deposit required | Forfeit deposit on cancel | DEP |

### Cancellation Fee Structures

| Structure | Application |
|-----------|-------------|
| One night penalty | Most common |
| Percentage penalty | 10-50% of stay value |
| Full forfeit | Non-refundable rates |
| Sliding scale | Stricter as arrival approaches |

## Package Rates

### Common Package Components

| Component | Example | Posting |
|-----------|---------|---------|
| Breakfast | Daily breakfast included | F&B allocation |
| Parking | Valet or self-park | Daily or per stay |
| Spa | Credit or treatment | Spa department |
| Dining | Restaurant credit | F&B department |
| Activities | Golf, tour, tickets | External or internal |
| Transportation | Airport transfer | Third-party or internal |

### Package Revenue Allocation

```
Package Rate: $299/night
├── Room Revenue: $229 (76.6%)
├── Breakfast: $40 (13.4%)
├── Parking: $20 (6.7%)
└── Spa Credit: $10 (3.3%)
```

## Seasonal Pricing

| Season | Description | Rate Strategy |
|--------|-------------|---------------|
| Peak | Maximum demand | Highest rates, restrictions |
| Shoulder | Moderate demand | Standard rates |
| Off-peak | Low demand | Promotions, LOS deals |
| Blackout | Special events | Rack only, no discounts |

## Competitive Positioning

| Position | Strategy | When to Use |
|----------|----------|-------------|
| Premium | Above compset | Strong brand, unique |
| Parity | Match compset | Maintain share |
| Undercut | Below compset | Gain share, fill |
| Value | Lower with justification | Different segment |

---

[← Back to Overview](../README.md) | [Revenue Management →](revenue-management.md)
