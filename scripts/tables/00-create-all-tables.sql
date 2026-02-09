-- ============================================================================
-- Tartware PMS - Master Table Creation Script
-- Consolidated Structure (9 categories including reference data)
-- ============================================================================

\echo '========================================='
\echo 'TARTWARE PMS - Creating All Tables'
\echo 'Consolidated Structure: 9 Categories'
\echo '========================================='
\echo ''

-- ============================================================================
-- CATEGORY 1: CORE (Foundation: tenants, users, properties, guests)
-- ============================================================================
\echo '>>> Category 1/8: CORE FOUNDATION'
\ir 01-core/01_tenants.sql
\ir 01-core/02_users.sql
\ir 01-core/03_user_tenant_associations.sql
\ir 01-core/04_properties.sql
\ir 01-core/05_guests.sql
\ir 01-core/06_setting_categories.sql
\ir 01-core/07_setting_definitions.sql
\ir 01-core/08_tenant_settings.sql
\ir 01-core/09_property_settings.sql
\ir 01-core/10_room_settings.sql
\ir 01-core/11_user_settings.sql
\ir 01-core/07_system_administrators.sql
\ir 01-core/08_system_admin_audit_log.sql
\ir 01-core/09_transactional_outbox.sql
\ir 01-core/10_command_center.sql
\ir 01-core/11_system_admin_break_glass_codes.sql
\ir 01-core/12_settings_seed.sql

-- ============================================================================
-- CATEGORY 2: INVENTORY (Rooms, rates, availability, revenue management)
-- ============================================================================
\echo '>>> Category 2/8: INVENTORY & PRICING'
\ir 02-inventory/06_room_types.sql
\ir 02-inventory/07_rooms.sql
\ir 02-inventory/10_room_amenity_catalog.sql
\ir 02-inventory/08_rates.sql
\ir 02-inventory/09_room_availability.sql
\ir 02-inventory/36_rate_overrides.sql
\ir 02-inventory/51_revenue_forecasts.sql
\ir 02-inventory/52_competitor_rates.sql
\ir 02-inventory/53_demand_calendar.sql
\ir 02-inventory/54_pricing_rules.sql
\ir 02-inventory/55_rate_recommendations.sql
\ir 02-inventory/56_revenue_goals.sql
\ir 02-inventory/90_companies.sql
\ir 02-inventory/91_group_bookings.sql
\ir 02-inventory/92_packages.sql
\ir 02-inventory/93_travel_agent_commissions.sql
\ir 02-inventory/97_meeting_rooms.sql
\ir 02-inventory/98_event_bookings.sql
\ir 02-inventory/99_banquet_event_orders.sql

-- ============================================================================
-- CATEGORY 3: BOOKINGS (Reservations, guest relations, booking sources)
-- ============================================================================
\echo '>>> Category 3/8: BOOKINGS & GUEST RELATIONS'
\ir 03-bookings/10_reservations.sql
\ir 03-bookings/11_reservation_status_history.sql
\ir 03-bookings/30_deposit_schedules.sql
\ir 03-bookings/31_allotments.sql
\ir 03-bookings/32_booking_sources.sql
\ir 03-bookings/33_market_segments.sql
\ir 03-bookings/34_guest_preferences.sql
\ir 03-bookings/41_guest_communications.sql
\ir 03-bookings/42_communication_templates.sql
\ir 03-bookings/43_guest_feedback.sql
\ir 03-bookings/47_guest_loyalty_programs.sql
\ir 03-bookings/48_guest_documents.sql
\ir 03-bookings/49_guest_notes.sql
\ir 03-bookings/50_automated_messages.sql
\ir 03-bookings/51_reservation_traces.sql
\ir 03-bookings/52_waitlist_entries.sql
\ir 03-bookings/53_reservation_event_offsets.sql
\ir 03-bookings/54_reservation_command_lifecycle.sql
\ir 03-bookings/55_reservation_rate_fallbacks.sql
-- Shadow observability (Roll Service parity + Availability Guard metadata)
\echo '    - Shadow roll ledgers, checkpoints, and guard audit tables'
\ir 03-bookings/90_roll_service_shadow_ledgers.sql
\ir 03-bookings/91_roll_service_backfill_checkpoint.sql
\ir 03-bookings/92_roll_service_consumer_offsets.sql
\ir 03-bookings/91_inventory_lock_audits.sql
\ir 03-bookings/92_reservation_guard_locks.sql
\ir 03-bookings/93_inventory_locks_shadow.sql

-- ============================================================================
-- CATEGORY 4: FINANCIAL (Payments, invoices, folios, accounting)
-- ============================================================================
\echo '>>> Category 4/8: FINANCIAL MANAGEMENT'
\ir 04-financial/12_payments.sql
\ir 04-financial/13_invoices.sql
\ir 04-financial/14_invoice_items.sql
\ir 04-financial/25_folios.sql
\ir 04-financial/26_charge_postings.sql
\ir 04-financial/35_refunds.sql
\ir 04-financial/63_tax_configurations.sql
\ir 04-financial/64_financial_closures.sql
\ir 04-financial/65_commission_tracking.sql
\ir 04-financial/66_cashier_sessions.sql
\ir 04-financial/67_accounts_receivable.sql
\ir 04-financial/68_credit_limits.sql
\ir 04-financial/69_payment_tokens.sql
\ir 04-financial/70_general_ledger_batches.sql
\ir 04-financial/71_general_ledger_entries.sql

