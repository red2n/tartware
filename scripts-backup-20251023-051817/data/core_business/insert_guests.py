"""Insert function for guests table"""


from data_store import data_store
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random


def insert_guests(conn, count=200):
    """Insert guest records"""
    print(f"\n✓ Inserting {count} Guests...")
    cur = conn.cursor()

    for i in range(count):
        guest_id = generate_uuid()
        tenant = random.choice(data_store['tenants'])
        first_name = fake.first_name()
        last_name = fake.last_name()

        # Generate clean phone number without extensions (matches validation pattern)
        # Pattern: ^\+?[\d\s\(\)\-]{10,20}$
        phone_formats = [
            f"+1{fake.numerify('##########')}",  # +12345678901
            fake.numerify('###-###-####'),        # 123-456-7890
            f"({fake.numerify('###')}) {fake.numerify('###-####')}",  # (123) 456-7890
            fake.numerify('##########'),          # 1234567890
        ]
        clean_phone = random.choice(phone_formats)

        cur.execute("""
            INSERT INTO guests (id, tenant_id, first_name, last_name, email, phone, nationality,
                               loyalty_points, vip_status, total_bookings, total_nights, total_revenue, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            guest_id,
            tenant['id'],
            first_name,
            last_name,
            fake.email(),
            clean_phone,
            fake.country_code(),
            random.randint(0, 10000),
            random.choice([True, False, False, False]),
            random.randint(0, 20),
            random.randint(0, 100),
            round(random.uniform(0, 50000), 2),
            fake.date_time_between(start_date="-3y", end_date="now")
        ))

        data_store['guests'].append({
            'id': guest_id,
            'tenant_id': tenant['id'],
            'name': f"{first_name} {last_name}",
            'email': fake.email()
        })

    conn.commit()
    print(f"   → Inserted {count} guests")
