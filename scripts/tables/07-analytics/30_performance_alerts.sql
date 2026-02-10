-- =====================================================
-- performance_alerts.sql
-- Alert history and tracking
-- =====================================================

\c tartware

\echo 'Creating performance_alerts table...'

CREATE TABLE IF NOT EXISTS performance_alerts (
    -- Primary Key
    alert_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Alert Classification
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,

    -- Metric Information
    metric_name VARCHAR(100),
    current_value NUMERIC,
    baseline_value NUMERIC,
    deviation_percent NUMERIC,

    -- Alert Details
    alert_message TEXT NOT NULL,
    details JSONB,

    -- Acknowledgment
    acknowledged BOOLEAN DEFAULT false,
    acknowledged_by VARCHAR(100),
    acknowledged_at TIMESTAMP,

    -- Audit Fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT chk_alert_severity CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL'))
);

COMMENT ON TABLE performance_alerts IS
'Stores performance degradation alerts';

COMMENT ON COLUMN performance_alerts.alert_id IS 'Unique identifier for the alert';
COMMENT ON COLUMN performance_alerts.alert_type IS 'Category of alert (e.g. occupancy_drop, revenue_spike)';
COMMENT ON COLUMN performance_alerts.severity IS 'Alert severity: INFO, WARNING, or CRITICAL';
COMMENT ON COLUMN performance_alerts.metric_name IS 'Name of the metric that triggered the alert';
COMMENT ON COLUMN performance_alerts.current_value IS 'Observed metric value at time of alert';
COMMENT ON COLUMN performance_alerts.baseline_value IS 'Expected baseline value for comparison';
COMMENT ON COLUMN performance_alerts.deviation_percent IS 'Percentage deviation from the baseline value';
COMMENT ON COLUMN performance_alerts.alert_message IS 'Human-readable description of the alert condition';
COMMENT ON COLUMN performance_alerts.details IS 'Additional contextual data for the alert as JSON';
COMMENT ON COLUMN performance_alerts.acknowledged IS 'Whether the alert has been reviewed by an operator';
COMMENT ON COLUMN performance_alerts.acknowledged_by IS 'User who acknowledged the alert';
COMMENT ON COLUMN performance_alerts.acknowledged_at IS 'Timestamp when the alert was acknowledged';

\echo '✓ performance_alerts created.'
