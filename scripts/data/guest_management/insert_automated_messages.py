"""Insert function for automated_messages table"""


from data_store import data_store
from db_config import generate_uuid
from faker import Faker

fake = Faker()


def insert_automated_messages(conn):
    """Insert automated message configurations"""
    print(f"\n✓ Inserting Automated Messages...")
    cur = conn.cursor()

    count = 0
    # Create automated message configurations for each property
    for property in data_store['properties']:
        # Pre-arrival message
        cur.execute("""
            INSERT INTO automated_messages (
                message_id, tenant_id, property_id,
                message_name, trigger_type, message_channel,
                is_active, send_timing, delay_hours,
                created_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            generate_uuid(),
            property['tenant_id'],
            property['id'],
            "Pre-Arrival Welcome",
            'pre_arrival',
            'email',
            True,
            'delayed',
            48,
            fake.date_time_between(start_date="-90d", end_date="-30d")
        ))
        count += 1

        # Check-in reminder
        cur.execute("""
            INSERT INTO automated_messages (
                message_id, tenant_id, property_id,
                message_name, trigger_type, message_channel,
                is_active, send_timing, send_before_event_hours,
                created_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            generate_uuid(),
            property['tenant_id'],
            property['id'],
            "Check-In Reminder",
            'checkin_reminder',
            'sms',
            True,
            'scheduled',
            4,
            fake.date_time_between(start_date="-90d", end_date="-30d")
        ))
        count += 1

    conn.commit()
    print(f"   → Inserted {count} automated message configs")


# ============================================================================
# BATCH 5: Revenue Management & Pricing (8 new tables)
# ============================================================================
