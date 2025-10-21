"""Insert function for revenue_goals table"""


from data_store import data_store
from datetime import datetime, timedelta
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random
import time


def insert_revenue_goals(conn):
    """Insert revenue goal records"""
    print(f"\n✓ Inserting Revenue Goals...")
    cur = conn.cursor()

    goal_types = ['total_revenue', 'room_revenue', 'fb_revenue', 'occupancy', 'adr', 'revpar', 'rooms_sold']
    count = 0

    for property in data_store['properties']:
        for months_ahead in range(12):
            start_date = datetime.now().date() + timedelta(days=months_ahead * 30)
            end_date = start_date + timedelta(days=29)

            cur.execute("""
                INSERT INTO revenue_goals (
                    goal_id, tenant_id, property_id,
                    goal_period, period_start_date, period_end_date,
                    goal_type, goal_amount, occupancy_goal_percent,
                    adr_goal, revpar_goal, actual_amount, created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                'monthly',
                start_date,
                end_date,
                random.choice(goal_types),
                round(random.uniform(50000, 200000), 2),
                round(random.uniform(70, 95), 2),
                round(random.uniform(150, 350), 2),
                round(random.uniform(100, 300), 2),
                round(random.uniform(45000, 195000), 2) if months_ahead < 2 else 0.00,
                fake.date_time_between(start_date="-90d", end_date="-30d")
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} revenue goals")
