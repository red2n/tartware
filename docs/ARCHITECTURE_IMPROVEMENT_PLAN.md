# Architecture Improvement Plan: Annual Standards Adaptability

> **Goal**: Enable annual industry standard updates with minimal code changes

## Executive Summary

This document outlines a 4-phase improvement to make Tartware adaptable to changing hospitality industry standards without requiring code deployments for common reference data changes.

---

## Phase 1: Dynamic Enums (Reference Data Tables)

### Problem
Currently 70+ enums are hardcoded in `schema/src/shared/enums.ts` requiring:
1. TypeScript code change
2. PostgreSQL `ALTER TYPE` migration
3. Schema package rebuild
4. Redeploy 7+ services

### Solution: Convert High-Churn Enums to Lookup Tables

#### Enums to Migrate (High Industry Variance)

| Enum | Current Location | New Table | Rationale |
|------|------------------|-----------|-----------|
| `RoomStatusEnum` | enums.ts | `room_status_codes` | Industry adds new statuses (Sleep Out, etc.) |
| `RoomCategoryEnum` | enums.ts | `room_categories` | Properties define custom categories |
| `RateTypeEnum` | enums.ts | `rate_types` | OTAs introduce new rate types |
| `PaymentMethodEnum` | enums.ts | `payment_methods` | New payment methods (crypto, BNPL) |
| `GroupBookingTypeEnum` | enums.ts | `group_booking_types` | New event types emerge |
| `CompanyTypeEnum` | enums.ts | `company_types` | B2B partner types evolve |
| `ReservationSourceEnum` | enums.ts | **Already exists**: `booking_sources` | ✅ Done |

#### Enums to Keep Hardcoded (System/Workflow States)

| Enum | Reason |
|------|--------|
| `ReservationStatusEnum` | Workflow states hardwired in business logic |
| `PaymentStatusEnum` | Transaction lifecycle states |
| `OutboxStatusEnum` | Infrastructure states |
| `SettingsScopeEnum` | System architecture |
| All `*StatusEnum` | State machines in code |

### Implementation: Reference Data Table Pattern

```sql
-- Example: room_status_codes.sql
CREATE TABLE room_status_codes (
    status_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    property_id UUID,                    -- NULL for tenant-level

    -- Code & Name
    code VARCHAR(30) NOT NULL,           -- e.g., "VC", "VD", "OC", "SO"
    name VARCHAR(100) NOT NULL,          -- e.g., "Vacant Clean"
    description TEXT,

    -- Behavior Flags
    is_occupied BOOLEAN DEFAULT FALSE,
    is_sellable BOOLEAN DEFAULT TRUE,
    is_clean BOOLEAN DEFAULT FALSE,
    requires_housekeeping BOOLEAN DEFAULT FALSE,

    -- Transition Rules
    allowed_next_statuses VARCHAR(30)[],  -- Valid state transitions

    -- Display
    display_order INTEGER DEFAULT 0,
    color_code VARCHAR(7),
    icon VARCHAR(50),

    -- Lifecycle
    is_system BOOLEAN DEFAULT FALSE,      -- System defaults, can't delete
    is_active BOOLEAN DEFAULT TRUE,

    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uk_room_status_codes UNIQUE (tenant_id, property_id, code)
);

-- Seed system defaults
INSERT INTO room_status_codes (tenant_id, code, name, is_occupied, is_sellable, is_clean, is_system) VALUES
('00000000-0000-0000-0000-000000000000', 'VC', 'Vacant Clean', false, true, true, true),
('00000000-0000-0000-0000-000000000000', 'VD', 'Vacant Dirty', false, false, false, true),
('00000000-0000-0000-0000-000000000000', 'OC', 'Occupied Clean', true, false, true, true),
('00000000-0000-0000-0000-000000000000', 'OD', 'Occupied Dirty', true, false, false, true),
('00000000-0000-0000-0000-000000000000', 'OOO', 'Out of Order', false, false, false, true),
('00000000-0000-0000-0000-000000000000', 'OOS', 'Out of Service', false, false, false, true),
('00000000-0000-0000-0000-000000000000', 'INS', 'Inspected', false, true, true, true),
('00000000-0000-0000-0000-000000000000', 'DND', 'Do Not Disturb', true, false, false, true),
('00000000-0000-0000-0000-000000000000', 'SO', 'Sleep Out', true, false, false, true);
```

### TypeScript Integration

```typescript
// Instead of z.enum(), use a runtime-validated string with known values hint
export const RoomStatusCodeSchema = z.string()
  .min(1)
  .max(30)
  .describe('Room status code from room_status_codes table');

// Type hint for IDE autocomplete (known values as of 2026-02)
export type KnownRoomStatusCode = 'VC' | 'VD' | 'OC' | 'OD' | 'OOO' | 'OOS' | 'INS' | 'DND' | 'SO';

// Runtime validation happens at API layer against database
```

