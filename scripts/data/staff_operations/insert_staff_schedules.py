"""Insert function for staff_schedules table"""


from data_store import data_store
from datetime import datetime, timedelta
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random
import time


def insert_staff_schedules(conn):
    """Insert staff schedule records"""
    print(f"\n✓ Inserting Staff Schedules...")
    cur = conn.cursor()

    shifts = ['morning', 'afternoon', 'evening', 'night']
    departments = ['Front Desk', 'Housekeeping', 'Maintenance', 'Restaurant', 'Management']
    days_of_week = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    count = 0

    for property in data_store['properties']:
        property_users = [u for u in data_store['users'][:10]]

        for days_ahead in range(7):
            schedule_date = datetime.now().date() + timedelta(days=days_ahead)
            day_of_week = days_of_week[schedule_date.weekday()]

            for user in property_users:
                if random.random() < 0.7:
                    shift = random.choice(shifts)
                    # Set shift times that don't go over 24 hours
                    if shift == 'morning':
                        start_hour, end_hour = 6, 14
                    elif shift == 'afternoon':
                        start_hour, end_hour = 14, 22
                    elif shift == 'evening':
                        start_hour, end_hour = 18, 23
                    else:  # night shift
                        start_hour, end_hour = 22, 6  # crosses midnight, we'll handle this

                    scheduled_hours = 8.0

                    cur.execute("""
                        INSERT INTO staff_schedules (
                            schedule_id, tenant_id, property_id,
                            user_id, staff_name, department, shift_type,
                            schedule_date, day_of_week,
                            scheduled_start_time, scheduled_end_time,
                            scheduled_hours, created_at
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, (
                        generate_uuid(),
                        property['tenant_id'],
                        property['id'],
                        user['id'],
                        user['name'],
                        random.choice(departments),
                        shift,
                        schedule_date,
                        day_of_week,
                        f"{start_hour:02d}:00:00",
                        f"{end_hour:02d}:00:00" if end_hour <= 23 else "06:00:00",
                        scheduled_hours,
                        fake.date_time_between(start_date="-7d", end_date="now")
                    ))
                    count += 1

    conn.commit()
    print(f"   → Inserted {count} staff schedules")
