"""Insert function for package_bookings table"""

from data_store import data_store
from db_config import generate_uuid
from faker import Faker
import random
from datetime import timedelta

fake = Faker()


def insert_package_bookings(conn, count=60):
    """Insert package booking records"""

    if not data_store.get('packages'):
        print("\n⚠ Skipping Package Bookings (no packages found)")
        return

    print(f"\n✓ Inserting {count} Package Bookings...")
    cur = conn.cursor()

    # Sample data arrays
    booking_statuses = ['confirmed'] * 60 + ['pending'] * 20 + ['cancelled'] * 10 + ['checked_out'] * 10
    random.shuffle(booking_statuses)

    for i in range(count):
        package_booking_id = generate_uuid()

        package = random.choice(data_store['packages'])

        # Find reservation for this property (REQUIRED)
        reservations_for_property = [
            r for r in data_store.get('reservations', [])
            if r.get('property_id') == package['property_id']
        ]
        if not reservations_for_property:
            continue  # Skip if no reservations for this property

        reservation = random.choice(reservations_for_property)
        reservation_id = reservation['id']

        # Pricing
        package_price = round(random.uniform(150, 500), 2)
        nights = random.randint(2, 7)
        total_amount = round(package_price * nights, 2)

        # Guests
        adults = random.randint(1, 4)
        children = random.randint(0, 2)

        status = random.choice(booking_statuses)

        cur.execute("""
            INSERT INTO package_bookings (
                package_booking_id, package_id, reservation_id,
                package_price, number_of_nights,
                number_of_adults, number_of_children,
                total_amount,
                status,
                special_requests, notes,
                created_at
            )
            VALUES (
                %s, %s, %s,
                %s, %s,
                %s, %s,
                %s,
                %s,
                %s, %s,
                %s
            )
        """, (
            package_booking_id, package['id'], reservation_id,
            package_price, nights,
            adults, children,
            total_amount,
            status,
            fake.text(max_nb_chars=200) if random.random() > 0.6 else None,
            fake.text(max_nb_chars=300) if random.random() > 0.7 else None,
            fake.date_time_between(start_date='-6m', end_date='now')
        ))

    conn.commit()
    print(f"   → Inserted {count} package bookings")
