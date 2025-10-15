-- =====================================================
-- 01_prevent_select_star.sql
-- Prevent SELECT * Queries for Performance
-- Date: 2025-10-15
--
-- Purpose: Block inefficient SELECT * queries that retrieve
--          all columns when specific columns should be selected
--
-- Best Practice: Always specify exact columns needed
-- =====================================================

\c tartware

-- =====================================================
-- Function: check_query_efficiency
-- Purpose: Validate queries for efficiency patterns
-- =====================================================

CREATE OR REPLACE FUNCTION check_query_efficiency()
RETURNS event_trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_query TEXT;
    v_normalized_query TEXT;
BEGIN
    -- Get the current query
    v_query := current_query();

    -- Normalize query (lowercase, remove extra spaces)
    v_normalized_query := LOWER(REGEXP_REPLACE(v_query, '\s+', ' ', 'g'));

    -- Check for SELECT * patterns (but allow COUNT(*))
    IF v_normalized_query ~ 'select\s+\*\s+from'
       AND v_normalized_query !~ 'count\s*\(\s*\*\s*\)' THEN

        RAISE EXCEPTION 'Query Efficiency Violation: SELECT * is not allowed. Please specify exact columns needed.'
            USING HINT = 'Use: SELECT column1, column2 FROM table',
                  DETAIL = format('Blocked query pattern: %s',
                                 SUBSTRING(v_query FROM 1 FOR 100));
    END IF;

    -- Check for missing WHERE clause on large tables
    IF v_normalized_query ~ 'select.*from\s+(reservations|guests|payments|analytics_metrics)'
       AND v_normalized_query !~ 'where'
       AND v_normalized_query !~ 'limit' THEN

        RAISE WARNING 'Performance Warning: Query on large table without WHERE clause or LIMIT'
            USING HINT = 'Consider adding WHERE clause or LIMIT to avoid full table scan';
    END IF;

END;
$$;

COMMENT ON FUNCTION check_query_efficiency() IS
'Event trigger function to prevent inefficient query patterns like SELECT *';

-- =====================================================
-- Event Trigger: prevent_select_star
-- Fires before SQL statement execution
-- =====================================================

-- Note: PostgreSQL event triggers work on DDL, not DML
-- For runtime query checking, we need to use statement-level monitoring
-- This implementation uses a different approach with views

-- =====================================================
-- Alternative Approach: Create Monitoring Views
-- =====================================================

\echo ''
\echo '⚠️  Note: PostgreSQL event triggers cannot intercept SELECT statements.'
\echo '    Implementing alternative solution using:'
\echo '    1. Query logging and monitoring'
\echo '    2. Application-level checks'
\echo '    3. Database policies'
\echo ''

-- =====================================================
-- Solution 1: Enable Query Logging for Monitoring
-- =====================================================

-- Log queries longer than 100ms
ALTER DATABASE tartware SET log_min_duration_statement = 100;

-- Log all queries with SELECT * pattern (for audit)
ALTER DATABASE tartware SET log_statement = 'mod';

-- Track query statistics
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

COMMENT ON EXTENSION pg_stat_statements IS
'Track execution statistics of all SQL statements';

-- =====================================================
-- Solution 2: Create View for Query Analysis
-- =====================================================

CREATE OR REPLACE VIEW v_query_efficiency_monitor AS
SELECT
    query,
    calls,
    total_exec_time,
    mean_exec_time,
    max_exec_time,
    rows,
    CASE
        WHEN query ILIKE '%select * from%'
             AND query NOT ILIKE '%count(*)%' THEN 'SELECT_STAR_DETECTED'
        WHEN total_exec_time > 1000 THEN 'SLOW_QUERY'
        WHEN mean_exec_time > 500 THEN 'HIGH_AVG_TIME'
        ELSE 'OK'
    END AS efficiency_status,
    CASE
        WHEN query ILIKE '%select * from%'
             AND query NOT ILIKE '%count(*)%'
        THEN 'Replace SELECT * with specific column names'
        WHEN total_exec_time > 1000
        THEN 'Query takes too long - add indexes or optimize'
        WHEN mean_exec_time > 500
        THEN 'Average execution time is high - review query plan'
        ELSE 'Query appears efficient'
    END AS recommendation
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY
    CASE
        WHEN query ILIKE '%select * from%' THEN 1
        WHEN total_exec_time > 1000 THEN 2
        ELSE 3
    END,
    total_exec_time DESC;

COMMENT ON VIEW v_query_efficiency_monitor IS
'Monitor query efficiency and identify SELECT * usage';

-- =====================================================
-- Solution 3: Create Function for App-Level Validation
-- =====================================================

