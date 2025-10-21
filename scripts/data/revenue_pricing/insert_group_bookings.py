"""Insert function for group_bookings table"""

from data_store import data_store
from db_config import generate_uuid
from faker import Faker
import random
from datetime import timedelta

fake = Faker()


def insert_group_bookings(conn, count=30):
    """Insert group booking records"""
    print(f"\n✓ Inserting {count} Group Bookings...")
    cur = conn.cursor()

    group_types = [
        'conference', 'wedding', 'corporate', 'tour_group',
        'sports_team', 'reunion', 'convention', 'government',
        'airline_crew', 'educational'
    ]

    block_statuses = ['definite'] * 40 + ['confirmed'] * 30 + ['tentative'] * 20 + ['inquiry'] * 10

    for i in range(count):
        group_booking_id = generate_uuid()
        tenant = random.choice(data_store['tenants'])
        property_obj = random.choice([p for p in data_store['properties'] if p['tenant_id'] == tenant['id']])

        group_type = random.choice(group_types)
        group_name = f"{fake.company()} {group_type.replace('_', ' ').title()}"
        group_code = f"GRP-{fake.numerify('######')}"

        # Select company if available
        company_id = None
        if data_store.get('companies') and group_type in ['corporate', 'conference', 'convention', 'government']:
            companies_for_tenant = [c for c in data_store['companies'] if c['tenant_id'] == tenant['id']]
            if companies_for_tenant:
                company = random.choice(companies_for_tenant)
                company_id = company['id']

        # Dates
        arrival_date = fake.date_between(start_date='+30d', end_date='+180d')
        nights = random.randint(2, 5)
        departure_date = arrival_date + timedelta(days=nights)
        cutoff_days = random.randint(14, 45)
        cutoff_date = arrival_date - timedelta(days=cutoff_days)
        rooming_list_deadline = arrival_date - timedelta(days=random.randint(7, 21))

        # Room counts
        total_rooms_requested = random.randint(10, 100)
        total_rooms_blocked = total_rooms_requested
        total_rooms_picked = random.randint(int(total_rooms_requested * 0.6), total_rooms_requested)
        total_rooms_confirmed = random.randint(int(total_rooms_picked * 0.8), total_rooms_picked)

        # Rates
        avg_rate = round(random.uniform(120, 350), 2)
        estimated_revenue = round(avg_rate * total_rooms_confirmed * nights, 2)

        block_status = random.choice(block_statuses)

        cur.execute("""
            INSERT INTO group_bookings (
                group_booking_id, tenant_id, property_id,
                group_name, group_code, group_type,
                company_id, organization_name, event_name, event_type,
                contact_name, contact_title, contact_email, contact_phone,
                arrival_date, departure_date,
                total_rooms_requested, total_rooms_blocked, total_rooms_picked, total_rooms_confirmed,
                cutoff_date, cutoff_days_before_arrival, release_unsold_rooms,
                block_status,
                rooming_list_received, rooming_list_deadline,
                estimated_room_revenue, estimated_fb_revenue, estimated_total_revenue,
                special_requests,
                is_active, created_at
            )
            VALUES (
                %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s,
                %s,
                %s, %s,
                %s, %s, %s,
                %s,
                %s, %s
            )
        """, (
            group_booking_id, tenant['id'], property_obj['id'],
            group_name, group_code, group_type,
            company_id, fake.company(), f"{group_type.replace('_', ' ').title()} Event", group_type,
            fake.name(), fake.job(), fake.email(), fake.phone_number()[:20],
            arrival_date, departure_date,
            total_rooms_requested, total_rooms_blocked, total_rooms_picked, total_rooms_confirmed,
            cutoff_date, cutoff_days, True,
            block_status,
            block_status in ['confirmed', 'definite'], rooming_list_deadline,
            estimated_revenue, round(estimated_revenue * 0.3, 2), round(estimated_revenue * 1.3, 2),
            fake.text(max_nb_chars=200) if random.random() > 0.5 else None,
            True, fake.date_time_between(start_date='-180d', end_date='now')
        ))

        data_store['group_bookings'].append({
            'id': group_booking_id,
            'tenant_id': tenant['id'],
            'property_id': property_obj['id'],
            'group_code': group_code,
            'group_name': group_name
        })

    conn.commit()
    print(f"   → Inserted {count} group bookings")
