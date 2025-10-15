-- =====================================================
-- 11_install_performance_extensions.sql
-- Install pg_qualstats and HypoPG extensions
-- Date: 2025-10-15
-- Purpose: Enable advanced index recommendation capabilities
-- =====================================================

\c tartware

\echo ''
\echo '======================================================'
\echo '  Installing Performance Extensions'
\echo '======================================================'
\echo ''

-- =====================================================
-- INSTALL EXTENSIONS
-- =====================================================

-- Note: These extensions must be installed at OS level first:
-- Ubuntu/Debian: sudo apt-get install postgresql-16-pg-qualstats postgresql-16-hypopg
-- RHEL/CentOS: sudo yum install pg_qualstats_16 hypopg_16
-- Docker: Add to Dockerfile or use official images with contrib

\echo 'Checking required extensions...'
\echo ''

-- Install pg_stat_statements (prerequisite)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
\echo '✓ pg_stat_statements installed'

-- Install pg_qualstats for WHERE clause analysis
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_qualstats;
    RAISE NOTICE '✓ pg_qualstats installed';
EXCEPTION
    WHEN undefined_file THEN
        RAISE NOTICE '⚠️  pg_qualstats not available - install at OS level first';
    WHEN OTHERS THEN
        RAISE NOTICE '⚠️  pg_qualstats error: %', SQLERRM;
END $$;

-- Install HypoPG for hypothetical index testing
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS hypopg;
    RAISE NOTICE '✓ HypoPG installed';
EXCEPTION
    WHEN undefined_file THEN
        RAISE NOTICE '⚠️  HypoPG not available - install at OS level first';
    WHEN OTHERS THEN
        RAISE NOTICE '⚠️  HypoPG error: %', SQLERRM;
END $$;

-- Install pg_cron for automated reports (optional)
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    RAISE NOTICE '✓ pg_cron installed';
EXCEPTION
    WHEN undefined_file THEN
        RAISE NOTICE 'ℹ️  pg_cron not available (optional)';
    WHEN OTHERS THEN
        RAISE NOTICE 'ℹ️  pg_cron: %', SQLERRM;
END $$;

-- =====================================================
-- CONFIGURE pg_qualstats
-- =====================================================

\echo ''
\echo 'Configuring pg_qualstats...'

DO $$
BEGIN
    -- Check if pg_qualstats is loaded
    IF NOT EXISTS (
        SELECT 1 FROM pg_settings
        WHERE name = 'shared_preload_libraries'
        AND setting LIKE '%pg_qualstats%'
    ) THEN
        RAISE NOTICE '';
        RAISE NOTICE 'IMPORTANT: To enable pg_qualstats, add to postgresql.conf:';
        RAISE NOTICE '  shared_preload_libraries = ''pg_stat_statements,pg_qualstats''';
        RAISE NOTICE 'Then restart PostgreSQL.';
        RAISE NOTICE '';
    END IF;

    -- Configure pg_qualstats settings (will apply after restart if needed)
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_qualstats') THEN
        EXECUTE 'ALTER SYSTEM SET pg_qualstats.enabled = on';
        EXECUTE 'ALTER SYSTEM SET pg_qualstats.track_constants = on';
        EXECUTE 'ALTER SYSTEM SET pg_qualstats.max = 10000';
        EXECUTE 'ALTER SYSTEM SET pg_qualstats.resolve_oids = on';
        EXECUTE 'ALTER SYSTEM SET pg_qualstats.sample_rate = 1';  -- 1 = 100% sampling

        -- Reload configuration
        PERFORM pg_reload_conf();

        RAISE NOTICE '✓ pg_qualstats configured';
    END IF;
END $$;

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

\echo ''
\echo 'Creating extension check function...'

