"""Insert function for qr_codes table"""


from data_store import data_store
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random


def insert_qr_codes(conn):
    """Insert QR code records"""
    print(f"\n✓ Inserting QR Codes...")
    cur = conn.cursor()

    code_types = ['menu', 'feedback', 'wifi', 'checkin', 'room_service', 'payment']
    count = 0

    for property in data_store['properties']:
        for code_type in code_types:
            for i in range(random.randint(2, 8)):
                cur.execute("""
                    INSERT INTO qr_codes (
                        qr_code_id, tenant_id, property_id,
                        code_value, code_type, location,
                        target_url, scan_count, is_active
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    generate_uuid(),
                    property['tenant_id'],
                    property['id'],
                    f"QR-{fake.uuid4()[:16].upper()}",
                    code_type,
                    f"{property['name']} - {code_type.title()} #{i+1}",
                    fake.url(),
                    random.randint(0, 500),
                    random.choice([True, True, True, False])
                ))
                count += 1

    conn.commit()
    print(f"   → Inserted {count} QR codes")
