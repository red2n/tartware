-- =====================================================
-- verify-indexes.sql
-- Aggregated index verification runner for Tartware PMS
-- Executes all category-level index verification scripts
-- =====================================================

\set ON_ERROR_STOP on
\c tartware

\echo ''
\echo '======================================================'
\echo '  INDEX VERIFICATION - ALL CATEGORIES'
\echo '======================================================'
\echo ''

-- Core foundation
\i 01-core/verify-01-core-foundation-indexes.sql

-- Inventory and revenue management
\i 02-inventory/verify-02-room-inventory-indexes.sql
\i 02-inventory/verify-08-revenue-management-indexes.sql

-- Bookings and guest CRM
\i 03-bookings/verify-03-reservations-booking-indexes.sql
\i 03-bookings/verify-07-guest-crm-indexes.sql

-- Financial management
\i 04-financial/verify-04-financial-management-indexes.sql

-- Operations, staff, and digital experiences
\i 05-operations/verify-05-services-housekeeping-indexes.sql
\i 05-operations/verify-09-staff-operations-indexes.sql
\i 05-operations/verify-13-mobile-digital-indexes.sql

-- Integrations and marketing
\i 06-integrations/verify-06-channel-ota-indexes.sql
\i 06-integrations/verify-10-marketing-campaigns-indexes.sql
\i 06-integrations/verify-15-integration-hub-indexes.sql

-- Analytics, compliance, and system health
\i 07-analytics/verify-11-compliance-legal-indexes.sql
\i 07-analytics/verify-12-analytics-reporting-indexes.sql
\i 07-analytics/verify-14-system-audit-indexes.sql

\echo ''
\echo '======================================================'
\echo '  INDEX VERIFICATION COMPLETE'
\echo '======================================================'
\echo ''
