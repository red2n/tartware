# PRO PMS Application — Feature Analysis & Tartware Mapping

Reference analysis of a full-featured enterprise PMS (PRO) mapped against Tartware's current domain coverage.

---

## Coverage Legend

| Symbol | Meaning |
|--------|---------|
| **COVERED** | Tartware has existing service/schema support |
| **PARTIAL** | Some foundation exists, needs extension |
| **GAP** | No current Tartware support |

---

## 1. General — Property & Configuration

| PRO Feature | Description | Tartware Status | Tartware Service | Notes |
|-------------|-------------|-----------------|------------------|-------|
| Properties, buildings & outlets | Manage properties, buildings, outlets, meal periods, fiscal year, group shoulder days | **PARTIAL** | core-service | Tenants/properties exist; buildings, outlets, meal periods, fiscal year, shoulder days are gaps |
| Rooms & room types | Rooms, room types, rack order, features, phone extensions | **COVERED** | rooms-service | Room types, features, rack order supported; phone extensions is a gap |
| Profile settings | Customize display of profile details and history | **GAP** | — | UI/display configuration not modeled |
| Property Import/Export | Import and export property data | **GAP** | — | No bulk import/export tooling |
| Housekeeping Services Import | Import housekeeping services data | **GAP** | — | No bulk import for housekeeping |
| Loyalty programs | Define guest loyalty programs for the property | **PARTIAL** | guests-service | Loyalty tiers documented in standards; service schema needs loyalty program CRUD |
| Profile Preferences | Preferences individually set on guest profiles | **PARTIAL** | guests-service | Guest preferences exist in schema; may need richer preference types |
| Phone Call Management | Emergency calling, call allowances (domestic/international) | **GAP** | — | PBX/telephony integration not in scope |
| Data Retention Management | Personal data retention policies for guest/company/travel agent profiles | **GAP** | — | GDPR documented in standards; no retention policy engine |
| Feature Settings | Enable/disable features at property level | **GAP** | — | No property-level feature flag system |
| Universal Alerts | Rules-based alerts for reservations, guests, groups, loyalty events | **GAP** | — | No alerting/rules engine |
| Profile & Reservations Import/Export | Bulk import/export of guest, travel agent, company profiles and reservations | **GAP** | — | No bulk import/export |
| Events and Announcements | Configure events and announcements for property | **GAP** | — | No events/announcements module |
| Guest Self Service | Guest-facing self-service module configuration | **PARTIAL** | guest-experience-service | Service exists; needs self-service config management |
| Field Settings | Configure field settings for Profiles, Groups, AR | **GAP** | — | No dynamic field configuration |

### Summary: 2 covered, 4 partial, 9 gaps

---

## 2. Administration

| PRO Feature | Description | Tartware Status | Tartware Service | Notes |
|-------------|-------------|-----------------|------------------|-------|
| User Accounts | Manage user accounts, permissions, privileges | **COVERED** | core-service + tenant-auth | Users, roles, permissions, JWT auth all exist |
| Preferred Home Page | Setup preferred home page per user | **GAP** | — | UI preference; not modeled |
| Users and Departments | Associate users to property departments | **PARTIAL** | core-service | Users exist; department association may need extension |

### Summary: 1 covered, 1 partial, 1 gap

---

## 3. Reservations

| PRO Feature | Description | Tartware Status | Tartware Service | Notes |
|-------------|-------------|-----------------|------------------|-------|
| Market segments & sources | Create and manage market segments | **COVERED** | settings-service | Market segments and source codes supported |
| Rates | Rate plans, rate calendars, strategies | **COVERED** | settings-service + revenue-service | Rate codes, rate plans, seasonal pricing exist |
| Policies & codes | Reservation/cancellation policies, booking system, lost business tracking | **PARTIAL** | settings-service | Cancellation policies exist; lost business tracking is a gap |
| Room Move Reasons | Reasons for room moves/swaps | **PARTIAL** | rooms-service | Room moves supported; configurable reasons may need addition |
| Rate Override Reasons | Reasons for rate overrides | **GAP** | — | No configurable rate override reason codes |
| Travel Information | Mode of travel, locations (airports, stations), distance, travel time | **GAP** | — | No travel/transport info module |
| Transport Information | Transportation types, seats, charges, threshold alerts | **GAP** | — | No transportation management |
| Deposit Override Reasons | Reasons for deposit policy overrides | **GAP** | — | No deposit override reasons |

### Summary: 2 covered, 2 partial, 4 gaps

---

## 4. Accounting

