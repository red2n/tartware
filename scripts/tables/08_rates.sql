-- =====================================================
-- rates.sql
-- Rates Table
-- Industry Standard: Rate plans and pricing strategies
-- Pattern: Oracle OPERA Rate Code, Cloudbeds Rate Plan
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating rates table...'

-- =====================================================
-- RATES TABLE
-- Rate plans (pricing strategies)
-- Different rates for different customer segments
-- =====================================================

CREATE TABLE IF NOT EXISTS rates (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy & Hierarchy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,
    room_type_id UUID NOT NULL,

    -- Basic Information
    rate_name VARCHAR(255) NOT NULL,
    rate_code VARCHAR(50) NOT NULL,

    -- Description
    description TEXT,

    -- Rate Strategy
    strategy rate_strategy NOT NULL DEFAULT 'FIXED',

    -- Pricing
    base_rate DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',

    -- Occupancy-Based Pricing
    single_occupancy_rate DECIMAL(15,2),
    double_occupancy_rate DECIMAL(15,2),
    extra_person_rate DECIMAL(15,2),
    extra_child_rate DECIMAL(15,2),

    -- Date Range
    valid_from DATE NOT NULL,
    valid_until DATE,

    -- Booking Window
    advance_booking_days_min INTEGER DEFAULT 0,
    advance_booking_days_max INTEGER,

    -- Stay Restrictions
    min_length_of_stay INTEGER DEFAULT 1,
    max_length_of_stay INTEGER,
    closed_to_arrival BOOLEAN DEFAULT false,
    closed_to_departure BOOLEAN DEFAULT false,

    -- Meal Plan
    meal_plan VARCHAR(50),
    meal_plan_cost DECIMAL(15,2) DEFAULT 0.00,

    -- Cancellation Policy
    cancellation_policy JSONB DEFAULT '{
        "hours": 24,
        "penalty": 0,
        "type": "flexible"
    }'::jsonb,

    -- Rate Modifiers
    modifiers JSONB DEFAULT '{
        "weekendSurcharge": 0,
        "seasonalModifier": 0,
        "discounts": []
    }'::jsonb,

    -- Channels (where this rate is available)
    channels JSONB DEFAULT '["direct", "ota", "phone", "walk_in"]'::jsonb,

    -- Customer Segments
    customer_segments JSONB DEFAULT '["all"]'::jsonb,

    -- Tax Configuration
    tax_inclusive BOOLEAN DEFAULT false,
    tax_rate DECIMAL(5,2) DEFAULT 0.00,

    -- Status
    status rate_status NOT NULL DEFAULT 'ACTIVE',

    -- Display Order
    display_order INTEGER DEFAULT 0,

    -- Custom Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100),

    -- Soft Delete
    deleted_at TIMESTAMP,
    deleted_by VARCHAR(100),

    -- Optimistic Locking
    version BIGINT DEFAULT 0,

    -- Constraints
    CONSTRAINT rates_code_unique UNIQUE (property_id, rate_code),
    CONSTRAINT rates_code_format CHECK (rate_code ~ '^[A-Z0-9_-]+$'),
    CONSTRAINT rates_base_rate_check CHECK (base_rate >= 0),
    CONSTRAINT rates_valid_dates CHECK (valid_from < valid_until OR valid_until IS NULL),
    CONSTRAINT rates_los_check CHECK (min_length_of_stay <= max_length_of_stay OR max_length_of_stay IS NULL),
    CONSTRAINT rates_advance_booking CHECK (advance_booking_days_min <= advance_booking_days_max OR advance_booking_days_max IS NULL)
);

-- =====================================================
-- TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE rates IS 'Rate plans and pricing strategies';
COMMENT ON COLUMN rates.id IS 'Unique rate identifier (UUID)';
COMMENT ON COLUMN rates.tenant_id IS 'Reference to tenants.id';
COMMENT ON COLUMN rates.property_id IS 'Reference to properties.id';
COMMENT ON COLUMN rates.room_type_id IS 'Reference to room_types.id';
COMMENT ON COLUMN rates.rate_name IS 'Display name (e.g., Best Available Rate, Corporate Rate)';
COMMENT ON COLUMN rates.rate_code IS 'Unique code within property (e.g., BAR, CORP)';
COMMENT ON COLUMN rates.strategy IS 'ENUM: standard, dynamic, package, promotional, corporate, government, group';
COMMENT ON COLUMN rates.base_rate IS 'Base price per night';
COMMENT ON COLUMN rates.single_occupancy_rate IS 'Rate for single occupancy (optional override)';
COMMENT ON COLUMN rates.double_occupancy_rate IS 'Rate for double occupancy (optional override)';
COMMENT ON COLUMN rates.extra_person_rate IS 'Additional charge per extra person';
COMMENT ON COLUMN rates.valid_from IS 'Rate valid from date';
COMMENT ON COLUMN rates.valid_until IS 'Rate valid until date (NULL = no end date)';
COMMENT ON COLUMN rates.min_length_of_stay IS 'Minimum nights required';
COMMENT ON COLUMN rates.max_length_of_stay IS 'Maximum nights allowed';
COMMENT ON COLUMN rates.closed_to_arrival IS 'Cannot check in on this rate';
COMMENT ON COLUMN rates.closed_to_departure IS 'Cannot check out on this rate';
COMMENT ON COLUMN rates.meal_plan IS 'EP (European), CP (Continental), MAP (Modified American), AP (American)';
COMMENT ON COLUMN rates.cancellation_policy IS 'Cancellation terms (JSONB)';
COMMENT ON COLUMN rates.channels IS 'Distribution channels where rate is available';
COMMENT ON COLUMN rates.status IS 'ENUM: active, inactive, archived';
COMMENT ON COLUMN rates.deleted_at IS 'Soft delete timestamp (NULL = active)';

\echo 'Rates table created successfully!'
