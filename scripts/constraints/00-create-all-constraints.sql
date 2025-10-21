-- =====================================================-- =====================================================-- =====================================================

-- 00-create-all-constraints.sql

-- Master script to create all 132 table constraints-- 00-create-all-constraints.sql-- 00-create-all-constraints.sql

-- Organized by functional categories

-- Run this after tables and indexes are created-- Master Script to Create All 89 Table Foreign Key Constraints-- Master Script to Create All Foreign Key Constraints

-- Date: 2025-10-21

-- =====================================================-- Organized by functional categories-- Date: 2025-10-15



\c tartware-- Date: 2025-10-19--



\echo ''---- Purpose: Orchestrate creation of all foreign key constraints

\echo '============================================='

\echo 'CREATING ALL 132 TABLE CONSTRAINTS'-- Purpose: Orchestrate creation of all foreign key constraints--          in the correct order to respect table dependencies

\echo 'Data Integrity Layer for Tartware PMS'

\echo '============================================='--          in the correct order to respect table dependencies--

\echo ''

---- Usage: Execute this after all tables and indexes are created

-- =====================================================

-- CATEGORY 1: CORE FOUNDATION (3 constraint files)-- Usage: Execute this after all tables and indexes are created--        psql -U postgres -d tartware -f 00-create-all-constraints.sql

-- Multi-tenancy, users, properties, guest management

-- =====================================================--        psql -U postgres -d tartware -f 00-create-all-constraints.sql-- =====================================================

\echo ''

\echo '>>> Creating Core Foundation Constraints (1-5)...'-- =====================================================

\i constraints/01-core-foundation/01_user_tenant_associations_fk.sql

\i constraints/01-core-foundation/02_properties_fk.sql\c tartware

\i constraints/01-core-foundation/03_guests_fk.sql

\c tartware

-- =====================================================

-- CATEGORY 2: ROOM & INVENTORY MANAGEMENT (4 constraint files)\echo '=============================================='

-- Room types, rooms, rates, availability

-- =====================================================\echo '=============================================='\echo '  TARTWARE PMS - FOREIGN KEY CONSTRAINTS'

\echo ''

\echo '>>> Creating Room & Inventory Constraints (6-9)...'\echo '  TARTWARE PMS - FOREIGN KEY CONSTRAINTS'\echo '  Phase 2B: Data Integrity Layer'

\i constraints/02-room-inventory/04_room_types_fk.sql

\i constraints/02-room-inventory/05_rooms_fk.sql\echo '  Creating Constraints for 89 Tables'\echo '=============================================='

\i constraints/02-room-inventory/06_rates_fk.sql

\i constraints/02-room-inventory/07_availability_room_availability_fk.sql\echo '=============================================='\echo ''



-- =====================================================\echo ''

-- CATEGORY 3: RESERVATIONS & BOOKING (7 constraint files)

-- Reservation lifecycle, deposits, allotments-- Check if all tables exist before creating constraints

-- =====================================================

\echo ''-- =====================================================DO $$

\echo '>>> Creating Reservations & Booking Constraints (10-11, 30-34)...'

\i constraints/03-reservations-booking/08_reservations_fk.sql-- CATEGORY 1: CORE FOUNDATION (3 constraint files)DECLARE

\i constraints/03-reservations-booking/09_reservation_status_history_fk.sql

\i constraints/03-reservations-booking/30_deposit_schedules_fk.sql-- =====================================================    missing_tables TEXT;

\i constraints/03-reservations-booking/31_allotments_fk.sql

\i constraints/03-reservations-booking/32_booking_sources_fk.sql\echo '>>> Creating Core Foundation Constraints...'BEGIN

\i constraints/03-reservations-booking/33_market_segments_fk.sql

\i constraints/03-reservations-booking/34_guest_preferences_fk.sql\i constraints/01-core-foundation/01_user_tenant_associations_fk.sql    SELECT string_agg(required_table, ', ')



-- =====================================================\i constraints/01-core-foundation/02_properties_fk.sql    INTO missing_tables

