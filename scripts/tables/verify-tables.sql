-- =====================================================
-- verify-tables.sql
-- Verify All Tables Are Created Correctly
-- Date: 2025-10-17
--
-- Updated: Now supports 89 tables (up from 37)
-- =====================================================

\c tartware

\echo '=============================================='
\echo '  TABLE VERIFICATION'
\echo '=============================================='
\echo ''

-- =====================================================
-- 1. CHECK ALL TABLES EXIST
-- =====================================================
\echo '1. Checking if all required tables exist:'
\echo '--------------------------------------------'

DO $$
DECLARE
    v_expected_tables TEXT[] := ARRAY[
        'tenants', 'users', 'user_tenant_associations', 'properties',
        'guests', 'room_types', 'rooms', 'rates', 'reservations',
        'reservation_status_history', 'payments', 'invoices', 'invoice_items',
        'services', 'reservation_services', 'housekeeping_tasks',
        'channel_mappings', 'analytics_metrics', 'analytics_metric_dimensions',
        'analytics_reports', 'report_property_ids', 'performance_reports',
        'report_schedules', 'performance_thresholds', 'performance_baselines',
        'performance_alerts', 'alert_rules', 'folios', 'charge_postings',
        'audit_logs', 'business_dates', 'night_audit_log', 'deposit_schedules',
        'allotments', 'booking_sources', 'market_segments', 'guest_preferences',
        'refunds', 'rate_overrides', 'maintenance_requests', 'ota_configurations',
        'ota_rate_plans', 'ota_reservations_queue', 'guest_communications',
        'communication_templates', 'guest_feedback', 'ota_inventory_sync',
        'channel_rate_parity', 'channel_commission_rules', 'guest_loyalty_programs',
        'guest_documents', 'guest_notes', 'automated_messages', 'revenue_forecasts',
        'competitor_rates', 'demand_calendar', 'pricing_rules', 'rate_recommendations',
        'revenue_goals', 'staff_schedules', 'staff_tasks', 'shift_handovers',
        'lost_and_found', 'incident_reports', 'vendor_contracts', 'tax_configurations',
        'financial_closures', 'commission_tracking', 'cashier_sessions',
        'accounts_receivable', 'credit_limits', 'marketing_campaigns',
        'campaign_segments', 'promotional_codes', 'referral_tracking',
        'social_media_mentions', 'gdpr_consent_logs', 'police_reports',
        'contract_agreements', 'insurance_claims', 'guest_journey_tracking',
        'revenue_attribution', 'forecasting_models', 'ab_test_results',
        'mobile_keys', 'qr_codes', 'push_notifications', 'app_usage_analytics',
        'integration_mappings', 'api_logs', 'webhook_subscriptions', 'data_sync_status'
    ];
    v_table TEXT;
    v_missing_tables TEXT[] := '{}';
    v_found_count INTEGER := 0;
BEGIN
    FOREACH v_table IN ARRAY v_expected_tables
    LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = v_table
        ) THEN
            v_found_count := v_found_count + 1;
        ELSE
            v_missing_tables := array_append(v_missing_tables, v_table);
        END IF;
    END LOOP;

    -- Check availability.room_availability separately
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'availability'
        AND table_name = 'room_availability'
    ) THEN
        v_found_count := v_found_count + 1;
    ELSE
        v_missing_tables := array_append(v_missing_tables, 'availability.room_availability');
    END IF;

    RAISE NOTICE '';
    RAISE NOTICE 'Expected tables: 89';
    RAISE NOTICE 'Found tables: %', v_found_count;

    IF array_length(v_missing_tables, 1) > 0 THEN
        RAISE WARNING 'Missing tables: %', array_to_string(v_missing_tables, ', ');
    ELSE
        RAISE NOTICE '✓ All 89 tables exist!';
    END IF;
END $$;

\echo ''

-- =====================================================
-- 2. CHECK TABLE STRUCTURE
-- =====================================================
\echo '2. Table structure summary:'
\echo '--------------------------------------------'

