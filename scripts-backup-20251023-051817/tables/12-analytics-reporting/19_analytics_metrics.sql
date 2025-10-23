-- =====================================================
-- analytics_metrics.sql
-- Analytics Metrics Table
-- Industry Standard: Business intelligence KPIs
-- Pattern: Data Warehouse, Time-Series Analytics
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating analytics_metrics table...'

-- =====================================================
-- ANALYTICS_METRICS TABLE
-- Time-series KPI data
-- Occupancy, ADR, RevPAR, etc.
-- =====================================================

CREATE TABLE IF NOT EXISTS analytics_metrics (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy & Hierarchy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Metric Information
    metric_type metric_type NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_code VARCHAR(50) NOT NULL,

    -- Time Dimension
    metric_date DATE NOT NULL,
    time_granularity time_granularity NOT NULL DEFAULT 'DAILY',

    -- Metric Value
    metric_value DECIMAL(15,4) NOT NULL,
    metric_unit VARCHAR(50),

    -- Additional Dimensions
    room_type_id UUID,
    rate_id UUID,
    source VARCHAR(50),
    segment VARCHAR(50),

    -- Comparison Values
    previous_period_value DECIMAL(15,4),
    previous_year_value DECIMAL(15,4),
    budget_value DECIMAL(15,4),
    forecast_value DECIMAL(15,4),

    -- Variance
    period_variance DECIMAL(15,4),
    year_variance DECIMAL(15,4),

    -- Status
    status analytics_status NOT NULL DEFAULT 'COMPLETED',

    -- Calculation Details
    calculation_method VARCHAR(100),
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Custom Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by VARCHAR(100)
);

-- =====================================================
-- TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE analytics_metrics IS 'Time-series KPI metrics for analytics';
COMMENT ON COLUMN analytics_metrics.id IS 'Unique metric record identifier (UUID)';
COMMENT ON COLUMN analytics_metrics.tenant_id IS 'Reference to tenants.id';
COMMENT ON COLUMN analytics_metrics.property_id IS 'Reference to properties.id';
COMMENT ON COLUMN analytics_metrics.metric_type IS 'ENUM: occupancy, revenue, adr, revpar, rooms_sold, cancellations, no_shows, guest_satisfaction';
COMMENT ON COLUMN analytics_metrics.metric_name IS 'Display name (e.g., Occupancy Rate, ADR)';
COMMENT ON COLUMN analytics_metrics.metric_code IS 'Code (OCC, ADR, REVPAR, etc.)';
COMMENT ON COLUMN analytics_metrics.metric_date IS 'Date for this metric';
COMMENT ON COLUMN analytics_metrics.time_granularity IS 'ENUM: hourly, daily, weekly, monthly, quarterly, yearly';
COMMENT ON COLUMN analytics_metrics.metric_value IS 'Actual metric value';
COMMENT ON COLUMN analytics_metrics.metric_unit IS 'Unit: percent, currency, count, days, score';
COMMENT ON COLUMN analytics_metrics.room_type_id IS 'Optional room type dimension';
COMMENT ON COLUMN analytics_metrics.source IS 'Booking source dimension';
COMMENT ON COLUMN analytics_metrics.segment IS 'Customer segment dimension';
COMMENT ON COLUMN analytics_metrics.previous_period_value IS 'Previous period comparison';
COMMENT ON COLUMN analytics_metrics.previous_year_value IS 'Year-over-year comparison';
COMMENT ON COLUMN analytics_metrics.status IS 'ENUM: calculated, estimated, projected, verified, adjusted';

\echo 'Analytics_metrics table created successfully!'
