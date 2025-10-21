-- =====================================================
-- 00-create-all-constraints.sql
-- Master Script to Create All Foreign Key Constraints
-- Date: 2025-10-21
-- =====================================================

\c tartware

\echo ''
\echo '============================================='
\echo 'CREATING ALL TABLE CONSTRAINTS'
\echo 'Data Integrity Layer for Tartware PMS'
\echo '============================================='
\echo ''

-- =====================================================
-- CATEGORY 1: CORE FOUNDATION (3 constraint files)
-- =====================================================

\echo '>>> Creating Core Foundation Constraints (1-3)...'
\i 01_user_tenant_associations_fk.sql
\i 02_properties_fk.sql
\i 03_guests_fk.sql

-- =====================================================
-- CATEGORY 2: ROOM & INVENTORY MANAGEMENT (4 files)
-- =====================================================

\echo '>>> Creating Room & Inventory Constraints (4-7)...'
\i 04_room_types_fk.sql
\i 05_rooms_fk.sql
\i 06_rates_fk.sql
\i 07_availability_room_availability_fk.sql

-- =====================================================
-- CATEGORY 3: RESERVATIONS & BOOKING (2 files)
-- =====================================================

\echo '>>> Creating Reservations & Booking Constraints (8-9)...'
\i 08_reservations_fk.sql
\i 09_reservation_status_history_fk.sql

-- =====================================================
-- CATEGORY 4: FINANCIAL MANAGEMENT (4 files)
-- =====================================================

\echo '>>> Creating Financial Management Constraints (10-13)...'
\i 10_payments_fk.sql
\i 11_invoices_fk.sql
\i 12_invoice_items_fk.sql
\i 13_services_fk.sql

-- =====================================================
-- CATEGORY 5: RESERVATION SERVICES (1 file)
-- =====================================================

\echo '>>> Creating Reservation Services Constraints (14)...'
\i 14_reservation_services_fk.sql

-- =====================================================
-- CATEGORY 6: HOUSEKEEPING (1 file)
-- =====================================================

\echo '>>> Creating Housekeeping Constraints (15)...'
\i 15_housekeeping_tasks_fk.sql

-- =====================================================
-- CATEGORY 7: CHANNEL MANAGEMENT (1 file)
-- =====================================================

\echo '>>> Creating Channel Management Constraints (16)...'
\i 16_channel_mappings_fk.sql

-- =====================================================
-- CATEGORY 8: ANALYTICS & REPORTING (7 files)
-- =====================================================

\echo '>>> Creating Analytics & Reporting Constraints (17-23)...'
\i 17_analytics_metrics_fk.sql
\i 18_analytics_metric_dimensions_fk.sql
\i 19_analytics_reports_fk.sql
\i 20_report_property_ids_fk.sql
\i 21_analytics_metrics_fk.sql
\i 22_analytics_metric_dimensions_fk.sql
\i 23_analytics_reports_fk.sql

-- =====================================================
-- CATEGORY 9: PERFORMANCE MONITORING (2 files)
-- =====================================================

\echo '>>> Creating Performance Monitoring Constraints (23-24)...'
\i 23_performance_reporting_fk.sql
\i 24_performance_alerting_fk.sql

-- =====================================================
-- CATEGORY 10: OTA INTEGRATION (4 files)
-- =====================================================

\echo '>>> Creating OTA Integration Constraints (38-41)...'
\i 38_ota_configurations_fk.sql
\i 39_ota_rate_plans_fk.sql
\i 40_ota_reservations_queue_fk.sql
\i 44_ota_inventory_sync_fk.sql

-- =====================================================
-- CATEGORY 11: GUEST COMMUNICATIONS (6 files)
-- =====================================================

\echo '>>> Creating Guest Communications Constraints (41-43, 50)...'
\i 41_guest_communications_fk.sql
\i 42_communication_templates_fk.sql
\i 43_guest_feedback_fk.sql
\i 48_guest_documents_fk.sql
\i 49_guest_notes_fk.sql
\i 50_automated_messages_fk.sql

-- =====================================================
-- CATEGORY 12: CHANNEL MANAGEMENT ADVANCED (3 files)
-- =====================================================

\echo '>>> Creating Channel Management Advanced Constraints (45-46)...'
\i 45_channel_rate_parity_fk.sql
\i 46_channel_commission_rules_fk.sql

-- =====================================================
-- CATEGORY 13: GUEST LOYALTY (1 file)
-- =====================================================

\echo '>>> Creating Guest Loyalty Constraints (47)...'
\i 47_guest_loyalty_programs_fk.sql

-- =====================================================
-- CATEGORY 14: REVENUE MANAGEMENT (5 files)
-- =====================================================

\echo '>>> Creating Revenue Management Constraints (51-55)...'
\i 51_revenue_forecasts_fk.sql
\i 52_competitor_rates_fk.sql
\i 53_demand_calendar_fk.sql
\i 54_pricing_rules_fk.sql
\i 55_rate_recommendations_fk.sql

\echo ''
\echo '============================================='
\echo '✓ ALL CONSTRAINTS CREATED SUCCESSFULLY'
\echo '============================================='
\echo ''
