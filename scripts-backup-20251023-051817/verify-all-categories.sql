-- =====================================================
-- verify-all-categories.sql
-- Master Script to Run All Category Verifications
-- Runs verification for all 20 categories
-- Date: 2025-10-21
-- =====================================================

\c tartware

\echo ''
\echo '======================================================'
\echo '  TARTWARE PMS - CATEGORY-LEVEL VERIFICATION'
\echo '  Running verification for all 20 functional categories'
\echo '======================================================'
\echo ''

-- =====================================================
-- CATEGORY 1: CORE FOUNDATION
-- =====================================================
\echo '══════════════════════════════════════════════════════'
\echo 'CATEGORY 1/20: Core Foundation'
\echo '══════════════════════════════════════════════════════'
\i tables/01-core-foundation/verify-01-core-foundation.sql
\i indexes/01-core-foundation/verify-01-core-foundation-indexes.sql
\i constraints/01-core-foundation/verify-01-core-foundation-constraints.sql

-- =====================================================
-- CATEGORY 2: ROOM & INVENTORY MANAGEMENT
-- =====================================================
\echo '══════════════════════════════════════════════════════'
\echo 'CATEGORY 2/20: Room & Inventory Management'
\echo '══════════════════════════════════════════════════════'
\i tables/02-room-inventory/verify-02-room-inventory.sql
\i indexes/02-room-inventory/verify-02-room-inventory-indexes.sql
\i constraints/02-room-inventory/verify-02-room-inventory-constraints.sql

-- =====================================================
-- CATEGORY 3: RESERVATIONS & BOOKING
-- =====================================================
\echo '══════════════════════════════════════════════════════'
\echo 'CATEGORY 3/20: Reservations & Booking'
\echo '══════════════════════════════════════════════════════'
\i tables/03-reservations-booking/verify-03-reservations-booking.sql
\i indexes/03-reservations-booking/verify-03-reservations-booking-indexes.sql
\i constraints/03-reservations-booking/verify-03-reservations-booking-constraints.sql

-- =====================================================
-- CATEGORY 4: FINANCIAL MANAGEMENT
-- =====================================================
\echo '══════════════════════════════════════════════════════'
\echo 'CATEGORY 4/20: Financial Management'
\echo '══════════════════════════════════════════════════════'
\i tables/04-financial-management/verify-04-financial-management.sql
\i indexes/04-financial-management/verify-04-financial-management-indexes.sql
\i constraints/04-financial-management/verify-04-financial-management-constraints.sql

-- =====================================================
-- CATEGORY 5: SERVICES & HOUSEKEEPING
-- =====================================================
\echo '══════════════════════════════════════════════════════'
\echo 'CATEGORY 5/20: Services & Housekeeping'
\echo '══════════════════════════════════════════════════════'
\i tables/05-services-housekeeping/verify-05-services-housekeeping.sql
\i indexes/05-services-housekeeping/verify-05-services-housekeeping-indexes.sql
\i constraints/05-services-housekeeping/verify-05-services-housekeeping-constraints.sql

-- =====================================================
-- CATEGORY 6: CHANNEL MANAGEMENT & OTA
-- =====================================================
\echo '══════════════════════════════════════════════════════'
\echo 'CATEGORY 6/20: Channel Management & OTA'
\echo '══════════════════════════════════════════════════════'
\i tables/06-channel-ota/verify-06-channel-ota.sql
\i indexes/06-channel-ota/verify-06-channel-ota-indexes.sql
\i constraints/06-channel-ota/verify-06-channel-ota-constraints.sql

-- =====================================================
-- CATEGORY 7: GUEST RELATIONS & CRM
-- =====================================================
\echo '══════════════════════════════════════════════════════'
\echo 'CATEGORY 7/20: Guest Relations & CRM'
\echo '══════════════════════════════════════════════════════'
\i tables/07-guest-crm/verify-07-guest-crm.sql
\i indexes/07-guest-crm/verify-07-guest-crm-indexes.sql
\i constraints/07-guest-crm/verify-07-guest-crm-constraints.sql

-- =====================================================
-- CATEGORY 8: REVENUE MANAGEMENT
-- =====================================================
\echo '══════════════════════════════════════════════════════'
\echo 'CATEGORY 8/20: Revenue Management'
\echo '══════════════════════════════════════════════════════'
\i tables/08-revenue-management/verify-08-revenue-management.sql
\i indexes/08-revenue-management/verify-08-revenue-management-indexes.sql
\i constraints/08-revenue-management/verify-08-revenue-management-constraints.sql

-- =====================================================
-- CATEGORY 9: STAFF & OPERATIONS
-- =====================================================
\echo '══════════════════════════════════════════════════════'
\echo 'CATEGORY 9/20: Staff & Operations'
\echo '══════════════════════════════════════════════════════'
\i tables/09-staff-operations/verify-09-staff-operations.sql
\i indexes/09-staff-operations/verify-09-staff-operations-indexes.sql
\i constraints/09-staff-operations/verify-09-staff-operations-constraints.sql

-- =====================================================
-- CATEGORY 10: MARKETING & CAMPAIGNS
-- =====================================================
\echo '══════════════════════════════════════════════════════'
\echo 'CATEGORY 10/20: Marketing & Campaigns'
\echo '══════════════════════════════════════════════════════'
\i tables/10-marketing-campaigns/verify-10-marketing-campaigns.sql
\i indexes/10-marketing-campaigns/verify-10-marketing-campaigns-indexes.sql
\i constraints/10-marketing-campaigns/verify-10-marketing-campaigns-constraints.sql

