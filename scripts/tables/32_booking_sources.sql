-- =====================================================
-- 32_booking_sources.sql
-- Reservation Source/Channel Tracking
--
-- Purpose: Track where reservations originate from
-- Industry Standard: OPERA (SOURCE_CODE), Cloudbeds (channels),
--                    Protel (BUCHUNGSQUELLE), RMS (source)
--
-- Use Cases:
-- - Marketing ROI analysis
-- - Channel performance comparison
-- - Commission tracking
-- - Attribution reporting
--
-- Examples: Booking.com, Expedia, Direct website, Phone, Walk-in
-- =====================================================

\c tartware

-- Drop table if exists (for development)
-- DROP TABLE IF EXISTS booking_sources CASCADE;

CREATE TABLE booking_sources (
    -- Primary Key
    source_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-tenancy
    tenant_id UUID NOT NULL,
    property_id UUID, -- NULL for tenant-level sources

    -- Source Information
    source_code VARCHAR(50) NOT NULL, -- e.g., "BOOKINGCOM", "DIRECT-WEB"
    source_name VARCHAR(200) NOT NULL,
    source_type VARCHAR(30) NOT NULL
        CHECK (source_type IN ('OTA', 'GDS', 'DIRECT', 'METASEARCH', 'WHOLESALER', 'AGENT', 'CORPORATE', 'WALK_IN', 'PHONE', 'EMAIL', 'OTHER')),

    -- Category
    category VARCHAR(50), -- ONLINE, OFFLINE, THIRD_PARTY
    sub_category VARCHAR(50), -- More specific categorization

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_bookable BOOLEAN DEFAULT TRUE, -- Can new bookings be made

    -- Channel Details
    channel_name VARCHAR(200), -- e.g., "Booking.com", "Expedia"
    channel_website VARCHAR(500),
    channel_manager VARCHAR(100), -- Channel manager if applicable

    -- Commission & Fees
    commission_type VARCHAR(20) DEFAULT 'PERCENTAGE'
        CHECK (commission_type IN ('PERCENTAGE', 'FIXED', 'TIERED', 'NONE')),
    commission_percentage DECIMAL(5, 2), -- e.g., 15.00 for 15%
    commission_fixed_amount DECIMAL(10, 2),
    commission_notes TEXT,

    -- Financial Tracking
    total_bookings INTEGER DEFAULT 0,
    total_revenue DECIMAL(12, 2) DEFAULT 0.00,
    total_commission_paid DECIMAL(12, 2) DEFAULT 0.00,
    total_room_nights INTEGER DEFAULT 0,
    average_booking_value DECIMAL(10, 2),

    -- Performance Metrics
    conversion_rate DECIMAL(5, 2), -- % of inquiries that convert
    cancellation_rate DECIMAL(5, 2), -- % of bookings cancelled
    average_lead_time_days INTEGER, -- Days between booking and arrival
    average_length_of_stay DECIMAL(4, 1),

    -- Rankings
    ranking INTEGER, -- Priority/display order
    is_preferred BOOLEAN DEFAULT FALSE,
    is_featured BOOLEAN DEFAULT FALSE,

    -- Integration
    has_integration BOOLEAN DEFAULT FALSE,
    integration_type VARCHAR(50), -- API, XML, MANUAL
    api_key VARCHAR(255),
    api_credentials JSONB, -- Encrypted credentials
    last_sync_at TIMESTAMP,
    sync_frequency_minutes INTEGER,

    -- Contact Information
    contact_name VARCHAR(200),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(30),
    account_manager_name VARCHAR(200),
    account_manager_email VARCHAR(255),

    -- Billing
    billing_cycle VARCHAR(20), -- MONTHLY, QUARTERLY, PER_BOOKING
    payment_terms VARCHAR(100),
    invoice_email VARCHAR(255),
    tax_id VARCHAR(50),

    -- Contract Details
    contract_start_date DATE,
    contract_end_date DATE,
    contract_notes TEXT,
    auto_renew BOOLEAN DEFAULT FALSE,

    -- Attribution
    attribution_window_days INTEGER DEFAULT 30, -- Click attribution window
    last_click_attribution BOOLEAN DEFAULT TRUE,

    -- Marketing Codes
    utm_source VARCHAR(100), -- For web analytics
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(200),
    tracking_code VARCHAR(100),

    -- Display Settings
    display_name VARCHAR(200), -- Name shown to guests
    description TEXT,
    logo_url VARCHAR(500),
    icon VARCHAR(100),
    color_code VARCHAR(7), -- Hex color for UI

    -- Restrictions
    min_lead_time_hours INTEGER, -- Minimum booking lead time
    max_lead_time_days INTEGER, -- Maximum advance booking
    min_length_of_stay INTEGER,
    max_length_of_stay INTEGER,
    allowed_room_types UUID[], -- Array of allowed room type IDs
    blocked_dates JSONB, -- {date_ranges: [{start, end}]}

    -- Notes
    notes TEXT,
    internal_notes TEXT,
    guest_facing_notes TEXT,

    -- Metadata
    metadata JSONB,

        created_by VARCHAR(100),
    updated_by VARCHAR(100),

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by VARCHAR(100),

    -- Optimistic Locking
    version BIGINT DEFAULT 0,

    -- Constraints
    CONSTRAINT uk_booking_sources_code
        UNIQUE (tenant_id, property_id, source_code),

    -- Commission percentage validation
    CONSTRAINT chk_booking_sources_commission
        CHECK (
            commission_percentage IS NULL OR
            (commission_percentage >= 0 AND commission_percentage <= 100)
        ),

    -- Rates validation
    CONSTRAINT chk_booking_sources_rates
        CHECK (
            conversion_rate IS NULL OR
            (conversion_rate >= 0 AND conversion_rate <= 100)
        ),

    CONSTRAINT chk_booking_sources_cancellation
        CHECK (
            cancellation_rate IS NULL OR
            (cancellation_rate >= 0 AND cancellation_rate <= 100)
        )
);

