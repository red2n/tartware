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

\echo '✓ performance_thresholds created.'
