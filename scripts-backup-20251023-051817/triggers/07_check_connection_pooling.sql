-- =====================================================
-- 07_check_connection_pooling.sql
-- Check Connection Pooling Status
-- Date: 2025-10-15
--
-- Purpose: Monitor connection usage and detect need
--          for connection pooling
-- =====================================================

\c tartware

-- =====================================================
-- Function: analyze_connection_usage
-- Purpose: Analyze current connection patterns
-- =====================================================

CREATE OR REPLACE FUNCTION analyze_connection_usage()
RETURNS TABLE(
    metric_name TEXT,
    current_value TEXT,
    max_value TEXT,
    percentage NUMERIC,
    status TEXT,
    recommendation TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_active_connections INTEGER;
    v_idle_connections INTEGER;
    v_max_connections INTEGER;
    v_idle_in_transaction INTEGER;
    v_total_connections INTEGER;
BEGIN
    -- Get connection counts
    SELECT COUNT(*) INTO v_total_connections
    FROM pg_stat_activity;

    SELECT COUNT(*) INTO v_active_connections
    FROM pg_stat_activity
    WHERE state = 'active';

    SELECT COUNT(*) INTO v_idle_connections
    FROM pg_stat_activity
    WHERE state = 'idle';

    SELECT COUNT(*) INTO v_idle_in_transaction
    FROM pg_stat_activity
    WHERE state LIKE 'idle in transaction%';

    SELECT setting::INTEGER INTO v_max_connections
    FROM pg_settings
    WHERE name = 'max_connections';

    RETURN QUERY
    -- Total connections
    SELECT
        'Total Connections'::TEXT,
        v_total_connections::TEXT,
        v_max_connections::TEXT,
        ROUND((v_total_connections::NUMERIC / v_max_connections::NUMERIC) * 100, 2),
        CASE
            WHEN v_total_connections::NUMERIC / v_max_connections::NUMERIC > 0.8 THEN '❌ CRITICAL'
            WHEN v_total_connections::NUMERIC / v_max_connections::NUMERIC > 0.6 THEN '⚠️ HIGH'
            WHEN v_total_connections::NUMERIC / v_max_connections::NUMERIC > 0.4 THEN '⚠️ MEDIUM'
            ELSE '✅ GOOD'
        END::TEXT,
        CASE
            WHEN v_total_connections::NUMERIC / v_max_connections::NUMERIC > 0.8
            THEN 'URGENT: Implement connection pooling immediately!'
            WHEN v_total_connections::NUMERIC / v_max_connections::NUMERIC > 0.6
            THEN 'Implement connection pooling to prevent connection exhaustion'
            WHEN v_total_connections::NUMERIC / v_max_connections::NUMERIC > 0.4
            THEN 'Consider connection pooling for better resource management'
            ELSE 'Connection usage is healthy'
        END::TEXT
    UNION ALL
    -- Active connections
    SELECT
        'Active (Running Queries)'::TEXT,
        v_active_connections::TEXT,
        v_max_connections::TEXT,
        ROUND((v_active_connections::NUMERIC / v_max_connections::NUMERIC) * 100, 2),
        CASE
            WHEN v_active_connections > 50 THEN '⚠️ HIGH'
            WHEN v_active_connections > 20 THEN '⚠️ MEDIUM'
            ELSE '✅ GOOD'
        END::TEXT,
        format('Currently %s queries executing', v_active_connections)::TEXT
    UNION ALL
    -- Idle connections
    SELECT
        'Idle (Wasting Resources)'::TEXT,
        v_idle_connections::TEXT,
        v_max_connections::TEXT,
        ROUND((v_idle_connections::NUMERIC / v_max_connections::NUMERIC) * 100, 2),
        CASE
            WHEN v_idle_connections > v_active_connections * 3 THEN '❌ CRITICAL'
            WHEN v_idle_connections > v_active_connections * 2 THEN '⚠️ HIGH'
            ELSE '✅ GOOD'
        END::TEXT,
        CASE
            WHEN v_idle_connections > v_active_connections * 3
            THEN 'Too many idle connections! Use PgBouncer transaction pooling'
            WHEN v_idle_connections > v_active_connections * 2
            THEN 'Many idle connections - connection pooling recommended'
            ELSE 'Idle connection ratio is acceptable'
        END::TEXT
    UNION ALL
    -- Idle in transaction (BAD!)
    SELECT
        'Idle in Transaction (BAD!)'::TEXT,
        v_idle_in_transaction::TEXT,
        '-'::TEXT,
        NULL::NUMERIC,
        CASE
            WHEN v_idle_in_transaction > 10 THEN '❌ CRITICAL'
            WHEN v_idle_in_transaction > 5 THEN '⚠️ HIGH'
            WHEN v_idle_in_transaction > 0 THEN '⚠️ WARNING'
            ELSE '✅ GOOD'
        END::TEXT,
        CASE
            WHEN v_idle_in_transaction > 10
            THEN 'CRITICAL: Idle in transaction blocks VACUUM! Fix application logic.'
            WHEN v_idle_in_transaction > 5
            THEN 'Idle in transaction detected - review transaction handling in app'
            WHEN v_idle_in_transaction > 0
            THEN 'Some idle in transaction - monitor and investigate'
            ELSE 'No idle in transaction connections'
        END::TEXT;
END;
$$;

COMMENT ON FUNCTION analyze_connection_usage() IS
'Analyze connection usage patterns and detect pooling needs';

-- =====================================================
-- Function: detect_connection_leaks
-- Purpose: Find long-running idle connections
-- =====================================================

CREATE OR REPLACE FUNCTION detect_connection_leaks()
RETURNS TABLE(
    pid INTEGER,
    usename TEXT,
    application_name TEXT,
    client_addr TEXT,
    state TEXT,
    state_duration INTERVAL,
    query_start TIMESTAMP,
    last_query TEXT,
    severity TEXT,
    recommendation TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        pg_stat_activity.pid,
        pg_stat_activity.usename::TEXT,
        pg_stat_activity.application_name::TEXT,
        pg_stat_activity.client_addr::TEXT,
        pg_stat_activity.state::TEXT,
        CURRENT_TIMESTAMP - state_change AS state_duration,
        query_start,
        LEFT(query, 100)::TEXT AS last_query,
        CASE
            WHEN state = 'idle in transaction'
                AND CURRENT_TIMESTAMP - state_change > INTERVAL '5 minutes'
            THEN 'CRITICAL'
            WHEN state = 'idle'
                AND CURRENT_TIMESTAMP - state_change > INTERVAL '30 minutes'
            THEN 'HIGH'
            WHEN state = 'idle'
                AND CURRENT_TIMESTAMP - state_change > INTERVAL '10 minutes'
            THEN 'MEDIUM'
            ELSE 'LOW'
        END::TEXT AS severity,
        CASE
            WHEN state = 'idle in transaction'
                AND CURRENT_TIMESTAMP - state_change > INTERVAL '5 minutes'
            THEN format('KILL: Long idle transaction (PID %s). Run: SELECT pg_terminate_backend(%s);',
                pg_stat_activity.pid, pg_stat_activity.pid)
            WHEN state = 'idle'
                AND CURRENT_TIMESTAMP - state_change > INTERVAL '30 minutes'
            THEN 'Connection leak detected - app not closing connections properly'
            WHEN state = 'idle'
                AND CURRENT_TIMESTAMP - state_change > INTERVAL '10 minutes'
            THEN 'Long idle connection - investigate app connection management'
            ELSE 'Recent connection'
        END::TEXT AS recommendation
    FROM pg_stat_activity
    WHERE state IN ('idle', 'idle in transaction', 'idle in transaction (aborted)')
        AND query_start IS NOT NULL
    ORDER BY
        CASE state
            WHEN 'idle in transaction' THEN 1
            WHEN 'idle in transaction (aborted)' THEN 2
            ELSE 3
        END,
        state_change ASC;
END;
$$;

COMMENT ON FUNCTION detect_connection_leaks() IS
'Find long-running idle connections indicating connection leaks';

-- =====================================================
-- Function: recommend_pooling_strategy
-- Purpose: Recommend connection pooling configuration
-- =====================================================

CREATE OR REPLACE FUNCTION recommend_pooling_strategy()
RETURNS TABLE(
    recommendation_type TEXT,
    current_situation TEXT,
    suggested_solution TEXT,
    implementation TEXT,
    priority TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_total_connections INTEGER;
    v_max_connections INTEGER;
    v_idle_connections INTEGER;
    v_active_connections INTEGER;
BEGIN
    -- Get metrics
    SELECT COUNT(*) INTO v_total_connections FROM pg_stat_activity;
    SELECT COUNT(*) INTO v_idle_connections FROM pg_stat_activity WHERE state = 'idle';
    SELECT COUNT(*) INTO v_active_connections FROM pg_stat_activity WHERE state = 'active';
    SELECT setting::INTEGER INTO v_max_connections FROM pg_settings WHERE name = 'max_connections';

    -- High connection count
    IF v_total_connections > 100 THEN
        RETURN QUERY SELECT
            'Connection Pooling Required'::TEXT,
            format('%s total connections (max: %s)', v_total_connections, v_max_connections)::TEXT,
            'Install PgBouncer for connection pooling'::TEXT,
            'PgBouncer in transaction mode: 1000+ app connections → 50-100 DB connections'::TEXT,
            'CRITICAL'::TEXT;
    END IF;

    -- Many idle connections
    IF v_idle_connections > v_active_connections * 2 THEN
        RETURN QUERY SELECT
            'Idle Connection Problem'::TEXT,
            format('%s idle vs %s active connections', v_idle_connections, v_active_connections)::TEXT,
            'Use connection pooling with aggressive timeout'::TEXT,
            'PgBouncer pool_mode=transaction with server_idle_timeout=60'::TEXT,
            'HIGH'::TEXT;
    END IF;

    -- Approaching connection limit
    IF v_total_connections::NUMERIC / v_max_connections::NUMERIC > 0.7 THEN
        RETURN QUERY SELECT
            'Connection Limit Warning'::TEXT,
            format('Using %s%% of available connections',
                ROUND((v_total_connections::NUMERIC / v_max_connections::NUMERIC) * 100))::TEXT,
            'Implement connection pooling before limit is reached'::TEXT,
            'Use PgBouncer or application-level pooling (HikariCP, pg-pool, etc.)'::TEXT,
            'HIGH'::TEXT;
    END IF;

    -- All good
    IF NOT FOUND THEN
        RETURN QUERY SELECT
            'Connection Management'::TEXT,
            format('%s connections (%s active, %s idle)',
                v_total_connections, v_active_connections, v_idle_connections)::TEXT,
            'Current connection usage is healthy'::TEXT,
            'Consider implementing pooling proactively for future scalability'::TEXT,
            'LOW'::TEXT;
    END IF;
END;
$$;

COMMENT ON FUNCTION recommend_pooling_strategy() IS
'Provide specific recommendations for connection pooling';

-- =====================================================
-- View: Connection Overview Dashboard
-- =====================================================

CREATE OR REPLACE VIEW v_connection_dashboard AS
SELECT
    state,
    COUNT(*) AS connection_count,
    COUNT(*) FILTER (WHERE wait_event IS NOT NULL) AS waiting_count,
    ROUND(AVG(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - state_change)))) AS avg_state_duration_sec,
    MAX(CURRENT_TIMESTAMP - state_change) AS max_state_duration,
    array_agg(DISTINCT application_name) FILTER (WHERE application_name IS NOT NULL) AS applications
FROM pg_stat_activity
WHERE pid != pg_backend_pid()  -- Exclude this query itself
GROUP BY state
ORDER BY connection_count DESC;

COMMENT ON VIEW v_connection_dashboard IS
'Overview of connection states and durations';

-- =====================================================
-- View: Application Connection Stats
-- =====================================================

CREATE OR REPLACE VIEW v_application_connections AS
SELECT
    COALESCE(application_name, 'unknown') AS application_name,
    usename,
    COUNT(*) AS total_connections,
    COUNT(*) FILTER (WHERE state = 'active') AS active,
    COUNT(*) FILTER (WHERE state = 'idle') AS idle,
    COUNT(*) FILTER (WHERE state LIKE 'idle in transaction%') AS idle_in_transaction,
    MAX(CURRENT_TIMESTAMP - state_change) AS longest_idle_duration
FROM pg_stat_activity
WHERE pid != pg_backend_pid()
GROUP BY application_name, usename
ORDER BY total_connections DESC;

COMMENT ON VIEW v_application_connections IS
'Connection usage by application and user';

-- =====================================================
-- Example Usage
-- =====================================================

\echo ''
\echo '======================================================'
\echo '  CONNECTION POOLING CHECK - EXAMPLES'
\echo '======================================================'
\echo ''
\echo 'Example 1: Analyze connection usage'
\echo '----------------------------------------------------'
\echo 'SELECT * FROM analyze_connection_usage();'
\echo ''
\echo 'Example 2: Detect connection leaks'
\echo '----------------------------------------------------'
\echo 'SELECT * FROM detect_connection_leaks() WHERE severity IN (''CRITICAL'', ''HIGH'');'
\echo ''
\echo 'Example 3: Get pooling recommendations'
\echo '----------------------------------------------------'
\echo 'SELECT * FROM recommend_pooling_strategy();'
\echo ''
\echo 'Example 4: View connection dashboard'
\echo '----------------------------------------------------'
\echo 'SELECT * FROM v_connection_dashboard;'
\echo ''
\echo 'Example 5: Check per-application connections'
\echo '----------------------------------------------------'
\echo 'SELECT * FROM v_application_connections;'
\echo ''

\echo ''
\echo '======================================================'
\echo '  CONNECTION POOLING SOLUTIONS'
\echo '======================================================'
\echo ''
\echo '🔧 PgBouncer (Recommended):'
\echo '  • External connection pooler'
\echo '  • Pool modes: session, transaction, statement'
\echo '  • Can multiplex 1000+ app connections → 50-100 DB'
\echo '  • Lightweight, battle-tested'
\echo ''
\echo '  Installation:'
\echo '    apt install pgbouncer'
\echo '    # Configure /etc/pgbouncer/pgbouncer.ini'
\echo '    pool_mode = transaction'
\echo '    max_client_conn = 1000'
\echo '    default_pool_size = 25'
\echo ''
\echo '🔧 Application-Level Pooling:'
\echo '  • Node.js: pg-pool, node-postgres'
\echo '  • Python: psycopg2 pool, SQLAlchemy pool'
\echo '  • Java: HikariCP, c3p0, Apache DBCP'
\echo '  • Go: pgx pool'
\echo ''
\echo '⚠️  Without Connection Pooling:'
\echo '  • Each connection uses ~10MB RAM'
\echo '  • Connection setup is slow (auth, process fork)'
\echo '  • Limited by max_connections (default 100)'
\echo '  • Idle connections waste resources'
\echo ''
\echo '✅ With Connection Pooling:'
\echo '  • Reuse connections (fast)'
\echo '  • Support 1000s of clients with 50-100 DB conns'
\echo '  • Automatic timeout and cleanup'
\echo '  • Better resource utilization'
\echo ''

\echo ''
\echo '✅ Connection pooling checker installed successfully!'
\echo ''
