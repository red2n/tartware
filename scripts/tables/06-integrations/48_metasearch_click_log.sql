-- =====================================================
-- 48_metasearch_click_log.sql
-- Metasearch click and conversion tracking log
-- Industry Standard: CPC/CPA performance tracking
-- Pattern: Append-only event log with conversion status
-- Date: 2025-06-14
-- =====================================================

-- =====================================================
-- METASEARCH_CLICK_LOG TABLE
-- Click-level CPC/CPA tracking with conversion attribution
-- =====================================================

CREATE TABLE IF NOT EXISTS metasearch_click_log (
    click_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),           -- Unique click identifier
    tenant_id UUID NOT NULL,                                        -- Owning tenant
    property_id UUID NOT NULL,                                      -- Property receiving click

    config_id UUID NOT NULL REFERENCES metasearch_configurations(config_id), -- Link to configuration
    platform VARCHAR(100) NOT NULL,                                 -- Denormalized platform name for queries

    -- Click Details
    click_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP, -- When click occurred
    cost DECIMAL(10,4) NOT NULL DEFAULT 0,                          -- Cost of this click (CPC amount)
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',                     -- Click cost currency

    -- Search Context
    search_type VARCHAR(50) CHECK (search_type IN (
        'hotel_search', 'map', 'pointofsale', 'room_bundle', 'price_feed', 'other'
    )),                                                             -- Type of search that triggered click
    device VARCHAR(20) CHECK (device IN (
        'desktop', 'mobile', 'tablet', 'unknown'
    )),                                                             -- User device
    market VARCHAR(10),                                             -- User market/locale (e.g., 'en-US')
    check_in_date DATE,                                             -- Searched check-in date
    check_out_date DATE,                                            -- Searched check-out date
    occupancy INTEGER,                                              -- Searched occupancy

    -- Conversion
    converted BOOLEAN NOT NULL DEFAULT FALSE,                       -- Whether click led to a booking
    reservation_id UUID,                                            -- Linked reservation if converted
    conversion_value DECIMAL(12,2),                                 -- Booking value if converted
    conversion_timestamp TIMESTAMP WITH TIME ZONE,                  -- When conversion happened

    -- Attribution
    tracking_id VARCHAR(255),                                       -- Platform-provided tracking identifier
    landing_page_url TEXT,                                           -- Where user landed after click

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP   -- Row creation
);

CREATE INDEX IF NOT EXISTS idx_metasearch_click_log_tenant_config
    ON metasearch_click_log (tenant_id, config_id, click_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_metasearch_click_log_property_date
    ON metasearch_click_log (tenant_id, property_id, click_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_metasearch_click_log_conversion
    ON metasearch_click_log (tenant_id, converted)
    WHERE converted = TRUE;

COMMENT ON TABLE metasearch_click_log IS 'Append-only log of metasearch clicks and CPC/CPA costs with conversion attribution for ROI analysis';
COMMENT ON COLUMN metasearch_click_log.cost IS 'Actual cost charged for this click, in the configured currency';
COMMENT ON COLUMN metasearch_click_log.converted IS 'Whether this click resulted in a confirmed reservation';
COMMENT ON COLUMN metasearch_click_log.conversion_value IS 'Total booking revenue attributed to this click';
COMMENT ON COLUMN metasearch_click_log.tracking_id IS 'Platform-provided click tracking ID for reconciliation';

\echo 'metasearch_click_log table created successfully!'
