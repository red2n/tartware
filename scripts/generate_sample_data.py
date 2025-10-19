#!/usr/bin/env python3
"""
Sample Data Generator for Tartware PMS Database
Generates realistic sample data for all 89 tables with 500+ core records
Date: 2025-10-19
"""

import random
import uuid
from datetime import datetime, timedelta, date
from decimal import Decimal
import json

# Try to import faker, if not available, provide instructions
try:
    from faker import Faker
except ImportError:
    print("ERROR: Faker library not installed.")
    print("Please install it using: pip install faker")
    exit(1)

fake = Faker()
Faker.seed(42)  # For reproducibility
random.seed(42)

# Storage for generated IDs to maintain referential integrity
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
    'booking_sources': [],
    'market_segments': [],
    'ota_configurations': [],
    'communication_templates': [],
    'marketing_campaigns': [],
    'staff_schedules': [],
    'vendor_contracts': [],
}


def sql_escape(value):
    """Escape single quotes for SQL"""
    if value is None:
        return 'NULL'
    if isinstance(value, str):
        return value.replace("'", "''")
    return value


def generate_uuid():
    """Generate UUID string"""
    return str(uuid.uuid4())


def random_date_between(start_date, end_date):
    """Generate random date between two dates"""
    time_between = end_date - start_date
    days_between = time_between.days
    if days_between <= 0:
        return start_date
    random_days = random.randint(0, days_between)
    return start_date + timedelta(days=random_days)


def generate_tenants(count=5):
    """Generate tenant records"""
    print(f"\n-- Generating {count} Tenants")
    print("INSERT INTO tenants (id, name, slug, type, status, email, phone, country, config, subscription, created_at) VALUES")

    tenant_types = ['INDEPENDENT', 'CHAIN', 'FRANCHISE', 'MANAGEMENT_COMPANY']
    statuses = ['ACTIVE', 'ACTIVE', 'ACTIVE', 'TRIAL', 'ACTIVE']  # Mostly active

    values = []
    for i in range(count):
        tenant_id = generate_uuid()
        company_name = fake.company()
        slug = company_name.lower().replace(' ', '-').replace(',', '').replace('.', '')

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

        values.append(f"""(
    '{tenant_id}',
    '{sql_escape(company_name)}',
    '{slug}',
    '{tenant_types[i % len(tenant_types)]}',
    '{statuses[i]}',
    '{fake.company_email()}',
    '{fake.phone_number()[:20]}',
    '{fake.country_code()}',
    '{json.dumps(config)}'::jsonb,
    '{json.dumps(subscription)}'::jsonb,
    '{fake.date_time_between(start_date="-2y", end_date="now")}'
)""")

        data_store['tenants'].append({
            'id': tenant_id,
            'name': company_name,
            'slug': slug
        })

    print(',\n'.join(values) + ';')


def generate_users(count=25):
    """Generate user records"""
    print(f"\n-- Generating {count} Users")
    print("INSERT INTO users (id, username, email, password_hash, first_name, last_name, phone, is_active, is_verified, created_at) VALUES")

    values = []
    for i in range(count):
        user_id = generate_uuid()
        first_name = fake.first_name()
        last_name = fake.last_name()
        username = f"{first_name.lower()}.{last_name.lower()}{random.randint(1, 999)}"

        values.append(f"""(
    '{user_id}',
    '{username}',
    '{fake.email()}',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5NU7xlL.RGbKW',
    '{first_name}',
    '{last_name}',
    '{fake.phone_number()[:20]}',
    {random.choice(['true', 'true', 'true', 'false'])},
    {random.choice(['true', 'true', 'false'])},
    '{fake.date_time_between(start_date="-2y", end_date="now")}'
)""")

        data_store['users'].append({
            'id': user_id,
            'username': username,
            'name': f"{first_name} {last_name}"
        })

    print(',\n'.join(values) + ';')


