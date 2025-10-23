-- =====================================================
-- 19_analytics_metrics_indexes.sql
-- Indexes for analytics_metrics table
-- Performance optimization for analytics queries
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating indexes for analytics_metrics table...'

-- Foreign key indexes
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_tenant_id ON analytics_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_property_id ON analytics_metrics(property_id);
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_room_type_id ON analytics_metrics(room_type_id) WHERE room_type_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_rate_id ON analytics_metrics(rate_id) WHERE rate_id IS NOT NULL;

-- Metric identification
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_type ON analytics_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_code ON analytics_metrics(metric_code);

-- Date and granularity queries (critical for time-series)
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_date ON analytics_metrics(metric_date);
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_granularity ON analytics_metrics(time_granularity);

-- Composite for property metrics (most common query)
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_property_date ON analytics_metrics(property_id, metric_code, metric_date, time_granularity);

-- Composite for metric time-series
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_timeseries ON analytics_metrics(metric_code, metric_date DESC, property_id);

-- Dimension filters
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_source ON analytics_metrics(source) WHERE source IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_segment ON analytics_metrics(segment) WHERE segment IS NOT NULL;

-- Status
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_status ON analytics_metrics(status);

-- Metric value (for filtering)
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_value ON analytics_metrics(metric_value);

-- Calculation tracking
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_calculated_at ON analytics_metrics(calculated_at);

-- JSONB index
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_metadata_gin ON analytics_metrics USING GIN(metadata);

-- Composite for dimensional analysis
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_dimensions ON analytics_metrics(
    property_id,
    metric_code,
    metric_date,
    time_granularity,
    COALESCE(room_type_id::text, ''),
    COALESCE(source, ''),
    COALESCE(segment, '')
);

-- Comparison queries
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_comparisons ON analytics_metrics(metric_code, metric_date, property_id)
    WHERE previous_period_value IS NOT NULL OR previous_year_value IS NOT NULL;

-- Audit trail indexes
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_created_at ON analytics_metrics(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_updated_at ON analytics_metrics(updated_at);

-- Date range queries (for dashboards)
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_date_range ON analytics_metrics(property_id, metric_code, time_granularity, metric_date);

\echo '✓ Analytics_metrics indexes created successfully!'
