-- =====================================================
-- 00-create-all-indexes.sql
-- Master script to create all indexes
-- Run this after tables are created
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo ''
\echo '============================================='
\echo 'CREATING ALL INDEXES'
\echo 'Performance optimization for Tartware PMS'
\echo '============================================='
\echo ''

-- Execute all index files in order
\i indexes/01_tenants_indexes.sql
\i indexes/02_users_indexes.sql
\i indexes/03_user_tenant_associations_indexes.sql
\i indexes/04_properties_indexes.sql
\i indexes/05_guests_indexes.sql
\i indexes/06_room_types_indexes.sql
\i indexes/07_rooms_indexes.sql
\i indexes/08_rates_indexes.sql
\i indexes/09_availability_room_availability_indexes.sql
\i indexes/10_reservations_indexes.sql
\i indexes/11_reservation_status_history_indexes.sql
\i indexes/12_payments_indexes.sql
\i indexes/13_invoices_indexes.sql
\i indexes/14_invoice_items_indexes.sql
\i indexes/15_services_indexes.sql
\i indexes/16_reservation_services_indexes.sql
\i indexes/17_housekeeping_tasks_indexes.sql
\i indexes/18_channel_mappings_indexes.sql
\i indexes/19_analytics_metrics_indexes.sql
\i indexes/20_analytics_metric_dimensions_indexes.sql
\i indexes/21_analytics_reports_indexes.sql
\i indexes/22_report_property_ids_indexes.sql
\i indexes/23_performance_reporting_indexes.sql
\i indexes/24_performance_alerting_indexes.sql
\i indexes/25_folios_indexes.sql
\i indexes/26_charge_postings_indexes.sql
\i indexes/27_audit_logs_indexes.sql
\i indexes/28_business_dates_indexes.sql
\i indexes/29_night_audit_log_indexes.sql
\i indexes/30_deposit_schedules_indexes.sql
\i indexes/31_allotments_indexes.sql
\i indexes/32_booking_sources_indexes.sql
\i indexes/33_market_segments_indexes.sql
\i indexes/34_guest_preferences_indexes.sql
\i indexes/35_refunds_indexes.sql
\i indexes/36_rate_overrides_indexes.sql
\i indexes/37_maintenance_requests_indexes.sql

\echo ''
\echo '============================================='
\echo '✓ ALL INDEXES CREATED SUCCESSFULLY!'
\echo '============================================='
\echo ''
\echo 'Index Summary:'
\echo '  - Total index files: 37'
\echo '  - Estimated total indexes: 350+'
\echo '  - Index types:'
\echo '    • B-tree (standard indexes)'
\echo '    • GIN (JSONB indexes)'
\echo '    • Trigram (full-text search)'
\echo '    • Partial (WHERE clause filters)'
\echo '    • Composite (multi-column)'
\echo ''
\echo 'Next steps:'
\echo '  1. Create foreign key constraints'
\echo '  2. Create stored procedures (optional)'
\echo '  3. Load sample data'
\echo '============================================='
\echo ''
