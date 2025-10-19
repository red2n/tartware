#!/usr/bin/env python3
"""
Direct Database Sample Data Loader for Tartware PMS
Connects to PostgreSQL and inserts data directly
Date: 2025-10-19
"""

import random
import uuid
from datetime import datetime, timedelta
import json
import psycopg2
from psycopg2.extras import execute_values

# Try to import faker
try:
    from faker import Faker
except ImportError:
    print("ERROR: Faker library not installed.")
    print("Please install it using: pip3 install faker --break-system-packages")
    exit(1)

fake = Faker()
Faker.seed(42)
random.seed(42)

# Database connection parameters
DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'tartware',
    'user': 'postgres',
    'password': 'postgres'
}

# Storage for generated IDs
data_store = {
    'tenants': [],
    'users': [],
    'properties': [],
    'guests': [],
    'room_types': [],
    'rooms': [],
    'rates': [],
    'reservations': [],
    'invoices': [],
    'services': [],
}


def get_db_connection():
    """Create database connection"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except Exception as e:
        print(f"Error connecting to database: {e}")
        print("\nPlease ensure:")
        print("  1. PostgreSQL is running")
        print("  2. Database 'tartware' exists")
        print("  3. Credentials are correct")
        exit(1)


def generate_uuid():
    """Generate UUID string"""
    return str(uuid.uuid4())


def insert_tenants(conn, count=5):
    """Insert tenant records"""
    print(f"\n✓ Inserting {count} Tenants...")
    cur = conn.cursor()

    tenant_types = ['INDEPENDENT', 'CHAIN', 'FRANCHISE', 'MANAGEMENT_COMPANY']
    statuses = ['ACTIVE', 'ACTIVE', 'ACTIVE', 'TRIAL', 'ACTIVE']

    for i in range(count):
        tenant_id = generate_uuid()
        company_name = fake.company()
        slug = company_name.lower().replace(' ', '-').replace(',', '').replace('.', '')[:200]

        config = {
            "brandingEnabled": True,
            "enableMultiProperty": True,
            "enableChannelManager": random.choice([True, False]),
            "enableAdvancedReporting": random.choice([True, False]),
            "enablePaymentProcessing": True,
            "enableLoyaltyProgram": random.choice([True, False]),
            "maxProperties": random.choice([5, 10, 25, 50]),
            "maxUsers": random.choice([10, 25, 50, 100]),
            "defaultCurrency": "USD",
            "defaultLanguage": "en",
            "defaultTimezone": "UTC"
        }

        subscription = {
            "plan": random.choice(["BASIC", "PROFESSIONAL", "ENTERPRISE"]),
            "billingCycle": "MONTHLY",
            "amount": random.choice([99, 299, 999]),
            "currency": "USD"
        }

        cur.execute("""
            INSERT INTO tenants (id, name, slug, type, status, email, phone, country, config, subscription, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            tenant_id,
            company_name,
            slug,
            tenant_types[i % len(tenant_types)],
            statuses[i],
            fake.company_email(),
            fake.phone_number()[:20],
            fake.country_code(),
            json.dumps(config),
            json.dumps(subscription),
            fake.date_time_between(start_date="-2y", end_date="now")
        ))

        data_store['tenants'].append({
            'id': tenant_id,
            'name': company_name,
            'slug': slug
        })

    conn.commit()
    print(f"   → Inserted {count} tenants")


