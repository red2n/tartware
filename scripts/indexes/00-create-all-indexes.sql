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

\echo ''
\echo '============================================='
\echo '✓ ALL INDEXES CREATED SUCCESSFULLY!'
\echo '============================================='
\echo ''
\echo 'Index Summary:'
\echo '  - Total index files: 22'
\echo '  - Estimated total indexes: 250+'
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
