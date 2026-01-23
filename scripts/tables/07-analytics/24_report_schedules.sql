-- =====================================================
-- report_schedules.sql
-- Configuration for scheduled performance reports
-- =====================================================

\c tartware

\echo 'Creating report_schedules table...'

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

COMMENT ON TABLE report_schedules IS
'Configuration for scheduled performance reports';

\echo '✓ report_schedules created.'
