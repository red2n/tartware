-- =====================================================
-- rates.sql
-- Rates Table
-- Industry Standard: Rate plans and pricing strategies
-- Pattern: Oracle OPERA Rate Code, Cloudbeds Rate Plan
-- Date: 2025-10-15
-- =====================================================

\c tartware \echo 'Creating rates table...'

-- =====================================================
-- RATES TABLE
-- Rate plans (pricing strategies)
-- Different rates for different customer segments
-- =====================================================

CREATE TABLE IF NOT EXISTS rates (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Unique rate plan identifier

-- Multi-Tenancy & Hierarchy
tenant_id UUID NOT NULL, -- FK tenants.id
property_id UUID NOT NULL, -- FK properties.id
room_type_id UUID NOT NULL, -- FK room_types.id linking to inventory

-- Basic Information
rate_name VARCHAR(255) NOT NULL, -- Display name (Best Available Rate)
rate_code VARCHAR(50) NOT NULL, -- Short code for integrations

-- Description
description TEXT, -- Marketing copy/long description

-- Rate Strategy
strategy rate_strategy NOT NULL DEFAULT 'FIXED', -- Pricing approach (fixed, dynamic, etc.)
rate_type rate_type NOT NULL DEFAULT 'BAR', -- Rate category (BAR, RACK, CORPORATE, etc.)
priority INTEGER NOT NULL DEFAULT 100, -- Display/selection priority (lower = higher priority)

-- Pricing
base_rate DECIMAL(15, 2) NOT NULL, -- Base nightly price
currency VARCHAR(3) DEFAULT 'USD', -- ISO currency code

-- Occupancy-Based Pricing
single_occupancy_rate DECIMAL(15, 2), -- Override for single occupancy
double_occupancy_rate DECIMAL(15, 2), -- Override for double occupancy
extra_person_rate DECIMAL(15, 2), -- Surcharge per additional adult
extra_child_rate DECIMAL(15, 2), -- Surcharge per additional child

-- Date Range
valid_from DATE NOT NULL, -- Start date of availability
valid_until DATE, -- End date (NULL = indefinite)

-- Booking Window
advance_booking_days_min INTEGER DEFAULT 0, -- Minimum days prior to arrival
advance_booking_days_max INTEGER, -- Maximum days prior to arrival

-- Stay Restrictions
min_length_of_stay INTEGER DEFAULT 1, -- Minimum nights required
max_length_of_stay INTEGER, -- Maximum nights allowed
closed_to_arrival BOOLEAN DEFAULT false, -- Block check-ins on certain dates
closed_to_departure BOOLEAN DEFAULT false, -- Block check-outs on certain dates

-- Meal Plan
meal_plan VARCHAR(50), -- Associated meal plan (EP, MAP, etc.)
meal_plan_cost DECIMAL(15, 2) DEFAULT 0.00, -- Additional cost for meal plan

-- Cancellation Policy
cancellation_policy JSONB DEFAULT '{
        "hours": 24,
        "penalty": 0,
        "type": "flexible"
    }'::jsonb, -- Structured cancellation rules

-- Rate Modifiers
modifiers JSONB DEFAULT '{
        "weekendSurcharge": 0,
        "seasonalModifier": 0,
        "discounts": []
    }'::jsonb, -- Seasonal/discount adjustments

-- Channels (where this rate is available)
channels JSONB DEFAULT '["direct", "ota", "phone", "walk_in"]'::jsonb, -- Distribution channels

-- Customer Segments
customer_segments JSONB DEFAULT '["all"]'::jsonb, -- Eligible customer groups

-- Tax Configuration
tax_inclusive BOOLEAN DEFAULT false, -- Indicates price includes tax
tax_rate DECIMAL(5, 2) DEFAULT 0.00, -- Tax percentage applied

-- Status
status rate_status NOT NULL DEFAULT 'ACTIVE', -- Lifecycle state

-- Display Order
display_order INTEGER DEFAULT 0, -- Sorting weight for UI

-- Custom Metadata
metadata JSONB DEFAULT '{}'::jsonb, -- Extensibility field

-- Audit Fields
created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, -- Creation timestamp
updated_at TIMESTAMP, -- Last update timestamp
created_by VARCHAR(100), -- Creator identifier
updated_by VARCHAR(100), -- Modifier identifier

-- Soft Delete
is_deleted BOOLEAN DEFAULT FALSE, -- Soft delete flag
deleted_at TIMESTAMP, -- Deletion timestamp
deleted_by VARCHAR(100), -- Deleting user identifier

-- Optimistic Locking
version BIGINT DEFAULT 0, -- Version counter for concurrency

-- Early Check-In / Late Check-Out Fees (S18)
early_checkin_fee DECIMAL(15, 2) DEFAULT 0.00, -- Fee for early check-in before cutoff hour
late_checkout_fee DECIMAL(15, 2) DEFAULT 0.00, -- Fee for late check-out after cutoff hour
early_checkin_cutoff_hour INTEGER DEFAULT 14,  -- Hour (0-23) before which early fee applies (default 2 PM)
late_checkout_cutoff_hour INTEGER DEFAULT 11,  -- Hour (0-23) after which late fee applies (default 11 AM)

-- Constraints
CONSTRAINT rates_code_unique UNIQUE (property_id, rate_code), -- Unique code per property
    CONSTRAINT rates_code_format CHECK (rate_code ~ '^[A-Z0-9_-]+$'), -- Enforce rate code pattern
    CONSTRAINT rates_base_rate_check CHECK (base_rate >= 0), -- Non-negative pricing
    CONSTRAINT rates_valid_dates CHECK (valid_from < valid_until OR valid_until IS NULL), -- Validity window check
    CONSTRAINT rates_los_check CHECK (min_length_of_stay <= max_length_of_stay OR max_length_of_stay IS NULL), -- LOS constraint guard
    CONSTRAINT rates_advance_booking CHECK (advance_booking_days_min <= advance_booking_days_max OR advance_booking_days_max IS NULL), -- Booking window guard
    CONSTRAINT chk_rates_early_checkin_fee CHECK (early_checkin_fee >= 0),
    CONSTRAINT chk_rates_late_checkout_fee CHECK (late_checkout_fee >= 0),
    CONSTRAINT chk_rates_early_checkin_cutoff CHECK (early_checkin_cutoff_hour BETWEEN 0 AND 23),
    CONSTRAINT chk_rates_late_checkout_cutoff CHECK (late_checkout_cutoff_hour BETWEEN 0 AND 23)
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
COMMENT ON COLUMN rates.early_checkin_fee IS 'Fee charged for early check-in before cutoff hour';
COMMENT ON COLUMN rates.late_checkout_fee IS 'Fee charged for late check-out after cutoff hour';
COMMENT ON COLUMN rates.early_checkin_cutoff_hour IS 'Hour of day (0-23) before which early check-in fee applies (default 14 = 2 PM)';
COMMENT ON COLUMN rates.late_checkout_cutoff_hour IS 'Hour of day (0-23) after which late check-out fee applies (default 11 = 11 AM)';

\echo 'Rates table created successfully!'
