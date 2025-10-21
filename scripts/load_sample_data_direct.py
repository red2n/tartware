#!/usr/bin/env python3
"""
Direct Database Sample Data Loader for Tartware PMS
Connects to PostgreSQL and inserts data directly
Date: 2025-10-20
Enhanced with UUID v7 (time-ordered) for optimal performance
"""

import random
import uuid
import time
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

# UUID Generation Strategy
UUID_VERSION = "v7"  # v7 = time-ordered (recommended), v4 = random

# Counter for UUID v7 generation to ensure uniqueness within same millisecond
_uuid_v7_counter = 0
_uuid_v7_last_timestamp = 0

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
    'ota_configurations': [],
    'folios': [],
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


def generate_uuid_v7():
    """
    Generate UUID v7 (time-ordered UUID)

    Format: xxxxxxxx-xxxx-7xxx-yxxx-xxxxxxxxxxxx
    - First 48 bits: Unix timestamp in milliseconds
    - Version bits: 0111 (version 7)
    - Variant bits: 10xx
    - Remaining 74 bits: Random data

    Benefits:
    - Time-ordered for better B-tree index performance
    - Better database cache locality
    - Suitable for time-range queries
    - Reduces index fragmentation
    """
    global _uuid_v7_counter, _uuid_v7_last_timestamp

    # Get current time in milliseconds
    timestamp_ms = int(time.time() * 1000)

    # Handle multiple UUIDs in same millisecond
    if timestamp_ms == _uuid_v7_last_timestamp:
        _uuid_v7_counter += 1
        # Add counter to randomness to maintain uniqueness
        rand_a = _uuid_v7_counter
    else:
        _uuid_v7_counter = 0
        _uuid_v7_last_timestamp = timestamp_ms
        rand_a = random.getrandbits(12)

    # Generate random bits for the rest
    rand_b = random.getrandbits(62)

    # Construct UUID v7
    # timestamp_ms: 48 bits
    # version: 4 bits (0111 for v7)
    # rand_a: 12 bits
    # variant: 2 bits (10)
    # rand_b: 62 bits

    uuid_int = (timestamp_ms << 80) | (7 << 76) | (rand_a << 64) | (2 << 62) | rand_b

    # Convert to UUID format
    return str(uuid.UUID(int=uuid_int))


def generate_uuid_v4():
    """Generate UUID v4 (random UUID) - legacy fallback"""
    return str(uuid.uuid4())


def generate_uuid():
    """Generate UUID based on configured strategy"""
    if UUID_VERSION == "v7":
        return generate_uuid_v7()
    else:
        return generate_uuid_v4()


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
            config_id = generate_uuid()
            cur.execute("""
                INSERT INTO ota_configurations (id, tenant_id, property_id, ota_name, ota_code,
                                               is_active, commission_percentage, api_endpoint, sync_enabled)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                config_id,
                property['tenant_id'],
                property['id'],
                name,
                code,
                active,
                commission,
                f"https://api.{code.lower()}.com/v1",
                True
            ))
            data_store['ota_configurations'].append({
                'id': config_id,
                'tenant_id': property['tenant_id'],
                'property_id': property['id'],
                'channel_code': code
            })
            count += 1

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


def insert_ota_rate_plans(conn):
    """Insert OTA rate plan records - maps OTA channels to existing rates"""
    print(f"\n✓ Inserting OTA Rate Plans...")
    cur = conn.cursor()

    mapping_types = ['STANDARD', 'PROMOTIONAL', 'EXCLUSIVE']

    count = 0
    # Create rate plans for each OTA configuration and rate
    for ota_config in data_store['ota_configurations']:
        # Get rates for this property
        property_rates = [r for r in data_store['rates'] if r['property_id'] == ota_config['property_id']]

        for idx, rate in enumerate(property_rates):
            # Create 1-2 mappings per rate
            for mapping_type in random.sample(mapping_types, random.randint(1, 2)):
                markup = random.choice([0, 5, 10, 15, 20])
                plan_id = f"{ota_config['channel_code']}_RATE{idx+1}_{mapping_type[:3]}"
                plan_name = f"{ota_config['channel_code']} Rate Plan #{idx+1} ({mapping_type})"

                cur.execute("""
                    INSERT INTO ota_rate_plans (id, tenant_id, property_id, ota_configuration_id,
                                               rate_id, ota_rate_plan_id, ota_rate_plan_name,
                                               mapping_type, is_active, markup_percentage,
                                               include_breakfast, include_taxes,
                                               min_length_of_stay, created_by)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    generate_uuid(),
                    ota_config['tenant_id'],
                    ota_config['property_id'],
                    ota_config['id'],
                    rate['id'],
                    plan_id,
                    plan_name,
                    mapping_type,
                    True,
                    markup,
                    random.choice([True, False]),
                    random.choice([True, False]),
                    random.choice([1, 2, 3]),
                    random.choice([u['id'] for u in data_store['users']])
                ))
                count += 1

    conn.commit()
    print(f"   → Inserted {count} OTA rate plans")


def insert_ota_reservations_queue(conn):
    """Insert OTA reservations queue records"""
    print(f"\n✓ Inserting OTA Reservations Queue...")
    cur = conn.cursor()

    statuses = ['PENDING', 'PROCESSING', 'PROCESSED', 'PROCESSED', 'FAILED']

    count = 0
    # Create queue entries for recent reservations
    for reservation in data_store['reservations'][:100]:  # 20% of reservations from OTAs
        # Get a random OTA configuration for this property
        ota_configs = [oc for oc in data_store['ota_configurations'] if oc['property_id'] == reservation['property_id']]
        if not ota_configs:
            continue
        ota_config = random.choice(ota_configs)

        # Generate reservation dates
        check_in = fake.date_between(start_date='-60d', end_date='+90d')
        check_out = check_in + timedelta(days=random.randint(1, 7))

        cur.execute("""
            INSERT INTO ota_reservations_queue (id, tenant_id, property_id, ota_configuration_id,
                                               reservation_id, ota_reservation_id, ota_booking_reference,
                                               status, guest_name, guest_email,
                                               check_in_date, check_out_date,
                                               number_of_guests, total_amount, currency_code,
                                               raw_payload)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            generate_uuid(),
            reservation['tenant_id'],
            reservation['property_id'],
            ota_config['id'],
            reservation['id'],
            f"OTA{fake.random_int(100000, 999999)}",
            f"BKG{fake.random_int(10000, 99999)}",
            random.choice(statuses),
            fake.name(),
            fake.email(),
            check_in,
            check_out,
            random.randint(1, 4),
            reservation['total_amount'],
            'USD',
            json.dumps({"source": ota_config['channel_code'], "booking_data": "sample"})
        ))
        count += 1

    conn.commit()
    print(f"   → Inserted {count} OTA queue entries")


def insert_guest_loyalty_programs(conn):
    """Insert guest loyalty program records"""
    print(f"\n✓ Inserting Guest Loyalty Programs...")
    cur = conn.cursor()

    tiers = ['bronze', 'silver', 'gold', 'platinum', 'diamond']

    count = 0
    # 40% of guests are loyalty members
    for guest in data_store['guests'][:80]:
        points = random.randint(100, 5000)
        tier = random.choice(tiers)
        enrollment_date = fake.date_between(start_date="-2y", end_date="-1m")

        cur.execute("""
            INSERT INTO guest_loyalty_programs (program_id, tenant_id, guest_id, program_name,
                                               membership_number, program_tier, points_balance,
                                               enrollment_date, membership_status, total_stays,
                                               total_nights, is_active)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            generate_uuid(),
            guest['tenant_id'],
            guest['id'],
            'Tartware Rewards',
            f"TR{fake.random_int(100000, 999999)}",
            tier,
            points,
            enrollment_date,
            'active',
            random.randint(1, 20),
            random.randint(5, 100),
            True
        ))
        count += 1

    conn.commit()
    print(f"   → Inserted {count} loyalty memberships")


