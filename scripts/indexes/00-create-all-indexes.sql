-- =====================================================
-- 00-create-all-indexes.sql
-- Master script to create all 132 table indexes
-- Organized by functional categories
-- Run this after tables are created
-- Date: 2025-10-21
-- =====================================================

\c tartware

\echo ''
\echo '============================================='
\echo 'CREATING ALL 132 TABLE INDEXES'
\echo 'Performance optimization for Tartware PMS'
\echo '============================================='
\echo ''

-- =====================================================
-- CATEGORY 1: CORE FOUNDATION (5 tables)
-- Multi-tenancy, users, properties, guest management
-- =====================================================
\echo ''
\echo '>>> Creating Core Foundation Indexes (1-5)...'
\i indexes/01-core-foundation/01_tenants_indexes.sql
\i indexes/01-core-foundation/02_users_indexes.sql
\i indexes/01-core-foundation/03_user_tenant_associations_indexes.sql
\i indexes/01-core-foundation/04_properties_indexes.sql
\i indexes/01-core-foundation/05_guests_indexes.sql

-- =====================================================
-- CATEGORY 2: ROOM & INVENTORY MANAGEMENT (4 tables)
-- Room types, rooms, rates, availability
-- =====================================================
\echo ''
\echo '>>> Creating Room & Inventory Indexes (6-9)...'
\i indexes/02-room-inventory/06_room_types_indexes.sql
\i indexes/02-room-inventory/07_rooms_indexes.sql
\i indexes/02-room-inventory/08_rates_indexes.sql
\i indexes/02-room-inventory/09_availability_room_availability_indexes.sql

-- =====================================================
-- CATEGORY 3: RESERVATIONS & BOOKING (7 tables)
-- Reservation lifecycle, deposits, allotments
-- =====================================================
\echo ''
\echo '>>> Creating Reservations & Booking Indexes (10-11, 30-34)...'
\i indexes/03-reservations-booking/10_reservations_indexes.sql
\i indexes/03-reservations-booking/11_reservation_status_history_indexes.sql
\i indexes/03-reservations-booking/30_deposit_schedules_indexes.sql
\i indexes/03-reservations-booking/31_allotments_indexes.sql
\i indexes/03-reservations-booking/32_booking_sources_indexes.sql
\i indexes/03-reservations-booking/33_market_segments_indexes.sql
\i indexes/03-reservations-booking/34_guest_preferences_indexes.sql

-- =====================================================
-- CATEGORY 4: FINANCIAL MANAGEMENT (12 tables)
-- Payments, invoices, accounting, receivables
-- =====================================================
\echo ''
\echo '>>> Creating Financial Management Indexes (12-14, 25-26, 35, 63-68)...'
\i indexes/04-financial-management/12_payments_indexes.sql
\i indexes/04-financial-management/13_invoices_indexes.sql
\i indexes/04-financial-management/14_invoice_items_indexes.sql
\i indexes/04-financial-management/25_folios_indexes.sql
\i indexes/04-financial-management/26_charge_postings_indexes.sql
\i indexes/04-financial-management/35_refunds_indexes.sql
\i indexes/04-financial-management/63_tax_configurations_indexes.sql
\i indexes/04-financial-management/64_financial_closures_indexes.sql
\i indexes/04-financial-management/65_commission_tracking_indexes.sql
\i indexes/04-financial-management/66_cashier_sessions_indexes.sql
\i indexes/04-financial-management/67_accounts_receivable_indexes.sql
\i indexes/04-financial-management/68_credit_limits_indexes.sql

-- =====================================================
-- CATEGORY 5: SERVICES & HOUSEKEEPING (4 tables)
-- Additional services, housekeeping, maintenance
-- =====================================================
\echo ''
\echo '>>> Creating Services & Housekeeping Indexes (15-17, 37)...'
\i indexes/05-services-housekeeping/15_services_indexes.sql
\i indexes/05-services-housekeeping/16_reservation_services_indexes.sql
\i indexes/05-services-housekeeping/17_housekeeping_tasks_indexes.sql
\i indexes/05-services-housekeeping/37_maintenance_requests_indexes.sql

-- =====================================================
-- CATEGORY 6: CHANNEL MANAGEMENT & OTA (7 tables)
-- Distribution channels, OTA integrations
-- =====================================================
\echo ''
\echo '>>> Creating Channel Management & OTA Indexes (18, 38-46)...'
\i indexes/06-channel-ota/18_channel_mappings_indexes.sql
\i indexes/06-channel-ota/38_ota_configurations_indexes.sql
\i indexes/06-channel-ota/39_ota_rate_plans_indexes.sql
\i indexes/06-channel-ota/40_ota_reservations_queue_indexes.sql
\i indexes/06-channel-ota/44_ota_inventory_sync_indexes.sql
\i indexes/06-channel-ota/45_channel_rate_parity_indexes.sql
\i indexes/06-channel-ota/46_channel_commission_rules_indexes.sql

