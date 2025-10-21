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
-- CATEGORY 1: CORE FOUNDATION (3 files)
-- =====================================================

\echo '>>> Creating Core Foundation Constraints...'
\i 01-core-foundation/01_user_tenant_associations_fk.sql
\i 01-core-foundation/02_properties_fk.sql
\i 01-core-foundation/03_guests_fk.sql

-- =====================================================
-- CATEGORY 2: ROOM & INVENTORY MANAGEMENT (4 files)
-- =====================================================

\echo '>>> Creating Room & Inventory Constraints...'
\i 02-room-inventory/04_room_types_fk.sql
\i 02-room-inventory/05_rooms_fk.sql
\i 02-room-inventory/06_rates_fk.sql
\i 02-room-inventory/07_availability_room_availability_fk.sql

-- =====================================================
-- CATEGORY 3: RESERVATIONS & BOOKING (7 files)
-- =====================================================

\echo '>>> Creating Reservations & Booking Constraints...'
\i 03-reservations-booking/08_reservations_fk.sql
\i 03-reservations-booking/09_reservation_status_history_fk.sql
\i 03-reservations-booking/26_reservation_addons_fk.sql
\i 03-reservations-booking/27_reservation_guests_fk.sql
\i 03-reservations-booking/57_group_bookings_fk.sql
\i 03-reservations-booking/58_package_bookings_fk.sql
\i 03-reservations-booking/59_corporate_contracts_fk.sql

-- =====================================================
-- CATEGORY 4: FINANCIAL MANAGEMENT (12 files)
-- =====================================================

\echo '>>> Creating Financial Management Constraints...'
\i 04-financial-management/10_payments_fk.sql
\i 04-financial-management/11_invoices_fk.sql
\i 04-financial-management/12_invoice_items_fk.sql
\i 04-financial-management/25_folios_fk.sql
\i 04-financial-management/60_payment_gateways_fk.sql
\i 04-financial-management/61_refunds_fk.sql
\i 04-financial-management/62_commission_tracking_fk.sql
\i 04-financial-management/63_tax_configurations_fk.sql
\i 04-financial-management/64_financial_closures_fk.sql
\i 04-financial-management/65_price_adjustments_history_fk.sql
\i 04-financial-management/68_credit_limits_fk.sql
\i 04-financial-management/69_accounts_receivable_fk.sql

-- =====================================================
-- CATEGORY 5: SERVICES & HOUSEKEEPING (4 files)
-- =====================================================

\echo '>>> Creating Services & Housekeeping Constraints...'
\i 05-services-housekeeping/13_services_fk.sql
\i 05-services-housekeeping/14_reservation_services_fk.sql
\i 05-services-housekeeping/15_housekeeping_tasks_fk.sql
\i 05-services-housekeeping/28_maintenance_requests_fk.sql

-- =====================================================
-- CATEGORY 6: CHANNEL & OTA MANAGEMENT (7 files)
-- =====================================================

\echo '>>> Creating Channel & OTA Management Constraints...'
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

\echo '>>> Creating Guest CRM Constraints...'
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

\echo '>>> Creating Revenue Management Constraints...'
\i 08-revenue-management/51_revenue_forecasts_fk.sql
\i 08-revenue-management/52_competitor_rates_fk.sql
\i 08-revenue-management/53_demand_calendar_fk.sql
\i 08-revenue-management/54_pricing_rules_fk.sql
\i 08-revenue-management/55_rate_recommendations_fk.sql
\i 08-revenue-management/66_rate_plans_fk.sql
\i 08-revenue-management/67_revenue_attribution_fk.sql
\i 08-revenue-management/77_forecasting_models_fk.sql
\i 08-revenue-management/78_demand_scenarios_fk.sql
\i 08-revenue-management/79_pricing_experiments_fk.sql
\i 08-revenue-management/80_dynamic_pricing_rules_ml_fk.sql

-- =====================================================
-- CATEGORY 9: STAFF OPERATIONS (6 files)
-- =====================================================

\echo '>>> Creating Staff Operations Constraints...'
\i 09-staff-operations/29_staff_schedules_fk.sql
\i 09-staff-operations/30_departments_fk.sql
\i 09-staff-operations/31_staff_roles_fk.sql
\i 09-staff-operations/56_staff_tasks_fk.sql
\i 09-staff-operations/70_time_attendance_fk.sql
\i 09-staff-operations/71_payroll_fk.sql

-- =====================================================
-- CATEGORY 10: MARKETING & CAMPAIGNS (5 files)
-- =====================================================

