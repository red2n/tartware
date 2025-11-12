"""Create housekeeping tasks to simulate operational workload."""


from data_store import data_store
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random


def insert_housekeeping_tasks(conn):
    """Insert housekeeping task assignments for generated rooms.

    Args:
        conn: psycopg2 connection for writing housekeeping tasks.
    """
    print(f"\n✓ Inserting Housekeeping Tasks...")
    cur = conn.cursor()

    task_types = ['CLEANING', 'INSPECTION', 'TURNDOWN', 'DEEP_CLEAN', 'MAINTENANCE']
    statuses = ['CLEAN', 'DIRTY', 'INSPECTED', 'IN_PROGRESS']
    priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
    count = 0

    # Generate 2-3 tasks per room (about 600-900 tasks)
    for room in data_store['rooms'][:300]:
        num_tasks = random.randint(2, 3)
        for i in range(num_tasks):
            assigned_user = random.choice(data_store['users'])

            cur.execute("""
                INSERT INTO housekeeping_tasks (id, tenant_id, property_id, room_number, task_type,
                                               status, priority, assigned_to, scheduled_date, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                room['tenant_id'],
                room['property_id'],
                room['room_number'],
                random.choice(task_types),
                random.choice(statuses),
                random.choice(priorities),
                assigned_user['id'],
                fake.date_between(start_date="-30d", end_date="+7d"),
                fake.date_time_between(start_date="-30d", end_date="now")
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} housekeeping tasks")
