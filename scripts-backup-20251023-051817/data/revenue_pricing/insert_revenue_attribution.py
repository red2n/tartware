"""Insert function for revenue_attribution table"""


from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random


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