def insert_users(conn, count=25):
    """Insert user records"""
    print(f"\n✓ Inserting {count} Users...")
    cur = conn.cursor()

    for i in range(count):
        user_id = generate_uuid()
        first_name = fake.first_name()
        last_name = fake.last_name()
        username = f"{first_name.lower()}.{last_name.lower()}{random.randint(1, 999)}"

        cur.execute("""
            INSERT INTO users (id, username, email, password_hash, first_name, last_name, phone, is_active, is_verified, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            user_id,
            username,
            fake.email(),
            '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5NU7xlL.RGbKW',
            first_name,
            last_name,
            fake.phone_number()[:20],
            random.choice([True, True, True, False]),
            random.choice([True, True, False]),
            fake.date_time_between(start_date="-2y", end_date="now")
        ))

        data_store['users'].append({
            'id': user_id,
            'username': username,
            'name': f"{first_name} {last_name}"
        })

    conn.commit()
    print(f"   → Inserted {count} users")


def insert_user_tenant_associations(conn):
    """Insert user-tenant associations"""
    print(f"\n✓ Inserting User-Tenant Associations...")
    cur = conn.cursor()

    roles = ['OWNER', 'ADMIN', 'MANAGER', 'STAFF', 'VIEWER']
    count = 0

    for tenant in data_store['tenants']:
        # Track assigned users for this tenant to avoid duplicates
        assigned_users = set()

        # Owner
        owner_user = random.choice(data_store['users'])
        assigned_users.add(owner_user['id'])

        cur.execute("""
            INSERT INTO user_tenant_associations (id, user_id, tenant_id, role, is_active, created_at)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (
            generate_uuid(),
            owner_user['id'],
            tenant['id'],
            'OWNER',
            True,
            fake.date_time_between(start_date="-2y", end_date="now")
        ))
        count += 1

        # Additional staff - ensure no duplicates
        num_staff = random.randint(3, 6)
        attempts = 0
        while len(assigned_users) < min(num_staff + 1, len(data_store['users'])) and attempts < 100:
            staff_user = random.choice(data_store['users'])
            if staff_user['id'] not in assigned_users:
                assigned_users.add(staff_user['id'])
                cur.execute("""
                    INSERT INTO user_tenant_associations (id, user_id, tenant_id, role, is_active, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (
                    generate_uuid(),
                    staff_user['id'],
                    tenant['id'],
                    random.choice(roles[1:]),
                    True,
                    fake.date_time_between(start_date="-2y", end_date="now")
                ))
                count += 1
            attempts += 1

    conn.commit()
    print(f"   → Inserted {count} associations")


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


def insert_room_types(conn, count_per_property=3):
    """Insert room type records"""
    print(f"\n✓ Inserting Room Types ({count_per_property} per property)...")
    cur = conn.cursor()

    categories = ['STANDARD', 'DELUXE', 'SUITE', 'EXECUTIVE', 'PRESIDENTIAL']
    room_names = ['Standard Room', 'Deluxe Room', 'Junior Suite', 'Executive Suite', 'Presidential Suite', 'Ocean View', 'Garden View']
    count = 0

    for property in data_store['properties']:
        for i in range(count_per_property):
            room_type_id = generate_uuid()
            name = random.choice(room_names)
            code = f"RT{count + 1:03d}"

            cur.execute("""
                INSERT INTO room_types (id, tenant_id, property_id, type_name, type_code, category, base_occupancy, max_occupancy, base_price, description, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                room_type_id,
                property['tenant_id'],
                property['id'],
                name,
                code,
                categories[i % len(categories)],
                random.choice([1, 2, 2]),
                random.choice([2, 3, 4]),
                round(random.uniform(100, 500), 2),
                fake.text(100),
                fake.date_time_between(start_date="-2y", end_date="now")
            ))

            data_store['room_types'].append({
                'id': room_type_id,
                'property_id': property['id'],
                'tenant_id': property['tenant_id'],
                'name': name,
                'code': code
            })
            count += 1

    conn.commit()
    print(f"   → Inserted {count} room types")