---

## Phase 2: Enum Migration Automation

### Problem
No automated sync between TypeScript enums and PostgreSQL types.

### Solution: Migration Templates + Validation

#### Directory Structure
```
scripts/
├── migrations/
│   ├── 00-schema-migrations-table.sql
│   └── enums/
│       ├── TEMPLATE.sql.example
│       ├── 2026-02-05-add-sleep-out-room-status.sql
│       └── README.md
```

#### Migration Template
```sql
-- Migration: [YYYY-MM-DD]-[description].sql
-- Author: [name]
-- Reason: [industry standard reference]
-- Affects: [list of tables using this type]

-- Check: Does the value already exist?
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'MOBILE_APP'
        AND enumtypid = 'reservation_source'::regtype
    ) THEN
        ALTER TYPE reservation_source ADD VALUE 'MOBILE_APP';
    END IF;
END $$;

-- Reminder: Update schema/src/shared/enums.ts with this value
-- Reminder: Update hospitality-standards/01-overview/glossary.md if new term
```

#### Pre-commit Hook
```bash
#!/bin/bash
# .husky/pre-commit

# Check enum sync between TypeScript and SQL
node scripts/validate-enum-sync.mjs
```

---

## Phase 3: Region-Aware Compliance

### Problem
Compliance settings (GDPR, CCPA, LGPD, police registration) are tenant-scoped, not region-scoped.

### Solution: Add Region Dimension to Settings

#### Schema Change
```sql
-- Add region_code to settings_values
ALTER TABLE settings_values
ADD COLUMN region_code VARCHAR(10) DEFAULT NULL;

-- Example: GDPR settings apply to EU region
-- region_code: 'EU', 'US', 'US-CA' (California), 'BR' (Brazil LGPD), etc.

-- Create region-specific consent requirements
CREATE TABLE compliance_region_requirements (
    requirement_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    region_code VARCHAR(10) NOT NULL,    -- ISO 3166-1/2
    regulation_name VARCHAR(100) NOT NULL, -- 'GDPR', 'CCPA', 'LGPD'

    -- Consent Requirements
    requires_explicit_consent BOOLEAN DEFAULT TRUE,
    consent_types_required JSONB,         -- ['marketing', 'analytics', 'thirdParty']

    -- Data Retention
    max_retention_days INTEGER,
    requires_deletion_on_request BOOLEAN DEFAULT TRUE,

    -- Guest Registration
    requires_police_report BOOLEAN DEFAULT FALSE,
    police_report_fields JSONB,           -- ['passport', 'nationality', 'dob', ...]
    police_report_deadline_hours INTEGER,

    -- Special Requirements
    special_requirements JSONB,

    -- Effective Dates
    effective_from DATE NOT NULL,
    effective_until DATE,

    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed regional requirements
INSERT INTO compliance_region_requirements (region_code, regulation_name, requires_explicit_consent, requires_police_report) VALUES
('EU', 'GDPR', true, false),
('US-CA', 'CCPA', false, false),  -- CCPA is opt-out, not opt-in
('BR', 'LGPD', true, false),
('ES', 'GDPR', true, true),       -- Spain: police registration required
('IT', 'GDPR', true, true),       -- Italy: schedina required
('IN', 'PDPA', true, true);       -- India: Form C for foreigners
```

#### Settings Service Integration
```typescript
// When fetching settings, include region context
async function getComplianceSettings(
  tenantId: string,
  propertyId: string,
  guestCountry?: string  // Guest's nationality for police requirements
): Promise<ComplianceSettings> {
  const property = await getProperty(propertyId);
  const propertyRegion = property.country_code;

  // Get region-specific requirements
  const requirements = await db.query(`
    SELECT * FROM compliance_region_requirements
    WHERE region_code = $1 AND is_active = true
  `, [propertyRegion]);

  // Merge with tenant settings
  return mergeSettings(tenantSettings, requirements);
}
```

---

## Phase 4: Extension Points (Hooks)

### Problem
No way for tenants to add custom behavior without code changes.

### Solution: Event-Based Hook System

