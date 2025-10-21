"""Insert function for guest_loyalty_programs table"""


from data_store import data_store
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random


def insert_guest_loyalty_programs(conn):
    """Insert guest loyalty program records"""
    print(f"\n✓ Inserting Guest Loyalty Programs...")
    cur = conn.cursor()

    tiers = ['bronze', 'silver', 'gold', 'platinum', 'diamond']

    count = 0
    # 40% of guests are loyalty members
    for guest in data_store['guests'][:80]:
        points = random.randint(100, 5000)
        tier = random.choice(tiers)
        enrollment_date = fake.date_between(start_date="-2y", end_date="-1m")

        cur.execute("""
            INSERT INTO guest_loyalty_programs (program_id, tenant_id, guest_id, program_name,
                                               membership_number, program_tier, points_balance,
                                               enrollment_date, membership_status, total_stays,
                                               total_nights, is_active)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            generate_uuid(),
            guest['tenant_id'],
            guest['id'],
            'Tartware Rewards',
            f"TR{fake.random_int(100000, 999999)}",
            tier,
            points,
            enrollment_date,
            'active',
            random.randint(1, 20),
            random.randint(5, 100),
            True
        ))
        count += 1

    conn.commit()
    print(f"   → Inserted {count} loyalty memberships")
