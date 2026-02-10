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
    demand_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Unique demand record

-- Multi-Tenancy
tenant_id UUID NOT NULL, -- FK tenants.id
property_id UUID NOT NULL, -- FK properties.id

-- Date Information
calendar_date DATE NOT NULL, -- Calendar day represented
day_of_week VARCHAR(10) NOT NULL, -- e.g., Monday
week_number INTEGER, -- ISO week number
month_number INTEGER, -- Month index 1-12
quarter_number INTEGER, -- Quarter index 1-4
year_number INTEGER, -- Four digit year

-- Date Classification
is_weekend BOOLEAN DEFAULT FALSE, -- Weekend indicator
is_holiday BOOLEAN DEFAULT FALSE, -- Holiday flag (global)
holiday_name VARCHAR(255), -- Holiday description
is_local_holiday BOOLEAN DEFAULT FALSE, -- City/regional holiday flag
is_national_holiday BOOLEAN DEFAULT FALSE, -- National holiday flag

-- Seasonality
season VARCHAR(50) CHECK (
    season IN (
        'peak',
        'high',
        'shoulder',
        'low',
        'off'
    )
),
season_factor DECIMAL(5, 4) DEFAULT 1.0000, -- Multiplier used in forecasts
is_peak_season BOOLEAN DEFAULT FALSE, -- Simplified high demand flag
is_special_period BOOLEAN DEFAULT FALSE, -- Special period such as festival
special_period_name VARCHAR(255), -- Label for special period

-- Demand Level
demand_level VARCHAR(50) NOT NULL CHECK (
    demand_level IN (
        'very_low',
        'low',
        'moderate',
        'high',
        'very_high',
        'exceptional'
    )
), -- Categorized demand intensity
demand_score INTEGER CHECK (
    demand_score BETWEEN 0 AND 100
), -- Overall demand intensity score from 0-100
demand_forecast VARCHAR(50) CHECK (
    demand_forecast IN (
        'increasing',
        'stable',
        'decreasing',
        'uncertain'
    )
), -- Trend indicator

-- Booking Metrics
total_bookings INTEGER DEFAULT 0, -- Cumulative bookings for the date
new_bookings_today INTEGER DEFAULT 0, -- New bookings made on this date
cancellations_today INTEGER DEFAULT 0, -- Cancellations processed on this date
modifications_today INTEGER DEFAULT 0, -- Booking modifications on this date

-- Booking Pace
booking_pace VARCHAR(50) CHECK (
    booking_pace IN (
        'ahead',
        'on_track',
        'behind',
        'significantly_behind'
    )
), -- Booking velocity compared to forecast
pace_vs_last_year INTEGER, -- Days ahead/behind last year
pace_vs_budget INTEGER, -- Days ahead/behind budget
pickup_last_7_days INTEGER, -- Bookings picked up in the last 7 days
pickup_last_30_days INTEGER, -- Bookings picked up in the last 30 days

-- Occupancy Metrics
rooms_available INTEGER NOT NULL, -- Total sellable rooms for the date
rooms_occupied INTEGER DEFAULT 0, -- Rooms occupied on the date
rooms_reserved INTEGER DEFAULT 0, -- Rooms reserved but not yet occupied
rooms_blocked INTEGER DEFAULT 0, -- Rooms blocked for maintenance or other reasons
rooms_out_of_order INTEGER DEFAULT 0, -- Rooms out of order/unavailable
rooms_remaining INTEGER, -- Remaining sellable rooms
occupancy_percent DECIMAL(5, 2), -- Percentage of rooms occupied
forecasted_occupancy_percent DECIMAL(5, 2), -- Predicted occupancy percentage
optimal_occupancy_target DECIMAL(5, 2), -- Target occupancy for optimal revenue

-- Revenue Metrics
adr DECIMAL(10, 2), -- Average Daily Rate
forecasted_adr DECIMAL(10, 2), -- Predicted ADR
target_adr DECIMAL(10, 2), -- Target ADR for revenue goals
revpar DECIMAL(10, 2), -- Revenue Per Available Room
forecasted_revpar DECIMAL(10, 2), -- Predicted RevPAR
target_revpar DECIMAL(10, 2), -- Target RevPAR for revenue goals
total_revenue DECIMAL(12, 2) DEFAULT 0.00, -- Total revenue for the date
forecasted_revenue DECIMAL(12, 2), -- Predicted total revenue
revenue_potential DECIMAL(12, 2), -- Potential revenue based on forecast

-- Market Segments
segment_distribution JSONB, -- {leisure: 60%, corporate: 30%, group: 10%}
top_segment VARCHAR(100), -- Highest contributing market segment
segment_diversity_score DECIMAL(5, 2), -- Diversity index of market segments

-- Channel Distribution
channel_distribution JSONB, -- {direct: 40%, ota: 50%, gds: 10%}
direct_booking_percent DECIMAL(5, 2), -- Percentage of direct bookings
ota_booking_percent DECIMAL(5, 2), -- Percentage of OTA bookings

-- Lead Time
average_lead_time_days INTEGER, -- Mean lead time for bookings
median_lead_time_days INTEGER, -- Median lead time for bookings
booking_window VARCHAR(50) CHECK (
    booking_window IN (
        'same_day',
        'next_day',
        'within_week',
        'within_month',
        'advance'
    )
),

