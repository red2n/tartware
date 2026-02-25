-- =====================================================
-- 37_rate_calendar.sql
-- Rate Calendar (Day-Level Pricing Grid)
-- Industry Standard: OPERA Rate Grid, Cloudbeds Rate
--   Calendar, Mews Rate Management, AHLEI guidelines
-- Pattern: One row per (property, room_type, rate_plan, date)
-- Date: 2026-02-25
-- =====================================================

\c tartware

\echo 'Creating rate_calendar table...'

-- =====================================================
-- RATE_CALENDAR TABLE
-- Day-level rate amounts and restrictions that override
-- the base rate plan for specific dates. Revenue managers
-- use this to set weekend/event/seasonal pricing and
-- per-date availability controls (CTA, CTD, min LOS).
-- =====================================================

CREATE TABLE IF NOT EXISTS rate_calendar (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),       -- Unique calendar entry

    -- Multi-Tenancy & Hierarchy
    tenant_id    UUID NOT NULL,                           -- FK tenants.id
    property_id  UUID NOT NULL,                           -- FK properties.id
    room_type_id UUID NOT NULL,                           -- FK room_types.id
    rate_id      UUID NOT NULL,                           -- FK rates.id (parent rate plan)

    -- Calendar Date
    stay_date DATE NOT NULL,                              -- The specific night this entry covers

    -- Pricing
    rate_amount  DECIMAL(15, 2) NOT NULL,                 -- Effective nightly rate for this date
    currency     VARCHAR(3) NOT NULL DEFAULT 'USD',       -- ISO 4217 currency code

    -- Occupancy-Based Pricing (optional overrides)
    single_rate  DECIMAL(15, 2),                          -- Single occupancy override
    double_rate  DECIMAL(15, 2),                          -- Double occupancy override
    extra_person DECIMAL(15, 2),                          -- Extra person surcharge override
    extra_child  DECIMAL(15, 2),                          -- Extra child surcharge override

    -- Availability Status
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN'            -- Day-level availability control
        CHECK (status IN ('OPEN', 'CLOSED', 'STOP_SELL', 'ON_REQUEST')),

    -- Restrictions
    closed_to_arrival   BOOLEAN NOT NULL DEFAULT FALSE,   -- Block check-ins on this date
    closed_to_departure BOOLEAN NOT NULL DEFAULT FALSE,   -- Block check-outs on this date
    min_length_of_stay  INTEGER,                          -- Override min LOS for this date
    max_length_of_stay  INTEGER,                          -- Override max LOS for this date
    min_advance_days    INTEGER,                          -- Min booking lead time override
    max_advance_days    INTEGER,                          -- Max booking lead time override

    -- Inventory
    rooms_to_sell INTEGER,                                -- Allotment cap for this rate/date (NULL = unlimited)
    rooms_sold    INTEGER NOT NULL DEFAULT 0,             -- Count of rooms sold at this rate/date

    -- Source Tracking
    source VARCHAR(30) NOT NULL DEFAULT 'MANUAL'          -- How this entry was created
        CHECK (source IN ('MANUAL', 'BULK', 'PRICING_RULE', 'CHANNEL_MANAGER', 'IMPORT')),

    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100),

    -- Constraints
    CONSTRAINT rate_calendar_unique UNIQUE (property_id, room_type_id, rate_id, stay_date),
    CONSTRAINT rate_calendar_amount_positive CHECK (rate_amount >= 0),
    CONSTRAINT rate_calendar_los_valid CHECK (
        min_length_of_stay IS NULL OR max_length_of_stay IS NULL
        OR min_length_of_stay <= max_length_of_stay
    )
);

-- ── Indexes ──
CREATE INDEX IF NOT EXISTS idx_rate_calendar_lookup
    ON rate_calendar (property_id, stay_date, status)
    WHERE status = 'OPEN';

CREATE INDEX IF NOT EXISTS idx_rate_calendar_range
    ON rate_calendar (property_id, room_type_id, rate_id, stay_date);

CREATE INDEX IF NOT EXISTS idx_rate_calendar_tenant
    ON rate_calendar (tenant_id, property_id);

-- ── Catalog Comments ──
COMMENT ON TABLE rate_calendar IS
    'Day-level rate amounts and restrictions. Each row overrides the parent rate plan base_rate for a specific (room_type, rate_plan, date) combination. Used by revenue managers for granular pricing control.';

COMMENT ON COLUMN rate_calendar.rate_amount IS 'Effective nightly rate for this specific date — overrides the parent rate plan base_rate.';
COMMENT ON COLUMN rate_calendar.status IS 'OPEN = bookable, CLOSED = rate unavailable, STOP_SELL = no inventory, ON_REQUEST = manual approval required.';
COMMENT ON COLUMN rate_calendar.closed_to_arrival IS 'When TRUE, guests cannot check in on this date under this rate plan.';
COMMENT ON COLUMN rate_calendar.closed_to_departure IS 'When TRUE, guests cannot check out on this date under this rate plan.';
COMMENT ON COLUMN rate_calendar.rooms_to_sell IS 'Allotment cap for this rate/date combination. NULL means unlimited (subject to physical inventory).';
COMMENT ON COLUMN rate_calendar.source IS 'Origin of the calendar entry: MANUAL, BULK update, PRICING_RULE engine, CHANNEL_MANAGER sync, or IMPORT.';

\echo 'rate_calendar table created successfully!'
