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
| Properties, buildings & outlets | Manage properties, buildings, outlets, meal periods, fiscal year, group shoulder days | **COVERED** | core-service | `properties`, `buildings` (01-core/14), `outlets` + `meal_periods` (01-core/15) all exist; fiscal year and shoulder days are config-level gaps |
| Rooms & room types | Rooms, room types, rack order, features, phone extensions | **COVERED** | rooms-service | Room types, features, rack order supported; phone extensions is a gap |
| Profile settings | Customize display of profile details and history | **GAP** | — | UI/display configuration not modeled |
| Property Import/Export | Import and export property data | **GAP** | — | No bulk import/export tooling |
| Housekeeping Services Import | Import housekeeping services data | **GAP** | — | No bulk import for housekeeping |
| Loyalty programs | Define guest loyalty programs for the property | **COVERED** | guests-service | `guest_loyalty_programs`, `loyalty_point_transactions`, `loyalty_tier_rules` tables exist with full tier/points/benefits support |
| Profile Preferences | Preferences individually set on guest profiles | **COVERED** | guests-service | `guest_preferences` table with rich preference types and JSONB extensibility |
| Phone Call Management | Emergency calling, call allowances (domestic/international) | **GAP** | — | PBX/telephony integration not in scope |
| Data Retention Management | Personal data retention policies for guest/company/travel agent profiles | **COVERED** | core-service | `data_retention_policies` + `data_breach_incidents` tables in `10-compliance/`; configurable per entity type with sweep tracking |
| Feature Settings | Enable/disable features at property level | **COVERED** | core-service | `property_feature_flags` table in `01-core/16_property_feature_flags.sql` with module toggles, rollout control, subscription tiers |
| Universal Alerts | Rules-based alerts for reservations, guests, groups, loyalty events | **COVERED** | core-service | `performance_alerts` + `alert_rules` tables in `07-analytics/` with severity, acknowledgment, and auto-resolve |
| Profile & Reservations Import/Export | Bulk import/export of guest, travel agent, company profiles and reservations | **GAP** | — | No bulk import/export |
| Events and Announcements | Configure events and announcements for property | **COVERED** | core-service | `property_events` + `announcements` tables in `01-core/17_property_events.sql` with scheduling, impact tracking, audience targeting |
| Guest Self Service | Guest-facing self-service module configuration | **PARTIAL** | guest-experience-service | Service exists; needs self-service config management |
| Field Settings | Configure field settings for Profiles, Groups, AR | **GAP** | — | No dynamic field configuration |

### Summary: 8 covered, 2 partial, 5 gaps

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
| Policies & codes | Reservation/cancellation policies, booking system, lost business tracking | **COVERED** | settings-service | Cancellation policies exist; `lost_business` table in `03-bookings/60_lost_business.sql` tracks denials and regrets |
| Room Move Reasons | Reasons for room moves/swaps | **COVERED** | rooms-service | `reason_codes` table (category=ROOM_MOVE) in `09-reference-data/08_reason_codes.sql` with 7 seed codes |
| Rate Override Reasons | Reasons for rate overrides | **COVERED** | settings-service | `reason_codes` table (category=RATE_OVERRIDE) in `09-reference-data/08_reason_codes.sql` with 6 seed codes |
| Travel Information | Mode of travel, locations (airports, stations), distance, travel time | **COVERED** | core-service | `vehicles`, `transportation_requests`, `shuttle_schedules` tables in `05-operations/` |
| Transport Information | Transportation types, seats, charges, threshold alerts | **COVERED** | core-service | Same transport tables cover fleet, capacity, pricing, and alerts |
| Deposit Override Reasons | Reasons for deposit policy overrides | **COVERED** | settings-service | `reason_codes` table (category=DEPOSIT_OVERRIDE) in `09-reference-data/08_reason_codes.sql` with 4 seed codes |

### Summary: 8 covered, 0 partial, 0 gaps

---

## 4. Accounting

