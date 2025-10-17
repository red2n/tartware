-- =====================================================
-- Demand Calendar Table
-- =====================================================
-- Purpose: Track demand patterns, events, and booking pace
-- Key Features:
--   - Daily demand tracking
--   - Event impact analysis
--   - Booking pace monitoring
--   - Dynamic pricing support
-- =====================================================

CREATE TABLE IF NOT EXISTS demand_calendar (
    -- Primary Key
    demand_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Date Information
    calendar_date DATE NOT NULL,
    day_of_week VARCHAR(10) NOT NULL,
    week_number INTEGER,
    month_number INTEGER,
    quarter_number INTEGER,
    year_number INTEGER,

    -- Date Classification
    is_weekend BOOLEAN DEFAULT FALSE,
    is_holiday BOOLEAN DEFAULT FALSE,
    holiday_name VARCHAR(255),
    is_local_holiday BOOLEAN DEFAULT FALSE,
    is_national_holiday BOOLEAN DEFAULT FALSE,

    -- Seasonality
    season VARCHAR(50) CHECK (season IN ('peak', 'high', 'shoulder', 'low', 'off')),
    season_factor DECIMAL(5,4) DEFAULT 1.0000,
    is_peak_season BOOLEAN DEFAULT FALSE,
    is_special_period BOOLEAN DEFAULT FALSE,
    special_period_name VARCHAR(255),

    -- Demand Level
    demand_level VARCHAR(50) NOT NULL CHECK (demand_level IN ('very_low', 'low', 'moderate', 'high', 'very_high', 'exceptional')),
    demand_score INTEGER CHECK (demand_score BETWEEN 0 AND 100),
    demand_forecast VARCHAR(50) CHECK (demand_forecast IN ('increasing', 'stable', 'decreasing', 'uncertain')),

    -- Booking Metrics
    total_bookings INTEGER DEFAULT 0,
    new_bookings_today INTEGER DEFAULT 0,
    cancellations_today INTEGER DEFAULT 0,
    modifications_today INTEGER DEFAULT 0,

    -- Booking Pace
    booking_pace VARCHAR(50) CHECK (booking_pace IN ('ahead', 'on_track', 'behind', 'significantly_behind')),
    pace_vs_last_year INTEGER, -- Days ahead/behind
    pace_vs_budget INTEGER,
    pickup_last_7_days INTEGER,
    pickup_last_30_days INTEGER,

    -- Occupancy Metrics
    rooms_available INTEGER NOT NULL,
    rooms_occupied INTEGER DEFAULT 0,
    rooms_reserved INTEGER DEFAULT 0,
    rooms_blocked INTEGER DEFAULT 0,
    rooms_out_of_order INTEGER DEFAULT 0,
    rooms_remaining INTEGER,

    occupancy_percent DECIMAL(5,2),
    forecasted_occupancy_percent DECIMAL(5,2),
    optimal_occupancy_target DECIMAL(5,2),

    -- Revenue Metrics
    adr DECIMAL(10,2),
    forecasted_adr DECIMAL(10,2),
    target_adr DECIMAL(10,2),

    revpar DECIMAL(10,2),
    forecasted_revpar DECIMAL(10,2),
    target_revpar DECIMAL(10,2),

    total_revenue DECIMAL(12,2) DEFAULT 0.00,
    forecasted_revenue DECIMAL(12,2),
    revenue_potential DECIMAL(12,2),

    -- Market Segments
    segment_distribution JSONB, -- {leisure: 60%, corporate: 30%, group: 10%}
    top_segment VARCHAR(100),
    segment_diversity_score DECIMAL(5,2),

    -- Channel Distribution
    channel_distribution JSONB, -- {direct: 40%, ota: 50%, gds: 10%}
    direct_booking_percent DECIMAL(5,2),
    ota_booking_percent DECIMAL(5,2),

    -- Lead Time
    average_lead_time_days INTEGER,
    median_lead_time_days INTEGER,
    booking_window VARCHAR(50) CHECK (booking_window IN ('same_day', 'next_day', 'within_week', 'within_month', 'advance')),

    -- Length of Stay
    average_los DECIMAL(4,2),
    most_common_los INTEGER,
    los_distribution JSONB, -- {1: 20%, 2: 40%, 3: 25%, 4+: 15%}

    -- Events
    has_events BOOLEAN DEFAULT FALSE,
    events_count INTEGER DEFAULT 0,
    events JSONB, -- [{name, type, impact, attendance}]
    event_impact_score INTEGER CHECK (event_impact_score BETWEEN 0 AND 100),
    major_event_name VARCHAR(255),

    -- Competition
    competitor_occupancy_avg DECIMAL(5,2),
    competitor_adr_avg DECIMAL(10,2),
    market_occupancy DECIMAL(5,2),
    our_market_share DECIMAL(5,2),

    -- Pricing Strategy
    recommended_pricing_strategy VARCHAR(100) CHECK (recommended_pricing_strategy IN (
        'discount', 'standard', 'premium', 'dynamic', 'yield_max', 'stay_restrictions'
    )),
    min_stay_recommendation INTEGER,
    max_stay_recommendation INTEGER,
    close_to_arrival BOOLEAN DEFAULT FALSE,

    -- Restrictions
    min_stay_restriction INTEGER,
    max_stay_restriction INTEGER,
    closed_to_arrival BOOLEAN DEFAULT FALSE,
    closed_to_departure BOOLEAN DEFAULT FALSE,

    -- Group Business
    group_blocks_count INTEGER DEFAULT 0,
    group_rooms_blocked INTEGER DEFAULT 0,
    group_pickup_percent DECIMAL(5,2),

    -- Weather (if integrated)
    weather_condition VARCHAR(100),
    temperature_celsius DECIMAL(4,1),
    weather_impact_score INTEGER CHECK (weather_impact_score BETWEEN -10 AND 10),

    -- Alerts & Actions
    requires_attention BOOLEAN DEFAULT FALSE,
    alert_reasons VARCHAR(255)[],
    recommended_actions VARCHAR(255)[],
    action_taken VARCHAR(255),
    action_taken_by UUID,
    action_taken_at TIMESTAMP WITH TIME ZONE,

    -- Historical Comparison
    same_day_last_year_occupancy DECIMAL(5,2),
    same_day_last_year_adr DECIMAL(10,2),
    variance_vs_last_year_occupancy DECIMAL(5,2),
    variance_vs_last_year_adr DECIMAL(10,2),

    -- Notes & Analysis
    demand_notes TEXT,
    market_conditions TEXT,
    revenue_manager_notes TEXT,

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
    deleted_by UUID,

    -- Unique Constraint
    UNIQUE(property_id, calendar_date)
);

