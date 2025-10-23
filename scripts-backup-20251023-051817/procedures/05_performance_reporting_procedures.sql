-- =====================================================
-- 15_performance_reporting_procedures.sql
-- Automated Performance Reporting Functions
-- Date: 2025-10-15
-- Purpose: Generate and manage performance reports
-- =====================================================

\c tartware

\echo ''
\echo '======================================================'
\echo '  Creating Performance Reporting Functions'
\echo '======================================================'
\echo ''

-- =====================================================
-- REPORT GENERATION FUNCTIONS
-- =====================================================

-- Generate daily performance report
CREATE OR REPLACE FUNCTION generate_daily_performance_report()
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_report_id UUID;
    v_report_data JSONB;
BEGIN
    -- Collect all performance metrics
    v_report_data := jsonb_build_object(
        'report_date', CURRENT_DATE,
        'database_info', (
            SELECT jsonb_build_object(
                'database_name', current_database(),
                'database_size', pg_size_pretty(pg_database_size(current_database())),
                'postgresql_version', version(),
                'uptime', NOW() - pg_postmaster_start_time()
            )
        ),
        'table_statistics', (
            SELECT jsonb_agg(row_to_json(t))
            FROM (
                SELECT
                    schemaname,
                    tablename,
                    n_live_tup as live_rows,
                    n_dead_tup as dead_rows,
                    ROUND(n_dead_tup::NUMERIC / NULLIF(n_live_tup, 0) * 100, 2) as bloat_percent,
                    last_vacuum,
                    last_autovacuum,
                    seq_scan,
                    idx_scan,
                    CASE
                        WHEN idx_scan + seq_scan > 0
                        THEN ROUND(100.0 * idx_scan / (idx_scan + seq_scan), 2)
                        ELSE 0
                    END as index_hit_rate
                FROM pg_stat_user_tables
                ORDER BY n_live_tup DESC
                LIMIT 20
            ) t
        ),
        'slow_queries', (
            SELECT jsonb_agg(row_to_json(q))
            FROM (
                SELECT
                    calls,
                    ROUND(mean_exec_time::NUMERIC, 2) as avg_time_ms,
                    ROUND(max_exec_time::NUMERIC, 2) as max_time_ms,
                    ROUND(total_exec_time::NUMERIC, 2) as total_time_ms,
                    LEFT(query, 100) as query_preview
                FROM pg_stat_statements
                WHERE query NOT LIKE '%pg_%'
                ORDER BY mean_exec_time DESC
                LIMIT 10
            ) q
        ),
        'index_usage', (
            SELECT jsonb_agg(row_to_json(i))
            FROM (
                SELECT
                    schemaname,
                    tablename,
                    indexname,
                    idx_scan,
                    idx_tup_read,
                    idx_tup_fetch,
                    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
                FROM pg_stat_user_indexes
                WHERE idx_scan = 0
                AND schemaname NOT IN ('pg_catalog', 'information_schema')
                ORDER BY pg_relation_size(indexrelid) DESC
                LIMIT 10
            ) i
        ),
        'connection_stats', (
            SELECT jsonb_build_object(
                'total_connections', COUNT(*),
                'active_connections', COUNT(*) FILTER (WHERE state = 'active'),
                'idle_connections', COUNT(*) FILTER (WHERE state = 'idle'),
                'idle_in_transaction', COUNT(*) FILTER (WHERE state = 'idle in transaction'),
                'waiting_connections', COUNT(*) FILTER (WHERE wait_event_type IS NOT NULL),
                'max_connections', current_setting('max_connections')::INT,
                'connection_usage_percent', ROUND(100.0 * COUNT(*) / current_setting('max_connections')::INT, 2)
            )
            FROM pg_stat_activity
        ),
        'cache_hit_rates', (
            SELECT jsonb_build_object(
                'database_cache_hit_rate', ROUND(
                    100.0 * SUM(heap_blks_hit) / NULLIF(SUM(heap_blks_hit) + SUM(heap_blks_read), 0), 2
                ),
                'index_cache_hit_rate', ROUND(
                    100.0 * SUM(idx_blks_hit) / NULLIF(SUM(idx_blks_hit) + SUM(idx_blks_read), 0), 2
                )
            )
            FROM pg_statio_user_tables
        ),
        'recommendations', (
            SELECT jsonb_agg(row_to_json(r))
            FROM (
                SELECT
                    priority,
                    table_name,
                    index_definition,
                    reason,
                    estimated_benefit
                FROM recommend_indexes_auto()
                LIMIT 5
            ) r
        )
    );

    -- Insert report
    INSERT INTO performance_reports (
        report_type,
        report_name,
        report_data,
        severity
    ) VALUES (
        'DAILY_PERFORMANCE',
        FORMAT('Daily Performance Report - %s', CURRENT_DATE),
        v_report_data,
        CASE
            WHEN (v_report_data->'connection_stats'->>'connection_usage_percent')::NUMERIC > 80 THEN 'CRITICAL'
            WHEN EXISTS (
                SELECT 1 FROM pg_stat_user_tables
                WHERE n_dead_tup > n_live_tup * 0.5
            ) THEN 'WARNING'
            ELSE 'INFO'
        END
    ) RETURNING report_id INTO v_report_id;

    RETURN v_report_id;
