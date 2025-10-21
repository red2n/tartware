"""Insert function for commission_rules table"""

from data_store import data_store
from db_config import generate_uuid
from faker import Faker
import random

fake = Faker()


def insert_commission_rules(conn):
    """Insert commission rules records"""
    print(f"\n✓ Inserting Commission Rules...")
    cur = conn.cursor()


    count = 0
    for tenant in data_store['tenants']:
        properties_for_tenant = [p for p in data_store['properties'] if p['tenant_id'] == tenant['id']]

        # Each tenant has 5-8 commission rules
        for i in range(random.randint(5, 8)):
            rule_id = generate_uuid()
            property_id = random.choice(properties_for_tenant)['id'] if random.random() > 0.5 else None

            # Commission rates
            room_rate = round(random.uniform(8.0, 15.0), 2)
            fb_rate = round(random.uniform(5.0, 10.0), 2)
            spa_rate = round(random.uniform(10.0, 20.0), 2)
            other_rate = round(random.uniform(5.0, 12.0), 2)

            cur.execute("""
                INSERT INTO commission_rules (
                    rule_id, tenant_id, property_id,
                    rule_name, rule_description,
                    effective_from,
                    room_commission_rate,
                    food_beverage_commission_rate,
                    spa_commission_rate,
                    other_commission_rate,
                    exclude_taxes, exclude_fees,
                    is_active, created_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                rule_id, tenant['id'], property_id,
                f"Commission Rule {i+1} - {fake.word().title()} Program",
                fake.sentence(nb_words=12),
                fake.date_between(start_date='-2y', end_date='-1m'),
                room_rate, fb_rate, spa_rate, other_rate,
                True, True,
                True, fake.date_time_between(start_date='-2y', end_date='now')
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} commission rules")
