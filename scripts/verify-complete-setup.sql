-- =====================================================
-- Complete Database Setup Verification
-- Checks tables, indexes, constraints, and data
-- =====================================================

\c tartware

\echo ''
\echo '=========================================================='
\echo '  TARTWARE PMS - COMPLETE SETUP VERIFICATION'
\echo '=========================================================='
\echo ''

-- =====================================================
-- 1. TABLE VERIFICATION
-- =====================================================
\echo '1. TABLE VERIFICATION'
\echo '---'

-- Count total tables
\echo 'Total Tables Created:'
SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public';

\echo ''
\echo 'Tables by Category:'
WITH table_categories AS (
    SELECT
        tablename,
        CASE
            WHEN tablename IN (
                'tenants', 'users', 'user_tenant_associations', 'properties', 'guests'
            ) THEN '01-Core Foundation'
            WHEN tablename IN (
                'room_types', 'rooms', 'rates', 'rate_overrides', 'revenue_forecasts',
                'competitor_rates', 'demand_calendar', 'pricing_rules', 'rate_recommendations',
                'revenue_goals', 'companies', 'group_bookings', 'packages',
                'travel_agent_commissions', 'meeting_rooms', 'event_bookings',
                'banquet_event_orders', 'availability_room_availability'
            ) THEN '02-Inventory & Revenue'
            WHEN tablename IN (
                'reservations', 'reservation_status_history', 'deposit_schedules', 'allotments',
                'booking_sources', 'market_segments', 'guest_preferences',
                'guest_communications', 'communication_templates', 'guest_feedback',
                'guest_loyalty_programs', 'guest_documents', 'guest_notes',
                'automated_messages', 'reservation_traces', 'waitlist_entries'
            ) THEN '03-Bookings & Guest Experience'
            WHEN tablename IN (
                'payments', 'invoices', 'invoice_items', 'folios', 'charge_postings',
                'refunds', 'tax_configurations', 'financial_closures', 'commission_tracking',
                'cashier_sessions', 'accounts_receivable', 'credit_limits',
                'payment_tokens', 'general_ledger_batches', 'general_ledger_entries'
            ) THEN '04-Financial Management'
            WHEN tablename IN (
                'services', 'reservation_services', 'housekeeping_tasks', 'maintenance_requests',
                'staff_schedules', 'staff_tasks', 'shift_handovers', 'lost_and_found',
                'incident_reports', 'vendor_contracts', 'mobile_check_ins', 'asset_inventory',
                'minibar_items', 'minibar_consumption', 'vehicles', 'transportation_requests',
                'shuttle_schedules', 'spa_treatments', 'spa_appointments', 'mobile_keys',
                'qr_codes', 'push_notifications', 'app_usage_analytics', 'smart_room_devices'
            ) THEN '05-Operations & Guest Services'
            WHEN tablename IN (
                'channel_mappings', 'ota_configurations', 'ota_rate_plans', 'ota_reservations_queue',
                'gds_connections', 'gds_message_log', 'gds_reservation_queue', 'ota_inventory_sync',
                'channel_rate_parity', 'channel_commission_rules', 'marketing_campaigns',
                'campaign_segments', 'promotional_codes', 'referral_tracking',
                'social_media_mentions', 'integration_mappings', 'api_logs',
                'webhook_subscriptions', 'data_sync_status', 'ai_demand_predictions',
                'dynamic_pricing_rules_ml', 'guest_behavior_patterns', 'sentiment_analysis'
            ) THEN '06-Integrations & Intelligence'
            WHEN tablename IN (
                'analytics_metrics', 'analytics_metric_dimensions', 'analytics_reports',
                'report_property_ids', 'performance_reporting_tables', 'performance_alerting_tables',
                'audit_logs', 'business_dates', 'night_audit_log', 'gdpr_consent_logs',
                'police_reports', 'contract_agreements', 'insurance_claims',
                'guest_journey_tracking', 'revenue_attribution', 'forecasting_models',
                'ab_test_results', 'sustainability_metrics'
            ) THEN '07-Analytics & Compliance'
            ELSE '99-Other'
        END as category
    FROM pg_tables
    WHERE schemaname = 'public'
)
SELECT
    category,
    COUNT(*) as table_count,
    string_agg(tablename, ', ' ORDER BY tablename) as tables
FROM table_categories
GROUP BY category
ORDER BY category;

-- =====================================================
-- 2. INDEX VERIFICATION
-- =====================================================
\echo ''
\echo '=========================================================='
\echo '2. INDEX VERIFICATION'
\echo '---'

\echo 'Total Indexes Created:'
SELECT COUNT(*) as index_count FROM pg_indexes WHERE schemaname = 'public';

\echo ''
\echo 'Top 15 Tables by Index Count:'
SELECT
    tablename,
    COUNT(*) as index_count
FROM pg_indexes
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY index_count DESC
LIMIT 15;

