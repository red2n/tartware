-- =====================================================
-- analytics_metric_dimensions.sql
-- Analytics Metric Dimensions Table
-- Industry Standard: Dimensional analysis
-- Pattern: Star Schema, OLAP Cube Dimensions
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating analytics_metric_dimensions table...'

-- =====================================================
-- ANALYTICS_METRIC_DIMENSIONS TABLE
-- Dimensional breakdown of metrics
-- Support slice and dice analysis
-- =====================================================

CREATE TABLE IF NOT EXISTS analytics_metric_dimensions (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Foreign Keys
    metric_id UUID NOT NULL,
    tenant_id UUID NOT NULL,

    -- Dimension Information
    dimension_type VARCHAR(50) NOT NULL,
    dimension_key VARCHAR(100) NOT NULL,
    dimension_value VARCHAR(255) NOT NULL,

    -- Metric Contribution
    metric_value DECIMAL(15,4) NOT NULL,
    percentage_of_total DECIMAL(5,2),

    -- Ranking
    rank_position INTEGER,

    -- Custom Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Audit Fields
    created_by VARCHAR(100),
    updated_by VARCHAR(100),

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by VARCHAR(100),

    -- Optimistic Locking
    version BIGINT DEFAULT 0,
);

-- =====================================================
-- TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE analytics_metric_dimensions IS 'Dimensional breakdown for analytics metrics';
COMMENT ON COLUMN analytics_metric_dimensions.id IS 'Unique dimension record identifier (UUID)';
COMMENT ON COLUMN analytics_metric_dimensions.metric_id IS 'Reference to analytics_metrics.id';
COMMENT ON COLUMN analytics_metric_dimensions.dimension_type IS 'Type: room_type, rate_plan, source, segment, day_of_week, season, country, etc.';
COMMENT ON COLUMN analytics_metric_dimensions.dimension_key IS 'Dimension key (e.g., room_type_id, source_code)';
COMMENT ON COLUMN analytics_metric_dimensions.dimension_value IS 'Dimension value (e.g., Deluxe Suite, Booking.com)';
COMMENT ON COLUMN analytics_metric_dimensions.metric_value IS 'Metric value for this dimension';
COMMENT ON COLUMN analytics_metric_dimensions.percentage_of_total IS 'Percentage contribution';
COMMENT ON COLUMN analytics_metric_dimensions.rank_position IS 'Ranking within dimension type';

\echo 'Analytics_metric_dimensions table created successfully!'
