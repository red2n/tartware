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

COMMENT ON COLUMN performance_baselines.baseline_id IS 'Unique identifier for the baseline record';
COMMENT ON COLUMN performance_baselines.metric_name IS 'Name of the performance metric being baselined';
COMMENT ON COLUMN performance_baselines.time_window IS 'Aggregation window: hourly, daily, weekly, or monthly';
COMMENT ON COLUMN performance_baselines.baseline_value IS 'Computed baseline (mean) value for the metric';
COMMENT ON COLUMN performance_baselines.stddev_value IS 'Standard deviation used for anomaly detection bounds';
COMMENT ON COLUMN performance_baselines.min_value IS 'Observed minimum value during the baseline period';
COMMENT ON COLUMN performance_baselines.max_value IS 'Observed maximum value during the baseline period';
COMMENT ON COLUMN performance_baselines.sample_count IS 'Number of data points used to compute the baseline';
COMMENT ON COLUMN performance_baselines.last_updated IS 'Timestamp when the baseline was last recalculated';

\echo '✓ performance_baselines created.'
