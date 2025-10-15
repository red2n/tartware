-- =====================================================
-- analytics_reports.sql
-- Analytics Reports Table
-- Industry Standard: Saved reports and dashboards
-- Pattern: Report Definition, Business Intelligence
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating analytics_reports table...'

-- =====================================================
-- ANALYTICS_REPORTS TABLE
-- Saved reports and dashboard definitions
-- User-defined analytics views
-- =====================================================

CREATE TABLE IF NOT EXISTS analytics_reports (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,

    -- Report Information
    report_name VARCHAR(255) NOT NULL,
    report_code VARCHAR(50) NOT NULL,
    report_type VARCHAR(50) NOT NULL,

    -- Description
    description TEXT,

    -- Report Definition
    definition JSONB NOT NULL DEFAULT '{
        "metrics": [],
        "dimensions": [],
        "filters": {},
        "dateRange": {},
        "groupBy": [],
        "sortBy": []
    }'::jsonb,

    -- Visualization
    visualization_type VARCHAR(50) DEFAULT 'table',
    visualization_config JSONB DEFAULT '{}'::jsonb,

    -- Scheduling
    is_scheduled BOOLEAN DEFAULT false,
    schedule_config JSONB DEFAULT '{
        "frequency": "daily",
        "time": "08:00",
        "recipients": []
    }'::jsonb,
    last_run_at TIMESTAMP,
    next_run_at TIMESTAMP,

    -- Sharing
    is_public BOOLEAN DEFAULT false,
    created_by_user_id UUID NOT NULL,
    shared_with JSONB DEFAULT '[]'::jsonb,

    -- Status
    is_active BOOLEAN DEFAULT true,

    -- Custom Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100),

    -- Soft Delete
    deleted_at TIMESTAMP,
    deleted_by VARCHAR(100),

    -- Optimistic Locking
    version BIGINT DEFAULT 0,

    -- Constraints
    CONSTRAINT analytics_reports_code_unique UNIQUE (tenant_id, report_code)
);

-- =====================================================
-- TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE analytics_reports IS 'Saved analytics reports and dashboards';
COMMENT ON COLUMN analytics_reports.id IS 'Unique report identifier (UUID)';
COMMENT ON COLUMN analytics_reports.tenant_id IS 'Reference to tenants.id';
COMMENT ON COLUMN analytics_reports.report_name IS 'Display name (e.g., Monthly Revenue Summary)';
COMMENT ON COLUMN analytics_reports.report_code IS 'Unique code (e.g., MONTHLY_REV)';
COMMENT ON COLUMN analytics_reports.report_type IS 'Type: standard, custom, dashboard, snapshot, scheduled';
COMMENT ON COLUMN analytics_reports.definition IS 'Report definition: metrics, filters, grouping (JSONB)';
COMMENT ON COLUMN analytics_reports.visualization_type IS 'Type: table, chart, graph, card, pivot';
COMMENT ON COLUMN analytics_reports.visualization_config IS 'Chart/visualization settings (JSONB)';
COMMENT ON COLUMN analytics_reports.is_scheduled IS 'Automatically run on schedule';
COMMENT ON COLUMN analytics_reports.schedule_config IS 'Schedule configuration (JSONB)';
COMMENT ON COLUMN analytics_reports.is_public IS 'Visible to all users in tenant';
COMMENT ON COLUMN analytics_reports.created_by_user_id IS 'Reference to users.id (report creator)';
COMMENT ON COLUMN analytics_reports.shared_with IS 'Array of user IDs with access (JSONB)';
COMMENT ON COLUMN analytics_reports.deleted_at IS 'Soft delete timestamp (NULL = active)';

\echo 'Analytics_reports table created successfully!'
