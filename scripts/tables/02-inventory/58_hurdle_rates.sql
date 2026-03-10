-- =====================================================
-- 58_hurdle_rates.sql
-- Hurdle Rates Table — Minimum acceptable rates per room type × date
-- Industry Standard: IDeaS G3, Duetto, Atomize — displacement-based hurdle rates
-- Pattern: Multi-tenant, soft-delete, UPSERT-safe
-- Date: 2025-06-23
-- =====================================================

-- =====================================================
-- HURDLE_RATES TABLE
-- Minimum rate below which a room should not be sold for a
-- given room type on a given date. Driven by segment
-- displacement analysis and marginal cost of unsold inventory.
-- =====================================================

CREATE TABLE IF NOT EXISTS hurdle_rates (
    -- Primary Key
    hurdle_rate_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Unique hurdle rate identifier

    -- Multi-Tenancy
    tenant_id UUID NOT NULL, -- FK tenants.id
    property_id UUID NOT NULL, -- FK properties.id

    -- Targeting
    room_type_id UUID NOT NULL, -- FK room_types.id — hurdle rate per room type

    -- Date
    hurdle_date DATE NOT NULL, -- The specific date this hurdle rate applies to

    -- Hurdle Rate
    hurdle_rate DECIMAL(12,2) NOT NULL CHECK (hurdle_rate >= 0), -- Minimum acceptable rate in property currency
    currency VARCHAR(3) NOT NULL DEFAULT 'USD', -- Currency code (ISO 4217)

    -- Segmentation
    segment VARCHAR(50), -- Market segment (transient, corporate, group, wholesale, etc.)

    -- Source
    source VARCHAR(30) NOT NULL DEFAULT 'manual' CHECK (
        source IN ('manual', 'calculated', 'imported')
    ), -- How this hurdle rate was determined

    -- Displacement Analysis (for calculated hurdle rates)
    displacement_analysis JSONB DEFAULT '{}', -- Analysis data: opportunity cost, demand forecast, segment mix

    -- Confidence
    confidence_score DECIMAL(5,2) CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 100)), -- Confidence in calculated hurdle rate (0-100%)

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true, -- Whether this hurdle rate is currently in effect

    -- Notes
    notes VARCHAR(500), -- Revenue manager notes

    -- Metadata
    metadata JSONB DEFAULT '{}', -- Additional context

    -- Audit Fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID, -- FK users.id
    updated_by UUID, -- FK users.id

    -- Soft Delete
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID, -- FK users.id

    -- Uniqueness: one hurdle rate per tenant × property × room_type × date × segment
    CONSTRAINT uq_hurdle_rates_composite
        UNIQUE NULLS NOT DISTINCT (tenant_id, property_id, room_type_id, hurdle_date, segment)
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Primary lookup: hurdle rates for a property on a date range
CREATE INDEX IF NOT EXISTS idx_hurdle_rates_property_date
    ON hurdle_rates (tenant_id, property_id, hurdle_date)
    WHERE is_deleted = false;

-- Room type lookup
CREATE INDEX IF NOT EXISTS idx_hurdle_rates_room_type
    ON hurdle_rates (tenant_id, property_id, room_type_id, hurdle_date)
    WHERE is_deleted = false AND is_active = true;

-- Segment lookup
CREATE INDEX IF NOT EXISTS idx_hurdle_rates_segment
    ON hurdle_rates (tenant_id, property_id, segment, hurdle_date)
    WHERE is_deleted = false AND is_active = true;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE hurdle_rates IS 'Minimum acceptable room rates (hurdle/floor rates) per room type and date, driven by displacement analysis and marginal cost of unsold inventory';

COMMENT ON COLUMN hurdle_rates.hurdle_rate_id IS 'Unique identifier for this hurdle rate entry';
COMMENT ON COLUMN hurdle_rates.tenant_id IS 'Tenant that owns this hurdle rate';
COMMENT ON COLUMN hurdle_rates.property_id IS 'Property this hurdle rate applies to';
COMMENT ON COLUMN hurdle_rates.room_type_id IS 'Room type this hurdle rate targets';
COMMENT ON COLUMN hurdle_rates.hurdle_date IS 'Calendar date the hurdle rate is in effect';
COMMENT ON COLUMN hurdle_rates.hurdle_rate IS 'Minimum acceptable rate — do not sell below this amount';
COMMENT ON COLUMN hurdle_rates.currency IS 'Currency code for the hurdle rate (ISO 4217)';
COMMENT ON COLUMN hurdle_rates.segment IS 'Market segment this hurdle rate applies to (NULL = all segments)';
COMMENT ON COLUMN hurdle_rates.source IS 'How hurdle rate was determined: manual, calculated, or imported';
COMMENT ON COLUMN hurdle_rates.displacement_analysis IS 'JSON analysis data: opportunity cost, demand forecast, expected revenue if held';
COMMENT ON COLUMN hurdle_rates.confidence_score IS 'Confidence level in calculated hurdle rate (0-100%)';
COMMENT ON COLUMN hurdle_rates.is_active IS 'Whether this hurdle rate is currently being enforced';
COMMENT ON COLUMN hurdle_rates.notes IS 'Revenue manager notes or justification';

\echo 'hurdle_rates table created successfully!'
