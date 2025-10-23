"""Insert function for app_usage_analytics table"""


from data_store import data_store
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import json
import random


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
