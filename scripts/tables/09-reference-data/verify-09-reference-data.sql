-- =====================================================
-- verify-09-reference-data.sql
-- Seed-data checks for the dynamic-enum reference tables.
--
-- Table existence and structure are covered by tables/verify-tables.sql, which
-- derives its expected set from 00-create-all-tables.sql. What is left here is
-- the one thing that cannot be derived from the schema: whether the reference
-- tables actually carry their seeded rows.
--
-- The tables checked are discovered from the schema itself — any table with an
-- `is_system` column is a seeded reference table — so a new one is picked up
-- with no edit to this file.
-- =====================================================

\echo ''
\echo '=============================================='
\echo '  REFERENCE DATA — SEED VERIFICATION'
\echo '=============================================='
\echo ''

\echo '3. Checking system default data...'

DO $$
DECLARE
    r RECORD;
    v_count INTEGER;
    v_total INTEGER := 0;
    v_empty TEXT[] := '{}'::TEXT[];
    v_checked INTEGER := 0;
BEGIN
    FOR r IN
        SELECT c.table_name
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.column_name = 'is_system'
        ORDER BY c.table_name
    LOOP
        EXECUTE format('SELECT COUNT(*) FROM public.%I WHERE is_system = TRUE', r.table_name)
            INTO v_count;

        v_checked := v_checked + 1;
        v_total := v_total + v_count;
        RAISE NOTICE '  %: % system defaults', rpad(r.table_name, 24), v_count;

        IF v_count = 0 THEN
            v_empty := array_append(v_empty, r.table_name);
        END IF;
    END LOOP;

    RAISE NOTICE '';
    IF v_checked = 0 THEN
        RAISE WARNING '⚠ No reference tables found (no table carries an is_system column)';
    ELSE
        RAISE NOTICE '  Total system defaults across % tables: %', v_checked, v_total;
    END IF;

    IF array_length(v_empty, 1) > 0 THEN
        RAISE WARNING '⚠ No system default data in: %', array_to_string(v_empty, ', ');
    ELSIF v_checked > 0 THEN
        RAISE NOTICE '✓ All reference tables have system default data';
    END IF;
END $$;

\echo ''

-- =====================================================
-- 4. LEGACY ENUM MAPPING CHECK
-- =====================================================
-- Reference tables that replaced a Postgres enum keep the old value in
-- legacy_enum_value so existing rows can still be resolved. Presence of that
-- column is what marks a table as needing the mapping.
\echo '4. Checking legacy enum mappings...'

DO $$
DECLARE
    r RECORD;
    v_mapped INTEGER;
    v_total INTEGER;
BEGIN
    FOR r IN
        SELECT c.table_name
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.column_name = 'legacy_enum_value'
        ORDER BY c.table_name
    LOOP
        EXECUTE format(
            'SELECT COUNT(*) FILTER (WHERE legacy_enum_value IS NOT NULL), COUNT(*)
               FROM public.%I WHERE is_system = TRUE', r.table_name)
            INTO v_mapped, v_total;

        RAISE NOTICE '  %: % / % mapped', rpad(r.table_name, 24), v_mapped, v_total;
    END LOOP;
END $$;

\echo ''
\echo '=============================================='
\echo 'Reference data seed verification complete!'
\echo '=============================================='