| PRO Feature | Description | Tartware Status | Tartware Service | Notes |
|-------------|-------------|-----------------|------------------|-------|
| Night audit & date roll | Night audit functions, date roll | **COVERED** | roll-service | Shadow roll ledger, night audit processing exist |
| Guest Accounting | Categories, subcategories, items, meal periods, payment methods, credit cards | **COVERED** | billing-service | Charge codes, payment methods, folio management exist |
| Payment Gateway Setup | Pay agents, credit card gateway configuration | **PARTIAL** | billing-service | Payment processing exists; gateway configuration UI not modeled |
| GL Codes | Configure ledger GL codes | **PARTIAL** | billing-service | Charge codes exist; explicit GL code mapping may need extension |
| Comp Reasons | Setup comp reasons | **GAP** | — | No comp reason management |
| House Accounts | Manage house account settings | **GAP** | — | No house account configuration |
| Pantry Management | Setup pantry items | **GAP** | — | No pantry/minibar item management |

### Summary: 2 covered, 2 partial, 3 gaps

---

## 5. Back of House

| PRO Feature | Description | Tartware Status | Tartware Service | Notes |
|-------------|-------------|-----------------|------------------|-------|
| Guest Satisfaction | Categories for satisfaction, dashboard for complaints/compliments | **GAP** | — | No guest satisfaction tracking module |
| Housekeeping | Staff, patterns, room order, sections, services, conditions, roles | **COVERED** | housekeeping-service | Housekeeping management, task assignment, room status all exist |
| Pets | Pet types accepted and associated charges | **GAP** | — | No pet management |

### Summary: 1 covered, 0 partial, 2 gaps

---

## 6. Comp Accounting

| PRO Feature | Description | Tartware Status | Tartware Service | Notes |
|-------------|-------------|-----------------|------------------|-------|
| Comp Accounting Configuration | Enable/disable comp accounting per property | **GAP** | — | No comp accounting module |
| Property Comp Defaults | Tax, authorization code, comp offset settings | **GAP** | — | |
| Comp Authorizers and Departments | Manage comp departments and authorizers | **GAP** | — | |

### Summary: 0 covered, 0 partial, 3 gaps

---

## 7. Offers Setup

| PRO Feature | Description | Tartware Status | Tartware Service | Notes |
|-------------|-------------|-----------------|------------------|-------|
| Offers Setup | Create and manage offers | **GAP** | — | No offers/promotions engine |

### Summary: 0 covered, 0 partial, 1 gap

---

## 8. Function Rooms

| PRO Feature | Description | Tartware Status | Tartware Service | Notes |
|-------------|-------------|-----------------|------------------|-------|
| Setup | Function room styles, facilities | **GAP** | — | No function/meeting room module |
| Configure | Associate styles, facilities to rooms | **GAP** | — | |
| Policy | Cancellation policy, inventory blocks | **GAP** | — | |

### Summary: 0 covered, 0 partial, 3 gaps

---

## 9. Templates

| PRO Feature | Description | Tartware Status | Tartware Service | Notes |
|-------------|-------------|-----------------|------------------|-------|
| Folio | Custom messages for printed/emailed guest folios | **PARTIAL** | notification-service | Notification service exists; template management needs build-out |
| Cancellation | Custom footer for cancellation communications | **PARTIAL** | notification-service | Same as above |
| Confirmation | Custom footer for confirmation communications | **PARTIAL** | notification-service | Same as above |
| Registration Card | Custom message for printed registration cards | **GAP** | — | No registration card generation |
| AR Statement | Custom footer for AR statements | **GAP** | — | No AR statement generation |
| Invoices | Custom message for invoices | **GAP** | — | No invoice generation |
| Schedule Deposit Due | Deposit due success/failure email templates | **GAP** | — | No scheduled deposit emails |
| Routing Rule Templates | Create/edit routing rule templates | **GAP** | — | No folio routing rule templates |
| Send Payment | Email template for payment link to guests | **GAP** | — | No payment link emails |
| Reservation Welcome Script | Create/edit welcome scripts | **GAP** | — | No welcome script system |
| Coupons | Custom verbiage for coupons | **GAP** | — | No coupon system |
| Group Rooming List Templates | Custom group rooming list templates | **GAP** | — | No rooming list template system |

### Summary: 0 covered, 3 partial, 9 gaps

---

## Overall Scorecard

| Category | Features | Covered | Partial | Gap |
|----------|----------|---------|---------|-----|
| General | 15 | 2 | 4 | 9 |
| Administration | 3 | 1 | 1 | 1 |
| Reservations | 8 | 2 | 2 | 4 |
| Accounting | 7 | 2 | 2 | 3 |
| Back of House | 3 | 1 | 0 | 2 |
| Comp Accounting | 3 | 0 | 0 | 3 |
| Offers | 1 | 0 | 0 | 1 |
| Function Rooms | 3 | 0 | 0 | 3 |
| Templates | 12 | 0 | 3 | 9 |
| **TOTAL** | **55** | **8 (15%)** | **12 (22%)** | **35 (64%)** |

---

## Gap Analysis by Tartware Service

### Existing services that need extension