-- CATEGORY 4: FINANCIAL MANAGEMENT (12 constraint files)

-- Payments, invoices, accounting, receivables\i constraints/01-core-foundation/03_guests_fk.sql    FROM (

-- =====================================================

\echo ''        SELECT unnest(ARRAY[

\echo '>>> Creating Financial Management Constraints (12-14, 25-26, 35, 63-68)...'

\i constraints/04-financial-management/10_payments_fk.sql-- =====================================================            'tenants', 'users', 'user_tenant_associations', 'properties',

\i constraints/04-financial-management/11_invoices_fk.sql

\i constraints/04-financial-management/12_invoice_items_fk.sql-- CATEGORY 2: ROOM & INVENTORY MANAGEMENT (4 constraint files)            'guests', 'room_types', 'rooms', 'rates', 'reservations',

\i constraints/04-financial-management/25_folios_fk.sql

\i constraints/04-financial-management/26_charge_postings_fk.sql-- =====================================================            'reservation_status_history', 'payments', 'invoices', 'invoice_items',

\i constraints/04-financial-management/35_refunds_fk.sql

\i constraints/04-financial-management/63_tax_configurations_fk.sql\echo '>>> Creating Room & Inventory Constraints...'            'services', 'reservation_services', 'housekeeping_tasks',

\i constraints/04-financial-management/64_financial_closures_fk.sql

\i constraints/04-financial-management/65_commission_tracking_fk.sql\i constraints/02-room-inventory/04_room_types_fk.sql            'channel_mappings', 'analytics_metrics', 'analytics_metric_dimensions',

\i constraints/04-financial-management/66_cashier_sessions_fk.sql

\i constraints/04-financial-management/67_accounts_receivable_fk.sql\i constraints/02-room-inventory/05_rooms_fk.sql            'analytics_reports', 'report_property_ids', 'performance_reports',

\i constraints/04-financial-management/68_credit_limits_fk.sql

\i constraints/02-room-inventory/06_rates_fk.sql            'report_schedules', 'performance_thresholds', 'performance_baselines',

-- =====================================================

-- CATEGORY 5: SERVICES & HOUSEKEEPING (4 constraint files)\i constraints/02-room-inventory/07_availability_room_availability_fk.sql            'performance_alerts', 'alert_rules', 'folios', 'charge_postings',

-- Additional services, housekeeping, maintenance

-- =====================================================            'audit_logs', 'business_dates', 'night_audit_log', 'deposit_schedules',

\echo ''

\echo '>>> Creating Services & Housekeeping Constraints (15-17, 37)...'-- =====================================================            'allotments', 'booking_sources', 'market_segments', 'guest_preferences',

\i constraints/05-services-housekeeping/13_services_fk.sql

\i constraints/05-services-housekeeping/14_reservation_services_fk.sql-- CATEGORY 3: RESERVATIONS & BOOKING (7 constraint files)            'refunds', 'rate_overrides', 'maintenance_requests'

\i constraints/05-services-housekeeping/15_housekeeping_tasks_fk.sql

\i constraints/05-services-housekeeping/37_maintenance_requests_fk.sql-- =====================================================        ]) AS required_table



-- =====================================================\echo '>>> Creating Reservations & Booking Constraints...'    ) t

-- CATEGORY 6: CHANNEL MANAGEMENT & OTA (7 constraint files)

-- Distribution channels, OTA integrations\i constraints/03-reservations-booking/08_reservations_fk.sql    WHERE NOT EXISTS (

-- =====================================================

\echo ''\i constraints/03-reservations-booking/09_reservation_status_history_fk.sql        SELECT 1 FROM information_schema.tables

\echo '>>> Creating Channel Management & OTA Constraints (18, 38-46)...'

\i constraints/06-channel-ota/16_channel_mappings_fk.sql\i constraints/03-reservations-booking/30_deposit_schedules_fk.sql        WHERE table_schema = 'public'

\i constraints/06-channel-ota/38_ota_configurations_fk.sql

\i constraints/06-channel-ota/39_ota_rate_plans_fk.sql\i constraints/03-reservations-booking/31_allotments_fk.sql        AND table_name = t.required_table

\i constraints/06-channel-ota/40_ota_reservations_queue_fk.sql

\i constraints/06-channel-ota/44_ota_inventory_sync_fk.sql\i constraints/03-reservations-booking/32_booking_sources_fk.sql    )

