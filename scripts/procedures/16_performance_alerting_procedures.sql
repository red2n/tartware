-- =====================================================
-- 16_performance_alerting_procedures.sql
-- Real-time Performance Degradation Alerting
-- Date: 2025-10-15
-- Purpose: Detect and alert on performance degradation patterns
-- =====================================================

\c tartware

\echo ''
\echo '======================================================'
\echo '  Creating Performance Alerting Functions'
\echo '======================================================'
\echo ''

-- =====================================================
-- BASELINE CALCULATION FUNCTIONS
-- =====================================================

-- Calculate and update performance baselines
CREATE OR REPLACE FUNCTION update_performance_baselines()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- Query execution time baseline
    INSERT INTO performance_baselines (
        metric_name,
        time_window,
        baseline_value,
        stddev_value,
        min_value,
        max_value,
        sample_count
    )
    SELECT
        'query_execution_time',
        'hourly',
        AVG(mean_exec_time),
        STDDEV(mean_exec_time),
        MIN(mean_exec_time),
        MAX(mean_exec_time),
        COUNT(*)::INTEGER
    FROM pg_stat_statements
    WHERE calls > 10
    ON CONFLICT (metric_name, time_window)
    DO UPDATE SET
        baseline_value = EXCLUDED.baseline_value,
        stddev_value = EXCLUDED.stddev_value,
        min_value = EXCLUDED.min_value,
        max_value = EXCLUDED.max_value,
        sample_count = EXCLUDED.sample_count,
        last_updated = CURRENT_TIMESTAMP;

    -- Connection count baseline
    INSERT INTO performance_baselines (
        metric_name,
        time_window,
        baseline_value,
        sample_count
    )
    SELECT
        'connection_count',
        'hourly',
        (SELECT COUNT(*)::NUMERIC FROM pg_stat_activity),
        1
    ON CONFLICT (metric_name, time_window)
    DO UPDATE SET
        baseline_value = (performance_baselines.baseline_value * 0.9) + (EXCLUDED.baseline_value * 0.1),
        sample_count = performance_baselines.sample_count + 1,
        last_updated = CURRENT_TIMESTAMP;

    -- Cache hit rate baseline
    INSERT INTO performance_baselines (
        metric_name,
        time_window,
        baseline_value
    )
    SELECT
        'cache_hit_rate',
        'daily',
        ROUND(
            100.0 * SUM(heap_blks_hit) / NULLIF(SUM(heap_blks_hit) + SUM(heap_blks_read), 0), 2
        )
    FROM pg_statio_user_tables
    ON CONFLICT (metric_name, time_window)
    DO UPDATE SET
        baseline_value = EXCLUDED.baseline_value,
        last_updated = CURRENT_TIMESTAMP;

    -- Table scan rate baseline
    INSERT INTO performance_baselines (
        metric_name,
        time_window,
        baseline_value
    )
    SELECT
        'sequential_scan_rate',
        'daily',
        SUM(seq_scan)::NUMERIC / NULLIF(SUM(seq_scan + idx_scan), 0) * 100
    FROM pg_stat_user_tables
    ON CONFLICT (metric_name, time_window)
    DO UPDATE SET
        baseline_value = EXCLUDED.baseline_value,
        last_updated = CURRENT_TIMESTAMP;
END $$;

COMMENT ON FUNCTION update_performance_baselines() IS
'Updates performance baselines for anomaly detection.
Run periodically via cron: SELECT update_performance_baselines();';

-- =====================================================
-- ANOMALY DETECTION FUNCTIONS
-- =====================================================

