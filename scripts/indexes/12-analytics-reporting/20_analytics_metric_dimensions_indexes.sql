-- =====================================================
-- 20_analytics_metric_dimensions_indexes.sql
-- Indexes for analytics_metric_dimensions table
-- Performance optimization for dimensional analysis
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating indexes for analytics_metric_dimensions table...'

-- Foreign key indexes
CREATE INDEX IF NOT EXISTS idx_analytics_dimensions_metric_id ON analytics_metric_dimensions(metric_id);
CREATE INDEX IF NOT EXISTS idx_analytics_dimensions_tenant_id ON analytics_metric_dimensions(tenant_id);

-- Dimension queries
CREATE INDEX IF NOT EXISTS idx_analytics_dimensions_type ON analytics_metric_dimensions(dimension_type);
CREATE INDEX IF NOT EXISTS idx_analytics_dimensions_key ON analytics_metric_dimensions(dimension_key);
CREATE INDEX IF NOT EXISTS idx_analytics_dimensions_value ON analytics_metric_dimensions(dimension_value);

-- Composite for metric dimensions (most common query)
CREATE INDEX IF NOT EXISTS idx_analytics_dimensions_metric_type ON analytics_metric_dimensions(metric_id, dimension_type);

-- Metric value and percentage
CREATE INDEX IF NOT EXISTS idx_analytics_dimensions_metric_value ON analytics_metric_dimensions(metric_value);
CREATE INDEX IF NOT EXISTS idx_analytics_dimensions_percentage ON analytics_metric_dimensions(percentage_of_total)
    WHERE percentage_of_total IS NOT NULL;

-- Ranking
CREATE INDEX IF NOT EXISTS idx_analytics_dimensions_rank ON analytics_metric_dimensions(rank_position) WHERE rank_position IS NOT NULL;

-- JSONB index
CREATE INDEX IF NOT EXISTS idx_analytics_dimensions_metadata_gin ON analytics_metric_dimensions USING GIN(metadata);

-- Composite for dimension breakdown
CREATE INDEX IF NOT EXISTS idx_analytics_dimensions_breakdown ON analytics_metric_dimensions(metric_id, dimension_type, metric_value DESC);

-- Note: Table doesn't have created_at column, so audit index omitted

\echo '✓ Analytics_metric_dimensions indexes created successfully!'
