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
            'property_id': property['id'],
            'guest_id': guest['id'],
            'total_amount': total_amount,
            'status': status
        })

    conn.commit()
    print(f"   → Inserted {count} reservations")


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
                'reservation_services', 'reservation_status_history', 'invoice_items', 'invoices',
                'payments', 'reservations', 'housekeeping_tasks', 'rates', 'rooms',
                'room_types', 'services', 'guests', 'properties',
                'user_tenant_associations', 'users', 'tenants'
            ]
            for table in tables:
                try:
                    cur.execute(f"TRUNCATE TABLE {table} CASCADE;")
                    print(f"   → Cleared {table}")
                except Exception as e:
                    print(f"   → Skipped {table}: {e}")
            conn.commit()
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

        # Re-enable triggers
        cur.execute("SET session_replication_role = DEFAULT;")
        conn.commit()
        print("\n✓ Re-enabled triggers")

        # Summary
        print("\n" + "=" * 60)
        print("✅ Sample Data Loading Complete!")
        print("=" * 60)
        print(f"  Tenants:      {len(data_store['tenants'])}")
        print(f"  Users:        {len(data_store['users'])}")
        print(f"  Properties:   {len(data_store['properties'])}")
        print(f"  Guests:       {len(data_store['guests'])}")
        print(f"  Room Types:   {len(data_store['room_types'])}")
        print(f"  Rooms:        {len(data_store['rooms'])}")
        print(f"  Rates:        {len(data_store['rates'])}")
        print(f"  Reservations: {len(data_store['reservations'])} ★")
        print("=" * 60)

        # Verification
        print("\n✓ Running verification...")
        cur.execute("SELECT COUNT(*) FROM reservations;")
        res_count = cur.fetchone()[0]
        print(f"   → Database shows {res_count} reservations")

    except Exception as e:
        print(f"\n❌ Error: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()
        print("\n✓ Database connection closed")


if __name__ == "__main__":
    main()
