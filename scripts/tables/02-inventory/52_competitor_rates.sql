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
    rate_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Unique record identifier

-- Multi-Tenancy
tenant_id UUID NOT NULL, -- FK tenants.id
property_id UUID NOT NULL, -- FK properties.id

-- Competitor Information
competitor_property_name VARCHAR(255) NOT NULL, -- Name of competitor property
competitor_property_id VARCHAR(100), -- External identifier from channel/vendor
competitor_brand VARCHAR(100), -- Brand/chain name
competitor_star_rating DECIMAL(2, 1), -- Star rating for weighting comparisons

-- Rate Details
check_date DATE NOT NULL, -- Date the rate was collected
stay_date DATE NOT NULL, -- Arrival date the rate applies to
nights INTEGER DEFAULT 1, -- Length of stay for collected quote

-- Room Information
room_type_category VARCHAR(100), -- Standard, Deluxe, Suite, etc
room_size_sqm INTEGER, -- Size to normalize comparisons
bed_type VARCHAR(50), -- Bed configuration
max_occupancy INTEGER, -- Maximum guests allowed

-- Pricing
competitor_rate DECIMAL(10, 2) NOT NULL, -- Quoted room-only rate
currency VARCHAR(3) NOT NULL DEFAULT 'USD', -- ISO currency code
rate_type VARCHAR(50) CHECK (
    rate_type IN (
        'rack',
        'bar',
        'promotional',
        'member',
        'corporate',
        'government',
        'package'
    )
),

-- Rate Inclusions
includes_breakfast BOOLEAN DEFAULT FALSE, -- Whether breakfast is included
includes_parking BOOLEAN DEFAULT FALSE, -- Whether parking is included
includes_wifi BOOLEAN DEFAULT FALSE, -- Complimentary Wi-Fi flag
includes_cancellation BOOLEAN DEFAULT FALSE, -- Free cancellation availability
cancellation_policy VARCHAR(255), -- Summary of cancellation terms

-- Taxes & Fees
taxes_included BOOLEAN DEFAULT FALSE, -- Whether quoted rate includes taxes
tax_amount DECIMAL(10, 2), -- Tax component if separated
fees_amount DECIMAL(10, 2), -- Additional fees (resort, service)
total_price DECIMAL(10, 2), -- All-in price when available

-- Availability
is_available BOOLEAN DEFAULT TRUE, -- Indicates bookability
rooms_left INTEGER, -- OTA-supplied scarcity indicator
availability_status VARCHAR(50) CHECK (
    availability_status IN (
        'available',
        'limited',
        'sold_out',
        'on_request'
    )
),

-- Source Information
source_channel VARCHAR(100) NOT NULL, -- Booking.com, Expedia, Direct Website, etc
source_url TEXT, -- URL for audit/backtracking
scrape_method VARCHAR(50) CHECK (
    scrape_method IN (
        'api',
        'web_scraping',
        'manual',
        'third_party_service'
    )
),
scrape_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

-- Our Property Comparison
our_property_rate DECIMAL(10, 2), -- Current rate for our comparable product
our_property_room_type_id UUID, -- Matching room type identifier
rate_difference DECIMAL(10, 2), -- Absolute price gap
rate_difference_percent DECIMAL(5, 2), -- Percent gap vs competitor

-- Competitive Position
is_cheaper_than_us BOOLEAN, -- Quick comparison flags
is_more_expensive_than_us BOOLEAN,
price_position VARCHAR(50) CHECK (
    price_position IN (
        'significantly_lower',
        'lower',
        'similar',
        'higher',
        'significantly_higher'
    )
),

-- Market Analysis
market_average_rate DECIMAL(10, 2), -- Peer average across market set
deviation_from_market_avg DECIMAL(10, 2), -- Absolute deviation from market
deviation_from_market_avg_percent DECIMAL(5, 2), -- Percent deviation from market