-- Detect query performance degradation
CREATE OR REPLACE FUNCTION detect_query_degradation()
RETURNS TABLE(
    query_fingerprint TEXT,
    current_mean_time NUMERIC,
    baseline_mean_time NUMERIC,
    degradation_percent NUMERIC,
    calls BIGINT,
    alert_level TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_baseline NUMERIC;
    v_stddev NUMERIC;
BEGIN
    -- Get baseline
    SELECT baseline_value, stddev_value
    INTO v_baseline, v_stddev
    FROM performance_baselines
    WHERE metric_name = 'query_execution_time'
    AND time_window = 'hourly';

    IF v_baseline IS NULL THEN
        -- No baseline yet, calculate one
        PERFORM update_performance_baselines();
        SELECT baseline_value, stddev_value
        INTO v_baseline, v_stddev
        FROM performance_baselines
        WHERE metric_name = 'query_execution_time'
        AND time_window = 'hourly';

        IF v_baseline IS NULL THEN
            RETURN;  -- Still no data
        END IF;
    END IF;

    RETURN QUERY
    SELECT
        LEFT(query, 50) AS query_fingerprint,
        ROUND(mean_exec_time::NUMERIC, 2) AS current_mean_time,
        ROUND(v_baseline, 2) AS baseline_mean_time,
        ROUND((mean_exec_time - v_baseline) / NULLIF(v_baseline, 0) * 100, 2) AS degradation_percent,
        calls,
        CASE
            WHEN mean_exec_time > v_baseline + (3 * COALESCE(v_stddev, v_baseline * 0.1)) THEN 'CRITICAL'
            WHEN mean_exec_time > v_baseline + (2 * COALESCE(v_stddev, v_baseline * 0.1)) THEN 'WARNING'
            ELSE 'INFO'
        END AS alert_level
    FROM pg_stat_statements
    WHERE mean_exec_time > v_baseline * 1.5  -- At least 50% degradation
    AND calls > 10  -- Minimum calls to be significant
    AND query NOT LIKE '%pg_%'
    ORDER BY degradation_percent DESC
    LIMIT 10;
END $$;

COMMENT ON FUNCTION detect_query_degradation() IS
'Detects queries with significant performance degradation.
Usage: SELECT * FROM detect_query_degradation();';

-- Detect sudden spike in connections
CREATE OR REPLACE FUNCTION detect_connection_spike()
RETURNS TABLE(
    current_connections BIGINT,
    baseline_connections NUMERIC,
    spike_percent NUMERIC,
    alert_level TEXT,
    details TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_baseline NUMERIC;
    v_current BIGINT;
BEGIN
    -- Get baseline
    SELECT baseline_value
    INTO v_baseline
    FROM performance_baselines
    WHERE metric_name = 'connection_count'
    AND time_window = 'hourly';

    -- Get current
    SELECT COUNT(*)
    INTO v_current
    FROM pg_stat_activity;

    IF v_baseline IS NULL OR v_baseline = 0 THEN
        RETURN;
    END IF;

    IF v_current > v_baseline * 1.5 THEN
        RETURN QUERY
        SELECT
            v_current,
            v_baseline,
            ROUND((v_current - v_baseline) / v_baseline * 100, 2),
            CASE
                WHEN v_current > v_baseline * 3 THEN 'CRITICAL'
                WHEN v_current > v_baseline * 2 THEN 'WARNING'
                ELSE 'INFO'
            END,
            FORMAT('Connection spike detected: %s connections (baseline: %s)',
                v_current, ROUND(v_baseline, 0))::TEXT;
    END IF;
END $$;

COMMENT ON FUNCTION detect_connection_spike() IS
'Detects sudden spikes in database connections.
Usage: SELECT * FROM detect_connection_spike();';

-- Detect sudden cache hit rate drop
CREATE OR REPLACE FUNCTION detect_cache_degradation()
RETURNS TABLE(
    current_rate NUMERIC,
    baseline_rate NUMERIC,
    degradation_percent NUMERIC,
    alert_level TEXT,
    recommendation TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_baseline NUMERIC;
    v_current NUMERIC;
BEGIN
    -- Get baseline
    SELECT baseline_value
    INTO v_baseline
    FROM performance_baselines
    WHERE metric_name = 'cache_hit_rate'
    AND time_window = 'daily';

    -- Calculate current
    SELECT ROUND(
        100.0 * SUM(heap_blks_hit) / NULLIF(SUM(heap_blks_hit) + SUM(heap_blks_read), 0), 2
    )
    INTO v_current
    FROM pg_statio_user_tables;

    IF v_baseline IS NULL OR v_current >= v_baseline * 0.95 THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        v_current,
        v_baseline,
        ROUND((v_baseline - v_current) / v_baseline * 100, 2),
        CASE
            WHEN v_current < 85 THEN 'CRITICAL'
            WHEN v_current < 90 THEN 'WARNING'
            ELSE 'INFO'
        END,
        CASE
            WHEN v_current < 85 THEN 'URGENT: Increase shared_buffers or add more RAM'
            WHEN v_current < 90 THEN 'Consider increasing shared_buffers'
            ELSE 'Monitor cache performance'
        END::TEXT;
END $$;

COMMENT ON FUNCTION detect_cache_degradation() IS
'Detects drops in cache hit rate performance.
Usage: SELECT * FROM detect_cache_degradation();';

-- =====================================================
-- REAL-TIME MONITORING FUNCTION
-- =====================================================

-- Main monitoring function (call every minute)
CREATE OR REPLACE FUNCTION monitor_performance_degradation()
RETURNS TABLE(
    alert_type TEXT,
    severity TEXT,
    message TEXT,
    current_value NUMERIC,
    baseline_value NUMERIC,
    action_required TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_alert RECORD;
BEGIN
    -- Check query degradation
    FOR v_alert IN
        SELECT * FROM detect_query_degradation()
        WHERE alert_level IN ('WARNING', 'CRITICAL')
    LOOP
        -- Log alert
        INSERT INTO performance_alerts (
            alert_type,
            severity,
            metric_name,
            current_value,
            baseline_value,
            deviation_percent,
            alert_message,
            details
        ) VALUES (
            'QUERY_DEGRADATION',
            v_alert.alert_level,
            'query_execution_time',
            v_alert.current_mean_time,
            v_alert.baseline_mean_time,
            v_alert.degradation_percent,
            FORMAT('Query performance degraded by %s%%', v_alert.degradation_percent),
            jsonb_build_object(
                'query', v_alert.query_fingerprint,
                'calls', v_alert.calls
            )
        )
        ON CONFLICT DO NOTHING;  -- Avoid duplicate alerts

        RETURN QUERY
        SELECT
            'QUERY_DEGRADATION'::TEXT,
            v_alert.alert_level::TEXT,
            FORMAT('Query slower by %s%%: %s', v_alert.degradation_percent, v_alert.query_fingerprint)::TEXT,
            v_alert.current_mean_time,
            v_alert.baseline_mean_time,
            'Analyze query execution plan with EXPLAIN'::TEXT;
    END LOOP;

    -- Check connection spike
    FOR v_alert IN SELECT * FROM detect_connection_spike() LOOP
        INSERT INTO performance_alerts (
            alert_type,
            severity,
            metric_name,
            current_value,
            baseline_value,
            deviation_percent,
            alert_message
        ) VALUES (
            'CONNECTION_SPIKE',
            v_alert.alert_level,
            'connection_count',
            v_alert.current_connections,
            v_alert.baseline_connections,
            v_alert.spike_percent,
            v_alert.details
        )
        ON CONFLICT DO NOTHING;

        RETURN QUERY
        SELECT
            'CONNECTION_SPIKE'::TEXT,
            v_alert.alert_level::TEXT,
            v_alert.details::TEXT,
            v_alert.current_connections::NUMERIC,
            v_alert.baseline_connections,
            'Check application connection pooling'::TEXT;
    END LOOP;

    -- Check cache degradation
    FOR v_alert IN SELECT * FROM detect_cache_degradation() LOOP
        INSERT INTO performance_alerts (
            alert_type,
            severity,
            metric_name,
            current_value,
            baseline_value,
            deviation_percent,
            alert_message
        ) VALUES (
            'CACHE_DEGRADATION',
            v_alert.alert_level,
            'cache_hit_rate',
            v_alert.current_rate,
            v_alert.baseline_rate,
            v_alert.degradation_percent,
            FORMAT('Cache hit rate dropped to %s%%', v_alert.current_rate)
        )
        ON CONFLICT DO NOTHING;

        RETURN QUERY
        SELECT
            'CACHE_DEGRADATION'::TEXT,
            v_alert.alert_level::TEXT,
            FORMAT('Cache hit rate: %s%% (baseline: %s%%)', v_alert.current_rate, v_alert.baseline_rate)::TEXT,
            v_alert.current_rate,
            v_alert.baseline_rate,
            v_alert.recommendation::TEXT;
    END LOOP;
END $$;

COMMENT ON FUNCTION monitor_performance_degradation() IS
'Main monitoring function to detect performance degradation.
Run every minute via cron:
    * * * * * psql -U postgres -d tartware -c "SELECT * FROM monitor_performance_degradation();"

Or set up with pg_cron:
    SELECT cron.schedule(''perf-monitoring'', ''* * * * *'',
        $$SELECT monitor_performance_degradation();$$);';

-- =====================================================
-- ALERT MANAGEMENT FUNCTIONS
-- =====================================================

-- Get current active alerts
CREATE OR REPLACE FUNCTION get_active_alerts()
RETURNS TABLE(
    alert_id UUID,
    alert_type TEXT,
    severity TEXT,
    alert_message TEXT,
    created_at TIMESTAMP,
    age INTERVAL
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.alert_id,
        a.alert_type::TEXT,
        a.severity::TEXT,
        a.alert_message,
        a.created_at,
        NOW() - a.created_at
    FROM performance_alerts a
    WHERE a.acknowledged = false
    AND a.created_at > NOW() - INTERVAL '24 hours'
    ORDER BY
        CASE a.severity
            WHEN 'CRITICAL' THEN 1
            WHEN 'WARNING' THEN 2
            ELSE 3
        END,
        a.created_at DESC;
END $$;

COMMENT ON FUNCTION get_active_alerts() IS
'Returns all unacknowledged performance alerts.
Usage: SELECT * FROM get_active_alerts();';

-- Acknowledge an alert
CREATE OR REPLACE FUNCTION acknowledge_alert(
    p_alert_id UUID,
    p_acknowledged_by VARCHAR DEFAULT 'system'
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE performance_alerts
    SET acknowledged = true,
        acknowledged_by = p_acknowledged_by,
        acknowledged_at = CURRENT_TIMESTAMP
    WHERE alert_id = p_alert_id;

    IF NOT FOUND THEN
        RAISE NOTICE 'Alert % not found', p_alert_id;
    ELSE
        RAISE NOTICE 'Alert % acknowledged by %', p_alert_id, p_acknowledged_by;
    END IF;
END $$;

COMMENT ON FUNCTION acknowledge_alert(UUID, VARCHAR) IS
'Acknowledges a performance alert.
Usage: SELECT acknowledge_alert(''uuid-here'', ''username'');';

-- Acknowledge all alerts of a type
CREATE OR REPLACE FUNCTION acknowledge_alerts_by_type(
    p_alert_type VARCHAR,
    p_acknowledged_by VARCHAR DEFAULT 'system'
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE performance_alerts
    SET acknowledged = true,
        acknowledged_by = p_acknowledged_by,
        acknowledged_at = CURRENT_TIMESTAMP
    WHERE alert_type = p_alert_type
    AND acknowledged = false;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    RAISE NOTICE 'Acknowledged % alerts of type %', v_count, p_alert_type;

    RETURN v_count;
END $$;

COMMENT ON FUNCTION acknowledge_alerts_by_type(VARCHAR, VARCHAR) IS
'Acknowledges all alerts of a specific type.
Usage: SELECT acknowledge_alerts_by_type(''QUERY_DEGRADATION'', ''dba'');';

-- =====================================================
-- MONITORING VIEWS
-- =====================================================

\echo 'Creating alerting views...'

-- Active performance alerts
CREATE OR REPLACE VIEW v_active_performance_alerts AS
SELECT
    alert_id,
    alert_type,
    severity,
    alert_message,
    current_value,
    baseline_value,
    deviation_percent,
    created_at,
    ROUND(EXTRACT(EPOCH FROM (NOW() - created_at)) / 60) AS minutes_ago
FROM performance_alerts
WHERE acknowledged = false
AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY
    CASE severity
        WHEN 'CRITICAL' THEN 1
        WHEN 'WARNING' THEN 2
        ELSE 3
    END,
    created_at DESC;

COMMENT ON VIEW v_active_performance_alerts IS
'Shows all unacknowledged performance alerts from last 24 hours';

-- Performance trends
CREATE OR REPLACE VIEW v_performance_trends AS
SELECT
    metric_name,
    time_window,
    baseline_value,
    CASE
        WHEN metric_name = 'query_execution_time' THEN
            (SELECT ROUND(AVG(mean_exec_time), 2) FROM pg_stat_statements WHERE calls > 5)
        WHEN metric_name = 'connection_count' THEN
            (SELECT COUNT(*)::NUMERIC FROM pg_stat_activity)
        WHEN metric_name = 'cache_hit_rate' THEN
            (SELECT ROUND(100.0 * SUM(heap_blks_hit) / NULLIF(SUM(heap_blks_hit) + SUM(heap_blks_read), 0), 2)
             FROM pg_statio_user_tables)
        ELSE NULL
    END AS current_value,
    last_updated,
    CASE
        WHEN metric_name = 'query_execution_time' AND
             (SELECT AVG(mean_exec_time) FROM pg_stat_statements WHERE calls > 5) > baseline_value * 1.5
        THEN '⚠️ Degraded'
        WHEN metric_name = 'connection_count' AND
             (SELECT COUNT(*) FROM pg_stat_activity) > baseline_value * 1.5
        THEN '⚠️ Spike'
        WHEN metric_name = 'cache_hit_rate' AND
             (SELECT 100.0 * SUM(heap_blks_hit) / NULLIF(SUM(heap_blks_hit) + SUM(heap_blks_read), 0)
              FROM pg_statio_user_tables) < baseline_value * 0.95
        THEN '⚠️ Degraded'
        ELSE '✅ Normal'
    END AS status
FROM performance_baselines
ORDER BY metric_name;

COMMENT ON VIEW v_performance_trends IS
'Compares current metrics to baseline values';

-- Alert summary
CREATE OR REPLACE VIEW v_alert_summary AS
SELECT
    alert_type,
    severity,
    COUNT(*) as alert_count,
    MIN(created_at) as first_occurrence,
    MAX(created_at) as last_occurrence
FROM performance_alerts
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY alert_type, severity
ORDER BY
    CASE severity
        WHEN 'CRITICAL' THEN 1
        WHEN 'WARNING' THEN 2
        ELSE 3
    END,
    alert_count DESC;

COMMENT ON VIEW v_alert_summary IS
'Summarizes alerts by type and severity for last 24 hours';

-- =====================================================
-- INITIALIZATION
-- =====================================================

-- Create initial baselines
SELECT update_performance_baselines();

-- Insert default alert rules
INSERT INTO alert_rules (
    rule_name,
    metric_query,
    condition_type,
    threshold_value,
    severity
) VALUES
(
    'high_query_time',
    'SELECT MAX(mean_exec_time) FROM pg_stat_statements',
    'threshold',
    1000,  -- 1 second
    'WARNING'
),
(
    'connection_saturation',
    'SELECT COUNT(*) FROM pg_stat_activity',
    'threshold',
    100,
    'CRITICAL'
),
(
    'low_cache_hit',
    'SELECT 100.0 * SUM(heap_blks_hit) / NULLIF(SUM(heap_blks_hit) + SUM(heap_blks_read), 0) FROM pg_statio_user_tables',
    'threshold',
    85,
    'WARNING'
)
ON CONFLICT (rule_name) DO NOTHING;

\echo ''
\echo '✓ Performance alerting functions created'
\echo ''
\echo 'Quick start:'
\echo '  SELECT update_performance_baselines();      -- Establish baselines'
\echo '  SELECT * FROM monitor_performance_degradation();  -- Check for issues'
\echo '  SELECT * FROM v_active_performance_alerts;  -- View active alerts'
\echo '  SELECT * FROM v_performance_trends;         -- Check trends'
\echo ''
\echo 'Set up automated monitoring with cron:'
\echo '  */5 * * * * psql -U postgres -d tartware -c "SELECT monitor_performance_degradation();"'
\echo ''