def insert_rooms(conn, count_per_property=20):
    """Insert room records"""
    print(f"\n✓ Inserting Rooms ({count_per_property} per property)...")
    cur = conn.cursor()

    statuses = ['AVAILABLE', 'CLEAN', 'DIRTY', 'INSPECTED']
    count = 0

    for property in data_store['properties']:
        property_room_types = [rt for rt in data_store['room_types'] if rt['property_id'] == property['id']]

        for i in range(count_per_property):
            room_id = generate_uuid()
            room_type = random.choice(property_room_types)
            floor = random.randint(1, 10)
            room_number = f"{floor}{i+1:02d}"

            cur.execute("""
                INSERT INTO rooms (id, tenant_id, property_id, room_type_id, room_number, floor, status, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                room_id,
                property['tenant_id'],
                property['id'],
                room_type['id'],
                room_number,
                floor,
                random.choice(statuses),
                fake.date_time_between(start_date="-2y", end_date="now")
            ))

            data_store['rooms'].append({
                'id': room_id,
                'property_id': property['id'],
                'tenant_id': property['tenant_id'],
                'room_type_id': room_type['id'],
                'room_number': room_number
            })
            count += 1

    conn.commit()
    print(f"   → Inserted {count} rooms")


def insert_rates(conn, count_per_property=6):
    """Insert rate records"""
    print(f"\n✓ Inserting Rates...")
    cur = conn.cursor()

    strategies = ['FIXED', 'DYNAMIC', 'SEASONAL', 'WEEKEND', 'LASTMINUTE', 'EARLYBIRD']
    statuses = ['ACTIVE', 'ACTIVE', 'ACTIVE', 'INACTIVE']
    count = 0

    for property in data_store['properties']:
        property_room_types = [rt for rt in data_store['room_types'] if rt['property_id'] == property['id']]

        for room_type in property_room_types:
            for i in range(2):
                rate_id = generate_uuid()
                strategy = strategies[i % len(strategies)]

                cur.execute("""
                    INSERT INTO rates (id, tenant_id, property_id, room_type_id, rate_name, rate_code, base_rate, strategy, status, valid_from, valid_until, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    rate_id,
                    property['tenant_id'],
                    property['id'],
                    room_type['id'],
                    f"{strategy} Rate - {room_type['name']}",
                    f"RATE{count + 1:03d}",
                    round(random.uniform(80, 600), 2),
                    strategy,
                    random.choice(statuses),
                    fake.date_between(start_date="-1y", end_date="today"),
                    fake.date_between(start_date="today", end_date="+1y"),
                    fake.date_time_between(start_date="-1y", end_date="now")
                ))

                data_store['rates'].append({
                    'id': rate_id,
                    'property_id': property['id'],
                    'tenant_id': property['tenant_id'],
                    'room_type_id': room_type['id']
                })
                count += 1

    conn.commit()
    print(f"   → Inserted {count} rates")


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


def insert_payments(conn):
    """Insert payment records"""
    print(f"\n✓ Inserting Payments...")
    cur = conn.cursor()

    methods = ['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER']
    statuses = ['COMPLETED', 'COMPLETED', 'COMPLETED', 'PENDING', 'FAILED']
    types = ['CHARGE', 'AUTHORIZATION', 'CAPTURE']
    count = 0

    for reservation in data_store['reservations'][:400]:  # 400 payments
        payment_id = generate_uuid()
        property = next((p for p in data_store['properties'] if p['id'] == reservation['property_id']), None)

        cur.execute("""
            INSERT INTO payments (id, tenant_id, property_id, reservation_id, guest_id, amount,
                                 payment_method, status, transaction_type, payment_reference,
                                 processed_at, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            generate_uuid(),
            property['tenant_id'],
            property['id'],
            reservation['id'],
            reservation['guest_id'],
            round(reservation['total_amount'] * random.uniform(0.3, 1.0), 2),
            random.choice(methods),
            random.choice(statuses),
            random.choice(types),
            f"PAY{count + 1:010d}",
            fake.date_time_between(start_date="-6m", end_date="now"),
            fake.date_time_between(start_date="-6m", end_date="now")
        ))
        count += 1

    conn.commit()
    print(f"   → Inserted {count} payments")


def insert_invoices(conn):
    """Insert invoice records"""
    print(f"\n✓ Inserting Invoices...")
    cur = conn.cursor()

    statuses = ['PAID', 'PAID', 'SENT', 'PARTIALLY_PAID', 'OVERDUE']
    count = 0

    for reservation in data_store['reservations']:
        invoice_id = generate_uuid()
        property = next((p for p in data_store['properties'] if p['id'] == reservation['property_id']), None)

        invoice_date = fake.date_between(start_date="-6m", end_date="today")
        due_date = invoice_date + timedelta(days=30)

        subtotal = reservation['total_amount']
        tax = subtotal * 0.1
        total = subtotal + tax

        cur.execute("""
            INSERT INTO invoices (id, tenant_id, property_id, reservation_id, guest_id,
                                 invoice_number, invoice_date, due_date, subtotal, tax_amount,
                                 total_amount, status, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            invoice_id,
            property['tenant_id'],
            property['id'],
            reservation['id'],
            reservation['guest_id'],
            f"INV{count + 1:06d}",
            invoice_date,
            due_date,
            subtotal,
            tax,
            total,
            random.choice(statuses),
            fake.date_time_between(start_date="-6m", end_date="now")
        ))

        data_store['invoices'].append({
            'id': invoice_id,
            'tenant_id': property['tenant_id'],
            'reservation_id': reservation['id'],
            'total': total
        })
        count += 1

    conn.commit()
    print(f"   → Inserted {count} invoices")


