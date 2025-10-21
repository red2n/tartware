"""Insert function for push_notifications table"""


from data_store import data_store
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random


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
