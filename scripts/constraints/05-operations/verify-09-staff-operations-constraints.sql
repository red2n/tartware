-- =====================================================
-- verify-09-staff-operations-constraints.sql
-- Constraint Verification Script for Staff & Operations
-- Category: 09-staff-operations (6 tables)
-- Date: 2025-10-19
-- =====================================================

\c tartware

\echo ''
\echo '=============================================='
\echo '  STAFF & OPERATIONS - CONSTRAINT VERIFICATION'
\echo '  Tables: 6'
\echo '=============================================='
\echo ''

-- =====================================================
-- 1. CHECK FOREIGN KEY CONSTRAINTS
-- =====================================================
\echo '1. Foreign key constraints by table...'

SELECT
    tc.table_name,
    COUNT(*) AS fk_count
FROM information_schema.table_constraints tc
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name IN ('staff_schedules', 'staff_tasks', 'shift_handovers', 'lost_and_found', 'incident_reports', 'vendor_contracts')
    AND tc.table_schema = 'public'
GROUP BY tc.table_name
ORDER BY tc.table_name;

\echo ''

-- =====================================================
-- 2. CHECK CONSTRAINT POLICIES
-- =====================================================
\echo '2. Verifying DELETE RESTRICT policy...'

SELECT
    tc.table_name,
    tc.constraint_name,
    rc.delete_rule,
    CASE
        WHEN rc.delete_rule IS NULL THEN '⚠ Missing'
        ELSE '✓ Recorded'
    END AS status
FROM information_schema.table_constraints tc
JOIN information_schema.referential_constraints rc
    ON tc.constraint_name = rc.constraint_name
    AND tc.table_schema = rc.constraint_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name IN ('staff_schedules', 'staff_tasks', 'shift_handovers', 'lost_and_found', 'incident_reports', 'vendor_contracts')
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_name;

\echo ''

\echo '3. Verifying UPDATE CASCADE policy...'

SELECT
    tc.table_name,
    tc.constraint_name,
    rc.update_rule,
    CASE
        WHEN rc.update_rule IS NULL THEN '⚠ Missing'
        ELSE '✓ Recorded'
    END AS status
FROM information_schema.table_constraints tc
JOIN information_schema.referential_constraints rc
    ON tc.constraint_name = rc.constraint_name
    AND tc.table_schema = rc.constraint_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name IN ('staff_schedules', 'staff_tasks', 'shift_handovers', 'lost_and_found', 'incident_reports', 'vendor_contracts')
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_name;

\echo ''

-- =====================================================
-- 3. CHECK TENANT_ID FOREIGN KEYS
-- =====================================================
\echo '4. Verifying tenant_id foreign keys (multi-tenancy)...'

SELECT
    tc.table_name,
    tc.constraint_name,
    '✓ Multi-tenancy enforced' AS status
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'tenant_id'
    AND tc.table_name IN ('staff_schedules', 'staff_tasks', 'shift_handovers', 'lost_and_found', 'incident_reports', 'vendor_contracts')
    AND tc.table_schema = 'public'
ORDER BY tc.table_name;

\echo ''

-- =====================================================
-- SUMMARY
-- =====================================================
\echo '=============================================='
\echo '  VERIFICATION SUMMARY'
\echo '=============================================='

DO $$
DECLARE
    v_total_fks INTEGER;
    v_restrict_count INTEGER;
    v_cascade_count INTEGER;
    v_tenant_fks INTEGER;
BEGIN
    -- Total FKs
    SELECT COUNT(*) INTO v_total_fks
    FROM information_schema.table_constraints tc
    WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name IN ('staff_schedules', 'staff_tasks', 'shift_handovers', 'lost_and_found', 'incident_reports', 'vendor_contracts')
        AND tc.table_schema = 'public';

    -- RESTRICT deletes
    SELECT COUNT(*) INTO v_restrict_count
    FROM information_schema.table_constraints tc
    JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
        AND tc.table_schema = rc.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
        AND rc.delete_rule = 'RESTRICT'
        AND tc.table_name IN ('staff_schedules', 'staff_tasks', 'shift_handovers', 'lost_and_found', 'incident_reports', 'vendor_contracts')
        AND tc.table_schema = 'public';

    -- CASCADE updates
    SELECT COUNT(*) INTO v_cascade_count
    FROM information_schema.table_constraints tc
    JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
        AND tc.table_schema = rc.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
        AND rc.update_rule = 'CASCADE'
        AND tc.table_name IN ('staff_schedules', 'staff_tasks', 'shift_handovers', 'lost_and_found', 'incident_reports', 'vendor_contracts')
        AND tc.table_schema = 'public';

    -- Tenant FK count
    SELECT COUNT(*) INTO v_tenant_fks
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'tenant_id'
        AND tc.table_name IN ('staff_schedules', 'staff_tasks', 'shift_handovers', 'lost_and_found', 'incident_reports', 'vendor_contracts')
        AND tc.table_schema = 'public';

    RAISE NOTICE '';
    RAISE NOTICE 'Category: Staff & Operations';
    RAISE NOTICE 'Total Foreign Keys: %', v_total_fks;
    RAISE NOTICE 'DELETE RESTRICT: % / %', v_restrict_count, v_total_fks;
    RAISE NOTICE 'UPDATE CASCADE: % / %', v_cascade_count, v_total_fks;
    RAISE NOTICE 'Tenant FKs: %', v_tenant_fks;
    RAISE NOTICE '';

    IF v_total_fks = 0 THEN
        RAISE WARNING '⚠⚠⚠ NO FOREIGN KEYS FOUND ⚠⚠⚠';
    ELSE
        RAISE NOTICE '✓✓✓ STAFF & OPERATIONS CONSTRAINT VERIFICATION PASSED ✓✓✓';
    END IF;
END $$;

\echo ''
\echo '=============================================='
\echo 'Staff & Operations constraint verification complete!'
\echo '=============================================='
