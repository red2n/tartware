-- ============================================================================
-- Tartware PMS - Master Index Creation Script
-- Consolidated Structure (References existing index files from 7 categories)
-- ============================================================================

\echo '========================================='
\echo 'TARTWARE PMS - Creating All Indexes'
\echo 'Consolidated Structure: 7 Categories'
\echo '========================================='
\echo ''

-- ============================================================================
-- CATEGORY 1: CORE INDEXES (6 files)
-- ============================================================================
\echo '>>> Creating indexes for: CORE FOUNDATION'

\ir 01-core/01_tenants_indexes.sql
\ir 01-core/02_users_indexes.sql
\ir 01-core/03_user_tenant_associations_indexes.sql
\ir 01-core/04_properties_indexes.sql
\ir 01-core/05_guests_indexes.sql
\ir 01-core/06_settings_indexes.sql

-- ============================================================================
-- CATEGORY 2: INVENTORY & PRICING INDEXES (18 files)
-- ============================================================================
\echo '>>> Creating indexes for: INVENTORY & PRICING'

\ir 02-inventory/06_room_types_indexes.sql
\ir 02-inventory/07_rooms_indexes.sql
\ir 02-inventory/08_rates_indexes.sql
\ir 02-inventory/09_availability_room_availability_indexes.sql
\ir 02-inventory/36_rate_overrides_indexes.sql
\ir 02-inventory/51_revenue_forecasts_indexes.sql
\ir 02-inventory/52_competitor_rates_indexes.sql
\ir 02-inventory/53_demand_calendar_indexes.sql
\ir 02-inventory/54_pricing_rules_indexes.sql
\ir 02-inventory/55_rate_recommendations_indexes.sql
\ir 02-inventory/56_revenue_goals_indexes.sql
\ir 02-inventory/90_companies_indexes.sql
\ir 02-inventory/91_group_bookings_indexes.sql
\ir 02-inventory/92_packages_indexes.sql
\ir 02-inventory/93_travel_agent_commissions_indexes.sql
\ir 02-inventory/97_meeting_rooms_indexes.sql
\ir 02-inventory/98_event_bookings_indexes.sql
\ir 02-inventory/99_banquet_event_orders_indexes.sql

-- ============================================================================
-- CATEGORY 3: BOOKINGS & GUEST RELATIONS INDEXES (16 files)
-- ============================================================================
\echo '>>> Creating indexes for: BOOKINGS & GUEST RELATIONS'

\ir 03-bookings/10_reservations_indexes.sql
\ir 03-bookings/11_reservation_status_history_indexes.sql
\ir 03-bookings/30_deposit_schedules_indexes.sql
\ir 03-bookings/31_allotments_indexes.sql
\ir 03-bookings/32_booking_sources_indexes.sql
\ir 03-bookings/33_market_segments_indexes.sql
\ir 03-bookings/34_guest_preferences_indexes.sql
\ir 03-bookings/41_guest_communications_indexes.sql
\ir 03-bookings/42_communication_templates_indexes.sql
\ir 03-bookings/43_guest_feedback_indexes.sql
\ir 03-bookings/47_guest_loyalty_programs_indexes.sql
\ir 03-bookings/48_guest_documents_indexes.sql
\ir 03-bookings/49_guest_notes_indexes.sql
\ir 03-bookings/50_automated_messages_indexes.sql
\ir 03-bookings/51_reservation_traces_indexes.sql
\ir 03-bookings/52_waitlist_entries_indexes.sql

-- ============================================================================
-- CATEGORY 4: FINANCIAL INDEXES (15 files)
-- ============================================================================
\echo '>>> Creating indexes for: FINANCIAL MANAGEMENT'

\ir 04-financial/12_payments_indexes.sql
\ir 04-financial/13_invoices_indexes.sql
\ir 04-financial/14_invoice_items_indexes.sql
\ir 04-financial/25_folios_indexes.sql
\ir 04-financial/26_charge_postings_indexes.sql
\ir 04-financial/35_refunds_indexes.sql
\ir 04-financial/63_tax_configurations_indexes.sql
\ir 04-financial/64_financial_closures_indexes.sql
\ir 04-financial/65_commission_tracking_indexes.sql
\ir 04-financial/66_cashier_sessions_indexes.sql
\ir 04-financial/67_accounts_receivable_indexes.sql
\ir 04-financial/68_credit_limits_indexes.sql
\ir 04-financial/69_payment_tokens_indexes.sql
\ir 04-financial/70_general_ledger_batches_indexes.sql
\ir 04-financial/71_general_ledger_entries_indexes.sql

-- ============================================================================
-- CATEGORY 5: OPERATIONS INDEXES (24 files)
-- ============================================================================
\echo '>>> Creating indexes for: OPERATIONS & SERVICES'

