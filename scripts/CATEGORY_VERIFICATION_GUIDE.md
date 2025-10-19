# Category-Level Verification Guide

## Overview

The Tartware PMS database is organized into **15 functional categories**, each with its own dedicated verification scripts. This enables focused testing, faster debugging, and independent development of different business domains.

## Quick Start

### Verify ALL Categories

```bash
cd /home/navin/tartware/scripts
psql -U postgres -d tartware -f verify-all-categories.sql
```

**What it does:**
- Runs verification for all 15 categories sequentially
- Checks tables, indexes, and constraints for each category
- Provides comprehensive summary of database health

**Expected output:** Complete validation report for all 89 tables, 650+ indexes, and all constraints.

### Verify Individual Category

```bash
# Example: Core Foundation category
psql -U postgres -d tartware -f tables/01-core-foundation/verify-01-core-foundation.sql
psql -U postgres -d tartware -f indexes/01-core-foundation/verify-01-core-foundation-indexes.sql
psql -U postgres -d tartware -f constraints/01-core-foundation/verify-01-core-foundation-constraints.sql
```

## Category Structure

Each category has **3 verification scripts**:

1. **Tables verification** - `verify-{category}.sql`
   - Table existence
   - Primary keys (UUID type)
   - Multi-tenancy (tenant_id column)
   - Soft delete (is_deleted, deleted_at, deleted_by)
   - Audit fields (created_at, updated_at, created_by, updated_by)
   - Column counts

2. **Indexes verification** - `verify-{category}-indexes.sql`
   - Index counts per table
   - Foreign key column indexing
   - Partial indexes for soft delete
   - Coverage summary

3. **Constraints verification** - `verify-{category}-constraints.sql`
   - Foreign key constraint counts
   - DELETE RESTRICT policy enforcement
   - UPDATE CASCADE policy validation
   - tenant_id foreign keys (multi-tenancy)
   - Constraint naming conventions

## 15 Functional Categories

### 1. Core Foundation
**Tables:** 5 (tenants, users, user_tenant_associations, properties, guests)
**Purpose:** Fundamental entities for multi-tenant PMS
**Location:** `scripts/{tables|indexes|constraints}/01-core-foundation/`

```bash
# Verify Core Foundation
psql -U postgres -d tartware -f tables/01-core-foundation/verify-01-core-foundation.sql
```

### 2. Room & Inventory Management
**Tables:** 4 (room_types, rooms, rates, room_availability)
**Purpose:** Room inventory and rate management
**Location:** `scripts/{tables|indexes|constraints}/02-room-inventory/`

```bash
# Verify Room Inventory
psql -U postgres -d tartware -f tables/02-room-inventory/verify-02-room-inventory.sql
```

### 3. Reservations & Booking
**Tables:** 7 (reservations, reservation_guests, deposits, etc.)
**Purpose:** Booking lifecycle and guest assignments
**Location:** `scripts/{tables|indexes|constraints}/03-reservations-booking/`

```bash
# Verify Reservations
psql -U postgres -d tartware -f tables/03-reservations-booking/verify-03-reservations-booking.sql
```

### 4. Financial Management
**Tables:** 12 (payments, invoices, folios, accounting, etc.)
**Purpose:** Complete financial operations
**Location:** `scripts/{tables|indexes|constraints}/04-financial-management/`

```bash
# Verify Financial Management
psql -U postgres -d tartware -f tables/04-financial-management/verify-04-financial-management.sql
```

### 5. Services & Housekeeping
**Tables:** 4 (services, reservation_services, housekeeping_tasks, maintenance_requests)
**Purpose:** Service delivery and property operations
**Location:** `scripts/{tables|indexes|constraints}/05-services-housekeeping/`

```bash
# Verify Services & Housekeeping
psql -U postgres -d tartware -f tables/05-services-housekeeping/verify-05-services-housekeeping.sql
```

### 6. Channel Management & OTA
**Tables:** 7 (channel_managers, channel_mappings, rate_parity, commissions, etc.)
**Purpose:** OTA integrations and distribution
**Location:** `scripts/{tables|indexes|constraints}/06-channel-ota/`

```bash
# Verify Channel/OTA
psql -U postgres -d tartware -f tables/06-channel-ota/verify-06-channel-ota.sql
```

### 7. Guest Relations & CRM
**Tables:** 7 (guest_communications, loyalty_programs, feedback, profiles, etc.)
**Purpose:** Guest relationships and CRM
**Location:** `scripts/{tables|indexes|constraints}/07-guest-crm/`

