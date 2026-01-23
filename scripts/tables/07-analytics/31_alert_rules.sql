-- =====================================================
-- alert_rules.sql
-- Alert rules configuration for automatic alert generation
-- =====================================================

\c tartware

\echo 'Creating alert_rules table...'

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

COMMENT ON TABLE alert_rules IS
'Defines rules for automatic alert generation';

\echo '✓ alert_rules created.'
