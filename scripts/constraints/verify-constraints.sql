-- =====================================================
-- verify-constraints.sql
-- Aggregated foreign key verification runner for Tartware PMS
-- Executes all category-level constraint verification scripts
-- =====================================================

\set ON_ERROR_STOP on
\c tartware

\echo ''
\echo '======================================================'
\echo '  CONSTRAINT VERIFICATION - ALL CATEGORIES'
\echo '======================================================'
\echo ''

-- Core foundation
\i 01-core/verify-01-core-foundation-constraints.sql

-- Inventory and revenue management
\i 02-inventory/verify-02-room-inventory-constraints.sql
\i 02-inventory/verify-08-revenue-management-constraints.sql

-- Bookings and guest CRM
\i 03-bookings/verify-03-reservations-booking-constraints.sql
\i 03-bookings/verify-07-guest-crm-constraints.sql

-- Financial management
\i 04-financial/verify-04-financial-management-constraints.sql

-- Operations, staff, and digital experiences
\i 05-operations/verify-05-services-housekeeping-constraints.sql
\i 05-operations/verify-09-staff-operations-constraints.sql
\i 05-operations/verify-13-mobile-digital-constraints.sql

-- Integrations and marketing
\i 06-integrations/verify-06-channel-ota-constraints.sql
\i 06-integrations/verify-10-marketing-campaigns-constraints.sql
\i 06-integrations/verify-15-integration-hub-constraints.sql

-- Analytics, compliance, and system health
\i 07-analytics/verify-11-compliance-legal-constraints.sql
\i 07-analytics/verify-12-analytics-reporting-constraints.sql
\i 07-analytics/verify-14-system-audit-constraints.sql

\echo ''
\echo '======================================================'
\echo '  CONSTRAINT VERIFICATION COMPLETE'
\echo '======================================================'
\echo ''
