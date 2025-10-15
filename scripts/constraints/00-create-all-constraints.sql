-- =====================================================
-- 00-create-all-constraints.sql
-- Master Script to Create All Foreign Key Constraints
-- Date: 2025-10-15
--
-- Purpose: Orchestrate creation of all foreign key constraints
--          in the correct order to respect table dependencies
--
-- Usage: Execute this after all tables and indexes are created
--        psql -U postgres -d tartware -f 00-create-all-constraints.sql
-- =====================================================

\c tartware

\echo '=============================================='
\echo '  TARTWARE PMS - FOREIGN KEY CONSTRAINTS'
\echo '  Phase 2B: Data Integrity Layer'
\echo '=============================================='
\echo ''

-- Check if all tables exist before creating constraints
DO $$
DECLARE
    missing_tables TEXT;
BEGIN
    SELECT string_agg(required_table, ', ')
    INTO missing_tables
    FROM (
        SELECT unnest(ARRAY[
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
            'refunds', 'rate_overrides', 'maintenance_requests'
        ]) AS required_table
    ) t
    WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = t.required_table
    )
    AND NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'availability'
        AND table_name = 'room_availability'
    );

    IF missing_tables IS NOT NULL THEN
        RAISE EXCEPTION 'Cannot create constraints. Missing tables: %', missing_tables;
    END IF;
END $$;

\echo '✓ All required tables exist'
\echo ''

-- =====================================================
-- EXECUTION ORDER (respecting table dependencies)
-- =====================================================

\echo '1/20 Creating user_tenant_associations constraints...'
\i 01_user_tenant_associations_fk.sql
\echo ''

\echo '2/20 Creating properties constraints...'
\i 02_properties_fk.sql
\echo ''

\echo '3/20 Creating guests constraints...'
\i 03_guests_fk.sql
\echo ''

\echo '4/20 Creating room_types constraints...'
\i 04_room_types_fk.sql
\echo ''

\echo '5/20 Creating rooms constraints...'
\i 05_rooms_fk.sql
\echo ''

\echo '6/20 Creating rates constraints...'
\i 06_rates_fk.sql
\echo ''

\echo '7/20 Creating availability.room_availability constraints...'
\i 07_availability_room_availability_fk.sql
\echo ''

\echo '8/20 Creating reservations constraints...'
\i 08_reservations_fk.sql
\echo ''

\echo '9/20 Creating reservation_status_history constraints...'
\i 09_reservation_status_history_fk.sql
\echo ''

\echo '10/20 Creating payments constraints...'
\i 10_payments_fk.sql
\echo ''

\echo '11/20 Creating invoices constraints...'
\i 11_invoices_fk.sql
\echo ''

\echo '12/20 Creating invoice_items constraints...'
\i 12_invoice_items_fk.sql
\echo ''

\echo '13/20 Creating services constraints...'
\i 13_services_fk.sql
\echo ''

\echo '14/20 Creating reservation_services constraints...'
\i 14_reservation_services_fk.sql
\echo ''

\echo '15/20 Creating housekeeping_tasks constraints...'
\i 15_housekeeping_tasks_fk.sql
\echo ''

\echo '16/20 Creating channel_mappings constraints...'
\i 16_channel_mappings_fk.sql
\echo ''

\echo '17/20 Creating analytics_metrics constraints...'
\i 17_analytics_metrics_fk.sql
\echo ''

\echo '18/20 Creating analytics_metric_dimensions constraints...'
\i 18_analytics_metric_dimensions_fk.sql
\echo ''

\echo '19/20 Creating analytics_reports constraints...'
\i 19_analytics_reports_fk.sql
\echo ''

\echo '20/37 Creating report_property_ids constraints...'
\i 20_report_property_ids_fk.sql
\echo ''

\echo '21/37 Creating analytics_metrics constraints (updated)...'
\i 21_analytics_metrics_fk.sql
\echo ''

\echo '22/37 Creating analytics_metric_dimensions constraints (updated)...'
\i 22_analytics_metric_dimensions_fk.sql
\echo ''

\echo '23/37 Creating performance_reporting constraints...'
\i 23_performance_reporting_fk.sql
\echo ''

\echo '24/37 Creating performance_alerting constraints...'
\i 24_performance_alerting_fk.sql
\echo ''

\echo '25/37 Creating folios constraints...'
\i 25_folios_fk.sql
\echo ''

\echo '26/37 Creating charge_postings constraints...'
\i 26_charge_postings_fk.sql
\echo ''

\echo '27/37 Creating audit_logs constraints...'
\i 27_audit_logs_fk.sql
\echo ''

\echo '28/37 Creating business_dates constraints...'
\i 28_business_dates_fk.sql
\echo ''

\echo '29/37 Creating night_audit_log constraints...'
\i 29_night_audit_log_fk.sql
\echo ''

\echo '30/37 Creating deposit_schedules constraints...'
\i 30_deposit_schedules_fk.sql
\echo ''

\echo '31/37 Creating allotments constraints...'
\i 31_allotments_fk.sql
\echo ''

\echo '32/37 Creating booking_sources constraints...'
\i 32_booking_sources_fk.sql
\echo ''

\echo '33/37 Creating market_segments constraints...'
\i 33_market_segments_fk.sql
\echo ''

\echo '34/37 Creating guest_preferences constraints...'
\i 34_guest_preferences_fk.sql
\echo ''

\echo '35/37 Creating refunds constraints...'
\i 35_refunds_fk.sql
\echo ''

\echo '36/37 Creating rate_overrides constraints...'
\i 36_rate_overrides_fk.sql
\echo ''

\echo '37/37 Creating maintenance_requests constraints...'
\i 37_maintenance_requests_fk.sql
\echo ''

-- =====================================================
-- VERIFICATION
-- =====================================================

\echo '=============================================='
\echo '  CONSTRAINT CREATION SUMMARY'
\echo '=============================================='

SELECT
    tc.table_schema,
    tc.table_name,
    COUNT(*) as foreign_key_count
FROM information_schema.table_constraints tc
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema IN ('public', 'availability')
GROUP BY tc.table_schema, tc.table_name
ORDER BY tc.table_schema, tc.table_name;

\echo ''
\echo '=============================================='
\echo '  TOTAL FOREIGN KEY CONSTRAINTS'
\echo '=============================================='

SELECT
    COUNT(*) as total_foreign_keys
FROM information_schema.table_constraints
WHERE constraint_type = 'FOREIGN KEY'
AND table_schema IN ('public', 'availability');

\echo ''
\echo '✓ All foreign key constraints created successfully!'
\echo ''
\echo 'IMPORTANT NOTES:'
\echo '- All constraints use ON DELETE RESTRICT'
\echo '- Hard deletes require HARD_DELETE permission'
\echo '- Soft delete pattern enforced at application layer'
\echo '- Always filter: WHERE deleted_at IS NULL'
\echo ''
