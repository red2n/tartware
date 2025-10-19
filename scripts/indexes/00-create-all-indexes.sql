-- =====================================================
-- 00-create-all-indexes.sql
-- Master script to create all 89 table indexes
-- Organized by functional categories
-- Run this after tables are created
-- Date: 2025-10-19
-- =====================================================

\c tartware

\echo ''
\echo '============================================='
\echo 'CREATING ALL 89 TABLE INDEXES'
\echo 'Performance optimization for Tartware PMS'
\echo '============================================='
\echo ''

-- =====================================================
-- CATEGORY 1: CORE FOUNDATION (5 tables)
-- =====================================================
\echo '>>> Creating Core Foundation Indexes (1-5)...'
\i ./01-core-foundation/01_tenants_indexes.sql
\i ./01-core-foundation/02_users_indexes.sql
\i ./01-core-foundation/03_user_tenant_associations_indexes.sql
\i ./01-core-foundation/04_properties_indexes.sql
\i ./01-core-foundation/05_guests_indexes.sql

-- =====================================================
-- CATEGORY 2: ROOM & INVENTORY MANAGEMENT (4 tables)
-- =====================================================
\echo '>>> Creating Room & Inventory Indexes (6-9)...'
\i ./02-room-inventory/06_room_types_indexes.sql
\i ./02-room-inventory/07_rooms_indexes.sql
\i ./02-room-inventory/08_rates_indexes.sql
\i ./02-room-inventory/09_availability_room_availability_indexes.sql

-- =====================================================
-- CATEGORY 3: RESERVATIONS & BOOKING (7 tables)
-- =====================================================
\echo '>>> Creating Reservations & Booking Indexes (10-11, 30-34)...'
\i ./03-reservations-booking/10_reservations_indexes.sql
\i ./03-reservations-booking/11_reservation_status_history_indexes.sql
\i ./03-reservations-booking/30_deposit_schedules_indexes.sql
\i ./03-reservations-booking/31_allotments_indexes.sql
\i ./03-reservations-booking/32_booking_sources_indexes.sql
\i ./03-reservations-booking/33_market_segments_indexes.sql
\i ./03-reservations-booking/34_guest_preferences_indexes.sql

-- =====================================================
-- CATEGORY 4: FINANCIAL MANAGEMENT (12 tables)
-- =====================================================
\echo '>>> Creating Financial Management Indexes (12-14, 25-26, 35, 63-68)...'
\i ./04-financial-management/12_payments_indexes.sql
\i ./04-financial-management/13_invoices_indexes.sql
\i ./04-financial-management/14_invoice_items_indexes.sql
\i ./04-financial-management/25_folios_indexes.sql
\i ./04-financial-management/26_charge_postings_indexes.sql
\i ./04-financial-management/35_refunds_indexes.sql
\i ./04-financial-management/63_tax_configurations_indexes.sql
\i ./04-financial-management/64_financial_closures_indexes.sql
\i ./04-financial-management/65_commission_tracking_indexes.sql
\i ./04-financial-management/66_cashier_sessions_indexes.sql
\i ./04-financial-management/67_accounts_receivable_indexes.sql
\i ./04-financial-management/68_credit_limits_indexes.sql

-- =====================================================
-- CATEGORY 5: SERVICES & HOUSEKEEPING (4 tables)
-- =====================================================
\echo '>>> Creating Services & Housekeeping Indexes (15-17, 37)...'
\i ./05-services-housekeeping/15_services_indexes.sql
\i ./05-services-housekeeping/16_reservation_services_indexes.sql
\i ./05-services-housekeeping/17_housekeeping_tasks_indexes.sql
\i ./05-services-housekeeping/37_maintenance_requests_indexes.sql

-- =====================================================
-- CATEGORY 6: CHANNEL MANAGEMENT & OTA (7 tables)
-- =====================================================
\echo '>>> Creating Channel Management & OTA Indexes (18, 38-46)...'
\i ./06-channel-ota/18_channel_mappings_indexes.sql
\i ./06-channel-ota/38_ota_configurations_indexes.sql
\i ./06-channel-ota/39_ota_rate_plans_indexes.sql
\i ./06-channel-ota/40_ota_reservations_queue_indexes.sql
\i ./06-channel-ota/44_ota_inventory_sync_indexes.sql
\i ./06-channel-ota/45_channel_rate_parity_indexes.sql
\i ./06-channel-ota/46_channel_commission_rules_indexes.sql

-- =====================================================
-- CATEGORY 7: GUEST RELATIONS & CRM (7 tables)
-- =====================================================
\echo '>>> Creating Guest Relations & CRM Indexes (41-43, 47-50)...'
\i ./07-guest-crm/41_guest_communications_indexes.sql
\i ./07-guest-crm/42_communication_templates_indexes.sql
\i ./07-guest-crm/43_guest_feedback_indexes.sql
\i ./07-guest-crm/47_guest_loyalty_programs_indexes.sql
\i ./07-guest-crm/48_guest_documents_indexes.sql
\i ./07-guest-crm/49_guest_notes_indexes.sql
\i ./07-guest-crm/50_automated_messages_indexes.sql

