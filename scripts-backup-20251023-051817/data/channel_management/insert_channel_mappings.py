"""Insert function for channel_mappings table"""
from data_store import data_store
from db_config import generate_uuid


def insert_channel_mappings(conn):
    """Insert channel mapping records"""
    print(f"\n✓ Inserting Channel Mappings...")
    cur = conn.cursor()

    channels = ['BOOKING', 'EXPEDIA', 'AIRBNB']

    count = 0
    # Map room types to OTA channels
    for room_type in data_store['room_types']:
        for channel in channels:
            cur.execute("""
                INSERT INTO channel_mappings (id, tenant_id, property_id, channel_name,
                                             channel_code, entity_type, entity_id,
                                             external_id, is_active)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                room_type['tenant_id'],
                room_type['property_id'],
                channel,
                channel,
                'ROOM_TYPE',
                room_type['id'],
                f"{channel}_{room_type['code']}",
                True
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} channel mappings")


# def insert_availability(conn):
#     """Insert room availability records - TABLE DOES NOT EXIST"""
#     # Availability table not found in schema - skipping
#     pass
