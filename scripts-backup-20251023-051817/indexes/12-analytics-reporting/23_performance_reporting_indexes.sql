-- =====================================================
-- 23_performance_reporting_indexes.sql
-- Indexes for performance_reports, report_schedules,
-- and performance_thresholds tables
--
-- Performance optimization for reporting system
-- =====================================================

\c tartware

-- Drop indexes if they exist (for development)
DROP INDEX IF EXISTS idx_performance_reports_type_date;
DROP INDEX IF EXISTS idx_performance_reports_severity;
DROP INDEX IF EXISTS idx_performance_reports_status;
DROP INDEX IF EXISTS idx_performance_reports_generated;
DROP INDEX IF EXISTS idx_report_schedules_active;
DROP INDEX IF EXISTS idx_report_schedules_next_run;
DROP INDEX IF EXISTS idx_performance_thresholds_active;
DROP INDEX IF EXISTS idx_performance_thresholds_metric;

-- Performance Reports Indexes
CREATE INDEX idx_performance_reports_type_date
    ON performance_reports(report_type, generated_at DESC);

COMMENT ON INDEX idx_performance_reports_type_date IS 'Report type filtering with date sorting';

CREATE INDEX idx_performance_reports_severity
    ON performance_reports(severity, generated_at DESC)
    WHERE status != 'SENT';

COMMENT ON INDEX idx_performance_reports_severity IS 'Find unsent reports by severity';

CREATE INDEX idx_performance_reports_status
    ON performance_reports(status, generated_at DESC);

COMMENT ON INDEX idx_performance_reports_status IS 'Status-based filtering';

CREATE INDEX idx_performance_reports_generated
    ON performance_reports(generated_at DESC);

COMMENT ON INDEX idx_performance_reports_generated IS 'Recent reports chronologically';

-- Report Schedules Indexes
CREATE INDEX idx_report_schedules_active
    ON report_schedules(is_active, next_run)
    WHERE is_active = TRUE;

COMMENT ON INDEX idx_report_schedules_active IS 'Active schedules by next run time';

CREATE INDEX idx_report_schedules_next_run
    ON report_schedules(next_run)
    WHERE is_active = TRUE;

COMMENT ON INDEX idx_report_schedules_next_run IS 'Find schedules due to run';

-- Performance Thresholds Indexes
CREATE INDEX idx_performance_thresholds_active
    ON performance_thresholds(is_active, last_checked)
    WHERE is_active = TRUE;

COMMENT ON INDEX idx_performance_thresholds_active IS 'Active thresholds by last check time';

CREATE INDEX idx_performance_thresholds_metric
    ON performance_thresholds(metric_name)
    WHERE is_active = TRUE;

COMMENT ON INDEX idx_performance_thresholds_metric IS 'Metric name lookup';

-- Success message
\echo '✓ Indexes created: performance_reporting tables (23/37)'
\echo '  - 8 performance indexes'
\echo '  - Reporting system optimized'
\echo ''
