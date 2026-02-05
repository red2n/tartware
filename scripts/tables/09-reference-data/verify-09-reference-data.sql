-- =====================================================
-- verify-09-reference-data.sql
-- Verification Script for Reference Data Lookup Tables
-- Category: 09-reference-data (6 tables)
-- Date: 2026-02-05
-- =====================================================

\c tartware

\echo ''
\echo '=============================================='
\echo '  CATEGORY: REFERENCE DATA VERIFICATION'
\echo '  Tables: 6 | Description: dynamic enum lookup tables'
\echo '=============================================='
\echo ''

-- =====================================================
-- 1. CHECK IF ALL TABLES EXIST
-- =====================================================
\echo '1. Checking if all 6 tables exist...'

DO $$
DECLARE
    v_expected_tables TEXT[] := ARRAY[
        'room_status_codes',
        'room_categories', 
        'rate_types',
        'payment_methods',
        'group_booking_types',
        'company_types'
    ];
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
        RAISE EXCEPTION 'Reference data verification FAILED - missing tables!';
    ELSE
        RAISE NOTICE '✓✓✓ All 6 Reference data tables exist!';
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
    COUNT(CASE WHEN c.column_name = 'is_system' THEN 1 END) AS has_system_flag,
    COUNT(CASE WHEN c.column_name = 'legacy_enum_value' THEN 1 END) AS has_legacy_map,
    COUNT(CASE WHEN c.column_name = 'deleted_at' THEN 1 END) AS has_soft_delete
FROM information_schema.tables t
LEFT JOIN information_schema.columns c
    ON t.table_schema = c.table_schema
    AND t.table_name = c.table_name
WHERE t.table_name IN (
    'room_status_codes',
    'room_categories',
    'rate_types',
    'payment_methods',
    'group_booking_types',
    'company_types'
)
AND t.table_schema = 'public'
GROUP BY t.table_schema, t.table_name
ORDER BY t.table_name;

\echo ''

-- =====================================================
-- 3. SYSTEM DEFAULT DATA CHECK
-- =====================================================
\echo '3. Checking system default data...'

DO $$
DECLARE
    v_room_status INTEGER;
    v_room_cat INTEGER;
    v_rate_types INTEGER;
    v_payment INTEGER;
    v_group INTEGER;
    v_company INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_room_status FROM room_status_codes WHERE is_system = TRUE;
    SELECT COUNT(*) INTO v_room_cat FROM room_categories WHERE is_system = TRUE;
    SELECT COUNT(*) INTO v_rate_types FROM rate_types WHERE is_system = TRUE;
    SELECT COUNT(*) INTO v_payment FROM payment_methods WHERE is_system = TRUE;
    SELECT COUNT(*) INTO v_group FROM group_booking_types WHERE is_system = TRUE;
    SELECT COUNT(*) INTO v_company FROM company_types WHERE is_system = TRUE;

    RAISE NOTICE '  room_status_codes:   % system defaults', v_room_status;
    RAISE NOTICE '  room_categories:     % system defaults', v_room_cat;
    RAISE NOTICE '  rate_types:          % system defaults', v_rate_types;
    RAISE NOTICE '  payment_methods:     % system defaults', v_payment;
    RAISE NOTICE '  group_booking_types: % system defaults', v_group;
    RAISE NOTICE '  company_types:       % system defaults', v_company;
    RAISE NOTICE '';
    RAISE NOTICE '  Total system defaults: %', 
        v_room_status + v_room_cat + v_rate_types + v_payment + v_group + v_company;

    IF v_room_status = 0 OR v_room_cat = 0 OR v_rate_types = 0 
       OR v_payment = 0 OR v_group = 0 OR v_company = 0 THEN
        RAISE WARNING '⚠ Some tables are missing system default data!';
    ELSE
        RAISE NOTICE '✓ All tables have system default data';
    END IF;
END $$;

\echo ''

-- =====================================================
-- 4. LEGACY ENUM MAPPING CHECK
-- =====================================================
\echo '4. Checking legacy enum mappings...'

SELECT 
    'room_status_codes' AS table_name,
    COUNT(*) FILTER (WHERE legacy_enum_value IS NOT NULL) AS mapped,
    COUNT(*) AS total
FROM room_status_codes WHERE is_system = TRUE
UNION ALL
SELECT 
    'room_categories',
    COUNT(*) FILTER (WHERE legacy_enum_value IS NOT NULL),
    COUNT(*)
FROM room_categories WHERE is_system = TRUE
UNION ALL
SELECT 
    'rate_types',
    COUNT(*) FILTER (WHERE legacy_enum_value IS NOT NULL),
    COUNT(*)
FROM rate_types WHERE is_system = TRUE
UNION ALL
SELECT 
    'payment_methods',
    COUNT(*) FILTER (WHERE legacy_enum_value IS NOT NULL),
    COUNT(*)
FROM payment_methods WHERE is_system = TRUE
UNION ALL
SELECT 
    'group_booking_types',
    COUNT(*) FILTER (WHERE legacy_enum_value IS NOT NULL),
    COUNT(*)
FROM group_booking_types WHERE is_system = TRUE
UNION ALL
SELECT 
    'company_types',
    COUNT(*) FILTER (WHERE legacy_enum_value IS NOT NULL),
    COUNT(*)
FROM company_types WHERE is_system = TRUE
ORDER BY table_name;

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
    v_total_rows INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_table_count
    FROM information_schema.tables t
    WHERE t.table_name IN (
        'room_status_codes',
        'room_categories',
        'rate_types',
        'payment_methods',
        'group_booking_types',
        'company_types'
    )
    AND t.table_schema = 'public';

    SELECT 
        (SELECT COUNT(*) FROM room_status_codes) +
        (SELECT COUNT(*) FROM room_categories) +
        (SELECT COUNT(*) FROM rate_types) +
        (SELECT COUNT(*) FROM payment_methods) +
        (SELECT COUNT(*) FROM group_booking_types) +
        (SELECT COUNT(*) FROM company_types)
    INTO v_total_rows;

    RAISE NOTICE '';
    RAISE NOTICE 'Category: Reference Data (Dynamic Enums)';
    RAISE NOTICE 'Tables Found: % / 6', v_table_count;
    RAISE NOTICE 'Total Rows: %', v_total_rows;
    RAISE NOTICE '';

    IF v_table_count = 6 THEN
        RAISE NOTICE '✓✓✓ REFERENCE DATA VERIFICATION PASSED ✓✓✓';
    ELSE
        RAISE WARNING '⚠⚠⚠ REFERENCE DATA VERIFICATION FAILED ⚠⚠⚠';
        RAISE WARNING 'Expected 6 tables, found %', v_table_count;
    END IF;
END $$;

\echo ''
\echo '=============================================='
\echo 'Reference data verification complete!'
\echo '=============================================='
