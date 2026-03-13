-- =====================================================
-- Rate Seasons Configuration Table
-- =====================================================
-- Purpose: Define named seasonal periods with date ranges
--          and rate multipliers for dynamic pricing
-- Key Features:
--   - Named season definitions with start/end dates
--   - Rate multiplier for base rate adjustments
--   - Minimum stay requirements per season
--   - Recurrence support (yearly repeat)
--   - Priority-based overlap resolution
-- =====================================================

CREATE TABLE IF NOT EXISTS rate_seasons (
    -- Primary Key
    season_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Unique season config

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,     -- FK tenants.id
    property_id UUID NOT NULL,   -- FK properties.id

    -- Season Definition
    season_name VARCHAR(100) NOT NULL,           -- Display name (e.g., "Summer Peak")
    season_type VARCHAR(20) NOT NULL CHECK (
        season_type IN (
            'LOW',
            'SHOULDER',
            'HIGH',
            'PEAK',
            'SPECIAL_EVENT',
            'OFF'
        )
    ),                                            -- Season classification
    description TEXT,                             -- Season notes/description

    -- Date Range
    start_date DATE NOT NULL,                    -- Season start (inclusive)
    end_date DATE NOT NULL,                      -- Season end (inclusive)

    -- Rate Adjustments
    rate_multiplier DECIMAL(5, 4) DEFAULT 1.0000, -- Multiplier applied to base rates
    min_stay INTEGER DEFAULT 1,                   -- Minimum night stay requirement
    max_discount_percent DECIMAL(5, 2) DEFAULT 0, -- Maximum allowed discount during season

    -- Configuration
    priority INTEGER DEFAULT 0,                   -- Higher priority wins on overlap
    recurrence_type VARCHAR(10) DEFAULT 'NONE' CHECK (
        recurrence_type IN ('NONE', 'YEARLY')
    ),                                            -- Whether season repeats annually
    is_active BOOLEAN DEFAULT TRUE,               -- Active toggle
    applies_to_room_types UUID[],                 -- Optional room type filter (NULL = all)

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),         -- Record creation timestamp
    updated_at TIMESTAMPTZ DEFAULT NOW(),         -- Last modification timestamp
    created_by UUID,                              -- User who created the record
    updated_by UUID,                              -- User who last updated the record

    -- Constraints
    CONSTRAINT rate_seasons_date_range CHECK (end_date >= start_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rate_seasons_tenant_property
    ON rate_seasons(tenant_id, property_id);

CREATE INDEX IF NOT EXISTS idx_rate_seasons_dates
    ON rate_seasons(start_date, end_date)
    WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_rate_seasons_type
    ON rate_seasons(tenant_id, property_id, season_type);

-- Unique constraint: no duplicate season names per property
CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_seasons_unique_name
    ON rate_seasons(tenant_id, property_id, season_name)
    WHERE is_active = TRUE;

-- Comments
COMMENT ON TABLE rate_seasons IS 'Configurable seasonal periods with date ranges and rate multipliers for dynamic pricing';
COMMENT ON COLUMN rate_seasons.season_type IS 'Season classification: LOW, SHOULDER, HIGH, PEAK, SPECIAL_EVENT, OFF';
COMMENT ON COLUMN rate_seasons.rate_multiplier IS 'Multiplier applied to base rates (e.g., 1.25 = 25% increase)';
COMMENT ON COLUMN rate_seasons.priority IS 'Higher value takes precedence when seasons overlap';
COMMENT ON COLUMN rate_seasons.recurrence_type IS 'NONE = one-time, YEARLY = repeats every year on same dates';
COMMENT ON COLUMN rate_seasons.applies_to_room_types IS 'Array of room_type IDs this season applies to (NULL = all room types)';
