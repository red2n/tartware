"""Insert function for shift_handovers table"""


from data_store import data_store
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random


def insert_shift_handovers(conn):
    """Insert shift handover records"""
    print(f"\n✓ Inserting Shift Handovers...")
    cur = conn.cursor()

    shifts = ['morning', 'afternoon', 'evening', 'night']
    departments = ['front_desk', 'housekeeping', 'maintenance', 'food_beverage', 'management', 'sales', 'security', 'spa', 'concierge', 'other']
    statuses = ['pending', 'in_progress', 'completed', 'acknowledged', 'escalated']
    count = 0

    for property in data_store['properties']:
        for i in range(random.randint(30, 60)):
            shift_date = fake.date_between(start_date="-30d", end_date="now")
            outgoing_shift_idx = random.randint(0, len(shifts)-2)
            incoming_shift_idx = outgoing_shift_idx + 1

            cur.execute("""
                INSERT INTO shift_handovers (
                    handover_id, tenant_id, property_id,
                    shift_date, outgoing_shift, incoming_shift,
                    outgoing_user_id, incoming_user_id,
                    department, handover_status, key_points,
                    current_occupancy_count, rooms_occupied
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                shift_date,
                shifts[outgoing_shift_idx],
                shifts[incoming_shift_idx],
                random.choice(data_store['users'])['id'],
                random.choice(data_store['users'])['id'],
                random.choice(departments),
                random.choice(statuses),
                fake.text(max_nb_chars=500),
                random.randint(50, 200),
                random.randint(50, 200)
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} shift handovers")