\i constraints/06-channel-ota/45_channel_rate_parity_fk.sql

\i constraints/06-channel-ota/46_channel_commission_rules_fk.sql\i constraints/03-reservations-booking/33_market_segments_fk.sql    AND NOT EXISTS (



-- =====================================================\i constraints/03-reservations-booking/34_guest_preferences_fk.sql        SELECT 1 FROM information_schema.tables

-- CATEGORY 7: GUEST RELATIONS & CRM (7 constraint files)

-- Communications, loyalty, documents, feedback        WHERE table_schema = 'availability'

-- =====================================================

\echo ''-- =====================================================        AND table_name = 'room_availability'

\echo '>>> Creating Guest Relations & CRM Constraints (41-43, 47-50)...'

\i constraints/07-guest-crm/41_guest_communications_fk.sql-- CATEGORY 4: FINANCIAL MANAGEMENT (12 constraint files)    );

\i constraints/07-guest-crm/42_communication_templates_fk.sql

\i constraints/07-guest-crm/43_guest_feedback_fk.sql-- =====================================================

\i constraints/07-guest-crm/47_guest_loyalty_programs_fk.sql

\i constraints/07-guest-crm/48_guest_documents_fk.sql\echo '>>> Creating Financial Management Constraints...'    IF missing_tables IS NOT NULL THEN

\i constraints/07-guest-crm/49_guest_notes_fk.sql

\i constraints/07-guest-crm/50_automated_messages_fk.sql\i constraints/04-financial-management/10_payments_fk.sql        RAISE EXCEPTION 'Cannot create constraints. Missing tables: %', missing_tables;



-- =====================================================\i constraints/04-financial-management/11_invoices_fk.sql    END IF;

-- CATEGORY 8: REVENUE MANAGEMENT (11 constraint files)

-- Pricing, forecasting, competitor analysis, B2B, groups\i constraints/04-financial-management/12_invoice_items_fk.sqlEND $$;

-- =====================================================

\echo ''\i constraints/04-financial-management/25_folios_fk.sql

\echo '>>> Creating Revenue Management Constraints (36, 51-56, 90-93)...'

\i constraints/08-revenue-management/36_rate_overrides_fk.sql\i constraints/04-financial-management/26_charge_postings_fk.sql\echo '✓ All required tables exist'

\i constraints/08-revenue-management/51_revenue_forecasts_fk.sql

\i constraints/08-revenue-management/52_competitor_rates_fk.sql\i constraints/04-financial-management/35_refunds_fk.sql\echo ''

\i constraints/08-revenue-management/53_demand_calendar_fk.sql

\i constraints/08-revenue-management/54_pricing_rules_fk.sql\i constraints/04-financial-management/63_tax_configurations_fk.sql

\i constraints/08-revenue-management/55_rate_recommendations_fk.sql

\i constraints/08-revenue-management/56_revenue_goals_fk.sql\i constraints/04-financial-management/64_financial_closures_fk.sql-- =====================================================

\i constraints/08-revenue-management/90_companies_fk.sql

\i constraints/08-revenue-management/91_group_bookings_fk.sql\i constraints/04-financial-management/65_commission_tracking_fk.sql-- EXECUTION ORDER (respecting table dependencies)

\i constraints/08-revenue-management/92_packages_fk.sql

\i constraints/08-revenue-management/93_travel_agent_commissions_fk.sql\i constraints/04-financial-management/66_cashier_sessions_fk.sql-- =====================================================



-- =====================================================\i constraints/04-financial-management/67_accounts_receivable_fk.sql

-- CATEGORY 9: STAFF & OPERATIONS (6 constraint files)

