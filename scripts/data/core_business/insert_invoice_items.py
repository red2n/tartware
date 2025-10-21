"""Insert function for invoice_items table"""


from data_store import data_store
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random


def insert_invoice_items(conn):
    """Insert invoice item records"""
    print(f"\n✓ Inserting Invoice Items...")
    cur = conn.cursor()

    item_types = ['Room Charge', 'Breakfast', 'Minibar', 'Spa Service', 'Laundry', 'Parking', 'Room Service']
    count = 0

    for invoice in data_store['invoices']:
        # Each invoice gets 2-5 line items
        num_items = random.randint(2, 5)
        for i in range(num_items):
            quantity = random.randint(1, 5)
            unit_price = round(random.uniform(10, 200), 2)
            subtotal = quantity * unit_price
            total_amount = subtotal

            cur.execute("""
                INSERT INTO invoice_items (id, tenant_id, invoice_id, item_type, description, quantity, unit_price, subtotal, total_amount, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                invoice['tenant_id'],
                invoice['id'],
                'service',
                random.choice(item_types),
                quantity,
                unit_price,
                subtotal,
                total_amount,
                fake.date_time_between(start_date="-6m", end_date="now")
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} invoice items")
