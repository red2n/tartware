"""Insert function for commission_statements table"""

from data_store import data_store
from db_config import generate_uuid
from faker import Faker
import random

fake = Faker()


def insert_commission_statements(conn):
    """Insert commission statements records"""

    # Check if we have companies
    if not data_store.get('companies'):
        print("\n⚠ Skipping Commission Statements (no companies)")
        return

    print(f"\n✓ Inserting Commission Statements...")
    cur = conn.cursor()

    payment_statuses = ['pending', 'approved', 'paid', 'on_hold']

    count = 0
    for tenant in data_store['tenants']:
        # Get companies for this tenant
        tenant_companies = [c for c in data_store.get('companies', [])
                           if c.get('tenant_id') == tenant['id']]

        if not tenant_companies:
            continue

        properties_for_tenant = [p for p in data_store['properties'] if p['tenant_id'] == tenant['id']]

        # Create 3-6 statements per tenant
        for i in range(random.randint(3, 6)):
            statement_id = generate_uuid()
            company = random.choice(tenant_companies)
            property_id = random.choice(properties_for_tenant)['id'] if random.random() > 0.5 else None

            statement_date = fake.date_between(start_date='-6m', end_date='now')
            period_start = fake.date_between(start_date='-12m', end_date=statement_date)
            period_end = fake.date_between(start_date=period_start, end_date=statement_date)

            # Financial amounts
            total_bookings = random.randint(10, 100)
            total_room_nights = total_bookings * random.randint(2, 5)
            total_revenue = round(random.uniform(5000, 50000), 2)
            gross_commission = round(total_revenue * random.uniform(0.10, 0.20), 2)
            adjustments = round(random.uniform(-500, 500), 2) if random.random() > 0.7 else 0
            deductions = round(random.uniform(0, 200), 2) if random.random() > 0.8 else 0
            net_commission = gross_commission + adjustments - deductions

            payment_status = random.choice(payment_statuses)
            payment_date = fake.date_between(start_date=statement_date, end_date='now') if payment_status == 'paid' else None

            cur.execute("""
                INSERT INTO commission_statements (
                    statement_id, tenant_id, property_id, company_id,
                    statement_number, statement_date,
                    period_start_date, period_end_date,
                    total_bookings, total_room_nights,
                    total_revenue, total_gross_commission,
                    total_adjustments, total_deductions,
                    total_net_commission,
                    payment_status, payment_date,
                    is_finalized,
                    created_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                statement_id, tenant['id'], property_id, company['id'],
                f"STMT-{statement_date.strftime('%Y%m')}-{fake.numerify('####')}",
                statement_date, period_start, period_end,
                total_bookings, total_room_nights,
                total_revenue, gross_commission,
                adjustments, deductions, net_commission,
                payment_status, payment_date,
                payment_status in ['paid', 'approved'],
                fake.date_time_between(start_date='-6m', end_date='now')
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} commission statements")
