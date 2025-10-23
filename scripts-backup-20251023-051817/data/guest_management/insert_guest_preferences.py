"""Insert function for guest_preferences table"""
from data_store import data_store
from db_config import generate_uuid
import random


def insert_guest_preferences(conn):
    """Insert guest preference records"""
    print(f"\n✓ Inserting Guest Preferences...")
    cur = conn.cursor()

    preferences = [
        ('ROOM', 'BED_TYPE', ['King Bed', 'Queen Bed', 'Twin Beds', 'Double Bed']),
        ('ROOM', 'PILLOW_TYPE', ['Soft Pillow', 'Firm Pillow', 'Memory Foam', 'Feather Pillow']),
        ('ROOM', 'FLOOR_LEVEL', ['Low Floor', 'High Floor', 'Ground Floor']),
        ('SERVICE', 'TURNDOWN_SERVICE', ['Yes', 'No']),
        ('ROOM', 'VIEW', ['Ocean View', 'City View', 'Garden View', 'No Preference']),
        ('DIETARY', 'BREAKFAST_PREFERENCE', ['Continental', 'American', 'Vegan', 'Gluten-Free']),
        ('COMMUNICATION', 'CONTACT_METHOD', ['Email', 'Phone', 'SMS'])
    ]

    count = 0
    # Each guest gets 2-4 preferences
    for guest in data_store['guests'][:150]:
        num_prefs = random.randint(2, 4)
        selected_prefs = random.sample(preferences, min(num_prefs, len(preferences)))

        for pref_category, pref_type, pref_values in selected_prefs:
            cur.execute("""
                INSERT INTO guest_preferences (preference_id, tenant_id, guest_id, preference_category,
                                              preference_type, preference_value, priority)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                guest['tenant_id'],
                guest['id'],
                pref_category,
                pref_type,
                random.choice(pref_values),
                random.choice([1, 2, 3])  # 1=HIGH, 2=MEDIUM, 3=LOW
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} guest preferences")