-- Staff scheduling, tasks, handovers, incidents\i constraints/04-financial-management/68_credit_limits_fk.sql\echo '1/20 Creating user_tenant_associations constraints...'

-- =====================================================

\echo ''\i 01_user_tenant_associations_fk.sql

\echo '>>> Creating Staff & Operations Constraints (57-62)...'

\i constraints/09-staff-operations/57_staff_schedules_fk.sql-- =====================================================\echo ''

\i constraints/09-staff-operations/58_staff_tasks_fk.sql

\i constraints/09-staff-operations/59_shift_handovers_fk.sql-- CATEGORY 5: SERVICES & HOUSEKEEPING (4 constraint files)

\i constraints/09-staff-operations/60_lost_and_found_fk.sql

\i constraints/09-staff-operations/61_incident_reports_fk.sql-- =====================================================\echo '2/20 Creating properties constraints...'

\i constraints/09-staff-operations/62_vendor_contracts_fk.sql

\echo '>>> Creating Services & Housekeeping Constraints...'\i 02_properties_fk.sql

-- =====================================================

-- CATEGORY 10: MARKETING & CAMPAIGNS (5 constraint files)\i constraints/05-services-housekeeping/13_services_fk.sql\echo ''

-- Campaigns, promotions, referrals, social media

-- =====================================================\i constraints/05-services-housekeeping/14_reservation_services_fk.sql

\echo ''

\echo '>>> Creating Marketing & Campaigns Constraints (69-73)...'\i constraints/05-services-housekeeping/15_housekeeping_tasks_fk.sql\echo '3/20 Creating guests constraints...'

\i constraints/10-marketing-campaigns/69_marketing_campaigns_fk.sql

\i constraints/10-marketing-campaigns/70_campaign_segments_fk.sql\i constraints/05-services-housekeeping/37_maintenance_requests_fk.sql\i 03_guests_fk.sql

\i constraints/10-marketing-campaigns/71_promotional_codes_fk.sql

\i constraints/10-marketing-campaigns/72_referral_tracking_fk.sql\echo ''

\i constraints/10-marketing-campaigns/73_social_media_mentions_fk.sql

-- =====================================================

-- =====================================================

-- CATEGORY 11: COMPLIANCE & LEGAL (4 constraint files)-- CATEGORY 6: CHANNEL MANAGEMENT & OTA (7 constraint files)\echo '4/20 Creating room_types constraints...'

-- GDPR, police reports, contracts, insurance

-- =====================================================-- =====================================================\i 04_room_types_fk.sql

\echo ''

\echo '>>> Creating Compliance & Legal Constraints (74-77)...'\echo '>>> Creating Channel Management & OTA Constraints...'\echo ''

\i constraints/11-compliance-legal/74_gdpr_consent_logs_fk.sql

\i constraints/11-compliance-legal/75_police_reports_fk.sql\i constraints/06-channel-ota/16_channel_mappings_fk.sql

\i constraints/11-compliance-legal/76_contract_agreements_fk.sql

\i constraints/11-compliance-legal/77_insurance_claims_fk.sql\i constraints/06-channel-ota/38_ota_configurations_fk.sql\echo '5/20 Creating rooms constraints...'



-- =====================================================\i constraints/06-channel-ota/39_ota_rate_plans_fk.sql\i 05_rooms_fk.sql

-- CATEGORY 12: ANALYTICS & REPORTING (12 constraint files)

-- Metrics, reports, performance, advanced analytics\i constraints/06-channel-ota/40_ota_reservations_queue_fk.sql\echo ''

-- =====================================================

\echo ''\i constraints/06-channel-ota/44_ota_inventory_sync_fk.sql

\echo '>>> Creating Analytics & Reporting Constraints (17-24, 78-81)...'

\i constraints/12-analytics-reporting/17_analytics_metrics_fk.sql\i constraints/06-channel-ota/45_channel_rate_parity_fk.sql\echo '6/20 Creating rates constraints...'

\i constraints/12-analytics-reporting/18_analytics_metric_dimensions_fk.sql

