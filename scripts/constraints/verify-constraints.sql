-- =====================================================
-- verify-constraints.sql
-- Verify Foreign Key Constraints
-- Date: 2025-10-21
--
-- Purpose: Validate all foreign key constraints are created correctly
-- Updated: Now supports 132 tables (89 core + 43 advanced)
-- =====================================================

\c tartware

\echo '=============================================='
\echo '  FOREIGN KEY CONSTRAINT VERIFICATION'
\echo '=============================================='
\echo ''

-- =====================================================
-- 1. CHECK CONSTRAINT COUNT BY TABLE
-- =====================================================
\echo '1. Foreign Key Constraints by Table:'
\echo '--------------------------------------------'

SELECT
    COALESCE(tc.table_schema || '.' || tc.table_name, 'TOTAL') as table_name,
    COUNT(*) as constraint_count
FROM information_schema.table_constraints tc
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema IN ('public', 'availability')
GROUP BY ROLLUP(tc.table_schema, tc.table_name)
ORDER BY tc.table_schema, tc.table_name;

\echo ''

-- =====================================================
-- 2. DETAILED CONSTRAINT INFORMATION
-- =====================================================
\echo '2. Detailed Foreign Key Constraints:'
\echo '--------------------------------------------'

SELECT
    tc.table_schema || '.' || tc.table_name as table_name,
    tc.constraint_name,
    kcu.column_name,
    ccu.table_schema || '.' || ccu.table_name as references_table,
    ccu.column_name as references_column,
    rc.update_rule,
    rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints rc
    ON tc.constraint_name = rc.constraint_name
    AND tc.table_schema = rc.constraint_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema IN ('public', 'availability')
ORDER BY tc.table_name, tc.constraint_name;

\echo ''

-- =====================================================
-- 3. VERIFY DELETE RULE POLICY (ALL SHOULD BE RESTRICT)
-- =====================================================
\echo '3. Verify DELETE RESTRICT Policy:'
\echo '--------------------------------------------'

WITH constraint_policies AS (
    SELECT
        tc.table_name,
        tc.constraint_name,
        rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
        AND tc.table_schema = rc.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema IN ('public', 'availability')
)
SELECT
    delete_rule,
    COUNT(*) as count,
    CASE
        WHEN delete_rule = 'RESTRICT' THEN '✓ CORRECT'
        ELSE '✗ INCORRECT - Should be RESTRICT'
    END as status
FROM constraint_policies
GROUP BY delete_rule;

\echo ''

-- =====================================================
-- 4. VERIFY UPDATE RULE POLICY (ALL SHOULD BE CASCADE)
-- =====================================================
\echo '4. Verify UPDATE CASCADE Policy:'
\echo '--------------------------------------------'

WITH constraint_policies AS (
    SELECT
        tc.table_name,
        tc.constraint_name,
        rc.update_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
        AND tc.table_schema = rc.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema IN ('public', 'availability')
)
SELECT
    update_rule,
    COUNT(*) as count,
    CASE
        WHEN update_rule = 'CASCADE' THEN '✓ CORRECT'
        ELSE '✗ INCORRECT - Should be CASCADE'
    END as status
FROM constraint_policies
GROUP BY update_rule;

\echo ''

-- =====================================================
-- 5. CHECK FOR MISSING CONSTRAINTS (EXPECTED TABLES)
-- =====================================================
\echo '5. Tables Without Foreign Keys (Check if Expected):'
\echo '--------------------------------------------'

SELECT
    t.table_schema || '.' || t.table_name as table_name,
    CASE
        WHEN t.table_name IN ('tenants') THEN '✓ Root table - no FK expected'
        WHEN t.table_name IN ('users') THEN '✓ Root table - no FK expected'
        ELSE '⚠ May need foreign keys'
    END as status
FROM information_schema.tables t
LEFT JOIN information_schema.table_constraints tc
    ON t.table_name = tc.table_name
    AND t.table_schema = tc.table_schema
    AND tc.constraint_type = 'FOREIGN KEY'
WHERE t.table_schema IN ('public', 'availability')
    AND t.table_type = 'BASE TABLE'
    AND tc.constraint_name IS NULL
ORDER BY t.table_schema, t.table_name;

\echo ''

-- =====================================================
-- 6. CHECK TENANT_ID FOREIGN KEYS (MULTI-TENANCY)
-- =====================================================
\echo '6. Verify tenant_id Foreign Keys (Multi-tenancy):'
\echo '--------------------------------------------'

