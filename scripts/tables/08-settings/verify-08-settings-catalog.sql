-- =====================================================
-- verify-08-settings-catalog.sql
-- Verification Script for Settings Catalog Tables
-- Category: 08-settings (5 tables)
-- Date: 2026-01-22
-- =====================================================

\c tartware

\echo ''
\echo '=============================================='
\echo '  CATEGORY: SETTINGS CATALOG VERIFICATION'
\echo '  Tables: 5 | Description: settings catalog and values'
\echo '=============================================='
\echo ''

-- =====================================================
-- 1. CHECK IF ALL TABLES EXIST
-- =====================================================
\echo '1. Checking if all 5 tables exist...'

DO $$
DECLARE
    v_expected_tables TEXT[] := ARRAY['settings_categories', 'settings_sections', 'settings_definitions', 'settings_options', 'settings_values'];
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
        RAISE EXCEPTION 'Settings catalog verification FAILED - missing tables!';
    ELSE
        RAISE NOTICE '✓✓✓ All 5 Settings catalog tables exist!';
    END IF;
END $$;

\echo ''

-- =====================================================
-- 2. TABLE STRUCTURE SUMMARY
-- =====================================================
\echo '2. Table structure summary...'

SELECT
    t.table_name,
    COUNT(c.column_name) AS column_count,
    COUNT(CASE WHEN c.column_name = 'tenant_id' THEN 1 END) AS has_tenant_id,
    COUNT(CASE WHEN c.column_name = 'created_at' THEN 1 END) AS has_audit
FROM information_schema.tables t
LEFT JOIN information_schema.columns c
    ON t.table_schema = c.table_schema
    AND t.table_name = c.table_name
WHERE t.table_name IN ('settings_categories', 'settings_sections', 'settings_definitions', 'settings_options', 'settings_values')
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
    WHERE t.table_name IN ('settings_categories', 'settings_sections', 'settings_definitions', 'settings_options', 'settings_values')
        AND t.table_schema = 'public';

    RAISE NOTICE '';
    RAISE NOTICE 'Category: Settings Catalog';
    RAISE NOTICE 'Tables Found: % / 5', v_table_count;
    RAISE NOTICE '';

    IF v_table_count = 5 THEN
        RAISE NOTICE '✓✓✓ SETTINGS CATALOG VERIFICATION PASSED ✓✓✓';
    ELSE
        RAISE WARNING '⚠⚠⚠ SETTINGS CATALOG VERIFICATION FAILED ⚠⚠⚠';
        RAISE WARNING 'Expected 5 tables, found %', v_table_count;
    END IF;
END $$;

\echo ''
\echo '=============================================='
\echo 'Settings catalog verification complete!'
\echo '=============================================='
