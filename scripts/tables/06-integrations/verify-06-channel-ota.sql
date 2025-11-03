-- =====================================================
-- verify-06-channel-ota.sql
-- Verification Script for Channel Management & OTA Tables
-- Category: 06-channel-ota (10 tables)
-- Date: 2025-10-19
-- =====================================================

\c tartware

\echo ''
\echo '=============================================='
\echo '  CATEGORY: CHANNEL MANAGEMENT & DISTRIBUTION VERIFICATION'
\echo '  Tables: 10 | Description: OTA, GDS, and distribution channel integrations'
\echo '=============================================='
\echo ''

-- =====================================================
-- 1. CHECK IF ALL TABLES EXIST
-- =====================================================
\echo '1. Checking if all 10 tables exist...'

DO $$
DECLARE
    v_expected_tables TEXT[] := ARRAY['channel_mappings', 'ota_configurations', 'ota_rate_plans', 'ota_reservations_queue', 'ota_inventory_sync', 'channel_rate_parity', 'channel_commission_rules', 'gds_connections', 'gds_message_log', 'gds_reservation_queue'];
    v_table TEXT;
    v_missing_tables TEXT[] := '{}'::TEXT[];
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
            RAISE NOTICE '  ✓ % exists', v_table;
        ELSE
            v_missing_tables := array_append(v_missing_tables, v_table);
            RAISE WARNING '  ✗ % is MISSING', v_table;
        END IF;
    END LOOP;

    RAISE NOTICE '';
    IF array_length(v_missing_tables, 1) > 0 THEN
        RAISE WARNING 'Missing tables: %', array_to_string(v_missing_tables, ', ');
        RAISE EXCEPTION 'Channel Management & OTA verification FAILED - missing tables!';
    ELSE
        RAISE NOTICE '✓✓✓ All 10 Channel Management & Distribution tables exist!';
    END IF;
END $$;

\echo ''

-- =====================================================
-- 2. CHECK TABLE STRUCTURE SUMMARY
-- =====================================================
\echo '2. Table structure summary...'

SELECT
    t.table_name,
    COUNT(c.column_name) AS column_count,
    COUNT(CASE WHEN c.column_name = 'tenant_id' THEN 1 END) AS has_tenant_id,
    COUNT(CASE WHEN c.column_name = 'is_deleted' THEN 1 END) AS has_soft_delete,
    COUNT(CASE WHEN c.column_name = 'created_at' THEN 1 END) AS has_audit
FROM information_schema.tables t
LEFT JOIN information_schema.columns c
    ON t.table_schema = c.table_schema
    AND t.table_name = c.table_name
WHERE t.table_name IN ('channel_mappings', 'ota_configurations', 'ota_rate_plans', 'ota_reservations_queue', 'ota_inventory_sync', 'channel_rate_parity', 'channel_commission_rules', 'gds_connections', 'gds_message_log', 'gds_reservation_queue')
    AND t.table_schema = 'public'
GROUP BY t.table_schema, t.table_name
ORDER BY t.table_name;

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
BEGIN
    SELECT COUNT(*) INTO v_table_count
    FROM information_schema.tables t
    WHERE t.table_name IN ('channel_mappings', 'ota_configurations', 'ota_rate_plans', 'ota_reservations_queue', 'ota_inventory_sync', 'channel_rate_parity', 'channel_commission_rules', 'gds_connections', 'gds_message_log', 'gds_reservation_queue')
        AND t.table_schema = 'public';

    RAISE NOTICE '';
    RAISE NOTICE 'Category: Channel Management & Distribution';
    RAISE NOTICE 'Tables Found: % / 10', v_table_count;
    RAISE NOTICE '';

    IF v_table_count = 10 THEN
        RAISE NOTICE '✓✓✓ CHANNEL MANAGEMENT & DISTRIBUTION VERIFICATION PASSED ✓✓✓';
    ELSE
        RAISE WARNING '⚠⚠⚠ CHANNEL MANAGEMENT & DISTRIBUTION VERIFICATION FAILED ⚠⚠⚠';
        RAISE WARNING 'Expected 10 tables, found %', v_table_count;
    END IF;
END $$;

\echo ''
\echo '=============================================='
\echo 'Channel Management & Distribution verification complete!'
\echo '=============================================='
