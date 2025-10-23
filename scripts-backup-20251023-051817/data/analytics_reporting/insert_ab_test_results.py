"""Insert function for ab_test_results table"""


from data_store import data_store
from datetime import datetime, timedelta
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import json
import random


def insert_ab_test_results(conn):
    """Insert A/B test result records"""
    print(f"\n✓ Inserting A/B Test Results...")
    cur = conn.cursor()

    test_categories = ['pricing', 'ui_design', 'marketing_message', 'booking_flow', 'email_subject']
    count = 0

    for property in data_store['properties']:
        for i in range(random.randint(3, 8)):
            test_start = fake.date_between(start_date="-6m", end_date="-1m")
            test_end = test_start + timedelta(days=random.randint(7, 30))

            variant_a_size = random.randint(500, 2000)
            variant_b_size = random.randint(500, 2000)
            variant_a_conv = random.randint(50, 500)
            variant_b_conv = random.randint(50, 500)

            cur.execute("""
                INSERT INTO ab_test_results (
                    result_id, tenant_id, property_id,
                    test_name, test_category, test_status,
                    variant_a_config, variant_b_config,
                    start_date, end_date,
                    variant_a_sample_size, variant_b_sample_size,
                    variant_a_conversions, variant_b_conversions,
                    variant_a_conversion_rate, variant_b_conversion_rate,
                    statistical_significance
                ) VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                f"Test: {fake.bs().title()}",
                random.choice(test_categories),
                random.choice(['draft', 'running', 'completed', 'cancelled']),
                json.dumps({'name': 'Control', 'description': 'Original version'}),
                json.dumps({'name': 'Variant', 'description': 'New version'}),
                test_start,
                test_end,
                variant_a_size,
                variant_b_size,
                variant_a_conv,
                variant_b_conv,
                round((variant_a_conv / variant_a_size) * 100, 2),
                round((variant_b_conv / variant_b_size) * 100, 2),
                random.choice([True, False])
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} A/B test results")
