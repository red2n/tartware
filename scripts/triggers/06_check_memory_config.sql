-- =====================================================
-- 06_check_memory_config.sql
-- Check PostgreSQL Memory Configuration
-- Date: 2025-10-15
--
-- Purpose: Analyze memory settings and provide
--          optimization recommendations
-- =====================================================

\c tartware

-- =====================================================
-- Function: check_memory_configuration
-- Purpose: Analyze all memory-related settings
-- =====================================================

CREATE OR REPLACE FUNCTION check_memory_configuration()
RETURNS TABLE(
    setting_name TEXT,
    current_value TEXT,
    current_bytes BIGINT,
    recommended_value TEXT,
    status TEXT,
    impact TEXT,
    tuning_notes TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_total_ram_gb NUMERIC;
    v_shared_buffers_bytes BIGINT;
    v_work_mem_bytes BIGINT;
    v_maintenance_work_mem_bytes BIGINT;
    v_effective_cache_size_bytes BIGINT;
BEGIN
    -- Get total system RAM (approximate from shared_buffers if possible)
    -- This is a simplified calculation - in production, get from system
    v_total_ram_gb := 16;  -- Default assumption, should be detected from system

    -- Get current settings in bytes
    v_shared_buffers_bytes := pg_size_bytes(current_setting('shared_buffers'));
    v_work_mem_bytes := pg_size_bytes(current_setting('work_mem'));
    v_maintenance_work_mem_bytes := pg_size_bytes(current_setting('maintenance_work_mem'));
    v_effective_cache_size_bytes := pg_size_bytes(current_setting('effective_cache_size'));

    RETURN QUERY
    -- shared_buffers
    SELECT
        'shared_buffers'::TEXT,
        current_setting('shared_buffers')::TEXT,
        v_shared_buffers_bytes,
        format('%s GB (25%% of RAM)', ROUND(v_total_ram_gb * 0.25, 1))::TEXT,
        CASE
            WHEN v_shared_buffers_bytes >= (v_total_ram_gb * 1073741824 * 0.20) THEN '✅ GOOD'
            WHEN v_shared_buffers_bytes >= (v_total_ram_gb * 1073741824 * 0.10) THEN '⚠️ LOW'
            ELSE '❌ CRITICAL'
        END::TEXT,
        'Primary cache for data pages - Most important setting!'::TEXT,
        'Recommended: 25% of total RAM for dedicated DB server'::TEXT
    UNION ALL
    -- work_mem
    SELECT
        'work_mem'::TEXT,
        current_setting('work_mem')::TEXT,
        v_work_mem_bytes,
        '64MB - 256MB per operation'::TEXT,
        CASE
            WHEN v_work_mem_bytes >= 67108864 THEN '✅ GOOD'  -- 64MB
            WHEN v_work_mem_bytes >= 16777216 THEN '⚠️ LOW'   -- 16MB
            ELSE '❌ CRITICAL'
        END::TEXT,
        'Memory for sorts, joins, hash tables per operation'::TEXT,
        'Too low = disk sorts (slow). Too high = OOM risk with many concurrent queries'::TEXT
    UNION ALL
    -- maintenance_work_mem
    SELECT
        'maintenance_work_mem'::TEXT,
        current_setting('maintenance_work_mem')::TEXT,
        v_maintenance_work_mem_bytes,
        '512MB - 2GB'::TEXT,
        CASE
            WHEN v_maintenance_work_mem_bytes >= 536870912 THEN '✅ GOOD'  -- 512MB
            WHEN v_maintenance_work_mem_bytes >= 134217728 THEN '⚠️ LOW'   -- 128MB
            ELSE '❌ CRITICAL'
        END::TEXT,
        'Memory for VACUUM, CREATE INDEX, ALTER TABLE'::TEXT,
        'Higher = faster maintenance operations'::TEXT
    UNION ALL
    -- effective_cache_size
    SELECT
        'effective_cache_size'::TEXT,
        current_setting('effective_cache_size')::TEXT,
        v_effective_cache_size_bytes,
        format('%s GB (50-75%% of RAM)', ROUND(v_total_ram_gb * 0.65, 1))::TEXT,
        CASE
            WHEN v_effective_cache_size_bytes >= (v_total_ram_gb * 1073741824 * 0.50) THEN '✅ GOOD'
            WHEN v_effective_cache_size_bytes >= (v_total_ram_gb * 1073741824 * 0.25) THEN '⚠️ LOW'
            ELSE '❌ CRITICAL'
        END::TEXT,
        'Hint to planner about OS cache size - affects query plans'::TEXT,
        'Set to 50-75% of total RAM. Does not allocate memory, just informs planner.'::TEXT
    UNION ALL
    -- max_connections
    SELECT
        'max_connections'::TEXT,
        current_setting('max_connections')::TEXT,
        current_setting('max_connections')::BIGINT,
        '100-200 (use connection pooling!)'::TEXT,
        CASE
            WHEN current_setting('max_connections')::INTEGER <= 200 THEN '✅ GOOD'
            WHEN current_setting('max_connections')::INTEGER <= 500 THEN '⚠️ HIGH'
            ELSE '❌ TOO HIGH'
        END::TEXT,
        'Each connection uses memory - too many = OOM'::TEXT,
        'Use PgBouncer or app-level pooling instead of high max_connections'::TEXT;
END;
$$;

COMMENT ON FUNCTION check_memory_configuration() IS
'Analyze PostgreSQL memory settings and provide recommendations';

-- =====================================================
-- Function: calculate_memory_requirements
-- Purpose: Calculate recommended memory settings
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_memory_requirements(
    p_total_ram_gb NUMERIC DEFAULT 16,
    p_max_connections INTEGER DEFAULT 100
)
RETURNS TABLE(
    setting_name TEXT,
    recommended_value TEXT,
    calculation_basis TEXT,
    priority TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        'shared_buffers'::TEXT,
        format('%s GB', ROUND(p_total_ram_gb * 0.25, 1))::TEXT,
        format('25%% of %s GB total RAM', p_total_ram_gb)::TEXT,
        'CRITICAL'::TEXT
    UNION ALL
    SELECT
        'effective_cache_size'::TEXT,
        format('%s GB', ROUND(p_total_ram_gb * 0.65, 1))::TEXT,
        format('65%% of %s GB total RAM (hint for query planner)', p_total_ram_gb)::TEXT,
        'HIGH'::TEXT
    UNION ALL
    SELECT
        'maintenance_work_mem'::TEXT,
        CASE
            WHEN p_total_ram_gb >= 32 THEN '2GB'
            WHEN p_total_ram_gb >= 16 THEN '1GB'
            WHEN p_total_ram_gb >= 8 THEN '512MB'
            ELSE '256MB'
        END::TEXT,
        'Based on available RAM for maintenance operations'::TEXT,
        'MEDIUM'::TEXT
    UNION ALL
    SELECT
        'work_mem'::TEXT,
        format('%s MB',
            LEAST(
                256,  -- Cap at 256MB
                GREATEST(
                    16,  -- Minimum 16MB
                    ROUND((p_total_ram_gb * 1024 * 0.25) / p_max_connections, 0)
                )
            )
        )::TEXT,
        format('(25%% of RAM) / %s connections, capped at 256MB', p_max_connections)::TEXT,
        'HIGH'::TEXT
    UNION ALL
    SELECT
        'max_connections'::TEXT,
        '100-200 with connection pooling'::TEXT,
        'Use PgBouncer or app pooling to multiplex connections'::TEXT,
        'CRITICAL'::TEXT
    UNION ALL
    SELECT
        'wal_buffers'::TEXT,
        '16MB'::TEXT,
        'Default -1 (auto-tune) is usually fine, or set explicitly to 16MB'::TEXT,
        'LOW'::TEXT;
END;
$$;

COMMENT ON FUNCTION calculate_memory_requirements(NUMERIC, INTEGER) IS
'Calculate recommended memory settings based on available RAM';

-- =====================================================
-- Function: detect_memory_issues
-- Purpose: Identify active memory-related problems
-- =====================================================

CREATE OR REPLACE FUNCTION detect_memory_issues()
RETURNS TABLE(
    issue_type TEXT,
    severity TEXT,
    description TEXT,
    evidence TEXT,
    recommendation TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_shared_buffers_mb INTEGER;
    v_work_mem_kb INTEGER;
    v_max_connections INTEGER;
BEGIN
    -- Get current settings
    v_shared_buffers_mb := pg_size_bytes(current_setting('shared_buffers')) / 1048576;
    v_work_mem_kb := pg_size_bytes(current_setting('work_mem')) / 1024;
    v_max_connections := current_setting('max_connections')::INTEGER;

    -- Check for low shared_buffers
    IF v_shared_buffers_mb < 1024 THEN  -- Less than 1GB
        RETURN QUERY SELECT
            'LOW_SHARED_BUFFERS'::TEXT,
            'CRITICAL'::TEXT,
            'shared_buffers is critically low'::TEXT,
            format('Current: %s MB, Recommended: at least 4GB for production', v_shared_buffers_mb)::TEXT,
            'Increase shared_buffers to 25% of total RAM in postgresql.conf and restart PostgreSQL'::TEXT;
    END IF;

    -- Check for low work_mem
    IF v_work_mem_kb < 16384 THEN  -- Less than 16MB
        RETURN QUERY SELECT
            'LOW_WORK_MEM'::TEXT,
            'HIGH'::TEXT,
            'work_mem is too low - causing disk sorts'::TEXT,
            format('Current: %s KB, Recommended: at least 64MB', v_work_mem_kb)::TEXT,
            'Increase work_mem to 64-256MB, but monitor for OOM with high connection counts'::TEXT;
    END IF;

    -- Check for too many connections
    IF v_max_connections > 300 THEN
        RETURN QUERY SELECT
            'EXCESSIVE_CONNECTIONS'::TEXT,
            'HIGH'::TEXT,
            'max_connections is dangerously high'::TEXT,
            format('Current: %s connections, Each uses ~10MB base memory', v_max_connections)::TEXT,
            'Install PgBouncer or use application connection pooling. Reduce max_connections to 100-200.'::TEXT;
    END IF;

    -- Check for potential OOM risk
    IF (v_work_mem_kb * v_max_connections) > 8388608 THEN  -- 8GB total potential
        RETURN QUERY SELECT
            'OOM_RISK'::TEXT,
            'CRITICAL'::TEXT,
            'Potential Out-of-Memory (OOM) risk'::TEXT,
            format('work_mem (%s KB) × max_connections (%s) = %s GB potential memory use',
                v_work_mem_kb, v_max_connections,
                ROUND((v_work_mem_kb * v_max_connections)::NUMERIC / 1048576, 1))::TEXT,
            'Either reduce work_mem, reduce max_connections, or implement connection pooling'::TEXT;
    END IF;

    -- If no issues found
    IF NOT FOUND THEN
        RETURN QUERY SELECT
            'NO_ISSUES'::TEXT,
            'INFO'::TEXT,
            'No critical memory configuration issues detected'::TEXT,
            'Memory settings appear reasonable'::TEXT,
            'Continue monitoring memory usage and adjust as workload changes'::TEXT;
    END IF;
END;
$$;

COMMENT ON FUNCTION detect_memory_issues() IS
'Detect active memory configuration problems';

-- =====================================================
-- View: Memory Usage Summary
-- =====================================================

CREATE OR REPLACE VIEW v_memory_configuration_summary AS
SELECT
    name,
    setting,
    unit,
    CASE
        WHEN unit = '8kB' THEN pg_size_pretty((setting::BIGINT * 8192))
        WHEN unit = 'kB' THEN pg_size_pretty((setting::BIGINT * 1024))
        WHEN unit = 'MB' THEN pg_size_pretty((setting::BIGINT * 1048576))
        ELSE setting || COALESCE(' ' || unit, '')
    END AS formatted_value,
    context,
    short_desc
FROM pg_settings
WHERE name IN (
    'shared_buffers',
    'work_mem',
    'maintenance_work_mem',
    'effective_cache_size',
    'max_connections',
    'wal_buffers',
    'max_wal_size',
    'min_wal_size'
)
ORDER BY
    CASE name
        WHEN 'shared_buffers' THEN 1
        WHEN 'effective_cache_size' THEN 2
        WHEN 'work_mem' THEN 3
        WHEN 'maintenance_work_mem' THEN 4
        WHEN 'max_connections' THEN 5
        ELSE 6
    END;

COMMENT ON VIEW v_memory_configuration_summary IS
'Summary of important memory configuration settings';

-- =====================================================
-- Example Usage
-- =====================================================

\echo ''
\echo '======================================================'
\echo '  MEMORY CONFIGURATION CHECK - EXAMPLES'
\echo '======================================================'
\echo ''
\echo 'Example 1: Check current memory configuration'
\echo '----------------------------------------------------'
\echo 'SELECT * FROM check_memory_configuration();'
\echo ''
\echo 'Example 2: Calculate recommended settings'
\echo '----------------------------------------------------'
\echo 'SELECT * FROM calculate_memory_requirements(16, 100);  -- 16GB RAM, 100 connections'
\echo ''
\echo 'Example 3: Detect memory issues'
\echo '----------------------------------------------------'
\echo 'SELECT * FROM detect_memory_issues();'
\echo ''
\echo 'Example 4: View memory settings summary'
\echo '----------------------------------------------------'
\echo 'SELECT * FROM v_memory_configuration_summary;'
\echo ''

\echo ''
\echo '======================================================'
\echo '  POSTGRESQL MEMORY TUNING GUIDE'
\echo '======================================================'
\echo ''
\echo '📊 Key Settings (for 16GB RAM server):'
\echo ''
\echo '  shared_buffers = 4GB'
\echo '    └─ 25% of total RAM'
\echo '    └─ Primary cache for data blocks'
\echo '    └─ Requires restart to change'
\echo ''
\echo '  effective_cache_size = 10GB'
\echo '    └─ 60-75% of total RAM'
\echo '    └─ Hint to query planner (no actual allocation)'
\echo '    └─ Can change without restart'
\echo ''
\echo '  work_mem = 64MB'
\echo '    └─ Per operation (sort, hash, join)'
\echo '    └─ Multiply by max_connections for worst case'
\echo '    └─ 64MB * 100 = 6.4GB potential'
\echo ''
\echo '  maintenance_work_mem = 1GB'
\echo '    └─ For VACUUM, CREATE INDEX, etc.'
\echo '    └─ Higher = faster maintenance'
\echo ''
\echo '  max_connections = 100'
\echo '    └─ Use connection pooling!'
\echo '    └─ PgBouncer can multiplex 1000+ → 100'
\echo ''
\echo '⚠️  Common Mistakes:'
\echo '  • shared_buffers too low (default 128MB is 1990s era!)'
\echo '  • max_connections too high without pooling'
\echo '  • work_mem too high with many connections = OOM'
\echo '  • effective_cache_size not set (planner uses bad plans)'
\echo ''

\echo ''
\echo '✅ Memory configuration checker installed successfully!'
\echo ''