SELECT
    t.table_schema,
    t.table_name,
    COUNT(c.column_name) AS column_count,
    COUNT(CASE WHEN c.column_name = 'deleted_at' THEN 1 END) AS has_soft_delete,
    COUNT(CASE WHEN c.column_name = 'tenant_id' THEN 1 END) AS has_tenant_id,
    COUNT(CASE WHEN c.column_name = 'created_at' THEN 1 END) AS has_audit_fields
FROM information_schema.tables t
LEFT JOIN information_schema.columns c
    ON t.table_schema = c.table_schema
    AND t.table_name = c.table_name
WHERE t.table_schema IN ('public', 'availability')
    AND t.table_type = 'BASE TABLE'
GROUP BY t.table_schema, t.table_name
ORDER BY t.table_schema, t.table_name;

\echo ''

-- =====================================================
-- 3. CHECK SOFT DELETE IMPLEMENTATION
-- =====================================================
\echo '3. Soft delete implementation:'
\echo '--------------------------------------------'

WITH soft_delete_check AS (
    SELECT
        table_name,
        CASE
            WHEN EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                AND table_name = t.table_name
                AND column_name = 'deleted_at'
            ) THEN '✓ Has soft delete'
            ELSE '✗ No soft delete'
        END AS status,
        CASE
            WHEN table_name IN ('reservation_status_history', 'analytics_metrics',
                               'analytics_metric_dimensions', 'report_property_ids',
                               'performance_reports', 'report_schedules', 'performance_thresholds',
                               'performance_baselines', 'performance_alerts', 'alert_rules')
            THEN '(Not required - audit/system table)'
            WHEN table_name = 'room_availability'
            THEN '(Not required - high-volume data)'
            ELSE ''
        END AS note
    FROM information_schema.tables t
    WHERE t.table_schema = 'public'
        AND t.table_type = 'BASE TABLE'
)
SELECT
    table_name,
    status,
    note
FROM soft_delete_check
ORDER BY
    CASE WHEN status LIKE '✓%' THEN 0 ELSE 1 END,
    table_name;

\echo ''

-- =====================================================
-- 4. CHECK PRIMARY KEYS
-- =====================================================
\echo '4. Primary key validation:'
\echo '--------------------------------------------'

SELECT
    tc.table_schema,
    tc.table_name,
    kcu.column_name,
    CASE
        WHEN c.data_type = 'uuid' THEN '✓ UUID'
        ELSE '⚠ ' || c.data_type
    END AS key_type
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.columns c
    ON kcu.table_schema = c.table_schema
    AND kcu.table_name = c.table_name
    AND kcu.column_name = c.column_name
WHERE tc.constraint_type = 'PRIMARY KEY'
    AND tc.table_schema IN ('public', 'availability')
ORDER BY tc.table_schema, tc.table_name;

\echo ''

-- =====================================================
-- 5. CHECK MULTI-TENANCY
-- =====================================================
\echo '5. Multi-tenancy implementation:'
\echo '--------------------------------------------'

SELECT
    table_name,
    CASE
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = t.table_name
            AND column_name = 'tenant_id'
        ) THEN '✓ Has tenant_id'
        WHEN table_name IN ('tenants', 'users') THEN '✓ Root table (no tenant_id needed)'
        ELSE '✗ Missing tenant_id'
    END AS status
FROM information_schema.tables t
WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
ORDER BY
    CASE
        WHEN table_name IN ('tenants', 'users') THEN 0
        ELSE 1
    END,
    table_name;

\echo ''

-- =====================================================
-- 6. CHECK AUDIT FIELDS
-- =====================================================
\echo '6. Audit trail fields:'
\echo '--------------------------------------------'

WITH audit_check AS (
    SELECT
        t.table_name,
        COUNT(CASE WHEN c.column_name = 'created_at' THEN 1 END) AS has_created_at,
        COUNT(CASE WHEN c.column_name = 'updated_at' THEN 1 END) AS has_updated_at,
        COUNT(CASE WHEN c.column_name = 'created_by' THEN 1 END) AS has_created_by,
        COUNT(CASE WHEN c.column_name = 'updated_by' THEN 1 END) AS has_updated_by
    FROM information_schema.tables t
    LEFT JOIN information_schema.columns c
        ON t.table_schema = c.table_schema
        AND t.table_name = c.table_name
    WHERE t.table_schema IN ('public', 'availability')
        AND t.table_type = 'BASE TABLE'
    GROUP BY t.table_name
)
SELECT
    table_name,
    CASE
        WHEN has_created_at + has_updated_at + has_created_by + has_updated_by = 4
        THEN '✓ Complete (4/4)'
        WHEN has_created_at + has_updated_at = 2
        THEN '⚠ Partial (2/4 - timestamps only)'
        ELSE '✗ Incomplete (' || (has_created_at + has_updated_at + has_created_by + has_updated_by) || '/4)'
    END AS audit_status