| PRO Feature | Description | Tartware Status | Tartware Service | Notes |
|-------------|-------------|-----------------|------------------|-------|
| Night audit & date roll | Night audit functions, date roll | **COVERED** | roll-service | Shadow roll ledger, night audit processing exist |
| Guest Accounting | Categories, subcategories, items, meal periods, payment methods, credit cards | **COVERED** | billing-service | Charge codes, payment methods, folio management exist |
| Payment Gateway Setup | Pay agents, credit card gateway configuration | **PARTIAL** | billing-service | Payment processing exists; gateway configuration UI not modeled |
| GL Codes | Configure ledger GL codes | **COVERED** | billing-service | `general_ledger_batches` + `general_ledger_entries` tables with USALI-compliant GL code structure |
| Comp Reasons | Setup comp reasons | **COVERED** | billing-service | `comp_authorizers` + `comp_transactions` + `comp_property_config` tables in `04-financial/72_comp_accounting.sql` with full reason code support |
| House Accounts | Manage house account settings | **COVERED** | billing-service | `accounts_receivable` + `credit_limits` tables cover house/city ledger accounts, aging, and AR management |
| Pantry Management | Setup pantry items | **COVERED** | billing-service | `minibar_items` + `minibar_consumption` tables with full product catalog, pricing tiers, and consumption tracking |

### Summary: 6 covered, 1 partial, 0 gaps

---

## 5. Back of House

| PRO Feature | Description | Tartware Status | Tartware Service | Notes |
|-------------|-------------|-----------------|------------------|-------|
| Guest Satisfaction | Categories for satisfaction, dashboard for complaints/compliments | **COVERED** | guests-service | `guest_feedback` table with multi-dimensional ratings, sentiment analysis, management response, and external review integration |
| Housekeeping | Staff, patterns, room order, sections, services, conditions, roles | **COVERED** | housekeeping-service | Housekeeping management, task assignment, room status all exist |
| Pets | Pet types accepted and associated charges | **COVERED** | settings-service | `pet_types` + `pet_registrations` tables in `09-reference-data/09_pet_types.sql` with species, charges, policies, and per-reservation tracking |

### Summary: 3 covered, 0 partial, 0 gaps

---

## 6. Comp Accounting

| PRO Feature | Description | Tartware Status | Tartware Service | Notes |
|-------------|-------------|-----------------|------------------|-------|
| Comp Accounting Configuration | Enable/disable comp accounting per property | **COVERED** | billing-service | `comp_property_config` table in `04-financial/72_comp_accounting.sql` with enable/disable toggle, tax config, GL accounts |
| Property Comp Defaults | Tax, authorization code, comp offset settings | **COVERED** | billing-service | Same `comp_property_config` with `comp_tax_exempt`, `default_comp_offset_account`, `require_authorization_code` |
| Comp Authorizers and Departments | Manage comp departments and authorizers | **COVERED** | billing-service | `comp_authorizers` table with department, authorization levels, daily/monthly/annual limits, delegation |

### Summary: 3 covered, 0 partial, 0 gaps

---

## 7. Offers Setup

| PRO Feature | Description | Tartware Status | Tartware Service | Notes |
|-------------|-------------|-----------------|------------------|-------|
| Offers Setup | Create and manage offers | **COVERED** | revenue-service | `promotional_codes` + `marketing_campaigns` + `campaign_segments` tables with full promo engine, usage tracking, and performance analytics |

### Summary: 1 covered, 0 partial, 0 gaps

---

## 8. Function Rooms

| PRO Feature | Description | Tartware Status | Tartware Service | Notes |
|-------------|-------------|-----------------|------------------|-------|
| Setup | Function room styles, facilities | **COVERED** | rooms-service | `meeting_rooms` table with 10 room types, 40+ feature flags, capacity by setup style, pricing, and equipment inventory |
| Configure | Associate styles, facilities to rooms | **COVERED** | rooms-service | `event_bookings` table links rooms to events with full setup/AV/catering configuration |
| Policy | Cancellation policy, inventory blocks | **COVERED** | rooms-service | `banquet_event_orders` (BEO) table with cancellation policies, approval workflows, and detailed service specs |

### Summary: 3 covered, 0 partial, 0 gaps

---

## 9. Templates

