"""Insert function for payments table"""


from data_store import data_store
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random


def insert_payments(conn):
    """Insert payment records"""
    print(f"\n✓ Inserting Payments...")
    cur = conn.cursor()

    methods = ['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER']
    statuses = ['COMPLETED', 'COMPLETED', 'COMPLETED', 'PENDING', 'FAILED']
    types = ['CHARGE', 'AUTHORIZATION', 'CAPTURE']
    count = 0

    for reservation in data_store['reservations'][:400]:  # 400 payments
        payment_id = generate_uuid()
        property = next((p for p in data_store['properties'] if p['id'] == reservation['property_id']), None)

        cur.execute("""
            INSERT INTO payments (id, tenant_id, property_id, reservation_id, guest_id, amount,
                                 payment_method, status, transaction_type, payment_reference,
                                 processed_at, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            generate_uuid(),
            property['tenant_id'],
            property['id'],
            reservation['id'],
            reservation['guest_id'],
            round(reservation['total_amount'] * random.uniform(0.3, 1.0), 2),
            random.choice(methods),
            random.choice(statuses),
            random.choice(types),
            f"PAY{count + 1:010d}",
            fake.date_time_between(start_date="-6m", end_date="now"),
            fake.date_time_between(start_date="-6m", end_date="now")
        ))
        count += 1

    conn.commit()
    print(f"   → Inserted {count} payments")
