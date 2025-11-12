"""
@package tartware.scripts.data.core_business.insert_rooms
@summary Instantiate physical rooms tied to room types for each property.
"""


from data_store import data_store
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random


def insert_rooms(conn, count_per_property=20):
    """
    @summary Insert room inventory with room numbers, floors, and status flags.
    @param conn: psycopg2 connection for issuing insert statements.
    @param count_per_property: Number of rooms to provision per property.
    @returns None
    """
    print(f"\n✓ Inserting Rooms ({count_per_property} per property)...")
    cur = conn.cursor()

    statuses = ['AVAILABLE', 'CLEAN', 'DIRTY', 'INSPECTED']
    count = 0

    for property in data_store['properties']:
        property_room_types = [rt for rt in data_store['room_types'] if rt['property_id'] == property['id']]

        for i in range(count_per_property):
            room_id = generate_uuid()
            room_type = random.choice(property_room_types)
            floor = random.randint(1, 10)
            room_number = f"{floor}{i+1:02d}"

            cur.execute("""
                INSERT INTO rooms (id, tenant_id, property_id, room_type_id, room_number, floor, status, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                room_id,
                property['tenant_id'],
                property['id'],
                room_type['id'],
                room_number,
                floor,
                random.choice(statuses),
                fake.date_time_between(start_date="-2y", end_date="now")
            ))

            data_store['rooms'].append({
                'id': room_id,
                'property_id': property['id'],
                'tenant_id': property['tenant_id'],
                'room_type_id': room_type['id'],
                'room_number': room_number
            })
            count += 1

    conn.commit()
    print(f"   → Inserted {count} rooms")
