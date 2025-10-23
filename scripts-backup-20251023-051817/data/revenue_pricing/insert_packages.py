"""Insert function for packages table"""

from data_store import data_store
from db_config import generate_uuid
from faker import Faker
import random
from datetime import timedelta, date

fake = Faker()


def insert_packages(conn, count=40):
    """Insert package records (room + service bundles)"""
    print(f"\n✓ Inserting {count} Packages...")
    cur = conn.cursor()

    package_types = [
        'bed_and_breakfast', 'half_board', 'full_board', 'all_inclusive',
        'romance', 'spa', 'golf', 'family', 'business', 'weekend_getaway',
        'extended_stay', 'seasonal'
    ]

    pricing_models = ['per_night', 'per_stay', 'per_person', 'per_person_per_night', 'flat_rate']

    for i in range(count):
        package_id = generate_uuid()
        tenant = random.choice(data_store['tenants'])
        property_obj = random.choice([p for p in data_store['properties'] if p['tenant_id'] == tenant['id']])

        package_type = random.choice(package_types)
        package_name = f"{package_type.replace('_', ' ').title()} Package"
        package_code = f"PKG-{fake.numerify('######')}"

        # Validity dates
        valid_from = date.today() + timedelta(days=random.randint(-30, 30))
        valid_to = valid_from + timedelta(days=random.randint(90, 365))

        # Requirements
        min_nights = random.choice([1, 2, 2, 3, 3, 5, 7])
        max_nights = min_nights + random.randint(3, 14) if random.random() > 0.5 else None

        # Pricing based on package type
        if package_type == 'all_inclusive':
            base_price = round(random.uniform(300, 800), 2)
        elif package_type in ['spa', 'golf']:
            base_price = round(random.uniform(250, 600), 2)
        elif package_type in ['romance', 'weekend_getaway']:
            base_price = round(random.uniform(200, 500), 2)
        elif package_type in ['bed_and_breakfast', 'half_board']:
            base_price = round(random.uniform(150, 350), 2)
        else:
            base_price = round(random.uniform(120, 400), 2)

        pricing_model = random.choice(pricing_models)

        # Day restrictions (some packages only on weekends, etc.)
        if package_type == 'weekend_getaway':
            available_monday = False
            available_tuesday = False
            available_wednesday = False
            available_thursday = False
            available_friday = True
            available_saturday = True
            available_sunday = True
        elif package_type == 'business':
            available_monday = True
            available_tuesday = True
            available_wednesday = True
            available_thursday = True
            available_friday = True
            available_saturday = False
            available_sunday = False
        else:
            # All days available
            available_monday = True
            available_tuesday = True
            available_wednesday = True
            available_thursday = True
            available_friday = True
            available_saturday = True
            available_sunday = True

        cur.execute("""
            INSERT INTO packages (
                package_id, tenant_id, property_id,
                package_name, package_code, package_type,
                short_description, full_description,
                valid_from, valid_to,
                min_nights, max_nights,
                min_advance_booking_days, max_advance_booking_days,
                min_guests, max_guests,
                pricing_model, base_price, adult_price, child_price,
                discount_percentage, commissionable, commission_percentage,
                available_monday, available_tuesday, available_wednesday, available_thursday,
                available_friday, available_saturday, available_sunday,
                featured, display_order,
                free_cancellation_days, cancellation_fee_percentage,
                is_active, created_at
            )
            VALUES (
                %s, %s, %s,
                %s, %s, %s,
                %s, %s,
                %s, %s,
                %s, %s,
                %s, %s,
                %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s,
                %s, %s,
                %s, %s
            )
        """, (
            package_id, tenant['id'], property_obj['id'],
            package_name, package_code, package_type,
            fake.text(max_nb_chars=200), fake.text(max_nb_chars=500),
            valid_from, valid_to,
            min_nights, max_nights,
            random.choice([0, 1, 3, 7, 14]), random.choice([None, 90, 180, 365]),
            1, random.choice([2, 4, 6, 8]),
            pricing_model, base_price,
            round(base_price * 0.8, 2) if pricing_model == 'per_person' else None,
            round(base_price * 0.5, 2) if pricing_model == 'per_person' else None,
            round(random.uniform(0, 25), 2), True, round(random.uniform(10, 15), 2),
            available_monday, available_tuesday, available_wednesday, available_thursday,
            available_friday, available_saturday, available_sunday,
            random.choice([True, False, False, False]), random.randint(1, 100),
            random.choice([1, 3, 7, 14]), round(random.uniform(10, 50), 2),
            True, fake.date_time_between(start_date='-6m', end_date='now')
        ))

        data_store['packages'].append({
            'id': package_id,
            'tenant_id': tenant['id'],
            'property_id': property_obj['id'],
            'package_code': package_code,
            'package_name': package_name,
            'package_type': package_type
        })

    conn.commit()
    print(f"   → Inserted {count} packages")
