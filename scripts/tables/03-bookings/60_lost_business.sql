-- =====================================================
-- 60_lost_business.sql
-- Lost Business / Turnaway Tracking
-- Industry Standard: OPERA Cloud (TURNAWAY), Mews (LOST_OPPORTUNITY),
--                    STR Global (DENIED/REGRET)
-- Pattern: Revenue management denied/regret tracking
-- Date: 2026-02-18
-- =====================================================

-- =====================================================
-- LOST_BUSINESS TABLE
-- Tracks booking denials (no inventory) and regrets
-- (guest declined rate/terms) for revenue management
-- forecasting and demand analysis
-- =====================================================

CREATE TABLE IF NOT EXISTS lost_business (
    -- Primary Key
    lost_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),        -- Unique lost business record

    -- Multi-tenancy
    tenant_id UUID NOT NULL,                                    -- FK tenants.id
    property_id UUID NOT NULL,                                  -- FK properties.id

    -- Classification
    lost_type VARCHAR(20) NOT NULL CHECK (
        lost_type IN (
            'DENIAL',       -- Property had no inventory (turned away)
            'REGRET',       -- Guest declined offer / walked away
            'CANCELLATION', -- Cancelled after booking
            'NO_SHOW'       -- Booked but never arrived
        )
    ),                                                          -- Type of lost business

    -- Request Details
    requested_check_in DATE NOT NULL,                           -- Requested arrival date
    requested_check_out DATE NOT NULL,                          -- Requested departure date
    requested_nights INTEGER GENERATED ALWAYS AS (
        requested_check_out - requested_check_in
    ) STORED,                                                   -- Computed nights
    requested_rooms INTEGER DEFAULT 1,                          -- Number of rooms requested
    requested_room_type VARCHAR(50),                             -- Room type requested
    requested_rate_code VARCHAR(50),                             -- Rate code inquired about
    quoted_rate DECIMAL(10, 2),                                 -- Rate quoted to guest
    currency_code CHAR(3) DEFAULT 'USD',                        -- Currency

    -- Guest Information (may not have full profile)
    guest_id UUID,                                              -- FK guests.id (if known guest)
    guest_name VARCHAR(200),                                    -- Guest name (if not in system)
    guest_email VARCHAR(255),                                   -- Contact email
    guest_phone VARCHAR(20),                                    -- Contact phone
    company_id UUID,                                            -- FK companies.id (if corporate)
    company_name VARCHAR(200),                                  -- Company name (if not in system)

    -- Source & Channel
    booking_source VARCHAR(50),                                 -- DIRECT, WEBSITE, PHONE, OTA, etc.
    channel_code VARCHAR(50),                                   -- Specific channel (Booking.com, Expedia)
    market_segment VARCHAR(50),                                 -- Market segment
    reservation_source VARCHAR(50),                             -- Source of the inquiry

    -- Reason
    reason_code VARCHAR(50),                                    -- FK reason_codes.reason_code
    denial_reason VARCHAR(100),                                 -- Specific denial reason
    regret_reason VARCHAR(100),                                 -- Why guest declined
    competitor_name VARCHAR(200),                                -- If guest went to competitor
    competitor_rate DECIMAL(10, 2),                              -- Competitor rate if known
    notes TEXT,                                                  -- Additional context

    -- Revenue Impact
    estimated_revenue_lost DECIMAL(10, 2),                     -- Estimated room revenue lost
    estimated_total_revenue_lost DECIMAL(10, 2),               -- Including ancillary spend estimate

    -- Recovery
    alternative_offered BOOLEAN DEFAULT FALSE,                  -- Was an alternative offered
    alternative_property_id UUID,                                -- If redirected to sister property
    alternative_room_type VARCHAR(50),                          -- Alternative room type offered
    alternative_rate DECIMAL(10, 2),                             -- Alternative rate offered
    recovery_successful BOOLEAN DEFAULT FALSE,                 -- Did guest accept alternative

    -- Agent
    recorded_by UUID,                                           -- Staff member who recorded
    recorded_via VARCHAR(50),                                   -- PHONE, EMAIL, WALK_IN, WEBSITE, API

    -- Custom Metadata
    metadata JSONB DEFAULT '{}'::jsonb,                        -- Extension metadata

    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,   -- Creation timestamp
    updated_at TIMESTAMP,                                      -- Last update timestamp

    -- Constraints
    CONSTRAINT lost_business_dates_check CHECK (requested_check_out > requested_check_in),
    CONSTRAINT lost_business_rooms_check CHECK (requested_rooms > 0)
);

-- =====================================================
-- TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE lost_business IS 'Tracks booking denials (no inventory), regrets (guest declined), and other lost revenue opportunities for demand analysis';
COMMENT ON COLUMN lost_business.lost_id IS 'Unique lost business record identifier (UUID)';
COMMENT ON COLUMN lost_business.lost_type IS 'Classification: DENIAL (no rooms), REGRET (guest walked), CANCELLATION, NO_SHOW';
COMMENT ON COLUMN lost_business.requested_nights IS 'Computed column: check_out - check_in';
COMMENT ON COLUMN lost_business.estimated_revenue_lost IS 'Estimated room revenue that could have been earned';
COMMENT ON COLUMN lost_business.competitor_name IS 'Name of competitor property guest chose instead';
COMMENT ON COLUMN lost_business.recovery_successful IS 'TRUE if guest accepted an alternative offer';
COMMENT ON COLUMN lost_business.recorded_via IS 'Channel where the inquiry was received: PHONE, EMAIL, WALK_IN, etc.';

\echo 'lost_business table created successfully!'
