"""Insert function for maintenance_requests table"""


from data_store import data_store
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random


def insert_maintenance_requests(conn):
    """Insert maintenance request records"""
    print(f"\n✓ Inserting Maintenance Requests...")
    cur = conn.cursor()

    request_types = ['PREVENTIVE', 'CORRECTIVE', 'EMERGENCY', 'INSPECTION']
    categories = ['PLUMBING', 'ELECTRICAL', 'HVAC', 'FURNITURE', 'APPLIANCE', 'OTHER']
    priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
    statuses = ['OPEN', 'OPEN', 'OPEN', 'CANCELLED']  # Use OPEN to avoid complex constraints

    count = 0
    # Generate 2-3 requests per property
    for property in data_store['properties']:
        property_rooms = [r for r in data_store['rooms'] if r['property_id'] == property['id']]
        if not property_rooms:
            continue

        num_requests = random.randint(2, 3)
        for i in range(num_requests):
            room = random.choice(property_rooms)
            cur.execute("""
                INSERT INTO maintenance_requests (request_id, tenant_id, property_id, room_number,
                                                 request_type, issue_category, priority,
                                                 request_status, issue_description,
                                                 reported_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                room['room_number'],
                random.choice(request_types),
                random.choice(categories),
                random.choice(priorities),
                random.choice(statuses),
                fake.sentence(nb_words=10),
                random.choice([u['id'] for u in data_store['users']])
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} maintenance requests")