\echo ''
\echo 'Index Types Summary:'
SELECT
    CASE
        WHEN indexdef LIKE '%UNIQUE%' THEN 'UNIQUE'
        WHEN indexdef LIKE '%WHERE%' THEN 'PARTIAL'
        WHEN indexdef LIKE '%USING gin%' THEN 'GIN'
        WHEN indexdef LIKE '%USING gist%' THEN 'GIST'
        ELSE 'STANDARD'
    END as index_type,
    COUNT(*) as count
FROM pg_indexes
WHERE schemaname = 'public'
GROUP BY index_type
ORDER BY count DESC;

-- =====================================================
-- 3. CONSTRAINT VERIFICATION
-- =====================================================
\echo ''
\echo '=========================================================='
\echo '3. CONSTRAINT VERIFICATION'
\echo '---'

\echo 'Total Foreign Key Constraints:'
SELECT COUNT(*) as fk_count
FROM information_schema.table_constraints
WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public';

\echo ''
\echo 'Top 15 Tables by Foreign Key Count:'
SELECT
    tc.table_name,
    COUNT(*) as fk_count
FROM information_schema.table_constraints tc
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
GROUP BY tc.table_name
ORDER BY fk_count DESC
LIMIT 15;

\echo ''
\echo 'All Constraint Types:'
SELECT
    constraint_type,
    COUNT(*) as count
FROM information_schema.table_constraints
WHERE table_schema = 'public'
GROUP BY constraint_type
ORDER BY count DESC;

-- =====================================================
-- 4. ENUM TYPE VERIFICATION
-- =====================================================
\echo ''
\echo '=========================================================='
\echo '4. ENUM TYPE VERIFICATION'
\echo '---'

\echo 'Total ENUM Types:'
SELECT COUNT(*) as enum_count FROM pg_type WHERE typtype = 'e';

\echo ''
\echo 'ENUM Types by Category:'
SELECT
    CASE
        WHEN typname LIKE '%status%' THEN 'Status Types'
        WHEN typname LIKE '%type%' THEN 'Type Classifications'
        WHEN typname LIKE '%method%' THEN 'Methods'
        WHEN typname LIKE '%level%' THEN 'Levels'
        WHEN typname LIKE '%category%' THEN 'Categories'
        WHEN typname LIKE '%mode%' THEN 'Modes'
        ELSE 'Other'
    END as enum_category,
    COUNT(*) as count
FROM pg_type
WHERE typtype = 'e'
GROUP BY enum_category
ORDER BY count DESC;

-- =====================================================
-- 5. DATA VERIFICATION
-- =====================================================
\echo ''
\echo '=========================================================='
\echo '5. SAMPLE DATA VERIFICATION'
\echo '---'

\echo 'Core Tables Data Count:'
SELECT 'Tenants' as table_name, COUNT(*)::text as row_count FROM tenants
UNION ALL SELECT 'Users', COUNT(*)::text FROM users
UNION ALL SELECT 'Properties', COUNT(*)::text FROM properties
UNION ALL SELECT 'Guests', COUNT(*)::text FROM guests
UNION ALL SELECT 'Room Types', COUNT(*)::text FROM room_types
UNION ALL SELECT 'Rooms', COUNT(*)::text FROM rooms
UNION ALL SELECT 'Rates', COUNT(*)::text FROM rates
UNION ALL SELECT 'Reservations', COUNT(*)::text FROM reservations
UNION ALL SELECT 'Payments', COUNT(*)::text FROM payments
UNION ALL SELECT 'Invoices', COUNT(*)::text FROM invoices
UNION ALL SELECT 'Invoice Items', COUNT(*)::text FROM invoice_items
UNION ALL SELECT 'Services', COUNT(*)::text FROM services
UNION ALL SELECT 'Housekeeping Tasks', COUNT(*)::text FROM housekeeping_tasks
UNION ALL SELECT '---TOTAL---', (
    (SELECT COUNT(*) FROM tenants) +
    (SELECT COUNT(*) FROM users) +
    (SELECT COUNT(*) FROM properties) +
    (SELECT COUNT(*) FROM guests) +
    (SELECT COUNT(*) FROM room_types) +
    (SELECT COUNT(*) FROM rooms) +
    (SELECT COUNT(*) FROM rates) +
    (SELECT COUNT(*) FROM reservations) +
    (SELECT COUNT(*) FROM payments) +
    (SELECT COUNT(*) FROM invoices) +
    (SELECT COUNT(*) FROM invoice_items) +
    (SELECT COUNT(*) FROM services) +
    (SELECT COUNT(*) FROM housekeeping_tasks)
)::text
ORDER BY table_name;

-- =====================================================
-- 6. MULTI-TENANCY VERIFICATION
-- =====================================================
\echo ''
\echo '=========================================================='
\echo '6. MULTI-TENANCY VERIFICATION'
\echo '---'

\echo 'Tenant Distribution:'
SELECT
    t.name as tenant_name,
    (SELECT COUNT(*) FROM properties WHERE tenant_id = t.id) as properties,
    (SELECT COUNT(*) FROM users u
     JOIN user_tenant_associations uta ON u.id = uta.user_id
     WHERE uta.tenant_id = t.id) as users,
    (SELECT COUNT(*) FROM reservations WHERE tenant_id = t.id) as reservations
