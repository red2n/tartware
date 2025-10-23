"""Insert function for refunds table"""


from data_store import data_store
from datetime import datetime, timedelta
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random


def insert_refunds(conn):
    """Insert refund records"""
    print(f"\n✓ Inserting Refunds...")
    cur = conn.cursor()

    refund_types = ['CANCELLATION', 'OVERPAYMENT', 'SERVICE_FAILURE', 'DAMAGE_DEPOSIT']
    statuses = ['COMPLETED', 'COMPLETED', 'COMPLETED', 'PROCESSING', 'APPROVED']
    methods = ['ORIGINAL_PAYMENT_METHOD', 'CREDIT_CARD', 'BANK_TRANSFER']
    reason_categories = ['CANCELLATION', 'NO_SHOW', 'SERVICE_ISSUE', 'OVERCHARGE']

    count = 0
    # Create refunds for ~5% of reservations (25 refunds)
    for payment in random.sample(data_store['reservations'], min(25, len(data_store['reservations']))):
        property = next((p for p in data_store['properties'] if p['id'] == payment['property_id']), None)
        if not property:
            continue

        refund_amount = round(payment['total_amount'] * random.uniform(0.3, 1.0), 2)
        processing_fee = round(refund_amount * 0.03, 2)

        status = random.choice(statuses)
        requested_time = fake.date_time_between(start_date="-60d", end_date="now")
        approved_time = requested_time + timedelta(hours=random.randint(1, 48))
        processed_time = approved_time + timedelta(hours=random.randint(1, 24))
        # COMPLETED status requires completed_at
        completed_time = processed_time + timedelta(hours=random.randint(1, 6)) if status == 'COMPLETED' else None

        cur.execute("""
            INSERT INTO refunds (
                refund_id, tenant_id, property_id,
                refund_number, refund_type, refund_status,
                reservation_id, guest_id,
                refund_amount, processing_fee, net_refund_amount,
                refund_method, reason_category, reason_description,
                requested_at, requested_by,
                approved_at, approved_by,
                processed_at, processed_by,
                completed_at,
                created_at, created_by
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            generate_uuid(),
            property['tenant_id'],
            property['id'],
            f"REF{count + 1:06d}",
            random.choice(refund_types),
            status,
            payment['id'],
            payment['guest_id'],
            refund_amount,
            processing_fee,
            refund_amount - processing_fee,
            random.choice(methods),
            random.choice(reason_categories),
            fake.sentence()[:200],
            requested_time,
            random.choice(data_store['users'])['id'],
            approved_time if status in ['APPROVED', 'PROCESSING', 'COMPLETED'] else None,
            random.choice(data_store['users'])['id'] if status in ['APPROVED', 'PROCESSING', 'COMPLETED'] else None,
            processed_time if status in ['PROCESSING', 'COMPLETED'] else None,
            random.choice(data_store['users'])['id'] if status in ['PROCESSING', 'COMPLETED'] else None,
            completed_time,
            requested_time,
            random.choice(data_store['users'])['id']
        ))
        count += 1

    conn.commit()
    print(f"   → Inserted {count} refunds")
