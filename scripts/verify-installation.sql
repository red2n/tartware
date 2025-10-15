-- =====================================================
-- verify-installation.sql
-- Verification script for database setup
-- Run this after executing 00-master-install.sh
-- Date: 2025-10-15
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
\echo 'Expected Results:'
\echo '  - Extensions: 1 (uuid-ossp)'
\echo '  - Schemas: 2 (public, availability)'
\echo '  - ENUM Types: 20+'
\echo '  - Tables: 37+ (36+ in public, 1 in availability)'
\echo '  - Row Counts: 0 (fresh install, no sample data)'
\echo ''
\echo 'Next Steps:'
\echo '  1. Create indexes (scripts/indexes/)'
\echo '  2. Add foreign keys (scripts/constraints/)'
\echo '  3. Load sample data'
\echo '============================================='
\echo ''