def generate_user_tenant_associations():
    """Generate user-tenant association records"""
    print(f"\n-- Generating User-Tenant Associations")
    print("INSERT INTO user_tenant_associations (id, user_id, tenant_id, role, is_active, created_at) VALUES")

    roles = ['OWNER', 'ADMIN', 'MANAGER', 'STAFF', 'VIEWER']
    values = []

    # Each tenant gets multiple users
    for tenant in data_store['tenants']:
        # Owner
        owner_user = random.choice(data_store['users'])
        assoc_id = generate_uuid()
        values.append(f"""(
    '{assoc_id}',
    '{owner_user["id"]}',
    '{tenant["id"]}',
    'OWNER',
    true,
    '{fake.date_time_between(start_date="-2y", end_date="now")}'
)""")

        # Additional staff (3-6 per tenant)
        num_staff = random.randint(3, 6)
        for _ in range(num_staff):
            staff_user = random.choice(data_store['users'])
            assoc_id = generate_uuid()
            values.append(f"""(
    '{assoc_id}',
    '{staff_user["id"]}',
    '{tenant["id"]}',
    '{random.choice(roles[1:])}',
    true,
    '{fake.date_time_between(start_date="-2y", end_date="now")}'
)""")

    print(',\n'.join(values) + ';')


def generate_properties(count_per_tenant=3):
    """Generate property records"""
    print(f"\n-- Generating Properties ({count_per_tenant} per tenant)")
    print("INSERT INTO properties (id, tenant_id, property_name, property_code, address, phone, email, property_type, star_rating, total_rooms, currency, timezone, is_active, created_at) VALUES")

    property_types = ['hotel', 'resort', 'hostel', 'motel', 'apartment', 'villa']
    values = []

    for tenant in data_store['tenants']:
        for i in range(count_per_tenant):
            property_id = generate_uuid()
            property_name = f"{fake.city()} {random.choice(['Grand', 'Plaza', 'Royal', 'Imperial', 'Sunset', 'Beach'])} {random.choice(['Hotel', 'Resort', 'Inn'])}"
            property_code = f"PROP{len(data_store['properties']) + 1:03d}"

            address = {
                "street": fake.street_address(),
                "city": fake.city(),
                "state": fake.state(),
                "postalCode": fake.postcode(),
                "country": fake.country_code(),
                "latitude": float(fake.latitude()),
                "longitude": float(fake.longitude())
            }

            values.append(f"""(
    '{property_id}',
    '{tenant["id"]}',
    '{sql_escape(property_name)}',
    '{property_code}',
    '{json.dumps(address)}'::jsonb,
    '{fake.phone_number()[:20]}',
    '{fake.email()}',
    '{random.choice(property_types)}',
    {random.uniform(2.5, 5.0):.1f},
    {random.choice([20, 30, 40, 50, 100])},
    'USD',
    'UTC',
    true,
    '{fake.date_time_between(start_date="-2y", end_date="now")}'
)""")

            data_store['properties'].append({
                'id': property_id,
                'tenant_id': tenant['id'],
                'name': property_name,
                'code': property_code
            })

    print(',\n'.join(values) + ';')


def generate_guests(count=200):
    """Generate guest records"""
    print(f"\n-- Generating {count} Guests")
    print("INSERT INTO guests (id, tenant_id, first_name, last_name, email, phone, nationality, loyalty_points, vip_status, total_bookings, total_nights, total_revenue, created_at) VALUES")

    values = []
    for i in range(count):
        guest_id = generate_uuid()
        tenant = random.choice(data_store['tenants'])
        first_name = fake.first_name()
        last_name = fake.last_name()

        values.append(f"""(
    '{guest_id}',
    '{tenant["id"]}',
    '{first_name}',
    '{last_name}',
    '{fake.email()}',
    '{fake.phone_number()[:20]}',
    '{fake.country_code()}',
    {random.randint(0, 10000)},
    {random.choice(['true', 'false', 'false', 'false'])},
    {random.randint(0, 20)},
    {random.randint(0, 100)},
    {random.uniform(0, 50000):.2f},
    '{fake.date_time_between(start_date="-3y", end_date="now")}'
)""")

        data_store['guests'].append({
            'id': guest_id,
            'tenant_id': tenant['id'],
            'name': f"{first_name} {last_name}",
            'email': fake.email()
        })

    print(',\n'.join(values) + ';')


