# Revenue Management

## Key Performance Indicators

### Core Metrics

| Metric | Formula | Purpose | Industry Benchmark (2026) |
|--------|---------|---------|---------------------------|
| **Occupancy** | Rooms Sold ÷ Rooms Available | Demand measure | 66-73% global avg |
| **ADR** | Room Revenue ÷ Rooms Sold | Rate effectiveness | $130-160 global avg |
| **RevPAR** | Room Revenue ÷ Rooms Available | Combined performance | $85-115 global avg |
| **TRevPAR** | Total Revenue ÷ Rooms Available | Holistic performance | Emerging primary KPI |
| **GOPPAR** | Gross Operating Profit ÷ Available Rooms | Profitability | Ranked #1 most important by 33.7% of revenue leaders |
| **NRevPAR** | Net Revenue ÷ Available Rooms | After commissions | Critical as booking costs surge 25% since 2019 |

### Extended Metrics

| Metric | Formula | Purpose |
|--------|---------|---------|
| **RevPAC** | Total Rev ÷ Available Customers | Per-guest value |
| **TRevPOR** | Total Rev ÷ Occupied Rooms | Per-occupied-room total value |
| **ARPC** | Ancillary Rev ÷ Covers | Non-room revenue per customer |
| **Flow-through** | % of incremental revenue to profit | Efficiency |
| **EBITDAR** | Earnings Before Interest, Taxes, Depreciation, Amortization, Rent | Hotel valuation metric |
| **CostPAR** | Total Cost ÷ Available Rooms | Cost efficiency (pairs with GOPPAR) |

## Revenue Management Systems (RMS) Landscape

### Market Overview (2025-2026)

- **83.9%** of hotels now use an RMS (up from 82.3% in 2023, Duetto survey)
- **RMS market**: $1.2B (2024) → projected $3.4B by 2033 (12.3% CAGR)
- **AI investment**: Hotels investing >$1B/year in AI pricing technology (Skift Research)
- **Impact**: AI-powered RMS yields **15% revenue increase**; ML models cut forecast error by **up to 54%**

### Leading RMS Platforms

| Platform | Vendor | Approach | Key Differentiator |
|----------|--------|----------|---------------------|
| **G3 RMS** | IDeaS (SAS) | Automated decisions | Industry pioneer; deepest automation; 30K+ hotel installations |
| **GameChanger (RP-OS)** | Duetto | Open Pricing | Revenue & Profit Operating System; integrates HotStats for GOPPAR; +6% RevPAR year one |
| **Atomize** | Atomize (Mews) | Real-time AI | Fully automated real-time pricing; strong in independent/boutique segment |
| **RateGain** | RateGain | Competitive intelligence | Rate shopping + demand data; AirGain (airline demand) |
| **OPERA Cloud + Nor1** | Oracle | Integrated PMS pricing | Native PMS integration; Nor1 AI upsell; Distribution module |

## Demand Forecasting

### Forecast Components

| Component | Description | AI/ML Enhancement (2026) |
|-----------|-------------|--------------------------|
| Historical data | Same period prior years | Pattern recognition across multi-year datasets |
| On-the-books | Current reservations | Real-time pace analytics |
| Pickup pace | Rate of new bookings | ML models cut forecast error by up to 54% (next-day) and 45% (two-week) |
| Event calendar | Local demand drivers | Automated event detection and demand scoring |
| Market intelligence | Competitor data | Real-time rate shopping (RateGain, OTA Insight) |
| Economic indicators | Travel trends | Macroeconomic sentiment analysis |
| Web search demand | Google/meta search trends | Forward-looking demand signals (STR Demand360) |
| Flight data | Airline bookings to destination | AirGain-style demand proxies |

### Forecast Horizon

| Horizon | Purpose | Typical Actions |
|---------|---------|-----------------|
| 0-7 days | Tactical | Close/open rates, marketing |
| 8-30 days | Operational | Rate adjustments, restrictions |
| 31-90 days | Strategic | Pricing strategy, campaigns |
| 91-365 days | Budget | Seasonal pricing, contracts |

## Pricing Strategies

### Dynamic Pricing

| Strategy | When to Apply | RMS Automation Level |
|----------|---------------|----------------------|
| Raise rate | Demand exceeds supply | Fully automated (IDeaS G3, Atomize) |
| Lower rate | Pickup below forecast | Automated with approval threshold |
| Add restrictions | Protect high-demand dates | Semi-automated (MinLOS, CTA) |
| Remove restrictions | Stimulate demand | Automated |

### Open Pricing (Duetto GameChanger Model)

Open pricing moves away from fixed BAR modifiers to allow independent pricing across every dimension:

| Dimension | Traditional BAR | Open Pricing |
|-----------|-----------------|-------------|
| Room type | Fixed differential ($50 upgrade) | Dynamic differential based on room-type demand |
| Channel | Same rate (parity) | Channel-specific pricing optimized by net contribution |
| Segment | % discount off BAR | Independent segment pricing |
| LOS | Fixed rate per night | Dynamic by length of stay |
| Loyalty | Member rate = BAR - 10% | Personalized pricing by member tier and value |

