"""Insert function for ota_rate_plans table"""
from data_store import data_store
from db_config import generate_uuid
import random


def insert_ota_rate_plans(conn):
    """Insert OTA rate plan records - maps OTA channels to existing rates"""
    print(f"\n✓ Inserting OTA Rate Plans...")
    cur = conn.cursor()

    mapping_types = ['STANDARD', 'PROMOTIONAL', 'EXCLUSIVE']

    count = 0
    # Create rate plans for each OTA configuration and rate
    for ota_config in data_store['ota_configurations']:
        # Get rates for this property
        property_rates = [r for r in data_store['rates'] if r['property_id'] == ota_config['property_id']]

        for idx, rate in enumerate(property_rates):
            # Create 1-2 mappings per rate
            for mapping_type in random.sample(mapping_types, random.randint(1, 2)):
                markup = random.choice([0, 5, 10, 15, 20])
                plan_id = f"{ota_config['channel_code']}_RATE{idx+1}_{mapping_type[:3]}"
                plan_name = f"{ota_config['channel_code']} Rate Plan #{idx+1} ({mapping_type})"

                cur.execute("""
                    INSERT INTO ota_rate_plans (id, tenant_id, property_id, ota_configuration_id,
                                               rate_id, ota_rate_plan_id, ota_rate_plan_name,
                                               mapping_type, is_active, markup_percentage,
                                               include_breakfast, include_taxes,
                                               min_length_of_stay, created_by)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    generate_uuid(),
                    ota_config['tenant_id'],
                    ota_config['property_id'],
                    ota_config['id'],
                    rate['id'],
                    plan_id,
                    plan_name,
                    mapping_type,
                    True,
                    markup,
                    random.choice([True, False]),
                    random.choice([True, False]),
                    random.choice([1, 2, 3]),
                    random.choice([u['id'] for u in data_store['users']])
                ))
                count += 1

    conn.commit()
    print(f"   → Inserted {count} OTA rate plans")
