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
| **Direct Website** | WEB | 0% | Booking Engine |
| **Voice/Phone** | PHN | 0% | PMS Direct Entry |
| **Walk-in** | WLK | 0% | PMS Direct Entry |
| **Email** | EML | 0% | PMS Direct Entry |
| **Booking.com** | BDC | 15-18% | Channel Manager |
| **Expedia** | EXP | 15-25% | Channel Manager |
| **Hotels.com** | HOT | 15-25% | Channel Manager |
| **Airbnb** | ABB | 3-5% host | Channel Manager |
| **Sabre GDS** | SAB | 10-15% | GDS Interface |
| **Amadeus GDS** | AMA | 10-15% | GDS Interface |
| **Travelport** | TVL | 10-15% | GDS Interface |
| **Google Hotels** | GGL | CPC model | Direct Link |
| **TripAdvisor** | TRA | CPC/CPA | Metasearch |
| **Travel Agent** | TAG | 10% | Manual/GDS |
| **Tour Operator** | TOR | Net rate (-20-40%) | Wholesaler API |
| **Corporate Direct** | CPD | Negotiated | Direct/GDS |

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

| Metric | Calculation | Target |
|--------|-------------|--------|
| Direct booking % | Direct revenue / Total revenue | > 50% |
| OTA contribution | OTA revenue / Total revenue | < 30% |
| Cost of acquisition | Commission / Room revenue | < 15% |
| Channel mix | Revenue by source | Diverse |

---

[← Back to Reservations](README.md)
