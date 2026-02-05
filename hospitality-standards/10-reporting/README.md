# Reporting & Analytics

## Operational Reports

### Daily Operations

| Report | Purpose | Audience |
|--------|---------|----------|
| **Arrivals list** | Today's expected check-ins | Front desk |
| **Departures list** | Today's expected check-outs | Front desk |
| **In-house list** | Current occupants | All departments |
| **VIP report** | Special attention guests | Front desk, F&B |
| **Trace report** | Outstanding tasks | All departments |
| **Room status** | Housekeeping assignments | Housekeeping |

### Front Office Reports

| Report | Content |
|--------|---------|
| Reservation forecast | Next 7-30-90 days |
| Group pickup | Block vs. actual bookings |
| No-show report | Failed arrivals |
| Walk report | Relocated guests |
| Rate variance | Actual vs. posted rate |
| Comp room report | Complimentary stays |

### Housekeeping Reports

| Report | Content |
|--------|---------|
| Room assignment | Attendant workload |
| Room status summary | VC/VD/OC/OD counts |
| Discrepancy report | Physical vs. system |
| Deep clean schedule | Periodic cleaning due |
| Lost and found log | Items inventory |

## Financial Reports

### Revenue Reports

| Report | Frequency | Content |
|--------|-----------|---------|
| Daily revenue | Daily | Revenue by department |
| Market segment | Daily | Revenue/ADR by segment |
| Source of business | Daily | Revenue by booking source |
| Package revenue | Daily | Package breakdown |
| Comp & adjustment | Daily | Rate changes, write-offs |

### Manager's Report

| Section | Metrics |
|---------|---------|
| Occupancy | Rooms sold, available, OCC% |
| Revenue | Room, F&B, other, total |
| Rate metrics | ADR, RevPAR |
| Comparison | vs. budget, vs. LY |
| Forecast | Next day/week preview |

### Month-End Reports

| Report | Purpose |
|--------|---------|
| Income statement | P&L by department |
| Trial balance | Account balances |
| AR aging | Receivables status |
| Accrual adjustments | Revenue recognition |
| Variance analysis | Actual vs. budget |

## Key Metrics Dashboard

### Revenue Metrics

| Metric | Formula | Benchmark |
|--------|---------|-----------|
| Occupancy | Sold ÷ Available | Market dependent |
| ADR | Room Rev ÷ Sold | Compset comparison |
| RevPAR | Room Rev ÷ Available | Primary KPI |
| TRevPAR | Total Rev ÷ Available | Holistic view |
| NRevPAR | Net Rev ÷ Available | After commission |
| GOPPAR | GOP ÷ Available | Profitability |

### Operational Metrics

| Metric | Formula | Target |
|--------|---------|--------|
| Check-in time | Avg processing time | < 3 min |
| OTA mix | OTA bookings ÷ Total | < 30% |
| Direct booking % | Direct ÷ Total | > 40% |
| Repeat guest % | Return guests ÷ Total | > 35% |
| Guest satisfaction | Survey average | > 4.5/5 |
| Review score | Aggregate OTA rating | > 8.5/10 |

## STR Reporting (Smith Travel Research)

### Weekly/Monthly Benchmarking

| Report | Content |
|--------|---------|
| **STAR Report** | Compset performance comparison |
| **Trend Report** | Historical performance |
| **Response Report** | Same-day preliminary data |
| **Demand 360** | Forward-looking demand data |

### Index Calculations

| Index | Formula | Meaning |
|-------|---------|---------|
| Occupancy Index | My OCC ÷ Compset OCC × 100 | Fair share |
| ARI (ADR Index) | My ADR ÷ Compset ADR × 100 | Rate position |
| RGI (RevPAR Index) | My RevPAR ÷ Compset RevPAR × 100 | Overall performance |

Index interpretation:
- 100 = Fair share
- >100 = Outperforming market
- <100 = Underperforming market

## Business Intelligence

### Data Warehouse Structure

| Layer | Content |
|-------|---------|
| Source | PMS, POS, CRM, CM, RMS |
| Staging | Extracted raw data |
| Warehouse | Transformed, star schema |
| Marts | Department-specific views |
| Presentation | Dashboards, reports |

### Common Dimensions

| Dimension | Attributes |
|-----------|------------|
| Date | Day, week, month, quarter, year, DOW |
| Property | Brand, region, market, comp set |
| Room | Type, category, floor, view |
| Guest | Segment, tier, geography, company |
| Rate | Code, category, package |
| Channel | Source, partner, type |

### Common Measures

| Measure | Description |
|---------|-------------|
| Room nights | Count of occupied rooms |
| Room revenue | Sum of room charges |
| Average rate | Revenue ÷ room nights |
| Revenue per available | Revenue ÷ available rooms |
| Ancillary revenue | Non-room revenue |
| Total revenue | All revenue streams |

## Forecasting Models

### Short-Term (0-30 days)

| Input | Weight |
|-------|--------|
| On-the-books | High |
| Recent pickup pace | High |
| Day of week pattern | Medium |
| Event calendar | High |
| Weather | Low-Medium |

### Long-Term (31-365 days)

| Input | Weight |
|-------|--------|
| Historical patterns | High |
| Market trends | Medium |
| Economic indicators | Medium |
| Competitive supply | Medium |
| Strategic events | Variable |

---

[← Back to Overview](../README.md)
