-- =====================================================
-- performance_baselines.sql
-- Performance baseline storage for anomaly detection
-- =====================================================

\c tartware

\echo 'Creating performance_baselines table...'

CREATE TABLE IF NOT EXISTS performance_baselines (
    -- Primary Key
    baseline_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Metric Identification
    metric_name VARCHAR(100) NOT NULL,
    time_window VARCHAR(50) NOT NULL, -- 'hourly', 'daily', 'weekly'

    -- Statistical Values
    baseline_value NUMERIC NOT NULL,
    stddev_value NUMERIC,
    min_value NUMERIC,
    max_value NUMERIC,
    sample_count INTEGER,

    -- Timestamps
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT chk_time_window CHECK (time_window IN ('hourly', 'daily', 'weekly', 'monthly')),
    UNIQUE(metric_name, time_window)
);

COMMENT ON TABLE performance_baselines IS
'Stores baseline values for performance metrics';

\echo '✓ performance_baselines created.'
