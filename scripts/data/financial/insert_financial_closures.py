"""Insert function for financial_closures table"""


from data_store import data_store
from datetime import datetime, timedelta
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random


def insert_financial_closures(conn):
    """Insert financial closure records"""
    print(f"\n✓ Inserting Financial Closures...")
    cur = conn.cursor()

    closure_types = ['daily', 'weekly', 'monthly', 'quarterly', 'annual']
    closure_statuses = ['not_started', 'in_progress', 'pending_review', 'under_review', 'approved', 'closed', 'reopened']
    count = 0

    for property in data_store['properties']:
        for i in range(random.randint(6, 12)):
            period_start = fake.date_between(start_date="-1y", end_date="-30d")
            period_end = period_start + timedelta(days=random.choice([1, 7, 30, 90]))
            business_date = period_end

            gross_revenue = round(random.uniform(50000, 200000), 2)
            net_revenue = round(gross_revenue * 0.85, 2)

            cur.execute("""
                INSERT INTO financial_closures (
                    closure_id, tenant_id, property_id,
                    closure_number, closure_name, closure_type,
                    period_start_date, period_end_date,
                    fiscal_year, fiscal_month, fiscal_quarter,
                    business_date, closure_status, is_closed, is_final,
                    total_gross_revenue, total_net_revenue
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                f"FIN-{period_start.strftime('%Y%m%d')}-{random.randint(100, 999)}",
                f"{random.choice(closure_types).title()} Closure {period_start.strftime('%Y-%m-%d')}",
                random.choice(closure_types),
                period_start,
                period_end,
                period_start.year,
                period_start.month,
                (period_start.month - 1) // 3 + 1,
                business_date,
                random.choice(closure_statuses),
                random.choice([True, True, False]),
                random.choice([True, False, False]),
                gross_revenue,
                net_revenue
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} financial closures")