| Service | Gaps to fill |
|---------|-------------|
| **core-service** | Buildings, outlets, meal periods, fiscal year, feature flags, departments |
| **guests-service** | Loyalty program CRUD, richer profile preferences, satisfaction tracking |
| **rooms-service** | Phone extensions, room move reasons |
| **settings-service** | Lost business tracking, rate override reasons, deposit override reasons |
| **billing-service** | GL code mapping, house accounts, comp reasons, pantry items |
| **notification-service** | Template management (folio, confirmation, cancellation, AR, invoice, payment link, welcome script) |
| **guest-experience-service** | Self-service config management |
| **revenue-service** | Offers/promotions engine |

### New modules needed (not currently any Tartware service)

| Module | PRO Features | Priority | Rationale |
|--------|-------------|----------|-----------|
| **Template Engine** | 12 template types (folio, confirmation, cancellation, invoices, etc.) | HIGH | Guest-facing communications are table-stakes for any PMS |
| **Comp Accounting** | Enable/disable, defaults, authorizers, departments, reasons | MEDIUM | Casino/resort properties require comp tracking; not needed for limited-service |
| **Function Rooms** | Setup, configure, policies for meeting/event spaces | MEDIUM | Full-service and convention hotels; skip for limited-service |
| **Import/Export** | Property, profiles, reservations, housekeeping bulk operations | MEDIUM | Essential for property onboarding and data migration |
| **Travel & Transport** | Travel modes, locations, transport types, charges | LOW | Nice-to-have; most properties handle externally |
| **Alerts Engine** | Universal rules-based alerts across reservation/guest/group events | LOW | Can be deferred; basic notifications already exist |
| **Pet Management** | Pet types, charges | LOW | Simple config; can be added to settings-service |
| **Guest Satisfaction** | Complaint/compliment categories, dashboard | LOW | Can start as a reporting feature |
| **Data Retention** | GDPR retention policy engine | LOW | Compliance requirement but can use manual processes initially |
| **Phone/PBX** | Emergency calling, call allowances | LOW | Niche integration; most modern properties use cloud PBX |

---

## Tartware Domain Mapping

Shows where each PRO section maps to Tartware's service architecture:

```
PRO Section              → Tartware Service(s)
─────────────────────────────────────────────────
General
  Property/Buildings     → core-service (extend)
  Rooms/Room Types       → rooms-service ✓
  Profile Settings       → guest-experience-service (new feature)
  Import/Export          → new import-export tooling
  Loyalty Programs       → guests-service (extend)
  Profile Preferences    → guests-service ✓
  Phone Management       → out-of-scope (PBX integration)
  Data Retention         → new retention-policy feature
  Feature Settings       → core-service (extend: feature flags)
  Universal Alerts       → new alerts-engine
  Events/Announcements   → new feature
  Guest Self Service     → guest-experience-service ✓
  Field Settings         → new dynamic-fields feature

Administration
  User Accounts          → core-service + tenant-auth ✓
  Home Page Prefs        → UI-only (not backend)
  Users & Departments    → core-service (extend)

Reservations
  Market Segments        → settings-service ✓
  Rates                  → settings-service + revenue-service ✓
  Policies & Codes       → settings-service (extend)
  Room Move Reasons      → rooms-service (extend: reason codes)
  Rate Override Reasons  → settings-service (extend: reason codes)
  Travel/Transport Info  → new feature or settings-service
  Deposit Override       → settings-service (extend: reason codes)

Accounting
  Night Audit            → roll-service ✓
  Guest Accounting       → billing-service ✓
  Payment Gateway        → billing-service (extend: config)
  GL Codes               → billing-service (extend)
  Comp Reasons           → new comp-accounting module
  House Accounts         → billing-service (extend)
  Pantry Management      → billing-service (extend)

Back of House
  Guest Satisfaction     → new feature
  Housekeeping           → housekeeping-service ✓
  Pets                   → settings-service (extend)

Comp Accounting          → new comp-accounting module
Offers                   → revenue-service (extend)
Function Rooms           → new function-rooms module

Templates                → notification-service (extend: template engine)
```

---

## Recommended Implementation Phases

### Phase 1 — Core PMS Parity (High Impact)
- Template engine in notification-service (folio, confirmation, cancellation)
- Extend core-service: buildings, outlets, meal periods
- Extend settings-service: reason codes (room move, rate override, deposit override)
- Extend billing-service: GL code mapping, house accounts

### Phase 2 — Revenue & Guest Operations
- Offers/promotions in revenue-service
- Loyalty program CRUD in guests-service
- Import/export tooling for property onboarding
- Lost business tracking in settings-service

### Phase 3 — Full-Service Properties
- Function rooms module
- Comp accounting module
- Guest satisfaction tracking
- Travel & transport info

### Phase 4 — Polish & Compliance
- Data retention policy engine
- Universal alerts engine
- Dynamic field settings
- Pet management
- Pantry management