```bash
# Verify Guest CRM
psql -U postgres -d tartware -f tables/07-guest-crm/verify-07-guest-crm.sql
```

### 8. Revenue Management
**Tables:** 7 (pricing_rules, dynamic_pricing, forecasts, competitor_rates, etc.)
**Purpose:** Revenue optimization and pricing
**Location:** `scripts/{tables|indexes|constraints}/08-revenue-management/`

```bash
# Verify Revenue Management
psql -U postgres -d tartware -f tables/08-revenue-management/verify-08-revenue-management.sql
```

### 9. Staff & Operations
**Tables:** 6 (staff_schedules, tasks, incidents, performance, training)
**Purpose:** Staff management and operations
**Location:** `scripts/{tables|indexes|constraints}/09-staff-operations/`

```bash
# Verify Staff Operations
psql -U postgres -d tartware -f tables/09-staff-operations/verify-09-staff-operations.sql
```

### 10. Marketing & Campaigns
**Tables:** 5 (marketing_campaigns, promotions, offers, vouchers, referrals)
**Purpose:** Marketing and promotional activities
**Location:** `scripts/{tables|indexes|constraints}/10-marketing-campaigns/`

```bash
# Verify Marketing
psql -U postgres -d tartware -f tables/10-marketing-campaigns/verify-10-marketing-campaigns.sql
```

### 11. Compliance & Legal
**Tables:** 4 (gdpr_consents, data_retention, contracts, insurance_policies)
**Purpose:** Legal compliance and data governance
**Location:** `scripts/{tables|indexes|constraints}/11-compliance-legal/`

```bash
# Verify Compliance
psql -U postgres -d tartware -f tables/11-compliance-legal/verify-11-compliance-legal.sql
```

### 12. Analytics & Reporting
**Tables:** 10 (analytics_metrics, reports, dashboards, ML models, etc.)
**Purpose:** Business intelligence and analytics
**Location:** `scripts/{tables|indexes|constraints}/12-analytics-reporting/`

```bash
# Verify Analytics
psql -U postgres -d tartware -f tables/12-analytics-reporting/verify-12-analytics-reporting.sql
```

### 13. Mobile & Digital
**Tables:** 4 (mobile_check_ins, digital_keys, qr_codes, push_notifications)
**Purpose:** Digital guest experience
**Location:** `scripts/{tables|indexes|constraints}/13-mobile-digital/`

```bash
# Verify Mobile/Digital
psql -U postgres -d tartware -f tables/13-mobile-digital/verify-13-mobile-digital.sql
```

### 14. System & Audit
**Tables:** 3 (audit_logs, business_dates, event_logs)
**Purpose:** System monitoring and audit trails
**Location:** `scripts/{tables|indexes|constraints}/14-system-audit/`

```bash
# Verify System/Audit
psql -U postgres -d tartware -f tables/14-system-audit/verify-14-system-audit.sql
```

### 15. Integration Hub
**Tables:** 4 (api_endpoints, api_logs, webhooks, sync_jobs)
**Purpose:** External integrations and APIs
**Location:** `scripts/{tables|indexes|constraints}/15-integration-hub/`

```bash
# Verify Integration Hub
psql -U postgres -d tartware -f tables/15-integration-hub/verify-15-integration-hub.sql
```

## Usage Scenarios

### Scenario 1: Fresh Installation Verification

```bash
# After running installation, verify everything
cd /home/navin/tartware/scripts
psql -U postgres -d tartware -f verify-all-categories.sql
```

**Expected:** All 15 categories pass with no warnings.

### Scenario 2: Debugging a Specific Category

```bash
# Developer reports issue with financial module
psql -U postgres -d tartware -f tables/04-financial-management/verify-04-financial-management.sql
psql -U postgres -d tartware -f indexes/04-financial-management/verify-04-financial-management-indexes.sql
psql -U postgres -d tartware -f constraints/04-financial-management/verify-04-financial-management-constraints.sql
```

**Expected:** Identifies missing indexes, constraints, or table issues in financial category only.

### Scenario 3: Incremental Development

```bash
# Just added new tables to Channel/OTA category
# Verify only that category
psql -U postgres -d tartware -f tables/06-channel-ota/verify-06-channel-ota.sql
```

**Expected:** Validates new tables have proper structure, indexes, constraints.

### Scenario 4: Team Collaboration

