-- =====================================================
-- 05_detect_excessive_indexes.sql
-- Detect Unused and Redundant Indexes
-- Date: 2025-10-15
--
-- Purpose: Find unused indexes, redundant indexes,
--          and provide recommendations for cleanup
-- =====================================================

\c tartware

-- =====================================================
-- Function: find_unused_indexes
-- Purpose: Identify indexes that are never used
-- =====================================================

CREATE OR REPLACE FUNCTION find_unused_indexes()
RETURNS TABLE(
    schema_name TEXT,
    table_name TEXT,
    index_name TEXT,
    index_size TEXT,
    index_scans BIGINT,
    rows_read BIGINT,
    last_index_scan TIMESTAMP,
    age_days INTEGER,
    waste_level TEXT,
    recommendation TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        schemaname::TEXT,
        relname::TEXT,
        indexrelname::TEXT,
        pg_size_pretty(pg_relation_size(indexrelid))::TEXT AS index_size,
        idx_scan AS index_scans,
        idx_tup_read AS rows_read,
        stats_reset AS last_index_scan,
        EXTRACT(DAY FROM CURRENT_TIMESTAMP - stats_reset)::INTEGER AS age_days,
        CASE
            WHEN pg_relation_size(indexrelid) > 104857600 -- 100MB
                AND idx_scan = 0
            THEN 'CRITICAL'
            WHEN pg_relation_size(indexrelid) > 10485760 -- 10MB
                AND idx_scan < 10
            THEN 'HIGH'
            WHEN idx_scan < 100
            THEN 'MEDIUM'
            ELSE 'LOW'
        END::TEXT AS waste_level,
        CASE
            WHEN idx_scan = 0
            THEN format('DROP INDEX CONCURRENTLY %I.%I; -- Never used, wasting %s',
                schemaname, indexrelname, pg_size_pretty(pg_relation_size(indexrelid)))
            WHEN idx_scan < 10
            THEN format('Consider dropping %I.%I - only %s scans, size: %s',
                schemaname, indexrelname, idx_scan, pg_size_pretty(pg_relation_size(indexrelid)))
            ELSE 'Monitor usage'
        END::TEXT AS recommendation
    FROM pg_stat_user_indexes
    WHERE schemaname IN ('public', 'availability')
        AND indexrelname NOT LIKE '%_pkey'  -- Exclude primary keys
    ORDER BY
        CASE
            WHEN idx_scan = 0 THEN 1
            WHEN idx_scan < 10 THEN 2
            ELSE 3
        END,
        pg_relation_size(indexrelid) DESC;
END;
$$;

COMMENT ON FUNCTION find_unused_indexes() IS
'Find indexes that are never or rarely used - candidates for removal';

-- =====================================================
-- Function: find_duplicate_indexes
-- Purpose: Find indexes that are redundant
-- =====================================================

CREATE OR REPLACE FUNCTION find_duplicate_indexes()
RETURNS TABLE(
    schema_name TEXT,
    table_name TEXT,
    index1_name TEXT,
    index1_columns TEXT,
    index1_size TEXT,
    index2_name TEXT,
    index2_columns TEXT,
    index2_size TEXT,
    redundancy_type TEXT,
    recommendation TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH index_details AS (
        SELECT
            schemaname,
            tablename,
            indexname,
            array_agg(attname ORDER BY attnum) AS index_columns,
            pg_relation_size(schemaname||'.'||indexname) AS index_size
        FROM pg_indexes
        JOIN pg_class ON pg_class.relname = indexname
        JOIN pg_index ON pg_index.indexrelid = pg_class.oid
        JOIN pg_attribute ON pg_attribute.attrelid = pg_index.indrelid
            AND pg_attribute.attnum = ANY(pg_index.indkey)
        WHERE schemaname IN ('public', 'availability')
        GROUP BY schemaname, tablename, indexname, pg_class.oid
    )
    SELECT
        i1.schemaname::TEXT,
        i1.tablename::TEXT,
        i1.indexname::TEXT,
        array_to_string(i1.index_columns, ', ')::TEXT,
        pg_size_pretty(i1.index_size)::TEXT,
        i2.indexname::TEXT,
        array_to_string(i2.index_columns, ', ')::TEXT,
        pg_size_pretty(i2.index_size)::TEXT,
        CASE
            WHEN i1.index_columns = i2.index_columns THEN 'EXACT DUPLICATE'
            WHEN i1.index_columns[1:array_length(i2.index_columns, 1)] = i2.index_columns
            THEN 'REDUNDANT (left covers right)'
            ELSE 'POTENTIAL OVERLAP'
        END::TEXT AS redundancy_type,
        format('Consider dropping smaller index: DROP INDEX CONCURRENTLY %I.%I;',
            CASE WHEN i1.index_size > i2.index_size THEN i2.schemaname ELSE i1.schemaname END,
            CASE WHEN i1.index_size > i2.index_size THEN i2.indexname ELSE i1.indexname END
        )::TEXT AS recommendation
    FROM index_details i1
    JOIN index_details i2
        ON i1.schemaname = i2.schemaname
        AND i1.tablename = i2.tablename
        AND i1.indexname < i2.indexname  -- Avoid duplicates
        AND (
            i1.index_columns = i2.index_columns  -- Exact duplicate
            OR i1.index_columns[1:array_length(i2.index_columns, 1)] = i2.index_columns  -- Redundant
            OR i2.index_columns[1:array_length(i1.index_columns, 1)] = i1.index_columns
        );
END;
$$;

COMMENT ON FUNCTION find_duplicate_indexes() IS
'Find duplicate and redundant indexes wasting space';

-- =====================================================
-- Function: analyze_index_efficiency
-- Purpose: Analyze overall index usage efficiency
-- =====================================================

CREATE OR REPLACE FUNCTION analyze_index_efficiency()
RETURNS TABLE(
    table_name TEXT,
    total_indexes INTEGER,
    unused_indexes INTEGER,
    total_index_size TEXT,
    unused_index_size TEXT,
    efficiency_score NUMERIC,
    status TEXT,
    recommendation TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH table_stats AS (
        SELECT
            relname,
            COUNT(*) AS total_idx,
            COUNT(*) FILTER (WHERE idx_scan = 0) AS unused_idx,
            SUM(pg_relation_size(indexrelid)) AS total_size,
            SUM(pg_relation_size(indexrelid)) FILTER (WHERE idx_scan = 0) AS unused_size
        FROM pg_stat_user_indexes
        WHERE schemaname IN ('public', 'availability')
            AND indexrelname NOT LIKE '%_pkey'
        GROUP BY relname
    )
    SELECT
        relname::TEXT,
        total_idx::INTEGER,
        unused_idx::INTEGER,
        pg_size_pretty(total_size)::TEXT,
        pg_size_pretty(COALESCE(unused_size, 0))::TEXT,
        ROUND(
            ((total_idx - COALESCE(unused_idx, 0))::NUMERIC /
             NULLIF(total_idx, 0)::NUMERIC) * 100,
            2
        ) AS efficiency_score,
        CASE
            WHEN unused_idx = 0 THEN '✅ EXCELLENT'
            WHEN unused_idx::NUMERIC / total_idx::NUMERIC > 0.5 THEN '❌ POOR'
            WHEN unused_idx::NUMERIC / total_idx::NUMERIC > 0.25 THEN '⚠️ FAIR'
            ELSE '✅ GOOD'
        END::TEXT AS status,
        CASE
            WHEN unused_idx = 0 THEN 'All indexes are being used'
            WHEN unused_idx::NUMERIC / total_idx::NUMERIC > 0.5
            THEN format('Remove %s unused indexes to improve write performance', unused_idx)
            WHEN unused_idx > 0
            THEN format('Review and remove %s unused indexes', unused_idx)
            ELSE 'No action needed'
        END::TEXT AS recommendation
    FROM table_stats
    WHERE total_idx > 0
    ORDER BY unused_idx DESC, total_size DESC;
END;
$$;

COMMENT ON FUNCTION analyze_index_efficiency() IS
'Analyze index usage efficiency per table';

-- =====================================================
-- View: Index Health Dashboard
-- =====================================================

CREATE OR REPLACE VIEW v_index_health_dashboard AS
SELECT
    schemaname,
    relname AS tablename,
    COUNT(*) AS total_indexes,
    COUNT(*) FILTER (WHERE idx_scan = 0) AS never_used,
    COUNT(*) FILTER (WHERE idx_scan < 10) AS rarely_used,
    COUNT(*) FILTER (WHERE idx_scan >= 10) AS actively_used,
    pg_size_pretty(SUM(pg_relation_size(indexrelid))) AS total_size,
    pg_size_pretty(
        SUM(pg_relation_size(indexrelid)) FILTER (WHERE idx_scan = 0)
    ) AS wasted_space,
    ROUND(
        AVG(idx_scan) FILTER (WHERE idx_scan > 0),
        0
    ) AS avg_scans_per_index
FROM pg_stat_user_indexes
WHERE schemaname IN ('public', 'availability')
    AND indexrelname NOT LIKE '%_pkey'
GROUP BY schemaname, relname
ORDER BY
    COUNT(*) FILTER (WHERE idx_scan = 0) DESC,
    SUM(pg_relation_size(indexrelid)) DESC;

COMMENT ON VIEW v_index_health_dashboard IS
'Overview of index health across all tables';

-- =====================================================
-- Function: calculate_write_penalty
-- Purpose: Estimate performance impact of indexes
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_write_penalty()
RETURNS TABLE(
    table_name TEXT,
    index_count INTEGER,
    total_index_size TEXT,
    estimated_write_overhead NUMERIC,
    severity TEXT,
    recommendation TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH table_indexes AS (
        SELECT
            relname,
            COUNT(*) AS idx_count,
            SUM(pg_relation_size(indexrelid)) AS idx_size
        FROM pg_stat_user_indexes
        WHERE schemaname IN ('public', 'availability')
        GROUP BY relname
    )
    SELECT
        relname::TEXT,
        idx_count::INTEGER,
        pg_size_pretty(idx_size)::TEXT,
        ROUND(idx_count * 5.0, 2) AS estimated_write_overhead,  -- ~5% per index
        CASE
            WHEN idx_count > 15 THEN 'CRITICAL'
            WHEN idx_count > 10 THEN 'HIGH'
            WHEN idx_count > 7 THEN 'MEDIUM'
            ELSE 'LOW'
        END::TEXT AS severity,
        CASE
            WHEN idx_count > 15
            THEN format('CRITICAL: %s indexes causing ~%s%% write overhead. Remove unused indexes immediately!',
                idx_count, ROUND(idx_count * 5.0, 0))
            WHEN idx_count > 10
            THEN format('HIGH: %s indexes may slow writes by ~%s%%. Review necessity.',
                idx_count, ROUND(idx_count * 5.0, 0))
            WHEN idx_count > 7
            THEN format('MEDIUM: %s indexes present. Monitor write performance.', idx_count)
            ELSE 'Index count is reasonable'
        END::TEXT AS recommendation
    FROM table_indexes
    ORDER BY idx_count DESC;
END;
$$;

COMMENT ON FUNCTION calculate_write_penalty() IS
'Estimate write performance penalty from excessive indexing';

-- =====================================================
-- Example Usage
-- =====================================================

\echo ''
\echo '======================================================'
\echo '  EXCESSIVE INDEXING DETECTION - EXAMPLES'
\echo '======================================================'
\echo ''
\echo 'Example 1: Find unused indexes'
\echo '----------------------------------------------------'
\echo 'SELECT * FROM find_unused_indexes() WHERE waste_level IN (''CRITICAL'', ''HIGH'');'
\echo ''
\echo 'Example 2: Find duplicate indexes'
\echo '----------------------------------------------------'
\echo 'SELECT * FROM find_duplicate_indexes();'
\echo ''
\echo 'Example 3: Analyze index efficiency by table'
\echo '----------------------------------------------------'
\echo 'SELECT * FROM analyze_index_efficiency() WHERE status != ''✅ EXCELLENT'';'
\echo ''
\echo 'Example 4: Check index health dashboard'
\echo '----------------------------------------------------'
\echo 'SELECT * FROM v_index_health_dashboard WHERE never_used > 0;'
\echo ''
\echo 'Example 5: Calculate write penalty'
\echo '----------------------------------------------------'
\echo 'SELECT * FROM calculate_write_penalty() WHERE severity IN (''CRITICAL'', ''HIGH'');'
\echo ''

\echo ''
\echo '======================================================'
\echo '  INDEX OPTIMIZATION GUIDELINES'
\echo '======================================================'
\echo ''
\echo '✅ Good:'
\echo '  • 3-7 indexes per table (typical)'
\echo '  • All indexes used regularly'
\echo '  • Indexes on foreign keys'
\echo '  • Indexes on WHERE/JOIN columns'
\echo ''
\echo '❌ Bad:'
\echo '  • >10 indexes per table'
\echo '  • Unused indexes (0 scans)'
\echo '  • Duplicate/redundant indexes'
\echo '  • Indexes on low-cardinality columns'
\echo ''
\echo '⚠️  Impact:'
\echo '  • Each index adds ~5% write overhead'
\echo '  • 15 indexes = ~75% slower writes!'
\echo '  • Indexes consume disk + memory'
\echo ''

\echo ''
\echo '✅ Excessive indexing detection installed successfully!'
\echo ''