def insert_invoice_items(conn):
    """Insert invoice item records"""
    print(f"\n✓ Inserting Invoice Items...")
    cur = conn.cursor()

    item_types = ['Room Charge', 'Breakfast', 'Minibar', 'Spa Service', 'Laundry', 'Parking', 'Room Service']
    count = 0

    for invoice in data_store['invoices']:
        # Each invoice gets 2-5 line items
        num_items = random.randint(2, 5)
        for i in range(num_items):
            quantity = random.randint(1, 5)
            unit_price = round(random.uniform(10, 200), 2)
            subtotal = quantity * unit_price
            total_amount = subtotal

            cur.execute("""
                INSERT INTO invoice_items (id, tenant_id, invoice_id, item_type, description, quantity, unit_price, subtotal, total_amount, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                invoice['tenant_id'],
                invoice['id'],
                'service',
                random.choice(item_types),
                quantity,
                unit_price,
                subtotal,
                total_amount,
                fake.date_time_between(start_date="-6m", end_date="now")
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} invoice items")


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


def insert_reservation_services(conn):
    """Insert reservation service records"""
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


def insert_housekeeping_tasks(conn):
    """Insert housekeeping task records"""
    print(f"\n✓ Inserting Housekeeping Tasks...")
    cur = conn.cursor()

    task_types = ['CLEANING', 'INSPECTION', 'TURNDOWN', 'DEEP_CLEAN', 'MAINTENANCE']
    statuses = ['CLEAN', 'DIRTY', 'INSPECTED', 'IN_PROGRESS']
    priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
    count = 0

    # Generate 2-3 tasks per room (about 600-900 tasks)
    for room in data_store['rooms'][:300]:
        num_tasks = random.randint(2, 3)
        for i in range(num_tasks):
            assigned_user = random.choice(data_store['users'])

            cur.execute("""
                INSERT INTO housekeeping_tasks (id, tenant_id, property_id, room_number, task_type,
                                               status, priority, assigned_to, scheduled_date, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                room['tenant_id'],
                room['property_id'],
                room['room_number'],
                random.choice(task_types),
                random.choice(statuses),
                random.choice(priorities),
                assigned_user['id'],
                fake.date_between(start_date="-30d", end_date="+7d"),
                fake.date_time_between(start_date="-30d", end_date="now")
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} housekeeping tasks")


def insert_booking_sources(conn):
    """Insert booking source records"""
    print(f"\n✓ Inserting Booking Sources...")
    cur = conn.cursor()

    sources = [
        ('Direct Website', 'DIRECT', 'DIRECT', 0.00),
        ('Booking.com', 'BOOKING', 'OTA', 15.00),
        ('Expedia', 'EXPEDIA', 'OTA', 18.00),
        ('Airbnb', 'AIRBNB', 'OTA', 14.00),
        ('Phone', 'PHONE', 'PHONE', 0.00),
        ('Walk-in', 'WALKIN', 'WALK_IN', 0.00),
    ]

    count = 0
    for property in data_store['properties']:
        for name, code, channel_type, commission in sources:
            cur.execute("""
                INSERT INTO booking_sources (source_id, tenant_id, property_id, source_name,
                                            source_code, source_type, commission_percentage, is_active)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                name,
                code,
                channel_type,
                commission,
                True
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} booking sources")


def insert_market_segments(conn):
    """Insert market segment records"""
    print(f"\n✓ Inserting Market Segments...")
    cur = conn.cursor()

    segments = [
        ('Corporate', 'CORP', 'CORPORATE', 'Business travelers'),
        ('Leisure', 'LEISURE', 'LEISURE', 'Vacation guests'),
        ('Group', 'GROUP', 'GROUP', 'Group bookings'),
        ('Government', 'GOV', 'GOVERNMENT', 'Government employees'),
        ('Airline Crew', 'CREW', 'NEGOTIATED', 'Airline crew members'),
    ]

    count = 0
    for property in data_store['properties']:
        for name, code, seg_type, desc in segments:
            cur.execute("""
                INSERT INTO market_segments (segment_id, tenant_id, property_id, segment_name,
                                            segment_code, segment_type, description, is_active, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                name,
                code,
                seg_type,
                desc,
                True,
                fake.date_time_between(start_date="-2y", end_date="now")
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} market segments")


def insert_reservation_status_history(conn):
    """Insert reservation status history"""
    print(f"\n✓ Inserting Reservation Status History...")
    cur = conn.cursor()

    count = 0
    for reservation in data_store['reservations']:
        # Each reservation gets 1-3 status changes
        num_changes = random.randint(1, 3)
        for i in range(num_changes):
            cur.execute("""
                INSERT INTO reservation_status_history (id, tenant_id, reservation_id, previous_status, new_status,
                                                        changed_at, changed_by, change_notes)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                reservation['tenant_id'],
                reservation['id'],
                'PENDING' if i == 0 else random.choice(['PENDING', 'CONFIRMED']),
                reservation['status'],
                fake.date_time_between(start_date="-6m", end_date="now"),
                random.choice(data_store['users'])['username'],
                fake.sentence() if random.random() > 0.5 else None
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} status history records")


def insert_audit_logs(conn):
    """Insert audit log records"""
    print(f"\n✓ Inserting Audit Logs...")
    cur = conn.cursor()

    event_types = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT']
    entities = ['reservation', 'guest', 'payment', 'user', 'room', 'rate']
    count = 0

    for i in range(200):  # 200 audit logs
        property = random.choice(data_store['properties'])
        user = random.choice(data_store['users'])

        cur.execute("""
            INSERT INTO audit_logs (audit_id, tenant_id, property_id, user_id, event_type, action,
                                   entity_type, entity_id, old_values, new_values, ip_address,
                                   user_agent, audit_timestamp)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            generate_uuid(),
            property['tenant_id'],
            property['id'],
            user['id'],
            random.choice(event_types),
            random.choice(event_types),
            random.choice(entities),
            generate_uuid(),
            json.dumps({"status": "old"}),
            json.dumps({"status": "new"}),
            fake.ipv4(),
            fake.user_agent(),
            fake.date_time_between(start_date="-3m", end_date="now")
        ))
        count += 1

    conn.commit()
    print(f"   → Inserted {count} audit logs")


def insert_ota_configurations(conn):
    """Insert OTA configuration records"""
    print(f"\n✓ Inserting OTA Configurations...")
    cur = conn.cursor()

    otas = [
        ('Booking.com', 'BOOKING', True, '15.0'),
        ('Expedia', 'EXPEDIA', True, '18.0'),
        ('Airbnb', 'AIRBNB', True, '14.0'),
    ]

    count = 0
    for property in data_store['properties']:
        for name, code, active, commission in otas:
            cur.execute("""
                INSERT INTO ota_configurations (id, tenant_id, property_id, ota_name, ota_code,
                                               is_active, commission_percentage, api_endpoint, sync_enabled)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                name,
                code,
                active,
                commission,
                f"https://api.{code.lower()}.com/v1",
                True
            ))
            count += 1

    data_store['ota_configurations'] = count
    conn.commit()
    print(f"   → Inserted {count} OTA configurations")


def insert_guest_communications(conn):
    """Insert guest communication records"""
    print(f"\n✓ Inserting Guest Communications...")
    cur = conn.cursor()

    comm_types = ['EMAIL', 'SMS', 'PHONE', 'CHAT']
    statuses = ['SENT', 'DELIVERED', 'READ', 'FAILED']

    count = 0
    # Send 1-2 communications per reservation
    for reservation in data_store['reservations'][:300]:
        num_comms = random.randint(1, 2)
        for i in range(num_comms):
            cur.execute("""
                INSERT INTO guest_communications (id, tenant_id, property_id, reservation_id, guest_id,
                                                 communication_type, direction, subject, message,
                                                 status, sent_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                reservation['tenant_id'],
                reservation['property_id'],
                reservation['id'],
                reservation['guest_id'],
                random.choice(comm_types),
                'OUTBOUND',
                fake.sentence(nb_words=6),
                fake.paragraph(),
                random.choice(statuses),
                fake.date_time_between(start_date="-3m", end_date="now")
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} guest communications")


def insert_guest_feedback(conn):
    """Insert guest feedback records"""
    print(f"\n✓ Inserting Guest Feedback...")
    cur = conn.cursor()

    feedback_sources = ['DIRECT', 'EMAIL', 'SURVEY', 'BOOKING_COM', 'TRIPADVISOR', 'GOOGLE']

    count = 0
    # 40% of reservations get feedback
    for reservation in data_store['reservations'][:200]:
        rating = round(random.uniform(3.0, 5.0), 2)
        cur.execute("""
            INSERT INTO guest_feedback (id, tenant_id, property_id, reservation_id, guest_id,
                                       feedback_source, overall_rating, cleanliness_rating,
                                       staff_rating, location_rating, amenities_rating,
                                       value_rating, review_text)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            generate_uuid(),
            reservation['tenant_id'],
            reservation['property_id'],
            reservation['id'],
            reservation['guest_id'],
            random.choice(feedback_sources),
            rating,
            round(random.uniform(max(1.0, rating-1), min(5.0, rating+1)), 2),
            round(random.uniform(max(1.0, rating-1), min(5.0, rating+1)), 2),
            round(random.uniform(max(1.0, rating-1), min(5.0, rating+1)), 2),
            round(random.uniform(max(1.0, rating-1), min(5.0, rating+1)), 2),
            round(random.uniform(max(1.0, rating-1), min(5.0, rating+1)), 2),
            fake.paragraph()
        ))
        count += 1

    conn.commit()
    print(f"   → Inserted {count} guest feedback records")


def insert_guest_preferences(conn):
    """Insert guest preference records"""
    print(f"\n✓ Inserting Guest Preferences...")
    cur = conn.cursor()

    preferences = [
        ('ROOM', 'BED_TYPE', ['King Bed', 'Queen Bed', 'Twin Beds', 'Double Bed']),
        ('ROOM', 'PILLOW_TYPE', ['Soft Pillow', 'Firm Pillow', 'Memory Foam', 'Feather Pillow']),
        ('ROOM', 'FLOOR_LEVEL', ['Low Floor', 'High Floor', 'Ground Floor']),
        ('SERVICE', 'TURNDOWN_SERVICE', ['Yes', 'No']),
        ('ROOM', 'VIEW', ['Ocean View', 'City View', 'Garden View', 'No Preference']),
        ('DIETARY', 'BREAKFAST_PREFERENCE', ['Continental', 'American', 'Vegan', 'Gluten-Free']),
        ('COMMUNICATION', 'CONTACT_METHOD', ['Email', 'Phone', 'SMS'])
    ]

    count = 0
    # Each guest gets 2-4 preferences
    for guest in data_store['guests'][:150]:
        num_prefs = random.randint(2, 4)
        selected_prefs = random.sample(preferences, min(num_prefs, len(preferences)))

        for pref_category, pref_type, pref_values in selected_prefs:
            cur.execute("""
                INSERT INTO guest_preferences (preference_id, tenant_id, guest_id, preference_category,
                                              preference_type, preference_value, priority)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                guest['tenant_id'],
                guest['id'],
                pref_category,
                pref_type,
                random.choice(pref_values),
                random.choice([1, 2, 3])  # 1=HIGH, 2=MEDIUM, 3=LOW
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} guest preferences")


def insert_channel_mappings(conn):
    """Insert channel mapping records"""
    print(f"\n✓ Inserting Channel Mappings...")
    cur = conn.cursor()

    channels = ['BOOKING', 'EXPEDIA', 'AIRBNB']

    count = 0
    # Map room types to OTA channels
    for room_type in data_store['room_types']:
        for channel in channels:
            cur.execute("""
                INSERT INTO channel_mappings (id, tenant_id, property_id, channel_name,
                                             channel_code, entity_type, entity_id,
                                             external_id, is_active)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                room_type['tenant_id'],
                room_type['property_id'],
                channel,
                channel,
                'ROOM_TYPE',
                room_type['id'],
                f"{channel}_{room_type['code']}",
                True
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} channel mappings")


# def insert_availability(conn):
#     """Insert room availability records - TABLE DOES NOT EXIST"""
#     # Availability table not found in schema - skipping
#     pass


def insert_communication_templates(conn):
    """Insert communication template records"""
    print(f"\n✓ Inserting Communication Templates...")
    cur = conn.cursor()

    templates = [
        ('Booking Confirmation', 'BOOKING_CONFIRMATION', 'EMAIL',
         'Your Reservation is Confirmed',
         'Thank you for your booking. Your confirmation number is {{confirmation_number}}.'),
        ('Check-in Reminder', 'CHECKIN_REMINDER', 'EMAIL',
         'Check-in Tomorrow',
         'We look forward to welcoming you tomorrow at {{property_name}}.'),
        ('Pre-Arrival', 'PRE_ARRIVAL', 'SMS',
         'Arrival Information',
         'Your room will be ready at {{checkin_time}}. See you soon!'),
        ('Post-Checkout', 'POST_CHECKOUT', 'EMAIL',
         'Thank You for Staying',
         'Thank you for choosing {{property_name}}. We hope to see you again.'),
        ('Payment Receipt', 'PAYMENT_RECEIPT', 'EMAIL',
         'Payment Confirmation',
         'Your payment of {{amount}} has been received. Transaction ID: {{transaction_id}}.'),
    ]

    count = 0
    for property in data_store['properties']:
        for name, code, channel, subject, body in templates:
            cur.execute("""
                INSERT INTO communication_templates (id, tenant_id, property_id, template_name,
                                                    template_code, communication_type, subject, body,
                                                    is_active)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                name,
                code,
                channel,
                subject,
                body,
                True
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} communication templates")


def main():
    """Main execution function"""
    print("=" * 60)
    print("Tartware PMS - Direct Database Sample Data Loader")
    print("=" * 60)
    print(f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Target: 500+ records across all tables")
    print("=" * 60)

    # Connect to database
    print("\n✓ Connecting to database...")
    conn = get_db_connection()
    print("   → Connected successfully!")

    # Check if data already exists
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM reservations;")
    existing_count = cur.fetchone()[0]

    if existing_count > 0:
        print(f"\n⚠️  Warning: Database already contains {existing_count} reservations!")
        response = input("Do you want to clear all data and start fresh? (yes/no): ").lower()

        if response == 'yes':
            print("\n✓ Clearing existing data...")
            tables = [
                'channel_mappings', 'communication_templates',
                'guest_preferences', 'guest_feedback', 'guest_communications',
                'ota_configurations', 'reservation_services', 'reservation_status_history',
                'invoice_items', 'invoices', 'payments', 'reservations',
                'housekeeping_tasks', 'rates', 'rooms', 'room_types', 'services',
                'guests', 'properties', 'booking_sources', 'market_segments',
                'user_tenant_associations', 'users', 'tenants', 'audit_logs'
            ]
            for table in tables:
                try:
                    cur.execute(f"TRUNCATE TABLE {table} CASCADE;")
                    conn.commit()  # Commit each truncate
                    print(f"   → Cleared {table}")
                except Exception as e:
                    conn.rollback()  # Rollback on error
                    print(f"   → Skipped {table}: {str(e)[:50]}")
            print("   → All data cleared!")
        else:
            print("\n❌ Aborted. Existing data preserved.")
            conn.close()
            return

    # Disable triggers for performance
    cur.execute("SET session_replication_role = replica;")
    conn.commit()
    print("\n✓ Disabled triggers for bulk insert performance")

    try:
        # Generate data in dependency order
        insert_tenants(conn, 5)
        insert_users(conn, 25)
        insert_user_tenant_associations(conn)
        insert_properties(conn, 3)
        insert_guests(conn, 200)
        insert_room_types(conn, 3)
        insert_rooms(conn, 20)
        insert_rates(conn, 6)
        insert_reservations(conn, 500)

        # Additional tables
        insert_payments(conn)
        insert_invoices(conn)
        insert_invoice_items(conn)
        insert_services(conn)
        insert_reservation_services(conn)
        insert_housekeeping_tasks(conn)
        insert_booking_sources(conn)
        insert_market_segments(conn)
        insert_reservation_status_history(conn)
        insert_audit_logs(conn)

        # OTA and Channel Management
        insert_ota_configurations(conn)
        insert_channel_mappings(conn)

        # Guest CRM
        insert_guest_communications(conn)
        insert_guest_feedback(conn)
        insert_guest_preferences(conn)
        insert_communication_templates(conn)

        # Re-enable triggers
        cur.execute("SET session_replication_role = DEFAULT;")
        conn.commit()
        print("\n✓ Re-enabled triggers")

        # Summary
        print("\n" + "=" * 60)
        print("✅ Sample Data Loading Complete!")
        print("=" * 60)
        print(f"  Tenants:           {len(data_store['tenants'])}")
        print(f"  Users:             {len(data_store['users'])}")
        print(f"  Properties:        {len(data_store['properties'])}")
        print(f"  Guests:            {len(data_store['guests'])}")
        print(f"  Room Types:        {len(data_store['room_types'])}")
        print(f"  Rooms:             {len(data_store['rooms'])}")
        print(f"  Rates:             {len(data_store['rates'])}")
        print(f"  Reservations:      {len(data_store['reservations'])} ★")
        print(f"  Invoices:          {len(data_store['invoices'])}")
        print(f"  Services:          {len(data_store['services'])}")
        print(f"  + Payments, Invoice Items, Housekeeping, etc.")
        print("=" * 60)

        # Verification
        print("\n✓ Running verification...")
        cur.execute("SELECT COUNT(*) FROM reservations;")
        res_count = cur.fetchone()[0]
        print(f"   → Database shows {res_count} reservations")

        cur.execute("SELECT COUNT(*) FROM payments;")
        pay_count = cur.fetchone()[0]
        print(f"   → Database shows {pay_count} payments")

        cur.execute("SELECT COUNT(*) FROM housekeeping_tasks;")
        task_count = cur.fetchone()[0]
        print(f"   → Database shows {task_count} housekeeping tasks")

    except Exception as e:
        print(f"\n❌ Error: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()
        print("\n✓ Database connection closed")


if __name__ == "__main__":
    main()
