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

\echo '✓ performance_alerts created.'
