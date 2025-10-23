"""Insert function for properties table"""


from data_store import data_store
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import json
import random


def insert_properties(conn, count_per_tenant=3):
    """Insert property records"""
    print(f"\n✓ Inserting Properties ({count_per_tenant} per tenant)...")
    cur = conn.cursor()

    property_types = ['hotel', 'resort', 'hostel', 'motel', 'apartment', 'villa']
    count = 0

    for tenant in data_store['tenants']:
        for i in range(count_per_tenant):
            property_id = generate_uuid()
            property_name = f"{fake.city()} {random.choice(['Grand', 'Plaza', 'Royal', 'Imperial', 'Sunset', 'Beach'])} {random.choice(['Hotel', 'Resort', 'Inn'])}"
            property_code = f"PROP{count + 1:03d}"

            address = {
                "street": fake.street_address(),
                "city": fake.city(),
                "state": fake.state(),
                "postalCode": fake.postcode(),
                "country": fake.country_code(),
                "latitude": float(fake.latitude()),
                "longitude": float(fake.longitude())
            }

            cur.execute("""
                INSERT INTO properties (id, tenant_id, property_name, property_code, address, phone, email,
                                       property_type, star_rating, total_rooms, currency, timezone, is_active, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                property_id,
                tenant['id'],
                property_name,
                property_code,
                json.dumps(address),
                fake.phone_number()[:20],
                fake.email(),
                random.choice(property_types),
                round(random.uniform(2.5, 5.0), 1),
                random.choice([20, 30, 40, 50, 100]),
                'USD',
                'UTC',
                True,
                fake.date_time_between(start_date="-2y", end_date="now")
            ))

            data_store['properties'].append({
                'id': property_id,
                'tenant_id': tenant['id'],
                'name': property_name,
                'code': property_code
            })
            count += 1

    conn.commit()
    print(f"   → Inserted {count} properties")
