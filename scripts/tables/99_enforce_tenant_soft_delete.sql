-- =====================================================
-- Enforce tenant_id + soft delete columns across tables
-- Soft delete is applied dynamically to ALL tables in
-- public and availability schemas — no hardcoded list.
-- =====================================================

\c tartware

DO $$
DECLARE
    v_default_tenant UUID;
    r RECORD;
BEGIN
    -- Ensure tenants table can be self-referential and seeded before tenant backfills.
    IF to_regclass('public.tenants') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS tenant_id UUID;';

        IF NOT EXISTS (SELECT 1 FROM tenants) THEN
            v_default_tenant := '11111111-1111-1111-1111-111111111111';
            EXECUTE '
                INSERT INTO tenants (id, tenant_id, name, slug, type, status, email)
                VALUES (
                    ''11111111-1111-1111-1111-111111111111'',
                    ''11111111-1111-1111-1111-111111111111'',
                    ''Tartware Hospitality Labs'',
                    ''tartware-hospitality'',
                    ''INDEPENDENT'',
                    ''ACTIVE'',
                    ''ops@tartware.demo''
                )
                ON CONFLICT (id) DO NOTHING;
            ';
        ELSE
            SELECT id INTO v_default_tenant
            FROM tenants
            ORDER BY created_at NULLS LAST, id
            LIMIT 1;
        END IF;

        EXECUTE 'UPDATE public.tenants SET tenant_id = id WHERE tenant_id IS NULL;';
        EXECUTE 'ALTER TABLE public.tenants ALTER COLUMN tenant_id SET NOT NULL;';
    END IF;

    -- Add tenant_id for tables that don't define it in their CREATE TABLE script.
    FOR r IN
        SELECT schema_name, table_name
        FROM (VALUES
        ('public', 'alert_rules'),
        ('public', 'command_templates'),
        ('public', 'device_events_log'),
        ('public', 'group_room_blocks'),
        ('public', 'package_bookings'),
        ('public', 'package_components'),
        ('public', 'performance_alerts'),
        ('public', 'performance_baselines'),
        ('public', 'performance_reports'),
        ('public', 'performance_thresholds'),
        ('public', 'property_settings'),
        ('public', 'report_schedules'),
        ('public', 'reservation_event_offsets'),
        ('public', 'roll_service_consumer_offsets'),
        ('public', 'room_settings'),
        ('public', 'setting_categories'),
        ('public', 'setting_definitions'),
        ('public', 'settings_categories'),
        ('public', 'settings_definitions'),
        ('public', 'settings_options'),
        ('public', 'settings_sections'),
        ('public', 'system_admin_break_glass_codes'),
        ('public', 'system_administrators'),
        ('public', 'tenants'),
        ('public', 'user_settings'),
        ('public', 'users')
        ) AS t(schema_name, table_name)
    LOOP
        IF to_regclass(format('%I.%I', r.schema_name, r.table_name)) IS NULL THEN
            CONTINUE;
        END IF;

        EXECUTE format(
            'ALTER TABLE %I.%I ADD COLUMN IF NOT EXISTS tenant_id UUID;',
            r.schema_name,
            r.table_name
        );

        IF r.schema_name = 'public' AND r.table_name = 'tenants' THEN
            EXECUTE 'UPDATE public.tenants SET tenant_id = id WHERE tenant_id IS NULL;';
        ELSIF v_default_tenant IS NOT NULL THEN
            EXECUTE format(
                'ALTER TABLE %I.%I DISABLE TRIGGER USER;',
                r.schema_name,
                r.table_name
            );

            EXECUTE format(
                'UPDATE %I.%I SET tenant_id = %L WHERE tenant_id IS NULL;',
                r.schema_name,
                r.table_name,
                v_default_tenant
            );

            EXECUTE format(
                'ALTER TABLE %I.%I ENABLE TRIGGER USER;',
                r.schema_name,
                r.table_name
            );
        END IF;

        EXECUTE format(
            'ALTER TABLE %I.%I ALTER COLUMN tenant_id SET NOT NULL;',
            r.schema_name,
            r.table_name
        );
    END LOOP;

    -- Dynamically add soft delete columns (is_deleted, deleted_at, deleted_by)
    -- to ALL tables in public and availability schemas.
    FOR r IN
        SELECT t.table_schema, t.table_name
        FROM information_schema.tables t
        WHERE t.table_schema IN ('public', 'availability')
          AND t.table_type = 'BASE TABLE'
        ORDER BY t.table_schema, t.table_name
    LOOP
        EXECUTE format(
            'ALTER TABLE %I.%I ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;',
            r.table_schema,
            r.table_name
        );
        EXECUTE format(
            'ALTER TABLE %I.%I ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;',
            r.table_schema,
            r.table_name
        );
        EXECUTE format(
            'ALTER TABLE %I.%I ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(100);',
            r.table_schema,
            r.table_name
        );
    END LOOP;
END $$;

\echo 'Tenant isolation and soft delete enforcement complete.'