\ir 05-operations/15_services_indexes.sql
\ir 05-operations/16_reservation_services_indexes.sql
\ir 05-operations/17_housekeeping_tasks_indexes.sql
\ir 05-operations/37_maintenance_requests_indexes.sql
\ir 05-operations/57_staff_schedules_indexes.sql
\ir 05-operations/58_staff_tasks_indexes.sql
\ir 05-operations/59_shift_handovers_indexes.sql
\ir 05-operations/60_lost_and_found_indexes.sql
\ir 05-operations/61_incident_reports_indexes.sql
\ir 05-operations/62_vendor_contracts_indexes.sql
\ir 05-operations/82_mobile_keys_indexes.sql
\ir 05-operations/83_qr_codes_indexes.sql
\ir 05-operations/84_push_notifications_indexes.sql
\ir 05-operations/85_app_usage_analytics_indexes.sql
\ir 05-operations/99_smart_room_devices_indexes.sql
\ir 05-operations/100_mobile_check_ins_indexes.sql
\ir 05-operations/101_asset_inventory_indexes.sql
\ir 05-operations/102_minibar_items_indexes.sql
\ir 05-operations/103_minibar_consumption_indexes.sql
\ir 05-operations/104_vehicles_indexes.sql
\ir 05-operations/105_transportation_requests_indexes.sql
\ir 05-operations/106_shuttle_schedules_indexes.sql
\ir 05-operations/107_spa_treatments_indexes.sql
\ir 05-operations/108_spa_appointments_indexes.sql

-- ============================================================================
-- CATEGORY 6: INTEGRATIONS & CHANNELS INDEXES (23 files)
-- ============================================================================
\echo '>>> Creating indexes for: INTEGRATIONS & CHANNELS'

\ir 06-integrations/18_channel_mappings_indexes.sql
\ir 06-integrations/41_gds_connections_indexes.sql
\ir 06-integrations/42_gds_message_log_indexes.sql
\ir 06-integrations/43_gds_reservation_queue_indexes.sql
\ir 06-integrations/38_ota_configurations_indexes.sql
\ir 06-integrations/39_ota_rate_plans_indexes.sql
\ir 06-integrations/40_ota_reservations_queue_indexes.sql
\ir 06-integrations/44_ota_inventory_sync_indexes.sql
\ir 06-integrations/45_channel_rate_parity_indexes.sql
\ir 06-integrations/46_channel_commission_rules_indexes.sql
\ir 06-integrations/69_marketing_campaigns_indexes.sql
\ir 06-integrations/70_campaign_segments_indexes.sql
\ir 06-integrations/71_promotional_codes_indexes.sql
\ir 06-integrations/72_referral_tracking_indexes.sql
\ir 06-integrations/73_social_media_mentions_indexes.sql
\ir 06-integrations/86_integration_mappings_indexes.sql
\ir 06-integrations/87_api_logs_indexes.sql
\ir 06-integrations/88_webhook_subscriptions_indexes.sql
\ir 06-integrations/89_data_sync_status_indexes.sql
\ir 06-integrations/94_ai_demand_predictions_indexes.sql
\ir 06-integrations/95_dynamic_pricing_rules_ml_indexes.sql
\ir 06-integrations/96_guest_behavior_patterns_indexes.sql
\ir 06-integrations/97_sentiment_analysis_indexes.sql

-- ============================================================================
-- CATEGORY 7: ANALYTICS & COMPLIANCE INDEXES (18 files)
-- ============================================================================
\echo '>>> Creating indexes for: ANALYTICS & COMPLIANCE'

\ir 07-analytics/19_analytics_metrics_indexes.sql
\ir 07-analytics/20_analytics_metric_dimensions_indexes.sql
\ir 07-analytics/21_analytics_reports_indexes.sql
\ir 07-analytics/22_report_property_ids_indexes.sql
\ir 07-analytics/23_performance_reporting_indexes.sql
\ir 07-analytics/24_performance_alerting_indexes.sql
\ir 07-analytics/27_audit_logs_indexes.sql
\ir 07-analytics/28_business_dates_indexes.sql
\ir 07-analytics/29_night_audit_log_indexes.sql
\ir 07-analytics/74_gdpr_consent_logs_indexes.sql
\ir 07-analytics/75_police_reports_indexes.sql
\ir 07-analytics/76_contract_agreements_indexes.sql
\ir 07-analytics/77_insurance_claims_indexes.sql
\ir 07-analytics/78_guest_journey_tracking_indexes.sql
\ir 07-analytics/79_revenue_attribution_indexes.sql
\ir 07-analytics/80_forecasting_models_indexes.sql
\ir 07-analytics/81_ab_test_results_indexes.sql
\ir 07-analytics/98_sustainability_metrics_indexes.sql

\echo ''
\echo '========================================='
\echo 'All Indexes Created Successfully!'
\echo 'Total: 101 index files across 7 categories'
\echo '========================================='
