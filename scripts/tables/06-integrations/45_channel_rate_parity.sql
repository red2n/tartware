-- =====================================================
-- Channel Rate Parity Monitoring Table
-- =====================================================
-- Purpose: Monitor and enforce rate parity across OTA channels
-- Key Features:
--   - Real-time rate comparison
--   - Parity violation detection
--   - Automated alerts
--   - Historical parity tracking
-- =====================================================

CREATE TABLE IF NOT EXISTS channel_rate_parity (
    -- Primary Key
    parity_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Rate Details
    room_type_id UUID NOT NULL,
    rate_plan_id UUID,
    check_date DATE NOT NULL,

    -- Base Rate (PMS)
    pms_rate DECIMAL(10,2) NOT NULL,
    pms_currency VARCHAR(3) NOT NULL DEFAULT 'USD',

    -- Channel Rates
    channel_rates JSONB NOT NULL, -- {channel_name: {rate, currency, last_updated}}

    -- Parity Analysis
    is_parity_maintained BOOLEAN DEFAULT TRUE,
    parity_status VARCHAR(50) NOT NULL DEFAULT 'compliant' CHECK (parity_status IN ('compliant', 'minor_variance', 'major_variance', 'violation', 'unknown')),

    -- Violations
    violations_detected INTEGER DEFAULT 0,
    violation_details JSONB, -- [{channel, expected_rate, actual_rate, variance_amount, variance_percent}]
    max_variance_percent DECIMAL(5,2),
    max_variance_amount DECIMAL(10,2),

    -- Thresholds
    acceptable_variance_percent DECIMAL(5,2) DEFAULT 2.00,
    acceptable_variance_amount DECIMAL(10,2) DEFAULT 5.00,

    -- Channel Comparison
    lowest_rate DECIMAL(10,2),
    lowest_rate_channel VARCHAR(100),
    highest_rate DECIMAL(10,2),
    highest_rate_channel VARCHAR(100),
    rate_spread DECIMAL(10,2),
    rate_spread_percent DECIMAL(5,2),

    -- Best Available Rate (BAR)
    bar_rate DECIMAL(10,2),
    bar_channel VARCHAR(100),
    is_direct_booking_cheaper BOOLEAN,
    direct_booking_advantage DECIMAL(10,2),

    -- Check Details
    check_initiated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    check_completed_at TIMESTAMP WITH TIME ZONE,
    channels_checked INTEGER DEFAULT 0,
    channels_responding INTEGER DEFAULT 0,
    channels_failed INTEGER DEFAULT 0,

    -- Alert Management
    alert_sent BOOLEAN DEFAULT FALSE,
    alert_sent_at TIMESTAMP WITH TIME ZONE,
    alert_recipients VARCHAR(255)[],
    alert_severity VARCHAR(20) CHECK (alert_severity IN ('info', 'warning', 'critical', 'urgent')),

    -- Resolution
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID,
    resolution_action VARCHAR(100),
    resolution_notes TEXT,

    -- Automated Actions
    auto_correction_attempted BOOLEAN DEFAULT FALSE,
    auto_correction_successful BOOLEAN,
    correction_timestamp TIMESTAMP WITH TIME ZONE,
    correction_details JSONB,

    -- Historical Comparison
    previous_check_id UUID,
    is_recurring_violation BOOLEAN DEFAULT FALSE,
    consecutive_violations INTEGER DEFAULT 0,
    first_violation_date DATE,

    -- Competitive Intelligence
    market_position VARCHAR(50) CHECK (market_position IN ('lowest', 'below_average', 'average', 'above_average', 'highest')),
    competitor_rates JSONB, -- Independent hotel rates for comparison
    market_average_rate DECIMAL(10,2),

    -- Scraping Metadata
    scrape_method VARCHAR(50) CHECK (scrape_method IN ('api', 'webhook', 'web_scraping', 'manual', 'third_party')),
    scrape_duration_ms INTEGER,
    scrape_errors JSONB,

    -- Compliance
    contract_restrictions JSONB, -- OTA contract terms regarding parity
    contract_violation_risk VARCHAR(50) CHECK (contract_violation_risk IN ('none', 'low', 'medium', 'high', 'critical')),

    -- Metadata
    metadata JSONB,
    tags VARCHAR(100)[],

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


-- Comments
COMMENT ON TABLE channel_rate_parity IS 'Monitors rate parity across OTA channels and detects violations';
COMMENT ON COLUMN channel_rate_parity.channel_rates IS 'JSON object containing rates from all channels';
COMMENT ON COLUMN channel_rate_parity.violation_details IS 'Detailed information about parity violations';
COMMENT ON COLUMN channel_rate_parity.bar_rate IS 'Best Available Rate across all channels';
COMMENT ON COLUMN channel_rate_parity.contract_violation_risk IS 'Risk level of violating OTA contract terms';

\echo 'channel_rate_parity table created successfully!'
