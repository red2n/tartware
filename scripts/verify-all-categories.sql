-- =====================================================
-- verify-all-categories.sql
-- Master script to run all category verifications
-- Runs verification for all 8 consolidated categories
-- Date: 2025-10-23
-- =====================================================

\set ON_ERROR_STOP on
\c tartware

\echo ''
\echo '======================================================'
\echo '  TARTWARE PMS - CATEGORY-LEVEL VERIFICATION'
\echo '  Running verification for all 8 business domains'
\echo '======================================================'
\echo ''

-- =====================================================
-- CATEGORY 1: CORE FOUNDATION
-- =====================================================
\echo '══════════════════════════════════════════════════════'
\echo 'CATEGORY 1/8: Core Foundation'
\echo '══════════════════════════════════════════════════════'
\i tables/01-core/verify-01-core-foundation.sql
\i indexes/01-core/verify-01-core-foundation-indexes.sql
\i constraints/01-core/verify-01-core-foundation-constraints.sql

-- =====================================================
-- CATEGORY 2: INVENTORY & REVENUE MANAGEMENT
-- =====================================================
\echo '══════════════════════════════════════════════════════'
\echo 'CATEGORY 2/8: Inventory & Revenue Management'
\echo '══════════════════════════════════════════════════════'
\i tables/02-inventory/verify-02-room-inventory.sql
\i tables/02-inventory/verify-08-revenue-management.sql
\i indexes/02-inventory/verify-02-room-inventory-indexes.sql
\i indexes/02-inventory/verify-08-revenue-management-indexes.sql
\i constraints/02-inventory/verify-02-room-inventory-constraints.sql
\i constraints/02-inventory/verify-08-revenue-management-constraints.sql

-- =====================================================
-- CATEGORY 3: BOOKINGS & GUEST EXPERIENCE
-- =====================================================
\echo '══════════════════════════════════════════════════════'
\echo 'CATEGORY 3/8: Bookings & Guest Experience'
\echo '══════════════════════════════════════════════════════'
\i tables/03-bookings/verify-03-reservations-booking.sql
\i tables/03-bookings/verify-07-guest-crm.sql
\i indexes/03-bookings/verify-03-reservations-booking-indexes.sql
\i indexes/03-bookings/verify-07-guest-crm-indexes.sql
\i constraints/03-bookings/verify-03-reservations-booking-constraints.sql
\i constraints/03-bookings/verify-07-guest-crm-constraints.sql

-- =====================================================
-- CATEGORY 4: FINANCIAL MANAGEMENT
-- =====================================================
\echo '══════════════════════════════════════════════════════'
\echo 'CATEGORY 4/8: Financial Management'
\echo '══════════════════════════════════════════════════════'
\i tables/04-financial/verify-04-financial-management.sql
\i indexes/04-financial/verify-04-financial-management-indexes.sql
\i constraints/04-financial/verify-04-financial-management-constraints.sql

-- =====================================================
-- CATEGORY 5: OPERATIONS & GUEST SERVICES
-- =====================================================
\echo '══════════════════════════════════════════════════════'
\echo 'CATEGORY 5/8: Operations & Guest Services'
\echo '══════════════════════════════════════════════════════'
\i tables/05-operations/verify-05-services-housekeeping.sql
\i tables/05-operations/verify-09-staff-operations.sql
\i tables/05-operations/verify-13-mobile-digital.sql
\i indexes/05-operations/verify-05-services-housekeeping-indexes.sql
\i indexes/05-operations/verify-09-staff-operations-indexes.sql
\i indexes/05-operations/verify-13-mobile-digital-indexes.sql
\i constraints/05-operations/verify-05-services-housekeeping-constraints.sql
\i constraints/05-operations/verify-09-staff-operations-constraints.sql
\i constraints/05-operations/verify-13-mobile-digital-constraints.sql

-- =====================================================
-- CATEGORY 6: INTEGRATIONS & DISTRIBUTION
-- =====================================================
\echo '══════════════════════════════════════════════════════'
\echo 'CATEGORY 6/8: Integrations & Distribution'
\echo '══════════════════════════════════════════════════════'
\i tables/06-integrations/verify-06-channel-ota.sql
\i tables/06-integrations/verify-10-marketing-campaigns.sql
\i tables/06-integrations/verify-15-integration-hub.sql
\i indexes/06-integrations/verify-06-channel-ota-indexes.sql
\i indexes/06-integrations/verify-10-marketing-campaigns-indexes.sql
\i indexes/06-integrations/verify-15-integration-hub-indexes.sql
\i constraints/06-integrations/verify-06-channel-ota-constraints.sql
\i constraints/06-integrations/verify-10-marketing-campaigns-constraints.sql
\i constraints/06-integrations/verify-15-integration-hub-constraints.sql

-- =====================================================
-- CATEGORY 7: ANALYTICS, COMPLIANCE & AUDIT
-- =====================================================
\echo '══════════════════════════════════════════════════════'
\echo 'CATEGORY 7/8: Analytics, Compliance & Audit'
\echo '══════════════════════════════════════════════════════'
\i tables/07-analytics/verify-11-compliance-legal.sql
\i tables/07-analytics/verify-12-analytics-reporting.sql
\i tables/07-analytics/verify-14-system-audit.sql
\i indexes/07-analytics/verify-11-compliance-legal-indexes.sql
\i indexes/07-analytics/verify-12-analytics-reporting-indexes.sql
\i indexes/07-analytics/verify-14-system-audit-indexes.sql
\i constraints/07-analytics/verify-11-compliance-legal-constraints.sql
\i constraints/07-analytics/verify-12-analytics-reporting-constraints.sql
\i constraints/07-analytics/verify-14-system-audit-constraints.sql

-- =====================================================
-- CATEGORY 8: SETTINGS CATALOG
-- =====================================================
\echo '══════════════════════════════════════════════════════'
\echo 'CATEGORY 8/8: Settings Catalog'
\echo '══════════════════════════════════════════════════════'
\i tables/08-settings/verify-08-settings-catalog.sql

-- =====================================================
-- FINAL SUMMARY
-- =====================================================
\echo ''
\echo '======================================================'
\echo '  ALL CATEGORY VERIFICATIONS COMPLETE!'
\echo '======================================================'
\echo ''
\echo 'Verified:'
\echo '  • 8 business domains'

SELECT COUNT(*) AS verified_table_count
FROM information_schema.tables
WHERE table_schema IN ('public', 'availability')
  AND table_type = 'BASE TABLE';
\gset

SELECT COUNT(*) AS verified_index_count
FROM pg_indexes
WHERE schemaname IN ('public', 'availability');
\gset

SELECT COUNT(*) AS verified_fk_count
FROM information_schema.table_constraints
WHERE constraint_type = 'FOREIGN KEY'
  AND table_schema IN ('public', 'availability');
\gset

\echo '  • Tables (public+availability): ' :verified_table_count
\echo '  • Indexes (public+availability): ' :verified_index_count
\echo '  • Foreign keys (public+availability): ' :verified_fk_count
\echo ''
\echo 'Review the output above for any warnings or failures.'
\echo ''
\echo 'Individual category verification scripts can be run separately, e.g.:'
\echo '  psql -U postgres -d tartware -f tables/01-core/verify-01-core-foundation.sql'
\echo ''
\echo '======================================================'