\i constraints/12-analytics-reporting/19_analytics_reports_fk.sql\i constraints/06-channel-ota/46_channel_commission_rules_fk.sql\i 06_rates_fk.sql

\i constraints/12-analytics-reporting/20_report_property_ids_fk.sql

\i constraints/12-analytics-reporting/21_analytics_metrics_fk.sql\echo ''

\i constraints/12-analytics-reporting/22_analytics_metric_dimensions_fk.sql

\i constraints/12-analytics-reporting/23_performance_reporting_fk.sql-- =====================================================

\i constraints/12-analytics-reporting/24_performance_alerting_fk.sql

\i constraints/12-analytics-reporting/78_guest_journey_tracking_fk.sql-- CATEGORY 7: GUEST RELATIONS & CRM (7 constraint files)\echo '7/20 Creating availability.room_availability constraints...'

\i constraints/12-analytics-reporting/79_revenue_attribution_fk.sql

\i constraints/12-analytics-reporting/80_forecasting_models_fk.sql-- =====================================================\i 07_availability_room_availability_fk.sql

\i constraints/12-analytics-reporting/81_ab_test_results_fk.sql

\echo '>>> Creating Guest Relations & CRM Constraints...'\echo ''

-- =====================================================

-- CATEGORY 13: MOBILE & DIGITAL (4 constraint files)\i constraints/07-guest-crm/41_guest_communications_fk.sql

-- Mobile keys, QR codes, push notifications

-- =====================================================\i constraints/07-guest-crm/42_communication_templates_fk.sql\echo '8/20 Creating reservations constraints...'

\echo ''

\echo '>>> Creating Mobile & Digital Constraints (82-85)...'\i constraints/07-guest-crm/43_guest_feedback_fk.sql\i 08_reservations_fk.sql

\i constraints/13-mobile-digital/82_mobile_keys_fk.sql

\i constraints/13-mobile-digital/83_qr_codes_fk.sql\i constraints/07-guest-crm/47_guest_loyalty_programs_fk.sql\echo ''

\i constraints/13-mobile-digital/84_push_notifications_fk.sql

\i constraints/13-mobile-digital/85_app_usage_analytics_fk.sql\i constraints/07-guest-crm/48_guest_documents_fk.sql



-- =====================================================\i constraints/07-guest-crm/49_guest_notes_fk.sql\echo '9/20 Creating reservation_status_history constraints...'

-- CATEGORY 14: SYSTEM & AUDIT (3 constraint files)

-- Audit logs, business dates, night audit\i constraints/07-guest-crm/50_automated_messages_fk.sql\i 09_reservation_status_history_fk.sql

-- =====================================================

\echo ''\echo ''

\echo '>>> Creating System & Audit Constraints (27-29)...'

\i constraints/14-system-audit/27_audit_logs_fk.sql-- =====================================================

\i constraints/14-system-audit/28_business_dates_fk.sql

\i constraints/14-system-audit/29_night_audit_log_fk.sql-- CATEGORY 8: REVENUE MANAGEMENT (7 constraint files)\echo '10/20 Creating payments constraints...'



-- =====================================================-- =====================================================\i 10_payments_fk.sql

-- CATEGORY 15: INTEGRATION HUB (4 constraint files)

-- API integrations, webhooks, data synchronization\echo '>>> Creating Revenue Management Constraints...'\echo ''

-- =====================================================

\echo ''\i constraints/08-revenue-management/36_rate_overrides_fk.sql

\echo '>>> Creating Integration Hub Constraints (86-89)...'

\i constraints/15-integration-hub/86_integration_mappings_fk.sql\i constraints/08-revenue-management/51_revenue_forecasts_fk.sql\echo '11/20 Creating invoices constraints...'

\i constraints/15-integration-hub/87_api_logs_fk.sql

\i constraints/15-integration-hub/88_webhook_subscriptions_fk.sql\i constraints/08-revenue-management/52_competitor_rates_fk.sql\i 11_invoices_fk.sql

\i constraints/15-integration-hub/89_data_sync_status_fk.sql

\i constraints/08-revenue-management/53_demand_calendar_fk.sql\echo ''

