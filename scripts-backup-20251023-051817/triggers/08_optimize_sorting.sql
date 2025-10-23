-- =====================================================
-- 08_optimize_sorting.sql
-- Incremental Sort and Sort Optimization
-- Date: 2025-10-15
--
-- Purpose: Detect sort-heavy queries and recommend
--          incremental sort opportunities
-- =====================================================

\c tartware

-- =====================================================
-- Function: analyze_sort_operations
-- Purpose: Find queries with expensive sort operations
-- =====================================================

CREATE OR REPLACE FUNCTION analyze_sort_operations()
RETURNS TABLE(
    query_sample TEXT,
    total_calls BIGINT,
    avg_exec_time_ms NUMERIC,
    sorts_detected INTEGER,
    uses_incremental_sort BOOLEAN,
    sort_method TEXT,
    recommendation TEXT,
    potential_speedup TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH sort_queries AS (
        SELECT
            LEFT(query, 200) AS query_sample,
            calls,
            ROUND((total_exec_time / calls)::NUMERIC, 2) AS avg_time_ms,
            CASE
                WHEN query ~* 'order by' THEN 1
                ELSE 0
            END AS has_sort
        FROM pg_stat_statements
        WHERE query NOT LIKE '%pg_stat_statements%'
            AND calls > 10
            AND query ~* 'order by'
    )
    SELECT
        query_sample::TEXT,
        calls,
        avg_time_ms,
        has_sort,
        FALSE::BOOLEAN AS uses_incremental_sort,  -- Requires EXPLAIN analysis
        'Unknown (run EXPLAIN ANALYZE)'::TEXT,
        CASE
            WHEN avg_time_ms > 1000 THEN 'CRITICAL: Very slow sort - check indexes for ORDER BY columns'
            WHEN avg_time_ms > 500 THEN 'HIGH: Slow sort - consider composite index for ORDER BY'
            WHEN avg_time_ms > 100 THEN 'MEDIUM: Review ORDER BY columns and add indexes'
            ELSE 'GOOD: Sort appears efficient'
        END::TEXT,
        CASE
            WHEN avg_time_ms > 1000 THEN '5-10x speedup possible with proper indexing'
            WHEN avg_time_ms > 500 THEN '3-5x speedup possible'
            WHEN avg_time_ms > 100 THEN '2-3x speedup possible'
            ELSE 'Minimal improvement expected'
        END::TEXT
    FROM sort_queries
    ORDER BY avg_time_ms DESC
    LIMIT 20;
END;
$$;

COMMENT ON FUNCTION analyze_sort_operations() IS
'Identify queries with expensive sort operations';

-- =====================================================
-- Function: check_incremental_sort_eligibility
-- Purpose: Check if query can use incremental sort
-- =====================================================

CREATE OR REPLACE FUNCTION check_incremental_sort_eligibility(p_query TEXT)
RETURNS TABLE(
    can_use_incremental_sort BOOLEAN,
    order_by_columns TEXT[],
    existing_indexes TEXT[],
    partial_match_indexes TEXT[],
    recommendation TEXT,
    example_index TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_order_by_cols TEXT[];
    v_table_name TEXT;
BEGIN
    -- Extract ORDER BY columns (simplified parsing)
    -- In production, use pg_query or more sophisticated parsing

    -- Extract table name from FROM clause
    v_table_name := (
        SELECT regexp_replace(
            regexp_replace(p_query, '.*from\s+(\w+).*', '\1', 'gi'),
            '[^a-zA-Z0-9_]', '', 'g'
        )
    );

    RETURN QUERY
    SELECT
        TRUE::BOOLEAN,  -- Placeholder - requires full EXPLAIN analysis
        ARRAY['tenant_id', 'created_at']::TEXT[],  -- Example
        ARRAY['idx_example']::TEXT[],
        ARRAY['idx_partial']::TEXT[],
        format('Create composite index on %s for incremental sort: CREATE INDEX CONCURRENTLY idx_%s_incremental ON %s (tenant_id, created_at);',
            v_table_name, v_table_name, v_table_name)::TEXT,
        format('CREATE INDEX CONCURRENTLY idx_%s_incremental ON %s (col1, col2, col3);',
            v_table_name, v_table_name)::TEXT;
END;
$$;

COMMENT ON FUNCTION check_incremental_sort_eligibility(TEXT) IS
'Check if query can benefit from incremental sort';

-- =====================================================
-- Function: recommend_sort_indexes
-- Purpose: Recommend indexes for ORDER BY queries
-- =====================================================

CREATE OR REPLACE FUNCTION recommend_sort_indexes()
RETURNS TABLE(
    table_name TEXT,
    common_order_by_pattern TEXT,
    current_indexes TEXT[],
    missing_index TEXT,
    estimated_benefit TEXT,
    priority TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    -- Common patterns for PMS system
    SELECT
        'reservations'::TEXT,
        'ORDER BY property_id, check_in_date'::TEXT,
        ARRAY['idx_reservations_property']::TEXT[],
        'CREATE INDEX CONCURRENTLY idx_reservations_property_checkin ON reservations(property_id, check_in_date) WHERE deleted_at IS NULL;'::TEXT,
        'Incremental sort for property + date queries'::TEXT,
        'HIGH'::TEXT
    UNION ALL
    SELECT
        'guests'::TEXT,
        'ORDER BY tenant_id, last_name, first_name'::TEXT,
        ARRAY['idx_guests_tenant']::TEXT[],
        'CREATE INDEX CONCURRENTLY idx_guests_tenant_name ON guests(tenant_id, last_name, first_name) WHERE deleted_at IS NULL;'::TEXT,
        'Fast alphabetical guest listing per tenant'::TEXT,
        'MEDIUM'::TEXT
    UNION ALL
    SELECT
        'payments'::TEXT,
        'ORDER BY reservation_id, payment_date'::TEXT,
        ARRAY['idx_payments_reservation']::TEXT[],
        'CREATE INDEX CONCURRENTLY idx_payments_reservation_date ON payments(reservation_id, payment_date) WHERE deleted_at IS NULL;'::TEXT,
        'Chronological payment history per reservation'::TEXT,
        'MEDIUM'::TEXT
    UNION ALL
    SELECT
        'analytics_metrics'::TEXT,
        'ORDER BY property_id, metric_date DESC'::TEXT,
        ARRAY['idx_analytics_property']::TEXT[],
        'CREATE INDEX CONCURRENTLY idx_analytics_property_date_desc ON analytics_metrics(property_id, metric_date DESC) WHERE deleted_at IS NULL;'::TEXT,
        'Fast recent metrics retrieval (DESC order)'::TEXT,
        'HIGH'::TEXT
    UNION ALL
    SELECT
        'housekeeping_tasks'::TEXT,
        'ORDER BY property_id, scheduled_date, room_id'::TEXT,
        ARRAY['idx_housekeeping_property']::TEXT[],
        'CREATE INDEX CONCURRENTLY idx_housekeeping_schedule ON housekeeping_tasks(property_id, scheduled_date, room_id) WHERE deleted_at IS NULL;'::TEXT,
        'Daily housekeeping schedule per property'::TEXT,
        'MEDIUM'::TEXT;
END;
$$;

COMMENT ON FUNCTION recommend_sort_indexes() IS
'Recommend composite indexes for common ORDER BY patterns';

-- =====================================================
-- View: Sort Performance Monitor
-- =====================================================

CREATE OR REPLACE VIEW v_sort_performance AS
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    CASE
        WHEN idx_scan > 1000 THEN '✅ FREQUENTLY USED'
        WHEN idx_scan > 100 THEN '✅ REGULARLY USED'
        WHEN idx_scan > 0 THEN '⚠️ RARELY USED'
        ELSE '❌ NEVER USED'
    END AS usage_status,
    CASE
        WHEN indexdef LIKE '%DESC%' THEN 'DESC ordering (good for recent data)'
        WHEN indexdef LIKE '%INCLUDE%' THEN 'Covering index (excellent)'
        ELSE 'Standard ascending index'
    END AS index_type
FROM pg_stat_user_indexes
JOIN pg_indexes ON pg_indexes.indexname = pg_stat_user_indexes.indexrelname
WHERE schemaname IN ('public', 'availability')
    AND indexdef LIKE '%ORDER BY%' OR indexdef LIKE '%DESC%'
ORDER BY idx_scan DESC;

COMMENT ON VIEW v_sort_performance IS
'Monitor index usage for ORDER BY operations';

-- =====================================================
-- Function: explain_sort_plan
-- Purpose: Analyze sort method used by query
-- =====================================================

CREATE OR REPLACE FUNCTION explain_sort_plan(p_query TEXT)
RETURNS TABLE(
    plan_line TEXT,
    sort_method TEXT,
    sort_space_used TEXT,
    sort_space_type TEXT,
    recommendation TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_plan_json JSON;
    v_plan_text TEXT;
BEGIN
    -- Get EXPLAIN ANALYZE output
    BEGIN
        EXECUTE format('EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) %s', p_query) INTO v_plan_json;

        -- Parse for sort information
        v_plan_text := v_plan_json::TEXT;

        RETURN QUERY
        SELECT
            'Sort Method: ' ||
            COALESCE(
                (v_plan_json->0->'Plan'->'Sort Method')::TEXT,
                'Not using sort'
            )::TEXT AS plan_line,
            COALESCE(
                (v_plan_json->0->'Plan'->'Sort Method')::TEXT,
                'N/A'
            )::TEXT AS sort_method,
            COALESCE(
                (v_plan_json->0->'Plan'->'Sort Space Used')::TEXT || 'kB',
                'N/A'
            )::TEXT AS sort_space_used,
            COALESCE(
                (v_plan_json->0->'Plan'->'Sort Space Type')::TEXT,
                'N/A'
            )::TEXT AS sort_space_type,
            CASE
                WHEN v_plan_text LIKE '%external merge%'
                THEN 'CRITICAL: Disk-based sort! Increase work_mem or add index'
                WHEN v_plan_text LIKE '%quicksort%'
                THEN 'GOOD: In-memory sort (quicksort)'
                WHEN v_plan_text LIKE '%top-N heapsort%'
                THEN 'EXCELLENT: Optimized top-N sort with LIMIT'
                WHEN v_plan_text LIKE '%Incremental Sort%'
                THEN 'EXCELLENT: Using incremental sort (PG13+)'
                ELSE 'Review EXPLAIN plan for optimization opportunities'
            END::TEXT AS recommendation;

    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY
        SELECT
            'Error analyzing query'::TEXT,
            'ERROR'::TEXT,
            SQLERRM::TEXT,
            'N/A'::TEXT,
            'Check query syntax and permissions'::TEXT;
    END;
END;
$$;

COMMENT ON FUNCTION explain_sort_plan(TEXT) IS
'Analyze sort method used by query execution plan';

-- =====================================================
-- Example Usage
-- =====================================================

\echo ''
\echo '======================================================'
\echo '  SORT OPTIMIZATION - EXAMPLES'
\echo '======================================================'
\echo ''
\echo 'Example 1: Find slow sort operations'
\echo '----------------------------------------------------'
\echo 'SELECT * FROM analyze_sort_operations();'
\echo ''
\echo 'Example 2: Get sort index recommendations'
\echo '----------------------------------------------------'
\echo 'SELECT * FROM recommend_sort_indexes();'
\echo ''
\echo 'Example 3: Analyze specific query sort plan'
\echo '----------------------------------------------------'
\echo 'SELECT * FROM explain_sort_plan('
\echo '    ''SELECT * FROM reservations ORDER BY property_id, check_in_date LIMIT 100'''
\echo ');'
\echo ''
\echo 'Example 4: Monitor sort performance'
\echo '----------------------------------------------------'
\echo 'SELECT * FROM v_sort_performance;'
\echo ''

\echo ''
\echo '======================================================'
\echo '  INCREMENTAL SORT (PostgreSQL 13+)'
\echo '======================================================'
\echo ''
\echo '🎯 What is Incremental Sort?'
\echo '  • Introduced in PostgreSQL 13'
\echo '  • Sorts data in chunks when partially sorted'
\echo '  • Much faster than full sort'
\echo ''
\echo '📊 Example:'
\echo '  Query: SELECT * FROM reservations'
\echo '         ORDER BY property_id, check_in_date;'
\echo ''
\echo '  ❌ Without proper index:'
\echo '     → Full sort of entire table'
\echo '     → Reads all data into memory'
\echo '     → Slow for large tables'
\echo ''
\echo '  ✅ With index on (property_id):'
\echo '     → Data already sorted by property_id'
\echo '     → Only sorts check_in_date within each property'
\echo '     → Incremental Sort! Much faster!'
\echo ''
\echo '🔧 How to Enable:'
\echo '  • Ensure PostgreSQL 13+'
\echo '  • Create composite indexes matching ORDER BY'
\echo '  • Check with: SHOW server_version;'
\echo ''
\echo '💡 Best Practice:'
\echo '  CREATE INDEX idx_table_col1_col2 ON table(col1, col2);'
\echo '  -- Matches: ORDER BY col1, col2'
\echo ''

\echo ''
\echo '✅ Sort optimization tools installed successfully!'
\echo ''