FROM audit_check
ORDER BY
    (has_created_at + has_updated_at + has_created_by + has_updated_by) DESC,
    table_name;

\echo ''

-- =====================================================
-- 7. CHECK JSONB COLUMNS
-- =====================================================
\echo '7. JSONB columns for flexibility:'
\echo '--------------------------------------------'

SELECT
    table_name,
    column_name,
    is_nullable
FROM information_schema.columns
WHERE table_schema IN ('public', 'availability')
    AND data_type = 'jsonb'
ORDER BY table_name, column_name;

\echo ''

-- =====================================================
-- 8. CHECK UNIQUE CONSTRAINTS
-- =====================================================
\echo '8. Unique constraints:'
\echo '--------------------------------------------'

SELECT
    tc.table_name,
    tc.constraint_name,
    string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) AS columns
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'UNIQUE'
    AND tc.table_schema IN ('public', 'availability')
GROUP BY tc.table_name, tc.constraint_name
ORDER BY tc.table_name;

\echo ''

-- =====================================================
-- 9. CHECK TABLE SIZES
-- =====================================================
\echo '9. Table sizes (after creation):'
\echo '--------------------------------------------'

SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) -
                   pg_relation_size(schemaname||'.'||tablename)) AS indexes_size
FROM pg_tables
WHERE schemaname IN ('public', 'availability')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

\echo ''

-- =====================================================
-- SUMMARY
-- =====================================================
\echo '=============================================='
\echo '  VERIFICATION SUMMARY'
\echo '=============================================='

DO $$
DECLARE
    v_table_count INTEGER;
    v_soft_delete_count INTEGER;
    v_tenant_id_count INTEGER;
    v_audit_count INTEGER;
BEGIN
    -- Count tables
    SELECT COUNT(*) INTO v_table_count
    FROM information_schema.tables
    WHERE table_schema IN ('public', 'availability')
        AND table_type = 'BASE TABLE';

    -- Count soft delete tables
    SELECT COUNT(DISTINCT table_name) INTO v_soft_delete_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
        AND column_name = 'deleted_at';

    -- Count tenant_id tables
    SELECT COUNT(DISTINCT table_name) INTO v_tenant_id_count
    FROM information_schema.columns
    WHERE table_schema IN ('public', 'availability')
        AND column_name = 'tenant_id';

    -- Count audit fields
    SELECT COUNT(DISTINCT table_name) INTO v_audit_count
    FROM information_schema.columns
    WHERE table_schema IN ('public', 'availability')
        AND column_name IN ('created_at', 'updated_at');

    RAISE NOTICE '';
    RAISE NOTICE 'Total Tables: % (Expected: 89)', v_table_count;
    RAISE NOTICE 'With Soft Delete: % (Expected: 80+)', v_soft_delete_count;
    RAISE NOTICE 'With tenant_id: % (Expected: 85+)', v_tenant_id_count;
    RAISE NOTICE 'With Audit Fields: % (Expected: 89)', v_audit_count;
    RAISE NOTICE '';

    IF v_table_count >= 89 AND
       v_soft_delete_count >= 80 AND
       v_tenant_id_count >= 85 THEN
        RAISE NOTICE '✓✓✓ ALL TABLE VALIDATIONS PASSED ✓✓✓';
    ELSE
        RAISE WARNING '⚠⚠⚠ SOME VALIDATIONS FAILED ⚠⚠⚠';
        RAISE WARNING 'Please review the output above for details.';
    END IF;
END $$;

\echo ''
\echo '=============================================='
\echo 'Table verification complete!'
\echo '=============================================='