```bash
# Team A working on Reservations, Team B on Financial
# Each team verifies their category independently

# Team A:
psql -U postgres -d tartware -f tables/03-reservations-booking/verify-03-reservations-booking.sql

# Team B:
psql -U postgres -d tartware -f tables/04-financial-management/verify-04-financial-management.sql
```

**Expected:** Teams can work independently without conflicts.

## Automated Script Generation

All 45 verification scripts were generated using Python automation:

```bash
# Regenerate all table verifications (if needed)
python3 generate_category_verifications.py

# Regenerate all index verifications
python3 generate_index_verifications.py

# Regenerate all constraint verifications
python3 generate_constraint_verifications.py
```

**Generator Scripts Location:** `/home/navin/tartware/scripts/`

## Verification Output Interpretation

### ✅ Successful Verification

```
══════════════════════════════════════════════════════════
TARTWARE PMS - CATEGORY VERIFICATION
Category: Core Foundation (5 tables)
══════════════════════════════════════════════════════════

✅ All 5 tables exist
✅ All tables have UUID primary keys
✅ Multi-tenancy implemented (tenant_id in all tables)
✅ Soft delete implemented correctly
✅ Audit fields present
✅ Column counts match expected values

CATEGORY STATUS: PASS ✅
```

### ⚠️ Warning Detected

```
⚠️ WARNING: Table 'payments' missing index on 'payment_method'
⚠️ WARNING: Constraint naming convention violated in 'invoices'

CATEGORY STATUS: PASS WITH WARNINGS ⚠️
```

### ❌ Error Detected

```
❌ ERROR: Table 'room_types' missing tenant_id column
❌ ERROR: Foreign key constraint missing on 'rooms.property_id'

CATEGORY STATUS: FAIL ❌
```

## Best Practices

1. **Run category verification after each category installation:**
   ```bash
   # Install category
   psql -U postgres -d tartware -f tables/04-financial-management/*.sql

   # Verify immediately
   psql -U postgres -d tartware -f tables/04-financial-management/verify-04-financial-management.sql
   ```

2. **Use category verification for CI/CD:**
   - Each category can be tested independently
   - Faster feedback loops
   - Parallel testing possible

3. **Focus debugging efforts:**
   - Start with category-level verification
   - Identify problematic category
   - Run detailed verification for that category only

4. **Track category completion:**
   - Use verification status to track development progress
   - Green categories = ready for deployment
   - Red categories = need attention

## Integration with Master Verification

The category-level verification complements the master verification scripts:

- **Master verification** (`verify-all.sql`): High-level overview, quality score
- **Category verification** (`verify-all-categories.sql`): Detailed category-by-category analysis
- **Component verification** (`verify-tables.sql`): Specific component deep dive

**Recommended workflow:**
1. Run master verification for overall health check
2. If issues found, run category verification to identify problem area
3. Run component verification for specific component details
4. Fix issues in problematic category
5. Re-verify that category only
6. Re-run master verification to confirm fix

## Troubleshooting

### Issue: "File not found" error

```bash
# Ensure you're in the scripts directory
cd /home/navin/tartware/scripts

# Or use absolute paths
psql -U postgres -d tartware -f /home/navin/tartware/scripts/tables/01-core-foundation/verify-01-core-foundation.sql
```

### Issue: "Relation does not exist"

Category not installed yet. Run installation first:

```bash
# Install the category
psql -U postgres -d tartware -f tables/01-core-foundation/*.sql

# Then verify
psql -U postgres -d tartware -f tables/01-core-foundation/verify-01-core-foundation.sql
```

### Issue: Too much output

Redirect to file for analysis:

```bash
psql -U postgres -d tartware -f verify-all-categories.sql > verification-report.txt 2>&1
```

## Summary Statistics

- **Total Categories:** 15
- **Total Verification Scripts:** 45 (15 × 3 types)
- **Total Tables Verified:** 89
- **Total Indexes Verified:** 650+
- **Total Constraints Verified:** 89 constraint files
- **Generation Method:** Automated Python scripts
- **Maintenance:** Regenerate scripts if structure changes

## Support & Documentation

- **Main README:** `/home/navin/tartware/scripts/README.md`
- **Master verification:** `/home/navin/tartware/scripts/verify-all.sql`
- **Category verification:** `/home/navin/tartware/scripts/verify-all-categories.sql`
- **Generator scripts:** `/home/navin/tartware/scripts/generate_*.py`

---

**Last Updated:** 2025-10-19
**Version:** 1.0
**Database:** Tartware PMS PostgreSQL 16.10
