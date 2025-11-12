"""
@package tartware.scripts.data.core_business.insert_rates
@summary Seed pricing strategies for each room type across all properties.
"""


from data_store import data_store
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random


def insert_rates(conn, count_per_property=6):
    """
    @summary Insert rate plans that capture seasonal strategies and validity windows.
    @param conn: psycopg2 connection used for rate inserts.
    @param count_per_property: Target number of rate variations per property.
    @returns None
    """
    print(f"\n✓ Inserting Rates...")
    cur = conn.cursor()

    strategies = ['FIXED', 'DYNAMIC', 'SEASONAL', 'WEEKEND', 'LASTMINUTE', 'EARLYBIRD']
    statuses = ['ACTIVE', 'ACTIVE', 'ACTIVE', 'INACTIVE']
    count = 0

    for property in data_store['properties']:
        property_room_types = [rt for rt in data_store['room_types'] if rt['property_id'] == property['id']]

        for room_type in property_room_types:
            for i in range(2):
                rate_id = generate_uuid()
                strategy = strategies[i % len(strategies)]

                cur.execute("""
                    INSERT INTO rates (id, tenant_id, property_id, room_type_id, rate_name, rate_code, base_rate, strategy, status, valid_from, valid_until, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    rate_id,
                    property['tenant_id'],
                    property['id'],
                    room_type['id'],
                    f"{strategy} Rate - {room_type['name']}",
                    f"RATE{count + 1:03d}",
                    round(random.uniform(80, 600), 2),
                    strategy,
                    random.choice(statuses),
                    fake.date_between(start_date="-1y", end_date="today"),
                    fake.date_between(start_date="today", end_date="+1y"),
                    fake.date_time_between(start_date="-1y", end_date="now")
                ))

                data_store['rates'].append({
                    'id': rate_id,
                    'property_id': property['id'],
                    'tenant_id': property['tenant_id'],
                    'room_type_id': room_type['id']
                })
                count += 1

    conn.commit()
    print(f"   → Inserted {count} rates")