| PRO Feature | Description | Tartware Status | Tartware Service | Notes |
|-------------|-------------|-----------------|------------------|-------|
| Folio | Custom messages for printed/emailed guest folios | **COVERED** | notification-service | `communication_templates` table with template variables, HTML body, automation triggers |
| Cancellation | Custom footer for cancellation communications | **COVERED** | notification-service | Same `communication_templates` with `trigger_event='BOOKING_CANCELLED'` |
| Confirmation | Custom footer for confirmation communications | **COVERED** | notification-service | Same `communication_templates` with `trigger_event='BOOKING_CONFIRMED'` |
| Registration Card | Custom message for printed registration cards | **COVERED** | guest-experience-service | `digital_registration_cards` table with full guest snapshot, ID documents, and signatures |
| AR Statement | Custom footer for AR statements | **PARTIAL** | billing-service | `accounts_receivable` + `communication_templates` exist; AR-specific template type needs adding |
| Invoices | Custom message for invoices | **PARTIAL** | billing-service | `invoices` + `invoice_items` tables exist; invoice template type needs adding to `communication_templates` |
| Schedule Deposit Due | Deposit due success/failure email templates | **GAP** | — | No scheduled deposit emails |
| Routing Rule Templates | Create/edit routing rule templates | **GAP** | — | No folio routing rule templates |
| Send Payment | Email template for payment link to guests | **GAP** | — | No payment link emails |
| Reservation Welcome Script | Create/edit welcome scripts | **GAP** | — | No welcome script system |
| Coupons | Custom verbiage for coupons | **COVERED** | revenue-service | `promotional_codes` table supports coupon-type promos with custom descriptions and redemption tracking |
| Group Rooming List Templates | Custom group rooming list templates | **GAP** | — | No rooming list template system |

### Summary: 5 covered, 2 partial, 5 gaps

---

## Overall Scorecard

| Category | Features | Covered | Partial | Gap |
|----------|----------|---------|---------|-----|
| General | 15 | 8 | 2 | 5 |
| Administration | 3 | 1 | 1 | 1 |
| Reservations | 8 | 8 | 0 | 0 |
| Accounting | 7 | 6 | 1 | 0 |
| Back of House | 3 | 3 | 0 | 0 |
| Comp Accounting | 3 | 3 | 0 | 0 |
| Offers | 1 | 1 | 0 | 0 |
| Function Rooms | 3 | 3 | 0 | 0 |
| Templates | 12 | 5 | 2 | 5 |
| **TOTAL** | **55** | **38 (69%)** | **6 (11%)** | **11 (20%)** |

---

## Gap Analysis by Tartware Service

### Existing services that need extension

| Service | Gaps to fill |
|---------|-------------|
| **core-service** | Departments |
| **guests-service** | Richer profile preferences |
| **rooms-service** | Phone extensions |
| **billing-service** | Payment gateway config UI |
| **notification-service** | Additional template types (AR statement, invoice, deposit due, payment link, welcome script, rooming list) |
| **guest-experience-service** | Self-service config management |

### New modules needed (not currently any Tartware service)

| Module | PRO Features | Priority | Rationale |
|--------|-------------|----------|-----------|
| **Template Engine** | 12 template types (folio, confirmation, cancellation, invoices, etc.) | HIGH | Guest-facing communications are table-stakes for any PMS |
| **Comp Accounting** | Enable/disable, defaults, authorizers, departments, reasons | ~~MEDIUM~~ **COVERED** | `comp_authorizers` + `comp_transactions` + `comp_property_config` tables in `04-financial/72_comp_accounting.sql` |
| **Function Rooms** | Setup, configure, policies for meeting/event spaces | MEDIUM | Full-service and convention hotels; skip for limited-service |
| **Import/Export** | Property, profiles, reservations, housekeeping bulk operations | MEDIUM | Essential for property onboarding and data migration |
| **Travel & Transport** | Travel modes, locations, transport types, charges | LOW | Nice-to-have; most properties handle externally |
| **Alerts Engine** | Universal rules-based alerts across reservation/guest/group events | LOW | Can be deferred; basic notifications already exist |
| **Pet Management** | Pet types, charges | ~~LOW~~ **COVERED** | `pet_types` + `pet_registrations` tables in `09-reference-data/09_pet_types.sql` |
| **Guest Satisfaction** | Complaint/compliment categories, dashboard | LOW | Can start as a reporting feature |
| **Data Retention** | GDPR retention policy engine | ~~LOW~~ **COVERED** | `data_retention_policies` + `data_breach_incidents` in `10-compliance/` |
| **Phone/PBX** | Emergency calling, call allowances | LOW | Niche integration; most modern properties use cloud PBX |

