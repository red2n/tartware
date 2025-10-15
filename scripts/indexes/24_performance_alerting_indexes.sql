-- =====================================================
-- 24_performance_alerting_indexes.sql
-- Indexes for performance_baselines, performance_alerts,
-- and alert_rules tables
-- 
-- Performance optimization for alerting system
-- =====================================================

\c tartware

-- Drop indexes if they exist (for development)
DROP INDEX IF EXISTS idx_performance_baselines_metric;
DROP INDEX IF EXISTS idx_performance_baselines_updated;
DROP INDEX IF EXISTS idx_performance_alerts_type;
DROP INDEX IF EXISTS idx_performance_alerts_severity;
DROP INDEX IF EXISTS idx_performance_alerts_created;
DROP INDEX IF EXISTS idx_performance_alerts_unacknowledged;
DROP INDEX IF EXISTS idx_alert_rules_active;
DROP INDEX IF EXISTS idx_alert_rules_name;

-- Performance Baselines Indexes
CREATE INDEX idx_performance_baselines_metric 
    ON performance_baselines(metric_name, time_window);

COMMENT ON INDEX idx_performance_baselines_metric IS 'Baseline lookup by metric and time window';

CREATE INDEX idx_performance_baselines_updated 
    ON performance_baselines(last_updated DESC);

COMMENT ON INDEX idx_performance_baselines_updated IS 'Recently updated baselines';

-- Performance Alerts Indexes
CREATE INDEX idx_performance_alerts_type 
    ON performance_alerts(alert_type, created_at DESC);

COMMENT ON INDEX idx_performance_alerts_type IS 'Alert type filtering with date sorting';

CREATE INDEX idx_performance_alerts_severity 
    ON performance_alerts(severity, acknowledged, created_at DESC);

COMMENT ON INDEX idx_performance_alerts_severity IS 'Severity filtering with acknowledgment status';

CREATE INDEX idx_performance_alerts_created 
    ON performance_alerts(created_at DESC);

COMMENT ON INDEX idx_performance_alerts_created IS 'Recent alerts chronologically';

CREATE INDEX idx_performance_alerts_unacknowledged 
    ON performance_alerts(severity, created_at DESC) 
    WHERE acknowledged = FALSE;

COMMENT ON INDEX idx_performance_alerts_unacknowledged IS 'Find unacknowledged alerts by severity';

-- Alert Rules Indexes
CREATE INDEX idx_alert_rules_active 
    ON alert_rules(is_active, rule_name) 
    WHERE is_active = TRUE;

COMMENT ON INDEX idx_alert_rules_active IS 'Active alert rules';

CREATE INDEX idx_alert_rules_name 
    ON alert_rules(rule_name);

COMMENT ON INDEX idx_alert_rules_name IS 'Rule name lookup';

-- Success message
\echo '✓ Indexes created: performance_alerting tables (24/37)'
\echo '  - 8 performance indexes'
\echo '  - Alerting system optimized'
\echo ''
