-- =====================================================
-- verify-tables.sql
-- Aggregated table verification runner for Tartware PMS
-- Executes all category-level table verification scripts
-- =====================================================

\set ON_ERROR_STOP on
\c tartware

\echo ''
\echo '======================================================'
\echo '  TABLE VERIFICATION - ALL CATEGORIES'
\echo '======================================================'
\echo ''

-- Core foundation
\i tables/01-core/verify-01-core-foundation.sql

-- Inventory and revenue management
\i tables/02-inventory/verify-02-room-inventory.sql
\i tables/02-inventory/verify-08-revenue-management.sql

-- Bookings and guest CRM
\i tables/03-bookings/verify-03-reservations-booking.sql
\i tables/03-bookings/verify-07-guest-crm.sql
\i tables/03-bookings/verify-08-roll-guard-shadow.sql

-- Financial management
\i tables/04-financial/verify-04-financial-management.sql

-- Operations, staff, and digital experiences
\i tables/05-operations/verify-05-services-housekeeping.sql
\i tables/05-operations/verify-09-staff-operations.sql
\i tables/05-operations/verify-13-mobile-digital.sql

-- Integrations and marketing
\i tables/06-integrations/verify-06-channel-ota.sql
\i tables/06-integrations/verify-10-marketing-campaigns.sql
\i tables/06-integrations/verify-15-integration-hub.sql

-- Analytics, compliance, and system health
\i tables/07-analytics/verify-11-compliance-legal.sql
\i tables/07-analytics/verify-12-analytics-reporting.sql
\i tables/07-analytics/verify-14-system-audit.sql

\echo ''
\echo '======================================================'
\echo '  TABLE VERIFICATION COMPLETE'
\echo '======================================================'
\echo ''
