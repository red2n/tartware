"""Insert function for cashier_sessions table"""
from data_store import data_store
from datetime import datetime, timedelta
from db_config import generate_uuid
import random
import time


def insert_cashier_sessions(conn):
    """Insert cashier session records"""
    print(f"\n✓ Inserting Cashier Sessions...")
    cur = conn.cursor()

    count = 0
    # Create 2 sessions per property (morning and evening shifts)
    for property in data_store['properties']:
        for shift_type in ['morning', 'evening']:
            business_date = datetime.now().date() - timedelta(days=random.randint(0, 7))
            opened_at = datetime.combine(business_date, datetime.strptime('08:00' if shift_type == 'morning' else '16:00', '%H:%M').time())
            closed_at = opened_at + timedelta(hours=8)

            opening_float = 500.00
            total_cash = round(random.uniform(200, 1500), 2)

            cur.execute("""
                INSERT INTO cashier_sessions (
                    session_id, tenant_id, property_id,
                    session_number, cashier_id,
                    business_date, shift_type,
                    opened_at, closed_at, session_status,
                    opening_float_declared, total_cash_received,
                    total_card_received, total_revenue
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                f"CS{count+1:06d}",  # Use global counter for unique session numbers
                random.choice(data_store['users'])['id'],
                business_date,
                shift_type,
                opened_at,
                closed_at,
                'closed',
                opening_float,
                total_cash,
                round(random.uniform(300, 1200), 2),
                total_cash + round(random.uniform(300, 1200), 2)
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} cashier sessions")


# ============================================================================
# BATCH 6: Analytics & Reporting (Additional Tables)
# ============================================================================
