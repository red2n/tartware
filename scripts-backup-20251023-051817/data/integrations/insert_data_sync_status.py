"""Insert function for data_sync_status table"""


from data_store import data_store
from datetime import datetime, timedelta
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random


def insert_data_sync_status(conn):
    """Insert data sync status records"""
    print(f"\n✓ Inserting Data Sync Status...")
    cur = conn.cursor()

    sync_types = ['full', 'incremental', 'delta', 'realtime']
    count = 0

    for property in data_store['properties']:
        for sync_type_val in sync_types:
            for i in range(random.randint(5, 15)):
                sync_time = fake.date_time_between(start_date="-7d", end_date="now")
                completed_time = sync_time + timedelta(seconds=random.randint(10, 300))
                records_processed = random.randint(10, 1000)
                status_val = random.choice(['completed', 'completed', 'failed', 'partial'])

                cur.execute("""
                    INSERT INTO data_sync_status (
                        sync_id, tenant_id, property_id,
                        sync_name, sync_type, entity_type,
                        status, started_at, completed_at,
                        records_total, records_processed, records_succeeded
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    generate_uuid(),
                    property['tenant_id'],
                    property['id'],
                    f"{sync_type_val.title()} Sync - {property['name']}",
                    sync_type_val,
                    random.choice(['reservation', 'guest', 'rate', 'availability', 'inventory']),
                    status_val,
                    sync_time,
                    completed_time if status_val != 'running' else None,
                    records_processed,
                    records_processed,
                    records_processed if status_val == 'completed' else random.randint(0, records_processed)
                ))
                count += 1

    conn.commit()
    print(f"   → Inserted {count} data sync status records")
