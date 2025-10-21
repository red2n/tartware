"""Insert function for mobile_keys table"""


from datetime import datetime, timedelta
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random


def insert_mobile_keys(conn):
    """Insert mobile key records"""
    print(f"\n✓ Inserting Mobile Keys...")
    cur = conn.cursor()

    count = 0

    # Get recent reservations
    cur.execute("SELECT id, guest_id, tenant_id, property_id FROM reservations WHERE check_in_date >= CURRENT_DATE - INTERVAL '30 days' LIMIT 200")
    recent_reservations = cur.fetchall()

    for reservation_id, guest_id, tenant_id, property_id in recent_reservations:
        if random.random() < 0.6:  # 60% of recent reservations get mobile keys
            # Get a room for this property
            cur2 = conn.cursor()
            cur2.execute("SELECT id FROM rooms WHERE property_id = %s LIMIT 1", (property_id,))
            room_result = cur2.fetchone()
            if not room_result:
                continue
            room_id = room_result[0]
            cur2.close()

            valid_from = fake.date_time_between(start_date="-30d", end_date="now")
            valid_to = valid_from + timedelta(days=random.randint(1, 7))
            key_types = ['bluetooth', 'nfc', 'qr_code', 'pin']
            statuses = ['pending', 'active', 'expired', 'revoked', 'used']

            cur.execute("""
                INSERT INTO mobile_keys (
                    key_id, tenant_id, property_id, reservation_id,
                    guest_id, room_id, key_code, key_type,
                    status, valid_from, valid_to
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                tenant_id,
                property_id,
                reservation_id,
                guest_id,
                room_id,
                f"KEY-{fake.uuid4()[:12].upper()}",
                random.choice(key_types),
                random.choice(statuses),
                valid_from,
                valid_to
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} mobile keys")