#### Hook Points
```typescript
// Core hook points in reservation flow
export const HOOK_POINTS = {
  // Reservation Lifecycle
  'reservation.beforeCreate': { input: 'CreateReservationPayload' },
  'reservation.afterCreate': { input: 'Reservation' },
  'reservation.beforeModify': { input: 'ModifyReservationPayload' },
  'reservation.afterModify': { input: 'Reservation' },
  'reservation.beforeCancel': { input: 'CancelReservationPayload' },
  'reservation.afterCancel': { input: 'Reservation' },

  // Check-in/out
  'guest.beforeCheckIn': { input: 'CheckInPayload' },
  'guest.afterCheckIn': { input: 'CheckInResult' },
  'guest.beforeCheckOut': { input: 'CheckOutPayload' },
  'guest.afterCheckOut': { input: 'CheckOutResult' },

  // Housekeeping
  'room.statusChanged': { input: 'RoomStatusChangeEvent' },
  'housekeeping.taskCompleted': { input: 'HousekeepingTask' },

  // Financial
  'folio.chargePosted': { input: 'FolioCharge' },
  'payment.received': { input: 'Payment' },

  // Rate
  'rate.beforeCalculate': { input: 'RateCalculationContext' },
  'rate.afterCalculate': { input: 'CalculatedRate' },
} as const;
```

#### Hook Registration Table
```sql
CREATE TABLE tenant_hooks (
    hook_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    property_id UUID,

    -- Hook Configuration
    hook_point VARCHAR(100) NOT NULL,    -- e.g., 'reservation.afterCreate'
    hook_name VARCHAR(200) NOT NULL,

    -- Execution
    execution_type VARCHAR(20) NOT NULL
        CHECK (execution_type IN ('WEBHOOK', 'INTERNAL', 'KAFKA')),
    webhook_url VARCHAR(500),
    webhook_headers JSONB,
    kafka_topic VARCHAR(255),

    -- Filtering
    filter_conditions JSONB,              -- When to trigger

    -- Ordering
    priority INTEGER DEFAULT 100,         -- Lower = earlier

    -- Error Handling
    retry_count INTEGER DEFAULT 3,
    timeout_ms INTEGER DEFAULT 5000,
    on_failure VARCHAR(20) DEFAULT 'LOG'
        CHECK (on_failure IN ('LOG', 'ABORT', 'CONTINUE')),

    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Implementation Priority

| Phase | Effort | Impact | Timeline |
|-------|--------|--------|----------|
| **Phase 1: Dynamic Enums** | Medium | High | 2-3 weeks |
| **Phase 2: Enum Automation** | Low | Medium | 1 week |
| **Phase 3: Region Compliance** | Medium | High | 2 weeks |
| **Phase 4: Extension Points** | High | High | 4-6 weeks |

## Migration Strategy

### For Existing Enums
1. Create new lookup table with system defaults
2. Add foreign key to tables currently using enum type
3. Migrate data: `UPDATE rooms SET status_code_id = (SELECT id FROM room_status_codes WHERE code = rooms.status)`
4. Keep old enum column temporarily for rollback
5. After validation period, drop old column

### Backward Compatibility
- TypeScript schemas accept both known enum values and database-defined values
- API responses include both code and name from lookup tables
- Old enum values continue to work during migration period

---

## Files to Create/Modify

### New Files
```
scripts/tables/09-reference-data/
├── 01_room_status_codes.sql
├── 02_room_categories.sql
├── 03_rate_types.sql
├── 04_payment_methods.sql
├── 05_group_booking_types.sql
├── 06_company_types.sql
└── 07_compliance_region_requirements.sql

scripts/migrations/enums/
├── README.md
└── TEMPLATE.sql.example

scripts/validate-enum-sync.mjs

Apps/settings-service/src/data/catalog/
└── region-compliance.ts

schema/src/shared/
└── reference-data-types.ts  # Runtime string types for lookup tables
```

### Modified Files
```
schema/src/shared/enums.ts           # Mark deprecated enums, add runtime types
scripts/02-enum-types.sql            # Add deprecation comments
Apps/rooms-service/                  # Use lookup table for room status
Apps/core-service/                   # Add region detection
Apps/settings-service/               # Add region-aware settings resolution
```

---

## Success Criteria

After implementation:

| Change Type | Before | After |
|-------------|--------|-------|
| Add new room status | 5 steps, redeploy | 1 SQL insert |
| Add new payment method | 5 steps, redeploy | 1 SQL insert |
| Add new rate type | 5 steps, redeploy | 1 SQL insert |
| New country's compliance | Code change | Database config |
| Tenant-specific status codes | Not possible | Self-service |

---

## Next Steps

1. **Review & Approve** this plan
2. **Phase 1 Sprint**: Create lookup tables for top 3 enums
3. **Phase 2 Sprint**: Add enum sync validation
4. **Phase 3 Sprint**: Region-aware compliance
5. **Phase 4 Sprint**: Hook system (can be separate initiative)

---

**Author**: GitHub Copilot
**Date**: February 2026
**Version**: 1.0
