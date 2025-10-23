-- =====================================================
-- 00-create-all-constraints-complete.sql
-- Complete Master Script for All Foreign Key Constraints
-- Generated: 2025-10-21
-- Total: 102 constraint files across 20 categories
-- =====================================================

\c tartware

\echo ''
\echo '============================================='
\echo 'CREATING ALL TABLE CONSTRAINTS'
\echo 'Data Integrity Layer for Tartware PMS'
\echo '102 Constraint Files | 242+ Foreign Keys'
\echo '============================================='
\echo ''

-- =====================================================
-- CATEGORY 1: CORE FOUNDATION (3 files)
-- =====================================================

\echo '>>> [1/20] Creating Core Foundation Constraints (3 files)...'
\i 01-core-foundation/01_user_tenant_associations_fk.sql
\i 01-core-foundation/02_properties_fk.sql
\i 01-core-foundation/03_guests_fk.sql

-- =====================================================
-- CATEGORY 2: ROOM & INVENTORY MANAGEMENT (4 files)
-- =====================================================

\echo '>>> [2/20] Creating Room & Inventory Constraints (4 files)...'
\i 02-room-inventory/04_room_types_fk.sql
\i 02-room-inventory/05_rooms_fk.sql
\i 02-room-inventory/06_rates_fk.sql
\i 02-room-inventory/07_availability_room_availability_fk.sql

-- =====================================================
-- CATEGORY 3: RESERVATIONS & BOOKING (7 files)
-- =====================================================

\echo '>>> [3/20] Creating Reservations & Booking Constraints (7 files)...'
\i 03-reservations-booking/08_reservations_fk.sql
\i 03-reservations-booking/09_reservation_status_history_fk.sql
\i 03-reservations-booking/30_deposit_schedules_fk.sql
\i 03-reservations-booking/31_allotments_fk.sql
\i 03-reservations-booking/32_booking_sources_fk.sql
\i 03-reservations-booking/33_market_segments_fk.sql
\i 03-reservations-booking/34_guest_preferences_fk.sql

-- =====================================================
-- CATEGORY 4: FINANCIAL MANAGEMENT (12 files)
-- =====================================================

\echo '>>> [4/20] Creating Financial Management Constraints (12 files)...'
\i 04-financial-management/10_payments_fk.sql
\i 04-financial-management/11_invoices_fk.sql
\i 04-financial-management/12_invoice_items_fk.sql
\i 04-financial-management/25_folios_fk.sql
\i 04-financial-management/26_charge_postings_fk.sql
\i 04-financial-management/35_refunds_fk.sql
\i 04-financial-management/63_tax_configurations_fk.sql
\i 04-financial-management/64_financial_closures_fk.sql
\i 04-financial-management/65_commission_tracking_fk.sql
\i 04-financial-management/66_cashier_sessions_fk.sql
\i 04-financial-management/67_accounts_receivable_fk.sql
\i 04-financial-management/68_credit_limits_fk.sql

-- =====================================================
-- CATEGORY 5: SERVICES & HOUSEKEEPING (4 files)
-- =====================================================

\echo '>>> [5/20] Creating Services & Housekeeping Constraints (4 files)...'
\i 05-services-housekeeping/13_services_fk.sql
\i 05-services-housekeeping/14_reservation_services_fk.sql
\i 05-services-housekeeping/15_housekeeping_tasks_fk.sql
\i 05-services-housekeeping/37_maintenance_requests_fk.sql

-- =====================================================
-- CATEGORY 6: CHANNEL & OTA MANAGEMENT (7 files)
-- =====================================================

\echo '>>> [6/20] Creating Channel & OTA Management Constraints (7 files)...'
\i 06-channel-ota/16_channel_mappings_fk.sql
\i 06-channel-ota/38_ota_configurations_fk.sql
\i 06-channel-ota/39_ota_rate_plans_fk.sql
\i 06-channel-ota/40_ota_reservations_queue_fk.sql
\i 06-channel-ota/44_ota_inventory_sync_fk.sql
\i 06-channel-ota/45_channel_rate_parity_fk.sql
\i 06-channel-ota/46_channel_commission_rules_fk.sql

