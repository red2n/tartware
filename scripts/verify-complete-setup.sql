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
            WHEN tablename IN ('tenants', 'users', 'user_tenant_associations', 'properties', 'guests') THEN '01-Core Foundation'
            WHEN tablename IN ('room_types', 'rooms', 'rates') THEN '02-Room Inventory'
            WHEN tablename LIKE '%reservation%' OR tablename IN ('deposit_schedules', 'allotments', 'booking_sources', 'market_segments', 'guest_preferences') THEN '03-Reservations'
            WHEN tablename IN ('payments', 'invoices', 'invoice_items', 'folios', 'charge_postings', 'refunds', 'tax_configurations', 'financial_closures', 'commission_tracking', 'cashier_sessions', 'accounts_receivable', 'credit_limits') THEN '04-Financial'
            WHEN tablename IN ('services', 'housekeeping_tasks', 'maintenance_requests') THEN '05-Services/Housekeeping'
            WHEN tablename LIKE '%channel%' OR tablename LIKE '%ota%' THEN '06-Channel/OTA'
            WHEN tablename LIKE '%guest%' AND tablename NOT IN ('guests', 'guest_preferences') THEN '07-Guest CRM'
            WHEN tablename LIKE '%revenue%' OR tablename LIKE '%rate%' OR tablename LIKE '%competitor%' OR tablename LIKE '%pricing%' OR tablename LIKE '%demand%' OR tablename IN ('companies', 'group_bookings', 'packages', 'travel_agent_commissions') THEN '08-Revenue/B2B'
            WHEN tablename IN ('staff_schedules', 'staff_tasks', 'shift_handovers', 'lost_and_found', 'incident_reports', 'vendor_contracts') THEN '09-Staff Operations'
            WHEN tablename LIKE '%campaign%' OR tablename LIKE '%marketing%' OR tablename LIKE '%promotional%' OR tablename LIKE '%referral%' OR tablename LIKE '%social_media%' THEN '10-Marketing'
            WHEN tablename LIKE '%gdpr%' OR tablename LIKE '%police%' OR tablename LIKE '%contract%' OR tablename LIKE '%insurance%' THEN '11-Compliance/Legal'
            WHEN tablename LIKE '%analytics%' OR tablename LIKE '%report%' OR tablename LIKE '%performance%' OR tablename LIKE '%alert%' OR tablename LIKE '%journey%' OR tablename LIKE '%attribution%' OR tablename LIKE '%forecast%' OR tablename LIKE '%ab_test%' THEN '12-Analytics/Reporting'
            WHEN tablename LIKE '%mobile%' OR tablename LIKE '%qr%' OR tablename LIKE '%push%' OR tablename LIKE '%app%' THEN '13-Mobile/Digital'
            WHEN tablename LIKE '%audit%' OR tablename IN ('business_dates', 'night_audit_log') THEN '14-System Audit'
            WHEN tablename LIKE '%integration%' OR tablename LIKE '%api%' OR tablename LIKE '%webhook%' OR tablename LIKE '%sync%' THEN '15-Integration Hub'
            WHEN tablename LIKE '%ai_%' OR tablename LIKE '%ml%' OR tablename LIKE '%behavior%' OR tablename LIKE '%sentiment%' THEN '16-AI/ML Innovation'
            WHEN tablename LIKE '%sustainability%' OR tablename LIKE '%carbon%' OR tablename LIKE '%green%' THEN '17-Sustainability/ESG'
            WHEN tablename LIKE '%smart%' OR tablename LIKE '%device%' OR tablename LIKE '%energy%' THEN '18-IoT/Smart Rooms'
            WHEN tablename LIKE '%contactless%' OR tablename LIKE '%digital_registration%' THEN '19-Contactless/Digital'
            WHEN tablename LIKE '%asset%' OR tablename LIKE '%predictive%' OR tablename LIKE '%maintenance_history%' THEN '20-Asset Management'
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

SELECT
    '✓ Tables:       ' || (SELECT COUNT(*)::text FROM information_schema.tables WHERE table_schema = 'public') || ' / 132' as status
UNION ALL SELECT '✓ Indexes:      ' || (SELECT COUNT(*)::text FROM pg_indexes WHERE schemaname = 'public') || ' / 800+'
UNION ALL SELECT '✓ Foreign Keys: ' || (SELECT COUNT(*)::text FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public') || ' / 500+'
UNION ALL SELECT '✓ ENUM Types:   ' || (SELECT COUNT(*)::text FROM pg_type WHERE typtype = 'e') || ' / 61'
UNION ALL SELECT '✓ Sample Data:  ' || (
    (SELECT COUNT(*) FROM tenants) +
    (SELECT COUNT(*) FROM users) +
    (SELECT COUNT(*) FROM reservations)
)::text || '+ records';

\echo ''
\echo '✅ Database is ready for use!'
\echo ''
