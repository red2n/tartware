"""Insert function for group_room_blocks table"""

from data_store import data_store
from db_config import generate_uuid
from faker import Faker
import random
from datetime import timedelta

fake = Faker()


def insert_group_room_blocks(conn):
    """Insert group room block records (linked to group bookings)"""

    if not data_store.get('group_bookings'):
        print("\n⚠ Skipping Group Room Blocks (no group bookings found)")
        return

    print(f"\n✓ Inserting Group Room Blocks...")
    cur = conn.cursor()

    block_statuses = ['definite', 'tentative', 'confirmed', 'partial', 'released']

    # Get a sample group booking to extract dates
    sample_group = data_store['group_bookings'][0] if data_store['group_bookings'] else None

    total_blocks = 0
    for group in data_store['group_bookings']:
        # Get room types for this property
        room_types_for_property = [
            rt for rt in data_store['room_types']
            if rt['property_id'] == group['property_id']
        ]

        if not room_types_for_property:
            continue

        # Create 1-3 room blocks per group booking (one per room type)
        num_blocks = min(random.randint(1, 3), len(room_types_for_property))
        selected_room_types = random.sample(room_types_for_property, num_blocks)

        for room_type in selected_room_types:
            block_id = generate_uuid()

            # Room allocation
            blocked_rooms = random.randint(5, 30)
            picked_rooms = random.randint(int(blocked_rooms * 0.5), blocked_rooms)
            confirmed_rooms = random.randint(int(picked_rooms * 0.7), picked_rooms)

            # Rates
            negotiated_rate = round(random.uniform(100, 400), 2)
            rack_rate = round(negotiated_rate * random.uniform(1.2, 1.5), 2)
            discount_percentage = round((1 - negotiated_rate / rack_rate) * 100, 2)

            # Generate a date within the group booking period
            # For simplicity, use a future date
            block_date = fake.date_between(start_date='+30d', end_date='+180d')

            block_status = random.choice(['active', 'active', 'pending', 'released'])

            cur.execute("""
                INSERT INTO group_room_blocks (
                    block_id, group_booking_id, room_type_id,
                    block_date,
                    blocked_rooms, picked_rooms, confirmed_rooms,
                    negotiated_rate, rack_rate, discount_percentage,
                    block_status,
                    created_at
                )
                VALUES (
                    %s, %s, %s,
                    %s,
                    %s, %s, %s,
                    %s, %s, %s,
                    %s,
                    %s
                )
            """, (
                block_id, group['id'], room_type['id'],
                block_date,
                blocked_rooms, picked_rooms, confirmed_rooms,
                negotiated_rate, rack_rate, discount_percentage,
                block_status,
                fake.date_time_between(start_date='-180d', end_date='now')
            ))

            total_blocks += 1

    conn.commit()
    print(f"   → Inserted {total_blocks} group room blocks")
