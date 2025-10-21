"""Insert function for ota_inventory_sync table"""
from data_store import data_store
from datetime import datetime, timedelta
from db_config import generate_uuid
import random
import time


def insert_ota_inventory_sync(conn):
    """Insert OTA inventory synchronization logs"""
    print(f"\n✓ Inserting OTA Inventory Sync...")
    cur = conn.cursor()

    sync_types = ['full', 'incremental', 'on_demand', 'scheduled', 'real_time']
    sync_directions = ['push', 'push', 'push', 'pull', 'bidirectional']
    statuses = ['completed', 'completed', 'completed', 'failed', 'partial']

    count = 0
    # Create sync logs for each OTA configuration (daily for last 30 days)
    for ota_config in data_store.get('ota_configurations', []):
        for days_ago in range(30):
            sync_time = datetime.now() - timedelta(days=days_ago, hours=random.randint(0, 23))

            cur.execute("""
                INSERT INTO ota_inventory_sync (
                    sync_id, tenant_id, property_id,
                    ota_config_id, channel_name, sync_type, sync_direction, sync_status,
                    rooms_synced, rates_synced,
                    sync_started_at, sync_completed_at,
                    created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                ota_config['tenant_id'],
                ota_config['property_id'],
                ota_config['id'],
                ota_config.get('channel_name', 'BOOKING.COM'),
                random.choice(sync_types),
                random.choice(sync_directions),
                random.choice(statuses),
                random.randint(10, 50),
                random.randint(20, 100),
                sync_time,
                sync_time + timedelta(seconds=random.randint(5, 120)),
                sync_time
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} OTA sync logs")
