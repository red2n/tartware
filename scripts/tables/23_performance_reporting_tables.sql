-- =====================================================
-- 15_performance_reporting_tables.sql
-- Performance Reporting Table Structures
-- Date: 2025-10-15
-- Purpose: Tables for storing performance reports and alerts
-- =====================================================

\c tartware

\echo ''
\echo '======================================================'
\echo '  Creating Performance Reporting Tables'
\echo '======================================================'
\echo ''

-- =====================================================
-- REPORTING TABLES
-- =====================================================

-- =====================================================
-- PERFORMANCE_REPORTS TABLE
-- Store generated performance reports
-- =====================================================

CREATE TABLE IF NOT EXISTS performance_reports (
    -- Primary Key
    report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Report Classification
    report_type VARCHAR(50) NOT NULL,
    report_name VARCHAR(200) NOT NULL,

    -- Report Content
    report_data JSONB NOT NULL,

    -- Severity & Status
    severity VARCHAR(20) DEFAULT 'INFO',
    status VARCHAR(20) DEFAULT 'PENDING',

    -- Timestamps
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP,

    -- Distribution
    recipients TEXT[],

    -- Constraints
    CONSTRAINT chk_severity CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
    CONSTRAINT chk_status CHECK (status IN ('PENDING', 'SENT', 'FAILED'))
);

CREATE INDEX idx_performance_reports_type_date ON performance_reports(report_type, generated_at DESC);
CREATE INDEX idx_performance_reports_severity ON performance_reports(severity);

COMMENT ON TABLE performance_reports IS
'Stores generated performance reports with JSON data';

-- =====================================================
-- REPORT_SCHEDULES TABLE
-- Configuration for scheduled performance reports
-- =====================================================

CREATE TABLE IF NOT EXISTS report_schedules (
    -- Primary Key
    schedule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Report Configuration
    report_type VARCHAR(50) NOT NULL UNIQUE,
    schedule_expression VARCHAR(100) NOT NULL, -- cron expression

    -- Status
    is_active BOOLEAN DEFAULT true,

    -- Execution Tracking
    last_run TIMESTAMP,
    next_run TIMESTAMP,

    -- Distribution
    recipients TEXT[],

    -- Additional Configuration
    config JSONB DEFAULT '{}',

    -- Audit Fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_report_schedules_active ON report_schedules(is_active, next_run)
WHERE is_active = true;

COMMENT ON TABLE report_schedules IS
'Configuration for scheduled performance reports';

-- Performance thresholds for alerting
CREATE TABLE IF NOT EXISTS performance_thresholds (
    threshold_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_name VARCHAR(100) NOT NULL UNIQUE,
    warning_threshold NUMERIC,
    critical_threshold NUMERIC,
    check_interval INTERVAL DEFAULT '5 minutes',
    is_active BOOLEAN DEFAULT true,
    last_checked TIMESTAMP,
    alert_recipients TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_performance_thresholds_active ON performance_thresholds(is_active)
WHERE is_active = true;

COMMENT ON TABLE performance_thresholds IS
'Defines thresholds for performance metrics';

\echo '✓ Performance reporting tables created'
\echo ''
