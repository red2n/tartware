-- =====================================================
-- verify-14-system-audit-constraints.sql
-- Constraint Verification Script for System & Audit
-- Category: 14-system-audit (3 tables)
-- Date: 2025-10-19
-- =====================================================

\c tartware

\echo ''
\echo '=============================================='
\echo '  SYSTEM & AUDIT - CONSTRAINT VERIFICATION'
\echo '  Tables: 3'
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
    AND tc.table_name IN ('audit_logs', 'business_dates', 'night_audit_log')
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
        WHEN rc.delete_rule = 'RESTRICT' THEN '✓ Correct'
        ELSE '✗ Should be RESTRICT'
    END AS status
FROM information_schema.table_constraints tc
JOIN information_schema.referential_constraints rc
    ON tc.constraint_name = rc.constraint_name
    AND tc.table_schema = rc.constraint_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name IN ('audit_logs', 'business_dates', 'night_audit_log')
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_name;

\echo ''

\echo '3. Verifying UPDATE CASCADE policy...'

SELECT
    tc.table_name,
    tc.constraint_name,
    rc.update_rule,
    CASE
        WHEN rc.update_rule = 'CASCADE' THEN '✓ Correct'
        ELSE '✗ Should be CASCADE'
    END AS status
FROM information_schema.table_constraints tc
JOIN information_schema.referential_constraints rc
    ON tc.constraint_name = rc.constraint_name
    AND tc.table_schema = rc.constraint_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name IN ('audit_logs', 'business_dates', 'night_audit_log')
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
    AND tc.table_name IN ('audit_logs', 'business_dates', 'night_audit_log')
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
    FROM information_schema.table_constraints
    WHERE constraint_type = 'FOREIGN KEY'
        AND table_name IN ('audit_logs', 'business_dates', 'night_audit_log')
        AND tc.table_schema = 'public';

    -- RESTRICT deletes
    SELECT COUNT(*) INTO v_restrict_count
    FROM information_schema.table_constraints tc
    JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
        AND tc.table_schema = rc.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
        AND rc.delete_rule = 'RESTRICT'
        AND tc.table_name IN ('audit_logs', 'business_dates', 'night_audit_log')
        AND tc.table_schema = 'public';

    -- CASCADE updates
    SELECT COUNT(*) INTO v_cascade_count
    FROM information_schema.table_constraints tc
    JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
        AND tc.table_schema = rc.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
        AND rc.update_rule = 'CASCADE'
        AND tc.table_name IN ('audit_logs', 'business_dates', 'night_audit_log')
        AND tc.table_schema = 'public';

    -- Tenant FK count
    SELECT COUNT(*) INTO v_tenant_fks
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'tenant_id'
        AND tc.table_name IN ('audit_logs', 'business_dates', 'night_audit_log')
        AND tc.table_schema = 'public';

    RAISE NOTICE '';
    RAISE NOTICE 'Category: System & Audit';
    RAISE NOTICE 'Total Foreign Keys: %', v_total_fks;
    RAISE NOTICE 'DELETE RESTRICT: % (Expected: %)', v_restrict_count, v_total_fks;
    RAISE NOTICE 'UPDATE CASCADE: % (Expected: %)', v_cascade_count, v_total_fks;
    RAISE NOTICE 'Tenant FKs: %', v_tenant_fks;
    RAISE NOTICE '';

    IF v_restrict_count = v_total_fks AND v_cascade_count = v_total_fks THEN
        RAISE NOTICE '✓✓✓ SYSTEM & AUDIT CONSTRAINT VERIFICATION PASSED ✓✓✓';
    ELSE
        RAISE WARNING '⚠⚠⚠ SYSTEM & AUDIT CONSTRAINT POLICY VIOLATIONS FOUND ⚠⚠⚠';
    END IF;
END $$;

\echo ''
\echo '=============================================='
\echo 'System & Audit constraint verification complete!'
\echo '=============================================='