END $$;

COMMENT ON FUNCTION generate_daily_performance_report() IS
'Generates comprehensive daily performance report.
Usage: SELECT generate_daily_performance_report();';

-- Generate hourly health check
CREATE OR REPLACE FUNCTION generate_health_check_report()
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_report_id UUID;
    v_issues JSONB := '[]'::JSONB;
    v_severity TEXT := 'INFO';
BEGIN
    -- Check connection pool saturation
    IF (SELECT COUNT(*)::NUMERIC / current_setting('max_connections')::INT
        FROM pg_stat_activity) > 0.8 THEN
        v_issues := v_issues || jsonb_build_object(
            'issue', 'Connection pool near saturation',
            'current', (SELECT COUNT(*) FROM pg_stat_activity),
            'max', current_setting('max_connections'),
            'severity', 'WARNING'
        );
        v_severity := 'WARNING';
    END IF;

    -- Check for long-running queries
    IF EXISTS (
        SELECT 1 FROM pg_stat_activity
        WHERE state = 'active'
        AND query_start < NOW() - INTERVAL '5 minutes'
        AND query NOT LIKE '%pg_%'
    ) THEN
        v_issues := v_issues || jsonb_build_object(
            'issue', 'Long-running queries detected',
            'count', (
                SELECT COUNT(*) FROM pg_stat_activity
                WHERE state = 'active'
                AND query_start < NOW() - INTERVAL '5 minutes'
            ),
            'severity', 'WARNING'
        );
        v_severity := 'WARNING';
    END IF;

    -- Check table bloat
    IF EXISTS (
        SELECT 1 FROM pg_stat_user_tables
        WHERE n_dead_tup > 10000
        AND n_dead_tup > n_live_tup * 0.2
    ) THEN
        v_issues := v_issues || jsonb_build_object(
            'issue', 'High table bloat detected',
            'tables', (
                SELECT jsonb_agg(tablename)
                FROM pg_stat_user_tables
                WHERE n_dead_tup > n_live_tup * 0.2
            ),
            'severity', 'WARNING'
        );
        v_severity := 'WARNING';
    END IF;

    -- Check cache hit rate
    IF (SELECT
        100.0 * SUM(heap_blks_hit) / NULLIF(SUM(heap_blks_hit) + SUM(heap_blks_read), 0)
        FROM pg_statio_user_tables) < 90 THEN
        v_issues := v_issues || jsonb_build_object(
            'issue', 'Low cache hit rate',
            'current_rate', (
                SELECT ROUND(
                    100.0 * SUM(heap_blks_hit) / NULLIF(SUM(heap_blks_hit) + SUM(heap_blks_read), 0), 2
                )
                FROM pg_statio_user_tables
            ),
            'severity', 'WARNING'
        );
        v_severity := 'WARNING';
    END IF;

    -- Create health report
    INSERT INTO performance_reports (
        report_type,
        report_name,
        report_data,
        severity
    ) VALUES (
        'HEALTH_CHECK',
        FORMAT('Health Check - %s', NOW()::TIMESTAMP(0)),
        jsonb_build_object(
            'timestamp', NOW(),
            'status', CASE WHEN v_severity = 'INFO' THEN 'HEALTHY' ELSE 'ISSUES_DETECTED' END,
            'issues', v_issues,
            'metrics', jsonb_build_object(
                'active_connections', (SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active'),
                'database_size', pg_size_pretty(pg_database_size(current_database())),
                'cache_hit_rate', (
                    SELECT ROUND(
                        100.0 * SUM(heap_blks_hit) / NULLIF(SUM(heap_blks_hit) + SUM(heap_blks_read), 0), 2
                    )
                    FROM pg_statio_user_tables
                ),
                'longest_query_seconds', (
                    SELECT EXTRACT(EPOCH FROM MAX(NOW() - query_start))
                    FROM pg_stat_activity
                    WHERE state = 'active'
                )
            )
        ),
        v_severity
    ) RETURNING report_id INTO v_report_id;

    RETURN v_report_id;
END $$;

COMMENT ON FUNCTION generate_health_check_report() IS
'Generates quick health check report.
Usage: SELECT generate_health_check_report();';

-- =====================================================
-- THRESHOLD CHECKING FUNCTIONS
-- =====================================================

-- Check performance thresholds and generate alerts
CREATE OR REPLACE FUNCTION check_performance_thresholds()
RETURNS TABLE(
    metric_name TEXT,
    current_value NUMERIC,
    threshold_type TEXT,
    threshold_value NUMERIC,
    alert_message TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- Connection saturation
    RETURN QUERY
    WITH conn_stats AS (
        SELECT
            COUNT(*)::NUMERIC as current_conn,
            current_setting('max_connections')::INT as max_conn
        FROM pg_stat_activity
    )
    SELECT
        'connection_saturation'::TEXT,
        ROUND(100.0 * current_conn / max_conn, 2),
        CASE
            WHEN 100.0 * current_conn / max_conn > 90 THEN 'CRITICAL'
            WHEN 100.0 * current_conn / max_conn > 75 THEN 'WARNING'
            ELSE 'OK'
        END::TEXT,
        CASE
            WHEN 100.0 * current_conn / max_conn > 90 THEN 90::NUMERIC
            WHEN 100.0 * current_conn / max_conn > 75 THEN 75::NUMERIC
            ELSE NULL
        END,
        FORMAT('Connection usage at %s%% (%s of %s connections)',
            ROUND(100.0 * current_conn / max_conn, 2),
            current_conn::INT,
            max_conn
        )::TEXT
    FROM conn_stats
    WHERE 100.0 * current_conn / max_conn > 75;

    -- Long running queries
    RETURN QUERY
    SELECT
        'long_running_queries'::TEXT,
        EXTRACT(EPOCH FROM MAX(NOW() - query_start))::NUMERIC,
        'WARNING'::TEXT,
        300::NUMERIC,  -- 5 minutes
        FORMAT('Query running for %s',
            AGE(NOW(), MIN(query_start))
        )::TEXT
    FROM pg_stat_activity
    WHERE state = 'active'
    AND query_start < NOW() - INTERVAL '5 minutes'
    AND query NOT LIKE '%pg_%'
    GROUP BY state
    HAVING MAX(NOW() - query_start) > INTERVAL '5 minutes';

    -- Table bloat
    RETURN QUERY
    WITH bloat_stats AS (
        SELECT
            MAX(n_dead_tup::NUMERIC / NULLIF(n_live_tup, 0)) as max_bloat,
            (SELECT tablename FROM pg_stat_user_tables
             WHERE n_dead_tup::NUMERIC / NULLIF(n_live_tup, 0) =
                   (SELECT MAX(n_dead_tup::NUMERIC / NULLIF(n_live_tup, 0)) FROM pg_stat_user_tables WHERE n_dead_tup > 1000)
             LIMIT 1) as worst_table
        FROM pg_stat_user_tables
        WHERE n_dead_tup > 1000
    )
    SELECT
        'table_bloat'::TEXT,
        ROUND(max_bloat * 100, 2),
        CASE
            WHEN max_bloat > 0.5 THEN 'CRITICAL'
            WHEN max_bloat > 0.2 THEN 'WARNING'
            ELSE 'OK'
        END::TEXT,
        CASE
            WHEN max_bloat > 0.5 THEN 50::NUMERIC
            WHEN max_bloat > 0.2 THEN 20::NUMERIC
            ELSE NULL
        END,
        FORMAT('Table %s has %s%% dead tuples', worst_table, ROUND(max_bloat * 100, 2))::TEXT
    FROM bloat_stats
    WHERE max_bloat > 0.2;

    -- Cache hit rate
    RETURN QUERY
    WITH cache_stats AS (
        SELECT
            ROUND(
                100.0 * SUM(heap_blks_hit) / NULLIF(SUM(heap_blks_hit) + SUM(heap_blks_read), 0), 2
            ) as hit_rate
        FROM pg_statio_user_tables
    )
    SELECT
        'cache_hit_rate'::TEXT,
        hit_rate,
        CASE
            WHEN hit_rate < 85 THEN 'CRITICAL'
            WHEN hit_rate < 90 THEN 'WARNING'
            ELSE 'OK'
        END::TEXT,
        CASE
            WHEN hit_rate < 85 THEN 85::NUMERIC
            WHEN hit_rate < 90 THEN 90::NUMERIC
            ELSE NULL
        END,
        FORMAT('Cache hit rate is %s%% (should be > 90%%)', hit_rate)::TEXT
    FROM cache_stats
    WHERE hit_rate < 90;
END $$;

COMMENT ON FUNCTION check_performance_thresholds() IS
'Checks all performance metrics against thresholds.
Usage: SELECT * FROM check_performance_thresholds();';

-- =====================================================
-- REPORT RETRIEVAL FUNCTIONS
-- =====================================================

-- Get latest report of a type
CREATE OR REPLACE FUNCTION get_latest_report(p_report_type VARCHAR)
RETURNS TABLE(
    report_id UUID,
    report_name TEXT,
    generated_at TIMESTAMP,
    severity TEXT,
    summary JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.report_id,
        r.report_name::TEXT,
        r.generated_at,
        r.severity::TEXT,
        CASE r.report_type
            WHEN 'DAILY_PERFORMANCE' THEN
                jsonb_build_object(
                    'database_size', r.report_data->'database_info'->>'database_size',
                    'slow_queries_count', jsonb_array_length(COALESCE(r.report_data->'slow_queries', '[]')),
                    'unused_indexes', jsonb_array_length(COALESCE(r.report_data->'index_usage', '[]')),
                    'recommendations', jsonb_array_length(COALESCE(r.report_data->'recommendations', '[]')),
                    'cache_hit_rate', r.report_data->'cache_hit_rates'->>'database_cache_hit_rate'
                )
            WHEN 'HEALTH_CHECK' THEN
                jsonb_build_object(
                    'status', r.report_data->>'status',
                    'issues_count', jsonb_array_length(COALESCE(r.report_data->'issues', '[]')),
                    'active_connections', r.report_data->'metrics'->>'active_connections'
                )
            ELSE r.report_data
        END
    FROM performance_reports r
    WHERE r.report_type = p_report_type
    ORDER BY r.generated_at DESC
    LIMIT 1;
END $$;

COMMENT ON FUNCTION get_latest_report(VARCHAR) IS
'Retrieves the latest report of specified type.
Usage: SELECT * FROM get_latest_report(''DAILY_PERFORMANCE'');';

-- =====================================================
-- SCHEDULING FUNCTIONS
-- =====================================================

-- Initialize default report schedules
CREATE OR REPLACE FUNCTION init_report_schedules()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- Daily performance report at 2 AM
    INSERT INTO report_schedules (
        report_type,
        schedule_expression,
        recipients
    ) VALUES
    (
        'DAILY_PERFORMANCE',
        '0 2 * * *',  -- Daily at 2 AM
        ARRAY['admin@tartware.com', 'dba@tartware.com']
    ),
    (
        'HEALTH_CHECK',
        '0 * * * *',  -- Every hour
        ARRAY['ops@tartware.com']
    ),
    (
        'WEEKLY_SUMMARY',
        '0 9 * * 1',  -- Monday at 9 AM
        ARRAY['management@tartware.com']
    ),
    (
        'THRESHOLD_ALERTS',
        '*/5 * * * *',  -- Every 5 minutes
        ARRAY['alerts@tartware.com']
    )
    ON CONFLICT (report_type) DO NOTHING;

    RAISE NOTICE 'Report schedules initialized';
END $$;

COMMENT ON FUNCTION init_report_schedules() IS
'Initializes default report schedules.
Usage: SELECT init_report_schedules();';

-- =====================================================
-- MONITORING VIEWS
-- =====================================================

\echo 'Creating monitoring views...'

-- Current alerts view
CREATE OR REPLACE VIEW v_current_alerts AS
SELECT
    metric_name,
    current_value,
    threshold_type as severity,
    threshold_value,
    alert_message
FROM check_performance_thresholds()
ORDER BY
    CASE threshold_type
        WHEN 'CRITICAL' THEN 1
        WHEN 'WARNING' THEN 2
        ELSE 3
    END;

COMMENT ON VIEW v_current_alerts IS
'Shows current performance alerts above thresholds';

-- Recent reports view
CREATE OR REPLACE VIEW v_recent_reports AS
SELECT
    report_id,
    report_type,
    report_name,
    severity,
    generated_at,
    CASE
        WHEN report_type = 'DAILY_PERFORMANCE' THEN
            report_data->'cache_hit_rates'->>'database_cache_hit_rate' || '% cache hit'
        WHEN report_type = 'HEALTH_CHECK' THEN
            report_data->>'status'
        ELSE 'View details'
    END as summary
FROM performance_reports
WHERE generated_at > NOW() - INTERVAL '7 days'
ORDER BY generated_at DESC;

COMMENT ON VIEW v_recent_reports IS
'Shows recent performance reports from last 7 days';

-- =====================================================
-- INITIALIZATION
-- =====================================================

-- Initialize schedules
SELECT init_report_schedules();

\echo ''
\echo '✓ Performance reporting functions created'
\echo ''
\echo 'Quick start:'
\echo '  SELECT generate_daily_performance_report();'
\echo '  SELECT generate_health_check_report();'
\echo '  SELECT * FROM v_current_alerts;'
\echo '  SELECT * FROM v_recent_reports;'
\echo ''
