"""Insert function for webhook_subscriptions table"""


from data_store import data_store
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random


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
