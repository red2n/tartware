"""Insert function for night_audit_log table"""
from data_store import data_store
from datetime import datetime, timedelta
from db_config import generate_uuid
import random
import time


def insert_night_audit_log(conn):
    """Insert night audit log records"""
    print(f"\n✓ Inserting Night Audit Log...")
    cur = conn.cursor()

    count = 0
    # Generate 30 days of audit logs for each property
    for property in data_store['properties']:
        for days_ago in range(30):
            business_date = datetime.now().date() - timedelta(days=days_ago)
            audit_run_id = generate_uuid()

            # Create a few audit steps for each day
            for step_num in range(1, 4):
                cur.execute("""
                    INSERT INTO night_audit_log (audit_log_id, tenant_id, property_id,
                                               audit_run_id, business_date,
                                               step_number, step_name,
                                               audit_status, step_status, initiated_by)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    generate_uuid(),
                    property['tenant_id'],
                    property['id'],
                    audit_run_id,
                    business_date,
                    step_num,
                    ['Room Status Update', 'Revenue Posting', 'Report Generation'][step_num - 1],
                    'STARTED',  # audit_status - use STARTED to avoid COMPLETED constraints
                    'PENDING',  # step_status - use PENDING to avoid COMPLETED constraints
                    random.choice([u['id'] for u in data_store['users']])
                ))
                count += 1

    conn.commit()
    print(f"   → Inserted {count} audit log entries")


# ============================================================================
# BATCH 4: Revenue Management & Operations (8 new tables)
# ============================================================================