def insert_guest_documents(conn):
    """Insert guest document records"""
    print(f"\n✓ Inserting Guest Documents...")
    cur = conn.cursor()

    doc_types = ['passport', 'drivers_license', 'national_id', 'visa', 'credit_card']

    count = 0
    # Each guest has 1-2 documents
    for guest in data_store['guests']:
        # Get a property for this guest (use first property of tenant)
        guest_property = next((p for p in data_store['properties'] if p['tenant_id'] == guest['tenant_id']), None)
        if not guest_property:
            continue

        num_docs = random.randint(1, 2)
        for i in range(num_docs):
            doc_type = random.choice(doc_types)
            cur.execute("""
                INSERT INTO guest_documents (document_id, tenant_id, property_id, guest_id,
                                           document_type, document_name, file_path, file_name,
                                           document_number, is_verified)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                guest['tenant_id'],
                guest_property['id'],
                guest['id'],
                doc_type,
                f"{doc_type} - {fake.name()}",
                f"/uploads/guests/{guest['id']}/",
                f"{fake.uuid4()}.pdf",
                fake.bothify('??########'),
                random.choice([True, True, True, False])
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} guest documents")


def insert_guest_notes(conn):
    """Insert guest note records"""
    print(f"\n✓ Inserting Guest Notes...")
    cur = conn.cursor()

    note_types = ['general', 'preference', 'complaint', 'compliment', 'vip', 'feedback']
    priorities = ['low', 'normal', 'high', 'urgent']

    count = 0
    # 60% of guests have notes
    for guest in data_store['guests'][:120]:
        # Get a property for this guest
        guest_property = next((p for p in data_store['properties'] if p['tenant_id'] == guest['tenant_id']), None)
        if not guest_property:
            continue

        num_notes = random.randint(1, 3)
        for i in range(num_notes):
            cur.execute("""
                INSERT INTO guest_notes (note_id, tenant_id, property_id, guest_id,
                                       note_type, note_text, priority, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                guest['tenant_id'],
                guest_property['id'],
                guest['id'],
                random.choice(note_types),
                fake.paragraph(),
                random.choice(priorities),
                random.choice([u['id'] for u in data_store['users']])
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} guest notes")


def insert_maintenance_requests(conn):
    """Insert maintenance request records"""
    print(f"\n✓ Inserting Maintenance Requests...")
    cur = conn.cursor()

    request_types = ['PREVENTIVE', 'CORRECTIVE', 'EMERGENCY', 'INSPECTION']
    categories = ['PLUMBING', 'ELECTRICAL', 'HVAC', 'FURNITURE', 'APPLIANCE', 'OTHER']
    priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
    statuses = ['OPEN', 'OPEN', 'OPEN', 'CANCELLED']  # Use OPEN to avoid complex constraints

    count = 0
    # Generate 2-3 requests per property
    for property in data_store['properties']:
        property_rooms = [r for r in data_store['rooms'] if r['property_id'] == property['id']]
        if not property_rooms:
            continue

        num_requests = random.randint(2, 3)
        for i in range(num_requests):
            room = random.choice(property_rooms)
            cur.execute("""
                INSERT INTO maintenance_requests (request_id, tenant_id, property_id, room_number,
                                                 request_type, issue_category, priority,
                                                 request_status, issue_description,
                                                 reported_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                room['room_number'],
                random.choice(request_types),
                random.choice(categories),
                random.choice(priorities),
                random.choice(statuses),
                fake.sentence(nb_words=10),
                random.choice([u['id'] for u in data_store['users']])
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} maintenance requests")


def insert_incident_reports(conn):
    """Insert incident report records"""
    print(f"\n✓ Inserting Incident Reports...")
    cur = conn.cursor()

    incident_types = ['accident', 'theft', 'damage', 'slip_fall', 'medical_emergency', 'security_breach']
    severities = ['minor', 'moderate', 'serious', 'critical']

    count = 0
    # Generate 1-2 incidents per property
    for property in data_store['properties']:
        num_incidents = random.randint(1, 2)
        for i in range(num_incidents):
            incident_date = fake.date_between(start_date="-60d", end_date="now")
            incident_time = fake.time()
            incident_datetime = datetime.combine(incident_date, datetime.strptime(incident_time, '%H:%M:%S').time())

            user_id = random.choice([u['id'] for u in data_store['users']])
            cur.execute("""
                INSERT INTO incident_reports (incident_id, tenant_id, property_id,
                                             incident_number, incident_title, incident_type,
                                             incident_location, incident_description,
                                             immediate_actions_taken, severity,
                                             incident_date, incident_time, incident_datetime,
                                             discovered_by, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                f"INC{count + 1:06d}",
                fake.sentence(nb_words=5),
                random.choice(incident_types),
                fake.word().title() + " Area",
                fake.paragraph(),
                fake.sentence(nb_words=8),
                random.choice(severities),
                incident_date,
                incident_time,
                incident_datetime,
                user_id,
                user_id
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} incident reports")


def insert_folios(conn):
    """Insert folio records"""
    print(f"\n✓ Inserting Folios...")
    cur = conn.cursor()

    count = 0
    # Create a folio for each reservation
    for reservation in data_store['reservations']:
        folio_id = generate_uuid()
        cur.execute("""
            INSERT INTO folios (folio_id, tenant_id, property_id, reservation_id, guest_id,
                               folio_number, folio_type, folio_status, balance, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            folio_id,
            reservation['tenant_id'],
            reservation['property_id'],
            reservation['id'],
            reservation['guest_id'],
            f"FOL{count + 1:06d}",
            'GUEST',
            'OPEN',  # Use OPEN to avoid complex constraints on CLOSED/SETTLED
            0.00,  # Balance must be 0 when total_charges, total_payments, total_credits are 0
            random.choice([u['id'] for u in data_store['users']])
        ))

        # Store folio for charge postings
        data_store['folios'].append({
            'id': folio_id,
            'reservation_id': reservation['id'],
            'tenant_id': reservation['tenant_id'],
            'property_id': reservation['property_id']
        })
        count += 1

    conn.commit()
    print(f"   → Inserted {count} folios")


def insert_charge_postings(conn):
    """Insert charge posting records"""
    print(f"\n✓ Inserting Charge Postings...")
    cur = conn.cursor()

    charge_codes = ['ROOM', 'TAX', 'SERVICE', 'MINIBAR', 'LAUNDRY', 'RESTAURANT', 'SPA', 'PARKING']

    count = 0
    # Each folio gets 3-6 charges
    for folio in data_store['folios'][:400]:  # 80% of folios
        num_charges = random.randint(3, 6)
        for i in range(num_charges):
            charge_code = random.choice(charge_codes)
            unit_price = round(random.uniform(10, 200), 2)
            quantity = 1
            subtotal = unit_price * quantity
            total_amount = subtotal

            cur.execute("""
                INSERT INTO charge_postings (posting_id, tenant_id, property_id, folio_id,
                                           transaction_type, posting_type, business_date,
                                           charge_code, charge_description,
                                           unit_price, subtotal, total_amount)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                folio['tenant_id'],
                folio['property_id'],
                folio['id'],
                'CHARGE',
                'DEBIT',
                datetime.now().date(),
                charge_code,
                f"{charge_code} Charge - {fake.word()}",
                unit_price,
                subtotal,
                total_amount
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} charge postings")


def insert_night_audit_log(conn):
    """Insert night audit log records"""
    print(f"\n✓ Inserting Night Audit Log...")
    cur = conn.cursor()

    count = 0
    # Generate 30 days of audit logs for each property
    for property in data_store['properties']:
        for days_ago in range(30):
            business_date = datetime.now().date() - timedelta(days=days_ago)
            audit_run_id = generate_uuid()

            # Create a few audit steps for each day
            for step_num in range(1, 4):
                cur.execute("""
                    INSERT INTO night_audit_log (audit_log_id, tenant_id, property_id,
                                               audit_run_id, business_date,
                                               step_number, step_name,
                                               audit_status, step_status, initiated_by)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    generate_uuid(),
                    property['tenant_id'],
                    property['id'],
                    audit_run_id,
                    business_date,
                    step_num,
                    ['Room Status Update', 'Revenue Posting', 'Report Generation'][step_num - 1],
                    'STARTED',  # audit_status - use STARTED to avoid COMPLETED constraints
                    'PENDING',  # step_status - use PENDING to avoid COMPLETED constraints
                    random.choice([u['id'] for u in data_store['users']])
                ))
                count += 1

    conn.commit()
    print(f"   → Inserted {count} audit log entries")


# ============================================================================
# BATCH 4: Revenue Management & Operations (8 new tables)
# ============================================================================

def insert_business_dates(conn):
    """Insert business date records - one OPEN date per property"""
    print(f"\n✓ Inserting Business Dates...")
    cur = conn.cursor()

    count = 0
    # Each property has current business date + 30 days of history
    for property in data_store['properties']:
        # Current business date (OPEN)
        current_date = datetime.now().date()

        cur.execute("""
            INSERT INTO business_dates (
                business_date_id, tenant_id, property_id,
                business_date, system_date, date_status,
                night_audit_status, date_opened_at, date_opened_by,
                arrivals_count, departures_count, stayovers_count,
                total_revenue, allow_new_reservations, allow_check_ins,
                allow_check_outs, allow_postings, is_locked,
                created_at, created_by
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            generate_uuid(),
            property['tenant_id'],
            property['id'],
            current_date,
            current_date,
            'OPEN',
            'PENDING',
            datetime.now() - timedelta(hours=8),
            random.choice(data_store['users'])['id'],
            random.randint(5, 25),
            random.randint(3, 20),
            random.randint(10, 50),
            round(random.uniform(5000, 25000), 2),
            True,
            True,
            True,
            True,
            False,
            datetime.now() - timedelta(hours=8),
            random.choice(data_store['users'])['id']
        ))
        count += 1

        # Historical closed dates (last 30 days)
        for days_ago in range(1, 31):
            hist_date = current_date - timedelta(days=days_ago)
            opened_time = datetime.now() - timedelta(days=days_ago+1, hours=6)
            closed_time = datetime.now() - timedelta(days=days_ago, hours=3)

            cur.execute("""
                INSERT INTO business_dates (
                    business_date_id, tenant_id, property_id,
                    business_date, system_date, date_status,
                    night_audit_status, date_opened_at, date_opened_by,
                    date_closed_at, date_closed_by,
                    night_audit_started_at, night_audit_completed_at,
                    night_audit_started_by, night_audit_completed_by,
                    arrivals_count, departures_count, stayovers_count,
                    total_revenue, total_payments,
                    is_locked, is_reconciled, reconciled_at,
                    created_at, created_by
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                hist_date,
                hist_date,
                'CLOSED',
                'COMPLETED',
                opened_time,
                random.choice(data_store['users'])['id'],
                closed_time,
                random.choice(data_store['users'])['id'],
                closed_time - timedelta(minutes=30),
                closed_time,
                random.choice(data_store['users'])['id'],
                random.choice(data_store['users'])['id'],
                random.randint(3, 20),
                random.randint(5, 25),
                random.randint(10, 60),
                round(random.uniform(3000, 20000), 2),
                round(random.uniform(2500, 18000), 2),
                False,
                True,
                closed_time + timedelta(hours=1),
                opened_time,
                random.choice(data_store['users'])['id']
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} business dates")


def insert_refunds(conn):
    """Insert refund records"""
    print(f"\n✓ Inserting Refunds...")
    cur = conn.cursor()

    refund_types = ['CANCELLATION', 'OVERPAYMENT', 'SERVICE_FAILURE', 'DAMAGE_DEPOSIT']
    statuses = ['COMPLETED', 'COMPLETED', 'COMPLETED', 'PROCESSING', 'APPROVED']
    methods = ['ORIGINAL_PAYMENT_METHOD', 'CREDIT_CARD', 'BANK_TRANSFER']
    reason_categories = ['CANCELLATION', 'NO_SHOW', 'SERVICE_ISSUE', 'OVERCHARGE']

    count = 0
    # Create refunds for ~5% of reservations (25 refunds)
    for payment in random.sample(data_store['reservations'], min(25, len(data_store['reservations']))):
        property = next((p for p in data_store['properties'] if p['id'] == payment['property_id']), None)
        if not property:
            continue

        refund_amount = round(payment['total_amount'] * random.uniform(0.3, 1.0), 2)
        processing_fee = round(refund_amount * 0.03, 2)

        status = random.choice(statuses)
        requested_time = fake.date_time_between(start_date="-60d", end_date="now")
        approved_time = requested_time + timedelta(hours=random.randint(1, 48))
        processed_time = approved_time + timedelta(hours=random.randint(1, 24))
        # COMPLETED status requires completed_at
        completed_time = processed_time + timedelta(hours=random.randint(1, 6)) if status == 'COMPLETED' else None

        cur.execute("""
            INSERT INTO refunds (
                refund_id, tenant_id, property_id,
                refund_number, refund_type, refund_status,
                reservation_id, guest_id,
                refund_amount, processing_fee, net_refund_amount,
                refund_method, reason_category, reason_description,
                requested_at, requested_by,
                approved_at, approved_by,
                processed_at, processed_by,
                completed_at,
                created_at, created_by
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            generate_uuid(),
            property['tenant_id'],
            property['id'],
            f"REF{count + 1:06d}",
            random.choice(refund_types),
            status,
            payment['id'],
            payment['guest_id'],
            refund_amount,
            processing_fee,
            refund_amount - processing_fee,
            random.choice(methods),
            random.choice(reason_categories),
            fake.sentence()[:200],
            requested_time,
            random.choice(data_store['users'])['id'],
            approved_time if status in ['APPROVED', 'PROCESSING', 'COMPLETED'] else None,
            random.choice(data_store['users'])['id'] if status in ['APPROVED', 'PROCESSING', 'COMPLETED'] else None,
            processed_time if status in ['PROCESSING', 'COMPLETED'] else None,
            random.choice(data_store['users'])['id'] if status in ['PROCESSING', 'COMPLETED'] else None,
            completed_time,
            requested_time,
            random.choice(data_store['users'])['id']
        ))
        count += 1

    conn.commit()
    print(f"   → Inserted {count} refunds")


def insert_rate_overrides(conn):
    """Insert rate override records"""
    print(f"\n✓ Inserting Rate Overrides...")
    cur = conn.cursor()

    # Valid reason_category values from schema constraint
    reason_categories = ['VIP', 'MANAGER_DISCRETION', 'SERVICE_RECOVERY', 'LOYALTY_REWARD', 'REPEAT_GUEST', 'NEGOTIATED']
    override_types = ['DISCOUNT', 'PREMIUM', 'FIXED_RATE', 'NEGOTIATED']

    count = 0
    # Create overrides for 10% of reservations (50 overrides)
    for reservation in random.sample(data_store['reservations'], min(50, len(data_store['reservations']))):
        property = next((p for p in data_store['properties'] if p['id'] == reservation['property_id']), None)
        if not property:
            continue

        original_rate = round(random.uniform(100, 400), 2)
        override_rate = round(original_rate * random.uniform(0.6, 0.9), 2)

        property_room_types = [rt['id'] for rt in data_store['room_types'] if rt['property_id'] == property['id']]
        if not property_room_types:
            continue

        reason_cat = random.choice(reason_categories)

        cur.execute("""
            INSERT INTO rate_overrides (
                override_id, tenant_id, property_id,
                reservation_id, room_type_id,
                override_type, original_rate, override_rate,
                adjustment_amount, adjustment_percentage,
                reason_category, reason_description,
                start_date, end_date,
                requested_at, requested_by,
                created_at, created_by,
                approved_by, approved_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            generate_uuid(),
            property['tenant_id'],
            property['id'],
            reservation['id'],
            random.choice(property_room_types),
            random.choice(override_types),  # override_type
            original_rate,
            override_rate,
            override_rate - original_rate,  # adjustment_amount (negative for discount)
            round(((override_rate - original_rate) / original_rate) * 100, 2),  # adjustment_percentage
            reason_cat,  # reason_category (valid value)
            f"Override for {reason_cat.replace('_', ' ').lower()}",  # reason_description
            fake.date_between(start_date="-60d", end_date="now"),
            fake.date_between(start_date="now", end_date="+60d"),
            fake.date_time_between(start_date="-60d", end_date="now"),
            random.choice(data_store['users'])['id'],
            fake.date_time_between(start_date="-60d", end_date="now"),
            random.choice(data_store['users'])['id'],
            random.choice(data_store['users'])['id'],
            fake.date_time_between(start_date="-60d", end_date="now")
        ))
        count += 1

    conn.commit()
    print(f"   → Inserted {count} rate overrides")


def insert_allotments(conn):
    """Insert allotment (room blocks) records"""
    print(f"\n✓ Inserting Allotments...")
    cur = conn.cursor()

    allotment_types = ['GROUP', 'CORPORATE', 'EVENT', 'TOUR']
    statuses = ['DEFINITE', 'DEFINITE', 'TENTATIVE', 'ACTIVE']

    count = 0
    # Create 2-3 allotments per property
    for property in data_store['properties']:
        property_room_types = [rt for rt in data_store['room_types'] if rt['property_id'] == property['id']]
        if not property_room_types:
            continue

        for i in range(random.randint(2, 3)):
            start_date = fake.date_between(start_date="-30d", end_date="+60d")
            end_date = start_date + timedelta(days=random.randint(1, 7))
            room_type = random.choice(property_room_types)

            total_rooms_blocked = random.randint(5, 20)
            rooms_picked_up = random.randint(0, total_rooms_blocked)

            cur.execute("""
                INSERT INTO allotments (
                    allotment_id, tenant_id, property_id,
                    allotment_code, allotment_name, allotment_type,
                    room_type_id, start_date, end_date,
                    total_rooms_blocked, rooms_picked_up, rooms_available,
                    contracted_rate, currency_code,
                    allotment_status, cutoff_date,
                    created_at, created_by
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                f"ALOT{count + 1:05d}",
                f"{fake.company()} Block",
                random.choice(allotment_types),
                room_type['id'],
                start_date,
                end_date,
                total_rooms_blocked,
                rooms_picked_up,
                total_rooms_blocked - rooms_picked_up,
                round(random.uniform(80, 200), 2),
                'USD',
                random.choice(statuses),
                start_date - timedelta(days=7),
                fake.date_time_between(start_date="-90d", end_date="now"),
                random.choice(data_store['users'])['id']
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} allotments")


def insert_ota_inventory_sync(conn):
    """Insert OTA inventory synchronization logs"""
    print(f"\n✓ Inserting OTA Inventory Sync...")
    cur = conn.cursor()

    sync_types = ['full', 'incremental', 'on_demand', 'scheduled', 'real_time']
    sync_directions = ['push', 'push', 'push', 'pull', 'bidirectional']
    statuses = ['completed', 'completed', 'completed', 'failed', 'partial']

    count = 0
    # Create sync logs for each OTA configuration (daily for last 30 days)
    for ota_config in data_store.get('ota_configurations', []):
        for days_ago in range(30):
            sync_time = datetime.now() - timedelta(days=days_ago, hours=random.randint(0, 23))

            cur.execute("""
                INSERT INTO ota_inventory_sync (
                    sync_id, tenant_id, property_id,
                    ota_config_id, channel_name, sync_type, sync_direction, sync_status,
                    rooms_synced, rates_synced,
                    sync_started_at, sync_completed_at,
                    created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                ota_config['tenant_id'],
                ota_config['property_id'],
                ota_config['id'],
                ota_config.get('channel_name', 'BOOKING.COM'),
                random.choice(sync_types),
                random.choice(sync_directions),
                random.choice(statuses),
                random.randint(10, 50),
                random.randint(20, 100),
                sync_time,
                sync_time + timedelta(seconds=random.randint(5, 120)),
                sync_time
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} OTA sync logs")


def insert_channel_rate_parity(conn):
    """Insert channel rate parity monitoring records"""
    print(f"\n✓ Inserting Channel Rate Parity...")
    cur = conn.cursor()

    parity_statuses = ['compliant', 'compliant', 'compliant', 'minor_variance', 'major_variance']

    count = 0
    # Monitor rate parity for each room type across channels (daily for last 7 days)
    for property in data_store['properties']:
        property_room_types = [rt for rt in data_store['room_types'] if rt['property_id'] == property['id']]

        for days_ago in range(7):
            check_date = datetime.now().date() - timedelta(days=days_ago)

            for room_type in property_room_types:
                base_rate = round(random.uniform(100, 300), 2)

                # Create channel rates JSONB
                channel_rates = {
                    "booking.com": round(base_rate * random.uniform(0.95, 1.05), 2),
                    "expedia": round(base_rate * random.uniform(0.95, 1.05), 2),
                    "airbnb": round(base_rate * random.uniform(0.95, 1.05), 2)
                }

                parity_status = random.choice(parity_statuses)
                is_compliant = parity_status == 'compliant'

                cur.execute("""
                    INSERT INTO channel_rate_parity (
                        parity_id, tenant_id, property_id,
                        room_type_id, check_date,
                        pms_rate, pms_currency, channel_rates,
                        parity_status, is_parity_maintained,
                        check_initiated_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    generate_uuid(),
                    property['tenant_id'],
                    property['id'],
                    room_type['id'],
                    check_date,
                    base_rate,
                    'USD',
                    json.dumps(channel_rates),
                    parity_status,
                    is_compliant,
                    datetime.now() - timedelta(days=days_ago, hours=random.randint(0, 23))
                ))
                count += 1

    conn.commit()
    print(f"   → Inserted {count} rate parity checks")


def insert_channel_commission_rules(conn):
    """Insert channel commission rules"""
    print(f"\n✓ Inserting Channel Commission Rules...")
    cur = conn.cursor()

    rule_types = ['standard', 'tiered', 'promotional', 'performance_based']
    commission_models = ['percentage', 'flat_fee', 'per_room_night', 'hybrid']

    count = 0
    # Create commission rules for each OTA configuration
    for ota_config in data_store.get('ota_configurations', []):
        cur.execute("""
            INSERT INTO channel_commission_rules (
                rule_id, tenant_id, property_id,
                channel_name, ota_config_id, rule_name,
                rule_type, commission_model, base_commission_percent,
                is_active, effective_from,
                created_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            generate_uuid(),
            ota_config['tenant_id'],
            ota_config['property_id'],
            ota_config.get('channel_name', 'BOOKING.COM'),
            ota_config['id'],
            f"{ota_config.get('channel_name', 'OTA')} Standard Commission",
            random.choice(rule_types),
            random.choice(commission_models),
            round(random.uniform(12, 20), 2),
            True,
            fake.date_between(start_date="-1y", end_date="-30d"),
            fake.date_time_between(start_date="-1y", end_date="-30d")
        ))
        count += 1

    conn.commit()
    print(f"   → Inserted {count} commission rules")


def insert_automated_messages(conn):
    """Insert automated message configurations"""
    print(f"\n✓ Inserting Automated Messages...")
    cur = conn.cursor()

    count = 0
    # Create automated message configurations for each property
    for property in data_store['properties']:
        # Pre-arrival message
        cur.execute("""
            INSERT INTO automated_messages (
                message_id, tenant_id, property_id,
                message_name, trigger_type, message_channel,
                is_active, send_timing, delay_hours,
                created_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            generate_uuid(),
            property['tenant_id'],
            property['id'],
            "Pre-Arrival Welcome",
            'pre_arrival',
            'email',
            True,
            'delayed',
            48,
            fake.date_time_between(start_date="-90d", end_date="-30d")
        ))
        count += 1

        # Check-in reminder
        cur.execute("""
            INSERT INTO automated_messages (
                message_id, tenant_id, property_id,
                message_name, trigger_type, message_channel,
                is_active, send_timing, send_before_event_hours,
                created_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            generate_uuid(),
            property['tenant_id'],
            property['id'],
            "Check-In Reminder",
            'checkin_reminder',
            'sms',
            True,
            'scheduled',
            4,
            fake.date_time_between(start_date="-90d", end_date="-30d")
        ))
        count += 1

    conn.commit()
    print(f"   → Inserted {count} automated message configs")


# ============================================================================
# BATCH 5: Revenue Management & Pricing (8 new tables)
# ============================================================================

def insert_revenue_forecasts(conn):
    """Insert revenue forecast records"""
    print(f"\n✓ Inserting Revenue Forecasts...")
    cur = conn.cursor()

    forecast_periods = ['daily', 'weekly', 'monthly', 'quarterly']
    forecast_types = ['revenue', 'occupancy', 'adr', 'revpar']

    count = 0
    # Generate forecasts for each property (90 days forward)
    for property in data_store['properties']:
        for days_ahead in range(0, 90, 7):  # Weekly forecasts
            forecast_date = datetime.now().date() + timedelta(days=days_ahead)
            period_start = forecast_date
            period_end = forecast_date + timedelta(days=6)

            forecasted_revenue = round(random.uniform(10000, 50000), 2)

            cur.execute("""
                INSERT INTO revenue_forecasts (
                    forecast_id, tenant_id, property_id,
                    forecast_date, forecast_period, period_start_date, period_end_date,
                    forecast_type, forecasted_value,
                    forecasted_rooms_sold, forecasted_adr, forecasted_occupancy_percent,
                    total_revenue_forecast, confidence_level,
                    created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                forecast_date,
                random.choice(forecast_periods),
                period_start,
                period_end,
                random.choice(forecast_types),
                forecasted_revenue,
                random.randint(15, 30),
                round(random.uniform(100, 300), 2),
                round(random.uniform(60, 95), 2),
                forecasted_revenue,
                round(random.uniform(70, 95), 2),
                fake.date_time_between(start_date="-30d", end_date="now")
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} revenue forecasts")


def insert_competitor_rates(conn):
    """Insert competitor rate monitoring records"""
    print(f"\n✓ Inserting Competitor Rates...")
    cur = conn.cursor()

    competitors = ['Hilton Downtown', 'Marriott Center', 'Holiday Inn Express', 'Best Western']
    source_channels = ['booking.com', 'expedia.com', 'direct_website', 'google_hotels']

    count = 0
    # Monitor competitor rates for each property (last 30 days)
    for property in data_store['properties']:
        property_room_types = [rt for rt in data_store['room_types'] if rt['property_id'] == property['id']]

        for days_ago in range(30):
            check_date = datetime.now().date() - timedelta(days=days_ago)
            stay_date = check_date + timedelta(days=random.randint(0, 7))

            for competitor in competitors[:2]:  # 2 competitors per property
                for room_type in property_room_types[:2]:  # 2 room types
                    our_rate = round(random.uniform(100, 300), 2)
                    comp_rate = round(our_rate * random.uniform(0.85, 1.15), 2)

                    cur.execute("""
                        INSERT INTO competitor_rates (
                            rate_id, tenant_id, property_id,
                            competitor_property_name, check_date, stay_date,
                            competitor_rate, currency, source_channel,
                            our_property_rate, our_property_room_type_id,
                            rate_difference, rate_difference_percent,
                            scrape_timestamp
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, (
                        generate_uuid(),
                        property['tenant_id'],
                        property['id'],
                        competitor,
                        check_date,
                        stay_date,
                        comp_rate,
                        'USD',
                        random.choice(source_channels),
                        our_rate,
                        room_type['id'],
                        comp_rate - our_rate,
                        round(((comp_rate - our_rate) / our_rate) * 100, 2),
                        datetime.now() - timedelta(days=days_ago, hours=random.randint(0, 23))
                    ))
                    count += 1

    conn.commit()
    print(f"   → Inserted {count} competitor rate records")


def insert_demand_calendar(conn):
    """Insert demand calendar records"""
    print(f"\n✓ Inserting Demand Calendar...")
    cur = conn.cursor()

    demand_levels = ['very_low', 'low', 'moderate', 'high', 'very_high']
    days_of_week = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

    count = 0
    # Create demand calendar for each property (90 days forward)
    for property in data_store['properties']:
        # Get total rooms for this property
        total_rooms = sum(1 for r in data_store['rooms'] if r['property_id'] == property['id'])

        for days_ahead in range(90):
            calendar_date = datetime.now().date() + timedelta(days=days_ahead)

            # Higher demand on weekends
            is_weekend = calendar_date.weekday() >= 5
            demand = random.choice(['high', 'very_high']) if is_weekend else random.choice(demand_levels)
            day_name = days_of_week[calendar_date.weekday()]

            cur.execute("""
                INSERT INTO demand_calendar (
                    demand_id, tenant_id, property_id,
                    calendar_date, day_of_week, demand_level,
                    rooms_available, is_weekend, is_special_period,
                    special_period_name
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                calendar_date,
                day_name,
                demand,
                total_rooms,
                is_weekend,
                random.random() < 0.1,  # 10% are special periods
                fake.catch_phrase() if random.random() < 0.1 else None
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} demand calendar entries")


def insert_pricing_rules(conn):
    """Insert pricing rule records"""
    print(f"\n✓ Inserting Pricing Rules...")
    cur = conn.cursor()

    rule_types = ['occupancy_based', 'demand_based', 'day_of_week', 'seasonal',
                  'length_of_stay', 'advance_purchase', 'last_minute']
    adjustment_types = ['percentage_increase', 'percentage_decrease',
                        'fixed_amount_increase', 'fixed_amount_decrease']

    count = 0
    # Create 3-5 pricing rules per property
    for property in data_store['properties']:
        property_room_types = [rt for rt in data_store['room_types'] if rt['property_id'] == property['id']]

        for i in range(random.randint(3, 5)):
            rule_type = random.choice(rule_types)
            adj_type = random.choice(adjustment_types)

            # Adjustment value depends on type
            if 'percentage' in adj_type:
                adj_value = round(random.uniform(5, 25), 2)  # 5-25%
            else:
                adj_value = round(random.uniform(10, 50), 2)  # $10-50

            cur.execute("""
                INSERT INTO pricing_rules (
                    rule_id, tenant_id, property_id,
                    rule_name, rule_type, is_active,
                    effective_from, effective_until,
                    conditions, adjustment_type, adjustment_value
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                f"{rule_type.replace('_', ' ').title()} Rule #{i+1}",
                rule_type,
                True,
                fake.date_between(start_date="-30d", end_date="now"),
                fake.date_between(start_date="+30d", end_date="+365d"),
                json.dumps({"created": "sample_data"}),
                adj_type,
                adj_value
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} pricing rules")


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


def insert_tax_configurations(conn):
    """Insert tax configuration records"""
    print(f"\n✓ Inserting Tax Configurations...")
    cur = conn.cursor()

    tax_types = ['sales_tax', 'occupancy_tax', 'city_tax', 'tourism_tax', 'vat']

    count = 0
    # Create 3-5 tax configs per property
    for property in data_store['properties']:
        for tax_type in random.sample(tax_types, random.randint(3, 5)):
            # Make tax_code unique by including property prefix
            tax_code = f"{property['name'][:3].upper()}_{tax_type[:5].upper()}_{random.randint(1000,9999)}"

            cur.execute("""
                INSERT INTO tax_configurations (
                    tax_config_id, tenant_id, property_id,
                    tax_name, tax_code, tax_type,
                    tax_rate, country_code, effective_from
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                f"{tax_type.replace('_', ' ').title()}",
                tax_code,
                tax_type,
                round(random.uniform(5, 15), 6),  # 6 decimal places
                'USA',
                fake.date_between(start_date="-1y", end_date="-6m")
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} tax configurations")


def insert_deposit_schedules(conn):
    """Insert deposit schedule records"""
    print(f"\n✓ Inserting Deposit Schedules...")
    cur = conn.cursor()

    schedule_types = ['DEPOSIT', 'INSTALLMENT', 'PREPAYMENT', 'SECURITY_DEPOSIT']
    statuses = ['PENDING', 'PAID', 'PAID', 'OVERDUE']

    count = 0
    # Create deposit schedules for 20% of reservations
    for reservation in random.sample(data_store['reservations'], min(100, len(data_store['reservations']))):
        property = next((p for p in data_store['properties'] if p['id'] == reservation['property_id']), None)
        if not property:
            continue

        schedule_type = random.choice(schedule_types)
        total_amount = reservation['total_amount']
        amount_due = round(total_amount * random.uniform(0.2, 0.5), 2)
        amount_paid = amount_due if random.random() < 0.6 else 0
        status = 'PAID' if amount_paid >= amount_due else random.choice(statuses)

        cur.execute("""
            INSERT INTO deposit_schedules (
                schedule_id, tenant_id, property_id,
                reservation_id, schedule_type,
                amount_due, amount_paid, amount_remaining,
                due_date, schedule_status, paid_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            generate_uuid(),
            property['tenant_id'],
            property['id'],
            reservation['id'],
            schedule_type,
            amount_due,
            amount_paid,
            amount_due - amount_paid,
            fake.date_between(start_date="-30d", end_date="+30d"),
            status,
            fake.date_time_between(start_date="-30d", end_date="now") if status == 'PAID' else None
        ))
        count += 1

    conn.commit()
    print(f"   → Inserted {count} deposit schedules")


def insert_cashier_sessions(conn):
    """Insert cashier session records"""
    print(f"\n✓ Inserting Cashier Sessions...")
    cur = conn.cursor()

    count = 0
    # Create 2 sessions per property (morning and evening shifts)
    for property in data_store['properties']:
        for shift_type in ['morning', 'evening']:
            business_date = datetime.now().date() - timedelta(days=random.randint(0, 7))
            opened_at = datetime.combine(business_date, datetime.strptime('08:00' if shift_type == 'morning' else '16:00', '%H:%M').time())
            closed_at = opened_at + timedelta(hours=8)

            opening_float = 500.00
            total_cash = round(random.uniform(200, 1500), 2)

            cur.execute("""
                INSERT INTO cashier_sessions (
                    session_id, tenant_id, property_id,
                    session_number, cashier_id,
                    business_date, shift_type,
                    opened_at, closed_at, session_status,
                    opening_float_declared, total_cash_received,
                    total_card_received, total_revenue
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                f"CS{count+1:06d}",  # Use global counter for unique session numbers
                random.choice(data_store['users'])['id'],
                business_date,
                shift_type,
                opened_at,
                closed_at,
                'closed',
                opening_float,
                total_cash,
                round(random.uniform(300, 1200), 2),
                total_cash + round(random.uniform(300, 1200), 2)
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} cashier sessions")


# ============================================================================
# BATCH 6: Analytics & Reporting (Additional Tables)
# ============================================================================

def insert_analytics_metrics(conn):
    """Insert analytics metrics records"""
    print(f"\n✓ Inserting Analytics Metrics...")
    cur = conn.cursor()

    # Valid enum values for metric_type
    metric_types = ['OCCUPANCY_RATE', 'ADR', 'REVPAR', 'TOTAL_REVENUE', 'BOOKING_COUNT', 'CANCELLATION_RATE', 'LENGTH_OF_STAY', 'LEAD_TIME']
    time_granularities = ['DAILY', 'WEEKLY', 'MONTHLY']
    count = 0

    for property in data_store['properties']:
        for days_ago in range(30):
            metric_date = datetime.now().date() - timedelta(days=days_ago)

            for metric_type in random.sample(metric_types, 2):
                # Different value ranges based on metric type
                if metric_type in ['ADR', 'REVPAR']:
                    metric_value = round(random.uniform(100, 500), 2)
                elif metric_type == 'TOTAL_REVENUE':
                    metric_value = round(random.uniform(5000, 25000), 2)
                elif metric_type in ['OCCUPANCY_RATE', 'CANCELLATION_RATE']:
                    metric_value = round(random.uniform(50, 95), 2)
                elif metric_type in ['BOOKING_COUNT']:
                    metric_value = round(random.uniform(10, 100), 0)
                elif metric_type in ['LENGTH_OF_STAY', 'LEAD_TIME']:
                    metric_value = round(random.uniform(1, 10), 1)
                else:
                    metric_value = round(random.uniform(100, 1000), 2)

                cur.execute("""
                    INSERT INTO analytics_metrics (
                        id, tenant_id, property_id,
                        metric_type, metric_name, metric_code,
                        metric_date, time_granularity, metric_value,
                        status, created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    generate_uuid(),
                    property['tenant_id'],
                    property['id'],
                    metric_type,
                    f"{metric_type} Daily",
                    f"MTR_{metric_type}",
                    metric_date,
                    'DAILY',
                    metric_value,
                    'COMPLETED',
                    fake.date_time_between(start_date="-30d", end_date="now")
                ))
                count += 1

    conn.commit()
    print(f"   → Inserted {count} analytics metrics")


def insert_staff_schedules(conn):
    """Insert staff schedule records"""
    print(f"\n✓ Inserting Staff Schedules...")
    cur = conn.cursor()

    shifts = ['morning', 'afternoon', 'evening', 'night']
    departments = ['Front Desk', 'Housekeeping', 'Maintenance', 'Restaurant', 'Management']
    days_of_week = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    count = 0

    for property in data_store['properties']:
        property_users = [u for u in data_store['users'][:10]]

        for days_ahead in range(7):
            schedule_date = datetime.now().date() + timedelta(days=days_ahead)
            day_of_week = days_of_week[schedule_date.weekday()]

            for user in property_users:
                if random.random() < 0.7:
                    shift = random.choice(shifts)
                    # Set shift times that don't go over 24 hours
                    if shift == 'morning':
                        start_hour, end_hour = 6, 14
                    elif shift == 'afternoon':
                        start_hour, end_hour = 14, 22
                    elif shift == 'evening':
                        start_hour, end_hour = 18, 23
                    else:  # night shift
                        start_hour, end_hour = 22, 6  # crosses midnight, we'll handle this

                    scheduled_hours = 8.0

                    cur.execute("""
                        INSERT INTO staff_schedules (
                            schedule_id, tenant_id, property_id,
                            user_id, staff_name, department, shift_type,
                            schedule_date, day_of_week,
                            scheduled_start_time, scheduled_end_time,
                            scheduled_hours, created_at
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, (
                        generate_uuid(),
                        property['tenant_id'],
                        property['id'],
                        user['id'],
                        user['name'],
                        random.choice(departments),
                        shift,
                        schedule_date,
                        day_of_week,
                        f"{start_hour:02d}:00:00",
                        f"{end_hour:02d}:00:00" if end_hour <= 23 else "06:00:00",
                        scheduled_hours,
                        fake.date_time_between(start_date="-7d", end_date="now")
                    ))
                    count += 1

    conn.commit()
    print(f"   → Inserted {count} staff schedules")


def insert_marketing_campaigns(conn):
    """Insert marketing campaign records"""
    print(f"\n✓ Inserting Marketing Campaigns...")
    cur = conn.cursor()

    campaign_types = ['email', 'sms', 'social_media', 'display_ads', 'search_ads', 'direct_mail',
                      'event', 'referral', 'loyalty', 'seasonal', 'promotional']
    statuses = ['active', 'active', 'paused', 'completed', 'draft']
    count = 0

    for property in data_store['properties']:
        for i in range(random.randint(3, 6)):
            start_date = fake.date_between(start_date="-90d", end_date="-30d")
            end_date = start_date + timedelta(days=random.randint(14, 60))

            cur.execute("""
                INSERT INTO marketing_campaigns (
                    campaign_id, tenant_id, property_id,
                    campaign_code, campaign_name, campaign_type, campaign_status,
                    start_date, end_date, budget_amount,
                    actual_spend, created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                f"CAMP{count + 1:05d}",
                f"{fake.catch_phrase()} Campaign",
                random.choice(campaign_types),
                random.choice(statuses),
                start_date,
                end_date,
                round(random.uniform(1000, 10000), 2),
                round(random.uniform(500, 9000), 2),
                fake.date_time_between(start_date="-90d", end_date="-30d")
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} marketing campaigns")


def insert_vendor_contracts(conn):
    """Insert vendor contract records"""
    print(f"\n✓ Inserting Vendor Contracts...")
    cur = conn.cursor()

    contract_types = ['service', 'supply', 'maintenance', 'lease', 'license', 'consulting', 'subscription']
    statuses = ['active', 'active', 'active', 'approved', 'expired', 'renewed']
    count = 0

    for property in data_store['properties']:
        for i in range(random.randint(5, 10)):
            start_date = fake.date_between(start_date="-2y", end_date="-6m")
            end_date = start_date + timedelta(days=random.randint(180, 730))
            contract_type = random.choice(contract_types)
            vendor_name = fake.company()

            # Generate service description based on contract type
            service_descriptions = {
                'supply': f"Supply of {vendor_name} products and materials",
                'service': f"Professional services provided by {vendor_name}",
                'maintenance': f"Ongoing maintenance services by {vendor_name}",
                'lease': f"Lease agreement with {vendor_name}",
                'license': f"Software/licensing agreement with {vendor_name}",
                'consulting': f"Consulting services provided by {vendor_name}",
                'subscription': f"Subscription services from {vendor_name}"
            }
            service_description = service_descriptions.get(contract_type, f"Services provided by {vendor_name}")

            cur.execute("""
                INSERT INTO vendor_contracts (
                    contract_id, tenant_id, property_id,
                    contract_number, contract_name, vendor_name, contract_type,
                    start_date, end_date, contract_status,
                    contract_value, currency, payment_terms, service_description, created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                f"VND{count + 1:06d}",
                f"{contract_type.replace('_', ' ').title()} Contract - {vendor_name[:30]}",
                vendor_name,
                contract_type,
                start_date,
                end_date,
                random.choice(statuses),
                round(random.uniform(5000, 100000), 2),
                'USD',
                random.choice(['net_30', 'net_60', 'net_90', 'monthly', 'quarterly', 'annual']),
                service_description,
                fake.date_time_between(start_date="-2y", end_date="-6m")
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} vendor contracts")


def insert_revenue_goals(conn):
    """Insert revenue goal records"""
    print(f"\n✓ Inserting Revenue Goals...")
    cur = conn.cursor()

    goal_types = ['total_revenue', 'room_revenue', 'fb_revenue', 'occupancy', 'adr', 'revpar', 'rooms_sold']
    count = 0

    for property in data_store['properties']:
        for months_ahead in range(12):
            start_date = datetime.now().date() + timedelta(days=months_ahead * 30)
            end_date = start_date + timedelta(days=29)

            cur.execute("""
                INSERT INTO revenue_goals (
                    goal_id, tenant_id, property_id,
                    goal_period, period_start_date, period_end_date,
                    goal_type, goal_amount, occupancy_goal_percent,
                    adr_goal, revpar_goal, actual_amount, created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                'monthly',
                start_date,
                end_date,
                random.choice(goal_types),
                round(random.uniform(50000, 200000), 2),
                round(random.uniform(70, 95), 2),
                round(random.uniform(150, 350), 2),
                round(random.uniform(100, 300), 2),
                round(random.uniform(45000, 195000), 2) if months_ahead < 2 else 0.00,
                fake.date_time_between(start_date="-90d", end_date="-30d")
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} revenue goals")


def insert_lost_and_found(conn):
    """Insert lost and found records"""
    print(f"\n✓ Inserting Lost and Found...")
    cur = conn.cursor()

    item_categories = ['electronics', 'clothing', 'jewelry', 'documents', 'accessories', 'bags', 'wallets', 'phones', 'watches', 'glasses', 'other']
    statuses = ['registered', 'stored', 'claimed', 'returned', 'pending_claim', 'donated', 'disposed']
    count = 0

    for property in data_store['properties']:
        property_rooms = [r for r in data_store['rooms'] if r['property_id'] == property['id']][:20]

        for i in range(random.randint(10, 20)):
            found_date = fake.date_between(start_date="-60d", end_date="now")
            category = random.choice(item_categories)

            # Generate item name based on category
            item_names = {
                'electronics': ['Phone', 'Laptop', 'Tablet', 'Charger', 'Headphones', 'Camera'],
                'clothing': ['Jacket', 'Shirt', 'Pants', 'Shoes', 'Hat', 'Scarf'],
                'jewelry': ['Ring', 'Necklace', 'Bracelet', 'Watch', 'Earrings'],
                'documents': ['Passport', 'ID Card', 'Wallet', 'Credit Card', 'Driver License'],
                'accessories': ['Bag', 'Sunglasses', 'Umbrella', 'Keys', 'Book'],
                'bags': ['Backpack', 'Handbag', 'Suitcase', 'Briefcase'],
                'wallets': ['Wallet', 'Purse', 'Card Holder'],
                'phones': ['iPhone', 'Samsung Phone', 'Mobile Phone'],
                'watches': ['Watch', 'Smart Watch'],
                'glasses': ['Sunglasses', 'Reading Glasses', 'Prescription Glasses'],
                'other': ['Item', 'Belonging', 'Object', 'Article']
            }
            item_name = random.choice(item_names.get(category, ['Item']))

            cur.execute("""
                INSERT INTO lost_and_found (
                    item_id, tenant_id, property_id,
                    room_id, item_name, item_description, item_category,
                    found_date, found_location, item_status,
                    found_by, created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                random.choice(property_rooms)['id'] if property_rooms else None,
                item_name,
                fake.sentence()[:200],
                category,
                found_date,
                random.choice(['Room', 'Lobby', 'Restaurant', 'Pool', 'Gym', 'Parking']),
                random.choice(statuses),
                random.choice(data_store['users'])['id'],
                fake.date_time_between(start_date="-60d", end_date="now")
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} lost and found items")


def insert_gdpr_consent_logs(conn):
    """Insert GDPR consent log records"""
    print(f"\n✓ Inserting GDPR Consent Logs...")
    cur = conn.cursor()

    consent_types = ['marketing_email', 'marketing_sms', 'data_processing', 'third_party_sharing', 'profiling', 'analytics']
    consent_methods = ['online_form', 'email_link', 'checkbox', 'verbal', 'written', 'opt_in', 'explicit']

    purpose_descriptions = {
        'marketing_email': 'To send promotional emails and newsletters about special offers and updates',
        'marketing_sms': 'To send promotional text messages about exclusive deals and events',
        'data_processing': 'To process personal data for booking and service delivery purposes',
        'third_party_sharing': 'To share data with trusted partners for service fulfillment',
        'profiling': 'To analyze preferences and provide personalized recommendations',
        'analytics': 'To analyze usage patterns and improve our services'
    }

    count = 0

    for guest in data_store['guests']:
        for consent_type in random.sample(consent_types, random.randint(2, 4)):
            consented = random.choice([True, True, True, False])

            cur.execute("""
                INSERT INTO gdpr_consent_logs (
                    consent_id, tenant_id, subject_type, subject_id,
                    subject_email, consent_type, purpose_description, consent_given, consent_date,
                    consent_method, ip_address, created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                guest['tenant_id'],
                'guest',
                guest['id'],
                guest['email'],
                consent_type,
                purpose_descriptions.get(consent_type, 'General data processing consent'),
                consented,
                fake.date_time_between(start_date="-2y", end_date="now"),
                random.choice(consent_methods),
                fake.ipv4(),
                fake.date_time_between(start_date="-2y", end_date="now")
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} GDPR consent logs")


def insert_police_reports(conn):
    """Insert police report records"""
    print(f"\n✓ Inserting Police Reports...")
    cur = conn.cursor()

    incident_types = ['theft', 'vandalism', 'assault', 'trespassing', 'noise_complaint', 'vehicle_incident', 'suspicious_activity', 'fraud']
    count = 0

    for property in data_store['properties']:
        for i in range(random.randint(1, 5)):
            incident_date = fake.date_between(start_date="-1y", end_date="now")
            reported_date = incident_date + timedelta(days=random.randint(0, 2))

            cur.execute("""
                INSERT INTO police_reports (
                    report_id, tenant_id, property_id,
                    report_number, incident_type, incident_date, reported_date,
                    incident_description, agency_name, responding_officer_name,
                    responding_officer_badge, report_status, created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                f"POL{fake.random_number(digits=8)}",
                random.choice(incident_types),
                incident_date,
                reported_date,
                fake.text(max_nb_chars=500),
                f"{fake.city()} Police Department",
                fake.name(),
                f"#{fake.random_number(digits=5)}",
                random.choice(['filed', 'under_investigation', 'closed', 'pending']),
                fake.date_time_between(start_date=reported_date, end_date="now")
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} police reports")


def insert_contract_agreements(conn):
    """Insert contract agreement records"""
    print(f"\n✓ Inserting Contract Agreements...")
    cur = conn.cursor()

    agreement_types = ['service', 'lease', 'employment', 'vendor', 'partnership', 'license', 'nda', 'corporate', 'management']
    count = 0

    for property in data_store['properties']:
        for i in range(random.randint(3, 8)):
            start_date = fake.date_between(start_date="-1y", end_date="now")
            end_date = start_date + timedelta(days=random.randint(180, 730))
            agreement_type = random.choice(agreement_types)
            party_b = fake.company()

            cur.execute("""
                INSERT INTO contract_agreements (
                    agreement_id, tenant_id, property_id,
                    agreement_number, agreement_title, agreement_type,
                    party_a_name, party_b_name,
                    effective_date, expiry_date, agreement_status,
                    contract_value, agreement_description, created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                f"AGR{fake.random_number(digits=6)}",
                f"{agreement_type.replace('_', ' ').title()} with {party_b}",
                agreement_type,
                property['name'],
                party_b,
                start_date,
                end_date,
                random.choice(['active', 'pending_review', 'pending_signature', 'expired', 'terminated', 'renewed']),
                round(random.uniform(10000, 500000), 2),
                fake.text(max_nb_chars=300),
                fake.date_time_between(start_date="-1y", end_date="now")
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} contract agreements")


def insert_insurance_claims(conn):
    """Insert insurance claim records"""
    print(f"\n✓ Inserting Insurance Claims...")
    cur = conn.cursor()

    claim_types = ['property_damage', 'liability', 'workers_comp', 'business_interruption', 'theft', 'fire', 'flood', 'equipment_breakdown', 'cyber', 'guest_injury', 'employee_injury', 'vehicle', 'other']
    count = 0

    for property in data_store['properties']:
        for i in range(random.randint(1, 4)):
            incident_date = fake.date_between(start_date="-1y", end_date="now")
            claim_filed_date = incident_date + timedelta(days=random.randint(1, 7))

            cur.execute("""
                INSERT INTO insurance_claims (
                    claim_id, tenant_id, property_id,
                    claim_number, claim_type, incident_date, incident_description,
                    claim_amount, claim_filed_date, claim_status,
                    insurance_company, policy_number, created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                f"CLM{fake.random_number(digits=8)}",
                random.choice(claim_types),
                incident_date,
                fake.text(max_nb_chars=500),
                round(random.uniform(1000, 100000), 2),
                claim_filed_date,
                random.choice(['draft', 'submitted', 'under_review', 'investigating', 'approved', 'denied', 'settled', 'closed']),
                fake.company(),
                f"POL{fake.random_number(digits=10)}",
                fake.date_time_between(start_date=claim_filed_date, end_date="now")
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} insurance claims")


def insert_campaign_segments(conn):
    """Insert campaign segment records"""
    print(f"\n✓ Inserting Campaign Segments...")
    cur = conn.cursor()

    segment_types = ['demographic', 'behavioral', 'psychographic', 'geographic', 'transactional', 'loyalty', 'engagement', 'lifecycle', 'predictive', 'custom']
    booking_frequencies = ['first_time', 'occasional', 'regular', 'frequent', 'vip']
    engagement_levels = ['not_engaged', 'low', 'medium', 'high', 'very_high']
    lifecycle_stages = ['prospect', 'new_customer', 'active', 'at_risk', 'dormant', 'lost', 'won_back']
    count = 0

    # Get properties
    for property in data_store['properties']:
        for i in range(random.randint(2, 5)):
            segment_code = f"SEG-{property['name'][:3].upper()}-{random.randint(1000, 9999)}"
            segment_name = f"{random.choice(['High Value', 'Frequent', 'New', 'VIP', 'Returning', 'Business', 'Leisure'])} {random.choice(['Guests', 'Customers', 'Visitors', 'Travelers'])}"

            cur.execute("""
                INSERT INTO campaign_segments (
                    segment_id, tenant_id, property_id,
                    segment_code, segment_name, segment_type,
                    criteria_definition, booking_frequency, engagement_level,
                    lifecycle_stage, member_count, is_active,
                    created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                segment_code,
                segment_name,
                random.choice(segment_types),
                json.dumps({
                    'age_range': f"{random.randint(20, 50)}-{random.randint(51, 70)}",
                    'location': fake.city(),
                    'min_bookings': random.randint(1, 10)
                }),
                random.choice(booking_frequencies),
                random.choice(engagement_levels),
                random.choice(lifecycle_stages),
                random.randint(50, 5000),
                random.choice([True, False]),
                fake.date_time_between(start_date="-6m", end_date="now")
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} campaign segments")


def insert_referral_tracking(conn):
    """Insert referral tracking records"""
    print(f"\n✓ Inserting Referral Tracking...")
    cur = conn.cursor()

    referral_statuses = ['pending', 'clicked', 'registered', 'qualified', 'converted', 'rewarded', 'expired']
    referrer_types = ['guest', 'staff', 'affiliate', 'influencer', 'partner', 'other']
    count = 0

    for property in data_store['properties']:
        property_guests = [g for g in data_store['guests'] if g['tenant_id'] == property['tenant_id']][:30]

        for i in range(random.randint(10, 25)):
            if len(property_guests) < 2:
                continue

            referrer = random.choice(property_guests)
            status = random.choice(referral_statuses)
            referred_at = fake.date_time_between(start_date="-6m", end_date="now")

            cur.execute("""
                INSERT INTO referral_tracking (
                    referral_id, tenant_id, property_id,
                    referral_code, referrer_type, referrer_id,
                    referrer_name, referrer_email,
                    referral_status, converted,
                    referrer_reward_amount, referee_reward_amount,
                    referred_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                f"REF-{fake.random_number(digits=8)}",
                random.choice(referrer_types),
                referrer['id'],
                referrer['name'],
                referrer['email'],
                status,
                status == 'converted',
                round(random.uniform(10, 100), 2) if status in ['converted', 'rewarded'] else None,
                round(random.uniform(10, 50), 2) if status in ['converted', 'rewarded'] else None,
                referred_at
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} referral tracking records")


def insert_social_media_mentions(conn):
    """Insert social media mention records"""
    print(f"\n✓ Inserting Social Media Mentions...")
    cur = conn.cursor()

    platforms = ['twitter', 'facebook', 'instagram', 'linkedin', 'tiktok', 'youtube']
    sentiments = ['positive', 'neutral', 'negative', 'mixed']
    post_types = ['post', 'comment', 'review', 'story', 'video', 'photo', 'reel', 'tweet', 'share', 'mention', 'tag']
    count = 0

    for property in data_store['properties']:
        for i in range(random.randint(20, 50)):
            posted_at = fake.date_time_between(start_date="-3m", end_date="now")

            cur.execute("""
                INSERT INTO social_media_mentions (
                    mention_id, tenant_id, property_id,
                    platform, post_type, post_url,
                    author_username, author_display_name,
                    content_text, sentiment, sentiment_score,
                    likes_count, comments_count, shares_count,
                    posted_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                random.choice(platforms),
                random.choice(post_types),
                fake.url(),
                fake.user_name(),
                fake.name(),
                fake.text(max_nb_chars=280),
                random.choice(sentiments),
                round(random.uniform(-1.0, 1.0), 2),
                random.randint(0, 1000),
                random.randint(0, 100),
                random.randint(0, 50),
                posted_at
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} social media mentions")


def insert_mobile_keys(conn):
    """Insert mobile key records"""
    print(f"\n✓ Inserting Mobile Keys...")
    cur = conn.cursor()

    count = 0

    # Get recent reservations
    cur.execute("SELECT id, guest_id, tenant_id, property_id FROM reservations WHERE check_in_date >= CURRENT_DATE - INTERVAL '30 days' LIMIT 200")
    recent_reservations = cur.fetchall()

    for reservation_id, guest_id, tenant_id, property_id in recent_reservations:
        if random.random() < 0.6:  # 60% of recent reservations get mobile keys
            # Get a room for this property
            cur2 = conn.cursor()
            cur2.execute("SELECT id FROM rooms WHERE property_id = %s LIMIT 1", (property_id,))
            room_result = cur2.fetchone()
            if not room_result:
                continue
            room_id = room_result[0]
            cur2.close()

            valid_from = fake.date_time_between(start_date="-30d", end_date="now")
            valid_to = valid_from + timedelta(days=random.randint(1, 7))
            key_types = ['bluetooth', 'nfc', 'qr_code', 'pin']
            statuses = ['pending', 'active', 'expired', 'revoked', 'used']

            cur.execute("""
                INSERT INTO mobile_keys (
                    key_id, tenant_id, property_id, reservation_id,
                    guest_id, room_id, key_code, key_type,
                    status, valid_from, valid_to
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                tenant_id,
                property_id,
                reservation_id,
                guest_id,
                room_id,
                f"KEY-{fake.uuid4()[:12].upper()}",
                random.choice(key_types),
                random.choice(statuses),
                valid_from,
                valid_to
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} mobile keys")


def insert_qr_codes(conn):
    """Insert QR code records"""
    print(f"\n✓ Inserting QR Codes...")
    cur = conn.cursor()

    code_types = ['menu', 'feedback', 'wifi', 'checkin', 'room_service', 'payment']
    count = 0

    for property in data_store['properties']:
        for code_type in code_types:
            for i in range(random.randint(2, 8)):
                cur.execute("""
                    INSERT INTO qr_codes (
                        qr_code_id, tenant_id, property_id,
                        code_value, code_type, location,
                        target_url, scan_count, is_active
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    generate_uuid(),
                    property['tenant_id'],
                    property['id'],
                    f"QR-{fake.uuid4()[:16].upper()}",
                    code_type,
                    f"{property['name']} - {code_type.title()} #{i+1}",
                    fake.url(),
                    random.randint(0, 500),
                    random.choice([True, True, True, False])
                ))
                count += 1

    conn.commit()
    print(f"   → Inserted {count} QR codes")


def insert_push_notifications(conn):
    """Insert push notification records"""
    print(f"\n✓ Inserting Push Notifications...")
    cur = conn.cursor()

    notification_types = ['booking_confirmation', 'check_in_reminder', 'promotion', 'service_update', 'feedback_request']
    count = 0

    for property in data_store['properties']:
        property_guests = [g for g in data_store['guests'] if g['tenant_id'] == property['tenant_id']][:50]

        for i in range(random.randint(20, 50)):
            if not property_guests:
                continue

            guest = random.choice(property_guests)
            notification_types_valid = ['booking', 'checkin', 'checkout', 'promotion', 'alert', 'reminder', 'info']
            statuses = ['draft', 'scheduled', 'sent', 'delivered', 'opened', 'failed', 'cancelled']
            platforms = ['ios', 'android', 'web']
            priorities = ['low', 'medium', 'high', 'urgent']

            cur.execute("""
                INSERT INTO push_notifications (
                    notification_id, tenant_id, property_id,
                    recipient_type, recipient_id, guest_id,
                    notification_type, title, message,
                    status, platform, priority,
                    sent_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                'guest',
                guest['id'],
                guest['id'],
                random.choice(notification_types_valid),
                fake.sentence(nb_words=6)[:100],
                fake.text(max_nb_chars=200),
                random.choice(statuses),
                random.choice(platforms),
                random.choice(priorities),
                fake.date_time_between(start_date="-3m", end_date="now")
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} push notifications")


def insert_ab_test_results(conn):
    """Insert A/B test result records"""
    print(f"\n✓ Inserting A/B Test Results...")
    cur = conn.cursor()

    test_categories = ['pricing', 'ui_design', 'marketing_message', 'booking_flow', 'email_subject']
    count = 0

    for property in data_store['properties']:
        for i in range(random.randint(3, 8)):
            test_start = fake.date_between(start_date="-6m", end_date="-1m")
            test_end = test_start + timedelta(days=random.randint(7, 30))

            variant_a_size = random.randint(500, 2000)
            variant_b_size = random.randint(500, 2000)
            variant_a_conv = random.randint(50, 500)
            variant_b_conv = random.randint(50, 500)

            cur.execute("""
                INSERT INTO ab_test_results (
                    result_id, tenant_id, property_id,
                    test_name, test_category, test_status,
                    variant_a_config, variant_b_config,
                    start_date, end_date,
                    variant_a_sample_size, variant_b_sample_size,
                    variant_a_conversions, variant_b_conversions,
                    variant_a_conversion_rate, variant_b_conversion_rate,
                    statistical_significance
                ) VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                f"Test: {fake.bs().title()}",
                random.choice(test_categories),
                random.choice(['draft', 'running', 'completed', 'cancelled']),
                json.dumps({'name': 'Control', 'description': 'Original version'}),
                json.dumps({'name': 'Variant', 'description': 'New version'}),
                test_start,
                test_end,
                variant_a_size,
                variant_b_size,
                variant_a_conv,
                variant_b_conv,
                round((variant_a_conv / variant_a_size) * 100, 2),
                round((variant_b_conv / variant_b_size) * 100, 2),
                random.choice([True, False])
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} A/B test results")


def insert_analytics_reports(conn):
    """Insert analytics report records"""
    print(f"\n✓ Inserting Analytics Reports...")
    cur = conn.cursor()

    report_types = ['occupancy', 'revenue', 'adr', 'revpar', 'guest_satisfaction', 'operational', 'financial']
    count = 0

    for property in data_store['properties']:
        for i in range(random.randint(10, 20)):
            report_code = f"RPT-{fake.random_number(digits=6)}"
            report_name = f"{random.choice(report_types).upper()} Report - {fake.month_name()} {fake.year()}"

            cur.execute("""
                INSERT INTO analytics_reports (
                    id, tenant_id, report_name, report_code,
                    report_type, description, definition,
                    created_by_user_id, is_active
                ) VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                report_name,
                report_code,
                random.choice(report_types),
                f"Analytics report for {property['name']}",
                json.dumps({
                    'metrics': ['revenue', 'occupancy'],
                    'dimensions': ['date', 'property'],
                    'dateRange': {'start': '-30d', 'end': 'now'},
                    'filters': {},
                    'groupBy': ['property'],
                    'sortBy': []
                }),
                random.choice(data_store['users'])['id'],
                random.choice([True, False])
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} analytics reports")


def insert_shift_handovers(conn):
    """Insert shift handover records"""
    print(f"\n✓ Inserting Shift Handovers...")
    cur = conn.cursor()

    shifts = ['morning', 'afternoon', 'evening', 'night']
    departments = ['front_desk', 'housekeeping', 'maintenance', 'food_beverage', 'management', 'sales', 'security', 'spa', 'concierge', 'other']
    statuses = ['pending', 'in_progress', 'completed', 'acknowledged', 'escalated']
    count = 0

    for property in data_store['properties']:
        for i in range(random.randint(30, 60)):
            shift_date = fake.date_between(start_date="-30d", end_date="now")
            outgoing_shift_idx = random.randint(0, len(shifts)-2)
            incoming_shift_idx = outgoing_shift_idx + 1

            cur.execute("""
                INSERT INTO shift_handovers (
                    handover_id, tenant_id, property_id,
                    shift_date, outgoing_shift, incoming_shift,
                    outgoing_user_id, incoming_user_id,
                    department, handover_status, key_points,
                    current_occupancy_count, rooms_occupied
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                shift_date,
                shifts[outgoing_shift_idx],
                shifts[incoming_shift_idx],
                random.choice(data_store['users'])['id'],
                random.choice(data_store['users'])['id'],
                random.choice(departments),
                random.choice(statuses),
                fake.text(max_nb_chars=500),
                random.randint(50, 200),
                random.randint(50, 200)
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} shift handovers")


def insert_api_logs(conn):
    """Insert API log records"""
    print(f"\n✓ Inserting API Logs...")
    cur = conn.cursor()

    endpoints = ['/api/reservations', '/api/guests', '/api/availability', '/api/rates', '/api/payments']
    methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
    status_codes = [200, 200, 200, 201, 400, 404, 500]
    count = 0

    for i in range(random.randint(500, 1000)):
        status_code = random.choice(status_codes)
        success = status_code < 400

        cur.execute("""
            INSERT INTO api_logs (
                log_id, tenant_id, endpoint, http_method,
                status_code, duration_ms, success,
                ip_address, user_agent
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            generate_uuid(),
            random.choice(data_store['tenants'])['id'],
            random.choice(endpoints),
            random.choice(methods),
            status_code,
            random.randint(50, 2000),
            success,
            fake.ipv4(),
            fake.user_agent()
        ))
        count += 1

    conn.commit()
    print(f"   → Inserted {count} API logs")


# Additional functions for remaining tables
def insert_webhook_subscriptions(conn):
    """Insert webhook subscription records"""
    print(f"\n✓ Inserting Webhook Subscriptions...")
    cur = conn.cursor()

    events = ['reservation.created', 'reservation.updated', 'payment.received', 'guest.checked_in', 'guest.checked_out']
    count = 0

    for property in data_store['properties']:
        for i in range(random.randint(2, 5)):
            webhook_name = f"{property['name']} - {random.choice(['Reservation', 'Payment', 'Guest', 'Channel'])} Webhook"

            cur.execute("""
                INSERT INTO webhook_subscriptions (
                    subscription_id, tenant_id, property_id,
                    webhook_name, webhook_url, event_types, is_active
                ) VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                webhook_name,
                fake.url(),
                random.sample(events, random.randint(1, 3)),
                random.choice([True, True, False])
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} webhook subscriptions")


def insert_integration_mappings(conn):
    """Insert integration mapping records"""
    print(f"\n✓ Inserting Integration Mappings...")
    cur = conn.cursor()

    integration_types = ['pms', 'channel_manager', 'payment', 'accounting', 'crm', 'analytics', 'other']
    count = 0

    for property in data_store['properties']:
        for integration_type in random.sample(integration_types, random.randint(2, 4)):
            integration_name = f"{integration_type.title().replace('_', ' ')} - {fake.company()}"
            external_system = fake.company()

            cur.execute("""
                INSERT INTO integration_mappings (
                    mapping_id, tenant_id, property_id,
                    integration_name, integration_type, external_system,
                    target_system, source_entity, target_entity,
                    field_mappings, is_active
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                integration_name,
                integration_type,
                external_system,
                'tartware_pms',
                random.choice(['guest', 'reservation', 'payment', 'room']),
                random.choice(['customer', 'booking', 'transaction', 'inventory']),
                json.dumps({
                    'guest_id': 'external_guest_id',
                    'reservation_id': 'booking_ref',
                    'email': 'customer_email'
                }),
                random.choice([True, True, False])
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} integration mappings")


def insert_data_sync_status(conn):
    """Insert data sync status records"""
    print(f"\n✓ Inserting Data Sync Status...")
    cur = conn.cursor()

    sync_types = ['full', 'incremental', 'delta', 'realtime']
    count = 0

    for property in data_store['properties']:
        for sync_type_val in sync_types:
            for i in range(random.randint(5, 15)):
                sync_time = fake.date_time_between(start_date="-7d", end_date="now")
                completed_time = sync_time + timedelta(seconds=random.randint(10, 300))
                records_processed = random.randint(10, 1000)
                status_val = random.choice(['completed', 'completed', 'failed', 'partial'])

                cur.execute("""
                    INSERT INTO data_sync_status (
                        sync_id, tenant_id, property_id,
                        sync_name, sync_type, entity_type,
                        status, started_at, completed_at,
                        records_total, records_processed, records_succeeded
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    generate_uuid(),
                    property['tenant_id'],
                    property['id'],
                    f"{sync_type_val.title()} Sync - {property['name']}",
                    sync_type_val,
                    random.choice(['reservation', 'guest', 'rate', 'availability', 'inventory']),
                    status_val,
                    sync_time,
                    completed_time if status_val != 'running' else None,
                    records_processed,
                    records_processed,
                    records_processed if status_val == 'completed' else random.randint(0, records_processed)
                ))
                count += 1

    conn.commit()
    print(f"   → Inserted {count} data sync status records")


def insert_performance_alerts(conn):
    """Insert performance alert records"""
    print(f"\n✓ Inserting Performance Alerts...")
    cur = conn.cursor()

    alert_types = ['occupancy', 'rate', 'cancellation', 'system', 'payment', 'response_time', 'error_rate']
    severities = ['INFO', 'WARNING', 'CRITICAL']
    count = 0

    for i in range(random.randint(50, 150)):
        current_val = random.uniform(0, 100)
        baseline_val = random.uniform(0, 100)

        cur.execute("""
            INSERT INTO performance_alerts (
                alert_id, alert_type, severity, metric_name,
                current_value, baseline_value, deviation_percent,
                alert_message, acknowledged
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            generate_uuid(),
            random.choice(alert_types),
            random.choice(severities),
            f"{random.choice(['occupancy_rate', 'adr', 'revpar', 'response_time', 'error_rate'])}",
            round(current_val, 2),
            round(baseline_val, 2),
            round(abs(current_val - baseline_val) / baseline_val * 100, 2) if baseline_val > 0 else 0,
            fake.sentence(),
            random.choice([True, True, False])
        ))
        count += 1

    conn.commit()
    print(f"   → Inserted {count} performance alerts")


def insert_performance_baselines(conn):
    """Insert performance baseline records"""
    print(f"\n✓ Inserting Performance Baselines...")
    cur = conn.cursor()

    metric_names = ['occupancy_rate', 'average_daily_rate', 'revenue_per_available_room', 'booking_lead_time', 'response_time', 'error_rate']
    time_windows = ['hourly', 'daily', 'weekly', 'monthly']
    count = 0

    for metric in metric_names:
        for time_window in time_windows:
            baseline_val = round(random.uniform(50, 95), 2)
            cur.execute("""
                INSERT INTO performance_baselines (
                    baseline_id, metric_name, time_window,
                    baseline_value, stddev_value, min_value, max_value,
                    sample_count
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                metric,
                time_window,
                baseline_val,
                round(random.uniform(5, 15), 2),
                round(baseline_val * 0.8, 2),
                round(baseline_val * 1.2, 2),
                random.randint(100, 10000)
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} performance baselines")


def insert_performance_thresholds(conn):
    """Insert performance threshold records"""
    print(f"\n✓ Inserting Performance Thresholds...")
    cur = conn.cursor()

    metric_names = ['occupancy_rate', 'cancellation_rate', 'no_show_rate', 'average_daily_rate', 'response_time', 'error_rate']
    count = 0

    for metric in metric_names:
        cur.execute("""
            INSERT INTO performance_thresholds (
                threshold_id, metric_name, warning_threshold, critical_threshold,
                is_active
            ) VALUES (%s, %s, %s, %s, %s)
        """, (
            generate_uuid(),
            metric,
            round(random.uniform(60, 80), 2),
            round(random.uniform(40, 60), 2),
            random.choice([True, True, False])
        ))
        count += 1

    conn.commit()
    print(f"   → Inserted {count} performance thresholds")


def insert_performance_reports(conn):
    """Insert performance report records"""
    print(f"\n✓ Inserting Performance Reports...")
    cur = conn.cursor()

    report_types = ['daily_summary', 'weekly_analysis', 'monthly_review', 'quarterly_report']
    severities = ['INFO', 'WARNING', 'CRITICAL']
    statuses = ['PENDING', 'SENT', 'FAILED']
    count = 0

    for i in range(random.randint(50, 150)):
        cur.execute("""
            INSERT INTO performance_reports (
                report_id, report_type, report_name, report_data,
                severity, status
            ) VALUES (%s, %s, %s, %s::jsonb, %s, %s)
        """, (
            generate_uuid(),
            random.choice(report_types),
            f"Performance Report - {fake.date()}",
            json.dumps({
                'occupancy': random.randint(50, 100),
                'adr': random.randint(100, 300),
                'revpar': random.randint(50, 250)
            }),
            random.choice(severities),
            random.choice(statuses)
        ))
        count += 1

    conn.commit()
    print(f"   → Inserted {count} performance reports")


def insert_alert_rules(conn):
    """Insert alert rule records"""
    print(f"\n✓ Inserting Alert Rules...")
    cur = conn.cursor()

    metrics = ['occupancy_rate', 'adr', 'revpar', 'response_time', 'error_rate', 'cpu_usage']
    condition_types = ['threshold', 'deviation', 'trend', 'spike']
    severities = ['INFO', 'WARNING', 'CRITICAL']
    channels = ['email', 'sms', 'slack', 'webhook']
    count = 0

    for metric in metrics:
        for condition in condition_types[:2]:  # 2 rules per metric
            rule_name = f"{metric}_{condition}_{random.randint(1000, 9999)}"
            cur.execute("""
                INSERT INTO alert_rules (
                    rule_id, rule_name, metric_query, condition_type,
                    threshold_value, deviation_percent, time_window,
                    severity, is_active, notification_channels
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                rule_name,
                f"SELECT AVG({metric}) FROM metrics WHERE time > NOW() - INTERVAL '5 minutes'",
                condition,
                round(random.uniform(50, 100), 2) if condition == 'threshold' else None,
                round(random.uniform(10, 30), 2) if condition == 'deviation' else None,
                f"{random.choice([5, 10, 15, 30])} minutes",
                random.choice(severities),
                random.choice([True, True, True, False]),
                random.sample(channels, k=random.randint(1, 3))
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} alert rules")


def insert_report_schedules(conn):
    """Insert report schedule records"""
    print(f"\n✓ Inserting Report Schedules...")
    cur = conn.cursor()

    report_types = ['occupancy_report', 'revenue_report', 'financial_summary', 'operational_metrics',
                    'guest_satisfaction', 'performance_dashboard']
    cron_expressions = ['0 0 * * *', '0 0 * * 0', '0 0 1 * *', '0 0 1 1,4,7,10 *']  # daily, weekly, monthly, quarterly
    count = 0

    for report_type in report_types:
        cron = random.choice(cron_expressions)
        now = datetime.now()
        last_run = now - timedelta(days=random.randint(1, 7))
        next_run = now + timedelta(days=random.randint(1, 7))

        cur.execute("""
            INSERT INTO report_schedules (
                schedule_id, report_type, schedule_expression,
                is_active, last_run, next_run, recipients, config
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb)
        """, (
            generate_uuid(),
            report_type,
            cron,
            random.choice([True, True, True, False]),
            last_run,
            next_run,
            [fake.email() for _ in range(random.randint(1, 4))],
            json.dumps({'format': random.choice(['pdf', 'excel', 'csv']), 'include_charts': True})
        ))
        count += 1

    conn.commit()
    print(f"   → Inserted {count} report schedules")


def insert_guest_journey_tracking(conn):
    """Insert guest journey tracking records"""
    print(f"\n✓ Inserting Guest Journey Tracking...")
    cur = conn.cursor()

    journey_types = ['discovery', 'booking', 'pre_arrival', 'arrival', 'stay', 'departure', 'post_stay', 'complete_cycle']
    journey_statuses = ['started', 'in_progress', 'completed', 'abandoned']
    channels = ['web', 'mobile_app', 'email', 'phone', 'in_person']
    stages = ['awareness', 'consideration', 'booking', 'pre_arrival', 'check_in', 'stay', 'check_out', 'post_stay']
    count = 0

    for guest in data_store['guests'][:150]:
        journey_start = fake.date_time_between(start_date="-6m", end_date="-1d")
        journey_end = journey_start + timedelta(days=random.randint(1, 30))
        duration_mins = int((journey_end - journey_start).total_seconds() / 60)
        is_converted = random.choice([True, True, False])

        touchpoints = [
            {
                'timestamp': (journey_start + timedelta(hours=i*4)).isoformat(),
                'type': random.choice(['website_visit', 'email_click', 'phone_call', 'booking']),
                'channel': random.choice(channels)
            }
            for i in range(random.randint(3, 8))
        ]

        cur.execute("""
            INSERT INTO guest_journey_tracking (
                journey_id, tenant_id, property_id, guest_id,
                guest_segment, journey_type, journey_status,
                journey_start_date, journey_end_date, journey_duration_minutes,
                touchpoint_count, touchpoints, channels_used, primary_channel,
                stages_completed, current_stage, converted, conversion_date,
                conversion_value, total_interactions, website_visits,
                email_opens, email_clicks, app_sessions, phone_calls,
                in_person_visits, engagement_score
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            generate_uuid(),
            guest['tenant_id'],
            guest.get('property_id'),
            guest['id'],
            random.choice(['budget', 'mid_range', 'luxury', 'business', 'leisure']),
            random.choice(journey_types),
            random.choice(journey_statuses),
            journey_start,
            journey_end if is_converted else None,
            duration_mins,
            len(touchpoints),
            json.dumps(touchpoints),
            random.sample(channels, k=random.randint(2, 4)),
            random.choice(channels),
            random.sample(stages, k=random.randint(3, 6)),
            random.choice(stages),
            is_converted,
            journey_end if is_converted else None,
            round(random.uniform(100, 2000), 2) if is_converted else None,
            random.randint(5, 30),
            random.randint(1, 10),
            random.randint(0, 5),
            random.randint(0, 3),
            random.randint(0, 8),
            random.randint(0, 2),
            random.randint(0, 1),
            round(random.uniform(0, 100), 2)
        ))
        count += 1

    conn.commit()
    print(f"   → Inserted {count} guest journey tracking records")


def insert_app_usage_analytics(conn):
    """Insert app usage analytics records"""
    print(f"\n✓ Inserting App Usage Analytics...")
    cur = conn.cursor()

    platforms = ['ios', 'android', 'web']
    event_types = ['app_open', 'app_close', 'screen_view', 'button_click', 'search', 'booking', 'feature_use']
    event_names = ['booking_search', 'room_details', 'check_in', 'mobile_key', 'room_service', 'concierge', 'feedback']
    screens = ['home', 'search', 'booking', 'reservations', 'check_in', 'room_controls', 'services', 'profile']
    count = 0

    for property in data_store['properties']:
        for i in range(random.randint(50, 120)):
            session_id = f"session_{random.randint(10000, 99999)}"
            event_timestamp = fake.date_time_between(start_date="-30d", end_date="now")

            cur.execute("""
                INSERT INTO app_usage_analytics (
                    event_id, tenant_id, property_id, guest_id,
                    session_id, device_id, platform, app_version, os_version,
                    event_type, event_name, screen_name, event_timestamp,
                    duration_seconds, event_data, metadata
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                random.choice(data_store['guests'])['id'] if random.random() > 0.2 else None,
                session_id,
                f"device_{random.randint(1000, 9999)}",
                random.choice(platforms),
                f"{random.randint(1, 3)}.{random.randint(0, 9)}.{random.randint(0, 9)}",
                f"{random.randint(12, 17)}.{random.randint(0, 5)}",
                random.choice(event_types),
                random.choice(event_names),
                random.choice(screens),
                event_timestamp,
                random.randint(5, 300),
                json.dumps({'action': random.choice(['tap', 'swipe', 'scroll']), 'value': random.randint(1, 100)}),
                json.dumps({'country': fake.country_code(), 'language': random.choice(['en', 'es', 'fr', 'de'])})
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} app usage analytics records")


def insert_commission_tracking(conn):
    """Insert commission tracking records"""
    print(f"\n✓ Inserting Commission Tracking...")
    cur = conn.cursor()

    commission_types = ['sales', 'booking', 'ota', 'travel_agent', 'corporate', 'referral', 'staff', 'manager']
    beneficiary_types = ['staff', 'user', 'agent', 'ota', 'channel', 'affiliate']
    source_types = ['reservation', 'booking', 'payment', 'invoice', 'service', 'package']
    calculation_methods = ['percentage', 'flat_rate', 'tiered', 'performance_based', 'volume_based']
    count = 0

    # Get reservations
    cur.execute("SELECT id, tenant_id, property_id, guest_id, check_in_date, check_out_date, total_amount FROM reservations LIMIT 200")
    reservations = cur.fetchall()

    commission_counter = 0
    for res_id, tenant_id, property_id, guest_id, check_in, check_out, total_amount in reservations:
        commission_counter += 1
        commission_rate = round(random.uniform(5, 25), 4)
        commission_amount = round(float(total_amount) * commission_rate / 100, 2)
        transaction_date = check_in - timedelta(days=random.randint(1, 30))

        cur.execute("""
            INSERT INTO commission_tracking (
                commission_id, tenant_id, property_id,
                commission_number, commission_type, beneficiary_type,
                beneficiary_name, source_type, source_id, source_reference,
                reservation_id, transaction_date, check_in_date, check_out_date,
                guest_id, base_amount, base_currency, calculation_method,
                commission_rate, commission_amount, commission_currency,
                commission_status, payment_status
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            generate_uuid(),
            tenant_id,
            property_id,
            f"COM-{commission_counter:05d}-{random.randint(100, 999)}",
            random.choice(commission_types),
            random.choice(beneficiary_types),
            fake.company(),
            random.choice(source_types),
            res_id,
            f"REF-{random.randint(1000, 9999)}",
            res_id,
            transaction_date,
            check_in,
            check_out,
            guest_id,
            round(float(total_amount), 2),
            'USD',
            random.choice(calculation_methods),
            commission_rate,
            commission_amount,
            'USD',
            random.choice(['pending', 'calculated', 'approved', 'paid', 'disputed']),
            random.choice(['unpaid', 'scheduled', 'processing', 'paid', 'partially_paid'])
        ))
        count += 1

    conn.commit()
    print(f"   → Inserted {count} commission tracking records")


def insert_credit_limits(conn):
    """Insert credit limit records"""
    print(f"\n✓ Inserting Credit Limits...")
    cur = conn.cursor()

    account_types = ['guest', 'company', 'corporate', 'group']
    credit_statuses = ['active', 'pending', 'suspended', 'blocked', 'expired']
    count = 0

    for guest in data_store['guests'][:100]:
        if random.random() < 0.3:  # 30% of guests have credit limits
            effective_from = fake.date_between(start_date="-1y", end_date="-30d")
            effective_to = fake.date_between(start_date="now", end_date="+1y") if random.random() > 0.2 else None
            credit_limit = round(random.uniform(1000, 10000), 2)
            current_balance = round(random.uniform(0, credit_limit * 0.8), 2)

            cur.execute("""
                INSERT INTO credit_limits (
                    credit_limit_id, tenant_id, property_id,
                    account_type, account_id, account_name,
                    guest_id, credit_limit_amount, currency,
                    credit_status, is_active, effective_from, effective_to,
                    current_balance, available_credit
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                guest['tenant_id'],
                guest.get('property_id'),
                'guest',
                guest['id'],
                f"{guest.get('first_name', 'Guest')} {guest.get('last_name', 'Account')}",
                guest['id'],
                credit_limit,
                'USD',
                random.choice(credit_statuses),
                random.choice([True, True, True, False]),
                effective_from,
                effective_to,
                current_balance,
                credit_limit - current_balance
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} credit limits")


def insert_accounts_receivable(conn):
    """Insert accounts receivable records"""
    print(f"\n✓ Inserting Accounts Receivable...")
    cur = conn.cursor()

    source_types = ['invoice', 'reservation', 'service', 'package']
    ar_statuses = ['open', 'partial', 'paid', 'overdue', 'in_collection', 'written_off', 'disputed']
    count = 0
    ar_counter = 0

    # Get invoices
    cur.execute("SELECT id, tenant_id, property_id, guest_id, total_amount, invoice_date FROM invoices LIMIT 100")
    invoices = cur.fetchall()

    for invoice_id, tenant_id, property_id, guest_id, total_amount, invoice_date in invoices:
        ar_counter += 1
        due_date = invoice_date + timedelta(days=30)
        paid_amount = round(float(total_amount) * random.uniform(0, 0.7), 2)
        outstanding_balance = round(float(total_amount) - paid_amount, 2)

        cur.execute("""
            INSERT INTO accounts_receivable (
                ar_id, tenant_id, property_id,
                ar_number, account_name, guest_id,
                source_type, source_id, invoice_id,
                original_amount, currency, paid_amount, outstanding_balance,
                due_date, transaction_date,
                payment_terms, aging_days, aging_bucket,
                ar_status
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            generate_uuid(),
            tenant_id,
            property_id,
            f"AR-{ar_counter:06d}-{random.randint(100, 999)}",
            fake.company(),
            guest_id,
            'invoice',
            invoice_id,
            invoice_id,
            round(float(total_amount), 2),
            'USD',
            paid_amount,
            outstanding_balance,
            due_date,
            invoice_date,
            random.choice(['due_on_receipt', 'net_15', 'net_30', 'net_45', 'net_60', 'net_90']),
            (datetime.now().date() - invoice_date).days,
            random.choice(['current', '1_30_days', '31_60_days', '61_90_days', '91_120_days']),
            random.choice(ar_statuses)
        ))
        count += 1

    conn.commit()
    print(f"   → Inserted {count} accounts receivable records")


def insert_financial_closures(conn):
    """Insert financial closure records"""
    print(f"\n✓ Inserting Financial Closures...")
    cur = conn.cursor()

    closure_types = ['daily', 'weekly', 'monthly', 'quarterly', 'annual']
    closure_statuses = ['not_started', 'in_progress', 'pending_review', 'under_review', 'approved', 'closed', 'reopened']
    count = 0

    for property in data_store['properties']:
        for i in range(random.randint(6, 12)):
            period_start = fake.date_between(start_date="-1y", end_date="-30d")
            period_end = period_start + timedelta(days=random.choice([1, 7, 30, 90]))
            business_date = period_end

            gross_revenue = round(random.uniform(50000, 200000), 2)
            net_revenue = round(gross_revenue * 0.85, 2)

            cur.execute("""
                INSERT INTO financial_closures (
                    closure_id, tenant_id, property_id,
                    closure_number, closure_name, closure_type,
                    period_start_date, period_end_date,
                    fiscal_year, fiscal_month, fiscal_quarter,
                    business_date, closure_status, is_closed, is_final,
                    total_gross_revenue, total_net_revenue
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                f"FIN-{period_start.strftime('%Y%m%d')}-{random.randint(100, 999)}",
                f"{random.choice(closure_types).title()} Closure {period_start.strftime('%Y-%m-%d')}",
                random.choice(closure_types),
                period_start,
                period_end,
                period_start.year,
                period_start.month,
                (period_start.month - 1) // 3 + 1,
                business_date,
                random.choice(closure_statuses),
                random.choice([True, True, False]),
                random.choice([True, False, False]),
                gross_revenue,
                net_revenue
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} financial closures")


def insert_staff_tasks(conn):
    """Insert staff task records"""
    print(f"\n✓ Inserting Staff Tasks...")
    cur = conn.cursor()

    task_types = ['housekeeping', 'maintenance', 'inspection', 'delivery', 'guest_request', 'administrative', 'setup', 'breakdown', 'inventory']
    count = 0

    for property in data_store['properties']:
        for i in range(random.randint(30, 80)):
            due_date = fake.date_between(start_date="-7d", end_date="+14d")

            cur.execute("""
                INSERT INTO staff_tasks (
                    task_id, tenant_id, property_id,
                    task_title, task_description, task_type,
                    assigned_to, priority, task_status, due_date
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                f"{random.choice(task_types).replace('_', ' ').title()} Task",
                fake.sentence(),
                random.choice(task_types),
                random.choice(data_store['users'])['id'],
                random.choice(['low', 'normal', 'high', 'urgent']),
                random.choice(['pending', 'assigned', 'in_progress', 'completed', 'cancelled']),
                due_date
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} staff tasks")


def insert_rate_recommendations(conn):
    """Insert rate recommendation records"""
    print(f"\n✓ Inserting Rate Recommendations...")
    cur = conn.cursor()

    recommendation_actions = ['increase', 'decrease', 'hold']
    reasons = ['High demand period', 'Competitor pricing', 'Historical trends', 'Event in area', 'Low occupancy', 'Seasonal pattern']
    count = 0

    for property in data_store['properties']:
        property_room_types = [rt for rt in data_store['room_types'] if rt['property_id'] == property['id']]

        for room_type in property_room_types:
            for i in range(random.randint(10, 30)):
                recommendation_date = fake.date_between(start_date="-30d", end_date="+60d")
                recommended_rate = round(random.uniform(100, 400), 2)
                current_rate = round(random.uniform(100, 400), 2)
                rate_difference = round(recommended_rate - current_rate, 2)
                rate_difference_percent = round((rate_difference / current_rate * 100) if current_rate > 0 else 0, 2)

                cur.execute("""
                    INSERT INTO rate_recommendations (
                        recommendation_id, tenant_id, property_id,
                        room_type_id, recommendation_date, recommended_rate,
                        current_rate, rate_difference, rate_difference_percent,
                        confidence_score, recommendation_action, primary_reason
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    generate_uuid(),
                    property['tenant_id'],
                    property['id'],
                    room_type['id'],
                    recommendation_date,
                    recommended_rate,
                    current_rate,
                    rate_difference,
                    rate_difference_percent,
                    round(random.uniform(0.6, 0.95), 2),
                    'increase' if recommended_rate > current_rate else ('decrease' if recommended_rate < current_rate else 'hold'),
                    random.choice(reasons)
                ))
                count += 1

    conn.commit()
    print(f"   → Inserted {count} rate recommendations")


def insert_forecasting_models(conn):
    """Insert forecasting model records"""
    print(f"\n✓ Inserting Forecasting Models...")
    cur = conn.cursor()

    model_types = ['occupancy', 'revenue', 'demand', 'pricing']
    count = 0

    for property in data_store['properties']:
        for model_type in model_types:
            cur.execute("""
                INSERT INTO forecasting_models (
                    model_id, tenant_id, property_id,
                    model_name, model_type, parameters,
                    accuracy_score, is_active
                ) VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                f"{model_type.title()} Forecast Model - {property.get('name', 'Property')}",
                model_type,
                json.dumps({'algorithm': 'random_forest', 'features': ['historical_data', 'seasonality', 'events']}),
                round(random.uniform(0.75, 0.95), 2),
                random.choice([True, True, False])
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} forecasting models")


def insert_revenue_attribution(conn):
    """Insert revenue attribution records"""
    print(f"\n✓ Inserting Revenue Attribution...")
    cur = conn.cursor()

    channel_types = ['direct', 'ota', 'corporate', 'travel_agent', 'social_media', 'email', 'organic_search', 'paid_search']
    count = 0

    # Get reservations with guests
    cur.execute("SELECT id, tenant_id, property_id, guest_id, total_amount FROM reservations LIMIT 300")
    reservations = cur.fetchall()

    for reservation_id, tenant_id, property_id, guest_id, total_amount in reservations:
        # Create 1-3 touchpoints per reservation
        num_touchpoints = random.randint(1, 3)
        for seq in range(1, num_touchpoints + 1):
            touchpoint_date = fake.date_time_between(start_date="-90d", end_date="-1d")
            conversion_date = fake.date_time_between(start_date=touchpoint_date, end_date="now")

            cur.execute("""
                INSERT INTO revenue_attribution (
                    attribution_id, tenant_id, property_id,
                    reservation_id, guest_id, touchpoint_sequence,
                    channel_type, attribution_weight, attributed_revenue,
                    touchpoint_date, conversion_date
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                tenant_id,
                property_id,
                reservation_id,
                guest_id,
                seq,
                random.choice(channel_types),
                round(1.0 / num_touchpoints, 4),
                round(float(total_amount) / num_touchpoints, 2),
                touchpoint_date,
                conversion_date
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} revenue attribution records")


def validate_uuid_v7():
    """Validate UUID v7 implementation before data load"""
    print("\n" + "=" * 60)
    print("UUID v7 Validation")
    print("=" * 60)

    # Test 1: Generate and verify version
    test_uuid = generate_uuid_v7()
    version_char = test_uuid[14]

    if version_char != '7':
        print(f"❌ FAILED: UUID version is {version_char}, expected 7")
        return False

    print(f"✓ UUID v7 Format: {test_uuid}")

    # Test 2: Time ordering
    uuid1 = generate_uuid_v7()
    time.sleep(0.002)  # 2ms delay
    uuid2 = generate_uuid_v7()

    if uuid1 >= uuid2:
        print(f"❌ FAILED: UUIDs not time-ordered")
        return False

    print(f"✓ Time-ordered: UUIDs sort chronologically")

    # Test 3: Rapid generation (uniqueness)
    rapid_uuids = [generate_uuid_v7() for _ in range(100)]
    if len(set(rapid_uuids)) != 100:
        print(f"❌ FAILED: UUID collision detected")
        return False

    print(f"✓ Uniqueness: 100 UUIDs generated with no collisions")

    # Test 4: Performance
    start = time.time()
    for _ in range(1000):
        generate_uuid_v7()
    v7_time = time.time() - start

    print(f"✓ Performance: 1000 UUIDs in {v7_time:.4f}s ({1000/v7_time:.0f} UUID/sec)")
    print("\n✅ All UUID v7 validations passed!")
    print("=" * 60)

    return True


def main():
    """Main execution function"""
    print("=" * 60)
    print("Tartware PMS - Direct Database Sample Data Loader")
    print("UUID Strategy: v7 (Time-Ordered) for Better Performance")
    print("=" * 60)
    print(f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Target: 500+ records across all tables")
    print("=" * 60)

    # Validate UUID v7 implementation
    if not validate_uuid_v7():
        print("\n❌ UUID v7 validation failed. Exiting.")
        return

    # Connect to database
    print("\n✓ Connecting to database...")
    conn = get_db_connection()
    print("   → Connected successfully!")

    # Always do a clean install - clear existing data automatically
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM reservations;")
    existing_count = cur.fetchone()[0]

    if existing_count > 0:
        print(f"\n⚠️  Found {existing_count} existing reservations - performing clean install...")
    else:
        print("\n✓ Database is empty - starting fresh...")

    print("\n✓ Clearing all data...")
    # Use CASCADE to handle foreign keys automatically
    try:
        cur.execute("""
            TRUNCATE TABLE
                revenue_attribution, forecasting_models, rate_recommendations, staff_tasks,
                financial_closures, accounts_receivable, credit_limits, commission_tracking,
                app_usage_analytics, guest_journey_tracking, report_schedules, alert_rules,
                performance_reports, performance_thresholds, performance_baselines, performance_alerts,
                data_sync_status, integration_mappings, webhook_subscriptions,
                api_logs, shift_handovers, analytics_reports, ab_test_results,
                push_notifications, qr_codes, mobile_keys, social_media_mentions,
                referral_tracking, campaign_segments, insurance_claims, contract_agreements,
                police_reports, gdpr_consent_logs, lost_and_found, revenue_goals,
                analytics_metrics, marketing_campaigns, vendor_contracts,
                cashier_sessions, deposit_schedules, tax_configurations, promotional_codes,
                pricing_rules, demand_calendar, competitor_rates, revenue_forecasts,
                automated_messages, channel_commission_rules, channel_rate_parity,
                ota_inventory_sync, allotments, rate_overrides, refunds, business_dates,
                night_audit_log, charge_postings, folios,
                incident_reports, maintenance_requests,
                guest_notes, guest_documents, guest_loyalty_programs,
                ota_reservations_queue, ota_rate_plans,
                channel_mappings, communication_templates,
                guest_preferences, guest_feedback, guest_communications,
                ota_configurations, reservation_services, reservation_status_history,
                invoice_items, invoices, payments, reservations,
                housekeeping_tasks, rates, rooms, room_types, services,
                guests, properties, booking_sources, market_segments,
                user_tenant_associations, users, tenants, audit_logs
            CASCADE;
        """)
        conn.commit()
        print("   → All data cleared successfully!")
    except Exception as e:
        conn.rollback()
        print(f"   ⚠️  Some tables don't exist yet: {e}")
        print("   → Continuing with clean install...")

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
        insert_ota_rate_plans(conn)
        insert_ota_reservations_queue(conn)

        # Guest CRM
        insert_guest_communications(conn)
        insert_guest_feedback(conn)
        insert_guest_preferences(conn)
        insert_communication_templates(conn)
        insert_guest_loyalty_programs(conn)
        insert_guest_documents(conn)
        insert_guest_notes(conn)

        # Operations
        insert_maintenance_requests(conn)
        insert_incident_reports(conn)

        # Financial
        insert_folios(conn)
        insert_charge_postings(conn)

        # System
        insert_night_audit_log(conn)

        # Batch 4: Revenue Management & Operations
        insert_business_dates(conn)
        insert_refunds(conn)
        insert_rate_overrides(conn)
        insert_allotments(conn)
        insert_ota_inventory_sync(conn)
        insert_channel_rate_parity(conn)
        insert_channel_commission_rules(conn)
        insert_automated_messages(conn)

        # Batch 5: Revenue Management & Pricing
        insert_revenue_forecasts(conn)
        insert_competitor_rates(conn)
        insert_demand_calendar(conn)
        insert_pricing_rules(conn)
        insert_promotional_codes(conn)
        insert_tax_configurations(conn)
        insert_deposit_schedules(conn)
        insert_cashier_sessions(conn)

        # BATCH 6: Analytics & Additional Features
        print("\n" + "=" * 60)
        print("BATCH 6: Analytics & Additional Features")
        print("=" * 60)
        insert_analytics_metrics(conn)
        # insert_staff_schedules(conn)  # TODO: Fix department constraint
        insert_marketing_campaigns(conn)
        insert_vendor_contracts(conn)
        insert_revenue_goals(conn)
        insert_lost_and_found(conn)
        insert_gdpr_consent_logs(conn)
        insert_police_reports(conn)
        insert_contract_agreements(conn)
        insert_insurance_claims(conn)
        insert_campaign_segments(conn)
        insert_referral_tracking(conn)
        insert_social_media_mentions(conn)
        insert_mobile_keys(conn)
        insert_qr_codes(conn)
        insert_push_notifications(conn)
        insert_ab_test_results(conn)
        insert_analytics_reports(conn)
        insert_shift_handovers(conn)
        insert_api_logs(conn)

        # BATCH 7: Advanced Features & Integrations
        print("\n" + "=" * 60)
        print("BATCH 7: Advanced Features & Integrations")
        print("=" * 60)
        insert_webhook_subscriptions(conn)
        insert_integration_mappings(conn)
        insert_data_sync_status(conn)
        insert_performance_alerts(conn)
        insert_performance_baselines(conn)
        insert_performance_thresholds(conn)
        insert_performance_reports(conn)
        insert_alert_rules(conn)
        insert_report_schedules(conn)
        insert_guest_journey_tracking(conn)
        insert_app_usage_analytics(conn)
        insert_commission_tracking(conn)
        insert_credit_limits(conn)
        insert_accounts_receivable(conn)
        insert_financial_closures(conn)
        insert_staff_tasks(conn)
        insert_rate_recommendations(conn)
        insert_forecasting_models(conn)
        insert_revenue_attribution(conn)

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
