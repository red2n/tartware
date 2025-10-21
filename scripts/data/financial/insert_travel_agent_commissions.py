"""Insert function for travel_agent_commissions table"""

from data_store import data_store
from db_config import generate_uuid
from faker import Faker
import random

fake = Faker()


def insert_travel_agent_commissions(conn):
    """Insert travel agent commissions records"""

    if not data_store.get('reservations') or not data_store.get('companies'):
        print("\n⚠ Skipping Travel Agent Commissions (no reservations or companies)")
        return

    print(f"\n✓ Inserting Travel Agent Commissions...")
    cur = conn.cursor()

    commission_types = ['percentage', 'flat_rate', 'tiered']
    payment_statuses = ['pending', 'approved', 'paid', 'on_hold']

    count = 0
    # 20% of reservations have travel agent commissions
    for reservation in random.sample(data_store['reservations'], min(100, len(data_store['reservations']))):
        commission_id = generate_uuid()

        # Get a company for this tenant (travel agency)
        tenant_companies = [c for c in data_store.get('companies', [])
                           if c.get('tenant_id') == reservation['tenant_id']]
        if not tenant_companies:
            continue

        company = random.choice(tenant_companies)

        # Revenue breakdown
        room_revenue = round(random.uniform(500, 3000), 2)
        food_revenue = round(random.uniform(0, 500), 2)
        beverage_revenue = round(random.uniform(0, 300), 2)
        spa_revenue = round(random.uniform(0, 500), 2)
        other_revenue = round(random.uniform(0, 200), 2)
        total_revenue = room_revenue + food_revenue + beverage_revenue + spa_revenue + other_revenue

        # Commission rates and calculation
        commission_type = random.choice(commission_types)
        room_rate = round(random.uniform(8, 15), 2)
        fb_rate = round(random.uniform(5, 10), 2)
        spa_rate = round(random.uniform(10, 15), 2)
        overall_rate = round(random.uniform(10, 12), 2)

        # Calculate individual commissions
        room_commission = round(room_revenue * room_rate / 100, 2)
        fb_commission = round((food_revenue + beverage_revenue) * fb_rate / 100, 2)
        spa_commission = round(spa_revenue * spa_rate / 100, 2)
        other_commission = round(other_revenue * overall_rate / 100, 2)
        gross_commission = room_commission + fb_commission + spa_commission + other_commission

        # Adjustments
        adjustment = round(random.uniform(-50, 50), 2) if random.random() > 0.8 else 0
        tax_deducted = round(gross_commission * 0.02, 2) if random.random() > 0.7 else 0

        payment_status = random.choice(payment_statuses)

        cur.execute("""
            INSERT INTO travel_agent_commissions (
                commission_id, tenant_id, property_id,
                company_id, reservation_id,
                room_revenue, food_revenue, beverage_revenue,
                spa_revenue, other_revenue, total_revenue,
                commission_type,
                room_commission_rate, food_beverage_commission_rate,
                spa_commission_rate, overall_commission_rate,
                room_commission, food_beverage_commission,
                spa_commission, other_commission,
                gross_commission,
                adjustment_amount, tax_deducted,
                payment_status,
                created_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            commission_id, reservation['tenant_id'], reservation['property_id'],
            company['id'], reservation['id'],
            room_revenue, food_revenue, beverage_revenue,
            spa_revenue, other_revenue, total_revenue,
            commission_type,
            room_rate, fb_rate, spa_rate, overall_rate,
            room_commission, fb_commission, spa_commission, other_commission,
            gross_commission,
            adjustment, tax_deducted,
            payment_status,
            fake.date_time_between(start_date='-1y', end_date='now')
        ))
        count += 1

    conn.commit()
    print(f"   → Inserted {count} travel agent commissions")
