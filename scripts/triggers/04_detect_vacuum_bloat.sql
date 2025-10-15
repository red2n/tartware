-- =====================================================
-- 04_detect_vacuum_bloat.sql
-- Detect and Fix VACUUM Neglect Issues
-- Date: 2025-10-15
--
-- Purpose: Monitor table/index bloat, dead tuples,
--          and autovacuum effectiveness
-- =====================================================

\c tartware

-- =====================================================
-- Function: check_table_bloat
-- Purpose: Detect bloated tables needing VACUUM
-- =====================================================

CREATE OR REPLACE FUNCTION check_table_bloat()
RETURNS TABLE(
    schema_name TEXT,
    table_name TEXT,
    real_size TEXT,
    extra_size TEXT,
    bloat_percentage NUMERIC,
    dead_tuples BIGINT,
    live_tuples BIGINT,
    last_vacuum TIMESTAMP,
    last_autovacuum TIMESTAMP,
    severity TEXT,
    recommendation TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        schemaname::TEXT,
        tablename::TEXT,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))::TEXT AS real_size,
        pg_size_pretty(
            pg_total_relation_size(schemaname||'.'||tablename) -
            pg_relation_size(schemaname||'.'||tablename)
        )::TEXT AS extra_size,
        CASE
            WHEN pg_stat_get_live_tuples(c.oid) > 0
            THEN ROUND(
                (pg_stat_get_dead_tuples(c.oid)::NUMERIC /
                 pg_stat_get_live_tuples(c.oid)::NUMERIC) * 100,
                2
            )
            ELSE 0
        END AS bloat_percentage,
        pg_stat_get_dead_tuples(c.oid) AS dead_tuples,
        pg_stat_get_live_tuples(c.oid) AS live_tuples,
        pg_stat_user_tables.last_vacuum,
        pg_stat_user_tables.last_autovacuum,
        CASE
            WHEN pg_stat_get_dead_tuples(c.oid) > 100000 THEN 'CRITICAL'
            WHEN pg_stat_get_dead_tuples(c.oid) > 50000 THEN 'HIGH'
            WHEN pg_stat_get_dead_tuples(c.oid) > 10000 THEN 'MEDIUM'
            ELSE 'LOW'
        END::TEXT AS severity,
        CASE
            WHEN pg_stat_get_dead_tuples(c.oid) > 100000
            THEN 'URGENT: Run VACUUM ANALYZE immediately!'
            WHEN pg_stat_get_dead_tuples(c.oid) > 50000
            THEN 'Run VACUUM ANALYZE soon'
            WHEN pg_stat_get_dead_tuples(c.oid) > 10000
            THEN 'Schedule VACUUM during maintenance window'
            ELSE 'No action needed'
        END::TEXT AS recommendation
    FROM pg_stat_user_tables
    JOIN pg_class c ON pg_stat_user_tables.relid = c.oid
    WHERE schemaname IN ('public', 'availability')
    ORDER BY pg_stat_get_dead_tuples(c.oid) DESC;
END;
$$;

COMMENT ON FUNCTION check_table_bloat() IS
'Detect tables with bloat and dead tuples requiring VACUUM';

-- =====================================================
-- Function: check_index_bloat
-- Purpose: Detect bloated indexes
-- =====================================================