-- =====================================================
-- CATEGORY 11: COMPLIANCE & LEGAL
-- =====================================================
\echo '══════════════════════════════════════════════════════'
\echo 'CATEGORY 11/20: Compliance & Legal'
\echo '══════════════════════════════════════════════════════'
\i tables/11-compliance-legal/verify-11-compliance-legal.sql
\i indexes/11-compliance-legal/verify-11-compliance-legal-indexes.sql
\i constraints/11-compliance-legal/verify-11-compliance-legal-constraints.sql

-- =====================================================
-- CATEGORY 12: ANALYTICS & REPORTING
-- =====================================================
\echo '══════════════════════════════════════════════════════'
\echo 'CATEGORY 12/20: Analytics & Reporting'
\echo '══════════════════════════════════════════════════════'
\i tables/12-analytics-reporting/verify-12-analytics-reporting.sql
\i indexes/12-analytics-reporting/verify-12-analytics-reporting-indexes.sql
\i constraints/12-analytics-reporting/verify-12-analytics-reporting-constraints.sql

-- =====================================================
-- CATEGORY 13: MOBILE & DIGITAL
-- =====================================================
\echo '══════════════════════════════════════════════════════'
\echo 'CATEGORY 13/20: Mobile & Digital'
\echo '══════════════════════════════════════════════════════'
\i tables/13-mobile-digital/verify-13-mobile-digital.sql
\i indexes/13-mobile-digital/verify-13-mobile-digital-indexes.sql
\i constraints/13-mobile-digital/verify-13-mobile-digital-constraints.sql

-- =====================================================
-- CATEGORY 14: SYSTEM & AUDIT
-- =====================================================
\echo '══════════════════════════════════════════════════════'
\echo 'CATEGORY 14/20: System & Audit'
\echo '══════════════════════════════════════════════════════'
\i tables/14-system-audit/verify-14-system-audit.sql
\i indexes/14-system-audit/verify-14-system-audit-indexes.sql
\i constraints/14-system-audit/verify-14-system-audit-constraints.sql

-- =====================================================
-- CATEGORY 15: INTEGRATION HUB
-- =====================================================
\echo '══════════════════════════════════════════════════════'
\echo 'CATEGORY 15/20: Integration Hub'
\echo '══════════════════════════════════════════════════════'
\i tables/15-integration-hub/verify-15-integration-hub.sql
\i indexes/15-integration-hub/verify-15-integration-hub-indexes.sql
\i constraints/15-integration-hub/verify-15-integration-hub-constraints.sql

-- =====================================================
-- CATEGORY 16: AI/ML INNOVATION
-- =====================================================
\echo '══════════════════════════════════════════════════════'
\echo 'CATEGORY 16/20: AI/ML Innovation'
\echo '══════════════════════════════════════════════════════'
\i tables/16-ai-ml-innovation/verify-16-ai-ml-innovation.sql
\i indexes/16-ai-ml-innovation/verify-16-ai-ml-innovation-indexes.sql
\i constraints/16-ai-ml-innovation/verify-16-ai-ml-innovation-constraints.sql

-- =====================================================
-- CATEGORY 17: SUSTAINABILITY & ESG
-- =====================================================
\echo '══════════════════════════════════════════════════════'
\echo 'CATEGORY 17/20: Sustainability & ESG'
\echo '══════════════════════════════════════════════════════'
\i tables/17-sustainability-esg/verify-17-sustainability-esg.sql
\i indexes/17-sustainability-esg/verify-17-sustainability-esg-indexes.sql
\i constraints/17-sustainability-esg/verify-17-sustainability-esg-constraints.sql

-- =====================================================
-- CATEGORY 18: IOT & SMART ROOMS
-- =====================================================
\echo '══════════════════════════════════════════════════════'
\echo 'CATEGORY 18/20: IoT & Smart Rooms'
\echo '══════════════════════════════════════════════════════'
\i tables/18-iot-smart-rooms/verify-18-iot-smart-rooms.sql
\i indexes/18-iot-smart-rooms/verify-18-iot-smart-rooms-indexes.sql
\i constraints/18-iot-smart-rooms/verify-18-iot-smart-rooms-constraints.sql

-- =====================================================
-- CATEGORY 19: CONTACTLESS & DIGITAL
-- =====================================================
\echo '══════════════════════════════════════════════════════'
\echo 'CATEGORY 19/20: Contactless & Digital'
\echo '══════════════════════════════════════════════════════'
\i tables/19-contactless-digital/verify-19-contactless-digital.sql
\i indexes/19-contactless-digital/verify-19-contactless-digital-indexes.sql
\i constraints/19-contactless-digital/verify-19-contactless-digital-constraints.sql

-- =====================================================
-- CATEGORY 20: ASSET MANAGEMENT
-- =====================================================
\echo '══════════════════════════════════════════════════════'
\echo 'CATEGORY 20/20: Asset Management'
\echo '══════════════════════════════════════════════════════'
\i tables/20-asset-management/verify-20-asset-management.sql
\i indexes/20-asset-management/verify-20-asset-management-indexes.sql
\i constraints/20-asset-management/verify-20-asset-management-constraints.sql

-- =====================================================
-- FINAL SUMMARY
-- =====================================================
\echo ''
\echo '======================================================'
\echo '  ALL CATEGORY VERIFICATIONS COMPLETE!'
\echo '======================================================'
\echo ''
\echo 'Verified:'
\echo '  • 20 functional categories'
\echo '  • 132 tables (89 core + 43 advanced)'
\echo '  • 800+ indexes'
\echo '  • 500+ foreign key constraints'
\echo ''
\echo 'Review the output above for any warnings or failures.'
\echo ''
\echo 'Individual category verification scripts can be run separately:'
\echo '  psql -U postgres -d tartware -f tables/01-core-foundation/verify-01-core-foundation.sql'
\echo ''
\echo '======================================================'
