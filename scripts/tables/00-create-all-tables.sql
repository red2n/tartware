-- =====================================================
-- 00-create-all-tables.sql
-- Master script to create all 132 tables
-- Organized by functional categories
-- Date: 2025-10-21
-- =====================================================

\c tartware

-- Ensure extensions are created
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

\echo ''
\echo '============================================='
\echo 'CREATING ALL 128 TABLES'
\echo 'Enterprise PMS Database - Organized Structure'
\echo '(101 files, some create multiple tables)'
\echo '============================================='
\echo ''

-- =====================================================
-- CATEGORY 1: CORE FOUNDATION (5 tables)
-- Multi-tenancy, users, properties, guest management
-- =====================================================
\echo ''
\echo '>>> Creating Core Foundation Tables (1-5)...'
\i tables/01-core-foundation/01_tenants.sql
\i tables/01-core-foundation/02_users.sql
\i tables/01-core-foundation/03_user_tenant_associations.sql
\i tables/01-core-foundation/04_properties.sql
\i tables/01-core-foundation/05_guests.sql

-- =====================================================
-- CATEGORY 2: ROOM & INVENTORY MANAGEMENT (4 tables)
-- Room types, rooms, rates, availability
-- =====================================================
\echo ''
\echo '>>> Creating Room & Inventory Tables (6-9)...'
\i tables/02-room-inventory/06_room_types.sql
\i tables/02-room-inventory/07_rooms.sql
\i tables/02-room-inventory/08_rates.sql
\i tables/02-room-inventory/09_availability_room_availability.sql

-- =====================================================
-- CATEGORY 3: RESERVATIONS & BOOKING (7 tables)
-- Reservation lifecycle, deposits, allotments
-- =====================================================
\echo ''
\echo '>>> Creating Reservations & Booking Tables (10-11, 30-34)...'
\i tables/03-reservations-booking/10_reservations.sql
\i tables/03-reservations-booking/11_reservation_status_history.sql
\i tables/03-reservations-booking/30_deposit_schedules.sql
\i tables/03-reservations-booking/31_allotments.sql
\i tables/03-reservations-booking/32_booking_sources.sql
\i tables/03-reservations-booking/33_market_segments.sql
\i tables/03-reservations-booking/34_guest_preferences.sql

-- =====================================================
-- CATEGORY 4: FINANCIAL MANAGEMENT (12 tables)
-- Payments, invoices, accounting, receivables
-- =====================================================
\echo ''
\echo '>>> Creating Financial Management Tables (12-14, 25-26, 35, 63-68)...'
\i tables/04-financial-management/12_payments.sql
\i tables/04-financial-management/13_invoices.sql
\i tables/04-financial-management/14_invoice_items.sql
\i tables/04-financial-management/25_folios.sql
\i tables/04-financial-management/26_charge_postings.sql
\i tables/04-financial-management/35_refunds.sql
\i tables/04-financial-management/63_tax_configurations.sql
\i tables/04-financial-management/64_financial_closures.sql
\i tables/04-financial-management/65_commission_tracking.sql
\i tables/04-financial-management/66_cashier_sessions.sql
\i tables/04-financial-management/67_accounts_receivable.sql
\i tables/04-financial-management/68_credit_limits.sql

-- =====================================================
-- CATEGORY 5: SERVICES & HOUSEKEEPING (4 tables)
-- Additional services, housekeeping, maintenance
-- =====================================================
\echo ''
\echo '>>> Creating Services & Housekeeping Tables (15-17, 37)...'
\i tables/05-services-housekeeping/15_services.sql
\i tables/05-services-housekeeping/16_reservation_services.sql
\i tables/05-services-housekeeping/17_housekeeping_tasks.sql
\i tables/05-services-housekeeping/37_maintenance_requests.sql

-- =====================================================
-- CATEGORY 6: CHANNEL MANAGEMENT & OTA (7 tables)
-- Distribution channels, OTA integrations
-- =====================================================
\echo ''
\echo '>>> Creating Channel Management & OTA Tables (18, 38-46)...'
\i tables/06-channel-ota/18_channel_mappings.sql
\i tables/06-channel-ota/38_ota_configurations.sql
\i tables/06-channel-ota/39_ota_rate_plans.sql
\i tables/06-channel-ota/40_ota_reservations_queue.sql
\i tables/06-channel-ota/44_ota_inventory_sync.sql
\i tables/06-channel-ota/45_channel_rate_parity.sql
\i tables/06-channel-ota/46_channel_commission_rules.sql

