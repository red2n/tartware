"""Provision room type definitions for every property."""


from data_store import data_store
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random


def insert_room_types(conn, count_per_property=3):
    """Insert room type templates covering occupancy and pricing metadata.

    Args:
        conn: psycopg2 connection for executing inserts.
        count_per_property: Number of room types to create for each property.
    """
    print(f"\n✓ Inserting Room Types ({count_per_property} per property)...")
    cur = conn.cursor()

    categories = ['STANDARD', 'DELUXE', 'SUITE', 'EXECUTIVE', 'PRESIDENTIAL']
    room_names = ['Standard Room', 'Deluxe Room', 'Junior Suite', 'Executive Suite', 'Presidential Suite', 'Ocean View', 'Garden View']
    count = 0

    for property in data_store['properties']:
        for i in range(count_per_property):
            room_type_id = generate_uuid()
            name = random.choice(room_names)
            code = f"RT{count + 1:03d}"

            base_price = round(random.uniform(100, 500), 2)

            cur.execute("""
                INSERT INTO room_types (id, tenant_id, property_id, type_name, type_code, category, base_occupancy, max_occupancy, base_price, description, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                room_type_id,
                property['tenant_id'],
                property['id'],
                name,
                code,
                categories[i % len(categories)],
                random.choice([1, 2, 2]),
                random.choice([2, 3, 4]),
                base_price,
                fake.text(100),
                fake.date_time_between(start_date="-2y", end_date="now")
            ))

            data_store['room_types'].append({
                'id': room_type_id,
                'property_id': property['id'],
                'tenant_id': property['tenant_id'],
                'name': name,
                'code': code,
                'base_price': base_price
            })
            count += 1

    conn.commit()
    print(f"   → Inserted {count} room types")
