# Tartware PMS - Table Definitions

**Complete Enterprise Property Management System Database**
**Total Tables**: 89 organized into 15 functional categories
**Date**: October 19, 2025

---

## 📂 Directory Structure

All 89 tables are organized into logical categories for better maintainability and understanding:

```
scripts/tables/
├── 00-create-all-tables.sql          ← Master script to create all 89 tables
├── verify-tables.sql                  ← Validation script
├── 01-core-foundation/                (5 tables)  - Multi-tenancy, users, properties
├── 02-room-inventory/                 (4 tables)  - Room types, rooms, rates, availability
├── 03-reservations-booking/           (7 tables)  - Reservations, deposits, allotments
├── 04-financial-management/           (12 tables) - Payments, invoices, accounting
├── 05-services-housekeeping/          (4 tables)  - Services, housekeeping, maintenance
├── 06-channel-ota/                    (7 tables)  - OTA integrations, rate parity
├── 07-guest-crm/                      (7 tables)  - Communications, loyalty, feedback
├── 08-revenue-management/             (7 tables)  - Pricing, forecasts, competitor rates
├── 09-staff-operations/               (6 tables)  - Schedules, tasks, incidents
├── 10-marketing-campaigns/            (5 tables)  - Campaigns, promotions, referrals
├── 11-compliance-legal/               (4 tables)  - GDPR, contracts, insurance
├── 12-analytics-reporting/            (10 tables) - Metrics, reports, journey tracking
├── 13-mobile-digital/                 (4 tables)  - Mobile keys, QR codes, push notifications
├── 14-system-audit/                   (3 tables)  - Audit logs, business dates
└── 15-integration-hub/                (4 tables)  - API logs, webhooks, data sync
```

---

## 📊 Category Overview

### 1️⃣ Core Foundation (Tables 01-05)
**Purpose**: Multi-tenancy foundation, user management, properties

| # | Table Name | Purpose |
|---|------------|---------|
| 01 | tenants | Root multi-tenancy table |
| 02 | users | System users and authentication |
| 03 | user_tenant_associations | User-to-tenant many-to-many |
| 04 | properties | Hotel/property management |
| 05 | guests | Guest profiles and preferences |

### 2️⃣ Room & Inventory (Tables 06-09)
**Purpose**: Room configuration, pricing, and availability

| # | Table Name | Purpose |
|---|------------|---------|
| 06 | room_types | Room type definitions |
| 07 | rooms | Individual room inventory |
| 08 | rates | Pricing and rate plans |
| 09 | room_availability | Daily availability tracking |

### 3️⃣ Reservations & Booking (Tables 10-11, 30-34)
**Purpose**: Reservation lifecycle and booking management

| # | Table Name | Purpose |
|---|------------|---------|
| 10 | reservations | Core reservation data |
| 11 | reservation_status_history | Status change tracking |
| 30 | deposit_schedules | Deposit tracking |
| 31 | allotments | Group/block allocations |
| 32 | booking_sources | Channel attribution |
| 33 | market_segments | Market segmentation |
| 34 | guest_preferences | Guest preferences per reservation |

### 4️⃣ Financial Management (Tables 12-14, 25-26, 35, 63-68)
**Purpose**: Complete financial and accounting operations

| # | Table Name | Purpose |
|---|------------|---------|
| 12 | payments | Payment transactions |
| 13 | invoices | Invoice headers |
| 14 | invoice_items | Invoice line items |
| 25 | folios | Guest folios |
| 26 | charge_postings | Charge posting journal |
| 35 | refunds | Refund processing |
| 63 | tax_configurations | Tax rules and rates |
| 64 | financial_closures | Period closures |
| 65 | commission_tracking | Commission management |
| 66 | cashier_sessions | Cash drawer management |
| 67 | accounts_receivable | AR tracking |
| 68 | credit_limits | Credit limit management |

### 5️⃣ Services & Housekeeping (Tables 15-17, 37)
**Purpose**: Service delivery and housekeeping operations

| # | Table Name | Purpose |
|---|------------|---------|
| 15 | services | Service catalog |
| 16 | reservation_services | Services per reservation |
| 17 | housekeeping_tasks | Room cleaning tasks |
| 37 | maintenance_requests | Maintenance work orders |

### 6️⃣ Channel Management & OTA (Tables 18, 38-46)
**Purpose**: Distribution channel integrations

| # | Table Name | Purpose |
|---|------------|---------|
| 18 | channel_mappings | Room type mapping |
| 38 | ota_configurations | OTA connection settings |
| 39 | ota_rate_plans | Rate plan mapping |
| 40 | ota_reservations_queue | Booking queue |
| 44 | ota_inventory_sync | Availability sync |
| 45 | channel_rate_parity | Rate parity monitoring |
| 46 | channel_commission_rules | Commission structures |

### 7️⃣ Guest Relations & CRM (Tables 41-43, 47-50)
**Purpose**: Guest communication and relationship management

| # | Table Name | Purpose |
|---|------------|---------|
| 41 | guest_communications | Communication history |
| 42 | communication_templates | Message templates |
| 43 | guest_feedback | Reviews and ratings |
| 47 | guest_loyalty_programs | Loyalty memberships |
| 48 | guest_documents | Document storage |
| 49 | guest_notes | Internal notes |
| 50 | automated_messages | Marketing automation |

### 8️⃣ Revenue Management (Tables 36, 51-56)
**Purpose**: Dynamic pricing and revenue optimization

