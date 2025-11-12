"""Insert function for package_bookings table"""

import json
import random
from datetime import timedelta

from data_store import data_store
from db_config import generate_uuid
from faker import Faker

fake = Faker()


def insert_package_bookings(conn, count=60):
    """Insert package booking records"""

    if not data_store.get('packages'):
        print("\n⚠ Skipping Package Bookings (no packages found)")
        return

    print(f"\n✓ Inserting {count} Package Bookings...")
    cur = conn.cursor()

    booking_statuses = ['confirmed'] * 60 + ['pending'] * 20 + ['cancelled'] * 10 + ['checked_out'] * 10
    random.shuffle(booking_statuses)

    inserted = 0
    for _ in range(count):
        package_booking_id = generate_uuid()
        package = random.choice(data_store['packages'])

        reservations_for_property = [
            r for r in data_store.get('reservations', [])
            if r.get('property_id') == package['property_id']
        ]
        if not reservations_for_property:
            continue

        reservation = random.choice(reservations_for_property)
        reservation_id = reservation['id']

        check_in_date = reservation.get('check_in_date')
        check_out_date = reservation.get('check_out_date')
        booking_date = reservation.get('booking_date') or fake.date_time_between(start_date="-6m", end_date="now")

        if not check_in_date or not check_out_date:
            # Fall back to derived dates if the reservation payload is missing them
            check_in_date = fake.date_between(start_date="-3m", end_date="+3m")
            nights = random.randint(2, 7)
            check_out_date = check_in_date + timedelta(days=nights)
        else:
            nights = reservation.get('number_of_nights')
            if not nights:
                nights = max((check_out_date - check_in_date).days, 1)

        package_price = round(random.uniform(150, 500), 2)
        total_amount = round(package_price * nights, 2)

        adults = reservation.get('number_of_adults', random.randint(1, 4))
        children = reservation.get('number_of_children', random.randint(0, 2))

        discount_applied = round(total_amount * random.uniform(0, 0.15), 2) if random.random() > 0.7 else 0
        taxable_base = max(total_amount - discount_applied, 0)
        tax_amount = round(taxable_base * 0.1, 2)

        selected_components = None
        if random.random() > 0.6:
            selected_components = json.dumps({
                "included": ["room", "breakfast"],
                "add_ons": ["spa_treatment"] if random.random() > 0.5 else []
            })

        components_delivered = None
        fully_delivered = False
        if random.random() > 0.5:
            delivered_map = {
                "room": True,
                "breakfast": random.random() > 0.3,
                "spa_treatment": random.random() > 0.7
            }
            components_delivered = json.dumps(delivered_map)
            fully_delivered = all(delivered_map.values())

        status = random.choice(booking_statuses)

        cur.execute("""
            INSERT INTO package_bookings (
                package_booking_id, package_id, reservation_id,
                package_price, booking_date, check_in_date, check_out_date,
                number_of_nights, number_of_adults, number_of_children,
                total_amount, discount_applied, tax_amount,
                selected_components, component_modifications,
                components_delivered, fully_delivered,
                status,
                special_requests, notes,
                created_at
            )
            VALUES (
                %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                %s, %s,
                %s, %s,
                %s,
                %s, %s,
                %s
            )
        """, (
            package_booking_id, package['id'], reservation_id,
            package_price, booking_date, check_in_date, check_out_date,
            nights, adults, children,
            total_amount, discount_applied, tax_amount,
            selected_components, None,
            components_delivered, fully_delivered,
            status,
            fake.text(max_nb_chars=200) if random.random() > 0.6 else None,
            fake.text(max_nb_chars=300) if random.random() > 0.7 else None,
            fake.date_time_between(start_date='-6m', end_date='now')
        ))
        inserted += 1

    conn.commit()
    print(f"   → Inserted {inserted} package bookings")
