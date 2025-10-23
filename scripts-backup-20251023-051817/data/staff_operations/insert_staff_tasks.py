"""Insert function for staff_tasks table"""


from data_store import data_store
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random


def insert_staff_tasks(conn):
    """Insert staff task records"""
    print(f"\n✓ Inserting Staff Tasks...")
    cur = conn.cursor()

    task_types = ['housekeeping', 'maintenance', 'inspection', 'delivery', 'guest_request', 'administrative', 'setup', 'breakdown', 'inventory']
    count = 0

    for property in data_store['properties']:
        for i in range(random.randint(30, 80)):
            due_date = fake.date_between(start_date="-7d", end_date="+14d")

            cur.execute("""
                INSERT INTO staff_tasks (
                    task_id, tenant_id, property_id,
                    task_title, task_description, task_type,
                    assigned_to, priority, task_status, due_date
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                f"{random.choice(task_types).replace('_', ' ').title()} Task",
                fake.sentence(),
                random.choice(task_types),
                random.choice(data_store['users'])['id'],
                random.choice(['low', 'normal', 'high', 'urgent']),
                random.choice(['pending', 'assigned', 'in_progress', 'completed', 'cancelled']),
                due_date
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} staff tasks")