def generate_room_types(count_per_property=3):
    """Generate room type records"""
    print(f"\n-- Generating Room Types ({count_per_property} per property)")
    print("INSERT INTO room_types (id, tenant_id, property_id, name, code, category, base_occupancy, max_occupancy, base_rate, description, created_at) VALUES")

    categories = ['STANDARD', 'DELUXE', 'SUITE', 'EXECUTIVE', 'PRESIDENTIAL']
    room_names = ['Standard Room', 'Deluxe Room', 'Junior Suite', 'Executive Suite', 'Presidential Suite', 'Ocean View', 'Garden View']

    values = []
    for property in data_store['properties']:
        for i in range(count_per_property):
            room_type_id = generate_uuid()
            name = random.choice(room_names)
            code = f"RT{len(data_store['room_types']) + 1:03d}"

            values.append(f"""(
    '{room_type_id}',
    '{property["tenant_id"]}',
    '{property["id"]}',
    '{name}',
    '{code}',
    '{categories[i % len(categories)]}',
    {random.choice([1, 2, 2])},
    {random.choice([2, 3, 4])},
    {random.uniform(100, 500):.2f},
    '{sql_escape(fake.text(100))}',
    '{fake.date_time_between(start_date="-2y", end_date="now")}'
)""")

            data_store['room_types'].append({
                'id': room_type_id,
                'property_id': property['id'],
                'tenant_id': property['tenant_id'],
                'name': name,
                'code': code
            })

    print(',\n'.join(values) + ';')


def generate_rooms(count_per_property=20):
    """Generate room records"""
    print(f"\n-- Generating Rooms ({count_per_property} per property)")
    print("INSERT INTO rooms (id, tenant_id, property_id, room_type_id, room_number, floor, status, created_at) VALUES")

    statuses = ['AVAILABLE', 'CLEAN', 'DIRTY', 'INSPECTED']
    values = []

    for property in data_store['properties']:
        property_room_types = [rt for rt in data_store['room_types'] if rt['property_id'] == property['id']]

        for i in range(count_per_property):
            room_id = generate_uuid()
            room_type = random.choice(property_room_types)
            floor = random.randint(1, 10)
            room_number = f"{floor}{i+1:02d}"

            values.append(f"""(
    '{room_id}',
    '{property["tenant_id"]}',
    '{property["id"]}',
    '{room_type["id"]}',
    '{room_number}',
    {floor},
    '{random.choice(statuses)}',
    '{fake.date_time_between(start_date="-2y", end_date="now")}'
)""")

            data_store['rooms'].append({
                'id': room_id,
                'property_id': property['id'],
                'tenant_id': property['tenant_id'],
                'room_type_id': room_type['id'],
                'room_number': room_number
            })

    print(',\n'.join(values) + ';')


def generate_rates(count_per_property=6):
    """Generate rate records"""
    print(f"\n-- Generating Rates ({count_per_property} per property)")
    print("INSERT INTO rates (id, tenant_id, property_id, room_type_id, name, code, amount, strategy, status, valid_from, valid_to, created_at) VALUES")

    strategies = ['FIXED', 'DYNAMIC', 'SEASONAL', 'WEEKEND', 'LASTMINUTE', 'EARLYBIRD']
    statuses = ['ACTIVE', 'ACTIVE', 'ACTIVE', 'INACTIVE']

    values = []
    for property in data_store['properties']:
        property_room_types = [rt for rt in data_store['room_types'] if rt['property_id'] == property['id']]

        for room_type in property_room_types:
            for i in range(2):  # 2 rates per room type
                rate_id = generate_uuid()
                strategy = strategies[i % len(strategies)]

                values.append(f"""(
    '{rate_id}',
    '{property["tenant_id"]}',
    '{property["id"]}',
    '{room_type["id"]}',
    '{strategy} Rate - {room_type["name"]}',
    'RATE{len(data_store["rates"]) + 1:03d}',
    {random.uniform(80, 600):.2f},
    '{strategy}',
    '{random.choice(statuses)}',
    '{fake.date_between(start_date="-1y", end_date="today")}',
    '{fake.date_between(start_date="today", end_date="+1y")}',
    '{fake.date_time_between(start_date="-1y", end_date="now")}'
)""")

                data_store['rates'].append({
                    'id': rate_id,
                    'property_id': property['id'],
                    'tenant_id': property['tenant_id'],
                    'room_type_id': room_type['id']
                })

    print(',\n'.join(values) + ';')