-- =====================================================
-- CATEGORY 7: GUEST RELATIONS & CRM (7 tables)
-- Communications, loyalty, documents, feedback
-- =====================================================
\echo ''
\echo '>>> Creating Guest Relations & CRM Tables (41-43, 47-50)...'
\i tables/07-guest-crm/41_guest_communications.sql
\i tables/07-guest-crm/42_communication_templates.sql
\i tables/07-guest-crm/43_guest_feedback.sql
\i tables/07-guest-crm/47_guest_loyalty_programs.sql
\i tables/07-guest-crm/48_guest_documents.sql
\i tables/07-guest-crm/49_guest_notes.sql
\i tables/07-guest-crm/50_automated_messages.sql

-- =====================================================
-- CATEGORY 8: REVENUE MANAGEMENT (11 tables)
-- Pricing, forecasting, competitor analysis, B2B, groups
-- =====================================================
\echo ''
\echo '>>> Creating Revenue Management Tables (36, 51-56, 90-93)...'
\i tables/08-revenue-management/36_rate_overrides.sql
\i tables/08-revenue-management/51_revenue_forecasts.sql
\i tables/08-revenue-management/52_competitor_rates.sql
\i tables/08-revenue-management/53_demand_calendar.sql
\i tables/08-revenue-management/54_pricing_rules.sql
\i tables/08-revenue-management/55_rate_recommendations.sql
\i tables/08-revenue-management/56_revenue_goals.sql
\i tables/08-revenue-management/90_companies.sql
\i tables/08-revenue-management/91_group_bookings.sql
\i tables/08-revenue-management/92_packages.sql
\i tables/08-revenue-management/93_travel_agent_commissions.sql

-- =====================================================
-- CATEGORY 9: STAFF & OPERATIONS (6 tables)
-- Staff scheduling, tasks, handovers, incidents
-- =====================================================
\echo ''
\echo '>>> Creating Staff & Operations Tables (57-62)...'
\i tables/09-staff-operations/57_staff_schedules.sql
\i tables/09-staff-operations/58_staff_tasks.sql
\i tables/09-staff-operations/59_shift_handovers.sql
\i tables/09-staff-operations/60_lost_and_found.sql
\i tables/09-staff-operations/61_incident_reports.sql
\i tables/09-staff-operations/62_vendor_contracts.sql

-- =====================================================
-- CATEGORY 10: MARKETING & CAMPAIGNS (5 tables)
-- Campaigns, promotions, referrals, social media
-- =====================================================
\echo ''
\echo '>>> Creating Marketing & Campaigns Tables (69-73)...'
\i tables/10-marketing-campaigns/69_marketing_campaigns.sql
\i tables/10-marketing-campaigns/70_campaign_segments.sql
\i tables/10-marketing-campaigns/71_promotional_codes.sql
\i tables/10-marketing-campaigns/72_referral_tracking.sql
\i tables/10-marketing-campaigns/73_social_media_mentions.sql

-- =====================================================
-- CATEGORY 11: COMPLIANCE & LEGAL (4 tables)
-- GDPR, police reports, contracts, insurance
-- =====================================================
\echo ''
\echo '>>> Creating Compliance & Legal Tables (74-77)...'
\i tables/11-compliance-legal/74_gdpr_consent_logs.sql
\i tables/11-compliance-legal/75_police_reports.sql
\i tables/11-compliance-legal/76_contract_agreements.sql
\i tables/11-compliance-legal/77_insurance_claims.sql

-- =====================================================
-- CATEGORY 12: ANALYTICS & REPORTING (10 tables)
-- Metrics, reports, performance, advanced analytics
-- =====================================================
\echo ''
\echo '>>> Creating Analytics & Reporting Tables (19-24, 78-81)...'
\i tables/12-analytics-reporting/19_analytics_metrics.sql
\i tables/12-analytics-reporting/20_analytics_metric_dimensions.sql
\i tables/12-analytics-reporting/21_analytics_reports.sql
\i tables/12-analytics-reporting/22_report_property_ids.sql
\i tables/12-analytics-reporting/23_performance_reporting_tables.sql
\i tables/12-analytics-reporting/24_performance_alerting_tables.sql
\i tables/12-analytics-reporting/78_guest_journey_tracking.sql
\i tables/12-analytics-reporting/79_revenue_attribution.sql
\i tables/12-analytics-reporting/80_forecasting_models.sql
\i tables/12-analytics-reporting/81_ab_test_results.sql