---

## Tartware Domain Mapping

Shows where each PRO section maps to Tartware's service architecture:

```
PRO Section              → Tartware Service(s)
─────────────────────────────────────────────────
General
  Property/Buildings     → core-service ✓ (buildings, outlets, meal_periods tables)
  Rooms/Room Types       → rooms-service ✓
  Profile Settings       → guest-experience-service (new feature)
  Import/Export          → new import-export tooling
  Loyalty Programs       → guests-service ✓ (3 loyalty tables)
  Profile Preferences    → guests-service ✓
  Phone Management       → out-of-scope (PBX integration)
  Data Retention         → core-service ✓ (data_retention_policies)
  Feature Settings       → core-service ✓ (property_feature_flags)
  Universal Alerts       → core-service ✓ (performance_alerts + alert_rules)
  Events/Announcements   → core-service ✓ (property_events + announcements)
  Guest Self Service     → guest-experience-service ✓
  Field Settings         → new dynamic-fields feature

Administration
  User Accounts          → core-service + tenant-auth ✓
  Home Page Prefs        → UI-only (not backend)
  Users & Departments    → core-service (extend)

Reservations
  Market Segments        → settings-service ✓
  Rates                  → settings-service + revenue-service ✓
  Policies & Codes       → settings-service ✓ (lost_business table)
  Room Move Reasons      → reason_codes table ✓
  Rate Override Reasons  → reason_codes table ✓
  Travel/Transport Info  → core-service ✓ (vehicles + transport tables)
  Deposit Override       → reason_codes table ✓

Accounting
  Night Audit            → roll-service ✓
  Guest Accounting       → billing-service ✓
  Payment Gateway        → billing-service (extend: config)
  GL Codes               → billing-service ✓ (general_ledger_*)
  Comp Reasons           → billing-service ✓ (comp_authorizers + comp_transactions + comp_property_config)
  House Accounts         → billing-service ✓ (accounts_receivable + credit_limits)
  Pantry Management      → billing-service ✓ (minibar_items + minibar_consumption)

Back of House
  Guest Satisfaction     → guests-service ✓ (guest_feedback)
  Housekeeping           → housekeeping-service ✓
  Pets                   → reference-data ✓ (pet_types + pet_registrations)

Comp Accounting          → billing-service ✓ (comp_authorizers + comp_transactions + comp_property_config)
Offers                   → revenue-service ✓ (promotional_codes + campaigns)
Function Rooms           → rooms-service ✓ (meeting_rooms + event_bookings + BEO)

Templates                → notification-service ✓ (communication_templates + automated_messages)
                           + extend: AR, invoice, deposit, payment link, rooming list template types
```

---

## Recommended Implementation Phases

### Phase 1 — Core PMS Parity (High Impact) ✅ COMPLETE
- ~~Extend core-service: buildings, outlets, meal periods~~ → `14_buildings.sql`, `15_outlets.sql`
- ~~Create `reason_codes` reference table (room move, rate override, deposit override)~~ → `08_reason_codes.sql` (23 seeds)
- ~~Comp accounting tables (comp_authorizers, comp_transactions, comp_property_config)~~ → `72_comp_accounting.sql`
- ~~Extend settings-service: lost business tracking~~ → `60_lost_business.sql`
- ~~Property-level feature flags~~ → `16_property_feature_flags.sql` (14 seeds)
- ~~Events and announcements~~ → `17_property_events.sql`
- ~~Pet management~~ → `09_pet_types.sql`
- All 13 tables verified in PostgreSQL, verify scripts pass, Zod schemas built

### Phase 2 — Template & Communication Completion 🔴 HIGH PRIORITY (NEXT)
- Add AR statement, invoice, deposit due, payment link, welcome script, rooming list template types to `communication_templates`
- Folio routing rule templates
- Scheduled deposit due email system

### Phase 3 — Remaining Partials & Small Gaps
- Department association for users (core-service)
- Payment gateway configuration (billing-service)
- Guest self-service config management (guest-experience-service)
- Phone extensions on rooms (rooms-service)

### Phase 4 — Polish & Admin
- Dynamic field configuration
- Profile display settings
- UI preference storage (home page)
- Import/export tooling for property onboarding
- Phone/PBX integration (if needed)