-- Function to check if extensions are properly installed
CREATE OR REPLACE FUNCTION check_performance_extensions()
RETURNS TABLE(
    extension_name TEXT,
    version TEXT,
    status TEXT,
    description TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        required.extname::TEXT,
        COALESCE(e.extversion, 'N/A')::TEXT,
        CASE
            WHEN e.extname IS NOT NULL THEN '✅ Installed'
            ELSE '❌ Not Installed'
        END::TEXT,
        CASE required.extname
            WHEN 'pg_stat_statements' THEN 'Query performance statistics'
            WHEN 'pg_qualstats' THEN 'WHERE clause and predicate analysis'
            WHEN 'hypopg' THEN 'Hypothetical index testing'
            WHEN 'pg_cron' THEN 'Scheduled job automation'
            ELSE 'Unknown extension'
        END::TEXT
    FROM (
        VALUES
            ('pg_stat_statements'),
            ('pg_qualstats'),
            ('hypopg'),
            ('pg_cron')
    ) AS required(extname)
    LEFT JOIN pg_extension e ON e.extname = required.extname;
END $$;

COMMENT ON FUNCTION check_performance_extensions() IS
'Check status of performance-related extensions';

-- =====================================================
-- QUALSTATS ANALYSIS FUNCTIONS
-- =====================================================

\echo 'Creating pg_qualstats analysis functions...'

-- Analyze most filtered columns without indexes
CREATE OR REPLACE FUNCTION analyze_missing_indexes_qualstats()
RETURNS TABLE(
    schema_name TEXT,
    table_name TEXT,
    column_name TEXT,
    filter_count BIGINT,
    avg_execution_time NUMERIC,
    total_execution_time NUMERIC,
    recommended_index TEXT,
    estimated_improvement TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- Check if pg_qualstats is installed
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_qualstats') THEN
        RAISE NOTICE 'pg_qualstats extension not installed. Install it for predicate analysis.';
        RETURN;
    END IF;

    RETURN QUERY
    WITH qual_stats AS (
        SELECT
            qs.schemaname,
            qs.tablename,
            att.attname,
            COUNT(*)::BIGINT as occurences,
            AVG(qs.execution_count)::NUMERIC as avg_exec,
            SUM(qs.execution_count * qs.mean_exec_time)::NUMERIC as total_time
        FROM pg_qualstats qs
        JOIN pg_attribute att ON att.attrelid = qs.relid AND att.attnum = ANY(qs.attnums)
        WHERE qs.schemaname NOT IN ('pg_catalog', 'information_schema')
        GROUP BY qs.schemaname, qs.tablename, att.attname
        HAVING COUNT(*) > 10  -- Minimum threshold
    ),
    existing_indexes AS (
        SELECT
            schemaname,
            tablename,
            STRING_AGG(indexdef, '; ') as indexes
        FROM pg_indexes
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
        GROUP BY schemaname, tablename
    )
    SELECT
        qs.schemaname::TEXT,
        qs.tablename::TEXT,
        qs.attname::TEXT,
        qs.occurences,
        ROUND(qs.avg_exec, 2),
        ROUND(qs.total_time, 2),
        FORMAT('CREATE INDEX idx_%s_%s ON %I.%I(%I)',
            qs.tablename,
            qs.attname,
            qs.schemaname,
            qs.tablename,
            qs.attname
        )::TEXT,
        CASE
            WHEN qs.occurences > 1000 THEN '⚡ VERY HIGH (10x+)'
            WHEN qs.occurences > 500 THEN '🔥 HIGH (5x+)'
            WHEN qs.occurences > 100 THEN '📈 MEDIUM (2x+)'
            ELSE '📊 LOW (1.5x)'
        END::TEXT
    FROM qual_stats qs
    LEFT JOIN existing_indexes ei
        ON qs.schemaname = ei.schemaname
        AND qs.tablename = ei.tablename
    WHERE ei.indexes IS NULL
        OR ei.indexes NOT ILIKE '%' || qs.attname || '%'
    ORDER BY qs.total_time DESC
    LIMIT 20;
END $$;

COMMENT ON FUNCTION analyze_missing_indexes_qualstats() IS
'Analyzes pg_qualstats data to find frequently filtered columns without indexes.
Usage: SELECT * FROM analyze_missing_indexes_qualstats();';

-- =====================================================
-- HYPOPG INDEX TESTING FUNCTIONS
-- =====================================================

\echo 'Creating HypoPG test functions...'

-- Test a hypothetical index impact
CREATE OR REPLACE FUNCTION test_hypothetical_index(
    p_index_definition TEXT,
    p_test_query TEXT DEFAULT NULL
)
RETURNS TABLE(
    index_name TEXT,
    index_definition TEXT,
    size_estimate TEXT,
    query_cost_before NUMERIC,
    query_cost_after NUMERIC,
    cost_reduction_percent NUMERIC,
    recommendation TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_hypoid OID;
    v_index_name TEXT;
    v_size BIGINT;
    v_cost_before NUMERIC;
    v_cost_after NUMERIC;
    v_plan_before JSONB;
    v_plan_after JSONB;
BEGIN
    -- Check if HypoPG is installed
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'hypopg') THEN
        RAISE NOTICE 'HypoPG extension not installed. Install it for index testing.';
        RETURN;
    END IF;

    -- Get cost before hypothetical index
    IF p_test_query IS NOT NULL THEN
        EXECUTE FORMAT('EXPLAIN (FORMAT JSON) %s', p_test_query) INTO v_plan_before;
        v_cost_before := (v_plan_before->0->'Plan'->>'Total Cost')::NUMERIC;
    END IF;

    -- Create hypothetical index
    SELECT hypopg_create_index(p_index_definition)
    INTO v_hypoid, v_index_name;

    -- Get hypothetical index size
    SELECT pg_size_pretty(hypopg_relation_size(v_hypoid))::TEXT INTO v_size;

    -- Get cost after hypothetical index
    IF p_test_query IS NOT NULL THEN
        EXECUTE FORMAT('EXPLAIN (FORMAT JSON) %s', p_test_query) INTO v_plan_after;
        v_cost_after := (v_plan_after->0->'Plan'->>'Total Cost')::NUMERIC;
    END IF;

    -- Return results
    RETURN QUERY
    SELECT
        v_index_name::TEXT,
        p_index_definition::TEXT,
        v_size::TEXT,
        ROUND(v_cost_before, 2),
        ROUND(v_cost_after, 2),
        CASE
            WHEN v_cost_before > 0 AND v_cost_after IS NOT NULL
            THEN ROUND((1 - v_cost_after/v_cost_before) * 100, 2)
            ELSE 0::NUMERIC
        END,
        CASE
            WHEN v_cost_before > 0 AND v_cost_after < v_cost_before * 0.5
            THEN '⚡ HIGHLY RECOMMENDED - Over 50% improvement'
            WHEN v_cost_before > 0 AND v_cost_after < v_cost_before * 0.8
            THEN '✅ RECOMMENDED - 20%+ improvement'
            WHEN v_cost_before > 0 AND v_cost_after < v_cost_before
            THEN '📊 OPTIONAL - Some improvement'
            ELSE '❌ NOT RECOMMENDED - No significant benefit'
        END::TEXT;

    -- Clean up hypothetical index
    PERFORM hypopg_drop_index(v_hypoid);
END $$;

COMMENT ON FUNCTION test_hypothetical_index(TEXT, TEXT) IS
'Tests impact of a hypothetical index without creating it.
Usage:
    SELECT * FROM test_hypothetical_index(
        ''CREATE INDEX ON reservations(guest_id, check_in_date)'',
        ''SELECT * FROM reservations WHERE guest_id = ''''uuid'''' AND check_in_date > CURRENT_DATE''
    );';

-- =====================================================
-- AUTOMATED INDEX RECOMMENDATIONS
-- =====================================================

\echo 'Creating automated index recommendation function...'

-- Comprehensive index recommendation system
CREATE OR REPLACE FUNCTION recommend_indexes_auto()
RETURNS TABLE(
    priority INTEGER,
    table_name TEXT,
    index_definition TEXT,
    reason TEXT,
    estimated_benefit TEXT,
    create_command TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_rec RECORD;
    v_priority INTEGER := 1;
BEGIN
    -- 1. Recommendations from pg_qualstats (WHERE clauses)
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_qualstats') THEN
        FOR v_rec IN
            SELECT * FROM analyze_missing_indexes_qualstats()
            LIMIT 5
        LOOP
            RETURN QUERY
            SELECT
                v_priority,
                v_rec.schema_name || '.' || v_rec.table_name,
                v_rec.recommended_index,
                FORMAT('Column %s filtered %s times', v_rec.column_name, v_rec.filter_count),
                v_rec.estimated_improvement,
                v_rec.recommended_index;
            v_priority := v_priority + 1;
        END LOOP;
    END IF;

    -- 2. Recommendations from pg_stat_user_tables (sequential scans)
    FOR v_rec IN
        SELECT
            schemaname,
            tablename,
            seq_scan,
            seq_tup_read,
            ROUND(seq_tup_read::NUMERIC / GREATEST(seq_scan, 1), 0) as avg_rows
        FROM pg_stat_user_tables
        WHERE seq_scan > 1000
        AND seq_tup_read > 1000000
        ORDER BY seq_tup_read DESC
        LIMIT 5
    LOOP
        RETURN QUERY
        SELECT
            v_priority,
            v_rec.schemaname || '.' || v_rec.tablename,
            FORMAT('CREATE INDEX idx_%s_common ON %I.%I(created_at, updated_at)',
                v_rec.tablename, v_rec.schemaname, v_rec.tablename),
            FORMAT('Table has %s sequential scans reading %s rows',
                v_rec.seq_scan, v_rec.seq_tup_read),
            '🔍 Reduce full table scans',
            FORMAT('CREATE INDEX idx_%s_common ON %I.%I(created_at DESC, updated_at DESC)',
                v_rec.tablename, v_rec.schemaname, v_rec.tablename);
        v_priority := v_priority + 1;
    END LOOP;

    -- 3. Foreign key indexes (missing)
    FOR v_rec IN
        SELECT
            conrelid::regclass AS table_name,
            conname AS fk_name,
            a.attname AS fk_column
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
        WHERE c.contype = 'f'
        AND NOT EXISTS (
            SELECT 1 FROM pg_index i
            WHERE i.indrelid = c.conrelid
            AND a.attnum = ANY(i.indkey)
        )
        LIMIT 5
    LOOP
        RETURN QUERY
        SELECT
            v_priority,
            v_rec.table_name::TEXT,
            FORMAT('CREATE INDEX idx_%s_fk ON %s(%s)',
                v_rec.fk_name, v_rec.table_name, v_rec.fk_column),
            FORMAT('Missing index on foreign key: %s', v_rec.fk_name),
            '🔗 Faster JOINs',
            FORMAT('CREATE INDEX idx_%s_%s ON %s(%s)',
                v_rec.table_name, v_rec.fk_column, v_rec.table_name, v_rec.fk_column);
        v_priority := v_priority + 1;
    END LOOP;
END $$;

COMMENT ON FUNCTION recommend_indexes_auto() IS
'Automatically recommends indexes based on multiple sources.
Usage: SELECT * FROM recommend_indexes_auto();';

-- =====================================================
-- MONITORING VIEWS
-- =====================================================

\echo 'Creating monitoring views...'

-- Real-time index recommendation view
CREATE OR REPLACE VIEW v_index_recommendations AS
SELECT
    priority,
    table_name,
    index_definition,
    reason,
    estimated_benefit,
    create_command,
    CURRENT_TIMESTAMP as generated_at
FROM recommend_indexes_auto()
ORDER BY priority;

COMMENT ON VIEW v_index_recommendations IS
'Real-time index recommendations from multiple sources';

-- Extension status view
CREATE OR REPLACE VIEW v_extension_status AS
SELECT * FROM check_performance_extensions();

COMMENT ON VIEW v_extension_status IS
'Current status of all performance extensions';

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

\echo ''
\echo '======================================================'
\echo '  Performance Extensions Setup Complete!'
\echo '======================================================'
\echo ''
\echo 'Check extension status:'
\echo '  SELECT * FROM v_extension_status;'
\echo ''
\echo 'Get index recommendations:'
\echo '  SELECT * FROM v_index_recommendations;'
\echo ''
\echo 'Test hypothetical index:'
\echo '  SELECT * FROM test_hypothetical_index('
\echo '    ''CREATE INDEX ON guests(email)'','
\echo '    ''SELECT * FROM guests WHERE email = ''''test@example.com'''''
\echo '  );'
\echo ''

\echo ''
\echo '======================================================'
\echo '  EXTENSION INSTALLATION NOTES'
\echo '======================================================'
\echo ''
\echo '📦 If extensions are missing, install at OS level:'
\echo ''
\echo 'Ubuntu/Debian:'
\echo '  sudo apt-get install postgresql-16-pg-qualstats'
\echo '  sudo apt-get install postgresql-16-hypopg'
\echo ''
\echo 'RHEL/CentOS:'
\echo '  sudo yum install pg_qualstats_16'
\echo '  sudo yum install hypopg_16'
\echo ''
\echo 'Docker:'
\echo '  Use postgres:16 image with contrib extensions'
\echo ''
\echo '⚙️  pg_qualstats requires PostgreSQL restart after adding to'
\echo '   shared_preload_libraries in postgresql.conf'
\echo ''

\echo '✅ Extension setup complete!'
\echo ''