-- =====================================================
-- CATEGORY 7: GUEST CRM (7 files)
-- =====================================================

\echo '>>> [7/20] Creating Guest CRM Constraints (7 files)...'
\i 07-guest-crm/41_guest_communications_fk.sql
\i 07-guest-crm/42_communication_templates_fk.sql
\i 07-guest-crm/43_guest_feedback_fk.sql
\i 07-guest-crm/47_guest_loyalty_programs_fk.sql
\i 07-guest-crm/48_guest_documents_fk.sql
\i 07-guest-crm/49_guest_notes_fk.sql
\i 07-guest-crm/50_automated_messages_fk.sql

-- =====================================================
-- CATEGORY 8: REVENUE MANAGEMENT (11 files)
-- =====================================================

\echo '>>> [8/20] Creating Revenue Management Constraints (11 files)...'
\i 08-revenue-management/36_rate_overrides_fk.sql
\i 08-revenue-management/51_revenue_forecasts_fk.sql
\i 08-revenue-management/52_competitor_rates_fk.sql
\i 08-revenue-management/53_demand_calendar_fk.sql
\i 08-revenue-management/54_pricing_rules_fk.sql
\i 08-revenue-management/55_rate_recommendations_fk.sql
\i 08-revenue-management/56_revenue_goals_fk.sql
\i 08-revenue-management/90_companies_fk.sql
\i 08-revenue-management/91_group_bookings_fk.sql
\i 08-revenue-management/92_packages_fk.sql
\i 08-revenue-management/93_travel_agent_commissions_fk.sql

-- =====================================================
-- CATEGORY 9: STAFF OPERATIONS (6 files)
-- =====================================================

\echo '>>> [9/20] Creating Staff Operations Constraints (6 files)...'
\i 09-staff-operations/57_staff_schedules_fk.sql
\i 09-staff-operations/58_staff_tasks_fk.sql
\i 09-staff-operations/59_shift_handovers_fk.sql
\i 09-staff-operations/60_lost_and_found_fk.sql
\i 09-staff-operations/61_incident_reports_fk.sql
\i 09-staff-operations/62_vendor_contracts_fk.sql

-- =====================================================
-- CATEGORY 10: MARKETING & CAMPAIGNS (5 files)
-- =====================================================

\echo '>>> [10/20] Creating Marketing & Campaigns Constraints (5 files)...'
\i 10-marketing-campaigns/69_marketing_campaigns_fk.sql
\i 10-marketing-campaigns/70_campaign_segments_fk.sql
\i 10-marketing-campaigns/71_promotional_codes_fk.sql
\i 10-marketing-campaigns/72_referral_tracking_fk.sql
\i 10-marketing-campaigns/73_social_media_mentions_fk.sql

-- =====================================================
-- CATEGORY 11: COMPLIANCE & LEGAL (4 files)
-- =====================================================

\echo '>>> [11/20] Creating Compliance & Legal Constraints (4 files)...'
\i 11-compliance-legal/74_gdpr_consent_logs_fk.sql
\i 11-compliance-legal/75_police_reports_fk.sql
\i 11-compliance-legal/76_contract_agreements_fk.sql
\i 11-compliance-legal/77_insurance_claims_fk.sql

-- =====================================================
-- CATEGORY 12: ANALYTICS & REPORTING (13 files)
-- =====================================================