-- Competitor Score
value_score DECIMAL(5, 2), -- Price to quality ratio
amenities_score DECIMAL(5, 2), -- Feature comparison score
location_score DECIMAL(5, 2), -- Location appeal index
overall_competitiveness_score DECIMAL(5, 2), -- Composite score for dashboards

-- Guest Reviews
review_rating DECIMAL(3, 2), -- e.g., 4.5 out of 5
review_count INTEGER, -- Review volume for weighting
recent_review_trend VARCHAR(50) CHECK (
    recent_review_trend IN (
        'improving',
        'stable',
        'declining'
    )
),

-- Distance & Location
distance_from_our_property_km DECIMAL(6, 2), -- Distance vs our property
location_area VARCHAR(200), -- Neighborhood descriptor
is_same_neighborhood BOOLEAN, -- Flag for direct comp set

-- Demand Indicators
booking_urgency_indicator VARCHAR(50), -- "Only 2 rooms left", "In high demand"
viewed_count INTEGER, -- OTA view count when available
booking_trend VARCHAR(50) CHECK (
    booking_trend IN (
        'trending_up',
        'steady',
        'trending_down'
    )
),

-- Special Offers
has_special_offer BOOLEAN DEFAULT FALSE, -- Flag for promo availability
special_offer_description TEXT, -- Promo description copy
promotion_end_date DATE, -- Promo expiry

-- Data Quality
data_confidence_score DECIMAL(5, 2), -- 0-100, confidence in data accuracy
data_source_reliability VARCHAR(50) CHECK (
    data_source_reliability IN ('high', 'medium', 'low')
),
needs_verification BOOLEAN DEFAULT FALSE,
verified_by UUID,
verified_at TIMESTAMP WITH TIME ZONE,

-- Alerts
alert_if_below_our_rate BOOLEAN DEFAULT TRUE, -- Alert if competitor undercuts us
alert_if_difference_exceeds_percent DECIMAL(5, 2) DEFAULT 15.00, -- Threshold percent difference to trigger alert
alert_triggered BOOLEAN DEFAULT FALSE, -- Indicates if alert was triggered
alert_sent_at TIMESTAMP WITH TIME ZONE, -- Timestamp when alert was sent

-- Historical Tracking
previous_rate DECIMAL(10, 2), -- Last captured rate
rate_change_amount DECIMAL(10, 2), -- Absolute change since prior capture
rate_change_percent DECIMAL(5, 2), -- Percent change since prior capture
rate_change_direction VARCHAR(20) CHECK (
    rate_change_direction IN (
        'increased',
        'decreased',
        'unchanged'
    )
),

-- Metadata
raw_data JSONB, -- Store complete scraped data payload
metadata JSONB, -- Additional structured metadata
tags VARCHAR(100) [], -- Categorisation labels
notes TEXT, -- Analyst notes

-- Standard Timestamps
created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- Creation timestamp
updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- Last update timestamp
created_by UUID, -- User who created record
updated_by UUID, -- Last modifying user

-- Soft Delete
is_deleted BOOLEAN DEFAULT FALSE, -- Soft delete flag
    deleted_at TIMESTAMP WITH TIME ZONE, -- Soft delete timestamp
    deleted_by UUID -- Soft delete actor
);

-- Indexes for competitor_rates

-- Composite Indexes for Common Queries

-- Comments
COMMENT ON TABLE competitor_rates IS 'Tracks competitor pricing for rate shopping and market positioning analysis';

COMMENT ON COLUMN competitor_rates.scrape_method IS 'Method used to collect competitor rate: api, web_scraping, manual, third_party_service';

COMMENT ON COLUMN competitor_rates.price_position IS 'Our competitive position: significantly_lower, lower, similar, higher, significantly_higher';

COMMENT ON COLUMN competitor_rates.data_confidence_score IS 'Confidence level in scraped data accuracy (0-100)';

COMMENT ON COLUMN competitor_rates.raw_data IS 'Complete raw JSON data from scraping source for audit trail';

\echo 'competitor_rates table created successfully!'

\echo 'competitor_rates table created successfully!'

\echo 'competitor_rates table created successfully!'
