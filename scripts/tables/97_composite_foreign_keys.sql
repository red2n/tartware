-- =====================================================
-- 97_composite_foreign_keys.sql
-- Enforce tenant-scoped composite foreign keys
-- Industry Standard: Multi-tenant data isolation
-- Pattern: Replace single-column FKs with (tenant_id, entity_id)
-- Date: 2026-04-27
-- =====================================================
--
-- WHY: Single-column FKs like REFERENCES properties(id) do not enforce
-- same-tenant relationships. A row in table A with tenant_id=T1 could
-- reference a property belonging to tenant T2. Composite FKs guarantee
-- that both the parent and child row belong to the same tenant.
--
-- PREREQUISITE: Each referenced table must have UNIQUE(tenant_id, id).
-- These constraints are added in the canonical CREATE TABLE scripts:
--   properties  → 04_properties.sql
--   guests      → 05_guests.sql
--   rooms       → 07_rooms.sql
--   room_types  → 06_room_types.sql
--   reservations → 10_reservations.sql
--   companies   → 90_companies.sql
--
-- APPROACH: For each child table that has both tenant_id and a FK column
-- (e.g., property_id), we:
--   1. Drop the old single-column FK constraint (if it exists)
--   2. Add a new composite FK: (tenant_id, property_id) REFERENCES parent(tenant_id, id)
--
-- This script is idempotent — safe to re-run.
-- =====================================================

\c tartware

\echo 'Enforcing composite foreign keys for tenant isolation...'

-- =====================================================
-- HELPER: Dynamic composite FK enforcement
-- =====================================================
-- This DO block scans pg_constraint to find single-column FKs
-- pointing at our target tables and replaces them with composite
-- (tenant_id, <col>) FKs when the child table also has tenant_id.
-- =====================================================

DO $$
DECLARE
  r RECORD;
  v_has_tenant_id BOOLEAN;
  v_has_composite_fk BOOLEAN;
  v_child_col TEXT;
  v_parent_table TEXT;
  v_constraint_name TEXT;
  v_new_constraint TEXT;
  v_count INT := 0;
BEGIN
  -- For each single-column FK referencing one of our target tables
  FOR r IN
    SELECT
      con.conname AS constraint_name,
      child_cls.relname AS child_table,
      child_ns.nspname AS child_schema,
      parent_cls.relname AS parent_table,
      parent_ns.nspname AS parent_schema,
      a_child.attname AS child_column,
      a_parent.attname AS parent_column
    FROM pg_constraint con
    JOIN pg_class child_cls ON con.conrelid = child_cls.oid
    JOIN pg_namespace child_ns ON child_cls.relnamespace = child_ns.oid
    JOIN pg_class parent_cls ON con.confrelid = parent_cls.oid
    JOIN pg_namespace parent_ns ON parent_cls.relnamespace = parent_ns.oid
    JOIN pg_attribute a_child ON a_child.attrelid = con.conrelid
      AND a_child.attnum = con.conkey[1]
    JOIN pg_attribute a_parent ON a_parent.attrelid = con.confrelid
      AND a_parent.attnum = con.confkey[1]
    WHERE con.contype = 'f'                          -- foreign key
      AND array_length(con.conkey, 1) = 1            -- single-column FK only
      AND parent_ns.nspname = 'public'
      AND parent_cls.relname IN (
        'properties', 'guests', 'reservations',
        'rooms', 'room_types', 'companies'
      )
      AND a_parent.attname = 'id'                    -- FK targets the PK
    ORDER BY child_cls.relname, a_child.attname
  LOOP
    v_child_col := r.child_column;
    v_parent_table := r.parent_table;
    v_constraint_name := r.constraint_name;

    -- Check if child table has tenant_id column
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = r.child_schema
        AND table_name = r.child_table
        AND column_name = 'tenant_id'
    ) INTO v_has_tenant_id;

    IF NOT v_has_tenant_id THEN
      RAISE NOTICE 'SKIP: %.% has no tenant_id column', r.child_table, v_child_col;
      CONTINUE;
    END IF;

    -- Check if composite FK already exists for this specific child column
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c2
      JOIN pg_attribute a ON a.attrelid = c2.conrelid
        AND a.attnum = ANY(c2.conkey)
        AND a.attname = v_child_col
      WHERE c2.conrelid = (SELECT oid FROM pg_class WHERE relname = r.child_table AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = r.child_schema))
        AND c2.contype = 'f'
        AND array_length(c2.conkey, 1) = 2
        AND c2.confrelid = (SELECT oid FROM pg_class WHERE relname = v_parent_table AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = r.parent_schema))
    ) INTO v_has_composite_fk;

    IF v_has_composite_fk THEN
      RAISE NOTICE 'SKIP: %.% already has composite FK to %', r.child_table, v_child_col, v_parent_table;
      CONTINUE;
    END IF;

    v_new_constraint := 'fk_' || r.child_table || '_tenant_' || v_child_col;

    -- Drop old single-column FK
    EXECUTE format(
      'ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I',
      r.child_schema, r.child_table, v_constraint_name
    );

    -- Add composite FK
    EXECUTE format(
      'ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (tenant_id, %I) REFERENCES %I.%I(tenant_id, id) ON DELETE CASCADE',
      r.child_schema, r.child_table, v_new_constraint,
      v_child_col,
      r.parent_schema, v_parent_table
    );

    v_count := v_count + 1;
    RAISE NOTICE 'DONE: %.% → composite FK to % (replaced %)',
      r.child_table, v_child_col, v_parent_table, v_constraint_name;
  END LOOP;

  RAISE NOTICE '=== Composite FK enforcement complete: % constraints upgraded ===', v_count;
END;
$$;

\echo '✓ Composite foreign keys enforced for tenant isolation.'
