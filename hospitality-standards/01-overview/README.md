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

| Metric | Industry Benchmark (2025) |
|--------|---------------------------|
| Global hotel rooms | ~18.5 million |
| ADR (global average) | $120-150 USD |
| Occupancy (global average) | 65-72% |
| RevPAR (global average) | $80-110 USD |
| PMS market size | $8.5B, growing 8% CAGR |

## Related Documents

- [Property Types](property-types.md) - Lodging categories and classifications
- [Glossary](glossary.md) - Industry terminology
