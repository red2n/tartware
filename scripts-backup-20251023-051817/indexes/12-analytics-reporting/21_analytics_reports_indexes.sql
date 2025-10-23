-- =====================================================
-- 21_analytics_reports_indexes.sql
-- Indexes for analytics_reports table
-- Performance optimization for report queries
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating indexes for analytics_reports table...'

-- Foreign key indexes
CREATE INDEX IF NOT EXISTS idx_analytics_reports_tenant_id ON analytics_reports(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_reports_created_by_user ON analytics_reports(created_by_user_id) WHERE deleted_at IS NULL;

-- Report code lookup
CREATE INDEX IF NOT EXISTS idx_analytics_reports_code ON analytics_reports(report_code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_reports_tenant_code ON analytics_reports(tenant_id, report_code) WHERE deleted_at IS NULL;

-- Report name search
CREATE INDEX IF NOT EXISTS idx_analytics_reports_name ON analytics_reports(report_name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_reports_name_trgm ON analytics_reports USING gin(report_name gin_trgm_ops)
    WHERE deleted_at IS NULL;

-- Report type
CREATE INDEX IF NOT EXISTS idx_analytics_reports_type ON analytics_reports(report_type) WHERE deleted_at IS NULL;

-- Status
CREATE INDEX IF NOT EXISTS idx_analytics_reports_is_active ON analytics_reports(is_active) WHERE deleted_at IS NULL;

-- Sharing and visibility
CREATE INDEX IF NOT EXISTS idx_analytics_reports_is_public ON analytics_reports(is_public) WHERE deleted_at IS NULL;

-- Composite for tenant reports
CREATE INDEX IF NOT EXISTS idx_analytics_reports_tenant_active ON analytics_reports(tenant_id, is_active, deleted_at)
    WHERE deleted_at IS NULL;

-- Scheduling
CREATE INDEX IF NOT EXISTS idx_analytics_reports_is_scheduled ON analytics_reports(is_scheduled) WHERE is_scheduled = true AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_reports_next_run ON analytics_reports(next_run_at)
    WHERE is_scheduled = true AND next_run_at IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_reports_last_run ON analytics_reports(last_run_at) WHERE last_run_at IS NOT NULL;

-- JSONB indexes
CREATE INDEX IF NOT EXISTS idx_analytics_reports_definition_gin ON analytics_reports USING GIN(definition);
CREATE INDEX IF NOT EXISTS idx_analytics_reports_viz_config_gin ON analytics_reports USING GIN(visualization_config);
CREATE INDEX IF NOT EXISTS idx_analytics_reports_schedule_gin ON analytics_reports USING GIN(schedule_config);
CREATE INDEX IF NOT EXISTS idx_analytics_reports_shared_gin ON analytics_reports USING GIN(shared_with);
CREATE INDEX IF NOT EXISTS idx_analytics_reports_metadata_gin ON analytics_reports USING GIN(metadata);

-- Composite for user reports
CREATE INDEX IF NOT EXISTS idx_analytics_reports_user_reports ON analytics_reports(created_by_user_id, is_active, deleted_at)
    WHERE deleted_at IS NULL;

-- Visualization type
CREATE INDEX IF NOT EXISTS idx_analytics_reports_viz_type ON analytics_reports(visualization_type) WHERE deleted_at IS NULL;

-- Audit trail indexes
CREATE INDEX IF NOT EXISTS idx_analytics_reports_created_at ON analytics_reports(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_reports_updated_at ON analytics_reports(updated_at);

-- Soft delete index
CREATE INDEX IF NOT EXISTS idx_analytics_reports_deleted_at ON analytics_reports(deleted_at) WHERE deleted_at IS NOT NULL;

\echo '✓ Analytics_reports indexes created successfully!'
