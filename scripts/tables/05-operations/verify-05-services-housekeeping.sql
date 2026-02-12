-- =====================================================
-- verify-05-services-housekeeping.sql
-- Verification Script for Services & Housekeeping Tables
-- Category: 05-services-housekeeping (11 tables)
-- Date: 2025-10-19
-- Updated: 2026-02-12
-- =====================================================

\c tartware

\echo ''
\echo '=============================================='
\echo '  CATEGORY: SERVICES & HOUSEKEEPING VERIFICATION'
\echo '  Tables: 11 | Description: Service delivery, housekeeping operations, spa, assets, minibar, maintenance'
\echo '=============================================='
\echo ''

-- =====================================================
-- 1. CHECK IF ALL TABLES EXIST
-- =====================================================
\echo '1. Checking if all 11 tables exist...'

DO $$
DECLARE
    v_expected_tables TEXT[] := ARRAY['services', 'reservation_services', 'housekeeping_tasks', 'maintenance_requests', 'maintenance_history', 'predictive_maintenance_alerts', 'spa_treatments', 'spa_appointments', 'asset_inventory', 'minibar_items', 'minibar_consumption'];
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
        RAISE EXCEPTION 'Services & Housekeeping verification FAILED - missing tables!';
    ELSE
        RAISE NOTICE '✓✓✓ All 11 Services & Housekeeping tables exist!';
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
WHERE t.table_name IN ('services', 'reservation_services', 'housekeeping_tasks', 'maintenance_requests', 'maintenance_history', 'predictive_maintenance_alerts', 'spa_treatments', 'spa_appointments', 'asset_inventory', 'minibar_items', 'minibar_consumption')
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
    WHERE t.table_name IN ('services', 'reservation_services', 'housekeeping_tasks', 'maintenance_requests', 'maintenance_history', 'predictive_maintenance_alerts', 'spa_treatments', 'spa_appointments', 'asset_inventory', 'minibar_items', 'minibar_consumption')
        AND t.table_schema = 'public';

    RAISE NOTICE '';
    RAISE NOTICE 'Category: Services & Housekeeping';
    RAISE NOTICE 'Tables Found: % / 11', v_table_count;
    RAISE NOTICE '';

    IF v_table_count = 11 THEN
        RAISE NOTICE '✓✓✓ SERVICES & HOUSEKEEPING VERIFICATION PASSED ✓✓✓';
    ELSE
        RAISE WARNING '⚠⚠⚠ SERVICES & HOUSEKEEPING VERIFICATION FAILED ⚠⚠⚠';
        RAISE WARNING 'Expected 11 tables, found %', v_table_count;
    END IF;
END $$;

\echo ''
\echo '=============================================='
\echo 'Services & Housekeeping verification complete!'
\echo '=============================================='
