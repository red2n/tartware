"""Insert function for guest_communications table"""


from data_store import data_store
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random


def insert_guest_communications(conn):
    """Insert guest communication records"""
    print(f"\n✓ Inserting Guest Communications...")
    cur = conn.cursor()

    comm_types = ['EMAIL', 'SMS', 'PHONE', 'CHAT']
    statuses = ['SENT', 'DELIVERED', 'READ', 'FAILED']

    count = 0
    # Send 1-2 communications per reservation
    for reservation in data_store['reservations'][:300]:
        num_comms = random.randint(1, 2)
        for i in range(num_comms):
            cur.execute("""
                INSERT INTO guest_communications (id, tenant_id, property_id, reservation_id, guest_id,
                                                 communication_type, direction, subject, message,
                                                 status, sent_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                reservation['tenant_id'],
                reservation['property_id'],
                reservation['id'],
                reservation['guest_id'],
                random.choice(comm_types),
                'OUTBOUND',
                fake.sentence(nb_words=6),
                fake.paragraph(),
                random.choice(statuses),
                fake.date_time_between(start_date="-3m", end_date="now")
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} guest communications")