-- Indexes for demand_calendar
CREATE INDEX idx_demand_calendar_tenant ON demand_calendar(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_demand_calendar_property ON demand_calendar(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_demand_calendar_date ON demand_calendar(calendar_date) WHERE is_deleted = FALSE;
CREATE INDEX idx_demand_calendar_day_of_week ON demand_calendar(day_of_week) WHERE is_deleted = FALSE;
CREATE INDEX idx_demand_calendar_month ON demand_calendar(year_number, month_number) WHERE is_deleted = FALSE;
CREATE INDEX idx_demand_calendar_weekend ON demand_calendar(is_weekend) WHERE is_weekend = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_demand_calendar_holiday ON demand_calendar(is_holiday) WHERE is_holiday = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_demand_calendar_season ON demand_calendar(season) WHERE is_deleted = FALSE;
CREATE INDEX idx_demand_calendar_demand_level ON demand_calendar(demand_level) WHERE is_deleted = FALSE;
CREATE INDEX idx_demand_calendar_demand_score ON demand_calendar(demand_score) WHERE is_deleted = FALSE;
CREATE INDEX idx_demand_calendar_booking_pace ON demand_calendar(booking_pace) WHERE is_deleted = FALSE;
CREATE INDEX idx_demand_calendar_occupancy ON demand_calendar(occupancy_percent) WHERE is_deleted = FALSE;
CREATE INDEX idx_demand_calendar_events ON demand_calendar(has_events) WHERE has_events = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_demand_calendar_attention ON demand_calendar(requires_attention) WHERE requires_attention = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_demand_calendar_pricing_strategy ON demand_calendar(recommended_pricing_strategy) WHERE is_deleted = FALSE;
CREATE INDEX idx_demand_calendar_events_json ON demand_calendar USING gin(events) WHERE is_deleted = FALSE;
CREATE INDEX idx_demand_calendar_segment_dist ON demand_calendar USING gin(segment_distribution) WHERE is_deleted = FALSE;
CREATE INDEX idx_demand_calendar_metadata ON demand_calendar USING gin(metadata) WHERE is_deleted = FALSE;
CREATE INDEX idx_demand_calendar_tags ON demand_calendar USING gin(tags) WHERE is_deleted = FALSE;

-- Composite Indexes for Common Queries
CREATE INDEX idx_demand_calendar_property_date_range ON demand_calendar(property_id, calendar_date) WHERE is_deleted = FALSE;
CREATE INDEX idx_demand_calendar_property_demand ON demand_calendar(property_id, demand_level, calendar_date) WHERE is_deleted = FALSE;
CREATE INDEX idx_demand_calendar_future_dates ON demand_calendar(property_id, calendar_date) WHERE calendar_date >= CURRENT_DATE AND is_deleted = FALSE;
CREATE INDEX idx_demand_calendar_season_analysis ON demand_calendar(property_id, season, calendar_date) WHERE is_deleted = FALSE;

-- Comments
COMMENT ON TABLE demand_calendar IS 'Tracks daily demand patterns, events, booking pace, and market conditions for revenue optimization';
COMMENT ON COLUMN demand_calendar.demand_score IS 'Overall demand intensity score from 0-100';
COMMENT ON COLUMN demand_calendar.booking_pace IS 'Booking velocity compared to forecast: ahead, on_track, behind, significantly_behind';
COMMENT ON COLUMN demand_calendar.events IS 'JSON array of events impacting demand for this date';
COMMENT ON COLUMN demand_calendar.recommended_pricing_strategy IS 'AI-recommended pricing approach based on demand analysis';