-- Length of Stay
average_los DECIMAL(4, 2), -- Average length of stay
most_common_los INTEGER, -- Most common length of stay
los_distribution JSONB, -- {1: 20%, 2: 40%, 3: 25%, 4+: 15%}

-- Events
has_events BOOLEAN DEFAULT FALSE, -- Indicates if there are events on this date
events_count INTEGER DEFAULT 0, -- Number of events on this date
events JSONB, -- [{name, type, impact, attendance}]
event_impact_score INTEGER CHECK (
    event_impact_score BETWEEN 0 AND 100
), -- Aggregate event impact rating
major_event_name VARCHAR(255), -- Name of the most significant event

-- Competition
competitor_occupancy_avg DECIMAL(5, 2), -- Average occupancy of competitors
competitor_adr_avg DECIMAL(10, 2), -- Average ADR of competitors
market_occupancy DECIMAL(5, 2), -- Overall market occupancy
our_market_share DECIMAL(5, 2), -- Our share of the market

-- Pricing Strategy
recommended_pricing_strategy VARCHAR(100) CHECK (
    recommended_pricing_strategy IN (
        'discount',
        'standard',
        'premium',
        'dynamic',
        'yield_max',
        'stay_restrictions'
    )
), -- AI-recommended pricing approach based on demand analysis
min_stay_recommendation INTEGER, -- Suggested minimum stay
max_stay_recommendation INTEGER, -- Suggested maximum stay
close_to_arrival BOOLEAN DEFAULT FALSE, -- Indicates if bookings close close to arrival date

-- Restrictions
min_stay_restriction INTEGER, -- Minimum stay restriction
max_stay_restriction INTEGER, -- Maximum stay restriction
closed_to_arrival BOOLEAN DEFAULT FALSE, -- Indicates if bookings are closed to arrival
closed_to_departure BOOLEAN DEFAULT FALSE, -- Indicates if bookings are closed to departure

-- Group Business
group_blocks_count INTEGER DEFAULT 0, -- Number of group blocks booked
group_rooms_blocked INTEGER DEFAULT 0, -- Number of rooms blocked for groups
group_pickup_percent DECIMAL(5, 2), -- Percentage of group pickup

-- Weather (if integrated)
weather_condition VARCHAR(100), -- e.g., Sunny, Rainy
expected_precipitation_mm DECIMAL(5, 2), -- Forecasted precipitation
expected_high_temperature_celsius DECIMAL(4, 1), -- Forecasted high temp
expected_low_temperature_celsius DECIMAL(4, 1), -- Forecasted low temp
actual_precipitation_mm DECIMAL(5, 2), -- Actual precipitation
actual_high_temperature_celsius DECIMAL(4, 1), -- Actual high temp
actual_low_temperature_celsius DECIMAL(4, 1), -- Actual low temp
temperature_celsius DECIMAL(4, 1), -- Forecast/actual temp
weather_impact_score INTEGER CHECK (
    weather_impact_score BETWEEN -10 AND 10
), -- Weather impact on demand

-- Alerts & Actions
requires_attention BOOLEAN DEFAULT FALSE, -- Flag for revenue manager review
alert_reasons VARCHAR(255) [], -- Reasons for alerting
recommended_actions VARCHAR(255) [], -- Suggested actions based on alerts
action_taken VARCHAR(255), -- Description of action taken
action_taken_by UUID, -- Identifier of the person who took action
action_taken_at TIMESTAMP WITH TIME ZONE, -- Timestamp of action taken
-- Historical Comparison
same_day_last_year_occupancy DECIMAL(5, 2), -- Occupancy on the same day last year
same_day_last_year_adr DECIMAL(10, 2), -- ADR on the same day last year
variance_vs_last_year_occupancy DECIMAL(5, 2), -- Occupancy variance compared to last year
variance_vs_last_year_adr DECIMAL(10, 2), -- ADR variance compared to last year

-- Notes & Analysis
demand_notes TEXT, -- Notes on demand patterns and anomalies
market_conditions TEXT, -- Description of current market conditions
revenue_manager_notes TEXT, -- Notes from the revenue manager

-- Metadata
metadata JSONB, -- Additional metadata in JSON format
tags VARCHAR(100) [], -- Categorisation labels
raw_data JSONB, -- Raw data snapshot for auditing

-- Standard Timestamps
created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- Record creation timestamp
updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- Last update timestamp
created_by UUID, -- Creator identifier
updated_by UUID, -- Modifier identifier

-- Soft Delete
is_deleted BOOLEAN DEFAULT FALSE, -- Soft delete flag
deleted_at TIMESTAMP WITH TIME ZONE, -- Soft delete timestamp
deleted_by UUID, -- Actor who deleted

-- Unique Constraint
UNIQUE(property_id, calendar_date) );

-- Indexes for demand_calendar

-- Composite Indexes for Common Queries

-- Comments
COMMENT ON TABLE demand_calendar IS 'Tracks daily demand patterns, events, booking pace, and market conditions for revenue optimization';

COMMENT ON COLUMN demand_calendar.demand_score IS 'Overall demand intensity score from 0-100';

COMMENT ON COLUMN demand_calendar.booking_pace IS 'Booking velocity compared to forecast: ahead, on_track, behind, significantly_behind';

COMMENT ON COLUMN demand_calendar.events IS 'JSON array of events impacting demand for this date';

COMMENT ON COLUMN demand_calendar.recommended_pricing_strategy IS 'AI-recommended pricing approach based on demand analysis';

\echo 'demand_calendar table created successfully!'