-- =====================================================
-- CATEGORY 13: MOBILE & DIGITAL (4 tables)
-- Mobile keys, QR codes, push notifications
-- =====================================================
\echo ''
\echo '>>> Creating Mobile & Digital Tables (82-85)...'
\i tables/13-mobile-digital/82_mobile_keys.sql
\i tables/13-mobile-digital/83_qr_codes.sql
\i tables/13-mobile-digital/84_push_notifications.sql
\i tables/13-mobile-digital/85_app_usage_analytics.sql

-- =====================================================
-- CATEGORY 14: SYSTEM & AUDIT (3 tables)
-- Audit logs, business dates, night audit
-- =====================================================
\echo ''
\echo '>>> Creating System & Audit Tables (27-29)...'
\i tables/14-system-audit/27_audit_logs.sql
\i tables/14-system-audit/28_business_dates.sql
\i tables/14-system-audit/29_night_audit_log.sql

-- =====================================================
-- CATEGORY 15: INTEGRATION HUB (4 tables)
-- API integrations, webhooks, data synchronization
-- =====================================================
\echo ''
\echo '>>> Creating Integration Hub Tables (86-89)...'
\i tables/15-integration-hub/86_integration_mappings.sql
\i tables/15-integration-hub/87_api_logs.sql
\i tables/15-integration-hub/88_webhook_subscriptions.sql
\i tables/15-integration-hub/89_data_sync_status.sql

-- =====================================================
-- CATEGORY 16: AI/ML INNOVATION (4 tables)
-- AI demand forecasting, ML pricing, behavior patterns
-- =====================================================
\echo ''
\echo '>>> Creating AI/ML Innovation Tables (94-97)...'
\i tables/16-ai-ml-innovation/94_ai_demand_predictions.sql
\i tables/16-ai-ml-innovation/95_dynamic_pricing_rules_ml.sql
\i tables/16-ai-ml-innovation/96_guest_behavior_patterns.sql
\i tables/16-ai-ml-innovation/97_sentiment_analysis.sql

-- =====================================================
-- CATEGORY 17: SUSTAINABILITY & ESG (1 table)
-- Environmental metrics, green certifications, carbon tracking
-- =====================================================
\echo ''
\echo '>>> Creating Sustainability & ESG Tables (98)...'
\i tables/17-sustainability-esg/98_sustainability_metrics.sql

-- =====================================================
-- CATEGORY 18: IOT & SMART ROOMS (1 table)
-- Smart devices, energy management, automation
-- =====================================================
\echo ''
\echo '>>> Creating IoT & Smart Rooms Tables (99)...'
\i tables/18-iot-smart-rooms/99_smart_room_devices.sql

-- =====================================================
-- CATEGORY 19: CONTACTLESS & DIGITAL (1 table)
-- Mobile check-in, digital registration, contactless services
-- =====================================================
\echo ''
\echo '>>> Creating Contactless & Digital Tables (100)...'
\i tables/19-contactless-digital/100_mobile_check_ins.sql

-- =====================================================
-- CATEGORY 20: ASSET MANAGEMENT (1 table)
-- Asset inventory, predictive maintenance, depreciation
-- =====================================================
\echo ''
\echo '>>> Creating Asset Management Tables (101)...'
\i tables/20-asset-management/101_asset_inventory.sql

\echo ''
\echo '============================================='
\echo 'ALL 128 TABLES CREATED SUCCESSFULLY!'
\echo '============================================='
\echo ''
\echo 'Table Summary:'
\echo '  - 101 SQL files executed'
\echo '  - 128 Tables created (some files create multiple tables)'
\echo ''
\echo 'Next steps:'
\echo '  1. Run indexes/00-create-all-indexes.sql'
\echo '  2. Run constraints/00-create-all-constraints.sql'
\echo '  3. Run verify-tables.sql to validate'
\echo ''
