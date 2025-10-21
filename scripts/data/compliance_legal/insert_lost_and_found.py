"""Insert function for lost_and_found table"""


from data_store import data_store
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random


def insert_lost_and_found(conn):
    """Insert lost and found records"""
    print(f"\n✓ Inserting Lost and Found...")
    cur = conn.cursor()

    item_categories = ['electronics', 'clothing', 'jewelry', 'documents', 'accessories', 'bags', 'wallets', 'phones', 'watches', 'glasses', 'other']
    statuses = ['registered', 'stored', 'claimed', 'returned', 'pending_claim', 'donated', 'disposed']
    count = 0

    for property in data_store['properties']:
        property_rooms = [r for r in data_store['rooms'] if r['property_id'] == property['id']][:20]

        for i in range(random.randint(10, 20)):
            found_date = fake.date_between(start_date="-60d", end_date="now")
            category = random.choice(item_categories)

            # Generate item name based on category
            item_names = {
                'electronics': ['Phone', 'Laptop', 'Tablet', 'Charger', 'Headphones', 'Camera'],
                'clothing': ['Jacket', 'Shirt', 'Pants', 'Shoes', 'Hat', 'Scarf'],
                'jewelry': ['Ring', 'Necklace', 'Bracelet', 'Watch', 'Earrings'],
                'documents': ['Passport', 'ID Card', 'Wallet', 'Credit Card', 'Driver License'],
                'accessories': ['Bag', 'Sunglasses', 'Umbrella', 'Keys', 'Book'],
                'bags': ['Backpack', 'Handbag', 'Suitcase', 'Briefcase'],
                'wallets': ['Wallet', 'Purse', 'Card Holder'],
                'phones': ['iPhone', 'Samsung Phone', 'Mobile Phone'],
                'watches': ['Watch', 'Smart Watch'],
                'glasses': ['Sunglasses', 'Reading Glasses', 'Prescription Glasses'],
                'other': ['Item', 'Belonging', 'Object', 'Article']
            }
            item_name = random.choice(item_names.get(category, ['Item']))

            cur.execute("""
                INSERT INTO lost_and_found (
                    item_id, tenant_id, property_id,
                    room_id, item_name, item_description, item_category,
                    found_date, found_location, item_status,
                    found_by, created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                random.choice(property_rooms)['id'] if property_rooms else None,
                item_name,
                fake.sentence()[:200],
                category,
                found_date,
                random.choice(['Room', 'Lobby', 'Restaurant', 'Pool', 'Gym', 'Parking']),
                random.choice(statuses),
                random.choice(data_store['users'])['id'],
                fake.date_time_between(start_date="-60d", end_date="now")
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} lost and found items")
