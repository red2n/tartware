"""Insert function for reservations table"""


from data_store import data_store
from datetime import datetime, timedelta
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random


def insert_reservations(conn, count=500):
    """Insert reservation records - MAIN DATA VOLUME"""
    print(f"\n✓ Inserting {count} Reservations (Main Data Volume)...")
    cur = conn.cursor()

    statuses = ['PENDING', 'CONFIRMED', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CHECKED_OUT', 'CANCELLED']
    sources = ['DIRECT', 'WEBSITE', 'PHONE', 'WALKIN', 'OTA', 'CORPORATE', 'GROUP']

    for i in range(count):
        if (i + 1) % 50 == 0:
            print(f"   ... {i + 1}/{count} reservations")

        reservation_id = generate_uuid()
        property = random.choice(data_store['properties'])
        tenant_guests = [g for g in data_store['guests'] if g['tenant_id'] == property['tenant_id']]
        guest = random.choice(tenant_guests) if tenant_guests else random.choice(data_store['guests'])

        property_room_types = [rt for rt in data_store['room_types'] if rt['property_id'] == property['id']]
        room_type = random.choice(property_room_types)

        property_rates = [r for r in data_store['rates'] if r['property_id'] == property['id'] and r['room_type_id'] == room_type['id']]
        rate = random.choice(property_rates) if property_rates else None

        property_rooms = [r for r in data_store['rooms'] if r['property_id'] == property['id'] and r['room_type_id'] == room_type['id']]
        room = random.choice(property_rooms) if property_rooms else None

        booking_date = fake.date_time_between(start_date="-6m", end_date="now")
        check_in_date = fake.date_between(start_date="-3m", end_date="+3m")
        nights = random.randint(1, 7)
        check_out_date = check_in_date + timedelta(days=nights)

        room_rate = round(random.uniform(100, 500), 2)
        total_amount = round(room_rate * nights, 2)
        tax_amount = round(total_amount * 0.1, 2)
        paid_amount = round(total_amount * random.uniform(0, 1.0), 2)

        status = random.choice(statuses)

        cur.execute("""
            INSERT INTO reservations (id, tenant_id, property_id, guest_id, room_type_id, rate_id, confirmation_number,
                                     check_in_date, check_out_date, booking_date, room_number, number_of_adults, number_of_children,
                                     room_rate, total_amount, tax_amount, paid_amount, status, source, guest_name, guest_email, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            reservation_id,
            property['tenant_id'],
            property['id'],
            guest['id'],
            room_type['id'],
            rate['id'] if rate else None,
            f"CNF{i+1:06d}",
            check_in_date,
            check_out_date,
            booking_date,
            room['room_number'] if room else None,
            random.randint(1, 2),
            random.randint(0, 2),
            room_rate,
            total_amount,
            tax_amount,
            paid_amount,
            status,
            random.choice(sources),
            guest['name'],
            guest['email'],
            booking_date
        ))

        data_store['reservations'].append({
            'id': reservation_id,
            'tenant_id': property['tenant_id'],
            'property_id': property['id'],
            'guest_id': guest['id'],
            'total_amount': total_amount,
            'status': status
        })

    conn.commit()
    print(f"   → Inserted {count} reservations")
