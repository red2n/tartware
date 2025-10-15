-- =====================================================
-- 02_prevent_full_table_scans.sql
-- Prevent Full Table Scans on Large Tables
-- Date: 2025-10-15
--
-- Purpose: Warn or block queries that could cause
--          full table scans on large tables
-- =====================================================

\c tartware

-- =====================================================
-- Function: estimate_query_cost
-- Purpose: Estimate and validate query execution cost
-- =====================================================

CREATE OR REPLACE FUNCTION estimate_query_cost(p_query TEXT)
RETURNS TABLE(
    estimated_cost NUMERIC,
    estimated_rows BIGINT,
    is_efficient BOOLEAN,
    warning_message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_plan JSON;
    v_cost NUMERIC;
    v_rows BIGINT;
BEGIN
    -- Get query execution plan
    BEGIN
        EXECUTE format('EXPLAIN (FORMAT JSON) %s', p_query) INTO v_plan;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT
            NULL::NUMERIC,
            NULL::BIGINT,
            FALSE,
            'Error analyzing query: ' || SQLERRM;
        RETURN;
    END;

    -- Extract cost and rows from plan
    v_cost := (v_plan->0->'Plan'->>'Total Cost')::NUMERIC;
    v_rows := (v_plan->0->'Plan'->>'Plan Rows')::BIGINT;

    -- Determine if efficient
    RETURN QUERY SELECT
        v_cost,
        v_rows,
        CASE
            WHEN v_cost > 10000 THEN FALSE
            WHEN v_rows > 100000 THEN FALSE
            ELSE TRUE
        END,
        CASE
            WHEN v_cost > 10000 THEN format('High query cost: %s. Consider adding indexes or optimizing WHERE clause.', v_cost)
            WHEN v_rows > 100000 THEN format('Large result set: %s rows. Consider adding LIMIT or more restrictive WHERE clause.', v_rows)
            ELSE 'Query appears efficient'
        END;
END;
$$;

COMMENT ON FUNCTION estimate_query_cost(TEXT) IS
'Estimate query execution cost and validate efficiency';

-- =====================================================
-- Function: check_full_table_scan
-- Purpose: Detect if query will perform full table scan
-- =====================================================

CREATE OR REPLACE FUNCTION check_full_table_scan(p_query TEXT)
RETURNS TABLE(
    has_full_scan BOOLEAN,
    scan_type TEXT,
    table_name TEXT,
    warning TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_plan JSON;
    v_node_type TEXT;
    v_relation_name TEXT;
BEGIN
    -- Get query execution plan
    BEGIN
        EXECUTE format('EXPLAIN (FORMAT JSON) %s', p_query) INTO v_plan;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT
            TRUE,
            'ERROR'::TEXT,
            NULL::TEXT,
            'Error analyzing query: ' || SQLERRM;
        RETURN;
    END;

    -- Extract scan type from plan
    v_node_type := v_plan->0->'Plan'->>'Node Type';
    v_relation_name := v_plan->0->'Plan'->>'Relation Name';

    -- Check if it's a sequential scan
    IF v_node_type = 'Seq Scan' THEN
        RETURN QUERY SELECT
            TRUE,
            v_node_type,
            v_relation_name,
            format('Full table scan detected on table: %s. Consider adding indexes on WHERE clause columns.', v_relation_name);
    ELSE
        RETURN QUERY SELECT
            FALSE,
            v_node_type,
            v_relation_name,
            'Query uses index scan - efficient';
    END IF;
END;
$$;

COMMENT ON FUNCTION check_full_table_scan(TEXT) IS
'Check if query will perform a full table scan';

-- =====================================================
-- Function: suggest_query_optimization
-- Purpose: Provide optimization suggestions for queries
-- =====================================================

CREATE OR REPLACE FUNCTION suggest_query_optimization(p_query TEXT)
RETURNS TABLE(
    issue_type TEXT,
    severity TEXT,
    description TEXT,
    suggestion TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_normalized_query TEXT;
    v_plan JSON;
    v_cost NUMERIC;
BEGIN
    v_normalized_query := LOWER(REGEXP_REPLACE(p_query, '\s+', ' ', 'g'));

    -- Check for SELECT * (excluding COUNT(*))
    IF v_normalized_query ~ 'select\s+\*' AND v_normalized_query !~ 'count\s*\(\s*\*\s*\)' THEN
        RETURN QUERY SELECT
            'SELECT_STAR'::TEXT,
            'HIGH'::TEXT,
            'Query uses SELECT * which retrieves all columns'::TEXT,
            'Specify only the columns you need: SELECT col1, col2 FROM table'::TEXT;
    END IF;

    -- Check for missing WHERE clause on operational tables
    IF v_normalized_query ~ '(reservations|guests|payments|invoices|analytics_metrics)'
       AND v_normalized_query !~ 'where' THEN
        RETURN QUERY SELECT
            'NO_WHERE_CLAUSE'::TEXT,
            'HIGH'::TEXT,
            'Query on large table without WHERE clause - will scan entire table'::TEXT,
            'Add WHERE clause to filter records, especially tenant_id and deleted_at IS NULL'::TEXT;
    END IF;

    -- Check for missing LIMIT
    IF v_normalized_query ~ 'select.*from'
       AND v_normalized_query !~ 'limit'
       AND v_normalized_query !~ 'count\s*\(' THEN
        RETURN QUERY SELECT
            'NO_LIMIT'::TEXT,
            'MEDIUM'::TEXT,
            'Query without LIMIT could return large result sets'::TEXT,
            'Add LIMIT clause to prevent memory issues: LIMIT 1000'::TEXT;
    END IF;

    -- Check for OR conditions (less efficient than IN)
    IF v_normalized_query ~ 'where.*or.*or' THEN
        RETURN QUERY SELECT
            'MULTIPLE_OR'::TEXT,
            'MEDIUM'::TEXT,
            'Multiple OR conditions can prevent index usage'::TEXT,
            'Consider using IN clause: WHERE column IN (val1, val2, val3)'::TEXT;
    END IF;

    -- Check for NOT IN (can be slow)
    IF v_normalized_query ~ 'not\s+in' THEN
        RETURN QUERY SELECT
            'NOT_IN_CLAUSE'::TEXT,
            'MEDIUM'::TEXT,
            'NOT IN can be slow with large lists'::TEXT,
            'Consider using NOT EXISTS or LEFT JOIN with NULL check'::TEXT;
    END IF;

    -- Check for LIKE with leading wildcard
    IF v_normalized_query ~ 'like\s+''%' THEN
        RETURN QUERY SELECT
            'LEADING_WILDCARD'::TEXT,
            'HIGH'::TEXT,
            'LIKE with leading wildcard prevents index usage'::TEXT,
            'Use trailing wildcard (''text%'') or consider full-text search with pg_trgm'::TEXT;
    END IF;

    -- Check for functions in WHERE clause
    IF v_normalized_query ~ 'where.*(lower|upper|substr|date|extract)\s*\(' THEN
        RETURN QUERY SELECT
            'FUNCTION_IN_WHERE'::TEXT,
            'MEDIUM'::TEXT,
            'Functions in WHERE clause prevent index usage'::TEXT,
            'Create functional index or store computed values in separate column'::TEXT;
    END IF;

    -- Check for missing deleted_at filter (soft delete)
    IF v_normalized_query ~ 'from\s+\w+\s+(where|join|inner|left)'
       AND v_normalized_query !~ 'deleted_at' THEN
        RETURN QUERY SELECT
            'MISSING_SOFT_DELETE'::TEXT,
            'HIGH'::TEXT,
            'Query may include soft-deleted records'::TEXT,
            'Add WHERE deleted_at IS NULL to filter soft-deleted records'::TEXT;
    END IF;

    -- Check for missing tenant_id filter (multi-tenancy)
    IF v_normalized_query ~ 'from\s+(reservations|guests|properties|rooms|payments)'
       AND v_normalized_query !~ 'tenant_id' THEN
        RETURN QUERY SELECT
            'MISSING_TENANT_FILTER'::TEXT,
            'CRITICAL'::TEXT,
            'Query may expose data from other tenants!'::TEXT,
            'Always add WHERE tenant_id = ? for multi-tenant tables'::TEXT;
    END IF;

    -- If no issues found
    IF NOT FOUND THEN
        RETURN QUERY SELECT
            'NO_ISSUES'::TEXT,
            'INFO'::TEXT,
            'No obvious efficiency issues detected'::TEXT,
            'Query appears well-optimized'::TEXT;
    END IF;
END;
$$;

COMMENT ON FUNCTION suggest_query_optimization(TEXT) IS
'Analyze query and provide optimization suggestions';

-- =====================================================
-- View: Large Tables Monitoring
-- Purpose: Track tables that need special attention
-- =====================================================

CREATE OR REPLACE VIEW v_large_tables_monitor AS
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes,
    (SELECT reltuples::BIGINT FROM pg_class WHERE relname = tablename) AS estimated_rows,
    CASE
        WHEN pg_total_relation_size(schemaname||'.'||tablename) > 1073741824 THEN 'CRITICAL - Queries must have WHERE and LIMIT'
        WHEN pg_total_relation_size(schemaname||'.'||tablename) > 104857600 THEN 'HIGH - Queries should have WHERE clause'
        WHEN pg_total_relation_size(schemaname||'.'||tablename) > 10485760 THEN 'MEDIUM - Monitor query patterns'
        ELSE 'LOW - Standard queries OK'
    END AS risk_level,
    CASE
        WHEN tablename IN ('reservations', 'guests', 'payments', 'analytics_metrics')
        THEN 'Always use: WHERE tenant_id = ? AND deleted_at IS NULL LIMIT ?'
        ELSE 'Use appropriate WHERE clause'
    END AS required_pattern
FROM pg_tables
WHERE schemaname IN ('public', 'availability')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

COMMENT ON VIEW v_large_tables_monitor IS
'Monitor large tables and their required query patterns';

-- =====================================================
-- Example Usage
-- =====================================================

\echo ''
\echo '======================================================'
\echo '  FULL TABLE SCAN PREVENTION - EXAMPLES'
\echo '======================================================'
\echo ''
\echo 'Example 1: Check if query will do full table scan'
\echo '----------------------------------------------------'
\echo 'SELECT * FROM check_full_table_scan(''SELECT id, name FROM guests WHERE email = ''''test@example.com'''''');'
\echo ''
\echo 'Example 2: Estimate query cost'
\echo '----------------------------------------------------'
\echo 'SELECT * FROM estimate_query_cost(''SELECT id FROM reservations WHERE property_id = uuid_val LIMIT 100'');'
\echo ''
\echo 'Example 3: Get optimization suggestions'
\echo '----------------------------------------------------'
\echo 'SELECT * FROM suggest_query_optimization(''SELECT * FROM guests'');'
\echo ''
\echo 'Example 4: Monitor large tables'
\echo '----------------------------------------------------'
\echo 'SELECT * FROM v_large_tables_monitor WHERE risk_level LIKE ''%CRITICAL%'';'
\echo ''

\echo ''
\echo '✅ Full table scan prevention installed successfully!'
\echo ''
