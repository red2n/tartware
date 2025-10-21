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
            fake.phone_number()[:20],
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