> **Industry Impact**: Hotels using Duetto's RP-OS alongside HotStats saw an average **6.8% increase in GOPPAR** in 2025 and **+7.6% TRevPOR growth** in 6 months.

### Total Revenue Management

Total Revenue Management represents the evolution beyond room-focused optimization:

| Revenue Center | Optimization Approach | Contribution |
|---------------|----------------------|--------------|
| Rooms | Dynamic pricing, inventory controls | 60-75% of total revenue |
| F&B | Menu pricing, event minimums | 15-25% |
| Spa/wellness | Yield-managed appointments | 3-8% |
| Meeting space | Displacement analysis vs. rooms | 5-15% (full-service) |
| Parking | Dynamic by occupancy | 2-5% |
| Ancillary | Upsell, experiences, packages | Growing (>18% at some properties) |

> **Benchmark**: GOPPAR and TRevPAR are the most important benchmarks—33.7% and 17.5% of revenue leaders respectively (Cornell/Kimes study).

### Price Positioning

| Position | RevPAR Goal | Risk |
|----------|-------------|------|
| Rate leader | Maximize ADR | Low occupancy |
| Occupancy leader | Maximize occupancy | Low ADR |
| RevPAR balanced | Optimal RevPAR | Balanced |

## Inventory Controls

### Overbooking Strategy

| Factor | Consideration |
|--------|---------------|
| Historical no-show % | By day of week, segment |
| Cancellation % | By rate type, lead time |
| Walk risk | Cost of relocation |
| Compensation policy | Brand standards |
| Alternate inventory | Nearby properties |

### Overbooking Formula

```
Overbook Level = (No-Show % + Cancel %) × Rooms × Safety Factor
Example: (5% + 8%) × 200 rooms × 0.8 = 21 rooms overbook
```

## Segment Management

### Segment Mix Optimization

| Segment | Typical ADR | Contribution | Flexibility |
|---------|-------------|--------------|-------------|
| Transient | High | Variable | High |
| Corporate | Medium | Stable | Medium |
| Group | Low-Medium | Volume | Low |
| Wholesale | Net rate | Advance commitment | Low |

### Displacement Analysis

| Question | Analysis |
|----------|----------|
| Should we take group? | Compare group contribution vs. displaced transient |
| Right rate? | Estimate transient pickup at higher rate |
| Right dates? | Check pattern (day of week impact) |

## Distribution Channel Strategy

### Channel Costs

| Channel | Typical Cost | Control Level |
|---------|--------------|---------------|
| Direct web | 2-5% | High |
| Voice | $8-15/booking | High |
| GDS | $10-20 + commission | Medium |
| OTA | 15-25% commission | Low |
| Metasearch | CPC + booking engine | Medium |
| Wholesale | Net + margin | Low |

### Channel Value Assessment

| Factor | Consideration |
|--------|---------------|
| Net ADR | Rate minus commission |
| Acquisition cost | New vs. returning guest |
| Ancillary spend | Total guest value |
| Loyalty enrollment | Future value |

## Competitive Intelligence

### Data Sources

| Source | Data Available | Status (2026) |
|--------|----------------|---------------|
| CoStar with STR Benchmark | Weekly/monthly compset performance (94K hotels, 12M rooms) | Industry standard (rebranded from STR) |
| OTA extranets | Competitor rates, availability | Direct access |
| Rate shopping tools (RateGain, OTA Insight) | Real-time rate comparison | Automated daily |
| Demand360 (STR/CoStar) | Forward-looking demand data | Subscription |
| AirGain | Airline booking data as demand proxy | Growing adoption |
| Google Destination Insights | Search demand by destination | Free |
| RMS (IDeaS/Duetto) | System recommendations with market data | Integrated |

### Compset Analysis (CoStar/STR Methodology)

| Metric | Comparison | Formula |
|--------|------------|---------|
| Occupancy Index | Fair share of occupancy | Your OCC ÷ Compset OCC × 100 |
| ARI (ADR Index) | Rate position | Your ADR ÷ Compset ADR × 100 |
| RGI (RevPAR Generation Index) | Overall performance | Your RevPAR ÷ Compset RevPAR × 100 |

Index interpretation:
- **100** = Fair share (performing equally to compset)
- **>100** = Outperforming market (gaining share)
- **<100** = Underperforming market (losing share)

### Revenue Performance Benchmarks (2025)

| Brand | Metric | Performance |
|-------|--------|-------------|
| Marriott International | Q1 2025 global RevPAR growth | +4.1% |
| Hyatt | Q1 2025 comparable RevPAR increase | +5.7% (vs. 3.5% consensus) |
| Industry forecast | 2025 RevPAR growth | +3-4% |

---

[← Back to Rate Management](README.md)
