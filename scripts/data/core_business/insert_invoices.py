"""
@package tartware.scripts.data.core_business.insert_invoices
@summary Emit invoices that summarize reservation charges with tax computations.
"""


from data_store import data_store
from datetime import datetime, timedelta
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random


def insert_invoices(conn):
    """
    @summary Insert invoices linked to reservations, capturing totals and status.
    @param conn: psycopg2 connection for invoice persistence.
    @returns None
    """
    print(f"\n✓ Inserting Invoices...")
    cur = conn.cursor()

    statuses = ['PAID', 'PAID', 'SENT', 'PARTIALLY_PAID', 'OVERDUE']
    count = 0

    for reservation in data_store['reservations']:
        invoice_id = generate_uuid()
        property = next((p for p in data_store['properties'] if p['id'] == reservation['property_id']), None)

        invoice_date = fake.date_between(start_date="-6m", end_date="today")
        due_date = invoice_date + timedelta(days=30)

        subtotal = reservation['total_amount']
        tax = subtotal * 0.1
        total = subtotal + tax

        cur.execute("""
            INSERT INTO invoices (id, tenant_id, property_id, reservation_id, guest_id,
                                 invoice_number, invoice_date, due_date, subtotal, tax_amount,
                                 total_amount, status, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            invoice_id,
            property['tenant_id'],
            property['id'],
            reservation['id'],
            reservation['guest_id'],
            f"INV{count + 1:06d}",
            invoice_date,
            due_date,
            subtotal,
            tax,
            total,
            random.choice(statuses),
            fake.date_time_between(start_date="-6m", end_date="now")
        ))

        data_store['invoices'].append({
            'id': invoice_id,
            'tenant_id': property['tenant_id'],
            'reservation_id': reservation['id'],
            'total': total
        })
        count += 1

    conn.commit()
    print(f"   → Inserted {count} invoices")
