#!/usr/bin/env python3
"""
Entry point that orchestrates every category-specific sample data loader.

Validates the UUID generator, wipes the target database for a clean slate, then
executes modular loader functions grouped by business domains with console telemetry.
"""
import random
from datetime import datetime
from faker import Faker

# Import shared utilities
from db_config import get_db_connection, validate_uuid_v7
from data_store import data_store

# Import all category loaders
from core_business import (
    insert_tenants, insert_users, insert_user_tenant_associations,
    insert_properties, insert_guests, insert_room_types, insert_rooms,
    insert_rates, insert_reservations, insert_payments, insert_invoices,
    insert_invoice_items, insert_services, insert_reservation_services,
    insert_housekeeping_tasks
)

from financial import (
    insert_folios, insert_charge_postings, insert_refunds, insert_rate_overrides,
    insert_deposit_schedules, insert_cashier_sessions, insert_credit_limits,
    insert_accounts_receivable, insert_financial_closures, insert_tax_configurations,
    insert_night_audit_log, insert_business_dates,
    insert_commission_rules, insert_commission_statements, insert_travel_agent_commissions
)

from channel_management import (
    insert_booking_sources, insert_ota_configurations, insert_ota_rate_plans,
    insert_ota_reservations_queue, insert_ota_inventory_sync, insert_channel_mappings,
    insert_channel_rate_parity, insert_channel_commission_rules
)

from guest_management import (
    insert_guest_communications, insert_guest_feedback, insert_guest_preferences,
    insert_guest_loyalty_programs, insert_guest_documents, insert_guest_notes,
    insert_guest_journey_tracking, insert_communication_templates,
    insert_automated_messages, insert_gdpr_consent_logs
)

from revenue_pricing import (
    insert_allotments, insert_revenue_forecasts, insert_competitor_rates,
    insert_demand_calendar, insert_pricing_rules, insert_promotional_codes,
    insert_rate_recommendations, insert_forecasting_models, insert_revenue_attribution,
    insert_revenue_goals, insert_companies, insert_group_bookings, insert_group_room_blocks,
    insert_packages, insert_package_bookings, insert_package_components
)

from analytics_reporting import (
    insert_analytics_metrics, insert_analytics_reports, insert_app_usage_analytics,
    insert_market_segments, insert_performance_alerts, insert_performance_baselines,
    insert_performance_thresholds, insert_performance_reports, insert_alert_rules,
    insert_report_schedules, insert_ab_test_results, insert_audit_logs
)

from staff_operations import (
    insert_staff_schedules, insert_staff_tasks, insert_shift_handovers,
    insert_maintenance_requests, insert_incident_reports, insert_vehicles,
    insert_shuttle_schedules, insert_transportation_requests
)

from marketing_sales import (
    insert_marketing_campaigns, insert_campaign_segments, insert_referral_tracking,
    insert_social_media_mentions, insert_commission_tracking
)

from mobile_digital import (
    insert_mobile_keys, insert_qr_codes, insert_push_notifications,
    insert_mobile_check_ins, insert_digital_registration_cards,
    insert_contactless_requests
)

from compliance_legal import (
    insert_police_reports, insert_contract_agreements, insert_insurance_claims,
    insert_lost_and_found
)

from integrations import (
    insert_webhook_subscriptions, insert_integration_mappings, insert_data_sync_status,
    insert_api_logs, insert_vendor_contracts, insert_reservation_status_history
)

from smart_rooms import (
    insert_smart_room_devices, insert_room_energy_usage,
    insert_guest_room_preferences, insert_device_events_log
)

# Initialize Faker
fake = Faker()
Faker.seed(42)
random.seed(42)


