-- =====================================================
-- verify-12-analytics-reporting.sql
-- Verification Script for Analytics & Reporting Tables
-- Category: 12-analytics-reporting (18 tables)
-- Date: 2025-10-19
-- Updated: 2026-02-12
-- =====================================================

\c tartware

\echo ''
\echo '=============================================='
\echo '  CATEGORY: ANALYTICS & REPORTING VERIFICATION'
\echo '  Tables: 18 | Description: Metrics, reports, performance, advanced analytics, sustainability'
\echo '=============================================='
\echo ''

-- =====================================================
-- 1. CHECK IF ALL TABLES EXIST
-- =====================================================
\echo '1. Checking if all 18 tables exist...'

DO $$
DECLARE
    v_expected_tables TEXT[] := ARRAY['analytics_metrics', 'analytics_metric_dimensions', 'analytics_reports', 'report_property_ids', 'performance_reports', 'report_schedules', 'performance_thresholds', 'performance_baselines', 'performance_alerts', 'alert_rules', 'guest_journey_tracking', 'revenue_attribution', 'forecasting_models', 'ab_test_results', 'sustainability_metrics', 'sustainability_initiatives', 'carbon_offset_programs', 'green_certifications'];
    v_table TEXT;
    v_missing_tables TEXT[] := '{}'::TEXT[];
    v_found_count INTEGER := 0;
BEGIN
    FOREACH v_table IN ARRAY v_expected_tables
    LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = v_table
        ) THEN
            v_found_count := v_found_count + 1;
            RAISE NOTICE '  ✓ % exists', v_table;
        ELSE
            v_missing_tables := array_append(v_missing_tables, v_table);
            RAISE WARNING '  ✗ % is MISSING', v_table;
        END IF;
    END LOOP;

    RAISE NOTICE '';
    IF array_length(v_missing_tables, 1) > 0 THEN
        RAISE WARNING 'Missing tables: %', array_to_string(v_missing_tables, ', ');
        RAISE EXCEPTION 'Analytics & Reporting verification FAILED - missing tables!';
    ELSE
        RAISE NOTICE '✓✓✓ All 18 Analytics & Reporting tables exist!';
    END IF;
END $$;

\echo ''

-- =====================================================
-- 2. CHECK TABLE STRUCTURE SUMMARY
-- =====================================================
\echo '2. Table structure summary...'

SELECT
    t.table_name,
    COUNT(c.column_name) AS column_count,
    COUNT(CASE WHEN c.column_name = 'tenant_id' THEN 1 END) AS has_tenant_id,
    COUNT(CASE WHEN c.column_name = 'is_deleted' THEN 1 END) AS has_soft_delete,
    COUNT(CASE WHEN c.column_name = 'created_at' THEN 1 END) AS has_audit
FROM information_schema.tables t
LEFT JOIN information_schema.columns c
    ON t.table_schema = c.table_schema
    AND t.table_name = c.table_name
WHERE t.table_name IN ('analytics_metrics', 'analytics_metric_dimensions', 'analytics_reports', 'report_property_ids', 'performance_reports', 'report_schedules', 'performance_thresholds', 'performance_baselines', 'performance_alerts', 'alert_rules', 'guest_journey_tracking', 'revenue_attribution', 'forecasting_models', 'ab_test_results', 'sustainability_metrics', 'sustainability_initiatives', 'carbon_offset_programs', 'green_certifications')
    AND t.table_schema = 'public'
GROUP BY t.table_schema, t.table_name
ORDER BY t.table_name;

\echo ''

-- =====================================================
-- SUMMARY
-- =====================================================
\echo '=============================================='
\echo '  VERIFICATION SUMMARY'
\echo '=============================================='

DO $$
DECLARE
    v_table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_table_count
    FROM information_schema.tables t
    WHERE t.table_name IN ('analytics_metrics', 'analytics_metric_dimensions', 'analytics_reports', 'report_property_ids', 'performance_reports', 'report_schedules', 'performance_thresholds', 'performance_baselines', 'performance_alerts', 'alert_rules', 'guest_journey_tracking', 'revenue_attribution', 'forecasting_models', 'ab_test_results', 'sustainability_metrics', 'sustainability_initiatives', 'carbon_offset_programs', 'green_certifications')
        AND t.table_schema = 'public';

    RAISE NOTICE '';
    RAISE NOTICE 'Category: Analytics & Reporting';
    RAISE NOTICE 'Tables Found: % / 18', v_table_count;
    RAISE NOTICE '';

    IF v_table_count = 18 THEN
        RAISE NOTICE '✓✓✓ ANALYTICS & REPORTING VERIFICATION PASSED ✓✓✓';
    ELSE
        RAISE WARNING '⚠⚠⚠ ANALYTICS & REPORTING VERIFICATION FAILED ⚠⚠⚠';
        RAISE WARNING 'Expected 18 tables, found %', v_table_count;
    END IF;
END $$;

\echo ''
\echo '=============================================='
\echo 'Analytics & Reporting verification complete!'
\echo '=============================================='
