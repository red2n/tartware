#!/usr/bin/env python3
"""
Script to split load_sample_data_direct.py into modular files
Extracts each insert_ function into its own file organized by category
"""
import os
import re

# Define the category mapping
CATEGORIES = {
    'core_business': [
        'insert_tenants', 'insert_users', 'insert_user_tenant_associations',
        'insert_properties', 'insert_guests', 'insert_room_types', 'insert_rooms',
        'insert_rates', 'insert_reservations', 'insert_payments', 'insert_invoices',
        'insert_invoice_items', 'insert_services', 'insert_reservation_services',
        'insert_housekeeping_tasks'
    ],
    'financial': [
        'insert_folios', 'insert_charge_postings', 'insert_refunds', 'insert_rate_overrides',
        'insert_deposit_schedules', 'insert_cashier_sessions', 'insert_credit_limits',
        'insert_accounts_receivable', 'insert_financial_closures', 'insert_tax_configurations',
        'insert_night_audit_log', 'insert_business_dates'
    ],
    'channel_management': [
        'insert_booking_sources', 'insert_ota_configurations', 'insert_ota_rate_plans',
        'insert_ota_reservations_queue', 'insert_ota_inventory_sync', 'insert_channel_mappings',
        'insert_channel_rate_parity', 'insert_channel_commission_rules'
    ],
    'guest_management': [
        'insert_guest_communications', 'insert_guest_feedback', 'insert_guest_preferences',
        'insert_guest_loyalty_programs', 'insert_guest_documents', 'insert_guest_notes',
        'insert_guest_journey_tracking', 'insert_communication_templates',
        'insert_automated_messages', 'insert_gdpr_consent_logs'
    ],
    'revenue_pricing': [
        'insert_allotments', 'insert_revenue_forecasts', 'insert_competitor_rates',
        'insert_demand_calendar', 'insert_pricing_rules', 'insert_promotional_codes',
        'insert_rate_recommendations', 'insert_forecasting_models', 'insert_revenue_attribution',
        'insert_revenue_goals'
    ],
    'analytics_reporting': [
        'insert_analytics_metrics', 'insert_analytics_reports', 'insert_app_usage_analytics',
        'insert_market_segments', 'insert_performance_alerts', 'insert_performance_baselines',
        'insert_performance_thresholds', 'insert_performance_reports', 'insert_alert_rules',
        'insert_report_schedules', 'insert_ab_test_results', 'insert_audit_logs'
    ],
    'staff_operations': [
        'insert_staff_schedules', 'insert_staff_tasks', 'insert_shift_handovers',
        'insert_maintenance_requests', 'insert_incident_reports'
    ],
    'marketing_sales': [
        'insert_marketing_campaigns', 'insert_campaign_segments', 'insert_referral_tracking',
        'insert_social_media_mentions', 'insert_commission_tracking'
    ],
    'mobile_digital': [
        'insert_mobile_keys', 'insert_qr_codes', 'insert_push_notifications'
    ],
    'compliance_legal': [
        'insert_police_reports', 'insert_contract_agreements', 'insert_insurance_claims',
        'insert_lost_and_found'
    ],
    'integrations': [
        'insert_webhook_subscriptions', 'insert_integration_mappings', 'insert_data_sync_status',
        'insert_api_logs', 'insert_vendor_contracts', 'insert_reservation_status_history'
    ]
}

def read_original_file():
    """Read the original monolithic file"""
    with open('/home/navin/tartware/scripts/data/load_sample_data_direct.py', 'r') as f:
        return f.read()

def extract_function(content, function_name):
    """Extract a single function from the content"""
    # Find function definition
    pattern = rf'^def {function_name}\(.*?\):\s*\n(.*?)(?=^def\s|\Z)'
    match = re.search(pattern, content, re.MULTILINE | re.DOTALL)

    if match:
        # Get the full function including the def line
        start = match.start()
        end = match.end()
        function_text = content[start:end].rstrip() + '\n'
        return function_text
    return None

def analyze_imports(function_text):
    """Analyze what imports a function needs"""
    imports = set()

    if 'json.' in function_text or 'json.dumps' in function_text:
        imports.add('import json')
    if 'random.' in function_text:
        imports.add('import random')
    if 'fake.' in function_text or 'Faker' in function_text:
        imports.add('from faker import Faker')
        imports.add('\nfake = Faker()')
    if 'datetime' in function_text or 'timedelta' in function_text:
        imports.add('from datetime import datetime, timedelta')
    if 'generate_uuid' in function_text:
        imports.add('from db_config import generate_uuid')
    if 'data_store' in function_text:
        imports.add('from data_store import data_store')
    if 'time.' in function_text or 'time.time' in function_text:
        imports.add('import time')

    return sorted(imports)

def create_function_file(category, function_name, function_text):
    """Create a file for a single function"""
    # Analyze required imports
    imports = analyze_imports(function_text)

    # Create file content
    content = f'"""Insert function for {function_name.replace("insert_", "")} table"""\n'
    content += '\n'.join(imports)
    content += '\n\n\n'
    content += function_text

    # Write to file
    file_path = f'/home/navin/tartware/scripts/data/{category}/{function_name}.py'
    with open(file_path, 'w') as f:
        f.write(content)

    print(f"✓ Created {category}/{function_name}.py")

def create_init_files():
    """Create __init__.py files for each category"""
    for category, functions in CATEGORIES.items():
        init_content = f'"""{category.replace("_", " ").title()} Data Loaders"""\n\n'

        # Import all functions
        for func in functions:
            init_content += f'from .{func} import {func}\n'

        # Create __all__ list
        init_content += '\n\n__all__ = [\n'
        for func in functions:
            init_content += f'    "{func}",\n'
        init_content += ']\n'

        file_path = f'/home/navin/tartware/scripts/data/{category}/__init__.py'
        with open(file_path, 'w') as f:
            f.write(init_content)

        print(f"✓ Created {category}/__init__.py")

def main():
    print("=" * 60)
    print("Splitting load_sample_data_direct.py into modular files")
    print("=" * 60)

    # Read original file
    print("\n✓ Reading original file...")
    content = read_original_file()

    # Extract and create files for each function
    print("\n✓ Extracting functions...")
    total_functions = 0

    for category, functions in CATEGORIES.items():
        print(f"\n  [{category}]")
        for function_name in functions:
            function_text = extract_function(content, function_name)
            if function_text:
                create_function_file(category, function_name, function_text)
                total_functions += 1
            else:
                print(f"  ⚠️  Could not find {function_name}")

    # Create __init__.py files
    print("\n✓ Creating __init__.py files...")
    create_init_files()

    print("\n" + "=" * 60)
    print(f"✅ Successfully extracted {total_functions} functions!")
    print("=" * 60)

if __name__ == '__main__':
    main()
