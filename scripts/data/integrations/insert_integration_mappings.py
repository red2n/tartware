"""Insert function for integration_mappings table"""


from data_store import data_store
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import json
import random


def insert_integration_mappings(conn):
    """Insert integration mapping records"""
    print(f"\n✓ Inserting Integration Mappings...")
    cur = conn.cursor()

    integration_types = ['pms', 'channel_manager', 'payment', 'accounting', 'crm', 'analytics', 'other']
    count = 0

    for property in data_store['properties']:
        for integration_type in random.sample(integration_types, random.randint(2, 4)):
            integration_name = f"{integration_type.title().replace('_', ' ')} - {fake.company()}"
            external_system = fake.company()

            cur.execute("""
                INSERT INTO integration_mappings (
                    mapping_id, tenant_id, property_id,
                    integration_name, integration_type, external_system,
                    target_system, source_entity, target_entity,
                    field_mappings, is_active
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                integration_name,
                integration_type,
                external_system,
                'tartware_pms',
                random.choice(['guest', 'reservation', 'payment', 'room']),
                random.choice(['customer', 'booking', 'transaction', 'inventory']),
                json.dumps({
                    'guest_id': 'external_guest_id',
                    'reservation_id': 'booking_ref',
                    'email': 'customer_email'
                }),
                random.choice([True, True, False])
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} integration mappings")
