"""Insert function for demand_calendar table"""


from data_store import data_store
from datetime import datetime, timedelta
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random
import time


def insert_demand_calendar(conn):
    """Insert demand calendar records"""
    print(f"\n✓ Inserting Demand Calendar...")
    cur = conn.cursor()

    demand_levels = ['very_low', 'low', 'moderate', 'high', 'very_high']
    days_of_week = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

    count = 0
    # Create demand calendar for each property (90 days forward)
    for property in data_store['properties']:
        # Get total rooms for this property
        total_rooms = sum(1 for r in data_store['rooms'] if r['property_id'] == property['id'])

        for days_ahead in range(90):
            calendar_date = datetime.now().date() + timedelta(days=days_ahead)

            # Higher demand on weekends
            is_weekend = calendar_date.weekday() >= 5
            demand = random.choice(['high', 'very_high']) if is_weekend else random.choice(demand_levels)
            day_name = days_of_week[calendar_date.weekday()]

            cur.execute("""
                INSERT INTO demand_calendar (
                    demand_id, tenant_id, property_id,
                    calendar_date, day_of_week, demand_level,
                    rooms_available, is_weekend, is_special_period,
                    special_period_name
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                calendar_date,
                day_name,
                demand,
                total_rooms,
                is_weekend,
                random.random() < 0.1,  # 10% are special periods
                fake.catch_phrase() if random.random() < 0.1 else None
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} demand calendar entries")
