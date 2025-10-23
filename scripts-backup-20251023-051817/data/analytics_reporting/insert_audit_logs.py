"""Insert function for audit_logs table"""


from data_store import data_store
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import json
import random


def insert_audit_logs(conn):
    """Insert audit log records"""
    print(f"\n✓ Inserting Audit Logs...")
    cur = conn.cursor()

    event_types = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT']
    entities = ['reservation', 'guest', 'payment', 'user', 'room', 'rate']
    count = 0

    for i in range(200):  # 200 audit logs
        property = random.choice(data_store['properties'])
        user = random.choice(data_store['users'])

        cur.execute("""
            INSERT INTO audit_logs (audit_id, tenant_id, property_id, user_id, event_type, action,
                                   entity_type, entity_id, old_values, new_values, ip_address,
                                   user_agent, audit_timestamp)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            generate_uuid(),
            property['tenant_id'],
            property['id'],
            user['id'],
            random.choice(event_types),
            random.choice(event_types),
            random.choice(entities),
            generate_uuid(),
            json.dumps({"status": "old"}),
            json.dumps({"status": "new"}),
            fake.ipv4(),
            fake.user_agent(),
            fake.date_time_between(start_date="-3m", end_date="now")
        ))
        count += 1

    conn.commit()
    print(f"   → Inserted {count} audit logs")
