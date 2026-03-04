# Booking Sources

## Distribution Channel Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                    DISTRIBUTION ECOSYSTEM                             │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  DIRECT CHANNELS (0% commission)                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                   │
│  │  Brand.com  │  │  Voice/CRO  │  │   Walk-in   │                   │
│  │   Booking   │  │  Call Center│  │             │                   │
│  │   Engine    │  │             │  │             │                   │
│  └─────────────┘  └─────────────┘  └─────────────┘                   │
│                                                                       │
│  INDIRECT CHANNELS (10-30% commission)                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                   │
│  │    OTAs     │  │     GDS     │  │  Metasearch │                   │
│  │ Booking.com │  │   Amadeus   │  │   Google    │                   │
│  │   Expedia   │  │    Sabre    │  │  Trivago    │                   │
│  │   Airbnb    │  │Travelport   │  │  Kayak      │                   │
│  └─────────────┘  └─────────────┘  └─────────────┘                   │
│                                                                       │
│  WHOLESALE (Volume discounts, typically -20-40%)                     │
│  ┌─────────────┐  ┌─────────────┐                                    │
│  │Tour Operator│  │    DMC      │                                    │
│  │  Hotelbeds  │  │  WebBeds    │                                    │
│  └─────────────┘  └─────────────┘                                    │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

## Source Codes

| Source | Code | Commission | Integration |
|--------|------|------------|-------------|
| **Direct Website** | WEB | 0% (2-5% payment processing) | Booking Engine |
| **Voice/Phone** | PHN | 0% ($8-15/booking labor) | PMS Direct Entry |
| **Walk-in** | WLK | 0% | PMS Direct Entry |
| **Email** | EML | 0% | PMS Direct Entry |
| **Mobile App** | APP | 0% | Direct Booking Engine |
| **Booking.com** | BDC | 15-18% | Channel Manager |
| **Expedia** | EXP | 15-25% | Channel Manager |
| **Hotels.com** | HOT | 15-25% (Expedia Group) | Channel Manager |
| **Airbnb** | ABB | 3-5% host (15% split model available) | Channel Manager |
| **Agoda** | AGO | 15-22% (Booking Holdings) | Channel Manager |
| **Trip.com** | TRP | 15-20% | Channel Manager |
| **Sabre GDS** | SAB | $10-20 + travel agent commission | GDS Interface |
| **Amadeus GDS** | AMA | $10-20 + travel agent commission | GDS Interface |
| **Travelport** | TVL | $10-20 + travel agent commission | GDS Interface |
| **Google Hotels** | GGL | CPC/CPA model (Free Booking Links also available) | Direct Link / Metasearch |
| **TripAdvisor** | TRA | CPC/CPA | Metasearch |
| **Travel Agent** | TAG | 10% | Manual/GDS |
| **Tour Operator** | TOR | Net rate (-20-40%) | Wholesaler API |
| **Corporate Direct** | CPD | Negotiated | Direct/GDS |
| **Wholesaler/Bedbank** | WHL | Net rate (-20-30% margin) | Hotelbeds/WebBeds API |

## OTA Payment Models

| Model | Description | Cash Flow |
|-------|-------------|-----------|
| **Merchant** | OTA collects, remits to hotel | Hotel receives net |
| **Agency** | Guest pays hotel directly | Hotel pays commission |
| **Virtual Card** | OTA sends payment card | Hotel charges card |

## Commission Tracking

| Channel | Rate | When Paid | Reconciliation |
|---------|------|-----------|----------------|
| Booking.com | 15-18% | Monthly | Virtual card at checkout |
| Expedia Collect | 15-25% | Net 30 | Invoice |
| Expedia Pay | 15-25% | At booking | Virtual card |
| Travel Agent | 10% | Net 30 | Commission check |
| GDS | 10-15% | Monthly | Central billing |

## Booking Source KPIs

| Metric | Calculation | Target (2026) |
|--------|-------------|--------|
| Direct booking % | Direct revenue / Total revenue | > 50% (industry avg rising) |
| OTA contribution | OTA revenue / Total revenue | < 30% |
| Cost of acquisition | Commission + marketing / Room revenue | < 15% |
| Net ADR by channel | ADR - commissions - transaction fees | Maximize across channels |
| Channel mix | Revenue by source | Diverse, direct-weighted |
| NRevPAR | Net Revenue / Available Rooms | Track after commissions |

## Distribution Cost Benchmarks (2025-2026)

Since 2019, global RevPAR has grown 19% while booking costs per available room surged 25% (Duetto/HotStats). This widening gap makes channel cost optimization critical.

| Channel | Total Cost to Hotel | Strategic Role |
|---------|---------------------|----------------|
| Direct web | 2-5% (payment only) | Highest margin, maximize share |
| Brand.com (chains) | 5-10% (reservation fee) | Direct channel for chains |
| Voice/CRO | $8-15/booking | High-touch, conversion-strong |
| GDS | $10-20 + 10% commission | Corporate travel essential |
| OTA (merchant) | 15-25% | Demand generation, visibility |
| Metasearch (CPC) | 5-12% effective cost | Lower cost than OTA |
| Wholesale/bedbank | Net rate (20-30% margin) | Volume fill, opaque |

---

[← Back to Reservations](README.md)
