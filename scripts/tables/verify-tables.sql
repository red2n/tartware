-- =====================================================
-- verify-tables.sql
-- Table verification for Tartware PMS.
--
-- The expected set is parsed from 00-create-all-tables.sql at run time by
-- tools/list-expected-tables.sh, which uses the same CREATE TABLE parser as
-- setup-database.sh. Adding a table script is therefore the only step needed:
-- there is no list of table names and no expected count in this file to fall
-- out of date.
--
-- Must be run with scripts/ as the working directory (run-verifications.sh
-- cd's there; verify-all.sql does \cd :scripts_dir).
-- =====================================================

\set ON_ERROR_STOP on
\c tartware

\echo ''
\echo '======================================================'
\echo '  TABLE VERIFICATION - ALL CATEGORIES'
\echo '======================================================'
\echo ''

DROP TABLE IF EXISTS _expected_tables;
CREATE TEMP TABLE _expected_tables (
    source_dir   TEXT NOT NULL,
    table_schema TEXT NOT NULL,
    table_name   TEXT NOT NULL
);

\copy _expected_tables FROM PROGRAM 'bash tools/list-expected-tables.sh'

-- An empty parse would make every check below pass vacuously, so treat it as a
-- failure rather than a clean run.
DO $$
DECLARE
    v_expected INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_expected FROM _expected_tables;
    IF v_expected = 0 THEN
        RAISE EXCEPTION
            'No expected tables parsed. Run this from the scripts/ directory so tools/list-expected-tables.sh resolves.';
    END IF;
    RAISE NOTICE 'Expected tables parsed from 00-create-all-tables.sql: %', v_expected;
END $$;

\echo ''

-- =====================================================
-- 1. EXISTENCE BY CATEGORY
-- =====================================================
\echo '1. Checking every declared table exists...'

SELECT
    e.source_dir                                            AS category,
    COUNT(*)                                                AS expected,
    COUNT(t.table_name)                                     AS found,
    COUNT(*) - COUNT(t.table_name)                          AS missing,
    CASE WHEN COUNT(*) = COUNT(t.table_name) THEN '✓' ELSE '✗' END AS status
FROM _expected_tables e
    LEFT JOIN information_schema.tables t
        ON t.table_schema = e.table_schema
        AND t.table_name = e.table_name
GROUP BY e.source_dir
ORDER BY e.source_dir;

DO $$
DECLARE
    r RECORD;
    v_missing INTEGER := 0;
BEGIN
    FOR r IN
        SELECT e.source_dir, e.table_schema, e.table_name
        FROM _expected_tables e
            LEFT JOIN information_schema.tables t
                ON t.table_schema = e.table_schema
                AND t.table_name = e.table_name
        WHERE t.table_name IS NULL
        ORDER BY e.source_dir, e.table_name
    LOOP
        v_missing := v_missing + 1;
        RAISE WARNING '  ✗ %.% is MISSING (declared in %)',
            r.table_schema, r.table_name, r.source_dir;
    END LOOP;

    IF v_missing > 0 THEN
        RAISE EXCEPTION 'Table verification FAILED - % declared table(s) missing!', v_missing;
    END IF;
END $$;

\echo ''

-- =====================================================
-- 2. CONVENTION COVERAGE BY CATEGORY
-- =====================================================
-- Multi-tenancy, soft delete and audit columns are house conventions rather
-- than hard requirements (reference and infrastructure tables legitimately
-- skip them), so this reports coverage instead of failing.
\echo '2. Convention coverage (tenant_id / soft delete / audit columns)...'

SELECT
    e.source_dir                                        AS category,
    COUNT(*)                                            AS tables,
    COUNT(*) FILTER (WHERE c.has_tenant_id)             AS with_tenant_id,
    COUNT(*) FILTER (WHERE c.has_soft_delete)           AS with_soft_delete,
    COUNT(*) FILTER (WHERE c.has_audit)                 AS with_audit
FROM _expected_tables e
    LEFT JOIN LATERAL (
        SELECT
            bool_or(col.column_name = 'tenant_id')  AS has_tenant_id,
            bool_or(col.column_name = 'is_deleted') AS has_soft_delete,
            bool_or(col.column_name = 'created_at') AS has_audit
        FROM information_schema.columns col
        WHERE col.table_schema = e.table_schema
          AND col.table_name = e.table_name
    ) c ON TRUE
GROUP BY e.source_dir
ORDER BY e.source_dir;

\echo ''

-- =====================================================
-- 3. CATEGORY-SPECIFIC CHECKS
-- =====================================================
-- Only reference data has a check beyond table existence and structure —
-- whether its seeded rows are present, which the schema cannot tell us.
-- Every other category is covered entirely by the dynamic checks above.
\i tables/09-reference-data/verify-09-reference-data.sql

-- =====================================================
-- SUMMARY
-- =====================================================
\echo ''
\echo '=============================================='
\echo '  TABLE VERIFICATION SUMMARY'
\echo '=============================================='

DO $$
DECLARE
    v_expected INTEGER;
    v_found INTEGER;
BEGIN
    SELECT COUNT(*), COUNT(t.table_name)
    INTO v_expected, v_found
    FROM _expected_tables e
        LEFT JOIN information_schema.tables t
            ON t.table_schema = e.table_schema
            AND t.table_name = e.table_name;

    RAISE NOTICE '';
    RAISE NOTICE 'Tables found: % / % declared', v_found, v_expected;
    RAISE NOTICE '';

    IF v_found = v_expected THEN
        RAISE NOTICE '✓✓✓ TABLE VERIFICATION PASSED ✓✓✓';
    ELSE
        RAISE EXCEPTION '⚠⚠⚠ TABLE VERIFICATION FAILED - % missing ⚠⚠⚠', v_expected - v_found;
    END IF;
END $$;

\echo ''
\echo '=============================================='
\echo 'Table verification complete!'
\echo '=============================================='
