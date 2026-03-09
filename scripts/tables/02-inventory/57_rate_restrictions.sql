-- =====================================================
-- 57_rate_restrictions.sql
-- Rate Restrictions Table — Inventory controls per room type × rate plan × date
-- Industry Standard: OPERA Cloud, Mews, Cloudbeds — CTA/CTD/LOS/Closed restrictions
-- Pattern: Multi-tenant, soft-delete, UPSERT-safe
-- Date: 2025-06-23
-- =====================================================

-- =====================================================
-- RATE_RESTRICTIONS TABLE
-- Yield management inventory controls beyond price:
-- Closed to Arrival, Closed to Departure, Min/Max LOS,
-- Min/Max Advance Purchase, Closed (stop sell per rate code)
-- =====================================================

CREATE TABLE IF NOT EXISTS rate_restrictions (
    -- Primary Key
    restriction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Unique restriction identifier

    -- Multi-Tenancy
    tenant_id UUID NOT NULL, -- FK tenants.id
    property_id UUID NOT NULL, -- FK properties.id

    -- Targeting (NULL = applies to all)
    room_type_id UUID, -- FK room_types.id — NULL means all room types
    rate_plan_id UUID, -- FK rates.rate_plan_id — NULL means all rate plans

    -- Restriction Period
    restriction_date DATE NOT NULL, -- The specific date this restriction applies to

    -- Restriction Definition
    restriction_type VARCHAR(30) NOT NULL CHECK (
        restriction_type IN (
            'CTA',              -- Closed to Arrival
            'CTD',              -- Closed to Departure
            'MIN_LOS',          -- Minimum Length of Stay
            'MAX_LOS',          -- Maximum Length of Stay
            'MIN_ADVANCE',      -- Minimum Advance Purchase (days)
            'MAX_ADVANCE',      -- Maximum Advance Purchase (days)
            'CLOSED'            -- Completely closed for this rate code
        )
    ), -- Type of inventory restriction
    restriction_value INTEGER NOT NULL DEFAULT 1, -- Numeric value (LOS nights, advance days, or 1=active for CTA/CTD/CLOSED)

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true, -- Whether restriction is currently enforced

    -- Source & Reason
    source VARCHAR(50) NOT NULL DEFAULT 'manual' CHECK (
        source IN ('manual', 'rule_engine', 'channel_manager', 'import')
    ), -- How this restriction was created
    reason VARCHAR(500), -- Revenue manager notes explaining why

    -- Metadata
    metadata JSONB DEFAULT '{}', -- Additional context (e.g., linked pricing rule)

    -- Audit Fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID, -- FK users.id
    updated_by UUID, -- FK users.id

    -- Soft Delete
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID, -- FK users.id

    -- Uniqueness: one restriction per tenant × property × room_type × rate_plan × date × type
    CONSTRAINT uq_rate_restrictions_composite
        UNIQUE NULLS NOT DISTINCT (tenant_id, property_id, room_type_id, rate_plan_id, restriction_date, restriction_type)
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Primary lookup: restrictions for a property on a date range
CREATE INDEX IF NOT EXISTS idx_rate_restrictions_property_date
    ON rate_restrictions (tenant_id, property_id, restriction_date)
    WHERE is_deleted = false;

-- Filter by restriction type
CREATE INDEX IF NOT EXISTS idx_rate_restrictions_type
    ON rate_restrictions (tenant_id, property_id, restriction_type, restriction_date)
    WHERE is_deleted = false AND is_active = true;

-- Room type targeting
CREATE INDEX IF NOT EXISTS idx_rate_restrictions_room_type
    ON rate_restrictions (tenant_id, property_id, room_type_id, restriction_date)
    WHERE is_deleted = false AND is_active = true;

-- Rate plan targeting
CREATE INDEX IF NOT EXISTS idx_rate_restrictions_rate_plan
    ON rate_restrictions (tenant_id, property_id, rate_plan_id, restriction_date)
    WHERE is_deleted = false AND is_active = true;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE rate_restrictions IS 'Yield management inventory controls: CTA, CTD, LOS, advance purchase, and stop-sell restrictions per room type, rate plan, and date';

COMMENT ON COLUMN rate_restrictions.restriction_id IS 'Unique identifier for this restriction entry';
COMMENT ON COLUMN rate_restrictions.tenant_id IS 'Tenant that owns this restriction';
COMMENT ON COLUMN rate_restrictions.property_id IS 'Property this restriction applies to';
COMMENT ON COLUMN rate_restrictions.room_type_id IS 'Target room type — NULL applies to all room types';
COMMENT ON COLUMN rate_restrictions.rate_plan_id IS 'Target rate plan — NULL applies to all rate plans';
COMMENT ON COLUMN rate_restrictions.restriction_date IS 'Calendar date the restriction is in effect';
COMMENT ON COLUMN rate_restrictions.restriction_type IS 'Type of restriction: CTA, CTD, MIN_LOS, MAX_LOS, MIN_ADVANCE, MAX_ADVANCE, CLOSED';
COMMENT ON COLUMN rate_restrictions.restriction_value IS 'Numeric value — nights for LOS, days for advance purchase, 1 for boolean types (CTA/CTD/CLOSED)';
COMMENT ON COLUMN rate_restrictions.is_active IS 'Whether this restriction is currently being enforced';
COMMENT ON COLUMN rate_restrictions.source IS 'Origin of restriction: manual entry, rule engine, channel manager, or import';
COMMENT ON COLUMN rate_restrictions.reason IS 'Revenue manager explanation for setting this restriction';

\echo 'rate_restrictions table created successfully!'
