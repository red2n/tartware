"""Insert function for accounts_receivable table"""


from datetime import datetime, timedelta
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random
import time


def insert_accounts_receivable(conn):
    """Insert accounts receivable records"""
    print(f"\n✓ Inserting Accounts Receivable...")
    cur = conn.cursor()

    source_types = ['invoice', 'reservation', 'service', 'package']
    ar_statuses = ['open', 'partial', 'paid', 'overdue', 'in_collection', 'written_off', 'disputed']
    count = 0
    ar_counter = 0

    # Get invoices
    cur.execute("SELECT id, tenant_id, property_id, guest_id, total_amount, invoice_date FROM invoices LIMIT 100")
    invoices = cur.fetchall()

    for invoice_id, tenant_id, property_id, guest_id, total_amount, invoice_date in invoices:
        ar_counter += 1
        due_date = invoice_date + timedelta(days=30)
        paid_amount = round(float(total_amount) * random.uniform(0, 0.7), 2)
        outstanding_balance = round(float(total_amount) - paid_amount, 2)

        cur.execute("""
            INSERT INTO accounts_receivable (
                ar_id, tenant_id, property_id,
                ar_number, account_name, guest_id,
                source_type, source_id, invoice_id,
                original_amount, currency, paid_amount, outstanding_balance,
                due_date, transaction_date,
                payment_terms, aging_days, aging_bucket,
                ar_status
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            generate_uuid(),
            tenant_id,
            property_id,
            f"AR-{ar_counter:06d}-{random.randint(100, 999)}",
            fake.company(),
            guest_id,
            'invoice',
            invoice_id,
            invoice_id,
            round(float(total_amount), 2),
            'USD',
            paid_amount,
            outstanding_balance,
            due_date,
            invoice_date,
            random.choice(['due_on_receipt', 'net_15', 'net_30', 'net_45', 'net_60', 'net_90']),
            (datetime.now().date() - invoice_date).days,
            random.choice(['current', '1_30_days', '31_60_days', '61_90_days', '91_120_days']),
            random.choice(ar_statuses)
        ))
        count += 1

    conn.commit()
    print(f"   → Inserted {count} accounts receivable records")
