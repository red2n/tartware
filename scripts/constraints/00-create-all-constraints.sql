-- ============================================================================
-- Tartware PMS - Master Constraints (FK) Creation Script
-- Consolidated Structure (References existing constraint files from 7 categories)
-- ============================================================================

\echo '========================================='
\echo 'TARTWARE PMS - Creating All Foreign Keys'
\echo 'Consolidated Structure: 7 Categories'
\echo '========================================='
\echo ''

-- ============================================================================
-- CATEGORY 1: CORE CONSTRAINTS (4 files)
-- ============================================================================
\echo '>>> Creating constraints for: CORE FOUNDATION'

\ir 01-core/01_user_tenant_associations_fk.sql
\ir 01-core/02_properties_fk.sql
\ir 01-core/03_guests_fk.sql
\ir 01-core/04_settings_fk.sql

-- ============================================================================
-- CATEGORY 2: INVENTORY & PRICING CONSTRAINTS (19 files)
-- ============================================================================
\echo '>>> Creating constraints for: INVENTORY & PRICING'

\ir 02-inventory/04_room_types_fk.sql
\ir 02-inventory/05_rooms_fk.sql
\ir 02-inventory/06_rates_fk.sql
\ir 02-inventory/07_room_availability_fk.sql
\ir 02-inventory/36_rate_overrides_fk.sql
\ir 02-inventory/51_revenue_forecasts_fk.sql
\ir 02-inventory/52_competitor_rates_fk.sql
\ir 02-inventory/53_demand_calendar_fk.sql
\ir 02-inventory/54_pricing_rules_fk.sql
\ir 02-inventory/55_rate_recommendations_fk.sql
\ir 02-inventory/56_revenue_goals_fk.sql
\ir 02-inventory/90_companies_fk.sql
\ir 02-inventory/91_group_bookings_fk.sql
\ir 02-inventory/92_packages_fk.sql
\ir 02-inventory/93_travel_agent_commissions_fk.sql
\ir 02-inventory/97_meeting_rooms_fk.sql
\ir 02-inventory/98_event_bookings_fk.sql
\ir 02-inventory/99_banquet_event_orders_fk.sql
\ir 02-inventory/100_room_settings_fk.sql

-- ============================================================================
-- CATEGORY 3: BOOKINGS & GUEST RELATIONS CONSTRAINTS (16 files)
-- ============================================================================
\echo '>>> Creating constraints for: BOOKINGS & GUEST RELATIONS'

\ir 03-bookings/08_reservations_fk.sql
\ir 03-bookings/09_reservation_status_history_fk.sql
\ir 03-bookings/30_deposit_schedules_fk.sql
\ir 03-bookings/31_allotments_fk.sql
\ir 03-bookings/32_booking_sources_fk.sql
\ir 03-bookings/33_market_segments_fk.sql
\ir 03-bookings/34_guest_preferences_fk.sql
\ir 03-bookings/41_guest_communications_fk.sql
\ir 03-bookings/42_communication_templates_fk.sql
\ir 03-bookings/43_guest_feedback_fk.sql
\ir 03-bookings/47_guest_loyalty_programs_fk.sql
\ir 03-bookings/48_guest_documents_fk.sql
\ir 03-bookings/49_guest_notes_fk.sql
\ir 03-bookings/50_automated_messages_fk.sql
\ir 03-bookings/51_reservation_traces_fk.sql
\ir 03-bookings/52_waitlist_entries_fk.sql

-- ============================================================================
-- CATEGORY 4: FINANCIAL CONSTRAINTS (15 files)
-- ============================================================================
\echo '>>> Creating constraints for: FINANCIAL MANAGEMENT'

\ir 04-financial/10_payments_fk.sql
\ir 04-financial/11_invoices_fk.sql
\ir 04-financial/12_invoice_items_fk.sql
\ir 04-financial/25_folios_fk.sql
\ir 04-financial/26_charge_postings_fk.sql
\ir 04-financial/35_refunds_fk.sql
\ir 04-financial/63_tax_configurations_fk.sql
\ir 04-financial/64_financial_closures_fk.sql
\ir 04-financial/65_commission_tracking_fk.sql
\ir 04-financial/66_cashier_sessions_fk.sql
\ir 04-financial/67_accounts_receivable_fk.sql
\ir 04-financial/68_credit_limits_fk.sql
\ir 04-financial/69_payment_tokens_fk.sql
\ir 04-financial/70_general_ledger_batches_fk.sql
\ir 04-financial/71_general_ledger_entries_fk.sql

-- ============================================================================
-- CATEGORY 5: OPERATIONS CONSTRAINTS (24 files)
-- ============================================================================
\echo '>>> Creating constraints for: OPERATIONS & SERVICES'

