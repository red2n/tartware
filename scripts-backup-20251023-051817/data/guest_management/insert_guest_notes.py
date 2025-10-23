"""Insert function for guest_notes table"""


from data_store import data_store
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random


def insert_guest_notes(conn):
    """Insert guest note records"""
    print(f"\n✓ Inserting Guest Notes...")
    cur = conn.cursor()

    note_types = ['general', 'preference', 'complaint', 'compliment', 'vip', 'feedback']
    priorities = ['low', 'normal', 'high', 'urgent']

    count = 0
    # 60% of guests have notes
    for guest in data_store['guests'][:120]:
        # Get a property for this guest
        guest_property = next((p for p in data_store['properties'] if p['tenant_id'] == guest['tenant_id']), None)
        if not guest_property:
            continue

        num_notes = random.randint(1, 3)
        for i in range(num_notes):
            cur.execute("""
                INSERT INTO guest_notes (note_id, tenant_id, property_id, guest_id,
                                       note_type, note_text, priority, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                guest['tenant_id'],
                guest_property['id'],
                guest['id'],
                random.choice(note_types),
                fake.paragraph(),
                random.choice(priorities),
                random.choice([u['id'] for u in data_store['users']])
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} guest notes")
