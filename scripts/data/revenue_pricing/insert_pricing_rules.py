"""Insert function for pricing_rules table"""


from data_store import data_store
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import json
import random


def insert_pricing_rules(conn):
    """Insert pricing rule records"""
    print(f"\n✓ Inserting Pricing Rules...")
    cur = conn.cursor()

    rule_types = ['occupancy_based', 'demand_based', 'day_of_week', 'seasonal',
                  'length_of_stay', 'advance_purchase', 'last_minute']
    adjustment_types = ['percentage_increase', 'percentage_decrease',
                        'fixed_amount_increase', 'fixed_amount_decrease']

    count = 0
    # Create 3-5 pricing rules per property
    for property in data_store['properties']:
        property_room_types = [rt for rt in data_store['room_types'] if rt['property_id'] == property['id']]

        for i in range(random.randint(3, 5)):
            rule_type = random.choice(rule_types)
            adj_type = random.choice(adjustment_types)

            # Adjustment value depends on type
            if 'percentage' in adj_type:
                adj_value = round(random.uniform(5, 25), 2)  # 5-25%
            else:
                adj_value = round(random.uniform(10, 50), 2)  # $10-50

            cur.execute("""
                INSERT INTO pricing_rules (
                    rule_id, tenant_id, property_id,
                    rule_name, rule_type, is_active,
                    effective_from, effective_until,
                    conditions, adjustment_type, adjustment_value
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                f"{rule_type.replace('_', ' ').title()} Rule #{i+1}",
                rule_type,
                True,
                fake.date_between(start_date="-30d", end_date="now"),
                fake.date_between(start_date="+30d", end_date="+365d"),
                json.dumps({"created": "sample_data"}),
                adj_type,
                adj_value
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} pricing rules")
