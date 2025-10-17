-- =====================================================
-- 33_market_segments.sql
-- Customer Segmentation & Market Analysis
--
-- Purpose: Categorize guests for targeting and analysis
-- Industry Standard: OPERA (MARKET_CODE), Cloudbeds (market_segments),
--                    Protel (MARKTSEGMENT), RMS (market_segment)
--
-- Use Cases:
-- - Rate strategy by segment
-- - Marketing campaign targeting
-- - Revenue management
-- - Yield analysis
--
-- Examples: Business, Leisure, Group, Government, Corporate
-- =====================================================

\c tartware

-- Drop table if exists (for development)
-- DROP TABLE IF EXISTS market_segments CASCADE;

CREATE TABLE market_segments (
    -- Primary Key
    segment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-tenancy
    tenant_id UUID NOT NULL,
    property_id UUID, -- NULL for tenant-level segments

    -- Segment Information
    segment_code VARCHAR(50) NOT NULL, -- e.g., "CORP", "LEIS", "GRP"
    segment_name VARCHAR(200) NOT NULL,
    segment_type VARCHAR(30) NOT NULL
        CHECK (segment_type IN ('CORPORATE', 'LEISURE', 'GROUP', 'GOVERNMENT', 'WHOLESALE', 'NEGOTIATED', 'PACKAGE', 'QUALIFIED', 'OTHER')),

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_bookable BOOLEAN DEFAULT TRUE,

    -- Hierarchy
    parent_segment_id UUID, -- For sub-segments
    segment_level INTEGER DEFAULT 1, -- Hierarchy level
    segment_path VARCHAR(500), -- e.g., "/CORP/TECH" for path tracking

    -- Financial Characteristics
    average_daily_rate DECIMAL(10, 2),
    average_length_of_stay DECIMAL(4, 1),
    average_booking_value DECIMAL(10, 2),
    contribution_to_revenue DECIMAL(5, 2), -- Percentage of total revenue

    -- Behavior Metrics
    booking_lead_time_days INTEGER, -- Typical lead time
    cancellation_rate DECIMAL(5, 2),
    no_show_rate DECIMAL(5, 2),
    repeat_guest_rate DECIMAL(5, 2),

    -- Volume Tracking
    total_bookings INTEGER DEFAULT 0,
    total_room_nights INTEGER DEFAULT 0,
    total_revenue DECIMAL(12, 2) DEFAULT 0.00,

    -- Rate Strategy
    rate_multiplier DECIMAL(5, 4) DEFAULT 1.0000, -- e.g., 0.9 = 10% discount
    min_rate DECIMAL(10, 2), -- Minimum allowed rate
    max_rate DECIMAL(10, 2), -- Maximum allowed rate
    default_rate_plan_id UUID,

    -- Discount/Premium
    discount_percentage DECIMAL(5, 2),
    premium_percentage DECIMAL(5, 2),

    -- Commission
    pays_commission BOOLEAN DEFAULT FALSE,
    commission_percentage DECIMAL(5, 2),

    -- Targeting
    target_age_min INTEGER,
    target_age_max INTEGER,
    target_income_level VARCHAR(30), -- LOW, MEDIUM, HIGH, LUXURY
    target_party_size INTEGER,

    -- Seasonal Patterns
    high_season_months INTEGER[], -- Array of months (1-12)
    low_season_months INTEGER[],
    peak_booking_days INTEGER[], -- Days of week (0-6)

    -- Channel Affinity
    preferred_channels TEXT[], -- Channels this segment books through

    -- Marketing
    marketing_priority INTEGER DEFAULT 0, -- Higher = more priority
    is_target_segment BOOLEAN DEFAULT FALSE,
    acquisition_cost DECIMAL(10, 2), -- Cost to acquire customer
    lifetime_value DECIMAL(12, 2), -- Expected customer lifetime value

    -- Loyalty
    loyalty_program_eligible BOOLEAN DEFAULT FALSE,
    loyalty_points_multiplier DECIMAL(4, 2) DEFAULT 1.00,

    -- Restrictions
    min_advance_booking_days INTEGER,
    max_advance_booking_days INTEGER,
    min_length_of_stay INTEGER,
    max_length_of_stay INTEGER,
    allowed_days_of_week INTEGER[], -- 0=Sunday, 6=Saturday
    blackout_dates JSONB, -- {date_ranges: [{start, end}]}

    -- Amenities & Services
    included_amenities TEXT[],
    excluded_amenities TEXT[],
    special_services TEXT[],

    -- Display
    ranking INTEGER, -- Display order
    color_code VARCHAR(7), -- Hex color for reports
    icon VARCHAR(100),
    description TEXT,

    -- Sales Strategy
    sales_focus BOOLEAN DEFAULT FALSE, -- Sales team should focus
    requires_approval BOOLEAN DEFAULT FALSE, -- Needs manager approval
    approval_threshold DECIMAL(10, 2), -- Amount requiring approval

    -- Contact Preferences
    preferred_contact_method VARCHAR(30), -- EMAIL, PHONE, SMS
    email_template VARCHAR(100),

    -- Tax Treatment
    tax_exempt BOOLEAN DEFAULT FALSE,
    tax_rate_override DECIMAL(5, 4),

    -- Compliance
    requires_id_verification BOOLEAN DEFAULT FALSE,
    requires_company_info BOOLEAN DEFAULT FALSE,

    -- Notes
    notes TEXT,
    internal_notes TEXT,
    marketing_notes TEXT,

    -- Metadata
    metadata JSONB,

    -- Soft delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by UUID,

    -- Audit trail
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID,

    -- Constraints
    CONSTRAINT uk_market_segments_code
        UNIQUE (tenant_id, property_id, segment_code),

    -- Rate multiplier validation
    CONSTRAINT chk_market_segments_multiplier
        CHECK (
            rate_multiplier > 0 AND
            rate_multiplier <= 10
        ),

    -- Percentage validations
    CONSTRAINT chk_market_segments_percentages
        CHECK (
            (discount_percentage IS NULL OR discount_percentage >= 0) AND
            (premium_percentage IS NULL OR premium_percentage >= 0) AND
            (commission_percentage IS NULL OR commission_percentage <= 100) AND
            (cancellation_rate IS NULL OR (cancellation_rate >= 0 AND cancellation_rate <= 100)) AND
            (no_show_rate IS NULL OR (no_show_rate >= 0 AND no_show_rate <= 100))
        )
);