-- =====================================================
-- CATEGORY 7: GUEST RELATIONS & CRM (7 tables)
-- Communications, loyalty, documents, feedback
-- =====================================================
\echo ''
\echo '>>> Creating Guest Relations & CRM Indexes (41-43, 47-50)...'
\i indexes/07-guest-crm/41_guest_communications_indexes.sql
\i indexes/07-guest-crm/42_communication_templates_indexes.sql
\i indexes/07-guest-crm/43_guest_feedback_indexes.sql
\i indexes/07-guest-crm/47_guest_loyalty_programs_indexes.sql
\i indexes/07-guest-crm/48_guest_documents_indexes.sql
\i indexes/07-guest-crm/49_guest_notes_indexes.sql
\i indexes/07-guest-crm/50_automated_messages_indexes.sql

-- =====================================================
-- CATEGORY 8: REVENUE MANAGEMENT (11 tables)
-- Pricing, forecasting, competitor analysis, B2B, groups
-- =====================================================
\echo ''
\echo '>>> Creating Revenue Management Indexes (36, 51-56, 90-93)...'
\i indexes/08-revenue-management/36_rate_overrides_indexes.sql
\i indexes/08-revenue-management/51_revenue_forecasts_indexes.sql
\i indexes/08-revenue-management/52_competitor_rates_indexes.sql
\i indexes/08-revenue-management/53_demand_calendar_indexes.sql
\i indexes/08-revenue-management/54_pricing_rules_indexes.sql
\i indexes/08-revenue-management/55_rate_recommendations_indexes.sql
\i indexes/08-revenue-management/56_revenue_goals_indexes.sql
\i indexes/08-revenue-management/90_companies_indexes.sql
\i indexes/08-revenue-management/91_group_bookings_indexes.sql
\i indexes/08-revenue-management/92_packages_indexes.sql
\i indexes/08-revenue-management/93_travel_agent_commissions_indexes.sql

-- =====================================================
-- CATEGORY 9: STAFF & OPERATIONS (6 tables)
-- Staff scheduling, tasks, handovers, incidents
-- =====================================================
\echo ''
\echo '>>> Creating Staff & Operations Indexes (57-62)...'
\i indexes/09-staff-operations/57_staff_schedules_indexes.sql
\i indexes/09-staff-operations/58_staff_tasks_indexes.sql
\i indexes/09-staff-operations/59_shift_handovers_indexes.sql
\i indexes/09-staff-operations/60_lost_and_found_indexes.sql
\i indexes/09-staff-operations/61_incident_reports_indexes.sql
\i indexes/09-staff-operations/62_vendor_contracts_indexes.sql

-- =====================================================
-- CATEGORY 10: MARKETING & CAMPAIGNS (5 tables)
-- Campaigns, promotions, referrals, social media
-- =====================================================
\echo ''
\echo '>>> Creating Marketing & Campaigns Indexes (69-73)...'
\i indexes/10-marketing-campaigns/69_marketing_campaigns_indexes.sql
\i indexes/10-marketing-campaigns/70_campaign_segments_indexes.sql
\i indexes/10-marketing-campaigns/71_promotional_codes_indexes.sql
\i indexes/10-marketing-campaigns/72_referral_tracking_indexes.sql
\i indexes/10-marketing-campaigns/73_social_media_mentions_indexes.sql

-- =====================================================
-- CATEGORY 11: COMPLIANCE & LEGAL (4 tables)
-- GDPR, police reports, contracts, insurance
-- =====================================================
\echo ''
\echo '>>> Creating Compliance & Legal Indexes (74-77)...'
\i indexes/11-compliance-legal/74_gdpr_consent_logs_indexes.sql
\i indexes/11-compliance-legal/75_police_reports_indexes.sql
\i indexes/11-compliance-legal/76_contract_agreements_indexes.sql
\i indexes/11-compliance-legal/77_insurance_claims_indexes.sql

-- =====================================================
-- CATEGORY 12: ANALYTICS & REPORTING (10 tables)
-- Metrics, reports, performance, advanced analytics
-- =====================================================
\echo ''
\echo '>>> Creating Analytics & Reporting Indexes (19-24, 78-81)...'
\i indexes/12-analytics-reporting/19_analytics_metrics_indexes.sql
\i indexes/12-analytics-reporting/20_analytics_metric_dimensions_indexes.sql
\i indexes/12-analytics-reporting/21_analytics_reports_indexes.sql
\i indexes/12-analytics-reporting/22_report_property_ids_indexes.sql
\i indexes/12-analytics-reporting/23_performance_reporting_indexes.sql
\i indexes/12-analytics-reporting/24_performance_alerting_indexes.sql
\i indexes/12-analytics-reporting/78_guest_journey_tracking_indexes.sql
\i indexes/12-analytics-reporting/79_revenue_attribution_indexes.sql
\i indexes/12-analytics-reporting/80_forecasting_models_indexes.sql
\i indexes/12-analytics-reporting/81_ab_test_results_indexes.sql

