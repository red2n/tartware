"""Insert function for allotments table"""


from data_store import data_store
from datetime import datetime, timedelta
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random


def insert_allotments(conn):
    """Insert allotment (room blocks) records"""
    print(f"\n✓ Inserting Allotments...")
    cur = conn.cursor()

    allotment_types = ['GROUP', 'CORPORATE', 'EVENT', 'TOUR']
    statuses = ['DEFINITE', 'DEFINITE', 'TENTATIVE', 'ACTIVE']

    count = 0
    # Create 2-3 allotments per property
    for property in data_store['properties']:
        property_room_types = [rt for rt in data_store['room_types'] if rt['property_id'] == property['id']]
        if not property_room_types:
            continue

        for i in range(random.randint(2, 3)):
            start_date = fake.date_between(start_date="-30d", end_date="+60d")
            end_date = start_date + timedelta(days=random.randint(1, 7))
            room_type = random.choice(property_room_types)

            total_rooms_blocked = random.randint(5, 20)
            rooms_picked_up = random.randint(0, total_rooms_blocked)

            cur.execute("""
                INSERT INTO allotments (
                    allotment_id, tenant_id, property_id,
                    allotment_code, allotment_name, allotment_type,
                    room_type_id, start_date, end_date,
                    total_rooms_blocked, rooms_picked_up, rooms_available,
                    contracted_rate, currency_code,
                    allotment_status, cutoff_date,
                    created_at, created_by
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                f"ALOT{count + 1:05d}",
                f"{fake.company()} Block",
                random.choice(allotment_types),
                room_type['id'],
                start_date,
                end_date,
                total_rooms_blocked,
                rooms_picked_up,
                total_rooms_blocked - rooms_picked_up,
                round(random.uniform(80, 200), 2),
                'USD',
                random.choice(statuses),
                start_date - timedelta(days=7),
                fake.date_time_between(start_date="-90d", end_date="now"),
                random.choice(data_store['users'])['id']
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} allotments")
