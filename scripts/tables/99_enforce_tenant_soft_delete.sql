-- =====================================================
-- Enforce tenant_id + soft delete columns across tables
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

    -- Add tenant_id for all listed tables and enforce NOT NULL where possible.
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

    -- Add soft delete columns for all listed tables.
    FOR r IN
        SELECT schema_name, table_name
        FROM (VALUES
        ('public', 'ai_demand_predictions'),
        ('public', 'ai_model_performance'),
        ('public', 'alert_rules'),
        ('public', 'api_logs'),
        ('public', 'app_usage_analytics'),
        ('public', 'audit_logs'),
        ('public', 'carbon_offset_programs'),
        ('public', 'command_dispatches'),
        ('public', 'command_features'),
        ('public', 'command_routes'),
        ('public', 'command_templates'),
        ('public', 'commission_rules'),
        ('public', 'commission_statements'),
        ('public', 'communication_templates'),
        ('public', 'contactless_requests'),
        ('public', 'demand_scenarios'),
        ('public', 'device_events_log'),
        ('public', 'digital_registration_cards'),
        ('public', 'gds_message_log'),
        ('public', 'gds_reservation_queue'),
        ('public', 'green_certifications'),
        ('public', 'group_room_blocks'),
        ('public', 'guest_behavior_patterns'),
        ('public', 'guest_communications'),
        ('public', 'guest_feedback'),
        ('public', 'guest_interaction_events'),
        ('public', 'guest_room_preferences'),
        ('public', 'inventory_lock_audits'),
        ('public', 'maintenance_history'),
        ('public', 'mobile_check_ins'),
        ('public', 'ota_reservations_queue'),
        ('public', 'ota_configurations'),
        ('public', 'ota_rate_plans'),
        ('public', 'package_bookings'),
        ('public', 'package_components'),
        ('public', 'performance_alerts'),
        ('public', 'performance_baselines'),
        ('public', 'performance_reports'),
        ('public', 'performance_thresholds'),
        ('public', 'personalized_recommendations'),
        ('public', 'predictive_maintenance_alerts'),
        ('public', 'price_adjustments_history'),
        ('public', 'pricing_experiments'),
        ('public', 'property_settings'),
        ('public', 'report_property_ids'),
        ('public', 'report_schedules'),
        ('public', 'reservation_command_lifecycle'),
        ('public', 'reservation_event_offsets'),
        ('public', 'reservation_guard_locks'),
        ('public', 'reservation_rate_fallbacks'),
        ('public', 'reservation_status_history'),
        ('public', 'review_response_templates'),
        ('public', 'roll_service_backfill_checkpoint'),
        ('public', 'roll_service_consumer_offsets'),
        ('public', 'roll_service_shadow_ledgers'),
        ('public', 'room_amenity_catalog'),
        ('public', 'room_energy_usage'),
        ('public', 'room_settings'),
        ('public', 'sentiment_analysis'),
        ('public', 'sentiment_trends'),
        ('public', 'setting_categories'),
        ('public', 'setting_definitions'),
        ('public', 'settings_categories'),
        ('public', 'settings_definitions'),
        ('public', 'settings_options'),
        ('public', 'settings_sections'),
        ('public', 'settings_values'),
        ('public', 'sustainability_initiatives'),
        ('public', 'sustainability_metrics'),
        ('public', 'system_admin_audit_log'),
        ('public', 'system_admin_break_glass_codes'),
        ('public', 'system_administrators'),
        ('public', 'tenant_access_audit'),
        ('public', 'tenant_settings'),
        ('public', 'transactional_outbox'),
        ('public', 'user_settings')
        ) AS t(schema_name, table_name)
    LOOP
        IF to_regclass(format('%I.%I', r.schema_name, r.table_name)) IS NULL THEN
            CONTINUE;
        END IF;

        EXECUTE format(
            'ALTER TABLE %I.%I ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;',
            r.schema_name,
            r.table_name
        );
        EXECUTE format(
            'ALTER TABLE %I.%I ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;',
            r.schema_name,
            r.table_name
        );
        EXECUTE format(
            'ALTER TABLE %I.%I ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(100);',
            r.schema_name,
            r.table_name
        );
    END LOOP;
END $$;
