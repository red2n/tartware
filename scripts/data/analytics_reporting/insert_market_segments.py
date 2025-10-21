"""Insert function for market_segments table"""


from data_store import data_store
from db_config import generate_uuid
from faker import Faker

fake = Faker()


def insert_market_segments(conn):
    """Insert market segment records"""
    print(f"\n✓ Inserting Market Segments...")
    cur = conn.cursor()

    segments = [
        ('Corporate', 'CORP', 'CORPORATE', 'Business travelers'),
        ('Leisure', 'LEISURE', 'LEISURE', 'Vacation guests'),
        ('Group', 'GROUP', 'GROUP', 'Group bookings'),
        ('Government', 'GOV', 'GOVERNMENT', 'Government employees'),
        ('Airline Crew', 'CREW', 'NEGOTIATED', 'Airline crew members'),
    ]

    count = 0
    for property in data_store['properties']:
        for name, code, seg_type, desc in segments:
            cur.execute("""
                INSERT INTO market_segments (segment_id, tenant_id, property_id, segment_name,
                                            segment_code, segment_type, description, is_active, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                name,
                code,
                seg_type,
                desc,
                True,
                fake.date_time_between(start_date="-2y", end_date="now")
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} market segments")
