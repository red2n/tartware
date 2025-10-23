"""Insert function for folios table"""
from data_store import data_store
from db_config import generate_uuid
import random


def insert_folios(conn):
    """Insert folio records"""
    print(f"\n✓ Inserting Folios...")
    cur = conn.cursor()

    count = 0
    # Create a folio for each reservation
    for reservation in data_store['reservations']:
        folio_id = generate_uuid()
        cur.execute("""
            INSERT INTO folios (folio_id, tenant_id, property_id, reservation_id, guest_id,
                               folio_number, folio_type, folio_status, balance, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            folio_id,
            reservation['tenant_id'],
            reservation['property_id'],
            reservation['id'],
            reservation['guest_id'],
            f"FOL{count + 1:06d}",
            'GUEST',
            'OPEN',  # Use OPEN to avoid complex constraints on CLOSED/SETTLED
            0.00,  # Balance must be 0 when total_charges, total_payments, total_credits are 0
            random.choice([u['id'] for u in data_store['users']])
        ))

        # Store folio for charge postings
        data_store['folios'].append({
            'id': folio_id,
            'reservation_id': reservation['id'],
            'tenant_id': reservation['tenant_id'],
            'property_id': reservation['property_id']
        })
        count += 1

    conn.commit()
    print(f"   → Inserted {count} folios")