SELECT
    tc.table_schema || '.' || tc.table_name as table_name,
    tc.constraint_name,
    'tenant_id → tenants.id' as relationship,
    '✓ Multi-tenancy enforced' as status
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'tenant_id'
    AND tc.table_schema IN ('public', 'availability')
ORDER BY tc.table_name;

\echo ''

-- =====================================================
-- 7. ORPHANED RECORDS CHECK
-- =====================================================
\echo '7. Check for Orphaned Records:'
\echo '--------------------------------------------'

DO $$
DECLARE
    orphan_count INTEGER;
    has_orphans BOOLEAN := FALSE;
BEGIN
    -- Check user_tenant_associations
    SELECT COUNT(*) INTO orphan_count
    FROM user_tenant_associations uta
    WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = uta.user_id)
       OR NOT EXISTS (SELECT 1 FROM tenants WHERE id = uta.tenant_id);

    IF orphan_count > 0 THEN
        RAISE NOTICE '✗ user_tenant_associations: % orphaned records', orphan_count;
        has_orphans := TRUE;
    END IF;

    -- Check properties
    SELECT COUNT(*) INTO orphan_count
    FROM properties p
    WHERE NOT EXISTS (SELECT 1 FROM tenants WHERE id = p.tenant_id);

    IF orphan_count > 0 THEN
        RAISE NOTICE '✗ properties: % orphaned records', orphan_count;
        has_orphans := TRUE;
    END IF;

    -- Check guests
    SELECT COUNT(*) INTO orphan_count
    FROM guests g
    WHERE NOT EXISTS (SELECT 1 FROM tenants WHERE id = g.tenant_id);

    IF orphan_count > 0 THEN
        RAISE NOTICE '✗ guests: % orphaned records', orphan_count;
        has_orphans := TRUE;
    END IF;

    IF NOT has_orphans THEN
        RAISE NOTICE '✓ No orphaned records found';
    END IF;
END $$;

\echo ''

-- =====================================================
-- 8. CONSTRAINT NAMING CONVENTION CHECK
-- =====================================================
\echo '8. Verify Constraint Naming Convention:'
\echo '--------------------------------------------'

SELECT
    tc.table_name,
    tc.constraint_name,
    CASE
        WHEN tc.constraint_name ~ '^fk_[a-z_]+_[a-z_]+$' THEN '✓ Correct'
        ELSE '✗ Incorrect naming'
    END as naming_convention
FROM information_schema.table_constraints tc
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema IN ('public', 'availability')
ORDER BY
    CASE
        WHEN tc.constraint_name ~ '^fk_[a-z_]+_[a-z_]+$' THEN 0
        ELSE 1
    END,
    tc.table_name;

\echo ''

-- =====================================================
-- SUMMARY
-- =====================================================
\echo '=============================================='
\echo '  VERIFICATION SUMMARY'
\echo '=============================================='

DO $$
DECLARE
    total_fks INTEGER;
    restrict_count INTEGER;
    cascade_count INTEGER;
BEGIN
    -- Total FKs
    SELECT COUNT(*) INTO total_fks
    FROM information_schema.table_constraints
    WHERE constraint_type = 'FOREIGN KEY'
        AND table_schema IN ('public', 'availability');

    -- RESTRICT deletes
    SELECT COUNT(*) INTO restrict_count
    FROM information_schema.table_constraints tc
    JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
        AND tc.table_schema = rc.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
        AND rc.delete_rule = 'RESTRICT'
        AND tc.table_schema IN ('public', 'availability');

    -- CASCADE updates
    SELECT COUNT(*) INTO cascade_count
    FROM information_schema.table_constraints tc
    JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
        AND tc.table_schema = rc.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
        AND rc.update_rule = 'CASCADE'
        AND tc.table_schema IN ('public', 'availability');

    RAISE NOTICE '';
    RAISE NOTICE 'Total Foreign Keys: %', total_fks;
    RAISE NOTICE 'DELETE RESTRICT: % (Expected: %)', restrict_count, total_fks;
    RAISE NOTICE 'UPDATE CASCADE: % (Expected: %)', cascade_count, total_fks;
    RAISE NOTICE '';

    IF restrict_count = total_fks AND cascade_count = total_fks THEN
        RAISE NOTICE '✓✓✓ ALL CONSTRAINTS CORRECT ✓✓✓';
    ELSE
        RAISE NOTICE '✗✗✗ CONSTRAINT POLICY VIOLATIONS FOUND ✗✗✗';
    END IF;
END $$;

\echo ''
\echo '=============================================='
\echo 'Verification complete!'
\echo '=============================================='