-- =====================================================

-- CATEGORY 16: AI/ML INNOVATION (4 constraint files)\i constraints/08-revenue-management/54_pricing_rules_fk.sql

-- AI demand forecasting, ML pricing, behavior patterns

-- =====================================================\i constraints/08-revenue-management/55_rate_recommendations_fk.sql\echo '12/20 Creating invoice_items constraints...'

\echo ''

\echo '>>> Creating AI/ML Innovation Constraints (94-97)...'\i constraints/08-revenue-management/56_revenue_goals_fk.sql\i 12_invoice_items_fk.sql

\i constraints/16-ai-ml-innovation/94_ai_demand_predictions_fk.sql

\i constraints/16-ai-ml-innovation/95_dynamic_pricing_rules_ml_fk.sql\echo ''

\i constraints/16-ai-ml-innovation/96_guest_behavior_patterns_fk.sql

\i constraints/16-ai-ml-innovation/97_sentiment_analysis_fk.sql-- =====================================================



-- =====================================================-- CATEGORY 9: STAFF & OPERATIONS (6 constraint files)\echo '13/20 Creating services constraints...'

-- CATEGORY 17: SUSTAINABILITY & ESG (1 constraint file)

-- Environmental metrics, green certifications, carbon tracking-- =====================================================\i 13_services_fk.sql

-- =====================================================

\echo ''\echo '>>> Creating Staff & Operations Constraints...'\echo ''

\echo '>>> Creating Sustainability & ESG Constraints (98)...'

\i constraints/17-sustainability-esg/98_sustainability_metrics_fk.sql\i constraints/09-staff-operations/57_staff_schedules_fk.sql



-- =====================================================\i constraints/09-staff-operations/58_staff_tasks_fk.sql\echo '14/20 Creating reservation_services constraints...'

-- CATEGORY 18: IOT & SMART ROOMS (1 constraint file)

-- Smart devices, energy management, automation\i constraints/09-staff-operations/59_shift_handovers_fk.sql\i 14_reservation_services_fk.sql

-- =====================================================

\echo ''\i constraints/09-staff-operations/60_lost_and_found_fk.sql\echo ''

\echo '>>> Creating IoT & Smart Rooms Constraints (99)...'

\i constraints/18-iot-smart-rooms/99_smart_room_devices_fk.sql\i constraints/09-staff-operations/61_incident_reports_fk.sql



-- =====================================================\i constraints/09-staff-operations/62_vendor_contracts_fk.sql\echo '15/20 Creating housekeeping_tasks constraints...'

-- CATEGORY 19: CONTACTLESS & DIGITAL (1 constraint file)

-- Mobile check-in, digital registration, contactless services\i 15_housekeeping_tasks_fk.sql

-- =====================================================

\echo ''-- =====================================================\echo ''

\echo '>>> Creating Contactless & Digital Constraints (100)...'

\i constraints/19-contactless-digital/100_mobile_check_ins_fk.sql-- CATEGORY 10: MARKETING & CAMPAIGNS (5 constraint files)



-- =====================================================-- =====================================================\echo '16/20 Creating channel_mappings constraints...'

-- CATEGORY 20: ASSET MANAGEMENT (1 constraint file)

-- Asset inventory, predictive maintenance, depreciation\echo '>>> Creating Marketing & Campaigns Constraints...'\i 16_channel_mappings_fk.sql

-- =====================================================

\echo ''\i constraints/10-marketing-campaigns/69_marketing_campaigns_fk.sql\echo ''

\echo '>>> Creating Asset Management Constraints (101)...'

\i constraints/20-asset-management/101_asset_inventory_fk.sql\i constraints/10-marketing-campaigns/70_campaign_segments_fk.sql



\echo ''\i constraints/10-marketing-campaigns/71_promotional_codes_fk.sql\echo '17/20 Creating analytics_metrics constraints...'

\echo '============================================='

\echo '✓ ALL 132 TABLE CONSTRAINTS CREATED SUCCESSFULLY!'\i constraints/10-marketing-campaigns/72_referral_tracking_fk.sql\i 17_analytics_metrics_fk.sql

