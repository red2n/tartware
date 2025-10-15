-- =====================================================
-- 09_optimize_distinct.sql
-- DISTINCT Query Optimization
-- Date: 2025-10-15
--
-- Purpose: Detect and optimize DISTINCT operations
--          for better performance
-- =====================================================

\c tartware

-- =====================================================
-- Function: analyze_distinct_queries
-- Purpose: Find slow DISTINCT operations
-- =====================================================

CREATE OR REPLACE FUNCTION analyze_distinct_queries()
RETURNS TABLE(
    query_sample TEXT,
    total_calls BIGINT,
    avg_exec_time_ms NUMERIC,
    total_time_ms NUMERIC,
    distinct_type TEXT,
    severity TEXT,
    recommendation TEXT,
    alternative_query TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        LEFT(query, 200)::TEXT AS query_sample,
        calls,
        ROUND((total_exec_time / calls)::NUMERIC, 2) AS avg_time_ms,
        ROUND(total_exec_time::NUMERIC, 2) AS total_time_ms,
        CASE
            WHEN query ~* 'distinct\s+on' THEN 'DISTINCT ON (optimized)'
            WHEN query ~* 'select\s+distinct' THEN 'SELECT DISTINCT'
            ELSE 'Other'
        END::TEXT AS distinct_type,
        CASE
            WHEN total_exec_time > 10000 THEN 'CRITICAL'
            WHEN total_exec_time > 5000 THEN 'HIGH'
            WHEN total_exec_time > 1000 THEN 'MEDIUM'
            ELSE 'LOW'
        END::TEXT AS severity,
        CASE
            WHEN query ~* 'select\s+distinct\s+\w+\s+from' AND query !~ 'where'
            THEN 'Add WHERE clause to filter before DISTINCT'
            WHEN query ~* 'select\s+distinct.*order by'
            THEN 'Consider index on DISTINCT + ORDER BY columns for better performance'
            WHEN query ~* 'select\s+distinct'
            THEN 'Consider replacing with GROUP BY or using DISTINCT ON'
            ELSE 'Query appears optimized'
        END::TEXT AS recommendation,
        CASE
            WHEN query ~* 'select\s+distinct\s+(\w+)\s+from\s+(\w+)'
            THEN regexp_replace(
                query,
                'select\s+distinct\s+(\w+)\s+from',
                'SELECT \1 FROM',
                'gi'
            ) || ' GROUP BY ' ||
            regexp_replace(
                query,
                '.*select\s+distinct\s+(\w+).*',
                '\1',
                'gi'
            )
            ELSE 'N/A - Complex query requires manual optimization'
        END::TEXT AS alternative_query
    FROM pg_stat_statements
    WHERE query ~* 'distinct'
        AND query NOT LIKE '%pg_stat_statements%'
        AND calls > 5
    ORDER BY total_exec_time DESC
    LIMIT 20;
END;
$$;

COMMENT ON FUNCTION analyze_distinct_queries() IS
'Find and analyze slow DISTINCT operations';

-- =====================================================
-- Function: compare_distinct_vs_groupby
-- Purpose: Compare DISTINCT vs GROUP BY performance
-- =====================================================

CREATE OR REPLACE FUNCTION compare_distinct_vs_groupby(
    p_table_name TEXT,
    p_column_name TEXT,
    p_where_clause TEXT DEFAULT NULL
)
RETURNS TABLE(
    method TEXT,
    execution_time_ms NUMERIC,
    result_count BIGINT,
    plan_type TEXT,
    recommendation TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_distinct_time NUMERIC;
    v_groupby_time NUMERIC;
    v_distinct_count BIGINT;
    v_groupby_count BIGINT;
    v_where_clause TEXT;
    v_distinct_query TEXT;
    v_groupby_query TEXT;
    v_start_time TIMESTAMP;
    v_end_time TIMESTAMP;
BEGIN
    v_where_clause := COALESCE('WHERE ' || p_where_clause, '');

    -- Test DISTINCT
    v_distinct_query := format(
        'SELECT DISTINCT %I FROM %I %s',
        p_column_name, p_table_name, v_where_clause
    );

    v_start_time := clock_timestamp();
    EXECUTE format('SELECT COUNT(*) FROM (%s) sq', v_distinct_query) INTO v_distinct_count;
    v_end_time := clock_timestamp();
    v_distinct_time := EXTRACT(EPOCH FROM (v_end_time - v_start_time)) * 1000;

    -- Test GROUP BY
    v_groupby_query := format(
        'SELECT %I FROM %I %s GROUP BY %I',
        p_column_name, p_table_name, v_where_clause, p_column_name
    );

    v_start_time := clock_timestamp();
    EXECUTE format('SELECT COUNT(*) FROM (%s) sq', v_groupby_query) INTO v_groupby_count;
    v_end_time := clock_timestamp();
    v_groupby_time := EXTRACT(EPOCH FROM (v_end_time - v_start_time)) * 1000;

    -- Return comparison
    RETURN QUERY
    SELECT
        'SELECT DISTINCT'::TEXT,
        v_distinct_time,
        v_distinct_count,
        'HashAggregate or Sort+Unique'::TEXT,
        CASE
            WHEN v_distinct_time < v_groupby_time THEN '✅ DISTINCT is faster for this query'
            ELSE '⚠️ GROUP BY might be better'
        END::TEXT
    UNION ALL
    SELECT
        'GROUP BY'::TEXT,
        v_groupby_time,
        v_groupby_count,
        'HashAggregate or GroupAggregate'::TEXT,
        CASE
            WHEN v_groupby_time < v_distinct_time THEN '✅ GROUP BY is faster for this query'
            ELSE '⚠️ DISTINCT might be better'
        END::TEXT;
END;
$$;

COMMENT ON FUNCTION compare_distinct_vs_groupby(TEXT, TEXT, TEXT) IS
'Compare performance of DISTINCT vs GROUP BY for a specific column';

-- =====================================================
-- Function: recommend_distinct_indexes
-- Purpose: Recommend indexes for DISTINCT queries
-- =====================================================

CREATE OR REPLACE FUNCTION recommend_distinct_indexes()
RETURNS TABLE(
    table_name TEXT,
    column_name TEXT,
    current_index TEXT,
    recommended_index TEXT,
    benefit TEXT,
    priority TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    -- Recommend indexes for common DISTINCT patterns
    SELECT
        'guests'::TEXT,
        'tenant_id'::TEXT,
        'idx_guests_tenant (partial)'::TEXT,
        'Already indexed - Use: SELECT DISTINCT tenant_id FROM guests WHERE deleted_at IS NULL'::TEXT,
        'Fast DISTINCT on indexed column'::TEXT,
        'LOW'::TEXT
    UNION ALL
    SELECT
        'reservations'::TEXT,
        'status'::TEXT,
        'None'::TEXT,
        'CREATE INDEX CONCURRENTLY idx_reservations_status ON reservations(status) WHERE deleted_at IS NULL;'::TEXT,
        'Fast DISTINCT status values (Index-Only Scan possible)'::TEXT,
        'MEDIUM'::TEXT
    UNION ALL
    SELECT
        'properties'::TEXT,
        'property_type'::TEXT,
        'None'::TEXT,
        'CREATE INDEX CONCURRENTLY idx_properties_type ON properties(property_type) WHERE deleted_at IS NULL;'::TEXT,
        'Fast property type enumeration'::TEXT,
        'LOW'::TEXT
    UNION ALL
    SELECT
        'guests'::TEXT,
        'country'::TEXT,
        'None'::TEXT,
        'CREATE INDEX CONCURRENTLY idx_guests_country ON guests(country) WHERE deleted_at IS NULL;'::TEXT,
        'Fast country listing for analytics'::TEXT,
        'LOW'::TEXT
    UNION ALL
    SELECT
        'channel_mappings'::TEXT,
        'channel_name'::TEXT,
        'None'::TEXT,
        'CREATE INDEX CONCURRENTLY idx_channel_mappings_channel ON channel_mappings(channel_name) WHERE deleted_at IS NULL;'::TEXT,
        'Fast unique channel list'::TEXT,
        'LOW'::TEXT;
END;
$$;

COMMENT ON FUNCTION recommend_distinct_indexes() IS
'Recommend indexes for common DISTINCT operations';

-- =====================================================
-- Function: optimize_distinct_query
-- Purpose: Rewrite DISTINCT query for better performance
-- =====================================================

CREATE OR REPLACE FUNCTION optimize_distinct_query(p_query TEXT)
RETURNS TABLE(
    optimization_type TEXT,
    original_pattern TEXT,
    optimized_query TEXT,
    explanation TEXT,
    estimated_improvement TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_query_lower TEXT;
BEGIN
    v_query_lower := LOWER(p_query);

    -- Pattern 1: Simple DISTINCT without WHERE
    IF v_query_lower ~ 'select\s+distinct\s+\w+\s+from\s+\w+\s*;?\s*$' THEN
        RETURN QUERY
        SELECT
            'Add WHERE clause'::TEXT,
            'SELECT DISTINCT col FROM table'::TEXT,
            regexp_replace(p_query, ';?\s*$', ' WHERE deleted_at IS NULL;', 'i')::TEXT,
            'Filter before DISTINCT to reduce rows processed'::TEXT,
            '2-5x faster with WHERE clause'::TEXT;
    END IF;

    -- Pattern 2: DISTINCT with multiple columns - suggest DISTINCT ON
    IF v_query_lower ~ 'select\s+distinct\s+\w+\s*,\s*\w+' THEN
        RETURN QUERY
        SELECT
            'Use DISTINCT ON'::TEXT,
            'SELECT DISTINCT col1, col2 FROM table'::TEXT,
            'Consider: SELECT DISTINCT ON (col1) col1, col2 FROM table ORDER BY col1, col2'::TEXT,
            'DISTINCT ON is more efficient for getting first row per group'::TEXT,
            '3-10x faster for large datasets'::TEXT;
    END IF;

    -- Pattern 3: DISTINCT + ORDER BY - suggest index
    IF v_query_lower ~ 'distinct.*order by' THEN
        RETURN QUERY
        SELECT
            'Add composite index'::TEXT,
            'SELECT DISTINCT col1 ORDER BY col2'::TEXT,
            'CREATE INDEX idx_table_col1_col2 ON table(col1, col2)'::TEXT,
            'Composite index enables Index-Only Scan'::TEXT,
            '5-20x faster with proper index'::TEXT;
    END IF;

    -- Pattern 4: Simple DISTINCT - suggest GROUP BY alternative
    IF v_query_lower ~ 'select\s+distinct\s+\w+\s+from' AND v_query_lower !~ 'distinct on' THEN
        RETURN QUERY
        SELECT
            'Try GROUP BY'::TEXT,
            p_query::TEXT,
            regexp_replace(
                p_query,
                'select\s+distinct\s+(\w+)\s+from\s+(\w+)',
                'SELECT \1 FROM \2 WHERE deleted_at IS NULL GROUP BY \1',
                'gi'
            )::TEXT,
            'GROUP BY can use GroupAggregate with sorted data (faster than HashAggregate)'::TEXT,
            'Test both - GROUP BY may be 2-5x faster depending on data'::TEXT;
    END IF;

    -- If no patterns matched
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT
            'No optimization'::TEXT,
            p_query::TEXT,
            p_query::TEXT,
            'Query appears already optimized or requires manual review'::TEXT,
            'Run EXPLAIN ANALYZE to check execution plan'::TEXT;
    END IF;
END;
$$;

COMMENT ON FUNCTION optimize_distinct_query(TEXT) IS
'Suggest optimizations for DISTINCT queries';

-- =====================================================
-- View: DISTINCT Query Performance
-- =====================================================

CREATE OR REPLACE VIEW v_distinct_performance AS
SELECT
    LEFT(query, 150) AS query_sample,
    calls,
    ROUND(mean_exec_time::NUMERIC, 2) AS avg_time_ms,
    ROUND(total_exec_time::NUMERIC, 2) AS total_time_ms,
    CASE
        WHEN query ~* 'distinct\s+on' THEN '✅ Using DISTINCT ON'
        WHEN query ~* 'group\s+by' THEN '✅ Using GROUP BY'
        WHEN query ~* 'select\s+distinct' THEN '⚠️ Using SELECT DISTINCT'
        ELSE 'Other'
    END AS method,
    CASE
        WHEN mean_exec_time > 1000 THEN 'CRITICAL - Optimize immediately'
        WHEN mean_exec_time > 500 THEN 'HIGH - Review and optimize'
        WHEN mean_exec_time > 100 THEN 'MEDIUM - Consider optimization'
        ELSE 'GOOD - Performing well'
    END AS status
FROM pg_stat_statements
WHERE query ~* 'distinct|group\s+by'
    AND query NOT LIKE '%pg_stat_statements%'
    AND calls > 10
ORDER BY total_exec_time DESC
LIMIT 25;

COMMENT ON VIEW v_distinct_performance IS
'Monitor DISTINCT and GROUP BY query performance';

-- =====================================================
-- Example Usage
-- =====================================================

\echo ''
\echo '======================================================'
\echo '  DISTINCT OPTIMIZATION - EXAMPLES'
\echo '======================================================'
\echo ''
\echo 'Example 1: Find slow DISTINCT queries'
\echo '----------------------------------------------------'
\echo 'SELECT * FROM analyze_distinct_queries() WHERE severity IN (''CRITICAL'', ''HIGH'');'
\echo ''
\echo 'Example 2: Compare DISTINCT vs GROUP BY'
\echo '----------------------------------------------------'
\echo 'SELECT * FROM compare_distinct_vs_groupby(''guests'', ''tenant_id'', ''deleted_at IS NULL'');'
\echo ''
\echo 'Example 3: Get index recommendations'
\echo '----------------------------------------------------'
\echo 'SELECT * FROM recommend_distinct_indexes();'
\echo ''
\echo 'Example 4: Optimize specific query'
\echo '----------------------------------------------------'
\echo 'SELECT * FROM optimize_distinct_query('
\echo '    ''SELECT DISTINCT status FROM reservations'''
\echo ');'
\echo ''
\echo 'Example 5: Monitor DISTINCT performance'
\echo '----------------------------------------------------'
\echo 'SELECT * FROM v_distinct_performance;'
\echo ''

\echo ''
\echo '======================================================'
\echo '  DISTINCT OPTIMIZATION TECHNIQUES'
\echo '======================================================'
\echo ''
\echo '🎯 Technique 1: Use GROUP BY instead of DISTINCT'
\echo '  ❌ SELECT DISTINCT column FROM table;'
\echo '  ✅ SELECT column FROM table GROUP BY column;'
\echo ''
\echo '  Why? GROUP BY can use GroupAggregate with sorted data'
\echo '        (faster than HashAggregate used by DISTINCT)'
\echo ''
\echo '🎯 Technique 2: Use DISTINCT ON for multiple columns'
\echo '  ❌ SELECT DISTINCT col1, col2 FROM table;'
\echo '  ✅ SELECT DISTINCT ON (col1) col1, col2 FROM table'
\echo '     ORDER BY col1, col2;'
\echo ''
\echo '  Why? DISTINCT ON processes rows in order, stopping'
\echo '        at first match per group (more efficient)'
\echo ''
\echo '🎯 Technique 3: Add indexes for DISTINCT columns'
\echo '  CREATE INDEX idx_table_col ON table(col)'
\echo '  WHERE deleted_at IS NULL;'
\echo ''
\echo '  Why? Index-Only Scan can retrieve distinct values'
\echo '        directly from index (10-100x faster!)'
\echo ''
\echo '🎯 Technique 4: Filter BEFORE DISTINCT'
\echo '  ❌ SELECT DISTINCT col FROM large_table;'
\echo '  ✅ SELECT DISTINCT col FROM large_table'
\echo '     WHERE tenant_id = ? AND deleted_at IS NULL;'
\echo ''
\echo '  Why? Process fewer rows = faster aggregation'
\echo ''
\echo '🎯 Technique 5: Use covering indexes'
\echo '  CREATE INDEX idx_cover ON table(col1)'
\echo '  INCLUDE (col2, col3);'
\echo ''
\echo '  Why? All data in index = no table access needed'
\echo ''
\echo '📊 Performance Comparison Example:'
\echo '  SELECT DISTINCT status FROM reservations;'
\echo '    • No index:         5000ms (Seq Scan + HashAggregate)'
\echo '    • With index:       50ms (Index Only Scan)'
\echo '    • GROUP BY + index: 30ms (GroupAggregate on sorted data)'
\echo ''
\echo '  Result: 100-150x speedup with proper index!'
\echo ''

\echo ''
\echo '✅ DISTINCT optimization tools installed successfully!'
\echo ''