\ir 05-operations/13_services_fk.sql
\ir 05-operations/14_reservation_services_fk.sql
\ir 05-operations/15_housekeeping_tasks_fk.sql
\ir 05-operations/37_maintenance_requests_fk.sql
\ir 05-operations/57_staff_schedules_fk.sql
\ir 05-operations/58_staff_tasks_fk.sql
\ir 05-operations/59_shift_handovers_fk.sql
\ir 05-operations/60_lost_and_found_fk.sql
\ir 05-operations/61_incident_reports_fk.sql
\ir 05-operations/62_vendor_contracts_fk.sql
\ir 05-operations/82_mobile_keys_fk.sql
\ir 05-operations/83_qr_codes_fk.sql
\ir 05-operations/84_push_notifications_fk.sql
\ir 05-operations/85_app_usage_analytics_fk.sql
\ir 05-operations/99_smart_room_devices_fk.sql
\ir 05-operations/100_mobile_check_ins_fk.sql
\ir 05-operations/101_asset_inventory_fk.sql
\ir 05-operations/102_minibar_items_fk.sql
\ir 05-operations/103_minibar_consumption_fk.sql
\ir 05-operations/104_vehicles_fk.sql
\ir 05-operations/105_transportation_requests_fk.sql
\ir 05-operations/106_shuttle_schedules_fk.sql
\ir 05-operations/107_spa_treatments_fk.sql
\ir 05-operations/108_spa_appointments_fk.sql

-- ============================================================================
-- CATEGORY 6: INTEGRATIONS & CHANNELS CONSTRAINTS (23 files)
-- ============================================================================
\echo '>>> Creating constraints for: INTEGRATIONS & CHANNELS'

\ir 06-integrations/16_channel_mappings_fk.sql
\ir 06-integrations/38_ota_configurations_fk.sql
\ir 06-integrations/39_ota_rate_plans_fk.sql
\ir 06-integrations/40_ota_reservations_queue_fk.sql
\ir 06-integrations/41_gds_connections_fk.sql
\ir 06-integrations/42_gds_message_log_fk.sql
\ir 06-integrations/43_gds_reservation_queue_fk.sql
\ir 06-integrations/44_ota_inventory_sync_fk.sql
\ir 06-integrations/45_channel_rate_parity_fk.sql
\ir 06-integrations/46_channel_commission_rules_fk.sql
\ir 06-integrations/69_marketing_campaigns_fk.sql
\ir 06-integrations/70_campaign_segments_fk.sql
\ir 06-integrations/71_promotional_codes_fk.sql
\ir 06-integrations/72_referral_tracking_fk.sql
\ir 06-integrations/73_social_media_mentions_fk.sql
\ir 06-integrations/86_integration_mappings_fk.sql
\ir 06-integrations/87_api_logs_fk.sql
\ir 06-integrations/88_webhook_subscriptions_fk.sql
\ir 06-integrations/89_data_sync_status_fk.sql
\ir 06-integrations/94_ai_demand_predictions_fk.sql
\ir 06-integrations/95_dynamic_pricing_rules_ml_fk.sql
\ir 06-integrations/96_guest_behavior_patterns_fk.sql
\ir 06-integrations/97_sentiment_analysis_fk.sql

-- ============================================================================
-- CATEGORY 7: ANALYTICS & COMPLIANCE CONSTRAINTS (18 files, note: some duplicates exist)
-- ============================================================================
\echo '>>> Creating constraints for: ANALYTICS & COMPLIANCE'

\ir 07-analytics/17_analytics_metrics_fk.sql
\ir 07-analytics/18_analytics_metric_dimensions_fk.sql
\ir 07-analytics/19_analytics_reports_fk.sql
\ir 07-analytics/20_report_property_ids_fk.sql
\ir 07-analytics/23_performance_reporting_fk.sql
\ir 07-analytics/24_performance_alerting_fk.sql
\ir 07-analytics/27_audit_logs_fk.sql
\ir 07-analytics/28_business_dates_fk.sql
\ir 07-analytics/29_night_audit_log_fk.sql
\ir 07-analytics/74_gdpr_consent_logs_fk.sql
\ir 07-analytics/75_police_reports_fk.sql
\ir 07-analytics/76_contract_agreements_fk.sql
\ir 07-analytics/77_insurance_claims_fk.sql
\ir 07-analytics/78_guest_journey_tracking_fk.sql
\ir 07-analytics/79_revenue_attribution_fk.sql
\ir 07-analytics/80_forecasting_models_fk.sql
\ir 07-analytics/81_ab_test_results_fk.sql
\ir 07-analytics/98_sustainability_metrics_fk.sql

\echo ''
\echo '========================================='
\echo 'All Foreign Key Constraints Created!'
\echo 'Total: 109 unique FK files across 7 categories'
\echo '========================================='
