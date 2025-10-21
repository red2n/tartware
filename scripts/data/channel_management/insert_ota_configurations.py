"""Insert function for ota_configurations table"""
from data_store import data_store
from db_config import generate_uuid


def insert_ota_configurations(conn):
    """Insert OTA configuration records"""
    print(f"\n✓ Inserting OTA Configurations...")
    cur = conn.cursor()

    otas = [
        ('Booking.com', 'BOOKING', True, '15.0'),
        ('Expedia', 'EXPEDIA', True, '18.0'),
        ('Airbnb', 'AIRBNB', True, '14.0'),
    ]

    count = 0
    for property in data_store['properties']:
        for name, code, active, commission in otas:
            config_id = generate_uuid()
            cur.execute("""
                INSERT INTO ota_configurations (id, tenant_id, property_id, ota_name, ota_code,
                                               is_active, commission_percentage, api_endpoint, sync_enabled)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                config_id,
                property['tenant_id'],
                property['id'],
                name,
                code,
                active,
                commission,
                f"https://api.{code.lower()}.com/v1",
                True
            ))
            data_store['ota_configurations'].append({
                'id': config_id,
                'tenant_id': property['tenant_id'],
                'property_id': property['id'],
                'channel_code': code
            })
            count += 1

    conn.commit()
    print(f"   → Inserted {count} OTA configurations")