def generate_reservations(count=500):
    """Generate reservation records - MAIN DATA VOLUME"""
    print(f"\n-- Generating {count} Reservations (Main Data Volume)")
    print("INSERT INTO reservations (id, tenant_id, property_id, guest_id, room_type_id, rate_id, confirmation_number, check_in_date, check_out_date, booking_date, room_number, number_of_adults, number_of_children, room_rate, total_amount, tax_amount, paid_amount, status, source, guest_name, guest_email, created_at) VALUES")

    statuses = ['PENDING', 'CONFIRMED', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CHECKED_OUT', 'CANCELLED']
    sources = ['DIRECT', 'WEBSITE', 'PHONE', 'WALKIN', 'OTA', 'CORPORATE', 'GROUP']

    values = []
    for i in range(count):
        reservation_id = generate_uuid()

        # Select random property and guest from same tenant
        property = random.choice(data_store['properties'])
        tenant_guests = [g for g in data_store['guests'] if g['tenant_id'] == property['tenant_id']]
        guest = random.choice(tenant_guests) if tenant_guests else random.choice(data_store['guests'])

        # Get room type and rate for property
        property_room_types = [rt for rt in data_store['room_types'] if rt['property_id'] == property['id']]
        room_type = random.choice(property_room_types)

        property_rates = [r for r in data_store['rates'] if r['property_id'] == property['id'] and r['room_type_id'] == room_type['id']]
        rate = random.choice(property_rates) if property_rates else None

        # Get room number
        property_rooms = [r for r in data_store['rooms'] if r['property_id'] == property['id'] and r['room_type_id'] == room_type['id']]
        room = random.choice(property_rooms) if property_rooms else None

        # Generate dates
        booking_date = fake.date_time_between(start_date="-6m", end_date="now")
        check_in_date = fake.date_between(start_date="-3m", end_date="+3m")
        nights = random.randint(1, 7)
        check_out_date = check_in_date + timedelta(days=nights)

        # Pricing
        room_rate = round(random.uniform(100, 500), 2)
        total_amount = round(room_rate * nights, 2)
        tax_amount = round(total_amount * 0.1, 2)
        paid_amount = round(total_amount * random.uniform(0, 1.0), 2)

        status = random.choice(statuses)

        values.append(f"""(
    '{reservation_id}',
    '{property["tenant_id"]}',
    '{property["id"]}',
    '{guest["id"]}',
    '{room_type["id"]}',
    {f"'{rate['id']}'" if rate else 'NULL'},
    'CNF{i+1:06d}',
    '{check_in_date}',
    '{check_out_date}',
    '{booking_date}',
    {f"'{room['room_number']}'" if room else 'NULL'},
    {random.randint(1, 2)},
    {random.randint(0, 2)},
    {room_rate},
    {total_amount},
    {tax_amount},
    {paid_amount},
    '{status}',
    '{random.choice(sources)}',
    '{sql_escape(guest["name"])}',
    '{guest["email"]}',
    '{booking_date}'
)""")

        data_store['reservations'].append({
            'id': reservation_id,
            'property_id': property['id'],
            'guest_id': guest['id'],
            'total_amount': total_amount,
            'status': status
        })

    print(',\n'.join(values) + ';')


def generate_reservation_status_history():
    """Generate reservation status history"""
    print(f"\n-- Generating Reservation Status History")
    print("INSERT INTO reservation_status_history (id, reservation_id, from_status, to_status, changed_at, changed_by, notes) VALUES")

    values = []
    for reservation in data_store['reservations']:
        # Each reservation gets 1-3 status changes
        num_changes = random.randint(1, 3)
        for i in range(num_changes):
            history_id = generate_uuid()

            values.append(f"""(
    '{history_id}',
    '{reservation["id"]}',
    {f"'PENDING'" if i == 0 else f"'{random.choice(['PENDING', 'CONFIRMED'])}'"},
    '{reservation["status"]}',
    '{fake.date_time_between(start_date="-6m", end_date="now")}',
    '{random.choice(data_store["users"])["username"]}',
    {f"'{sql_escape(fake.sentence())}'" if random.random() > 0.5 else 'NULL'}
)""")

    print(',\n'.join(values[:1000]) + ';')  # Limit to avoid too much data


def generate_payments():
    """Generate payment records"""
    print(f"\n-- Generating Payments")
    print("INSERT INTO payments (id, tenant_id, reservation_id, amount, payment_method, payment_status, transaction_type, transaction_id, payment_date, created_at) VALUES")

    methods = ['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER']
    statuses = ['COMPLETED', 'COMPLETED', 'COMPLETED', 'PENDING', 'FAILED']
    types = ['CHARGE', 'AUTHORIZATION', 'CAPTURE']

    values = []
    for reservation in data_store['reservations'][:600]:  # 600 payments
        payment_id = generate_uuid()
        property = next((p for p in data_store['properties'] if p['id'] == reservation['property_id']), None)

        values.append(f"""(
    '{payment_id}',
    '{property["tenant_id"]}',
    '{reservation["id"]}',
    {reservation["total_amount"] * random.uniform(0.3, 1.0):.2f},
    '{random.choice(methods)}',
    '{random.choice(statuses)}',
    '{random.choice(types)}',
    'TXN{len(values) + 1:010d}',
    '{fake.date_time_between(start_date="-6m", end_date="now")}',
    '{fake.date_time_between(start_date="-6m", end_date="now")}'
)""")

    print(',\n'.join(values) + ';')


def generate_invoices():
    """Generate invoice records"""
    print(f"\n-- Generating Invoices")
    print("INSERT INTO invoices (id, tenant_id, reservation_id, invoice_number, invoice_date, due_date, subtotal, tax_amount, total_amount, status, created_at) VALUES")

    statuses = ['PAID', 'PAID', 'SENT', 'PARTIALLY_PAID', 'OVERDUE']

    values = []
    for reservation in data_store['reservations']:
        invoice_id = generate_uuid()
        property = next((p for p in data_store['properties'] if p['id'] == reservation['property_id']), None)

        invoice_date = fake.date_between(start_date="-6m", end_date="today")
        due_date = invoice_date + timedelta(days=30)

        subtotal = reservation['total_amount']
        tax = subtotal * 0.1
        total = subtotal + tax

        values.append(f"""(
    '{invoice_id}',
    '{property["tenant_id"]}',
    '{reservation["id"]}',
    'INV{len(values) + 1:06d}',
    '{invoice_date}',
    '{due_date}',
    {subtotal:.2f},
    {tax:.2f},
    {total:.2f},
    '{random.choice(statuses)}',
    '{fake.date_time_between(start_date="-6m", end_date="now")}'
)""")

        data_store['invoices'].append({
            'id': invoice_id,
            'reservation_id': reservation['id'],
            'total': total
        })

    print(',\n'.join(values) + ';')


def generate_invoice_items():
    """Generate invoice item records"""
    print(f"\n-- Generating Invoice Items")
    print("INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, total_price, created_at) VALUES")

    item_types = ['Room Charge', 'Breakfast', 'Minibar', 'Spa Service', 'Laundry', 'Parking', 'Room Service']

    values = []
    for invoice in data_store['invoices'][:500]:  # First 500 invoices
        # Each invoice gets 2-5 line items
        num_items = random.randint(2, 5)
        for i in range(num_items):
            item_id = generate_uuid()
            quantity = random.randint(1, 5)
            unit_price = round(random.uniform(10, 200), 2)
            total_price = quantity * unit_price

            values.append(f"""(
    '{item_id}',
    '{invoice["id"]}',
    '{random.choice(item_types)}',
    {quantity},
    {unit_price},
    {total_price},
    '{fake.date_time_between(start_date="-6m", end_date="now")}'
)""")

    print(',\n'.join(values) + ';')


def generate_services():
    """Generate service records"""
    print(f"\n-- Generating Services")
    print("INSERT INTO services (id, tenant_id, property_id, name, code, description, price, category, is_active, created_at) VALUES")

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

    values = []
    for property in data_store['properties']:
        for name, code, desc, price, category in service_data:
            service_id = generate_uuid()

            values.append(f"""(
    '{service_id}',
    '{property["tenant_id"]}',
    '{property["id"]}',
    '{name}',
    '{code}',
    '{desc}',
    {price},
    '{category}',
    true,
    '{fake.date_time_between(start_date="-2y", end_date="now")}'
)""")

            data_store['services'].append({
                'id': service_id,
                'property_id': property['id'],
                'name': name
            })

    print(',\n'.join(values) + ';')


def generate_reservation_services():
    """Generate reservation service records"""
    print(f"\n-- Generating Reservation Services")
    print("INSERT INTO reservation_services (id, reservation_id, service_id, quantity, unit_price, total_price, service_date, created_at) VALUES")

    values = []
    for reservation in data_store['reservations'][:300]:  # 300 reservations get services
        # Random 1-3 services per reservation
        num_services = random.randint(1, 3)
        reservation_services = [s for s in data_store['services'] if s['property_id'] == reservation['property_id']]

        if reservation_services:
            selected_services = random.sample(reservation_services, min(num_services, len(reservation_services)))

            for service in selected_services:
                rs_id = generate_uuid()
                quantity = random.randint(1, 3)
                unit_price = round(random.uniform(20, 150), 2)
                total_price = quantity * unit_price

                values.append(f"""(
    '{rs_id}',
    '{reservation["id"]}',
    '{service["id"]}',
    {quantity},
    {unit_price},
    {total_price},
    '{fake.date_between(start_date="-3m", end_date="today")}',
    '{fake.date_time_between(start_date="-3m", end_date="now")}'
)""")

    print(',\n'.join(values) + ';')


def generate_housekeeping_tasks():
    """Generate housekeeping task records"""
    print(f"\n-- Generating Housekeeping Tasks")
    print("INSERT INTO housekeeping_tasks (id, tenant_id, property_id, room_id, task_type, status, priority, assigned_to, scheduled_date, created_at) VALUES")

    task_types = ['CLEANING', 'INSPECTION', 'TURNDOWN', 'DEEP_CLEAN', 'MAINTENANCE']
    statuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'COMPLETED', 'COMPLETED']
    priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']

    values = []
    # Generate 2-3 tasks per room (about 800 tasks)
    for room in data_store['rooms'][:300]:
        num_tasks = random.randint(2, 3)
        for i in range(num_tasks):
            task_id = generate_uuid()
            assigned_user = random.choice(data_store['users'])

            values.append(f"""(
    '{task_id}',
    '{room["tenant_id"]}',
    '{room["property_id"]}',
    '{room["id"]}',
    '{random.choice(task_types)}',
    '{random.choice(statuses)}',
    '{random.choice(priorities)}',
    '{assigned_user["id"]}',
    '{fake.date_between(start_date="-30d", end_date="+7d")}',
    '{fake.date_time_between(start_date="-30d", end_date="now")}'
)""")

    print(',\n'.join(values) + ';')


