-- =====================================================
-- verify-rls.sql
-- Verify Row-Level Security is enabled on all business
-- tables that have a tenant_id column.
-- Validates: 98_row_level_security.sql
-- Date: 2026-04-27
-- =====================================================

\c tartware

\echo ''
\echo '=============================================='
\echo '  ROW-LEVEL SECURITY VERIFICATION'
\echo '=============================================='
\echo ''

-- =====================================================
-- 1. CHECK tartware_app ROLE EXISTS
-- =====================================================
\echo '1. Checking tartware_app role exists...'

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tartware_app') THEN
        RAISE NOTICE '  ✓ Role tartware_app exists';
    ELSE
        RAISE EXCEPTION '  ✗ Role tartware_app is MISSING — run 98_row_level_security.sql';
    END IF;
END $$;

-- =====================================================
-- 2. CHECK RLS ENABLED ON ALL TENANT TABLES
-- =====================================================
\echo ''
\echo '2. Checking RLS is enabled on all tables with tenant_id...'

DO $$
DECLARE
    r RECORD;
    v_rls_enabled BOOLEAN;
    v_force_rls BOOLEAN;
    v_has_policy BOOLEAN;
    v_ok_count INT := 0;
    v_fail_count INT := 0;
    v_excluded_tables TEXT[] := ARRAY[
        'tenants',
        'system_administrators',
        'system_admin_break_glass_codes',
        'system_admin_audit_log',
        'reservation_event_offsets',
        'roll_service_consumer_offsets',
        'roll_service_backfill_checkpoint',
        'command_templates',
        'command_dispatches',
        'command_features',
        'command_routes',
        'command_idempotency',
        'transactional_outbox',
        'tenant_access_audit'
    ];
BEGIN
    FOR r IN
        SELECT c.relname AS table_name, n.nspname AS schema_name,
               c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS force_rls
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_attribute a ON a.attrelid = c.oid
        WHERE n.nspname IN ('public', 'availability')
          AND c.relkind = 'r'
          AND a.attname = 'tenant_id'
          AND a.attnum > 0
          AND NOT a.attisdropped
          AND c.relname != ALL(v_excluded_tables)
        ORDER BY n.nspname, c.relname
    LOOP
        v_rls_enabled := r.rls_enabled;
        v_force_rls := r.force_rls;

        -- Check for tenant isolation policy
        SELECT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = r.schema_name
              AND tablename = r.table_name
              AND policyname = 'tenant_isolation_' || r.table_name
        ) INTO v_has_policy;

        IF v_rls_enabled AND v_force_rls AND v_has_policy THEN
            v_ok_count := v_ok_count + 1;
        ELSE
            v_fail_count := v_fail_count + 1;
            RAISE WARNING '  ✗ %.% — RLS=%  FORCE=%  POLICY=%',
                r.schema_name, r.table_name,
                v_rls_enabled, v_force_rls, v_has_policy;
        END IF;
    END LOOP;

    RAISE NOTICE '';
    RAISE NOTICE '  RLS verified: % tables OK, % tables FAILED', v_ok_count, v_fail_count;

    IF v_fail_count > 0 THEN
        RAISE EXCEPTION 'RLS verification FAILED — % tables missing RLS or policy', v_fail_count;
    ELSE
        RAISE NOTICE '  ✓✓✓ All % tenant tables have RLS enabled + forced + policy!', v_ok_count;
    END IF;
END $$;

-- =====================================================
-- 3. CHECK EXCLUDED TABLES DO NOT HAVE RLS
-- =====================================================
\echo ''
\echo '3. Checking infrastructure tables are excluded from RLS...'

DO $$
DECLARE
    r RECORD;
    v_ok_count INT := 0;
    v_warn_count INT := 0;
    v_infra_tables TEXT[] := ARRAY[
        'tenants',
        'command_templates',
        'command_dispatches',
        'command_features',
        'command_routes',
        'command_idempotency',
        'transactional_outbox'
    ];
BEGIN
    FOR r IN
        SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND c.relname = ANY(v_infra_tables)
        ORDER BY c.relname
    LOOP
        IF r.rls_enabled THEN
            v_warn_count := v_warn_count + 1;
            RAISE WARNING '  ⚠ % has RLS enabled (should be excluded)', r.table_name;
        ELSE
            v_ok_count := v_ok_count + 1;
        END IF;
    END LOOP;

    RAISE NOTICE '  Infrastructure tables checked: % OK, % unexpected RLS', v_ok_count, v_warn_count;

    IF v_warn_count = 0 THEN
        RAISE NOTICE '  ✓ Infrastructure tables correctly excluded from RLS';
    END IF;
END $$;

-- =====================================================
-- 4. CHECK SCHEMA GRANTS FOR tartware_app
-- =====================================================
\echo ''
\echo '4. Checking schema grants for tartware_app...'

DO $$
DECLARE
    v_has_usage BOOLEAN;
BEGIN
    SELECT has_schema_privilege('tartware_app', 'public', 'USAGE') INTO v_has_usage;
    IF v_has_usage THEN
        RAISE NOTICE '  ✓ tartware_app has USAGE on public schema';
    ELSE
        RAISE WARNING '  ✗ tartware_app lacks USAGE on public schema';
    END IF;
END $$;

\echo ''
\echo '=============================================='
\echo '  RLS VERIFICATION COMPLETE'
\echo '=============================================='
\echo ''
