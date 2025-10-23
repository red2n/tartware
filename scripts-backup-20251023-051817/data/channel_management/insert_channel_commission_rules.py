"""Insert function for channel_commission_rules table"""


from data_store import data_store
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random


def insert_channel_commission_rules(conn):
    """Insert channel commission rules"""
    print(f"\n✓ Inserting Channel Commission Rules...")
    cur = conn.cursor()

    rule_types = ['standard', 'tiered', 'promotional', 'performance_based']
    commission_models = ['percentage', 'flat_fee', 'per_room_night', 'hybrid']

    count = 0
    # Create commission rules for each OTA configuration
    for ota_config in data_store.get('ota_configurations', []):
        cur.execute("""
            INSERT INTO channel_commission_rules (
                rule_id, tenant_id, property_id,
                channel_name, ota_config_id, rule_name,
                rule_type, commission_model, base_commission_percent,
                is_active, effective_from,
                created_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            generate_uuid(),
            ota_config['tenant_id'],
            ota_config['property_id'],
            ota_config.get('channel_name', 'BOOKING.COM'),
            ota_config['id'],
            f"{ota_config.get('channel_name', 'OTA')} Standard Commission",
            random.choice(rule_types),
            random.choice(commission_models),
            round(random.uniform(12, 20), 2),
            True,
            fake.date_between(start_date="-1y", end_date="-30d"),
            fake.date_time_between(start_date="-1y", end_date="-30d")
        ))
        count += 1

    conn.commit()
    print(f"   → Inserted {count} commission rules")
