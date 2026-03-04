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

| Metric | Formula | Benchmark (2026) |
|--------|---------|------------------|
| Occupancy | Sold ÷ Available | 66-73% global average |
| ADR | Room Rev ÷ Sold | $130-160 global average |
| RevPAR | Room Rev ÷ Available | $85-115 global average |
| TRevPAR | Total Rev ÷ Available | Holistic view (emerging primary) |
| NRevPAR | Net Rev ÷ Available | After commission (critical as costs rise) |
| GOPPAR | GOP ÷ Available | Profitability (#1 metric per Cornell study) |
| CostPAR | Total Cost ÷ Available | Cost efficiency |
| EBITDAR | Earnings before I/T/D/A/R | Hotel valuation metric |

### Operational Metrics

| Metric | Formula | Target (2026) |
|--------|---------|---------------|
| Check-in time | Avg processing time | < 3 min (< 90s express) |
| OTA mix | OTA bookings ÷ Total | < 30% |
| Direct booking % | Direct ÷ Total | > 40% (trending > 50%) |
| Repeat guest % | Return guests ÷ Total | > 35% |
| Guest satisfaction | Survey average | > 4.5/5 |
| Review score | Aggregate OTA rating | > 8.5/10 |
| Mobile check-in adoption | Mobile ÷ Total check-ins | > 30% (growing) |
| Net CostPAR ratio | Cost per booking ÷ RevPAR | Minimize |

## STR Reporting (CoStar with STR Benchmark)

STR has been rebranded as **CoStar with STR Benchmark** following CoStar Group's acquisition. It remains the industry standard for hotel performance benchmarking with **94,000 hotels and 12 million rooms** in its directly-sourced sample.

### Weekly/Monthly Benchmarking

| Report | Content |
|--------|---------|
| **STAR Report** | Compset performance comparison (OCC, ADR, RevPAR indices) |
| **Trend Report** | Historical performance trends |
| **Response Report** | Same-day preliminary data |
| **Demand 360** | Forward-looking demand data (search, booking pace) |
| **Profit & Loss (HotStats integration)** | Bottom-line benchmarking (GOPPAR, CostPAR) |

### Index Calculations

| Index | Formula | Meaning |
|-------|---------|---------|
| Occupancy Index | My OCC ÷ Compset OCC × 100 | Fair share of demand |
| ARI (ADR Index) | My ADR ÷ Compset ADR × 100 | Rate position vs. market |
| RGI (RevPAR Index) | My RevPAR ÷ Compset RevPAR × 100 | Overall market performance |

Index interpretation:
- 100 = Fair share
- >100 = Outperforming market (gaining share)
- <100 = Underperforming market (losing share)

### CoStar Benchmark Enhanced Capabilities (2026)

| Feature | Description |
|---------|-------------|
| Competitive intelligence | Integrated top-line and bottom-line benchmarking |
| Portfolio analysis | Configurable methodologies for multi-property operators |
| Corporate lead sourcing | Tenant database for B2B demand identification |
| Profit benchmarking | GOPPAR, CostPAR via HotStats data integration |

## Business Intelligence

### Data Warehouse Structure

| Layer | Content |
|-------|---------|
| Source | PMS, POS, CRM, CM, RMS, HotStats, Reputation |
| Staging | Extracted raw data |
| Warehouse | Transformed, star schema |
| Marts | Department-specific views |
| Presentation | Dashboards, reports, AI-driven insights |

### OPERA Cloud Reporting & Analytics

Oracle Hospitality Reporting and Analytics provides integrated BI:

| Feature | Description |
|---------|-------------|
| Property-specific or groupwide | Flexible reporting scope |
| Graphical dashboards | KPIs visible at a glance without spreadsheets |
| Custom report builder | Data from any business area |
| Drill-down capability | High-level metrics to individual transactions |
| Cross-department | Rooms, F&B, operations, revenue in one system |

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
