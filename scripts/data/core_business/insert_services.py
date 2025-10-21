"""Insert function for services table"""


from data_store import data_store
from db_config import generate_uuid
from faker import Faker

fake = Faker()


def insert_services(conn):
    """Insert service records"""
    print(f"\n✓ Inserting Services...")
    cur = conn.cursor()

    service_data = [
        ('Airport Transfer', 'AIRPORT', 'Airport pickup and drop-off', 50.00, 'TRANSPORTATION'),
        ('Breakfast Buffet', 'BRKFST', 'Full breakfast buffet', 25.00, 'DINING'),
        ('Spa Massage', 'SPA001', '60-minute relaxation massage', 120.00, 'SPA'),
        ('Laundry Service', 'LNDRY', 'Same-day laundry service', 30.00, 'HOUSEKEEPING'),
        ('Room Service', 'RMSERV', '24/7 room service', 15.00, 'DINING'),
        ('Parking', 'PARK', 'Valet parking service', 20.00, 'PARKING'),
        ('Late Checkout', 'LTCHK', 'Late checkout until 3 PM', 40.00, 'ACCOMMODATION'),
        ('Early Checkin', 'ERLYCHK', 'Early check-in from 10 AM', 35.00, 'ACCOMMODATION'),
    ]

    count = 0
    for property in data_store['properties']:
        for name, code, desc, price, category in service_data:
            service_id = generate_uuid()

            cur.execute("""
                INSERT INTO services (id, tenant_id, property_id, service_name, service_code,
                                     description, price, category, is_active, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                service_id,
                property['tenant_id'],
                property['id'],
                name,
                code,
                desc,
                price,
                category,
                True,
                fake.date_time_between(start_date="-2y", end_date="now")
            ))

            data_store['services'].append({
                'id': service_id,
                'property_id': property['id'],
                'service_name': name,
                'service_code': code
            })
            count += 1

    conn.commit()
    print(f"   → Inserted {count} services")