\echo '>>> Creating Marketing & Campaigns Constraints...'
\i 10-marketing-campaigns/32_campaigns_fk.sql
\i 10-marketing-campaigns/33_promotions_fk.sql
\i 10-marketing-campaigns/72_email_campaigns_fk.sql
\i 10-marketing-campaigns/73_sms_campaigns_fk.sql
\i 10-marketing-campaigns/74_social_media_posts_fk.sql

-- =====================================================
-- CATEGORY 11: COMPLIANCE & LEGAL (4 files)
-- =====================================================

\echo '>>> Creating Compliance & Legal Constraints...'
\i 11-compliance-legal/34_legal_documents_fk.sql
\i 11-compliance-legal/35_gdpr_consents_fk.sql
\i 11-compliance-legal/36_incident_reports_fk.sql
\i 11-compliance-legal/37_insurance_policies_fk.sql

-- =====================================================
-- CATEGORY 12: ANALYTICS & REPORTING (13 files)
-- =====================================================

\echo '>>> Creating Analytics & Reporting Constraints...'
\i 12-analytics-reporting/17_analytics_metrics_fk.sql
\i 12-analytics-reporting/18_analytics_metric_dimensions_fk.sql
\i 12-analytics-reporting/19_analytics_reports_fk.sql
\i 12-analytics-reporting/20_report_property_ids_fk.sql
\i 12-analytics-reporting/21_analytics_metrics_fk.sql
\i 12-analytics-reporting/22_analytics_metric_dimensions_fk.sql
\i 12-analytics-reporting/23_analytics_reports_fk.sql
\i 12-analytics-reporting/23_performance_reporting_fk.sql
\i 12-analytics-reporting/24_performance_alerting_fk.sql
\i 12-analytics-reporting/75_kpi_definitions_fk.sql
\i 12-analytics-reporting/76_business_intelligence_reports_fk.sql
\i 12-analytics-reporting/81_revenue_per_room_fk.sql
\i 12-analytics-reporting/82_occupancy_trends_fk.sql

-- =====================================================
-- CATEGORY 13: MOBILE & DIGITAL (4 files)
-- =====================================================

\echo '>>> Creating Mobile & Digital Constraints...'
\i 13-mobile-digital/83_mobile_check_ins_fk.sql
\i 13-mobile-digital/84_digital_keys_fk.sql
\i 13-mobile-digital/85_guest_app_preferences_fk.sql
\i 13-mobile-digital/86_app_usage_analytics_fk.sql

-- =====================================================
-- CATEGORY 14: SYSTEM AUDIT (3 files)
-- =====================================================

\echo '>>> Creating System Audit Constraints...'
\i 14-system-audit/87_audit_logs_fk.sql
\i 14-system-audit/88_change_logs_fk.sql
\i 14-system-audit/89_login_history_fk.sql

-- =====================================================
-- CATEGORY 15: INTEGRATION HUB (4 files)
-- =====================================================

\echo '>>> Creating Integration Hub Constraints...'
\i 15-integration-hub/90_api_keys_fk.sql
\i 15-integration-hub/91_webhook_subscriptions_fk.sql
\i 15-integration-hub/92_integration_logs_fk.sql
\i 15-integration-hub/93_third_party_connections_fk.sql

-- =====================================================
-- CATEGORY 16: AI/ML INNOVATION (4 files)
-- =====================================================

\echo '>>> Creating AI/ML Innovation Constraints...'
\i 16-ai-ml-innovation/94_guest_sentiment_analysis_fk.sql
\i 16-ai-ml-innovation/95_chatbot_conversations_fk.sql
\i 16-ai-ml-innovation/96_predictive_maintenance_fk.sql
\i 16-ai-ml-innovation/97_recommendation_engine_fk.sql

-- =====================================================
-- CATEGORY 17: SUSTAINABILITY & ESG (1 file)
-- =====================================================

\echo '>>> Creating Sustainability & ESG Constraints...'
\i 17-sustainability-esg/98_sustainability_metrics_fk.sql

-- =====================================================
-- CATEGORY 18: IOT & SMART ROOMS (1 file)
-- =====================================================

\echo '>>> Creating IoT & Smart Rooms Constraints...'
\i 18-iot-smart-rooms/99_smart_room_devices_fk.sql

-- =====================================================
-- CATEGORY 19: CONTACTLESS & DIGITAL (1 file)
-- =====================================================

\echo '>>> Creating Contactless & Digital Constraints...'
\i 19-contactless-digital/100_contactless_requests_fk.sql

-- =====================================================
-- CATEGORY 20: ASSET MANAGEMENT (1 file)
-- =====================================================

\echo '>>> Creating Asset Management Constraints...'
\i 20-asset-management/101_asset_inventory_fk.sql

\echo ''
\echo '============================================='
\echo '✓ ALL CONSTRAINTS CREATED SUCCESSFULLY'
\echo '============================================='
\echo ''
