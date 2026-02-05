# Property Management System (PMS) Industry Standards

## Purpose

This document serves as a comprehensive reference for AI systems, developers, and architects implementing or maintaining Property Management Systems (PMS). It codifies industry standards, best practices, domain terminology, and compliance requirements across the hospitality sector.

---

## Table of Contents

1. [Domain Overview](#1-domain-overview)
2. [Property Types & Classifications](#2-property-types--classifications)
3. [Core Functional Modules](#3-core-functional-modules)
4. [Reservation Lifecycle](#4-reservation-lifecycle)
5. [Room & Inventory Management](#5-room--inventory-management)
6. [Rate & Revenue Management](#6-rate--revenue-management)
7. [Front Desk Operations](#7-front-desk-operations)
8. [Housekeeping Operations](#8-housekeeping-operations)
9. [Guest Profile Management](#9-guest-profile-management)
10. [Financial Operations](#10-financial-operations)
11. [Distribution & Channel Management](#11-distribution--channel-management)
12. [Integration Protocols](#12-integration-protocols)
13. [Reporting & Analytics](#13-reporting--analytics)
14. [Security & Compliance](#14-security--compliance)
15. [Performance Benchmarks](#15-performance-benchmarks)
16. [Glossary](#16-glossary)

---

## 1. Domain Overview

### 1.1 What is a PMS?

A Property Management System (PMS) is the central nervous system of hospitality operations. It manages:

- **Reservations**: Booking lifecycle from inquiry to post-checkout
- **Inventory**: Room availability, rates, and allocation
- **Guest Services**: Check-in/out, requests, preferences
- **Housekeeping**: Room status, task assignment, inspections
- **Billing**: Folios, payments, invoicing
- **Reporting**: Operational and financial analytics

### 1.2 Industry Context

| Metric | Industry Benchmark |
|--------|-------------------|
| Global hotel rooms | ~18.5 million (2025) |
| ADR (global average) | $120-150 USD |
| Occupancy (global average) | 65-72% |
| RevPAR (global average) | $80-110 USD |
| PMS market size | $8.5B (2025), growing 8% CAGR |

### 1.3 Key Stakeholders

| Stakeholder | Primary Concerns |
|-------------|------------------|
| Revenue Manager | Rate optimization, demand forecasting, competitor analysis |
| Front Desk Agent | Fast check-in, guest preferences, quick folio access |
| Housekeeping Supervisor | Room status, task efficiency, inspection quality |
| General Manager | Occupancy, RevPAR, guest satisfaction |
| Night Auditor | Daily close, report accuracy, discrepancy resolution |
| Accountant | Revenue recognition, AR aging, tax compliance |
| Distribution Manager | Channel parity, OTA performance, commission tracking |

---

## 2. Property Types & Classifications

### 2.1 Lodging Categories

| Category | Characteristics | PMS Requirements |
|----------|-----------------|------------------|
| **Full-Service Hotel** | 100-1000+ rooms, F&B, banquets, spa, concierge | Complex folio routing, group management, POS integration |
| **Limited-Service Hotel** | 50-200 rooms, minimal F&B, self-service | Streamlined check-in, automated housekeeping |
| **Boutique Hotel** | 10-100 rooms, unique design, personalized service | Guest preference tracking, flexible rate structures |
| **Resort** | Destination property, multiple outlets, activities | Package management, activity booking, multi-currency |
| **Vacation Rental** | Individual units, owner management | Owner statements, split revenue, dynamic pricing |
| **Hostel** | Dormitory beds, shared facilities | Bed-level inventory, per-person pricing |
| **Extended Stay** | Weekly/monthly rates, kitchenettes | Long-stay rate plans, utility billing |
| **Casino Hotel** | Gaming, comps, player tracking | Comp management, player rating integration |

### 2.2 Star Rating Systems

| System | Region | Levels |
|--------|--------|--------|
| AAA Diamond | USA/Canada | 1-5 Diamonds |
| Forbes Travel Guide | Global | 4-5 Stars, Recommended |
| Hotelstars Union | Europe | 1-5 Stars + Superior |
| STR Classifications | Global | Luxury, Upper Upscale, Upscale, Upper Midscale, Midscale, Economy |

### 2.3 Chain Scales (STR)

```
Luxury         → ADR > $250  (Ritz-Carlton, Four Seasons)
Upper Upscale  → ADR $175-250 (Marriott, Hyatt)
Upscale        → ADR $125-175 (Hilton Garden Inn, Courtyard)
Upper Midscale → ADR $90-125  (Holiday Inn, Hampton)
Midscale       → ADR $60-90   (Best Western, Wyndham)
Economy        → ADR < $60    (Motel 6, Super 8)
```

---

## 3. Core Functional Modules

### 3.1 Module Hierarchy

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

### 3.2 Module Dependencies

| Module | Depends On | Provides To |
|--------|-----------|-------------|
| Reservation | Inventory, Rates, Guest Profile | Front Desk, Billing, Housekeeping |
| Front Desk | Reservation, Guest Profile | Billing, Housekeeping |
| Housekeeping | Room Inventory, Front Desk | Front Desk (room status) |
| Billing | Reservation, Front Desk, POS | Accounting, Guest Profile |
| Rates | Inventory | Reservation, Distribution |
| Distribution | Rates, Inventory | Reservation (OTA bookings) |

---

## 4. Reservation Lifecycle

### 4.1 Reservation States

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

### 4.2 Reservation Types

| Type | Code | Description |
|------|------|-------------|
| Transient | TRA | Individual guest bookings |
| Corporate | COR | Company rate negotiated bookings |
| Group | GRP | 10+ rooms, common arrival, shared billing |
| Wholesale | WHL | Tour operator pre-purchased inventory |
| Package | PKG | Room + services bundled |
| Comp | CMP | Complimentary stay |
| House Use | HSE | Internal use (staff, maintenance) |
| Day Use | DAY | Same-day check-in/out (hourly) |
| Waitlist | WTL | Pending availability confirmation |

### 4.3 Booking Sources

| Source | Commission | Integration |
|--------|------------|-------------|
| Direct Website | 0% | Booking Engine |
| Voice/Phone | 0% | PMS Direct Entry |
| Walk-in | 0% | PMS Direct Entry |
| GDS (Sabre, Amadeus) | 10-15% | HTNG/OTA XML |
| OTA (Booking.com) | 15-25% | Channel Manager |
| OTA (Expedia) | 15-25% | Channel Manager |
| Metasearch (Google) | CPC model | Direct Link |
| Travel Agent | 10% | GDS or Email |
| Corporate RFP | Negotiated | CRS Integration |

### 4.4 Confirmation Number Standards

| Format | Example | Use Case |
|--------|---------|----------|
| Sequential | 100001, 100002 | Simple properties |
| Date-based | 20260205-001 | Multi-property chains |
| Alphanumeric | R-A3B7X9 | Uniqueness across systems |
| Channel-prefixed | BDC-123456 | Source identification |

---

## 5. Room & Inventory Management

### 5.1 Room Status Codes

| Status | Code | Description | Next Valid States |
|--------|------|-------------|-------------------|
| **Vacant Clean** | VC | Ready for sale | OCC, OOO, OOS |
| **Vacant Dirty** | VD | Needs cleaning | VC (after cleaning) |
| **Occupied Clean** | OC | Guest in-house, serviced | OD (after use), VD (checkout) |
| **Occupied Dirty** | OD | Guest in-house, needs service | OC (after cleaning) |
| **Out of Order** | OOO | Maintenance required | VC/VD (after repair) |
| **Out of Service** | OOS | Temporarily unavailable | VC/VD (when released) |
| **Inspected** | INS | QC passed, ready for VIP | VC |
| **On Change** | CHG | Checkout in progress | VD |
| **Do Not Disturb** | DND | Guest declined service | OD |
| **Sleep Out** | SO | Guest checked in but did not use room overnight | OD, VD |

### 5.2 Room Type Hierarchy

```
Property
  └── Building/Tower
        └── Floor/Section
              └── Room Type
                    └── Room Number
                          └── Bed Configuration
```

### 5.3 Room Type Attributes

| Attribute | Values | Description |
|-----------|--------|-------------|
| Category | Standard, Superior, Deluxe, Suite, Villa | Quality tier |
| View | Ocean, City, Garden, Pool, Mountain | Window orientation |
| Bedding | King, 2 Queen, Twin, Sofa Bed | Sleep configuration |
| Smoking | Non-Smoking, Smoking, Designated | Guest preference |
| Accessibility | ADA, Wheelchair, Hearing, Visual | Compliance features |
| Floor | Low, Mid, High, Executive, Club | Location preference |
| Connecting | Yes/No | Adjoining room capability |

### 5.4 Inventory Allocation

| Allocation Type | Description | Use Case |
|-----------------|-------------|----------|
| **House** | General pool, first-come | Default inventory |
| **Allotment** | Pre-blocked for group/contract | Tour operators, corporates |
| **Tentative** | Held pending confirmation | Groups, RFPs |
| **Definite** | Contracted, guaranteed | Confirmed groups |
| **Cutoff** | Release date for unsold blocks | 14-30 days prior |
| **Overbooking** | Sell beyond physical inventory | Anticipate no-shows |

### 5.5 Overbooking Guidelines

| Property Type | Acceptable Overbook % | Risk Mitigation |
|---------------|----------------------|-----------------|
| Urban business | 5-10% | Walk agreements with nearby hotels |
| Resort | 2-5% | Lower due to destination travel |
| Airport | 8-15% | High no-show rate |
| Convention | 3-5% | Group attrition buffers |

---

## 6. Rate & Revenue Management

### 6.1 Rate Structure Hierarchy

```
┌─────────────────────────────────────────────────────────────────────┐
│                      RATE STRUCTURE                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌───────────────┐                                                   │
│  │  RATE PLAN    │ ─── Collection of rates by market segment        │
│  └───────┬───────┘                                                   │
│          │                                                           │
│          ▼                                                           │
│  ┌───────────────┐                                                   │
│  │   RATE CODE   │ ─── Specific pricing rules (BAR, AAA, GOV)       │
│  └───────┬───────┘                                                   │
│          │                                                           │
│          ▼                                                           │
│  ┌───────────────┐                                                   │
│  │  ROOM TYPE    │ ─── Price varies by room category                │
│  └───────┬───────┘                                                   │
│          │                                                           │
│          ▼                                                           │
│  ┌───────────────┐                                                   │
│  │   DATE RANGE  │ ─── Seasonal, event-based variations             │
│  └───────┬───────┘                                                   │
│          │                                                           │
│          ▼                                                           │
│  ┌───────────────┐                                                   │
│  │  LENGTH OF    │ ─── Discounts for extended stays                 │
│  │    STAY       │                                                   │
│  └───────────────┘                                                   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 Rate Code Types

| Code | Name | Description | Typical Discount |
|------|------|-------------|------------------|
| BAR | Best Available Rate | Dynamic, publicly bookable | Benchmark |
| RACK | Rack Rate | Published maximum rate | 0% |
| AAA | Auto Association | Membership discount | 10-15% |
| AARP | Senior Rate | Age-qualified discount | 10-15% |
| GOV | Government | GSA/per diem compliant | 20-30% |
| MIL | Military | Active/veteran discount | 10-20% |
| COR | Corporate | Negotiated company rate | 15-30% |
| PKG | Package | Room + breakfast/parking | Bundled value |
| PROMO | Promotional | Limited-time offer | 20-40% |
| ADV | Advance Purchase | Non-refundable, pay now | 15-25% |
| LRA | Last Room Available | Sell at any occupancy | BAR or higher |

### 6.3 Rate Restrictions

| Restriction | Code | Description |
|-------------|------|-------------|
| Minimum Length of Stay | MLOS | Must book 2+ nights |
| Maximum Length of Stay | MAXLOS | Cannot exceed N nights |
| Closed to Arrival | CTA | No arrivals on this date |
| Closed to Departure | CTD | No departures on this date |
| Full Pattern Length of Stay | FPLOS | Must stay entire pattern |
| Advance Booking Required | ABR | Book N days ahead |
| Stay Through | ST | Must include weekend night |

### 6.4 Revenue Management KPIs

| KPI | Formula | Target |
|-----|---------|--------|
| **Occupancy** | Rooms Sold / Rooms Available | 70-85% |
| **ADR** | Room Revenue / Rooms Sold | Market dependent |
| **RevPAR** | Room Revenue / Rooms Available | ADR × Occupancy |
| **TRevPAR** | Total Revenue / Rooms Available | RevPAR + ancillary |
| **GOPPAR** | Gross Operating Profit / Available Room | Profitability |
| **Booking Pace** | Reservations on books vs. same time last year | Demand indicator |
| **Pickup** | New bookings for future dates | Forecast accuracy |
| **Regret/Denial** | Requests declined due to sellout | Demand measurement |

### 6.5 Dynamic Pricing Strategies

| Strategy | Trigger | Action |
|----------|---------|--------|
| Demand-based | Occupancy > 80% | Raise BAR 10-20% |
| Demand-based | Occupancy < 50% | Lower BAR 10-15% |
| Competitor-based | Compset ADR higher | Raise to match |
| Length-of-stay | Filling gaps | Discount for MLOS=2 |
| Day-of-week | Weekend demand | Premium Fri/Sat |
| Event-based | Concert, convention | 50-200% premium |
| Last-minute | <24 hours to arrival | Flash sale or yield up |

### 6.6 Cancellation Policies

| Policy Type | Deadline | Penalty |
|-------------|----------|---------|
| Flexible | Day of arrival | No charge |
| Moderate | 72 hours | 1 night charge |
| Strict | 7 days | Full stay charge |
| Non-refundable | At booking | 100% prepaid |
| Group | 30-90 days | Sliding scale (attrition) |

---

## 7. Front Desk Operations

### 7.1 Check-in Process Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                     GUEST CHECK-IN WORKFLOW                           │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  1. ARRIVAL          2. VERIFICATION       3. ROOM ASSIGNMENT         │
│  ┌─────────────┐     ┌─────────────┐       ┌─────────────┐           │
│  │ Locate      │     │ Verify ID   │       │ Confirm     │           │
│  │ Reservation │ ──► │ Confirm     │ ───►  │ Room Type   │           │
│  │             │     │ Stay Dates  │       │ Assign Room │           │
│  └─────────────┘     └─────────────┘       └──────┬──────┘           │
│                                                    │                  │
│  4. PAYMENT          5. KEY ISSUANCE       6. ORIENTATION             │
│  ┌─────────────┐     ┌─────────────┐       ┌─────────────┐           │
│  │ Collect     │     │ Program     │       │ Explain     │           │
│  │ Guarantee   │ ◄── │ Room Key    │ ◄──── │ Amenities   │           │
│  │ Authorize   │     │ Test Key    │       │ WiFi, Hours │           │
│  └─────────────┘     └─────────────┘       └─────────────┘           │
│                                                                       │
│  TARGET: Complete check-in in < 3 minutes                            │
└──────────────────────────────────────────────────────────────────────┘
```

### 7.2 Check-in Requirements by Market

| Market Segment | ID Required | Payment | Registration Card |
|----------------|-------------|---------|-------------------|
| Transient | Government ID | Credit card auth | Signed |
| Corporate | Company ID acceptable | Direct bill possible | Signed |
| Group | ID + rooming list | Master bill or individual | Batch or individual |
| OTA Prepaid | ID | None (prepaid) | Signed |
| Walk-in | Government ID | Full prepay | Signed |
| International | Passport | Credit card | Police report (some countries) |

### 7.3 Check-out Process

| Step | Action | System Update |
|------|--------|---------------|
| 1 | Review folio charges | Display balance |
| 2 | Verify minibar | Post charges if needed |
| 3 | Collect payment | Post payment, close folio |
| 4 | Deactivate keys | Key system integration |
| 5 | Update room status | Set to VD (Vacant Dirty) |
| 6 | Email folio copy | Guest communication |

### 7.4 Express Check-out

| Method | Implementation |
|--------|---------------|
| Key drop | Guest leaves key, charges to card on file |
| Kiosk | Self-service folio review and payment |
| Mobile | App-based checkout, digital key deactivation |
| Auto-checkout | System-triggered at scheduled departure |

### 7.5 Room Move Scenarios

| Scenario | Action | Folio Impact |
|----------|--------|--------------|
| Guest request | Assign new room, update housekeeping | Transfer charges |
| Maintenance issue | Emergency move, comp gesture | Possible adjustment |
| Upgrade (courtesy) | Better room, same rate | Log upgrade reason |
| Upgrade (paid) | Better room, charge difference | Post upgrade charge |
| Downgrade | Guest-requested or oversell | Rate adjustment, comp |

---

## 8. Housekeeping Operations

### 8.1 Room Cleaning Workflow

```
┌──────────────────────────────────────────────────────────────────────┐
│                   HOUSEKEEPING TASK FLOW                              │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐          │
│  │   VD     │──►│ ASSIGNED │──►│INPROGRESS│──►│   DONE   │          │
│  │(Dirty)   │   │(To Staff)│   │(Cleaning)│   │(Complete)│          │
│  └──────────┘   └──────────┘   └──────────┘   └────┬─────┘          │
│                                                     │                 │
│                                                     ▼                 │
│                                              ┌──────────┐             │
│                                              │INSPECTED │─► VC        │
│                                              │ (QC Pass)│   (Ready)   │
│                                              └──────────┘             │
│                                                                       │
│  Time Standards:                                                      │
│  - Checkout room: 25-35 minutes                                      │
│  - Stayover room: 15-20 minutes                                      │
│  - Turn-down: 5-10 minutes                                           │
│  - Deep clean: 45-60 minutes                                         │
└──────────────────────────────────────────────────────────────────────┘
```

### 8.2 Task Types

| Task | Trigger | Priority |
|------|---------|----------|
| Checkout Clean | Guest departed | High |
| Stayover Service | Occupied, daily | Medium |
| Turn-down | Evening service | Scheduled |
| Deep Clean | Periodic or extended stay | Low |
| Rush/VIP | Early arrival or VIP | Urgent |
| Inspection | Post-cleaning QC | Scheduled |

### 8.3 Room Priority Assignment

| Factor | Weight | Description |
|--------|--------|-------------|
| VIP arriving | Highest | C-suite, loyalty elite |
| Early check-in | High | Requested or paid |
| Checkout → Same-day arrival | High | Room turnover pressure |
| Stayover | Medium | Scheduled service |
| Late departure | Low | Service after checkout |
| Do Not Disturb | Skip | Guest declined |

### 8.4 Housekeeping Staffing Standards

| Metric | Industry Standard |
|--------|-------------------|
| Rooms per attendant per shift | 14-18 rooms |
| Square feet per hour | 1,500-2,000 sq ft |
| Turn-time (checkout) | 25-35 minutes |
| Supervisor inspection rate | 100% checkouts, 20% stayovers |

### 8.5 Minibar Management

| Model | Description |
|-------|-------------|
| Manual check | Attendant inventory during service |
| Honor bar | Guest self-reports consumption |
| Automated sensor | Smart fridge tracks removal |
| Pre-stock by segment | VIP gets full stock, others on-request |

---

## 9. Guest Profile Management

### 9.1 Profile Data Elements

| Category | Fields | Purpose |
|----------|--------|---------|
| **Identity** | Name, DOB, gender, nationality | Identification |
| **Contact** | Email, phone, address | Communication |
| **Documents** | Passport, driver license, ID | Verification |
| **Preferences** | Room type, floor, pillow, newspaper | Personalization |
| **Allergies** | Food, fragrance, pets | Safety |
| **Loyalty** | Program, tier, points balance | Recognition |
| **Payment** | Cards on file, billing address | Transaction |
| **History** | Past stays, spend, issues | Service recovery |
| **Consent** | Marketing opt-in, data preferences | Compliance |

### 9.2 Loyalty Program Tiers

| Tier | Typical Requirements | Benefits |
|------|---------------------|----------|
| Base/Member | Sign up | Member rate, points earning |
| Silver | 10-20 nights/year | Early check-in, late checkout |
| Gold | 25-50 nights/year | Room upgrade, bonus points |
| Platinum | 50-75 nights/year | Suite upgrade, lounge access |
| Elite/Ambassador | 75+ nights/year | Guaranteed availability, personal host |

### 9.3 VIP Codes

| Code | Meaning | Service Level |
|------|---------|---------------|
| VIP1 | Return guest | Welcome note |
| VIP2 | Frequent guest | Fruit basket |
| VIP3 | Corporate executive | Wine + upgrade |
| VIP4 | Celebrity/dignitary | Suite, dedicated staff |
| VIP5 | Owner/investor | Maximum comps |
| VVIP | Head of state | Security protocols |

### 9.4 Guest Communication Triggers

| Event | Communication | Timing |
|-------|---------------|--------|
| Booking confirmed | Confirmation email | Immediate |
| Pre-arrival | Upsell, info request | 3-7 days before |
| Day of arrival | Welcome, directions | Morning of |
| In-house | Service offers | Based on stay |
| Checkout | Folio, thank you | At departure |
| Post-stay | Review request, loyalty | 1-3 days after |
| Anniversary | Special offer | Annual |

---

## 10. Financial Operations

### 10.1 Folio Structure

```
┌──────────────────────────────────────────────────────────────────────┐
│                         GUEST FOLIO                                   │
├──────────────────────────────────────────────────────────────────────┤
│  Guest: John Smith                    Reservation: R-2026050501      │
│  Room: 412 (King Deluxe)              Arrival: Feb 5, 2026           │
│  Rate: $189.00 BAR                    Departure: Feb 7, 2026         │
├──────────────────────────────────────────────────────────────────────┤
│  DATE       DESCRIPTION                    DEBIT      CREDIT         │
│  ─────────────────────────────────────────────────────────────────   │
│  02/05      Room Charge                   $189.00                    │
│  02/05      State Tax (12%)                $22.68                    │
│  02/05      City Tax ($3.50/night)          $3.50                    │
│  02/05      Restaurant - Dinner            $47.50                    │
│  02/05      Payment: Visa ****4242                     $100.00       │
│  02/06      Room Charge                   $189.00                    │
│  02/06      State Tax (12%)                $22.68                    │
│  02/06      City Tax ($3.50/night)          $3.50                    │
│  02/06      Spa - Massage                  $95.00                    │
│  02/06      Minibar                        $12.00                    │
│  ─────────────────────────────────────────────────────────────────   │
│  TOTAL                                    $584.86       $100.00      │
│  BALANCE DUE                              $484.86                    │
└──────────────────────────────────────────────────────────────────────┘
```

### 10.2 Transaction Types

| Type | Code | Description |
|------|------|-------------|
| Room Charge | RM | Nightly rate posting |
| Tax | TX | Applicable taxes |
| Food & Beverage | FB | Restaurant, bar, room service |
| Telephone | PH | Call charges |
| Internet | IN | WiFi, business center |
| Parking | PK | Valet, self-park |
| Spa | SP | Treatments, salon |
| Retail | RT | Gift shop, sundries |
| Laundry | LA | Dry cleaning, pressing |
| Minibar | MB | In-room consumption |
| Miscellaneous | MS | Other charges |
| Payment | PY | Guest payment |
| Adjustment | AD | Corrections, comps |
| Deposit | DP | Advance payment |
| Refund | RF | Returned payment |

### 10.3 Payment Methods

| Method | Processing | Settlement |
|--------|------------|------------|
| Credit Card | Auth at check-in, capture at checkout | 1-3 days |
| Debit Card | Pre-authorization hold | Immediate |
| Cash | At desk | Immediate |
| Direct Bill | Invoice to company | Net 30 |
| Travel Agent Voucher | Prepaid by agency | Per agreement |
| Gift Card | Property-issued | Immediate |
| Mobile Wallet | Apple Pay, Google Pay | 1-3 days |
| Cryptocurrency | Via processor | Varies |

### 10.4 Night Audit Process

| Step | Description | Typical Time |
|------|-------------|--------------|
| 1. Close Day | Lock current business date | 12:00-2:00 AM |
| 2. Post Room & Tax | Auto-post all in-house | Automatic |
| 3. Verify Arrivals | Check expected vs. actual | Manual review |
| 4. Handle No-Shows | Process per cancellation policy | Per policy |
| 5. Reconcile Payments | Match settlements to postings | Verification |
| 6. Run Reports | Daily revenue, occupancy, etc. | Automatic |
| 7. Backup | Database and transaction backup | Automatic |
| 8. Roll Date | Advance business date | System |
| 9. Update Channels | Send availability to OTAs | Automatic |

### 10.5 Accounts Receivable

| AR Type | Description | Typical Terms |
|---------|-------------|---------------|
| Corporate | Company direct bill | Net 30 |
| Travel Agent | Commission owed | Net 30 |
| Group Master | Event billing | Per contract |
| OTA | Virtual card or direct | Per agreement |
| City Ledger | Legacy unresolved balances | Collection |

---

## 11. Distribution & Channel Management

### 11.1 Distribution Channels

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

### 11.2 Channel Manager Functions

| Function | Description |
|----------|-------------|
| **ARI Push** | Availability, Rates, Inventory updates |
| **Reservation Pull** | Retrieve bookings from channels |
| **Modification Sync** | Update/cancel across channels |
| **Rate Parity** | Ensure consistent pricing |
| **Content Sync** | Photos, descriptions, amenities |
| **Review Aggregation** | Collect ratings from all channels |

### 11.3 OTA Integration Requirements

| Element | Booking.com | Expedia | Airbnb |
|---------|-------------|---------|--------|
| API Protocol | OTA/XML | EPC API | Airbnb API |
| Rate Types | All standard | Net rates + retail | Nightly |
| Availability | Real-time | Real-time | Real-time |
| Payment | Virtual card or guest pays | Expedia collect or hotel | Platform collect |
| Cancellation | Property policy | Property policy | Strict/Flexible |
| Commission | 15-18% | 15-25% (varies) | 3-5% host |
| Content Sync | Yes | Yes | Yes |

### 11.4 Rate Parity Considerations

| Scenario | Best Practice |
|----------|---------------|
| OTA rate lower than direct | Investigate, enforce agreement |
| Member-only rate on brand.com | Permitted (loyalty bonus) |
| Package rate difference | Acceptable if service differs |
| Opaque rate (Hotwire) | Discounted but non-branded |
| Wholesale rate leakage | Monitor B2B partners |

### 11.5 GDS Connectivity

| GDS | Region Strength | Chain Code Format |
|-----|-----------------|-------------------|
| Amadeus | Europe, Asia | 2-letter: BW, HI, MC |
| Sabre | Americas | Same |
| Travelport (Apollo/Galileo) | Americas, UK | Same |
| Abacus | Asia-Pacific | Same |

---

## 12. Integration Protocols

### 12.1 Standard Protocols

| Protocol | Use Case | Description |
|----------|----------|-------------|
| **HTNG** | Industry standard | Hotel Technology Next Generation XML |
| **OTA XML** | Channel distribution | OpenTravel Alliance messaging |
| **HAPI** | Future standard | Hospitality API (GraphQL-based) |
| **EDI** | Corporate booking tools | Electronic Data Interchange |
| **FIAS/FIDELIO** | Door locks, POS | Legacy Oracle interface |
| **PCI DSS** | Payment | Card data security |

### 12.2 Common Integration Points

| System | Integration Type | Data Exchange |
|--------|------------------|---------------|
| **Booking Engine** | Real-time | Availability, rates, reservations |
| **Channel Manager** | Real-time | ARI, bookings, modifications |
| **Payment Gateway** | Real-time | Authorizations, captures, refunds |
| **Door Lock** | Real-time | Key encoding, access control |
| **POS** | Real-time | Charges to folio |
| **Accounting** | Batch | Daily revenue, AP/AR |
| **CRM** | Batch/Real-time | Guest profiles, interactions |
| **Revenue Management** | Batch | Rates, restrictions, recommendations |
| **Housekeeping Mobile** | Real-time | Room status, tasks |
| **Business Intelligence** | Batch | Historical data export |

### 12.3 API Standards

| Aspect | Best Practice |
|--------|---------------|
| Authentication | OAuth 2.0 with JWT |
| Rate Limiting | 1000 req/min per client |
| Versioning | URI path (/v1/) or header |
| Response Format | JSON with consistent schema |
| Error Handling | RFC 7807 Problem Details |
| Pagination | Cursor-based for large datasets |
| Idempotency | Require idempotency keys for writes |

### 12.4 Webhook Events

| Event | Trigger | Consumers |
|-------|---------|-----------|
| `reservation.created` | New booking | CRM, Email, Revenue |
| `reservation.modified` | Change to booking | Channel Manager, Housekeeping |
| `reservation.canceled` | Cancellation | Channels, Revenue, CRM |
| `guest.checkedIn` | Check-in completed | Housekeeping, F&B, Marketing |
| `guest.checkedOut` | Check-out completed | Housekeeping, Billing, CRM |
| `room.statusChanged` | Housekeeping update | Front Desk, Maintenance |
| `payment.processed` | Transaction complete | Accounting, Fraud detection |

---

## 13. Reporting & Analytics

### 13.1 Operational Reports (Daily)

| Report | Purpose | Key Metrics |
|--------|---------|-------------|
| **Manager's Report** | Daily overview | Occupancy, ADR, RevPAR |
| **Arrivals List** | Expected check-ins | Guest names, room assignments |
| **Departures List** | Expected check-outs | Guest names, balance due |
| **In-House Guest List** | Current occupancy | Room, rate, departure date |
| **Room Status Report** | Housekeeping priority | VD, OOO, expected arrivals |
| **No-Show Report** | Missed arrivals | Guests, penalty applied |
| **Late Checkout Report** | Extended stays | Guest, new departure time |
| **VIP Report** | Special guests today | VIP code, preferences |
| **Group Resume** | Event overview | Rooms, events, billing |
| **Cashier Report** | Shift reconciliation | Payments by type |

### 13.2 Financial Reports

| Report | Frequency | Purpose |
|--------|-----------|---------|
| **Daily Revenue Report** | Daily | Total revenue by department |
| **Trial Balance** | Daily | AR/AP balances |
| **Flash Report** | Daily | Quick metrics for management |
| **Month-End Package** | Monthly | GL journal, statistics, reconciliation |
| **AR Aging** | Weekly | Outstanding balances by age |
| **Commission Report** | Monthly | OTA/travel agent payables |
| **Tax Report** | Monthly | Tax collected by jurisdiction |

### 13.3 Performance Reports

| Report | Metrics | Comparison |
|--------|---------|------------|
| **STAR Report** | Occupancy, ADR, RevPAR | vs. Competitive Set |
| **Pace Report** | Booking velocity | vs. Same Time Last Year |
| **Market Segment** | Revenue by source | Channel performance |
| **Length of Stay** | LOS distribution | Pricing strategy |
| **Cancellation Analysis** | Cancel rate, reasons | Policy effectiveness |
| **Source of Business** | Top producers | Marketing ROI |

### 13.4 KPI Dashboards

| Dashboard | Audience | Update Frequency |
|-----------|----------|------------------|
| Revenue Manager | Revenue, pricing | Real-time |
| General Manager | Overall performance | Daily |
| Front Desk | Operations | Real-time |
| Housekeeping | Room status | Real-time |
| Sales | Group/corporate | Weekly |
| Executive | Portfolio summary | Weekly |

---

## 14. Security & Compliance

### 14.1 Data Protection Regulations

| Regulation | Region | Key Requirements |
|------------|--------|------------------|
| **GDPR** | EU | Consent, right to erasure, breach notification |
| **CCPA/CPRA** | California | Opt-out, disclosure, deletion rights |
| **PDPA** | Singapore | Consent, purpose limitation |
| **LGPD** | Brazil | Consent, data portability |
| **POPIA** | South Africa | Accountability, purpose limitation |
| **Australia Privacy Act** | Australia | APP compliance, breach notification |

### 14.2 PCI DSS Requirements

| Requirement | Description | PMS Implication |
|-------------|-------------|-----------------|
| **SAQ A** | Card-not-present, outsourced | Use tokenization |
| **SAQ A-EP** | E-commerce, redirect | Payment page hosted externally |
| **SAQ B** | Imprint or dial-out terminals | Limited applicability |
| **SAQ C** | Payment application connected | PMS with integrated payments |
| **SAQ D** | Full assessment | Self-hosted payment processing |

### 14.3 Guest Data Handling

| Data Type | Retention | Access Control |
|-----------|-----------|----------------|
| PII (Name, Contact) | Duration of relationship + 7 years | Role-based |
| Payment Card (Full PAN) | Never store | Tokenize |
| Payment Card (Last 4) | Transaction history | Authorized staff |
| ID Documents | Per local law (varies) | Management only |
| Preferences | Until opt-out | CRM/Front Desk |
| Stay History | 7 years | Authorized staff |

### 14.4 Police Registration Requirements

| Country | Requirement | Deadline |
|---------|-------------|----------|
| Spain | All guests | 24 hours |
| Italy | All guests | 24 hours |
| Portugal | All guests | 24 hours |
| India | Foreigners | 24 hours |
| UAE | All guests | 24 hours |
| USA | Per state law | Varies |
| UK | None | N/A |

### 14.5 Accessibility Compliance

| Standard | Region | Requirements |
|----------|--------|--------------|
| **ADA** | USA | Accessible rooms, service animals, auxiliary aids |
| **AODA** | Ontario, Canada | Accessibility standards |
| **Equality Act** | UK | Reasonable adjustments |
| **DDA** | Australia | Disability Discrimination Act |

---

## 15. Performance Benchmarks

### 15.1 System Performance

| Metric | Target | Critical Threshold |
|--------|--------|-------------------|
| Booking transaction | < 3 seconds | > 5 seconds |
| Check-in transaction | < 2 seconds | > 4 seconds |
| Room status update | < 1 second | > 2 seconds |
| Folio lookup | < 1 second | > 2 seconds |
| Report generation (daily) | < 30 seconds | > 60 seconds |
| Channel availability update | < 2 seconds | > 5 seconds |
| API response (95th percentile) | < 500ms | > 1000ms |
| System uptime | 99.9% | < 99.5% |

### 15.2 Capacity Planning

| Property Size | Concurrent Users | Transactions/Hour |
|---------------|------------------|-------------------|
| 50 rooms | 5-10 | 100-200 |
| 200 rooms | 15-30 | 400-800 |
| 500 rooms | 40-75 | 1,000-2,000 |
| 1000+ rooms | 100+ | 3,000+ |

### 15.3 Scalability Requirements

| Scale | Expected Load | Architecture |
|-------|---------------|--------------|
| Single property | 1,000 transactions/day | Monolith acceptable |
| Regional chain (10-50 properties) | 50,000 transactions/day | Microservices recommended |
| Enterprise (100+ properties) | 500,000+ transactions/day | Distributed, multi-region |

---

## 16. Glossary

### A-E

| Term | Definition |
|------|------------|
| **ADR** | Average Daily Rate - Total room revenue / Rooms sold |
| **Allotment** | Pre-contracted room block for a group or channel |
| **ARI** | Availability, Rates, Inventory - Data sent to distribution channels |
| **Attrition** | Percentage of group block rooms not picked up |
| **BAR** | Best Available Rate - Lowest unrestricted public rate |
| **CRS** | Central Reservation System - Chain-level booking platform |
| **Comp** | Complimentary - Free of charge |
| **Day Use** | Same-day check-in and check-out (typically 6-8 hours) |
| **Direct Bill** | Invoice sent to company, payment collected later |

### F-M

| Term | Definition |
|------|------------|
| **Folio** | Guest bill/account showing all charges and payments |
| **GDS** | Global Distribution System - Travel agent booking networks |
| **GOPPAR** | Gross Operating Profit Per Available Room |
| **Group** | 10+ rooms with shared billing or purpose |
| **House Count** | Total persons in-house (guests + additional occupants) |
| **LOS** | Length of Stay - Number of nights |
| **Master Folio** | Main billing account for a group |
| **MLOS** | Minimum Length of Stay restriction |

### N-R

| Term | Definition |
|------|------------|
| **No-Show** | Guaranteed reservation where guest doesn't arrive |
| **OOO** | Out of Order - Room unavailable due to maintenance |
| **OOS** | Out of Service - Room temporarily unavailable |
| **OTA** | Online Travel Agency (Booking.com, Expedia) |
| **Overbooking** | Accepting more reservations than available rooms |
| **Pickup** | New reservations on the books for future dates |
| **PMS** | Property Management System |
| **Rack Rate** | Published maximum rate |
| **RevPAR** | Revenue Per Available Room - ADR × Occupancy |
| **Rooming List** | Group guest names matched to rooms |

### S-Z

| Term | Definition |
|------|------------|
| **Shoulder Date** | Days before/after peak event dates |
| **Stayover** | Guest remaining another night |
| **TRevPAR** | Total Revenue Per Available Room (includes ancillary) |
| **Turn-down** | Evening room service (bed prep, amenities) |
| **Upsell** | Offering higher room category or add-ons |
| **Virtual Card** | OTA-provided payment method for commission |
| **Walk** | Moving a guest to another hotel due to oversell |
| **Wash** | Adjusting rate to compensate for poor situation |
| **Yield Management** | Dynamic pricing based on demand |

---

## Appendices

### A. Room Type Code Standards

```
Standard codes (industry convention):
  STD  - Standard
  SUP  - Superior
  DLX  - Deluxe
  JRS  - Junior Suite
  STE  - Suite
  PHS  - Penthouse Suite

Bed configuration suffix:
  K    - King
  Q    - Queen
  2Q   - Two Queens
  T    - Twin

View suffix:
  OV   - Ocean View
  CV   - City View
  GV   - Garden View
  PV   - Pool View

Example: DLXKOV = Deluxe King Ocean View
```

### B. Market Segment Codes

```
Transient:
  TRA  - Transient (Regular rate)
  COR  - Corporate
  AAA  - Auto Club
  GOV  - Government
  PKG  - Package

Group:
  GRP  - General Group
  CON  - Convention
  TOR  - Tour
  WED  - Wedding
  SOC  - Social

Other:
  CMP  - Complimentary
  HSE  - House Use
  WHL  - Wholesale
```

### C. Tax Code Examples

```
US:
  ST   - State Tax (varies by state)
  CT   - City Tax (varies by city)
  OCC  - Occupancy Tax
  TDL  - Tourism Development Levy

EU:
  VAT  - Value Added Tax
  TT   - Tourist Tax (per person per night)

Example posting:
  Room Charge:     $100.00
  State Tax (12%):  $12.00
  City Tax ($2.50):  $2.50
  Total:           $114.50
```

### D. Integration Message Examples

#### Availability Update (OTA XML)
```xml
<OTA_HotelAvailNotifRQ>
  <AvailStatusMessages HotelCode="HTLXYZ">
    <AvailStatusMessage>
      <StatusApplicationControl Start="2026-02-05" End="2026-02-07"
        InvTypeCode="DLXK" RatePlanCode="BAR"/>
      <LengthsOfStay>
        <LengthOfStay MinMaxMessageType="MinLOS" Time="2"/>
      </LengthsOfStay>
      <RestrictionStatus Status="Open"/>
    </AvailStatusMessage>
  </AvailStatusMessages>
</OTA_HotelAvailNotifRQ>
```

#### Rate Update (OTA XML)
```xml
<OTA_HotelRatePlanNotifRQ>
  <RatePlans HotelCode="HTLXYZ">
    <RatePlan RatePlanCode="BAR" CurrencyCode="USD">
      <Rates>
        <Rate Start="2026-02-05" End="2026-02-07">
          <BaseByGuestAmts>
            <BaseByGuestAmt AmountBeforeTax="189.00" NumberOfGuests="2"/>
          </BaseByGuestAmts>
        </Rate>
      </Rates>
    </RatePlan>
  </RatePlans>
</OTA_HotelRatePlanNotifRQ>
```

### E. Database Schema Patterns

```sql
-- Multi-tenant reservation structure (reference pattern)
CREATE TABLE reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    property_id UUID NOT NULL REFERENCES properties(id),
    confirmation_number VARCHAR(20) NOT NULL,
    guest_id UUID REFERENCES guests(id),

    -- Dates
    arrival_date DATE NOT NULL,
    departure_date DATE NOT NULL,

    -- Room assignment
    room_type_id UUID REFERENCES room_types(id),
    room_id UUID REFERENCES rooms(id),

    -- Status
    status VARCHAR(20) NOT NULL CHECK (status IN (
        'RESERVED', 'CONFIRMED', 'CHECKED_IN',
        'CHECKED_OUT', 'CANCELED', 'NO_SHOW'
    )),

    -- Rate
    rate_code VARCHAR(10),
    rate_amount DECIMAL(10,2),

    -- Source
    booking_source VARCHAR(50),
    market_segment VARCHAR(20),

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),

    UNIQUE (tenant_id, confirmation_number)
);

CREATE INDEX idx_reservations_tenant_dates
    ON reservations(tenant_id, arrival_date, departure_date);
CREATE INDEX idx_reservations_status
    ON reservations(tenant_id, status);
```

---

## Document Maintenance

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-05 | AI Reference | Initial comprehensive version |

---

**End of Document**

*This document is maintained as a reference for AI systems implementing PMS functionality. For specific implementation details, refer to the codebase documentation in `/docs/` and the schema definitions in `/schema/`.*