-- Add table comment
COMMENT ON TABLE booking_sources IS 'Tracks where reservations originate from (OTAs, direct, phone, etc.). Used for marketing analysis and commission tracking.';

-- Add column comments
COMMENT ON COLUMN booking_sources.source_code IS 'Unique identifier for this source (e.g., "BOOKINGCOM", "DIRECT-WEB")';
COMMENT ON COLUMN booking_sources.source_type IS 'OTA, GDS, DIRECT, METASEARCH, WHOLESALER, AGENT, CORPORATE, WALK_IN, PHONE, EMAIL, OTHER';
COMMENT ON COLUMN booking_sources.commission_type IS 'How commission is calculated: PERCENTAGE, FIXED, TIERED, NONE';
COMMENT ON COLUMN booking_sources.conversion_rate IS 'Percentage of inquiries that result in bookings';
COMMENT ON COLUMN booking_sources.average_lead_time_days IS 'Average days between booking date and arrival date';
COMMENT ON COLUMN booking_sources.has_integration IS 'TRUE if automated integration exists (vs manual entry)';
COMMENT ON COLUMN booking_sources.attribution_window_days IS 'Days after click/view to attribute booking to this source';
COMMENT ON COLUMN booking_sources.utm_source IS 'Google Analytics UTM parameter for tracking';

-- Create indexes (will be created via indexes file)
-- CREATE INDEX idx_booking_sources_tenant ON booking_sources(tenant_id, property_id, source_code);
-- Create partial unique index for active source codes
CREATE UNIQUE INDEX idx_uk_booking_sources_code_active
    ON booking_sources(tenant_id, property_id, source_code)
    WHERE deleted_at IS NULL;

-- CREATE INDEX idx_booking_sources_type ON booking_sources(source_type, is_active) WHERE deleted_at IS NULL;
-- CREATE INDEX idx_booking_sources_active ON booking_sources(property_id, is_active, ranking) WHERE is_active = TRUE;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON booking_sources TO tartware_app;

-- Success message
\echo '✓ Table created: booking_sources (32/37)'
\echo '  - Channel tracking'
\echo '  - Commission management'
\echo '  - Marketing attribution'
\echo ''
