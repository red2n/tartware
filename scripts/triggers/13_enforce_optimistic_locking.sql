-- =====================================================
-- 13_enforce_optimistic_locking.sql
-- Optimistic locking enforcement for version columns
-- Date: 2025-11-02
--
-- Purpose: ensure the shared "version" bigint column is
--          incremented on every update and prevent stale
--          writes that reuse an older version number.
-- =====================================================

\c tartware

\echo ''
\echo '======================================================'
\echo '  Installing Optimistic Locking Enforcement'
\echo '======================================================'
\echo ''

-- =====================================================
-- Shared trigger function used across all versioned tables
-- =====================================================
CREATE OR REPLACE FUNCTION public.enforce_version_lock()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Normalize NULL version on insert
    IF TG_OP = 'INSERT' THEN
        IF NEW.version IS NULL THEN
            NEW.version := 0;
        END IF;
        RETURN NEW;
    END IF;

    -- Auto-increment when caller omits a value
    IF NEW.version IS NULL THEN
        NEW.version := OLD.version + 1;
    ELSIF NEW.version <= OLD.version THEN
        RAISE EXCEPTION 'Optimistic lock conflict on %.% (current %, attempted %)',
            TG_TABLE_SCHEMA,
            TG_TABLE_NAME,
            OLD.version,
            NEW.version
            USING ERRCODE = '40001',
                  HINT = 'Refresh data and retry the update with the latest version value.';
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_version_lock()
IS 'Ensures version columns increment during updates and rejects stale optimistic-lock writes.';

-- =====================================================
-- Attach the trigger to every table that exposes a version column
-- =====================================================
DO $$
DECLARE
    rec RECORD;
    trigger_name text;
BEGIN
    FOR rec IN
        SELECT c.table_schema,
               c.table_name
        FROM information_schema.columns c
        JOIN information_schema.tables t
          ON t.table_schema = c.table_schema
         AND t.table_name = c.table_name
        WHERE c.column_name = 'version'
          AND t.table_type = 'BASE TABLE'
          AND c.table_schema IN ('public', 'availability')
          AND c.table_name NOT LIKE 'pg_%'
          AND c.table_name NOT LIKE 'sql_%'
        ORDER BY c.table_schema, c.table_name
    LOOP
        trigger_name := format('trg_%s_version_lock', rec.table_name);

        EXECUTE format(
            'DROP TRIGGER IF EXISTS %I ON %I.%I',
            trigger_name,
            rec.table_schema,
            rec.table_name
        );

        EXECUTE format(
            'CREATE TRIGGER %I
             BEFORE INSERT OR UPDATE ON %I.%I
             FOR EACH ROW
             EXECUTE FUNCTION public.enforce_version_lock()',
            trigger_name,
            rec.table_schema,
            rec.table_name
        );

        RAISE NOTICE 'Installed optimistic lock trigger on %.%', rec.table_schema, rec.table_name;
    END LOOP;
END;
$$;

\echo ''
\echo 'Optimistic locking enforcement installed successfully.'
\echo ''