CREATE OR REPLACE FUNCTION check_index_bloat()
RETURNS TABLE(
    schema_name TEXT,
    table_name TEXT,
    index_name TEXT,
    index_size TEXT,
    estimated_bloat_percentage NUMERIC,
    severity TEXT,
    recommendation TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        schemaname::TEXT,
        tablename::TEXT,
        indexname::TEXT,
        pg_size_pretty(pg_relation_size(schemaname||'.'||indexname))::TEXT AS index_size,
        CASE
            WHEN pg_relation_size(schemaname||'.'||indexname) > 104857600 -- 100MB
            THEN 20.0  -- Estimate 20% bloat for large indexes
            WHEN pg_relation_size(schemaname||'.'||indexname) > 10485760  -- 10MB
            THEN 15.0
            ELSE 10.0
        END AS estimated_bloat_percentage,
        CASE
            WHEN pg_relation_size(schemaname||'.'||indexname) > 1073741824 -- 1GB
            THEN 'HIGH'
            WHEN pg_relation_size(schemaname||'.'||indexname) > 104857600 -- 100MB
            THEN 'MEDIUM'
            ELSE 'LOW'
        END::TEXT AS severity,
        CASE
            WHEN pg_relation_size(schemaname||'.'||indexname) > 1073741824
            THEN 'Consider REINDEX CONCURRENTLY during maintenance'
            WHEN pg_relation_size(schemaname||'.'||indexname) > 104857600
            THEN 'Monitor and REINDEX if queries slow down'
            ELSE 'No action needed'
        END::TEXT AS recommendation
    FROM pg_indexes
    WHERE schemaname IN ('public', 'availability')
    ORDER BY pg_relation_size(schemaname||'.'||indexname) DESC
    LIMIT 20;
END;
$$;

COMMENT ON FUNCTION check_index_bloat() IS
'Detect bloated indexes requiring REINDEX';

-- =====================================================
-- Function: check_autovacuum_settings
-- Purpose: Verify autovacuum is properly configured
-- =====================================================

CREATE OR REPLACE FUNCTION check_autovacuum_settings()
RETURNS TABLE(
    setting_name TEXT,
    current_value TEXT,
    recommended_value TEXT,
    status TEXT,
    impact TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        'autovacuum'::TEXT,
        current_setting('autovacuum')::TEXT,
        'on'::TEXT,
        CASE WHEN current_setting('autovacuum') = 'on' THEN '✅ OK' ELSE '❌ CRITICAL' END::TEXT,
        'Autovacuum must be enabled'::TEXT
    UNION ALL
    SELECT
        'autovacuum_max_workers'::TEXT,
        current_setting('autovacuum_max_workers')::TEXT,
        '4-8'::TEXT,
        CASE
            WHEN current_setting('autovacuum_max_workers')::INTEGER >= 3 THEN '✅ OK'
            ELSE '⚠️ LOW'
        END::TEXT,
        'More workers = faster cleanup'::TEXT
    UNION ALL
    SELECT
        'autovacuum_naptime'::TEXT,
        current_setting('autovacuum_naptime')::TEXT,
        '30s-60s'::TEXT,
        CASE
            WHEN EXTRACT(EPOCH FROM current_setting('autovacuum_naptime')::INTERVAL) <= 60
            THEN '✅ OK'
            ELSE '⚠️ TOO SLOW'
        END::TEXT,
        'How often to check for work'::TEXT
    UNION ALL
    SELECT
        'autovacuum_vacuum_threshold'::TEXT,
        current_setting('autovacuum_vacuum_threshold')::TEXT,
        '50'::TEXT,
        '✅ OK'::TEXT,
        'Minimum dead tuples before vacuum'::TEXT
    UNION ALL
    SELECT
        'autovacuum_vacuum_scale_factor'::TEXT,
        current_setting('autovacuum_vacuum_scale_factor')::TEXT,
        '0.1-0.2'::TEXT,
        CASE
            WHEN current_setting('autovacuum_vacuum_scale_factor')::NUMERIC <= 0.2
            THEN '✅ OK'
            ELSE '⚠️ TOO HIGH'
        END::TEXT,
        'Fraction of table size to trigger vacuum'::TEXT;
END;
$$;

COMMENT ON FUNCTION check_autovacuum_settings() IS
'Check autovacuum configuration and recommendations';

-- =====================================================
-- View: Tables Needing Immediate Vacuum
-- =====================================================

CREATE OR REPLACE VIEW v_vacuum_candidates AS
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS table_size,
    n_dead_tup AS dead_tuples,
    n_live_tup AS live_tuples,
    ROUND((n_dead_tup::NUMERIC / NULLIF(n_live_tup, 0)::NUMERIC) * 100, 2) AS dead_tuple_percent,
    last_vacuum,
    last_autovacuum,
    CASE
        WHEN n_dead_tup > 100000 THEN 'URGENT'
        WHEN n_dead_tup > 50000 THEN 'HIGH'
        WHEN n_dead_tup > 10000 THEN 'MEDIUM'
        ELSE 'LOW'
    END AS priority,
    format('VACUUM ANALYZE %I.%I;', schemaname, tablename) AS vacuum_command
FROM pg_stat_user_tables
WHERE schemaname IN ('public', 'availability')
    AND n_dead_tup > 1000
ORDER BY n_dead_tup DESC;

COMMENT ON VIEW v_vacuum_candidates IS
'Tables that need VACUUM, sorted by urgency';

-- =====================================================
-- View: Autovacuum Activity Monitor
-- =====================================================

CREATE OR REPLACE VIEW v_autovacuum_activity AS
SELECT
    schemaname,
    tablename,
    last_vacuum,
    last_autovacuum,
    vacuum_count,
    autovacuum_count,
    CASE
        WHEN last_autovacuum IS NULL THEN 'Never auto-vacuumed'
        WHEN last_autovacuum < CURRENT_TIMESTAMP - INTERVAL '7 days' THEN 'Stale (>7 days)'
        WHEN last_autovacuum < CURRENT_TIMESTAMP - INTERVAL '1 day' THEN 'Old (>1 day)'
        ELSE 'Recent'
    END AS autovacuum_status,
    COALESCE(last_autovacuum, last_vacuum, '-infinity'::TIMESTAMP) AS last_maintenance
FROM pg_stat_user_tables
WHERE schemaname IN ('public', 'availability')
ORDER BY COALESCE(last_autovacuum, last_vacuum, '-infinity'::TIMESTAMP) ASC;

COMMENT ON VIEW v_autovacuum_activity IS
'Monitor autovacuum activity and identify neglected tables';

-- =====================================================
-- Function: generate_vacuum_commands
-- Purpose: Generate VACUUM commands for bloated tables
-- =====================================================

CREATE OR REPLACE FUNCTION generate_vacuum_commands(
    p_min_dead_tuples INTEGER DEFAULT 10000
)
RETURNS TABLE(
    priority TEXT,
    command TEXT,
    table_info TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        CASE
            WHEN n_dead_tup > 100000 THEN '1-URGENT'
            WHEN n_dead_tup > 50000 THEN '2-HIGH'
            WHEN n_dead_tup > 10000 THEN '3-MEDIUM'
            ELSE '4-LOW'
        END::TEXT AS priority,
        format('VACUUM (ANALYZE, VERBOSE) %I.%I;', schemaname, tablename)::TEXT AS command,
        format('%s dead tuples, %s total size',
            n_dead_tup,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
        )::TEXT AS table_info
    FROM pg_stat_user_tables
    WHERE schemaname IN ('public', 'availability')
        AND n_dead_tup >= p_min_dead_tuples
    ORDER BY n_dead_tup DESC;
END;
$$;

COMMENT ON FUNCTION generate_vacuum_commands(INTEGER) IS
'Generate VACUUM commands for tables with excessive dead tuples';

-- =====================================================
-- Example Usage
-- =====================================================

\echo ''
\echo '======================================================'
\echo '  VACUUM NEGLECT DETECTION - EXAMPLES'
\echo '======================================================'
\echo ''
\echo 'Example 1: Check table bloat'
\echo '----------------------------------------------------'
\echo 'SELECT * FROM check_table_bloat() WHERE severity IN (''CRITICAL'', ''HIGH'');'
\echo ''
\echo 'Example 2: Check index bloat'
\echo '----------------------------------------------------'
\echo 'SELECT * FROM check_index_bloat() WHERE severity = ''HIGH'';'
\echo ''
\echo 'Example 3: Verify autovacuum settings'
\echo '----------------------------------------------------'
\echo 'SELECT * FROM check_autovacuum_settings();'
\echo ''
\echo 'Example 4: Find tables needing vacuum'
\echo '----------------------------------------------------'
\echo 'SELECT * FROM v_vacuum_candidates WHERE priority IN (''URGENT'', ''HIGH'');'
\echo ''
\echo 'Example 5: Generate vacuum commands'
\echo '----------------------------------------------------'
\echo 'SELECT command FROM generate_vacuum_commands(10000);'
\echo ''
\echo 'Example 6: Monitor autovacuum activity'
\echo '----------------------------------------------------'
\echo 'SELECT * FROM v_autovacuum_activity WHERE autovacuum_status != ''Recent'';'
\echo ''

\echo ''
\echo '======================================================'
\echo '  RECOMMENDED MAINTENANCE SCHEDULE'
\echo '======================================================'
\echo ''
\echo '📅 Daily:'
\echo '  • Check v_vacuum_candidates for URGENT items'
\echo '  • Monitor autovacuum activity'
\echo ''
\echo '📅 Weekly:'
\echo '  • Run check_table_bloat()'
\echo '  • Review autovacuum settings'
\echo '  • Manual VACUUM ANALYZE on high-traffic tables'
\echo ''
\echo '📅 Monthly:'
\echo '  • Run check_index_bloat()'
\echo '  • REINDEX large indexes if needed'
\echo '  • Review and adjust autovacuum parameters'
\echo ''

\echo ''
\echo '✅ VACUUM monitoring installed successfully!'
\echo ''
