"""Insert function for guest_journey_tracking table"""


from data_store import data_store
from datetime import datetime, timedelta
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import json
import random


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