-- ============================================================================
-- CATEGORY 5: OPERATIONS (Services, housekeeping, staff, mobile, assets)
-- ============================================================================
\echo '>>> Category 5/8: OPERATIONS & SERVICES'
\ir 05-operations/15_services.sql
\ir 05-operations/16_reservation_services.sql
\ir 05-operations/17_housekeeping_tasks.sql
\ir 05-operations/37_maintenance_requests.sql
\ir 05-operations/57_staff_schedules.sql
\ir 05-operations/58_staff_tasks.sql
\ir 05-operations/59_shift_handovers.sql
\ir 05-operations/60_lost_and_found.sql
\ir 05-operations/61_incident_reports.sql
\ir 05-operations/62_vendor_contracts.sql
\ir 05-operations/82_mobile_keys.sql
\ir 05-operations/83_qr_codes.sql
\ir 05-operations/84_push_notifications.sql
\ir 05-operations/85_app_usage_analytics.sql
\ir 05-operations/99_smart_room_devices.sql
\ir 05-operations/100_mobile_check_ins.sql
\ir 05-operations/109_digital_registration_cards.sql
\ir 05-operations/110_contactless_requests.sql
\ir 05-operations/101_asset_inventory.sql
\ir 05-operations/102_minibar_items.sql
\ir 05-operations/103_minibar_consumption.sql
\ir 05-operations/104_vehicles.sql
\ir 05-operations/105_transportation_requests.sql
\ir 05-operations/106_shuttle_schedules.sql
\ir 05-operations/107_spa_treatments.sql
\ir 05-operations/108_spa_appointments.sql

-- ============================================================================
-- CATEGORY 6: INTEGRATIONS (Channels, OTA, marketing, external systems)
-- ============================================================================
\echo '>>> Category 6/8: INTEGRATIONS & CHANNELS'
\ir 06-integrations/18_channel_mappings.sql
\ir 06-integrations/38_ota_configurations.sql
\ir 06-integrations/39_ota_rate_plans.sql
\ir 06-integrations/40_ota_reservations_queue.sql
\ir 06-integrations/41_gds_connections.sql
\ir 06-integrations/42_gds_message_log.sql
\ir 06-integrations/43_gds_reservation_queue.sql
\ir 06-integrations/44_ota_inventory_sync.sql
\ir 06-integrations/45_channel_rate_parity.sql
\ir 06-integrations/46_channel_commission_rules.sql
\ir 06-integrations/69_marketing_campaigns.sql
\ir 06-integrations/70_campaign_segments.sql
\ir 06-integrations/71_promotional_codes.sql
\ir 06-integrations/72_referral_tracking.sql
\ir 06-integrations/73_social_media_mentions.sql
\ir 06-integrations/86_integration_mappings.sql
\ir 06-integrations/87_api_logs.sql
\ir 06-integrations/88_webhook_subscriptions.sql
\ir 06-integrations/89_data_sync_status.sql
\ir 06-integrations/94_ai_demand_predictions.sql
\ir 06-integrations/95_dynamic_pricing_rules_ml.sql
\ir 06-integrations/98_price_adjustments_history.sql
\ir 06-integrations/99_pricing_experiments.sql
\ir 06-integrations/96_guest_behavior_patterns.sql
\ir 06-integrations/97_sentiment_analysis.sql

-- ============================================================================
-- CATEGORY 7: ANALYTICS (Reporting, compliance, audit, sustainability)
-- ============================================================================
\echo '>>> Category 7/8: ANALYTICS & COMPLIANCE'
\ir 07-analytics/19_analytics_metrics.sql
\ir 07-analytics/20_analytics_metric_dimensions.sql
\ir 07-analytics/21_analytics_reports.sql
\ir 07-analytics/22_report_property_ids.sql
\ir 07-analytics/23_performance_reports.sql
\ir 07-analytics/24_report_schedules.sql
\ir 07-analytics/25_performance_thresholds.sql
\ir 07-analytics/26_performance_baselines.sql
\ir 07-analytics/30_performance_alerts.sql
\ir 07-analytics/31_alert_rules.sql
\ir 07-analytics/27_audit_logs.sql
\ir 07-analytics/28_business_dates.sql
\ir 07-analytics/29_night_audit_log.sql
\ir 07-analytics/74_gdpr_consent_logs.sql
\ir 07-analytics/75_police_reports.sql
\ir 07-analytics/76_contract_agreements.sql
\ir 07-analytics/77_insurance_claims.sql
\ir 07-analytics/78_guest_journey_tracking.sql
\ir 07-analytics/79_revenue_attribution.sql
\ir 07-analytics/80_forecasting_models.sql
\ir 07-analytics/81_ab_test_results.sql
\ir 07-analytics/98_sustainability_metrics.sql

-- =========================================================================
-- CATEGORY 8: SETTINGS (Catalog definitions + values)
-- =========================================================================
\echo '>>> Category 8/9: SETTINGS CATALOG'
\ir 08-settings/10_settings_categories.sql
\ir 08-settings/11_settings_sections.sql
\ir 08-settings/12_settings_definitions.sql
\ir 08-settings/13_settings_options.sql
\ir 08-settings/14_settings_values.sql

-- =========================================================================
-- CATEGORY 9: REFERENCE DATA (Dynamic enum lookup tables)
-- =========================================================================
\echo '>>> Category 9/9: REFERENCE DATA (Dynamic Enums)'
\ir 09-reference-data/01_room_status_codes.sql
\ir 09-reference-data/02_room_categories.sql
\ir 09-reference-data/03_rate_types.sql
\ir 09-reference-data/04_payment_methods.sql
\ir 09-reference-data/05_group_booking_types.sql
\ir 09-reference-data/06_company_types.sql
\ir 09-reference-data/07_charge_codes.sql

\echo '>>> Enforcing tenant_id and soft delete coverage'
\ir 99_enforce_tenant_soft_delete.sql

\echo ''
\echo '========================================='
\echo 'All Tables Created Successfully!'
\echo '========================================='
