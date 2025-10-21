"""Insert function for rate_overrides table"""


from data_store import data_store
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random


def insert_rate_overrides(conn):
    """Insert rate override records"""
    print(f"\n✓ Inserting Rate Overrides...")
    cur = conn.cursor()

    # Valid reason_category values from schema constraint
    reason_categories = ['VIP', 'MANAGER_DISCRETION', 'SERVICE_RECOVERY', 'LOYALTY_REWARD', 'REPEAT_GUEST', 'NEGOTIATED']
    override_types = ['DISCOUNT', 'PREMIUM', 'FIXED_RATE', 'NEGOTIATED']

    count = 0
    # Create overrides for 10% of reservations (50 overrides)
    for reservation in random.sample(data_store['reservations'], min(50, len(data_store['reservations']))):
        property = next((p for p in data_store['properties'] if p['id'] == reservation['property_id']), None)
        if not property:
            continue

        original_rate = round(random.uniform(100, 400), 2)
        override_rate = round(original_rate * random.uniform(0.6, 0.9), 2)

        property_room_types = [rt['id'] for rt in data_store['room_types'] if rt['property_id'] == property['id']]
        if not property_room_types:
            continue

        reason_cat = random.choice(reason_categories)

        cur.execute("""
            INSERT INTO rate_overrides (
                override_id, tenant_id, property_id,
                reservation_id, room_type_id,
                override_type, original_rate, override_rate,
                adjustment_amount, adjustment_percentage,
                reason_category, reason_description,
                start_date, end_date,
                requested_at, requested_by,
                created_at, created_by,
                approved_by, approved_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            generate_uuid(),
            property['tenant_id'],
            property['id'],
            reservation['id'],
            random.choice(property_room_types),
            random.choice(override_types),  # override_type
            original_rate,
            override_rate,
            override_rate - original_rate,  # adjustment_amount (negative for discount)
            round(((override_rate - original_rate) / original_rate) * 100, 2),  # adjustment_percentage
            reason_cat,  # reason_category (valid value)
            f"Override for {reason_cat.replace('_', ' ').lower()}",  # reason_description
            fake.date_between(start_date="-60d", end_date="now"),
            fake.date_between(start_date="now", end_date="+60d"),
            fake.date_time_between(start_date="-60d", end_date="now"),
            random.choice(data_store['users'])['id'],
            fake.date_time_between(start_date="-60d", end_date="now"),
            random.choice(data_store['users'])['id'],
            random.choice(data_store['users'])['id'],
            fake.date_time_between(start_date="-60d", end_date="now")
        ))
        count += 1

    conn.commit()
    print(f"   → Inserted {count} rate overrides")
