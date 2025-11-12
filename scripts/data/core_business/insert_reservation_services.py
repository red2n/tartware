"""
@package tartware.scripts.data.core_business.insert_reservation_services
@summary Map ancillary services onto reservations to model upsell revenue.
"""


from data_store import data_store
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random


def insert_reservation_services(conn):
    """
    @summary Insert service consumption records tied to reservations.
    @param conn: psycopg2 connection for persisting reservation service rows.
    @returns None
    """
    print(f"\n✓ Inserting Reservation Services...")
    cur = conn.cursor()

    count = 0
    for reservation in data_store['reservations'][:250]:  # 250 reservations get services
        num_services = random.randint(1, 3)
        reservation_services = [s for s in data_store['services'] if s['property_id'] == reservation['property_id']]

        if reservation_services:
            selected_services = random.sample(reservation_services, min(num_services, len(reservation_services)))

            for service in selected_services:
                quantity = random.randint(1, 3)
                unit_price = round(random.uniform(20, 150), 2)
                total_price = quantity * unit_price

                cur.execute("""
                    INSERT INTO reservation_services (id, tenant_id, reservation_id, service_id,
                                                     service_name, service_code, quantity,
                                                     unit_price, total_price, service_date, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    generate_uuid(),
                    reservation['tenant_id'],
                    reservation['id'],
                    service['id'],
                    service['service_name'],
                    service['service_code'],
                    quantity,
                    unit_price,
                    total_price,
                    fake.date_between(start_date="-3m", end_date="today"),
                    fake.date_time_between(start_date="-3m", end_date="now")
                ))
                count += 1

    conn.commit()
    print(f"   → Inserted {count} reservation services")
