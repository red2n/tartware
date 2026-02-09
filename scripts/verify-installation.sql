-- =====================================================
-- verify-installation.sql
-- Verification script for database setup
-- Run this after executing 00-master-install.sh
-- Date: 2025-10-21
-- =====================================================

\c tartware

\echo ''
\echo '============================================='
\echo 'TARTWARE PMS - INSTALLATION VERIFICATION'
\echo '============================================='
\echo ''

-- Check Extensions
\echo '1. CHECKING EXTENSIONS:'
\echo '-------------------------------------------'
SELECT extname AS extension_name, extversion AS version
FROM pg_extension
WHERE extname = 'uuid-ossp';
\echo ''

-- Check Schemas
\echo '2. CHECKING SCHEMAS:'
\echo '-------------------------------------------'
SELECT schema_name
FROM information_schema.schemata
WHERE schema_name IN ('public', 'availability')
ORDER BY schema_name;
\echo ''

-- Check ENUM Types
\echo '3. CHECKING ENUM TYPES:'
\echo '-------------------------------------------'
SELECT
    typname AS enum_name,
    count(enumlabel) AS value_count
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE typtype = 'e'
GROUP BY typname
ORDER BY typname;
\echo ''

-- Count Tables
\echo '4. CHECKING TABLES:'
\echo '-------------------------------------------'
SELECT
    schemaname AS schema,
    count(*) AS table_count
FROM pg_tables
WHERE schemaname IN ('public', 'availability')
GROUP BY schemaname
ORDER BY schemaname;
\echo ''

-- List All Tables
\echo '5. TABLE LIST:'
\echo '-------------------------------------------'
SELECT
    schemaname AS schema,
    tablename AS table_name
FROM pg_tables
WHERE schemaname IN ('public', 'availability')
ORDER BY schemaname, tablename;
\echo ''

-- Check Table Constraints
\echo '6. CONSTRAINT SUMMARY:'
\echo '-------------------------------------------'
SELECT
    contype AS constraint_type,
    CASE contype
        WHEN 'c' THEN 'CHECK'
        WHEN 'f' THEN 'FOREIGN KEY'
        WHEN 'p' THEN 'PRIMARY KEY'
        WHEN 'u' THEN 'UNIQUE'
        WHEN 't' THEN 'TRIGGER'
        WHEN 'x' THEN 'EXCLUSION'
    END AS type_name,
    count(*) AS count
FROM pg_constraint
WHERE connamespace IN (
    SELECT oid FROM pg_namespace WHERE nspname IN ('public', 'availability')
)
GROUP BY contype
ORDER BY contype;
\echo ''

-- Check for Data
\echo '7. ROW COUNT PER TABLE:'
\echo '-------------------------------------------'
DO $$
DECLARE
    rec RECORD;
    row_count INTEGER;
BEGIN
    FOR rec IN
        SELECT schemaname, tablename
        FROM pg_tables
        WHERE schemaname IN ('public', 'availability')
        ORDER BY schemaname, tablename
    LOOP
        EXECUTE format('SELECT count(*) FROM %I.%I', rec.schemaname, rec.tablename) INTO row_count;
        RAISE NOTICE '%.%: % rows', rec.schemaname, rec.tablename, row_count;
    END LOOP;
END $$;
\echo ''

-- Summary
\echo '============================================='
\echo 'VERIFICATION COMPLETE!'
\echo '============================================='
\echo ''

-- =====================================================
-- 8. INDUSTRY STANDARDS VALIDATION
-- =====================================================
\echo '8. INDUSTRY STANDARDS VALIDATION:'
\echo '-------------------------------------------'

