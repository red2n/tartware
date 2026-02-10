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

COMMENT ON COLUMN report_schedules.schedule_id IS 'Unique identifier for the report schedule';
COMMENT ON COLUMN report_schedules.report_type IS 'Type of performance report to generate on schedule';
COMMENT ON COLUMN report_schedules.schedule_expression IS 'Cron expression defining report generation frequency';
COMMENT ON COLUMN report_schedules.is_active IS 'Whether this schedule is currently enabled';
COMMENT ON COLUMN report_schedules.last_run IS 'Timestamp of the most recent scheduled execution';
COMMENT ON COLUMN report_schedules.next_run IS 'Computed timestamp for the next scheduled execution';
COMMENT ON COLUMN report_schedules.recipients IS 'Distribution list for the scheduled report';
COMMENT ON COLUMN report_schedules.config IS 'Additional report configuration options as JSON';

\echo '✓ report_schedules created.'