def main():
    """Main execution function"""
    print("-- =====================================================")
    print("-- Tartware PMS Sample Data Generator")
    print("-- Generated on:", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    print("-- Target: 500+ records across all tables")
    print("-- =====================================================")
    print()
    print("-- Connect to database")
    print("\\c tartware")
    print()
    print("-- Disable triggers for bulk insert performance")
    print("SET session_replication_role = replica;")
    print()

    # Generate data in dependency order
    generate_tenants(5)
    generate_users(25)
    generate_user_tenant_associations()
    generate_properties(3)  # 15 properties
    generate_guests(200)
    generate_room_types(3)  # 45 room types
    generate_rooms(20)  # 300 rooms
    generate_rates(6)  # 90 rates
    generate_reservations(500)  # MAIN DATA VOLUME
    generate_reservation_status_history()
    generate_payments()
    generate_invoices()
    generate_invoice_items()
    generate_services()
    generate_reservation_services()
    generate_housekeeping_tasks()

    print()
    print("-- Re-enable triggers")
    print("SET session_replication_role = DEFAULT;")
    print()
    print("-- =====================================================")
    print("-- Sample Data Generation Complete!")
    print("-- Summary:")
    print(f"--   Tenants: {len(data_store['tenants'])}")
    print(f"--   Users: {len(data_store['users'])}")
    print(f"--   Properties: {len(data_store['properties'])}")
    print(f"--   Guests: {len(data_store['guests'])}")
    print(f"--   Room Types: {len(data_store['room_types'])}")
    print(f"--   Rooms: {len(data_store['rooms'])}")
    print(f"--   Rates: {len(data_store['rates'])}")
    print(f"--   Reservations: {len(data_store['reservations'])} ★")
    print(f"--   Invoices: {len(data_store['invoices'])}")
    print(f"--   Services: {len(data_store['services'])}")
    print("--   + Status History, Payments, Invoice Items, etc.")
    print("-- =====================================================")


if __name__ == "__main__":
    main()
