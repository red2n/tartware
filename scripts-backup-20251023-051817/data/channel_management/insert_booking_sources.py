"""Insert function for booking_sources table"""
from data_store import data_store
from db_config import generate_uuid


def insert_booking_sources(conn):
    """Insert booking source records"""
    print(f"\n✓ Inserting Booking Sources...")
    cur = conn.cursor()

    sources = [
        ('Direct Website', 'DIRECT', 'DIRECT', 0.00),
        ('Booking.com', 'BOOKING', 'OTA', 15.00),
        ('Expedia', 'EXPEDIA', 'OTA', 18.00),
        ('Airbnb', 'AIRBNB', 'OTA', 14.00),
        ('Phone', 'PHONE', 'PHONE', 0.00),
        ('Walk-in', 'WALKIN', 'WALK_IN', 0.00),
    ]

    count = 0
    for property in data_store['properties']:
        for name, code, channel_type, commission in sources:
            cur.execute("""
                INSERT INTO booking_sources (source_id, tenant_id, property_id, source_name,
                                            source_code, source_type, commission_percentage, is_active)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                name,
                code,
                channel_type,
                commission,
                True
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} booking sources")
