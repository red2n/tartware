"""Insert function for business_dates table"""
from data_store import data_store
from datetime import datetime, timedelta
from db_config import generate_uuid
import random
import time


def insert_business_dates(conn):
    """Insert business date records - one OPEN date per property"""
    print(f"\n✓ Inserting Business Dates...")
    cur = conn.cursor()

    count = 0
    # Each property has current business date + 30 days of history
    for property in data_store['properties']:
        # Current business date (OPEN)
        current_date = datetime.now().date()

        cur.execute("""
            INSERT INTO business_dates (
                business_date_id, tenant_id, property_id,
                business_date, system_date, date_status,
                night_audit_status, date_opened_at, date_opened_by,
                arrivals_count, departures_count, stayovers_count,
                total_revenue, allow_new_reservations, allow_check_ins,
                allow_check_outs, allow_postings, is_locked,
                created_at, created_by
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            generate_uuid(),
            property['tenant_id'],
            property['id'],
            current_date,
            current_date,
            'OPEN',
            'PENDING',
            datetime.now() - timedelta(hours=8),
            random.choice(data_store['users'])['id'],
            random.randint(5, 25),
            random.randint(3, 20),
            random.randint(10, 50),
            round(random.uniform(5000, 25000), 2),
            True,
            True,
            True,
            True,
            False,
            datetime.now() - timedelta(hours=8),
            random.choice(data_store['users'])['id']
        ))
        count += 1

        # Historical closed dates (last 30 days)
        for days_ago in range(1, 31):
            hist_date = current_date - timedelta(days=days_ago)
            opened_time = datetime.now() - timedelta(days=days_ago+1, hours=6)
            closed_time = datetime.now() - timedelta(days=days_ago, hours=3)

            cur.execute("""
                INSERT INTO business_dates (
                    business_date_id, tenant_id, property_id,
                    business_date, system_date, date_status,
                    night_audit_status, date_opened_at, date_opened_by,
                    date_closed_at, date_closed_by,
                    night_audit_started_at, night_audit_completed_at,
                    night_audit_started_by, night_audit_completed_by,
                    arrivals_count, departures_count, stayovers_count,
                    total_revenue, total_payments,
                    is_locked, is_reconciled, reconciled_at,
                    created_at, created_by
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                hist_date,
                hist_date,
                'CLOSED',
                'COMPLETED',
                opened_time,
                random.choice(data_store['users'])['id'],
                closed_time,
                random.choice(data_store['users'])['id'],
                closed_time - timedelta(minutes=30),
                closed_time,
                random.choice(data_store['users'])['id'],
                random.choice(data_store['users'])['id'],
                random.randint(3, 20),
                random.randint(5, 25),
                random.randint(10, 60),
                round(random.uniform(3000, 20000), 2),
                round(random.uniform(2500, 18000), 2),
                False,
                True,
                closed_time + timedelta(hours=1),
                opened_time,
                random.choice(data_store['users'])['id']
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} business dates")
