"""Insert function for deposit_schedules table"""


from data_store import data_store
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random


def insert_deposit_schedules(conn):
    """Insert deposit schedule records"""
    print(f"\n✓ Inserting Deposit Schedules...")
    cur = conn.cursor()

    schedule_types = ['DEPOSIT', 'INSTALLMENT', 'PREPAYMENT', 'SECURITY_DEPOSIT']
    statuses = ['PENDING', 'PAID', 'PAID', 'OVERDUE']

    count = 0
    # Create deposit schedules for 20% of reservations
    for reservation in random.sample(data_store['reservations'], min(100, len(data_store['reservations']))):
        property = next((p for p in data_store['properties'] if p['id'] == reservation['property_id']), None)
        if not property:
            continue

        schedule_type = random.choice(schedule_types)
        total_amount = reservation['total_amount']
        amount_due = round(total_amount * random.uniform(0.2, 0.5), 2)
        amount_paid = amount_due if random.random() < 0.6 else 0
        status = 'PAID' if amount_paid >= amount_due else random.choice(statuses)

        cur.execute("""
            INSERT INTO deposit_schedules (
                schedule_id, tenant_id, property_id,
                reservation_id, schedule_type,
                amount_due, amount_paid, amount_remaining,
                due_date, schedule_status, paid_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            generate_uuid(),
            property['tenant_id'],
            property['id'],
            reservation['id'],
            schedule_type,
            amount_due,
            amount_paid,
            amount_due - amount_paid,
            fake.date_between(start_date="-30d", end_date="+30d"),
            status,
            fake.date_time_between(start_date="-30d", end_date="now") if status == 'PAID' else None
        ))
        count += 1

    conn.commit()
    print(f"   → Inserted {count} deposit schedules")
