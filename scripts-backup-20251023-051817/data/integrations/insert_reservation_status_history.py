"""Insert function for reservation_status_history table"""


from data_store import data_store
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random


def insert_reservation_status_history(conn):
    """Insert reservation status history"""
    print(f"\n✓ Inserting Reservation Status History...")
    cur = conn.cursor()

    count = 0
    for reservation in data_store['reservations']:
        # Each reservation gets 1-3 status changes
        num_changes = random.randint(1, 3)
        for i in range(num_changes):
            cur.execute("""
                INSERT INTO reservation_status_history (id, tenant_id, reservation_id, previous_status, new_status,
                                                        changed_at, changed_by, change_notes)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                reservation['tenant_id'],
                reservation['id'],
                'PENDING' if i == 0 else random.choice(['PENDING', 'CONFIRMED']),
                reservation['status'],
                fake.date_time_between(start_date="-6m", end_date="now"),
                random.choice(data_store['users'])['username'],
                fake.sentence() if random.random() > 0.5 else None
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} status history records")
