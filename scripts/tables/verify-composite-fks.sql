-- =====================================================
-- verify-composite-fks.sql
-- Verify composite foreign keys for tenant isolation
-- Validates: 97_composite_foreign_keys.sql
-- Date: 2026-04-27
-- =====================================================

\c tartware

\echo ''
\echo '=============================================='
\echo '  COMPOSITE FOREIGN KEY VERIFICATION'
\echo '=============================================='
\echo ''

-- =====================================================
-- 1. CHECK UNIQUE(tenant_id, id) EXISTS ON PARENT TABLES
-- =====================================================
\echo '1. Checking UNIQUE(tenant_id, id) on parent tables...'

DO $$
DECLARE
    v_parent_tables TEXT[] := ARRAY[
        'properties', 'guests', 'reservations',
        'rooms', 'room_types', 'companies'
    ];
    -- Map tables to their PK column (most use 'id', companies uses 'company_id')
    v_pk_cols TEXT[] := ARRAY[
        'id', 'id', 'id',
        'id', 'id', 'company_id'
    ];
    v_table TEXT;
    v_pk_col TEXT;
    v_has_unique BOOLEAN;
    v_ok_count INT := 0;
    v_fail_count INT := 0;
BEGIN
    FOR i IN 1..array_length(v_parent_tables, 1) LOOP
        v_table := v_parent_tables[i];
        v_pk_col := v_pk_cols[i];
        -- Check for a unique constraint on (tenant_id, pk_col) - either order
        SELECT EXISTS (
            SELECT 1 FROM pg_constraint c
            JOIN pg_class rel ON rel.oid = c.conrelid
            JOIN pg_namespace n ON n.oid = rel.relnamespace
            WHERE n.nspname = 'public'
              AND rel.relname = v_table
              AND c.contype = 'u'  -- unique constraint
              AND array_length(c.conkey, 1) = 2
              AND EXISTS (
                  SELECT 1 FROM pg_attribute a
                  WHERE a.attrelid = c.conrelid
                    AND a.attnum = ANY(c.conkey)
                    AND a.attname = 'tenant_id'
              )
              AND EXISTS (
                  SELECT 1 FROM pg_attribute a
                  WHERE a.attrelid = c.conrelid
                    AND a.attnum = ANY(c.conkey)
                    AND a.attname = v_pk_col
              )
        ) INTO v_has_unique;

        IF v_has_unique THEN
            v_ok_count := v_ok_count + 1;
            RAISE NOTICE '  ✓ % has UNIQUE(tenant_id, %)', v_table, v_pk_col;
        ELSE
            v_fail_count := v_fail_count + 1;
            RAISE WARNING '  ✗ % is MISSING UNIQUE(tenant_id, %)', v_table, v_pk_col;
        END IF;
    END LOOP;

    RAISE NOTICE '';
    IF v_fail_count > 0 THEN
        RAISE EXCEPTION 'Composite FK prerequisite FAILED — % parent tables missing UNIQUE(tenant_id, pk)', v_fail_count;
    ELSE
        RAISE NOTICE '  ✓✓✓ All % parent tables have UNIQUE(tenant_id, pk)', v_ok_count;
    END IF;
END $$;

-- =====================================================
-- 2. CHECK NO REMAINING SINGLE-COLUMN FKs TO PARENT TABLES
-- =====================================================
\echo ''
\echo '2. Checking for remaining single-column FKs to target parent tables...'

DO $$
DECLARE
    r RECORD;
    v_remaining INT := 0;
    v_checked INT := 0;
BEGIN
    FOR r IN
        SELECT
            con.conname AS constraint_name,
            child_cls.relname AS child_table,
            child_ns.nspname AS child_schema,
            parent_cls.relname AS parent_table,
            a_child.attname AS child_column
        FROM pg_constraint con
        JOIN pg_class child_cls ON con.conrelid = child_cls.oid
        JOIN pg_namespace child_ns ON child_cls.relnamespace = child_ns.oid
        JOIN pg_class parent_cls ON con.confrelid = parent_cls.oid
        JOIN pg_namespace parent_ns ON parent_cls.relnamespace = parent_ns.oid
        JOIN pg_attribute a_child ON a_child.attrelid = con.conrelid
            AND a_child.attnum = con.conkey[1]
        JOIN pg_attribute a_parent ON a_parent.attrelid = con.confrelid
            AND a_parent.attnum = con.confkey[1]
        WHERE con.contype = 'f'
          AND array_length(con.conkey, 1) = 1        -- single-column FK
          AND parent_ns.nspname = 'public'
          AND parent_cls.relname IN (
            'properties', 'guests', 'reservations',
            'rooms', 'room_types', 'companies'
          )
          AND a_parent.attname = 'id'
          -- Only flag if the child table has tenant_id (so it could be composite)
          AND EXISTS (
              SELECT 1 FROM information_schema.columns
              WHERE table_schema = child_ns.nspname
                AND table_name = child_cls.relname
                AND column_name = 'tenant_id'
          )
        ORDER BY child_cls.relname, a_child.attname
    LOOP
        v_remaining := v_remaining + 1;
        RAISE WARNING '  ✗ %.% → single-column FK to % (constraint: %)',
            r.child_table, r.child_column, r.parent_table, r.constraint_name;
    END LOOP;

    v_checked := v_checked + 1;

    RAISE NOTICE '';
    IF v_remaining > 0 THEN
        RAISE WARNING '  ⚠ Found % single-column FKs that should be composite (tenant_id, col)', v_remaining;
    ELSE
        RAISE NOTICE '  ✓✓✓ No remaining single-column FKs to target parent tables — all upgraded to composite!';
    END IF;
END $$;

-- =====================================================
-- 3. COUNT COMPOSITE FKs (tenant_id, entity_id)
-- =====================================================
\echo ''
\echo '3. Counting composite foreign keys...'

DO $$
DECLARE
    v_composite_count INT;
BEGIN
    SELECT COUNT(*) INTO v_composite_count
    FROM pg_constraint con
    JOIN pg_class parent_cls ON con.confrelid = parent_cls.oid
    JOIN pg_namespace parent_ns ON parent_cls.relnamespace = parent_ns.oid
    WHERE con.contype = 'f'
      AND array_length(con.conkey, 1) = 2
      AND parent_ns.nspname = 'public'
      AND parent_cls.relname IN (
        'properties', 'guests', 'reservations',
        'rooms', 'room_types', 'companies'
      );

    RAISE NOTICE '  Composite FKs to target parent tables: %', v_composite_count;

    IF v_composite_count = 0 THEN
        RAISE WARNING '  ⚠ No composite FKs found — 97_composite_foreign_keys.sql may not have run';
    ELSE
        RAISE NOTICE '  ✓ % composite foreign keys enforced', v_composite_count;
    END IF;
END $$;

\echo ''
\echo '=============================================='
\echo '  COMPOSITE FK VERIFICATION COMPLETE'
\echo '=============================================='
\echo ''
