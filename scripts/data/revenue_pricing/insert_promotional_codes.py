"""Insert function for promotional_codes table"""


from data_store import data_store
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random


def insert_promotional_codes(conn):
    """Insert promotional code records"""
    print(f"\n✓ Inserting Promotional Codes...")
    cur = conn.cursor()

    discount_types = ['percentage', 'fixed_amount', 'free_night']
    statuses = ['active', 'active', 'active', 'expired', 'paused']

    count = 0
    # Create 5-8 promo codes per property
    for property in data_store['properties']:
        for i in range(random.randint(5, 8)):
            # Create unique promo code using counter
            code = f"PROMO{count+1:04d}"
            discount_type = random.choice(discount_types)

            cur.execute("""
                INSERT INTO promotional_codes (
                    promo_id, tenant_id, property_id,
                    promo_code, promo_name, discount_type,
                    discount_percent, discount_amount,
                    valid_from, valid_to, promo_status,
                    minimum_stay_nights, max_discount_amount
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                code,
                f"{fake.word().title()} Promotion",
                discount_type,
                round(random.uniform(10, 30), 2) if discount_type == 'percentage' else None,
                round(random.uniform(20, 100), 2) if discount_type == 'fixed_amount' else None,
                fake.date_between(start_date="-60d", end_date="now"),
                fake.date_between(start_date="+30d", end_date="+180d"),
                random.choice(statuses),
                random.randint(1, 3),
                round(random.uniform(50, 200), 2)
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} promotional codes")