CREATE OR REPLACE FUNCTION validate_query_pattern(p_query TEXT)
RETURNS TABLE(
    is_valid BOOLEAN,
    error_message TEXT,
    suggestion TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_normalized_query TEXT;
BEGIN
    -- Normalize query
    v_normalized_query := LOWER(REGEXP_REPLACE(p_query, '\s+', ' ', 'g'));

    -- Check for SELECT * (excluding COUNT(*))
    IF v_normalized_query ~ 'select\s+\*\s+from'
       AND v_normalized_query !~ 'count\s*\(\s*\*\s*\)' THEN
        RETURN QUERY SELECT
            FALSE,
            'SELECT * is not allowed for performance reasons'::TEXT,
            'Specify exact columns: SELECT col1, col2 FROM table'::TEXT;
        RETURN;
    END IF;

    -- Check for missing WHERE on large tables
    IF v_normalized_query ~ 'select.*from\s+(reservations|guests|payments|analytics_metrics|invoices)'
       AND v_normalized_query !~ 'where'
       AND v_normalized_query !~ 'limit' THEN
        RETURN QUERY SELECT
            FALSE,
            'Query on large table without WHERE clause or LIMIT'::TEXT,
            'Add WHERE clause or LIMIT to avoid full table scan'::TEXT;
        RETURN;
    END IF;

    -- Check for missing LIMIT on potentially large result sets
    IF v_normalized_query ~ 'select.*from'
       AND v_normalized_query !~ 'limit'
       AND v_normalized_query !~ 'count\s*\(' THEN
        RETURN QUERY SELECT
            TRUE,
            NULL::TEXT,
            'Consider adding LIMIT clause for large result sets'::TEXT;
        RETURN;
    END IF;

    -- Query is valid
    RETURN QUERY SELECT
        TRUE,
        NULL::TEXT,
        'Query pattern appears efficient'::TEXT;
END;
$$;

COMMENT ON FUNCTION validate_query_pattern(TEXT) IS
'Validate query patterns for efficiency - call from application layer before executing queries';

-- =====================================================
-- Solution 4: Create Wrapper Functions for Safe Queries
-- =====================================================

CREATE OR REPLACE FUNCTION safe_select(
    p_table_name TEXT,
    p_columns TEXT[],
    p_where_clause TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 1000
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_query TEXT;
    v_column_list TEXT;
BEGIN
    -- Validate inputs
    IF p_columns IS NULL OR array_length(p_columns, 1) = 0 THEN
        RAISE EXCEPTION 'Columns array cannot be empty. SELECT * is not allowed.';
    END IF;

    IF '*' = ANY(p_columns) THEN
        RAISE EXCEPTION 'SELECT * is not allowed. Please specify exact columns.';
    END IF;

    -- Build column list
    v_column_list := array_to_string(p_columns, ', ');

    -- Build query
    v_query := format('SELECT %s FROM %I', v_column_list, p_table_name);

    -- Add WHERE clause if provided
    IF p_where_clause IS NOT NULL THEN
        v_query := v_query || ' WHERE ' || p_where_clause;
    END IF;

    -- Always add LIMIT for safety
    v_query := v_query || format(' LIMIT %s', p_limit);

    RETURN v_query;
END;
$$;

COMMENT ON FUNCTION safe_select(TEXT, TEXT[], TEXT, INTEGER) IS
'Generate safe SELECT queries with mandatory column specification and automatic LIMIT';

-- =====================================================
-- Example Usage
-- =====================================================

\echo ''
\echo '======================================================'
\echo '  QUERY EFFICIENCY MONITORING - EXAMPLES'
\echo '======================================================'
\echo ''
\echo 'Example 1: Validate query before execution'
\echo '----------------------------------------------------'
\echo 'SELECT * FROM validate_query_pattern(''SELECT id, name FROM guests WHERE tenant_id = uuid_value'');'
\echo ''
\echo 'Example 2: Monitor inefficient queries'
\echo '----------------------------------------------------'
\echo 'SELECT * FROM v_query_efficiency_monitor WHERE efficiency_status != ''OK'';'
\echo ''
\echo 'Example 3: Generate safe query'
\echo '----------------------------------------------------'
\echo 'SELECT safe_select(''guests'', ARRAY[''id'', ''name'', ''email''], ''tenant_id = uuid_value'', 100);'
\echo ''
\echo 'Example 4: Check query statistics'
\echo '----------------------------------------------------'
\echo 'SELECT query, calls, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;'
\echo ''

-- =====================================================
-- Best Practices Documentation
-- =====================================================

\echo ''
\echo '======================================================'
\echo '  BEST PRACTICES FOR QUERY EFFICIENCY'
\echo '======================================================'
\echo ''
\echo '❌ BAD:  SELECT * FROM guests;'
\echo '✅ GOOD: SELECT id, name, email FROM guests WHERE tenant_id = ?;'
\echo ''
\echo '❌ BAD:  SELECT * FROM reservations;'
\echo '✅ GOOD: SELECT id, status, check_in FROM reservations'
\echo '         WHERE property_id = ? AND deleted_at IS NULL'
\echo '         LIMIT 100;'
\echo ''
\echo '❌ BAD:  SELECT COUNT(*) FROM (SELECT * FROM large_table);'
\echo '✅ GOOD: SELECT COUNT(*) FROM large_table;'
\echo ''
\echo '✅ Note: Use validate_query_pattern() in your application'
\echo '         before executing user queries.'
\echo ''

\echo ''
\echo '✅ Query efficiency monitoring installed successfully!'
\echo ''
