-- =====================================================
-- Competitor Rates Table
-- =====================================================
-- Purpose: Track competitor pricing for rate shopping and competitive analysis
-- Key Features:
--   - Automated rate scraping
--   - Competitive positioning analysis
--   - Price gap identification
--   - Market intelligence
-- =====================================================

CREATE TABLE IF NOT EXISTS competitor_rates (
    -- Primary Key
    rate_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Competitor Information
    competitor_property_name VARCHAR(255) NOT NULL,
    competitor_property_id VARCHAR(100),
    competitor_brand VARCHAR(100),
    competitor_star_rating DECIMAL(2,1),

    -- Rate Details
    check_date DATE NOT NULL,
    stay_date DATE NOT NULL,
    nights INTEGER DEFAULT 1,

    -- Room Information
    room_type_category VARCHAR(100), -- Standard, Deluxe, Suite, etc
    room_size_sqm INTEGER,
    bed_type VARCHAR(50),
    max_occupancy INTEGER,

    -- Pricing
    competitor_rate DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    rate_type VARCHAR(50) CHECK (rate_type IN ('rack', 'bar', 'promotional', 'member', 'corporate', 'government', 'package')),

    -- Rate Inclusions
    includes_breakfast BOOLEAN DEFAULT FALSE,
    includes_parking BOOLEAN DEFAULT FALSE,
    includes_wifi BOOLEAN DEFAULT FALSE,
    includes_cancellation BOOLEAN DEFAULT FALSE,
    cancellation_policy VARCHAR(255),

    -- Taxes & Fees
    taxes_included BOOLEAN DEFAULT FALSE,
    tax_amount DECIMAL(10,2),
    fees_amount DECIMAL(10,2),
    total_price DECIMAL(10,2),

    -- Availability
    is_available BOOLEAN DEFAULT TRUE,
    rooms_left INTEGER,
    availability_status VARCHAR(50) CHECK (availability_status IN ('available', 'limited', 'sold_out', 'on_request')),

    -- Source Information
    source_channel VARCHAR(100) NOT NULL, -- Booking.com, Expedia, Direct Website, etc
    source_url TEXT,
    scrape_method VARCHAR(50) CHECK (scrape_method IN ('api', 'web_scraping', 'manual', 'third_party_service')),
    scrape_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Our Property Comparison
    our_property_rate DECIMAL(10,2),
    our_property_room_type_id UUID,
    rate_difference DECIMAL(10,2),
    rate_difference_percent DECIMAL(5,2),

    -- Competitive Position
    is_cheaper_than_us BOOLEAN,
    is_more_expensive_than_us BOOLEAN,
    price_position VARCHAR(50) CHECK (price_position IN ('significantly_lower', 'lower', 'similar', 'higher', 'significantly_higher')),

    -- Market Analysis
    market_average_rate DECIMAL(10,2),
    deviation_from_market_avg DECIMAL(10,2),
    deviation_from_market_avg_percent DECIMAL(5,2),

    -- Competitor Score
    value_score DECIMAL(5,2), -- Price to quality ratio
    amenities_score DECIMAL(5,2),
    location_score DECIMAL(5,2),
    overall_competitiveness_score DECIMAL(5,2),

    -- Guest Reviews
    review_rating DECIMAL(3,2), -- e.g., 4.5 out of 5
    review_count INTEGER,
    recent_review_trend VARCHAR(50) CHECK (recent_review_trend IN ('improving', 'stable', 'declining')),

    -- Distance & Location
    distance_from_our_property_km DECIMAL(6,2),
    location_area VARCHAR(200),
    is_same_neighborhood BOOLEAN,

    -- Demand Indicators
    booking_urgency_indicator VARCHAR(50), -- "Only 2 rooms left", "In high demand"
    viewed_count INTEGER,
    booking_trend VARCHAR(50) CHECK (booking_trend IN ('trending_up', 'steady', 'trending_down')),

    -- Special Offers
    has_special_offer BOOLEAN DEFAULT FALSE,
    special_offer_description TEXT,
    promotion_end_date DATE,

    -- Data Quality
    data_confidence_score DECIMAL(5,2), -- 0-100, how confident we are in the data
    data_source_reliability VARCHAR(50) CHECK (data_source_reliability IN ('high', 'medium', 'low')),
    needs_verification BOOLEAN DEFAULT FALSE,
    verified_by UUID,
    verified_at TIMESTAMP WITH TIME ZONE,

    -- Alerts
    alert_if_below_our_rate BOOLEAN DEFAULT TRUE,
    alert_if_difference_exceeds_percent DECIMAL(5,2) DEFAULT 15.00,
    alert_triggered BOOLEAN DEFAULT FALSE,
    alert_sent_at TIMESTAMP WITH TIME ZONE,

    -- Historical Tracking
    previous_rate DECIMAL(10,2),
    rate_change_amount DECIMAL(10,2),
    rate_change_percent DECIMAL(5,2),
    rate_change_direction VARCHAR(20) CHECK (rate_change_direction IN ('increased', 'decreased', 'unchanged')),

    -- Metadata
    raw_data JSONB, -- Store complete scraped data
    metadata JSONB,
    tags VARCHAR(100)[],
    notes TEXT,

    -- Standard Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID
);

-- Indexes for competitor_rates

-- Composite Indexes for Common Queries

-- Comments
COMMENT ON TABLE competitor_rates IS 'Tracks competitor pricing for rate shopping and market positioning analysis';
COMMENT ON COLUMN competitor_rates.scrape_method IS 'Method used to collect competitor rate: api, web_scraping, manual, third_party_service';
COMMENT ON COLUMN competitor_rates.price_position IS 'Our competitive position: significantly_lower, lower, similar, higher, significantly_higher';
COMMENT ON COLUMN competitor_rates.data_confidence_score IS 'Confidence level in scraped data accuracy (0-100)';
COMMENT ON COLUMN competitor_rates.raw_data IS 'Complete raw JSON data from scraping source for audit trail';