-- Add table comment
COMMENT ON TABLE market_segments IS 'Customer segmentation for marketing, pricing strategy, and revenue analysis. Categories like Corporate, Leisure, Group, Government.';

-- Add column comments
COMMENT ON COLUMN market_segments.segment_code IS 'Unique code (e.g., "CORP", "LEIS", "GRP")';
COMMENT ON COLUMN market_segments.segment_type IS 'CORPORATE, LEISURE, GROUP, GOVERNMENT, WHOLESALE, NEGOTIATED, PACKAGE, QUALIFIED, OTHER';
COMMENT ON COLUMN market_segments.rate_multiplier IS 'Rate adjustment factor. 0.9 = 10% discount, 1.1 = 10% premium';
COMMENT ON COLUMN market_segments.contribution_to_revenue IS 'Percentage of total property revenue from this segment';
COMMENT ON COLUMN market_segments.target_income_level IS 'Target customer income: LOW, MEDIUM, HIGH, LUXURY';
COMMENT ON COLUMN market_segments.lifetime_value IS 'Expected total revenue from customer over their lifetime';
COMMENT ON COLUMN market_segments.acquisition_cost IS 'Marketing cost to acquire a customer in this segment';
COMMENT ON COLUMN market_segments.segment_path IS 'Hierarchical path for nested segments (e.g., "/CORP/TECH")';

-- Create indexes (will be created via indexes file)
-- CREATE INDEX idx_market_segments_tenant ON market_segments(tenant_id, property_id, segment_code);
-- CREATE INDEX idx_market_segments_type ON market_segments(segment_type, is_active) WHERE deleted_at IS NULL;
-- Create partial unique index for active segment codes
CREATE UNIQUE INDEX idx_uk_market_segments_code
    ON market_segments(tenant_id, property_id, segment_code)
    WHERE deleted_at IS NULL;

-- CREATE INDEX idx_market_segments_active ON market_segments(property_id, is_active, ranking) WHERE is_active = TRUE;
-- CREATE INDEX idx_market_segments_parent ON market_segments(parent_segment_id) WHERE parent_segment_id IS NOT NULL;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON market_segments TO tartware_app;

-- Success message
\echo '✓ Table created: market_segments (33/37)'
\echo '  - Customer segmentation'
\echo '  - Revenue analysis'
\echo '  - Rate strategy'
\echo ''
