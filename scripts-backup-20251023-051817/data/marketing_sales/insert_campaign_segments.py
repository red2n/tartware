"""Insert function for campaign_segments table"""


from data_store import data_store
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import json
import random


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
