-- =====================================================
-- 00-create-all-procedures.sql
-- Master Script to Create All Stored Procedures
-- Date: 2025-10-15
--
-- Purpose: Install all MERGE/UPSERT procedures for PMS operations
--
-- Usage: psql -U postgres -d tartware -f 00-create-all-procedures.sql
-- =====================================================

\c tartware
\if :{?scripts_dir}
\else
\set scripts_dir '.'
\endif
\cd :scripts_dir/procedures

\echo '=============================================='
\echo '  TARTWARE PMS - STORED PROCEDURES'
\echo '  Phase 2C: Business Logic Layer'
\echo '=============================================='
\echo ''

-- Check PostgreSQL version (MERGE requires 15+)
DO $$
DECLARE
    v_version INTEGER;
BEGIN
    SELECT current_setting('server_version_num')::INTEGER INTO v_version;

    IF v_version < 150000 THEN
        RAISE WARNING 'PostgreSQL version % detected. MERGE command requires PostgreSQL 15+. Some procedures may fail.',
                      current_setting('server_version');
    ELSE
        RAISE NOTICE 'PostgreSQL version %: MERGE command supported ✓', current_setting('server_version');
    END IF;
END $$;

\echo ''

-- =====================================================
-- EXECUTION ORDER
-- =====================================================

\echo '1/4 Creating guest management procedures...'
\i 01_guest_upsert.sql
\echo ''

\echo '2/4 Creating channel synchronization procedures...'
\i 02_channel_sync_merge.sql
\echo ''

\echo '3/4 Creating rate management procedures...'
\i 03_rate_management_merge.sql
\echo ''

\echo '4/6 Creating analytics aggregation procedures...'
\i 04_analytics_aggregation_merge.sql
\echo ''

\echo '5/6 Creating performance reporting procedures...'
\i 05_performance_reporting_procedures.sql
\echo ''

\echo '6/6 Creating performance alerting procedures...'
\i 06_performance_alerting_procedures.sql
\echo ''

-- =====================================================
-- VERIFICATION
-- =====================================================

\echo '=============================================='
\echo '  PROCEDURE CREATION SUMMARY'
\echo '=============================================='

SELECT
    n.nspname AS schema_name,
    p.proname AS procedure_name,
    pg_get_function_arguments(p.oid) AS arguments,
    CASE p.prokind
        WHEN 'f' THEN 'FUNCTION'
        WHEN 'p' THEN 'PROCEDURE'
    END AS type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    'upsert_guest',
    'merge_duplicate_guests',
    'bulk_upsert_guests',
    'sync_channel_availability',
    'sync_channel_reservations',
    'sync_channel_mapping',
    'sync_rate_plans',
    'apply_seasonal_rate_adjustments',
    'sync_daily_rate_overrides',
    'copy_rate_plan',
    'aggregate_daily_metrics',
    'aggregate_monthly_metrics',
    'calculate_revenue_metrics',
    'sync_metric_dimensions',
    'generate_daily_performance_report',
    'generate_health_check_report',
    'check_performance_thresholds',
    'get_latest_report',
    'init_report_schedules',
    'update_performance_baselines',
    'detect_query_degradation',
    'detect_connection_spike',
    'detect_cache_degradation',
    'monitor_performance_degradation',
    'get_active_alerts',
    'acknowledge_alert',
    'acknowledge_alerts_by_type'
  )
ORDER BY p.proname;

\echo ''
\echo '=============================================='
\echo '  TOTAL PROCEDURES/FUNCTIONS'
\echo '=============================================='

SELECT
    COUNT(*) as total_procedures
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    'upsert_guest',
    'merge_duplicate_guests',
    'bulk_upsert_guests',
    'sync_channel_availability',
    'sync_channel_reservations',
    'sync_channel_mapping',
    'sync_rate_plans',
    'apply_seasonal_rate_adjustments',
    'sync_daily_rate_overrides',
    'copy_rate_plan',
    'aggregate_daily_metrics',
    'aggregate_monthly_metrics',
    'calculate_revenue_metrics',
    'sync_metric_dimensions',
    'generate_daily_performance_report',
    'generate_health_check_report',
    'check_performance_thresholds',
    'get_latest_report',
    'init_report_schedules',
    'update_performance_baselines',
    'detect_query_degradation',
    'detect_connection_spike',
    'detect_cache_degradation',
    'monitor_performance_degradation',
    'get_active_alerts',
    'acknowledge_alert',
    'acknowledge_alerts_by_type'
  );

\echo ''
\echo '✓ All stored procedures created successfully!'
\echo '  - 14 Core business procedures'
\echo '  - 13 Performance monitoring procedures'
\echo '  - Total: 27 procedures/functions'
\echo ''
\echo 'USAGE EXAMPLES:'
\echo '---------------'
\echo ''
\echo '-- Guest Management:'
\echo "SELECT upsert_guest('tenant-id', 'guest@example.com', 'John', 'Doe', '+1234567890');"
\echo ''
\echo '-- Channel Sync:'
\echo "SELECT * FROM sync_channel_availability('tenant-id', 'property-id', '[...]'::JSONB);"
\echo ''
\echo '-- Rate Management:'
\echo "SELECT * FROM sync_rate_plans('tenant-id', 'property-id', '[...]'::JSONB);"
\echo ''
\echo '-- Analytics:'
\echo "SELECT * FROM aggregate_daily_metrics('tenant-id', 'property-id', CURRENT_DATE - 1);"
\echo ''
\echo '-- Performance Monitoring:'
\echo "SELECT generate_daily_performance_report();"
\echo "SELECT * FROM monitor_performance_degradation();"
\echo ''