| # | Table Name | Purpose |
|---|------------|---------|
| 36 | rate_overrides | Manual rate adjustments |
| 51 | revenue_forecasts | Revenue predictions |
| 52 | competitor_rates | Competitive intelligence |
| 53 | demand_calendar | Demand patterns |
| 54 | pricing_rules | Automated pricing rules |
| 55 | rate_recommendations | AI-driven recommendations |
| 56 | revenue_goals | Target setting |

### 9️⃣ Staff & Operations (Tables 57-62)
**Purpose**: Staff management and operational tracking

| # | Table Name | Purpose |
|---|------------|---------|
| 57 | staff_schedules | Work schedules |
| 58 | staff_tasks | Task assignments |
| 59 | shift_handovers | Shift notes |
| 60 | lost_and_found | Lost property |
| 61 | incident_reports | Incident tracking |
| 62 | vendor_contracts | Vendor management |

### 🔟 Marketing & Campaigns (Tables 69-73)
**Purpose**: Marketing campaigns and promotions

| # | Table Name | Purpose |
|---|------------|---------|
| 69 | marketing_campaigns | Campaign management |
| 70 | campaign_segments | Target segments |
| 71 | promotional_codes | Promo codes |
| 72 | referral_tracking | Referral programs |
| 73 | social_media_mentions | Social listening |

### 1️⃣1️⃣ Compliance & Legal (Tables 74-77)
**Purpose**: Legal compliance and documentation

| # | Table Name | Purpose |
|---|------------|---------|
| 74 | gdpr_consent_logs | Privacy consent |
| 75 | police_reports | Police registration |
| 76 | contract_agreements | Legal contracts |
| 77 | insurance_claims | Insurance tracking |

### 1️⃣2️⃣ Analytics & Reporting (Tables 19-24, 78-81)
**Purpose**: Business intelligence and analytics

| # | Table Name | Purpose |
|---|------------|---------|
| 19 | analytics_metrics | Metric definitions |
| 20 | analytics_metric_dimensions | Metric dimensions |
| 21 | analytics_reports | Report definitions |
| 22 | report_property_ids | Report scoping |
| 23 | performance_reports | Performance data |
| 24 | alert_rules | Alert configuration |
| 78 | guest_journey_tracking | Journey analytics |
| 79 | revenue_attribution | Attribution modeling |
| 80 | forecasting_models | ML models |
| 81 | ab_test_results | A/B testing |

### 1️⃣3️⃣ Mobile & Digital (Tables 82-85)
**Purpose**: Mobile app and digital features

| # | Table Name | Purpose |
|---|------------|---------|
| 82 | mobile_keys | Digital room keys |
| 83 | qr_codes | QR code management |
| 84 | push_notifications | Push messaging |
| 85 | app_usage_analytics | App analytics |

### 1️⃣4️⃣ System & Audit (Tables 27-29)
**Purpose**: System operations and audit trails

| # | Table Name | Purpose |
|---|------------|---------|
| 27 | audit_logs | System audit trail |
| 28 | business_dates | Business date management |
| 29 | night_audit_log | Night audit process |

### 1️⃣5️⃣ Integration Hub (Tables 86-89)
**Purpose**: External system integrations

| # | Table Name | Purpose |
|---|------------|---------|
| 86 | integration_mappings | ID mapping |
| 87 | api_logs | API logging |
| 88 | webhook_subscriptions | Webhook management |
| 89 | data_sync_status | Sync tracking |

---

## 🚀 Quick Start

### Create All Tables
```bash
cd /home/navin/tartware/scripts
psql -U postgres -d tartware -f tables/00-create-all-tables.sql
```

### Verify Installation
```bash
psql -U postgres -d tartware -f tables/verify-tables.sql
```

### Expected Output
- ✓ All 89 tables created
- ✓ 80+ tables with soft delete
- ✓ 85+ tables with multi-tenancy (tenant_id)
- ✓ All tables with audit fields

---

## 🏗️ Architecture Patterns

### Multi-Tenancy
- All tables (except `tenants` and `users`) include `tenant_id`
- Row-level security via tenant_id filtering
- Supports multiple properties per tenant

### Soft Delete
- 80+ tables implement soft delete pattern
- Fields: `is_deleted BOOLEAN`, `deleted_at TIMESTAMP`, `deleted_by UUID`
- Enables data recovery and audit compliance

### Audit Trail
- All tables track: `created_at`, `updated_at`, `created_by`, `updated_by`
- Complete change history for compliance

### Primary Keys
- UUID-based primary keys throughout
- Generated via `uuid_generate_v4()`
- Globally unique identifiers

### JSONB Flexibility
- Metadata and settings stored as JSONB
- Enables schema-less extensions
- GIN indexes for efficient querying

---

## 📋 Dependencies

### External Dependencies
- PostgreSQL 16+ (requires `uuid-ossp` extension)
- `pg_trgm` extension (for text search)

### Internal Dependencies
Create tables in this order:
1. Core Foundation (01-05)
2. Room & Inventory (06-09)
3. Remaining categories (order-independent within each)

---

## 🔍 Related Files

- **Indexes**: `/scripts/indexes/` - Performance optimization
- **Constraints**: `/scripts/constraints/` - Foreign key relationships
- **Procedures**: `/scripts/procedures/` - Stored procedures
- **Triggers**: `/scripts/triggers/` - Automation logic

---

## 📚 Additional Resources

- See individual category README files for detailed documentation
- Refer to `DOCUMENTATION_SUMMARY.md` for architecture overview
- Check `database-architecture.md` for ERD and relationships

---

**Last Updated**: October 19, 2025
**Version**: 1.0.0 (89 tables)
**Database**: PostgreSQL 16.10
