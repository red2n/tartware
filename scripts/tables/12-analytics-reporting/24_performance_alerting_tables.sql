-- =====================================================
-- 24_performance_alerting_tables.sql
-- Performance Alerting Table Structures
-- Date: 2025-10-15
-- Purpose: Tables for performance monitoring and alerting
-- =====================================================

\c tartware

\echo ''
\echo '======================================================'
\echo '  Creating Performance Alerting Tables'
\echo '======================================================'
\echo ''

-- =====================================================
-- ALERTING TABLES
-- =====================================================

-- =====================================================
-- PERFORMANCE_BASELINES TABLE
-- Performance baseline storage for anomaly detection
-- =====================================================

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

CREATE INDEX idx_performance_baselines_metric ON performance_baselines(metric_name, time_window);
CREATE INDEX idx_performance_baselines_updated ON performance_baselines(last_updated DESC);

COMMENT ON TABLE performance_baselines IS
'Stores baseline values for performance metrics';

-- =====================================================
-- PERFORMANCE_ALERTS TABLE
-- Alert history and tracking
-- =====================================================

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

CREATE INDEX idx_performance_alerts_type ON performance_alerts(alert_type, created_at DESC);
CREATE INDEX idx_performance_alerts_severity ON performance_alerts(severity, acknowledged)
WHERE acknowledged = false;
CREATE INDEX idx_performance_alerts_created ON performance_alerts(created_at DESC);

COMMENT ON TABLE performance_alerts IS
'Stores performance degradation alerts';

-- =====================================================
-- ALERT_RULES TABLE
-- Alert rules configuration for automatic alert generation
-- =====================================================

CREATE TABLE IF NOT EXISTS alert_rules (
    -- Primary Key
    rule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Rule Identification
    rule_name VARCHAR(100) NOT NULL UNIQUE,

    -- Metric Configuration
    metric_query TEXT NOT NULL,

    -- Condition Configuration
    condition_type VARCHAR(50) NOT NULL, -- 'threshold', 'deviation', 'trend'
    threshold_value NUMERIC,
    deviation_percent NUMERIC,
    time_window INTERVAL,

    -- Alert Configuration
    severity VARCHAR(20) DEFAULT 'WARNING',
    is_active BOOLEAN DEFAULT true,

    -- Notification Configuration
    notification_channels TEXT[],

    -- Audit Fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT chk_condition_type CHECK (condition_type IN ('threshold', 'deviation', 'trend', 'spike')),
    CONSTRAINT chk_rule_severity CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL'))
);

CREATE INDEX idx_alert_rules_active ON alert_rules(is_active) WHERE is_active = true;

COMMENT ON TABLE alert_rules IS
'Defines rules for automatic alert generation';

\echo '✓ Performance alerting tables created'
\echo ''
