"""Insert function for commission_tracking table"""


from datetime import datetime, timedelta
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random


def insert_commission_tracking(conn):
    """Insert commission tracking records"""
    print(f"\n✓ Inserting Commission Tracking...")
    cur = conn.cursor()

    commission_types = ['sales', 'booking', 'ota', 'travel_agent', 'corporate', 'referral', 'staff', 'manager']
    beneficiary_types = ['staff', 'user', 'agent', 'ota', 'channel', 'affiliate']
    source_types = ['reservation', 'booking', 'payment', 'invoice', 'service', 'package']
    calculation_methods = ['percentage', 'flat_rate', 'tiered', 'performance_based', 'volume_based']
    count = 0

    # Get reservations
    cur.execute("SELECT id, tenant_id, property_id, guest_id, check_in_date, check_out_date, total_amount FROM reservations LIMIT 200")
    reservations = cur.fetchall()

    commission_counter = 0
    for res_id, tenant_id, property_id, guest_id, check_in, check_out, total_amount in reservations:
        commission_counter += 1
        commission_rate = round(random.uniform(5, 25), 4)
        commission_amount = round(float(total_amount) * commission_rate / 100, 2)
        transaction_date = check_in - timedelta(days=random.randint(1, 30))

        cur.execute("""
            INSERT INTO commission_tracking (
                commission_id, tenant_id, property_id,
                commission_number, commission_type, beneficiary_type,
                beneficiary_name, source_type, source_id, source_reference,
                reservation_id, transaction_date, check_in_date, check_out_date,
                guest_id, base_amount, base_currency, calculation_method,
                commission_rate, commission_amount, commission_currency,
                commission_status, payment_status
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            generate_uuid(),
            tenant_id,
            property_id,
            f"COM-{commission_counter:05d}-{random.randint(100, 999)}",
            random.choice(commission_types),
            random.choice(beneficiary_types),
            fake.company(),
            random.choice(source_types),
            res_id,
            f"REF-{random.randint(1000, 9999)}",
            res_id,
            transaction_date,
            check_in,
            check_out,
            guest_id,
            round(float(total_amount), 2),
            'USD',
            random.choice(calculation_methods),
            commission_rate,
            commission_amount,
            'USD',
            random.choice(['pending', 'calculated', 'approved', 'paid', 'disputed']),
            random.choice(['unpaid', 'scheduled', 'processing', 'paid', 'partially_paid'])
        ))
        count += 1

    conn.commit()
    print(f"   → Inserted {count} commission tracking records")
