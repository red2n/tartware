"""Insert function for marketing_campaigns table"""


from data_store import data_store
from datetime import datetime, timedelta
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random


def insert_marketing_campaigns(conn):
    """Insert marketing campaign records"""
    print(f"\n✓ Inserting Marketing Campaigns...")
    cur = conn.cursor()

    campaign_types = ['email', 'sms', 'social_media', 'display_ads', 'search_ads', 'direct_mail',
                      'event', 'referral', 'loyalty', 'seasonal', 'promotional']
    statuses = ['active', 'active', 'paused', 'completed', 'draft']
    count = 0

    for property in data_store['properties']:
        for i in range(random.randint(3, 6)):
            start_date = fake.date_between(start_date="-90d", end_date="-30d")
            end_date = start_date + timedelta(days=random.randint(14, 60))

            cur.execute("""
                INSERT INTO marketing_campaigns (
                    campaign_id, tenant_id, property_id,
                    campaign_code, campaign_name, campaign_type, campaign_status,
                    start_date, end_date, budget_amount,
                    actual_spend, created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                f"CAMP{count + 1:05d}",
                f"{fake.catch_phrase()} Campaign",
                random.choice(campaign_types),
                random.choice(statuses),
                start_date,
                end_date,
                round(random.uniform(1000, 10000), 2),
                round(random.uniform(500, 9000), 2),
                fake.date_time_between(start_date="-90d", end_date="-30d")
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} marketing campaigns")
