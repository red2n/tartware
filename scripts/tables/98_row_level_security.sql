-- =====================================================
-- 98_row_level_security.sql
-- Row-Level Security (RLS) for multi-tenant isolation
-- Pattern: Defence-in-depth — application-level WHERE
--          clauses are the primary filter; RLS is the
--          safety net that prevents cross-tenant leaks
--          when a developer forgets tenant_id in a query.
-- Requires: app.current_tenant_id session variable set
--           per-connection from the JWT-validated tenantId.
-- Date: 2026-04-27
-- =====================================================

\c tartware

-- ─── 1. Application role (RLS does NOT apply to superusers) ────
-- Services must connect as tartware_app (not postgres) for RLS
-- to take effect. The password should be overridden via env var
-- in production.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tartware_app') THEN
        CREATE ROLE tartware_app LOGIN PASSWORD 'tartware_app_dev' NOSUPERUSER NOCREATEDB NOCREATEROLE;
        RAISE NOTICE 'Created role tartware_app';
    END IF;
END
$$;

-- Grant schema usage and table privileges
GRANT USAGE ON SCHEMA public TO tartware_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO tartware_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO tartware_app;

-- Grant usage on sequences (for uuid_generate_v4, gen_random_uuid, etc.)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO tartware_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO tartware_app;

-- Availability schema (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'availability') THEN
        EXECUTE 'GRANT USAGE ON SCHEMA availability TO tartware_app';
        EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA availability TO tartware_app';
        EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA availability GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO tartware_app';
        EXECUTE 'GRANT USAGE ON ALL SEQUENCES IN SCHEMA availability TO tartware_app';
        EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA availability GRANT USAGE ON SEQUENCES TO tartware_app';
    END IF;
END
$$;

-- ─── 2. Dynamic RLS enablement ─────────────────────────────────
-- Iterates over ALL tables in public schema that have a tenant_id
-- column, excluding infrastructure/system tables.

DO $$
DECLARE
    r RECORD;
    v_policy_name TEXT;
    v_excluded_tables TEXT[] := ARRAY[
        -- Self-referential / system tables
        'tenants',
        'system_administrators',
        'system_admin_break_glass_codes',
        'system_admin_audit_log',       -- has its own RLS policy

        -- Kafka consumer infrastructure (offsets, not tenant data)
        'reservation_event_offsets',
        'roll_service_consumer_offsets',
        'roll_service_backfill_checkpoint',

        -- Command center infrastructure (shared catalog)
        'command_templates',
        'command_dispatches',
        'command_features',
        'command_routes',
        'command_idempotency',

        -- Transactional outbox (infrastructure, consumed by Kafka connect)
        'transactional_outbox'
    ];
BEGIN
    FOR r IN
        SELECT c.relname AS table_name
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_attribute a ON a.attrelid = c.oid
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'                -- ordinary tables only
          AND a.attname = 'tenant_id'
          AND a.attnum > 0                   -- not a system column
          AND NOT a.attisdropped
          AND c.relname != ALL(v_excluded_tables)
        ORDER BY c.relname
    LOOP
        v_policy_name := 'tenant_isolation_' || r.table_name;

        -- Enable RLS (idempotent)
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.table_name);

        -- Force RLS even for table owner (not superuser — superuser always bypasses)
        EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', r.table_name);

        -- Drop existing policy if present (idempotent re-run)
        IF EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'public'
              AND tablename = r.table_name
              AND policyname = v_policy_name
        ) THEN
            EXECUTE format('DROP POLICY %I ON public.%I', v_policy_name, r.table_name);
        END IF;

        -- Create tenant isolation policy
        -- current_setting('app.current_tenant_id', true) returns NULL when not set
        -- (the `true` flag avoids raising an error), making the policy deny all rows
        -- when the session variable is missing — fail-safe by default.
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR ALL USING (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid)',
            v_policy_name,
            r.table_name
        );

        RAISE NOTICE 'RLS enabled on public.% — policy %', r.table_name, v_policy_name;
    END LOOP;

    -- Availability schema tables
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'availability') THEN
        FOR r IN
            SELECT c.relname AS table_name
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            JOIN pg_attribute a ON a.attrelid = c.oid
            WHERE n.nspname = 'availability'
              AND c.relkind = 'r'
              AND a.attname = 'tenant_id'
              AND a.attnum > 0
              AND NOT a.attisdropped
            ORDER BY c.relname
        LOOP
            v_policy_name := 'tenant_isolation_' || r.table_name;

            EXECUTE format('ALTER TABLE availability.%I ENABLE ROW LEVEL SECURITY', r.table_name);
            EXECUTE format('ALTER TABLE availability.%I FORCE ROW LEVEL SECURITY', r.table_name);

            IF EXISTS (
                SELECT 1 FROM pg_policies
                WHERE schemaname = 'availability'
                  AND tablename = r.table_name
                  AND policyname = v_policy_name
            ) THEN
                EXECUTE format('DROP POLICY %I ON availability.%I', v_policy_name, r.table_name);
            END IF;

            EXECUTE format(
                'CREATE POLICY %I ON availability.%I FOR ALL USING (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid)',
                v_policy_name,
                r.table_name
            );

            RAISE NOTICE 'RLS enabled on availability.% — policy %', r.table_name, v_policy_name;
        END LOOP;
    END IF;
END
$$;

\echo '✓ Row-Level Security enabled on all business tables.'
\echo '  NOTE: RLS only takes effect for non-superuser roles.'
\echo '  Services must connect as tartware_app (not postgres).'
\echo '  Each request must SET app.current_tenant_id before querying.'