def main():
    """Execute the full synthetic data generation workflow for Tartware PMS."""
    print("=" * 60)
    print("Tartware PMS - Modular Sample Data Loader")
    print("UUID Strategy: v7 (Time-Ordered) for Better Performance")
    print("=" * 60)
    print(f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Target: 25,000+ records across 90 tables")
    print("=" * 60)

    # Validate UUID v7 implementation
    if not validate_uuid_v7():
        print("\n❌ UUID v7 validation failed!")
        exit(1)

    # Connect to database
    print("\n✓ Connecting to database...")
    conn = get_db_connection()
    print("   → Connected successfully!")

    # Check for existing data
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM reservations;")
    existing_count = cur.fetchone()[0]

    if existing_count > 0:
        print(f"\n⚠️  Found {existing_count} existing reservations - cleaning data...")
    else:
        print("\n✓ Database is empty - starting fresh install")

    print("\n✓ Clearing all data...")
    # Use CASCADE to handle foreign keys automatically
    try:
        cur.execute("""
            DO $$
            DECLARE
                r RECORD;
            BEGIN
                FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
                    EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
                END LOOP;
            END $$;
        """)
        conn.commit()
        print("   → All tables cleared")
    except Exception as e:
        print(f"   ⚠️  Error clearing data: {e}")
        conn.rollback()

    # Disable triggers for performance
    cur.execute("SET session_replication_role = replica;")
    conn.commit()
    print("\n✓ Disabled triggers for bulk insert performance")

    try:
        print("\n" + "=" * 60)
        print("CORE BUSINESS DATA (Foundation)")
        print("=" * 60)
        insert_tenants(conn, count=5)
        insert_users(conn, count=25)
        insert_user_tenant_associations(conn)
        insert_properties(conn, count_per_tenant=3)
        insert_guests(conn, count=200)
        insert_room_types(conn, count_per_property=3)
        insert_rooms(conn, count_per_property=20)
        insert_rates(conn, count_per_property=6)
        insert_reservations(conn, count=500)  # Main data volume
        insert_payments(conn)
        insert_invoices(conn)
        insert_invoice_items(conn)
        insert_services(conn)
        insert_reservation_services(conn)
        insert_housekeeping_tasks(conn)

        print("\n" + "=" * 60)
        print("FINANCIAL OPERATIONS")
        print("=" * 60)
        insert_folios(conn)
        insert_charge_postings(conn)
        insert_night_audit_log(conn)
        insert_business_dates(conn)
        insert_refunds(conn)
        insert_rate_overrides(conn)
        insert_deposit_schedules(conn)
        insert_cashier_sessions(conn)
        insert_tax_configurations(conn)
        insert_credit_limits(conn)
        insert_accounts_receivable(conn)
        insert_financial_closures(conn)

        print("\n" + "=" * 60)
        print("CHANNEL MANAGEMENT & OTA")
        print("=" * 60)
        insert_booking_sources(conn)
        insert_ota_configurations(conn)
        insert_ota_rate_plans(conn)
        insert_ota_reservations_queue(conn)
        insert_ota_inventory_sync(conn)
        insert_channel_mappings(conn)
        insert_channel_rate_parity(conn)
        insert_channel_commission_rules(conn)

        print("\n" + "=" * 60)
        print("GUEST MANAGEMENT")
        print("=" * 60)
        insert_communication_templates(conn)
        insert_guest_communications(conn)
        insert_guest_feedback(conn)
        insert_guest_preferences(conn)
        insert_guest_loyalty_programs(conn)
        insert_guest_documents(conn)
        insert_guest_notes(conn)
        insert_automated_messages(conn)
        insert_guest_journey_tracking(conn)

        print("\n" + "=" * 60)
        print("REVENUE MANAGEMENT & PRICING")
        print("=" * 60)
        insert_companies(conn, count=50)  # NEW: Corporate clients & partners
        insert_commission_rules(conn)  # Needs companies
        insert_commission_statements(conn)  # Needs companies
        insert_travel_agent_commissions(conn)  # Needs companies & reservations
        insert_allotments(conn)
        insert_packages(conn, count=40)  # NEW: Room & service packages
        insert_package_bookings(conn, count=60)  # NEW: Package sales
        insert_package_components(conn)  # NEW: Package items
        insert_group_bookings(conn, count=30)  # NEW: Group reservations
        insert_group_room_blocks(conn)  # NEW: Room blocks for groups
        insert_revenue_forecasts(conn)
        insert_competitor_rates(conn)
        insert_demand_calendar(conn)
        insert_pricing_rules(conn)
        insert_promotional_codes(conn)
        insert_rate_recommendations(conn)
        insert_forecasting_models(conn)
        insert_revenue_attribution(conn)
        insert_revenue_goals(conn)

        print("\n" + "=" * 60)
        print("ANALYTICS & REPORTING")
        print("=" * 60)
        insert_market_segments(conn)
        insert_analytics_metrics(conn)
        insert_analytics_reports(conn)
        insert_app_usage_analytics(conn)
        insert_performance_alerts(conn)
        insert_performance_baselines(conn)
        insert_performance_thresholds(conn)
        insert_performance_reports(conn)
        insert_alert_rules(conn)
        insert_report_schedules(conn)
        insert_ab_test_results(conn)
        insert_audit_logs(conn)

        print("\n" + "=" * 60)
        print("STAFF & OPERATIONS")
        print("=" * 60)
        insert_staff_schedules(conn)  # NEW: Staff scheduling
        insert_staff_tasks(conn)
        insert_shift_handovers(conn)
        insert_maintenance_requests(conn)
        insert_incident_reports(conn)
        insert_vehicles(conn)
        insert_shuttle_schedules(conn)
        insert_transportation_requests(conn)
        insert_reservation_status_history(conn)

        print("\n" + "=" * 60)
        print("SMART ROOMS & IoT")
        print("=" * 60)
        insert_smart_room_devices(conn)
        insert_room_energy_usage(conn)
        insert_guest_room_preferences(conn)
        insert_device_events_log(conn)

        print("\n" + "=" * 60)
        print("MARKETING & SALES")
        print("=" * 60)
        insert_marketing_campaigns(conn)
        insert_campaign_segments(conn)
        insert_referral_tracking(conn)
        insert_social_media_mentions(conn)
        insert_commission_tracking(conn)

        print("\n" + "=" * 60)
        print("MOBILE & DIGITAL")
        print("=" * 60)
        insert_mobile_keys(conn)
        insert_qr_codes(conn)
        insert_push_notifications(conn)
        insert_mobile_check_ins(conn)
        insert_digital_registration_cards(conn)
        insert_contactless_requests(conn)

        print("\n" + "=" * 60)
        print("COMPLIANCE & LEGAL")
        print("=" * 60)
        insert_police_reports(conn)
        insert_contract_agreements(conn)
        insert_insurance_claims(conn)
        insert_lost_and_found(conn)

        print("\n" + "=" * 60)
        print("INTEGRATIONS & TECHNICAL")
        print("=" * 60)
        insert_webhook_subscriptions(conn)
        insert_integration_mappings(conn)
        insert_data_sync_status(conn)
        insert_api_logs(conn)
        insert_vendor_contracts(conn)

        # Re-enable triggers
        cur.execute("SET session_replication_role = DEFAULT;")
        conn.commit()
        print("\n✓ Re-enabled triggers")

        # Final statistics
        print("\n" + "=" * 60)
        print("DATA LOADING COMPLETE!")
        print("=" * 60)

        cur.execute("""
            SELECT
                schemaname,
                COUNT(*) as table_count,
                SUM(n_tup_ins) as total_records
            FROM pg_stat_user_tables
            WHERE schemaname IN ('public', 'availability')
            GROUP BY schemaname
            ORDER BY schemaname;
        """)

        for schema, table_count, total_records in cur.fetchall():
            print(f"Schema: {schema}")
            print(f"  Tables: {table_count}")
            print(f"  Records: {total_records:,}")

        print("\n✅ Sample data loaded successfully!")
        print("=" * 60)

    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        conn.rollback()
        exit(1)
    finally:
        # Re-enable triggers even if there was an error
        try:
            cur.execute("SET session_replication_role = DEFAULT;")
            conn.commit()
        except:
            pass
        conn.close()


if __name__ == "__main__":
    main()
