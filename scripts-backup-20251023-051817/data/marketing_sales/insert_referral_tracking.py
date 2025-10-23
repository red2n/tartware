"""Insert function for referral_tracking table"""


from data_store import data_store
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random


def insert_referral_tracking(conn):
    """Insert referral tracking records"""
    print(f"\n✓ Inserting Referral Tracking...")
    cur = conn.cursor()

    referral_statuses = ['pending', 'clicked', 'registered', 'qualified', 'converted', 'rewarded', 'expired']
    referrer_types = ['guest', 'staff', 'affiliate', 'influencer', 'partner', 'other']
    count = 0

    for property in data_store['properties']:
        property_guests = [g for g in data_store['guests'] if g['tenant_id'] == property['tenant_id']][:30]

        for i in range(random.randint(10, 25)):
            if len(property_guests) < 2:
                continue

            referrer = random.choice(property_guests)
            status = random.choice(referral_statuses)
            referred_at = fake.date_time_between(start_date="-6m", end_date="now")

            cur.execute("""
                INSERT INTO referral_tracking (
                    referral_id, tenant_id, property_id,
                    referral_code, referrer_type, referrer_id,
                    referrer_name, referrer_email,
                    referral_status, converted,
                    referrer_reward_amount, referee_reward_amount,
                    referred_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                f"REF-{fake.random_number(digits=8)}",
                random.choice(referrer_types),
                referrer['id'],
                referrer['name'],
                referrer['email'],
                status,
                status == 'converted',
                round(random.uniform(10, 100), 2) if status in ['converted', 'rewarded'] else None,
                round(random.uniform(10, 50), 2) if status in ['converted', 'rewarded'] else None,
                referred_at
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} referral tracking records")