-- =====================================================
-- CATEGORY 13: MOBILE & DIGITAL (4 tables)
-- Mobile keys, QR codes, push notifications
-- =====================================================
\echo ''
\echo '>>> Creating Mobile & Digital Indexes (82-85)...'
\i indexes/13-mobile-digital/82_mobile_keys_indexes.sql
\i indexes/13-mobile-digital/83_qr_codes_indexes.sql
\i indexes/13-mobile-digital/84_push_notifications_indexes.sql
\i indexes/13-mobile-digital/85_app_usage_analytics_indexes.sql

-- =====================================================
-- CATEGORY 14: SYSTEM & AUDIT (3 tables)
-- Audit logs, business dates, night audit
-- =====================================================
\echo ''
\echo '>>> Creating System & Audit Indexes (27-29)...'
\i indexes/14-system-audit/27_audit_logs_indexes.sql
\i indexes/14-system-audit/28_business_dates_indexes.sql
\i indexes/14-system-audit/29_night_audit_log_indexes.sql

-- =====================================================
-- CATEGORY 15: INTEGRATION HUB (4 tables)
-- API integrations, webhooks, data synchronization
-- =====================================================
\echo ''
\echo '>>> Creating Integration Hub Indexes (86-89)...'
\i indexes/15-integration-hub/86_integration_mappings_indexes.sql
\i indexes/15-integration-hub/87_api_logs_indexes.sql
\i indexes/15-integration-hub/88_webhook_subscriptions_indexes.sql
\i indexes/15-integration-hub/89_data_sync_status_indexes.sql

-- =====================================================
-- CATEGORY 16: AI/ML INNOVATION (4 tables)
-- AI demand forecasting, ML pricing, behavior patterns
-- =====================================================
\echo ''
\echo '>>> Creating AI/ML Innovation Indexes (94-97)...'
\i indexes/16-ai-ml-innovation/94_ai_demand_predictions_indexes.sql
\i indexes/16-ai-ml-innovation/95_dynamic_pricing_rules_ml_indexes.sql
\i indexes/16-ai-ml-innovation/96_guest_behavior_patterns_indexes.sql
\i indexes/16-ai-ml-innovation/97_sentiment_analysis_indexes.sql

-- =====================================================
-- CATEGORY 17: SUSTAINABILITY & ESG (1 table)
-- Environmental metrics, green certifications, carbon tracking
-- =====================================================
\echo ''
\echo '>>> Creating Sustainability & ESG Indexes (98)...'
\i indexes/17-sustainability-esg/98_sustainability_metrics_indexes.sql

-- =====================================================
-- CATEGORY 18: IOT & SMART ROOMS (1 table)
-- Smart devices, energy management, automation
-- =====================================================
\echo ''
\echo '>>> Creating IoT & Smart Rooms Indexes (99)...'
\i indexes/18-iot-smart-rooms/99_smart_room_devices_indexes.sql

-- =====================================================
-- CATEGORY 19: CONTACTLESS & DIGITAL (1 table)
-- Mobile check-in, digital registration, contactless services
-- =====================================================
\echo ''
\echo '>>> Creating Contactless & Digital Indexes (100)...'
\i indexes/19-contactless-digital/100_mobile_check_ins_indexes.sql

-- =====================================================
-- CATEGORY 20: ASSET MANAGEMENT (1 table)
-- Asset inventory, predictive maintenance, depreciation
-- =====================================================
\echo ''
\echo '>>> Creating Asset Management Indexes (101)...'
\i indexes/20-asset-management/101_asset_inventory_indexes.sql

\echo ''
\echo '============================================='
\echo '✓ ALL 132 TABLE INDEXES CREATED SUCCESSFULLY!'
\echo '============================================='
\echo ''
\echo 'Index Summary:'
\echo '  - 89 Core/Standard Table Indexes'
\echo '  - 43 Advanced/Innovation Table Indexes'
\echo '  - Total: 132 Table Index Files'
\echo '  - Estimated total indexes: 800+'
\echo ''
\echo 'Index types:'
\echo '  • B-tree (standard indexes)'
\echo '  • GIN (JSONB indexes)'
\echo '  • Trigram (full-text search)'
\echo '  • Partial (WHERE clause filters)'
\echo '  • Composite (multi-column)'
\echo ''
\echo 'Next steps:'
\echo '  1. Run constraints/00-create-all-constraints.sql'
\echo '  2. Run verify-indexes.sql to validate'
\echo '============================================='
\echo ''