DO $$
DECLARE
    v_pass INTEGER := 0;
    v_fail INTEGER := 0;
    v_enum_vals TEXT[];
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '--- Enum Enhancements ---';

    -- Check reservation_status has INQUIRY, QUOTED, EXPIRED, WAITLISTED
    SELECT array_agg(enumlabel ORDER BY enumsortorder) INTO v_enum_vals
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'reservation_status';

    IF v_enum_vals @> ARRAY['INQUIRY', 'QUOTED', 'EXPIRED', 'WAITLISTED'] THEN
        RAISE NOTICE '  ✓ reservation_status has INQUIRY, QUOTED, EXPIRED, WAITLISTED';
        v_pass := v_pass + 1;
    ELSE
        RAISE WARNING '  ✗ reservation_status missing new values';
        v_fail := v_fail + 1;
    END IF;

    -- Check payment_status has AUTHORIZED
    SELECT array_agg(enumlabel ORDER BY enumsortorder) INTO v_enum_vals
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'payment_status';

    IF v_enum_vals @> ARRAY['AUTHORIZED'] THEN
        RAISE NOTICE '  ✓ payment_status has AUTHORIZED';
        v_pass := v_pass + 1;
    ELSE
        RAISE WARNING '  ✗ payment_status missing AUTHORIZED';
        v_fail := v_fail + 1;
    END IF;

    -- Check invoice_status has FINALIZED
    SELECT array_agg(enumlabel ORDER BY enumsortorder) INTO v_enum_vals
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'invoice_status';

    IF v_enum_vals @> ARRAY['FINALIZED'] THEN
        RAISE NOTICE '  ✓ invoice_status has FINALIZED';
        v_pass := v_pass + 1;
    ELSE
        RAISE WARNING '  ✗ invoice_status missing FINALIZED';
        v_fail := v_fail + 1;
    END IF;

    RAISE NOTICE '';
    RAISE NOTICE '--- Reservations Table Enhancements ---';

    -- Check reservations has reservation_type, eta, company_id, travel_agent_id
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'reservations'
        AND column_name = 'reservation_type'
    ) THEN
        RAISE NOTICE '  ✓ reservations.reservation_type column exists';
        v_pass := v_pass + 1;
    ELSE
        RAISE WARNING '  ✗ reservations.reservation_type column MISSING';
        v_fail := v_fail + 1;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'reservations'
        AND column_name = 'eta'
    ) THEN
        RAISE NOTICE '  ✓ reservations.eta column exists';
        v_pass := v_pass + 1;
    ELSE
        RAISE WARNING '  ✗ reservations.eta column MISSING';
        v_fail := v_fail + 1;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'reservations'
        AND column_name = 'company_id'
    ) THEN
        RAISE NOTICE '  ✓ reservations.company_id column exists';
        v_pass := v_pass + 1;
    ELSE
        RAISE WARNING '  ✗ reservations.company_id column MISSING';
        v_fail := v_fail + 1;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'reservations'
        AND column_name = 'travel_agent_id'
    ) THEN
        RAISE NOTICE '  ✓ reservations.travel_agent_id column exists';
        v_pass := v_pass + 1;
    ELSE
        RAISE WARNING '  ✗ reservations.travel_agent_id column MISSING';
        v_fail := v_fail + 1;
    END IF;

    -- Check quote/expire lifecycle columns (S8)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'reservations'
        AND column_name = 'quoted_at'
    ) THEN
        RAISE NOTICE '  ✓ reservations.quoted_at column exists';
        v_pass := v_pass + 1;
    ELSE
        RAISE WARNING '  ✗ reservations.quoted_at column MISSING';
        v_fail := v_fail + 1;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'reservations'
        AND column_name = 'quote_expires_at'
    ) THEN
        RAISE NOTICE '  ✓ reservations.quote_expires_at column exists';
        v_pass := v_pass + 1;
    ELSE
        RAISE WARNING '  ✗ reservations.quote_expires_at column MISSING';
        v_fail := v_fail + 1;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'reservations'
        AND column_name = 'expired_at'
    ) THEN
        RAISE NOTICE '  ✓ reservations.expired_at column exists';
        v_pass := v_pass + 1;
    ELSE
        RAISE WARNING '  ✗ reservations.expired_at column MISSING';
        v_fail := v_fail + 1;
    END IF;

    RAISE NOTICE '';
    RAISE NOTICE '--- New Tables ---';

    -- Check command_idempotency table exists (P1-1)
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'command_idempotency'
    ) THEN
        RAISE NOTICE '  ✓ command_idempotency table exists';
        v_pass := v_pass + 1;
    ELSE
        RAISE WARNING '  ✗ command_idempotency table MISSING';
        v_fail := v_fail + 1;
    END IF;

    -- Check inventory_locks_shadow table exists (P0-3)
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'inventory_locks_shadow'
    ) THEN
        RAISE NOTICE '  ✓ inventory_locks_shadow table exists';
        v_pass := v_pass + 1;
    ELSE
        RAISE WARNING '  ✗ inventory_locks_shadow table MISSING';
        v_fail := v_fail + 1;
    END IF;

    RAISE NOTICE '';
    RAISE NOTICE '--- Reference Data ---';

    -- Check charge_codes table exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'charge_codes'
    ) THEN
        RAISE NOTICE '  ✓ charge_codes table exists';
        v_pass := v_pass + 1;
    ELSE
        RAISE WARNING '  ✗ charge_codes table MISSING';
        v_fail := v_fail + 1;
    END IF;

    -- Check charge_codes has seed data
    IF EXISTS (SELECT 1 FROM charge_codes WHERE code = 'ROOM') THEN
        RAISE NOTICE '  ✓ charge_codes has USALI seed data';
        v_pass := v_pass + 1;
    ELSE
        RAISE WARNING '  ✗ charge_codes seed data MISSING';
        v_fail := v_fail + 1;
    END IF;

    -- Check tax_configurations has default seeds
    IF EXISTS (SELECT 1 FROM tax_configurations WHERE tax_code = 'US-OCCUPANCY-DEFAULT') THEN
        RAISE NOTICE '  ✓ tax_configurations has default tax seeds';
        v_pass := v_pass + 1;
    ELSE
        RAISE WARNING '  ✗ tax_configurations default seeds MISSING';
        v_fail := v_fail + 1;
    END IF;

    RAISE NOTICE '';
    RAISE NOTICE '--- Procedures & Triggers ---';

    -- Check track_reservation_status_change function exists
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'track_reservation_status_change'
    ) THEN
        RAISE NOTICE '  ✓ track_reservation_status_change() function exists';
        v_pass := v_pass + 1;
    ELSE
        RAISE WARNING '  ✗ track_reservation_status_change() function MISSING';
        v_fail := v_fail + 1;
    END IF;

    -- Check trg_reservation_status_history trigger exists
    IF EXISTS (
        SELECT 1 FROM information_schema.triggers
        WHERE trigger_schema = 'public'
        AND trigger_name = 'trg_reservation_status_history'
    ) THEN
        RAISE NOTICE '  ✓ trg_reservation_status_history trigger exists';
        v_pass := v_pass + 1;
    ELSE
        RAISE WARNING '  ✗ trg_reservation_status_history trigger MISSING';
        v_fail := v_fail + 1;
    END IF;

    RAISE NOTICE '';
    RAISE NOTICE '--- Indexes ---';

    -- Check idx_reservations_type index exists
    IF EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND indexname = 'idx_reservations_type'
    ) THEN
        RAISE NOTICE '  ✓ idx_reservations_type index exists';
        v_pass := v_pass + 1;
    ELSE
        RAISE WARNING '  ✗ idx_reservations_type index MISSING';
        v_fail := v_fail + 1;
    END IF;

    -- Check idx_guests_tenant_email is UNIQUE
    IF EXISTS (
        SELECT 1 FROM pg_index i
        JOIN pg_class c ON c.oid = i.indexrelid
        WHERE c.relname = 'idx_guests_tenant_email' AND i.indisunique = true
    ) THEN
        RAISE NOTICE '  ✓ idx_guests_tenant_email is UNIQUE';
        v_pass := v_pass + 1;
    ELSE
        RAISE WARNING '  ✗ idx_guests_tenant_email is NOT UNIQUE';
        v_fail := v_fail + 1;
    END IF;

    RAISE NOTICE '';
    RAISE NOTICE '==========================================';
    RAISE NOTICE 'Industry Standards: % passed, % failed', v_pass, v_fail;
    IF v_fail = 0 THEN
        RAISE NOTICE '✓✓✓ ALL INDUSTRY STANDARDS CHECKS PASSED ✓✓✓';
    ELSE
        RAISE WARNING '⚠⚠⚠ % INDUSTRY STANDARDS CHECK(S) FAILED ⚠⚠⚠', v_fail;
    END IF;
    RAISE NOTICE '==========================================';
END $$;
\echo ''

\echo 'Expected Results:'
\echo '  - Extensions: 1 (uuid-ossp)'
\echo '  - Schemas: 2 (public, availability)'
\echo '  - ENUM Types: 60+'
\echo '  - Tables: ~180 (includes 6 reference data tables)'
\echo '  - Row Counts: 100+ (reference data system defaults)'
\echo ''
\echo 'Table Breakdown:'
\echo '  - 9 domain categories (core → reference data)'
\echo '  - Dynamic count via ripgrep in setup-database.sh'
\echo '  - Run verify-all.sql for complete validation'
\echo ''
\echo 'Next Steps:'
\echo '  1. Create indexes (scripts/indexes/)'
\echo '  2. Add foreign keys (scripts/constraints/)'
\echo '  3. Load sample data'
\echo '=============================================='
\echo ''