\echo '>>> [12/20] Creating Analytics & Reporting Constraints (13 files)...'
\i 12-analytics-reporting/17_analytics_metrics_fk.sql
\i 12-analytics-reporting/18_analytics_metric_dimensions_fk.sql
\i 12-analytics-reporting/19_analytics_reports_fk.sql
\i 12-analytics-reporting/20_report_property_ids_fk.sql
\i 12-analytics-reporting/21_analytics_metrics_fk.sql
\i 12-analytics-reporting/22_analytics_metric_dimensions_fk.sql
\i 12-analytics-reporting/23_analytics_reports_fk.sql
\i 12-analytics-reporting/23_performance_reporting_fk.sql
\i 12-analytics-reporting/24_performance_alerting_fk.sql
\i 12-analytics-reporting/78_guest_journey_tracking_fk.sql
\i 12-analytics-reporting/79_revenue_attribution_fk.sql
\i 12-analytics-reporting/80_forecasting_models_fk.sql
\i 12-analytics-reporting/81_ab_test_results_fk.sql

-- =====================================================
-- CATEGORY 13: MOBILE & DIGITAL (4 files)
-- =====================================================

\echo '>>> [13/20] Creating Mobile & Digital Constraints (4 files)...'
\i 13-mobile-digital/82_mobile_keys_fk.sql
\i 13-mobile-digital/83_qr_codes_fk.sql
\i 13-mobile-digital/84_push_notifications_fk.sql
\i 13-mobile-digital/85_app_usage_analytics_fk.sql

-- =====================================================
-- CATEGORY 14: SYSTEM AUDIT (3 files)
-- =====================================================

\echo '>>> [14/20] Creating System Audit Constraints (3 files)...'
\i 14-system-audit/27_audit_logs_fk.sql
\i 14-system-audit/28_business_dates_fk.sql
\i 14-system-audit/29_night_audit_log_fk.sql

-- =====================================================
-- CATEGORY 15: INTEGRATION HUB (4 files)
-- =====================================================

\echo '>>> [15/20] Creating Integration Hub Constraints (4 files)...'
\i 15-integration-hub/86_integration_mappings_fk.sql
\i 15-integration-hub/87_api_logs_fk.sql
\i 15-integration-hub/88_webhook_subscriptions_fk.sql
\i 15-integration-hub/89_data_sync_status_fk.sql

-- =====================================================
-- CATEGORY 16: AI/ML INNOVATION (4 files)
-- =====================================================

\echo '>>> [16/20] Creating AI/ML Innovation Constraints (4 files)...'
\i 16-ai-ml-innovation/94_ai_demand_predictions_fk.sql
\i 16-ai-ml-innovation/95_dynamic_pricing_rules_ml_fk.sql
\i 16-ai-ml-innovation/96_guest_behavior_patterns_fk.sql
\i 16-ai-ml-innovation/97_sentiment_analysis_fk.sql

-- =====================================================
-- CATEGORY 17: SUSTAINABILITY & ESG (1 file)
-- =====================================================

\echo '>>> [17/20] Creating Sustainability & ESG Constraints (1 file)...'
\i 17-sustainability-esg/98_sustainability_metrics_fk.sql

-- =====================================================
-- CATEGORY 18: IOT & SMART ROOMS (1 file)
-- =====================================================

\echo '>>> [18/20] Creating IoT & Smart Rooms Constraints (1 file)...'
\i 18-iot-smart-rooms/99_smart_room_devices_fk.sql

-- =====================================================
-- CATEGORY 19: CONTACTLESS & DIGITAL (1 file)
-- =====================================================

\echo '>>> [19/20] Creating Contactless & Digital Constraints (1 file)...'
\i 19-contactless-digital/100_mobile_check_ins_fk.sql

-- =====================================================
-- CATEGORY 20: ASSET MANAGEMENT (1 file)
-- =====================================================

\echo '>>> [20/20] Creating Asset Management Constraints (1 file)...'
\i 20-asset-management/101_asset_inventory_fk.sql

\echo ''
\echo '============================================='
\echo '✓ ALL 102 CONSTRAINT FILES PROCESSED'
\echo '============================================='
\echo ''