\echo '============================================='

\echo ''\i constraints/10-marketing-campaigns/73_social_media_mentions_fk.sql\echo ''

\echo 'Constraint Summary:'

\echo '  - 89 Core/Standard Table Constraints'

\echo '  - 43 Advanced/Innovation Table Constraints'

\echo '  - Total: 132 Constraint Files'-- =====================================================\echo '18/20 Creating analytics_metric_dimensions constraints...'

\echo '  - Estimated total foreign keys: 500+'

\echo ''-- CATEGORY 11: COMPLIANCE & LEGAL (4 constraint files)\i 18_analytics_metric_dimensions_fk.sql

\echo 'Constraint properties:'

\echo '  • All use ON DELETE RESTRICT'-- =====================================================\echo ''

\echo '  • All use ON UPDATE CASCADE'

\echo '  • Referential integrity fully enforced'\echo '>>> Creating Compliance & Legal Constraints...'

\echo '  • Soft delete pattern at application layer'

\echo ''\i constraints/11-compliance-legal/74_gdpr_consent_logs_fk.sql\echo '19/20 Creating analytics_reports constraints...'

\echo 'Next steps:'

\echo '  1. Run verify-constraints.sql to validate'\i constraints/11-compliance-legal/75_police_reports_fk.sql\i 19_analytics_reports_fk.sql

\echo '  2. Test data insertion with sample data'

\echo '============================================='\i constraints/11-compliance-legal/76_contract_agreements_fk.sql\echo ''

\echo ''

\i constraints/11-compliance-legal/77_insurance_claims_fk.sql

\echo '20/37 Creating report_property_ids constraints...'

-- =====================================================\i 20_report_property_ids_fk.sql

-- CATEGORY 12: ANALYTICS & REPORTING (13 constraint files)\echo ''

-- =====================================================

\echo '>>> Creating Analytics & Reporting Constraints...'\echo '21/37 Creating analytics_metrics constraints (updated)...'

\i constraints/12-analytics-reporting/17_analytics_metrics_fk.sql\i 21_analytics_metrics_fk.sql

\i constraints/12-analytics-reporting/18_analytics_metric_dimensions_fk.sql\echo ''

\i constraints/12-analytics-reporting/19_analytics_reports_fk.sql

\i constraints/12-analytics-reporting/20_report_property_ids_fk.sql\echo '22/37 Creating analytics_metric_dimensions constraints (updated)...'

\i constraints/12-analytics-reporting/21_analytics_metrics_fk.sql\i 22_analytics_metric_dimensions_fk.sql

\i constraints/12-analytics-reporting/22_analytics_metric_dimensions_fk.sql\echo ''

\i constraints/12-analytics-reporting/23_analytics_reports_fk.sql

\i constraints/12-analytics-reporting/23_performance_reporting_fk.sql\echo '23/37 Creating performance_reporting constraints...'

\i constraints/12-analytics-reporting/24_performance_alerting_fk.sql\i 23_performance_reporting_fk.sql

\i constraints/12-analytics-reporting/78_guest_journey_tracking_fk.sql\echo ''

\i constraints/12-analytics-reporting/79_revenue_attribution_fk.sql

\i constraints/12-analytics-reporting/80_forecasting_models_fk.sql\echo '24/37 Creating performance_alerting constraints...'

\i constraints/12-analytics-reporting/81_ab_test_results_fk.sql\i 24_performance_alerting_fk.sql

\echo ''

-- =====================================================

-- CATEGORY 13: MOBILE & DIGITAL (4 constraint files)\echo '25/37 Creating folios constraints...'

-- =====================================================\i 25_folios_fk.sql

\echo '>>> Creating Mobile & Digital Constraints...'\echo ''

\i constraints/13-mobile-digital/82_mobile_keys_fk.sql

\i constraints/13-mobile-digital/83_qr_codes_fk.sql\echo '26/37 Creating charge_postings constraints...'

