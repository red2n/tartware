"""Insert function for credit_limits table"""


from data_store import data_store
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random


def insert_credit_limits(conn):
    """Insert credit limit records"""
    print(f"\n✓ Inserting Credit Limits...")
    cur = conn.cursor()

    account_types = ['guest', 'company', 'corporate', 'group']
    credit_statuses = ['active', 'pending', 'suspended', 'blocked', 'expired']
    count = 0

    for guest in data_store['guests'][:100]:
        if random.random() < 0.3:  # 30% of guests have credit limits
            effective_from = fake.date_between(start_date="-1y", end_date="-30d")
            effective_to = fake.date_between(start_date="now", end_date="+1y") if random.random() > 0.2 else None
            credit_limit = round(random.uniform(1000, 10000), 2)
            current_balance = round(random.uniform(0, credit_limit * 0.8), 2)

            cur.execute("""
                INSERT INTO credit_limits (
                    credit_limit_id, tenant_id, property_id,
                    account_type, account_id, account_name,
                    guest_id, credit_limit_amount, currency,
                    credit_status, is_active, effective_from, effective_to,
                    current_balance, available_credit
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                guest['tenant_id'],
                guest.get('property_id'),
                'guest',
                guest['id'],
                f"{guest.get('first_name', 'Guest')} {guest.get('last_name', 'Account')}",
                guest['id'],
                credit_limit,
                'USD',
                random.choice(credit_statuses),
                random.choice([True, True, True, False]),
                effective_from,
                effective_to,
                current_balance,
                credit_limit - current_balance
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} credit limits")
