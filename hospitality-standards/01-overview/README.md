# Domain Overview

## What is a PMS?

A Property Management System (PMS) is the central nervous system of hospitality operations. It orchestrates:

- **Reservations** - Booking lifecycle from inquiry to post-checkout
- **Inventory** - Room availability, rates, and allocation
- **Guest Services** - Check-in/out, requests, preferences
- **Housekeeping** - Room status, task assignment, inspections
- **Billing** - Folios, payments, invoicing
- **Reporting** - Operational and financial analytics

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PROPERTY MANAGEMENT SYSTEM                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │ RESERVATION │  │   FRONT     │  │    RATE     │  │   GUEST     │ │
│  │    MODULE   │  │    DESK     │  │  MANAGEMENT │  │   PROFILE   │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘ │
│         │                │                │                │        │
│  ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐ │
│  │ HOUSEKEEPING│  │   BILLING   │  │  REPORTING  │  │DISTRIBUTION │ │
│  │    MODULE   │  │   & FOLIO   │  │  & ANALYTICS│  │   CHANNELS  │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│  INTEGRATIONS: POS, Door Locks, Payments, CRS, GDS, OTA, Accounting │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Stakeholders

| Stakeholder | Primary Concerns |
|-------------|------------------|
| **Revenue Manager** | Rate optimization, demand forecasting, competitor analysis |
| **Front Desk Agent** | Fast check-in, guest preferences, quick folio access |
| **Housekeeping Supervisor** | Room status, task efficiency, inspection quality |
| **General Manager** | Occupancy, RevPAR, guest satisfaction scores |
| **Night Auditor** | Daily close, report accuracy, discrepancy resolution |
| **Accountant** | Revenue recognition, AR aging, tax compliance |
| **Distribution Manager** | Channel parity, OTA performance, commission tracking |
| **Sales Manager** | Group bookings, corporate accounts, RFP responses |

## Module Dependencies

| Module | Depends On | Provides To |
|--------|-----------|-------------|
| Reservation | Inventory, Rates, Guest Profile | Front Desk, Billing, Housekeeping |
| Front Desk | Reservation, Guest Profile | Billing, Housekeeping |
| Housekeeping | Room Inventory, Front Desk | Front Desk (room status) |
| Billing | Reservation, Front Desk, POS | Accounting, Guest Profile |
| Rates | Inventory | Reservation, Distribution |
| Distribution | Rates, Inventory | Reservation (OTA bookings) |

## Market Context

| Metric | Industry Benchmark (2026) | Source |
|--------|---------------------------|--------|
| Global hotel rooms | ~19 million | STR/CoStar |
| ADR (global average) | $130-160 USD | STR/CoStar |
| Occupancy (global average) | 66-73% | STR/CoStar |
| RevPAR (global average) | $85-115 USD | STR/CoStar |
| Global hotel market value | $785B (2023) → projected $1.13T by 2030 | Cognitive Market Research |
| PMS market size | $9.2B, growing 8% CAGR | IDC MarketScape 2025 |
| RMS market size | $1.2B (2024) → projected $3.4B by 2033 (12.3% CAGR) | Verified Market Reports |
| Hotels using RMS | 83.9% (up from 82.3% in 2023) | Duetto Survey 2024 |
| AI investment in pricing | > $1B/year industry-wide | Skift Research |

## Industry Trends (2025-2026)

| Trend | Impact | Key Players |
|-------|--------|-------------|
| **AI-powered revenue management** | ML models cut forecast error by up to 54%; AI-powered RMS yields 15% revenue increase | IDeaS G3, Duetto GameChanger, Atomize |
| **Open Pricing** | Replaces fixed BAR modifiers; independent pricing per segment/channel/room type | Duetto RP-OS, IDeaS |
| **Total Revenue Management** | Beyond RevPAR to TRevPAR/GOPPAR; optimizes all revenue streams (F&B, spa, events) | Oracle OPERA, Duetto HotStats |
| **Cloud-native PMS** | OPERA Cloud named Leader in IDC MarketScape 2025; mobile-first operations | Oracle OPERA Cloud (Release 26.1) |
| **Sustainability premium** | 78% of guests prefer eco-friendly stays; enables premium pricing | Industry-wide |
| **Mobile guest journey** | Pre-arrival engagement, digital key, mobile checkout, Nor1 upsell integration | Oracle Mobile Guest Experience |
| **Profit optimization** | Shift from revenue to profit focus; GOPPAR as primary metric | Duetto + HotStats (6.8% GOPPAR increase) |

## Related Documents

- [Property Types](property-types.md) - Lodging categories and classifications
- [Glossary](glossary.md) - Industry terminology