FROM tenants t
ORDER BY t.name;

-- =====================================================
-- 7. ADVANCED FEATURES VERIFICATION
-- =====================================================
\echo ''
\echo '=========================================================='
\echo '7. ADVANCED FEATURES VERIFICATION'
\echo '---'

\echo 'AI/ML Tables:'
SELECT
    'ai_demand_predictions' as table_name,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_demand_predictions') THEN '✓ Created' ELSE '✗ Missing' END as status
UNION ALL SELECT 'dynamic_pricing_rules_ml', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'dynamic_pricing_rules_ml') THEN '✓ Created' ELSE '✗ Missing' END
UNION ALL SELECT 'guest_behavior_patterns', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'guest_behavior_patterns') THEN '✓ Created' ELSE '✗ Missing' END
UNION ALL SELECT 'sentiment_analysis', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sentiment_analysis') THEN '✓ Created' ELSE '✗ Missing' END;

\echo ''
\echo 'Sustainability Tables:'
SELECT
    'sustainability_metrics' as table_name,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sustainability_metrics') THEN '✓ Created' ELSE '✗ Missing' END as status
UNION ALL SELECT 'green_certifications', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'green_certifications') THEN '✓ Created' ELSE '✗ Missing' END
UNION ALL SELECT 'carbon_offset_programs', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'carbon_offset_programs') THEN '✓ Created' ELSE '✗ Missing' END
UNION ALL SELECT 'sustainability_initiatives', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sustainability_initiatives') THEN '✓ Created' ELSE '✗ Missing' END;

\echo ''
\echo 'IoT/Smart Rooms Tables:'
SELECT
    'smart_room_devices' as table_name,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'smart_room_devices') THEN '✓ Created' ELSE '✗ Missing' END as status
UNION ALL SELECT 'room_energy_usage', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'room_energy_usage') THEN '✓ Created' ELSE '✗ Missing' END
UNION ALL SELECT 'guest_room_preferences', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'guest_room_preferences') THEN '✓ Created' ELSE '✗ Missing' END
UNION ALL SELECT 'device_events_log', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'device_events_log') THEN '✓ Created' ELSE '✗ Missing' END;

\echo ''
\echo 'Asset Management Tables:'
SELECT
    'asset_inventory' as table_name,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'asset_inventory') THEN '✓ Created' ELSE '✗ Missing' END as status
UNION ALL SELECT 'predictive_maintenance_alerts', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'predictive_maintenance_alerts') THEN '✓ Created' ELSE '✗ Missing' END
UNION ALL SELECT 'maintenance_history', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'maintenance_history') THEN '✓ Created' ELSE '✗ Missing' END;

-- =====================================================
-- 8. DATABASE SIZE AND PERFORMANCE
-- =====================================================
\echo ''
\echo '=========================================================='
\echo '8. DATABASE SIZE AND PERFORMANCE'
\echo '---'

\echo 'Database Size:'
SELECT pg_size_pretty(pg_database_size('tartware')) as database_size;

\echo ''
\echo 'Top 10 Largest Tables:'
SELECT
    schemaname || '.' || tablename as table_name,
    pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) as total_size,
    pg_size_pretty(pg_relation_size(schemaname || '.' || tablename)) as table_size,
    pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename) - pg_relation_size(schemaname || '.' || tablename)) as indexes_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC
LIMIT 10;

-- =====================================================
-- FINAL SUMMARY
-- =====================================================
\echo ''
\echo '=========================================================='
\echo '  VERIFICATION COMPLETE'
\echo '=========================================================='
\echo ''

WITH metrics AS (
    SELECT
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema IN ('public', 'availability') AND table_type = 'BASE TABLE') AS table_count,
        (SELECT COUNT(*) FROM pg_indexes WHERE schemaname IN ('public', 'availability')) AS index_count,
        (SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY' AND table_schema IN ('public', 'availability')) AS fk_count,
        (SELECT COUNT(*) FROM pg_type
            JOIN pg_namespace ON pg_type.typnamespace = pg_namespace.oid
            WHERE pg_type.typtype = 'e' AND pg_namespace.nspname IN ('public', 'availability')
        ) AS enum_count,
        (SELECT COUNT(*) FROM tenants) +
        (SELECT COUNT(*) FROM users) +
        (SELECT COUNT(*) FROM reservations) AS sample_rows
)
SELECT '✓ Tables (public+availability): ' || table_count::text AS status FROM metrics
UNION ALL SELECT '✓ Indexes (public+availability): ' || index_count::text FROM metrics
UNION ALL SELECT '✓ Foreign Keys (public+availability): ' || fk_count::text FROM metrics
UNION ALL SELECT '✓ ENUM Types (tracked schemas): ' || enum_count::text FROM metrics
UNION ALL SELECT '✓ Sample Data Rows (tenants+users+reservations): ' || sample_rows::text FROM metrics;

\echo ''
\echo '✅ Database is ready for use!'
\echo ''