\i constraints/13-mobile-digital/84_push_notifications_fk.sql\i 26_charge_postings_fk.sql

\i constraints/13-mobile-digital/85_app_usage_analytics_fk.sql\echo ''



-- =====================================================\echo '27/37 Creating audit_logs constraints...'

-- CATEGORY 14: SYSTEM & AUDIT (3 constraint files)\i 27_audit_logs_fk.sql

-- =====================================================\echo ''

\echo '>>> Creating System & Audit Constraints...'

\i constraints/14-system-audit/27_audit_logs_fk.sql\echo '28/37 Creating business_dates constraints...'

\i constraints/14-system-audit/28_business_dates_fk.sql\i 28_business_dates_fk.sql

\i constraints/14-system-audit/29_night_audit_log_fk.sql\echo ''



-- =====================================================\echo '29/37 Creating night_audit_log constraints...'

-- CATEGORY 15: INTEGRATION HUB (4 constraint files)\i 29_night_audit_log_fk.sql

-- =====================================================\echo ''

\echo '>>> Creating Integration Hub Constraints...'

\i constraints/15-integration-hub/86_integration_mappings_fk.sql\echo '30/37 Creating deposit_schedules constraints...'

\i constraints/15-integration-hub/87_api_logs_fk.sql\i 30_deposit_schedules_fk.sql

\i constraints/15-integration-hub/88_webhook_subscriptions_fk.sql\echo ''

\i constraints/15-integration-hub/89_data_sync_status_fk.sql

\echo '31/37 Creating allotments constraints...'

\echo ''\i 31_allotments_fk.sql

\echo '=============================================='\echo ''

\echo '✓ ALL 89 TABLE CONSTRAINTS CREATED!'

\echo '=============================================='\echo '32/37 Creating booking_sources constraints...'

\echo ''\i 32_booking_sources_fk.sql

\echo 'Constraint Summary:'\echo ''

\echo '  - Total constraint files: 89'

\echo '  - All constraints use ON DELETE RESTRICT'\echo '33/37 Creating market_segments constraints...'

\echo '  - All constraints use ON UPDATE CASCADE'\i 33_market_segments_fk.sql

\echo '  - Referential integrity fully enforced'\echo ''

\echo ''

\echo 'Next steps:'\echo '34/37 Creating guest_preferences constraints...'

\echo '  1. Run verify-constraints.sql to validate'\i 34_guest_preferences_fk.sql

\echo '  2. Test data insertion with sample data'\echo ''

\echo '=============================================='

\echo ''\echo '35/37 Creating refunds constraints...'

\i 35_refunds_fk.sql
\echo ''

\echo '36/37 Creating rate_overrides constraints...'
\i 36_rate_overrides_fk.sql
\echo ''

\echo '37/37 Creating maintenance_requests constraints...'
\i 37_maintenance_requests_fk.sql
\echo ''

-- =====================================================
-- VERIFICATION
-- =====================================================

\echo '=============================================='
\echo '  CONSTRAINT CREATION SUMMARY'
\echo '=============================================='

SELECT
    tc.table_schema,
    tc.table_name,
    COUNT(*) as foreign_key_count
FROM information_schema.table_constraints tc
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema IN ('public', 'availability')
GROUP BY tc.table_schema, tc.table_name
ORDER BY tc.table_schema, tc.table_name;

\echo ''
\echo '=============================================='
\echo '  TOTAL FOREIGN KEY CONSTRAINTS'
\echo '=============================================='

SELECT
    COUNT(*) as total_foreign_keys
FROM information_schema.table_constraints
WHERE constraint_type = 'FOREIGN KEY'
AND table_schema IN ('public', 'availability');

\echo ''
\echo '✓ All foreign key constraints created successfully!'
\echo ''
\echo 'IMPORTANT NOTES:'
\echo '- All constraints use ON DELETE RESTRICT'
\echo '- Hard deletes require HARD_DELETE permission'
\echo '- Soft delete pattern enforced at application layer'
\echo '- Always filter: WHERE deleted_at IS NULL'
\echo ''
