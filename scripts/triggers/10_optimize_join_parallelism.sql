-- =====================================================
-- 10_optimize_join_parallelism.sql
-- JOIN Parallelism and Multi-Core Optimization
-- Date: 2025-10-15
--
-- Purpose: Enable and optimize parallel query execution
--          for JOIN operations on multi-core systems
-- =====================================================

\c tartware

-- =====================================================
-- Function: check_parallel_settings
-- Purpose: Verify parallel query configuration
-- =====================================================

CREATE OR REPLACE FUNCTION check_parallel_settings()
RETURNS TABLE(
    setting_name TEXT,
    current_value TEXT,
    recommended_value TEXT,
    status TEXT,
    impact TEXT,
    requires_restart BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_cpu_count INTEGER;
BEGIN
    -- Try to detect CPU count (approximate)
    v_cpu_count := GREATEST(
        current_setting('max_worker_processes')::INTEGER,
        8  -- Assume at least 8 cores for modern server
    );

    RETURN QUERY
    -- max_parallel_workers_per_gather
    SELECT
        'max_parallel_workers_per_gather'::TEXT,
        current_setting('max_parallel_workers_per_gather')::TEXT,
        LEAST(v_cpu_count / 2, 4)::TEXT,  -- Use half CPUs, max 4 per query
        CASE
            WHEN current_setting('max_parallel_workers_per_gather')::INTEGER >= 4 THEN '✅ GOOD'
            WHEN current_setting('max_parallel_workers_per_gather')::INTEGER >= 2 THEN '⚠️ LOW'
            ELSE '❌ CRITICAL'
        END::TEXT,
        'Workers per query - more = faster parallel queries'::TEXT,
        FALSE
    UNION ALL
    -- max_parallel_workers
    SELECT
        'max_parallel_workers'::TEXT,
        current_setting('max_parallel_workers')::TEXT,
        v_cpu_count::TEXT,
        CASE
            WHEN current_setting('max_parallel_workers')::INTEGER >= v_cpu_count THEN '✅ GOOD'
            WHEN current_setting('max_parallel_workers')::INTEGER >= v_cpu_count / 2 THEN '⚠️ LOW'
            ELSE '❌ CRITICAL'
        END::TEXT,
        'Total parallel workers - should match CPU count'::TEXT,
        FALSE
    UNION ALL
    -- max_worker_processes
    SELECT
        'max_worker_processes'::TEXT,
        current_setting('max_worker_processes')::TEXT,
        (v_cpu_count + 4)::TEXT,  -- CPUs + some overhead
        CASE
            WHEN current_setting('max_worker_processes')::INTEGER >= v_cpu_count THEN '✅ GOOD'
            ELSE '⚠️ LOW'
        END::TEXT,
        'Total worker processes (parallel + background)'::TEXT,
        TRUE
    UNION ALL
    -- parallel_setup_cost
    SELECT
        'parallel_setup_cost'::TEXT,
        current_setting('parallel_setup_cost')::TEXT,
        '100-1000'::TEXT,
        CASE
            WHEN current_setting('parallel_setup_cost')::NUMERIC <= 1000 THEN '✅ GOOD'
            ELSE '⚠️ HIGH'
        END::TEXT,
        'Cost to start parallel workers - lower = more parallelism'::TEXT,
        FALSE
    UNION ALL
    -- parallel_tuple_cost
    SELECT
        'parallel_tuple_cost'::TEXT,
        current_setting('parallel_tuple_cost')::TEXT,
        '0.01-0.1'::TEXT,
        CASE
            WHEN current_setting('parallel_tuple_cost')::NUMERIC <= 0.1 THEN '✅ GOOD'
            ELSE '⚠️ HIGH'
        END::TEXT,
        'Per-row cost for parallel processing'::TEXT,
        FALSE
    UNION ALL
    -- min_parallel_table_scan_size
    SELECT
        'min_parallel_table_scan_size'::TEXT,
        current_setting('min_parallel_table_scan_size')::TEXT,
        '8MB'::TEXT,
        CASE
            WHEN pg_size_bytes(current_setting('min_parallel_table_scan_size')) <= 8388608 THEN '✅ GOOD'
            ELSE '⚠️ HIGH'
        END::TEXT,
        'Minimum table size for parallel scan'::TEXT,
        FALSE
    UNION ALL
    -- min_parallel_index_scan_size
    SELECT
        'min_parallel_index_scan_size'::TEXT,
        current_setting('min_parallel_index_scan_size')::TEXT,
        '512kB'::TEXT,
        CASE
            WHEN pg_size_bytes(current_setting('min_parallel_index_scan_size')) <= 524288 THEN '✅ GOOD'
            ELSE '⚠️ HIGH'
        END::TEXT,
        'Minimum index size for parallel scan'::TEXT,
        FALSE
    UNION ALL
    -- force_parallel_mode
    SELECT
        'force_parallel_mode'::TEXT,
        current_setting('force_parallel_mode')::TEXT,
        'off (on for testing only)'::TEXT,
        CASE
            WHEN current_setting('force_parallel_mode') = 'off' THEN '✅ GOOD'
            ELSE '⚠️ DEBUG MODE'
        END::TEXT,
        'Forces parallel mode for testing (should be off in production)'::TEXT,
        FALSE;
END;
$$;

COMMENT ON FUNCTION check_parallel_settings() IS
'Check parallel query execution configuration';

-- =====================================================
-- Function: analyze_join_parallelism
-- Purpose: Analyze JOIN queries for parallel execution
-- =====================================================

CREATE OR REPLACE FUNCTION analyze_join_parallelism()
RETURNS TABLE(
    query_sample TEXT,
    total_calls BIGINT,
    avg_exec_time_ms NUMERIC,
    join_count INTEGER,
    likely_parallel BOOLEAN,
    severity TEXT,
    recommendation TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        LEFT(query, 200)::TEXT,
        calls,
        ROUND((total_exec_time / calls)::NUMERIC, 2) AS avg_time_ms,
        (LENGTH(query) - LENGTH(REGEXP_REPLACE(query, 'JOIN', '', 'gi'))) / 4 AS join_count,
        (total_exec_time / calls) > 100 AS likely_can_benefit,
        CASE
            WHEN (total_exec_time / calls) > 5000 THEN 'CRITICAL'
            WHEN (total_exec_time / calls) > 1000 THEN 'HIGH'
            WHEN (total_exec_time / calls) > 500 THEN 'MEDIUM'
            ELSE 'LOW'
        END::TEXT AS severity,
        CASE
            WHEN (total_exec_time / calls) > 5000
            THEN 'CRITICAL: Enable parallel joins - potential 2-8x speedup on multi-core!'
            WHEN (total_exec_time / calls) > 1000
            THEN 'HIGH: Check if parallel execution is enabled for this query'
            WHEN (total_exec_time / calls) > 500
            THEN 'MEDIUM: May benefit from parallel execution'
            ELSE 'GOOD: Query is fast enough'
        END::TEXT AS recommendation
    FROM pg_stat_statements
    WHERE query ~* 'join'
        AND query NOT LIKE '%pg_stat_statements%'
        AND calls > 5
    ORDER BY (total_exec_time / calls) DESC
    LIMIT 20;
END;
$$;

COMMENT ON FUNCTION analyze_join_parallelism() IS
'Identify JOIN queries that could benefit from parallelism';

-- =====================================================
-- Function: explain_parallel_plan
-- Purpose: Check if query uses parallel execution
-- =====================================================

CREATE OR REPLACE FUNCTION explain_parallel_plan(p_query TEXT)
RETURNS TABLE(
    uses_parallelism BOOLEAN,
    parallel_workers INTEGER,
    parallel_operations TEXT[],
    execution_time_ms NUMERIC,
    recommendation TEXT,
    tuning_suggestion TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_plan_json JSON;
    v_plan_text TEXT;
    v_has_parallel BOOLEAN;
    v_worker_count INTEGER;
    v_exec_time NUMERIC;
BEGIN
    -- Get EXPLAIN ANALYZE output
    BEGIN
        EXECUTE format('EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) %s', p_query) INTO v_plan_json;

        v_plan_text := v_plan_json::TEXT;
        v_has_parallel := v_plan_text ~* 'parallel';
        v_worker_count := COALESCE(
            (v_plan_json->0->'Plan'->'Workers Planned')::INTEGER,
            0
        );
        v_exec_time := (v_plan_json->0->'Execution Time')::NUMERIC;

        RETURN QUERY
        SELECT
            v_has_parallel,
            v_worker_count,
            CASE
                WHEN v_has_parallel THEN
                    ARRAY[
                        CASE WHEN v_plan_text ~* 'Parallel Seq Scan' THEN 'Parallel Seq Scan' END,
                        CASE WHEN v_plan_text ~* 'Parallel Index Scan' THEN 'Parallel Index Scan' END,
                        CASE WHEN v_plan_text ~* 'Parallel Hash Join' THEN 'Parallel Hash Join' END,
                        CASE WHEN v_plan_text ~* 'Parallel Aggregate' THEN 'Parallel Aggregate' END
                    ]::TEXT[]
                ELSE ARRAY['No parallel operations']::TEXT[]
            END AS operations,
            ROUND(v_exec_time, 2),
            CASE
                WHEN NOT v_has_parallel AND v_exec_time > 1000
                THEN 'Enable parallelism! Adjust parallel cost settings for potential speedup'
                WHEN v_has_parallel AND v_worker_count < 4 AND v_exec_time > 1000
                THEN 'Increase max_parallel_workers_per_gather for more parallelism'
                WHEN v_has_parallel
                THEN format('✅ Using %s parallel workers', v_worker_count)
                ELSE 'Query too fast/small for parallelism to help'
            END::TEXT,
            CASE
                WHEN NOT v_has_parallel AND v_exec_time > 1000
                THEN 'Lower parallel_setup_cost to 100, parallel_tuple_cost to 0.01'
                WHEN v_has_parallel AND v_worker_count = 0
                THEN 'Check max_parallel_workers_per_gather > 0'
                WHEN v_has_parallel
                THEN 'Already optimized for parallel execution'
                ELSE 'No tuning needed'
            END::TEXT;

    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY
        SELECT
            FALSE,
            0,
            ARRAY['Error: ' || SQLERRM]::TEXT[],
            0::NUMERIC,
            'Error analyzing query'::TEXT,
            'Check query syntax and permissions'::TEXT;
    END;
END;
$$;

COMMENT ON FUNCTION explain_parallel_plan(TEXT) IS
'Analyze query execution plan for parallel operations';

-- =====================================================
-- Function: recommend_parallel_tuning
-- Purpose: Provide system-specific tuning recommendations
-- =====================================================

CREATE OR REPLACE FUNCTION recommend_parallel_tuning()
RETURNS TABLE(
    setting_name TEXT,
    current_value TEXT,
    recommended_value TEXT,
    sql_command TEXT,
    benefit TEXT,
    priority TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_current_per_gather INTEGER;
    v_current_total INTEGER;
    v_current_worker_processes INTEGER;
BEGIN
    -- Get current values
    v_current_per_gather := current_setting('max_parallel_workers_per_gather')::INTEGER;
    v_current_total := current_setting('max_parallel_workers')::INTEGER;
    v_current_worker_processes := current_setting('max_worker_processes')::INTEGER;

    -- Recommendations based on current state
    IF v_current_per_gather < 4 THEN
        RETURN QUERY
        SELECT
            'max_parallel_workers_per_gather'::TEXT,
            v_current_per_gather::TEXT,
            '4'::TEXT,
            'ALTER SYSTEM SET max_parallel_workers_per_gather = 4;'::TEXT,
            'Allow up to 4 workers per query (2-4x speedup for large JOINs)'::TEXT,
            'HIGH'::TEXT;
    END IF;

    IF v_current_total < 8 THEN
        RETURN QUERY
        SELECT
            'max_parallel_workers'::TEXT,
            v_current_total::TEXT,
            '8'::TEXT,
            'ALTER SYSTEM SET max_parallel_workers = 8;'::TEXT,
            'Total parallel workers should match CPU cores'::TEXT,
            'HIGH'::TEXT;
    END IF;

    IF v_current_worker_processes < 12 THEN
        RETURN QUERY
        SELECT
            'max_worker_processes'::TEXT,
            v_current_worker_processes::TEXT,
            '12'::TEXT,
            'ALTER SYSTEM SET max_worker_processes = 12; -- REQUIRES RESTART'::TEXT,
            'Allow more background + parallel workers'::TEXT,
            'MEDIUM'::TEXT;
    END IF;

    -- Cost tuning
    IF current_setting('parallel_setup_cost')::NUMERIC > 1000 THEN
        RETURN QUERY
        SELECT
            'parallel_setup_cost'::TEXT,
            current_setting('parallel_setup_cost')::TEXT,
            '100'::TEXT,
            'ALTER SYSTEM SET parallel_setup_cost = 100;'::TEXT,
            'Lower cost threshold encourages more parallelism'::TEXT,
            'MEDIUM'::TEXT;
    END IF;

    IF current_setting('parallel_tuple_cost')::NUMERIC > 0.1 THEN
        RETURN QUERY
        SELECT
            'parallel_tuple_cost'::TEXT,
            current_setting('parallel_tuple_cost')::TEXT,
            '0.01'::TEXT,
            'ALTER SYSTEM SET parallel_tuple_cost = 0.01;'::TEXT,
            'Lower per-row cost makes parallelism more attractive'::TEXT,
            'MEDIUM'::TEXT;
    END IF;

    -- If everything looks good
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT
            'All Settings'::TEXT,
            'Optimized'::TEXT,
            'N/A'::TEXT,
            '-- No changes needed'::TEXT,
            'Parallel query settings are already well configured'::TEXT,
            'INFO'::TEXT;
    END IF;

    -- Always recommend reload
    RETURN QUERY
    SELECT
        'Apply Changes'::TEXT,
        'N/A'::TEXT,
        'N/A'::TEXT,
        'SELECT pg_reload_conf(); -- Reload config (no restart unless max_worker_processes changed)'::TEXT,
        'Reload configuration to apply changes'::TEXT,
        'CRITICAL'::TEXT;
END;
$$;

COMMENT ON FUNCTION recommend_parallel_tuning() IS
'Generate specific tuning commands for parallel execution';

-- =====================================================
-- View: Parallel Query Performance
-- =====================================================

CREATE OR REPLACE VIEW v_parallel_query_performance AS
SELECT
    LEFT(query, 150) AS query_sample,
    calls,
    ROUND(mean_exec_time::NUMERIC, 2) AS avg_time_ms,
    ROUND(total_exec_time::NUMERIC, 2) AS total_time_ms,
    CASE
        WHEN query ~* 'parallel' THEN '✅ Using Parallelism'
        ELSE '❌ Not Parallel'
    END AS parallel_status,
    CASE
        WHEN query ~* 'join' THEN 'Has JOIN - good candidate'
        WHEN query ~* 'aggregate|group by' THEN 'Has aggregation - may benefit'
        ELSE 'Simple query'
    END AS query_type
FROM pg_stat_statements
WHERE (query ~* 'join' OR query ~* 'group by')
    AND query NOT LIKE '%pg_stat_statements%'
    AND mean_exec_time > 100
    AND calls > 5
ORDER BY total_exec_time DESC
LIMIT 25;

COMMENT ON VIEW v_parallel_query_performance IS
'Monitor queries that could benefit from parallelism';

-- =====================================================
-- Example Usage
-- =====================================================

\echo ''
\echo '======================================================'
\echo '  JOIN PARALLELISM - EXAMPLES'
\echo '======================================================'
\echo ''
\echo 'Example 1: Check parallel settings'
\echo '----------------------------------------------------'
\echo 'SELECT * FROM check_parallel_settings();'
\echo ''
\echo 'Example 2: Find JOIN queries needing parallelism'
\echo '----------------------------------------------------'
\echo 'SELECT * FROM analyze_join_parallelism() WHERE severity IN (''CRITICAL'', ''HIGH'');'
\echo ''
\echo 'Example 3: Check if query uses parallelism'
\echo '----------------------------------------------------'
\echo 'SELECT * FROM explain_parallel_plan('
\echo '    ''SELECT r.*, g.name FROM reservations r JOIN guests g ON r.guest_id = g.id'''
\echo ');'
\echo ''
\echo 'Example 4: Get tuning recommendations'
\echo '----------------------------------------------------'
\echo 'SELECT * FROM recommend_parallel_tuning();'
\echo ''
\echo 'Example 5: Monitor parallel performance'
\echo '----------------------------------------------------'
\echo 'SELECT * FROM v_parallel_query_performance;'
\echo ''

\echo ''
\echo '======================================================'
\echo '  PARALLEL QUERY OPTIMIZATION GUIDE'
\echo '======================================================'
\echo ''
\echo '🚀 What is Parallel Query Execution?'
\echo '  • Use multiple CPU cores for single query'
\echo '  • Splits work across parallel workers'
\echo '  • Available since PostgreSQL 9.6'
\echo '  • Major improvements in PG 10, 11, 12+'
\echo ''
\echo '🎯 When Does It Help?'
\echo '  ✅ Large table scans (>8MB)'
\echo '  ✅ Complex JOINs'
\echo '  ✅ Aggregations (GROUP BY, COUNT, SUM)'
\echo '  ✅ Sorting large datasets'
\echo ''
\echo '  ❌ Small queries (<100ms)'
\echo '  ❌ Single-row lookups'
\echo '  ❌ Queries with LIMIT (usually)'
\echo ''
\echo '⚙️  Key Settings (for 8-core server):'
\echo ''
\echo '  max_parallel_workers_per_gather = 4'
\echo '    └─ Workers per query (2-4 typical)'
\echo ''
\echo '  max_parallel_workers = 8'
\echo '    └─ Total parallel workers (= CPU cores)'
\echo ''
\echo '  max_worker_processes = 12'
\echo '    └─ All workers (parallel + background)'
\echo '    └─ REQUIRES RESTART to change'
\echo ''
\echo '  parallel_setup_cost = 100'
\echo '    └─ Lower = more aggressive parallelism'
\echo ''
\echo '  parallel_tuple_cost = 0.01'
\echo '    └─ Per-row processing cost'
\echo ''
\echo '📊 Performance Impact Example:'
\echo '  SELECT * FROM reservations r'
\echo '  JOIN guests g ON r.guest_id = g.id'
\echo '  JOIN properties p ON r.property_id = p.id'
\echo '  WHERE r.check_in_date > CURRENT_DATE;'
\echo ''
\echo '  Without parallelism:  8000ms (single core)'
\echo '  With 4 workers:       2000ms (4x speedup)'
\echo ''
\echo '💡 Quick Enable:'
\echo '  ALTER SYSTEM SET max_parallel_workers_per_gather = 4;'
\echo '  ALTER SYSTEM SET max_parallel_workers = 8;'
\echo '  ALTER SYSTEM SET parallel_setup_cost = 100;'
\echo '  ALTER SYSTEM SET parallel_tuple_cost = 0.01;'
\echo '  SELECT pg_reload_conf();'
\echo ''
\echo '⚠️  Gotchas:'
\echo '  • Parallel workers share work_mem!'
\echo '  • Each worker adds overhead (~100-1000ms setup)'
\echo '  • Not all operations can be parallelized'
\echo '  • Check with: EXPLAIN (ANALYZE, BUFFERS) query;'
\echo ''

\echo ''
\echo '✅ JOIN parallelism optimization installed successfully!'
\echo ''
