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
    channel_code VARCHAR(50), -- Distribution channel this restriction targets — NULL means every channel

    -- Scope: which of the targeting columns this row is actually about.
    -- Derivable from the NULLs above for the first three, but a channel
    -- restriction and a property-wide one are otherwise indistinguishable, and
    -- the evaluator resolves conflicts by scope precedence rather than by
    -- guessing from NULLs.
    scope VARCHAR(20) NOT NULL DEFAULT 'PROPERTY' CHECK (
        scope IN ('PROPERTY', 'ROOM_TYPE', 'RATE', 'CHANNEL')
    ), -- PROPERTY < ROOM_TYPE < RATE < CHANNEL; the most specific rule for a date wins

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
            'CLOSED',           -- Completely closed for this rate code
            'SELL_LIMIT'        -- Ceiling on rooms sellable for the date within this scope
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

    -- Uniqueness: one restriction per tenant × property × scope target × date × type.
    -- channel_code joins the key so an OTA-specific stop-sell can coexist with
    -- the property's own for the same date.
    CONSTRAINT uq_rate_restrictions_composite
        UNIQUE NULLS NOT DISTINCT (tenant_id, property_id, room_type_id, rate_plan_id, channel_code, restriction_date, restriction_type)
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

-- The evaluator's read: every active rule covering one stay window, any scope.
-- One index scan per booking, so it has to be the exact shape of that query.
CREATE INDEX IF NOT EXISTS idx_rate_restrictions_window
    ON rate_restrictions (tenant_id, property_id, restriction_date, restriction_type)
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
-- channel_code and scope are commented in the migration section below: on an
-- already deployed database they do not exist until the ALTER has run.

-- =====================================================
-- IDEMPOTENT MIGRATION (already-deployed databases)
-- The canonical CREATE above is the source of truth; these bring an existing
-- table up to it. Columns are commented here rather than in the block above
-- because on a deployed database they do not exist until this has run.
-- =====================================================

ALTER TABLE rate_restrictions ADD COLUMN IF NOT EXISTS channel_code VARCHAR(50);
COMMENT ON COLUMN rate_restrictions.channel_code IS 'Distribution channel this restriction targets (booking_sources.source_code or an OTA code); NULL applies to every channel';

ALTER TABLE rate_restrictions ADD COLUMN IF NOT EXISTS scope VARCHAR(20) NOT NULL DEFAULT 'PROPERTY';
COMMENT ON COLUMN rate_restrictions.scope IS 'What the restriction is about: PROPERTY, ROOM_TYPE, RATE or CHANNEL. Precedence runs in that order — the most specific rule for a date and type is the one enforced.';

DO $$
BEGIN
    -- Widen the type check to admit SELL_LIMIT.
    ALTER TABLE rate_restrictions DROP CONSTRAINT IF EXISTS rate_restrictions_restriction_type_check;
    ALTER TABLE rate_restrictions ADD CONSTRAINT rate_restrictions_restriction_type_check
        CHECK (restriction_type IN (
            'CTA', 'CTD', 'MIN_LOS', 'MAX_LOS',
            'MIN_ADVANCE', 'MAX_ADVANCE', 'CLOSED', 'SELL_LIMIT'
        ));

    ALTER TABLE rate_restrictions DROP CONSTRAINT IF EXISTS rate_restrictions_scope_check;
    ALTER TABLE rate_restrictions ADD CONSTRAINT rate_restrictions_scope_check
        CHECK (scope IN ('PROPERTY', 'ROOM_TYPE', 'RATE', 'CHANNEL'));
END
$$;

-- Backfill scope from the targeting columns of rows written before it existed.
-- Most specific target wins, matching how the evaluator reads them.
UPDATE rate_restrictions
SET scope = CASE
        WHEN channel_code IS NOT NULL THEN 'CHANNEL'
        WHEN rate_plan_id IS NOT NULL THEN 'RATE'
        WHEN room_type_id IS NOT NULL THEN 'ROOM_TYPE'
        ELSE 'PROPERTY'
    END
WHERE scope = 'PROPERTY'
  AND (room_type_id IS NOT NULL OR rate_plan_id IS NOT NULL OR channel_code IS NOT NULL);

-- Channel targeting (stop-sell propagation, channel-specific sell limits).
-- Lives here rather than with the other indexes because it references a column
-- the ALTER above is what creates.
CREATE INDEX IF NOT EXISTS idx_rate_restrictions_channel
    ON rate_restrictions (tenant_id, property_id, channel_code, restriction_date)
    WHERE is_deleted = false AND is_active = true AND channel_code IS NOT NULL;

-- Rebuild the uniqueness key to include channel_code.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_rate_restrictions_composite'
          AND conrelid = 'rate_restrictions'::regclass
          AND array_length(conkey, 1) = 6
    ) THEN
        ALTER TABLE rate_restrictions DROP CONSTRAINT uq_rate_restrictions_composite;
        ALTER TABLE rate_restrictions ADD CONSTRAINT uq_rate_restrictions_composite
            UNIQUE NULLS NOT DISTINCT (tenant_id, property_id, room_type_id, rate_plan_id, channel_code, restriction_date, restriction_type);
        RAISE NOTICE 'rate_restrictions: uniqueness key widened to include channel_code';
    END IF;
END
$$;

\echo 'rate_restrictions table created successfully!'
