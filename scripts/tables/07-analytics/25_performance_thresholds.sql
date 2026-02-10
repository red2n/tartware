-- =====================================================
-- performance_thresholds.sql
-- Defines thresholds for performance metrics
-- =====================================================

\c tartware

\echo 'Creating performance_thresholds table...'

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

COMMENT ON TABLE performance_thresholds IS
'Defines thresholds for performance metrics';

COMMENT ON COLUMN performance_thresholds.threshold_id IS 'Unique identifier for the threshold definition';
COMMENT ON COLUMN performance_thresholds.metric_name IS 'Name of the performance metric being monitored';
COMMENT ON COLUMN performance_thresholds.warning_threshold IS 'Numeric value that triggers a warning-level alert';
COMMENT ON COLUMN performance_thresholds.critical_threshold IS 'Numeric value that triggers a critical-level alert';
COMMENT ON COLUMN performance_thresholds.check_interval IS 'How frequently the metric is evaluated against thresholds';
COMMENT ON COLUMN performance_thresholds.is_active IS 'Whether this threshold check is currently enabled';
COMMENT ON COLUMN performance_thresholds.last_checked IS 'Timestamp of the most recent threshold evaluation';
COMMENT ON COLUMN performance_thresholds.alert_recipients IS 'Notification recipients when threshold is breached';

\echo '✓ performance_thresholds created.'