-- =====================================================
-- CATEGORY 8: REVENUE MANAGEMENT (7 tables)
-- =====================================================
\echo '>>> Creating Revenue Management Indexes (36, 51-56)...'
\i ./08-revenue-management/36_rate_overrides_indexes.sql
\i ./08-revenue-management/51_revenue_forecasts_indexes.sql
\i ./08-revenue-management/52_competitor_rates_indexes.sql
\i ./08-revenue-management/53_demand_calendar_indexes.sql
\i ./08-revenue-management/54_pricing_rules_indexes.sql
\i ./08-revenue-management/55_rate_recommendations_indexes.sql
\i ./08-revenue-management/56_revenue_goals_indexes.sql

-- =====================================================
-- CATEGORY 9: STAFF & OPERATIONS (6 tables)
-- =====================================================
\echo '>>> Creating Staff & Operations Indexes (57-62)...'
\i ./09-staff-operations/57_staff_schedules_indexes.sql
\i ./09-staff-operations/58_staff_tasks_indexes.sql
\i ./09-staff-operations/59_shift_handovers_indexes.sql
\i ./09-staff-operations/60_lost_and_found_indexes.sql
\i ./09-staff-operations/61_incident_reports_indexes.sql
\i ./09-staff-operations/62_vendor_contracts_indexes.sql

-- =====================================================
-- CATEGORY 10: MARKETING & CAMPAIGNS (5 tables)
-- =====================================================
\echo '>>> Creating Marketing & Campaigns Indexes (69-73)...'
\i ./10-marketing-campaigns/69_marketing_campaigns_indexes.sql
\i ./10-marketing-campaigns/70_campaign_segments_indexes.sql
\i ./10-marketing-campaigns/71_promotional_codes_indexes.sql
\i ./10-marketing-campaigns/72_referral_tracking_indexes.sql
\i ./10-marketing-campaigns/73_social_media_mentions_indexes.sql

-- =====================================================
-- CATEGORY 11: COMPLIANCE & LEGAL (4 tables)
-- =====================================================
\echo '>>> Creating Compliance & Legal Indexes (74-77)...'
\i ./11-compliance-legal/74_gdpr_consent_logs_indexes.sql
\i ./11-compliance-legal/75_police_reports_indexes.sql
\i ./11-compliance-legal/76_contract_agreements_indexes.sql
\i ./11-compliance-legal/77_insurance_claims_indexes.sql

-- =====================================================
-- CATEGORY 12: ANALYTICS & REPORTING (10 tables)
-- =====================================================
\echo '>>> Creating Analytics & Reporting Indexes (19-24, 78-81)...'
\i ./12-analytics-reporting/19_analytics_metrics_indexes.sql
\i ./12-analytics-reporting/20_analytics_metric_dimensions_indexes.sql
\i ./12-analytics-reporting/21_analytics_reports_indexes.sql
\i ./12-analytics-reporting/22_report_property_ids_indexes.sql
\i ./12-analytics-reporting/23_performance_reporting_indexes.sql
\i ./12-analytics-reporting/24_performance_alerting_indexes.sql
\i ./12-analytics-reporting/78_guest_journey_tracking_indexes.sql
\i ./12-analytics-reporting/79_revenue_attribution_indexes.sql
\i ./12-analytics-reporting/80_forecasting_models_indexes.sql
\i ./12-analytics-reporting/81_ab_test_results_indexes.sql

-- =====================================================
-- CATEGORY 13: MOBILE & DIGITAL (4 tables)
-- =====================================================
\echo '>>> Creating Mobile & Digital Indexes (82-85)...'
\i ./13-mobile-digital/82_mobile_keys_indexes.sql
\i ./13-mobile-digital/83_qr_codes_indexes.sql
\i ./13-mobile-digital/84_push_notifications_indexes.sql
\i ./13-mobile-digital/85_app_usage_analytics_indexes.sql

-- =====================================================
-- CATEGORY 14: SYSTEM & AUDIT (3 tables)
-- =====================================================
\echo '>>> Creating System & Audit Indexes (27-29)...'
\i ./14-system-audit/27_audit_logs_indexes.sql
\i ./14-system-audit/28_business_dates_indexes.sql
\i ./14-system-audit/29_night_audit_log_indexes.sql

-- =====================================================
-- CATEGORY 15: INTEGRATION HUB (4 tables)
-- =====================================================
\echo '>>> Creating Integration Hub Indexes (86-89)...'
\i ./15-integration-hub/86_integration_mappings_indexes.sql
\i ./15-integration-hub/87_api_logs_indexes.sql
\i ./15-integration-hub/88_webhook_subscriptions_indexes.sql
\i ./15-integration-hub/89_data_sync_status_indexes.sql

\echo ''
\echo '============================================='
\echo '✓ ALL 89 TABLE INDEXES CREATED SUCCESSFULLY!'
\echo '============================================='
\echo ''
\echo 'Index Summary:'
\echo '  - Total index files: 89'
\echo '  - Estimated total indexes: 650+'
\echo '  - Index types:'
\echo '    • B-tree (standard indexes)'
\echo '    • GIN (JSONB indexes)'
\echo '    • Trigram (full-text search)'
\echo '    • Partial (WHERE clause filters)'
\echo '    • Composite (multi-column)'
\echo ''
\echo 'Next steps:'
\echo '  1. Run constraints/00-create-all-constraints.sql'
\echo '  2. Run verify-indexes.sql to validate'
\echo '============================================='
\echo ''
