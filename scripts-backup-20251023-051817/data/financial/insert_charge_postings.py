"""Insert function for charge_postings table"""


from data_store import data_store
from datetime import datetime, timedelta
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random
import time


def insert_charge_postings(conn):
    """Insert charge posting records"""
    print(f"\n✓ Inserting Charge Postings...")
    cur = conn.cursor()

    charge_codes = ['ROOM', 'TAX', 'SERVICE', 'MINIBAR', 'LAUNDRY', 'RESTAURANT', 'SPA', 'PARKING']

    count = 0
    # Each folio gets 3-6 charges
    for folio in data_store['folios'][:400]:  # 80% of folios
        num_charges = random.randint(3, 6)
        for i in range(num_charges):
            charge_code = random.choice(charge_codes)
            unit_price = round(random.uniform(10, 200), 2)
            quantity = 1
            subtotal = unit_price * quantity
            total_amount = subtotal

            cur.execute("""
                INSERT INTO charge_postings (posting_id, tenant_id, property_id, folio_id,
                                           transaction_type, posting_type, business_date,
                                           charge_code, charge_description,
                                           unit_price, subtotal, total_amount)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                folio['tenant_id'],
                folio['property_id'],
                folio['id'],
                'CHARGE',
                'DEBIT',
                datetime.now().date(),
                charge_code,
                f"{charge_code} Charge - {fake.word()}",
                unit_price,
                subtotal,
                total_amount
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} charge postings")
