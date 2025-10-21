"""Insert function for ota_reservations_queue table"""


from data_store import data_store
from datetime import datetime, timedelta
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import json
import random


def insert_ota_reservations_queue(conn):
    """Insert OTA reservations queue records"""
    print(f"\n✓ Inserting OTA Reservations Queue...")
    cur = conn.cursor()

    statuses = ['PENDING', 'PROCESSING', 'PROCESSED', 'PROCESSED', 'FAILED']

    count = 0
    # Create queue entries for recent reservations
    for reservation in data_store['reservations'][:100]:  # 20% of reservations from OTAs
        # Get a random OTA configuration for this property
        ota_configs = [oc for oc in data_store['ota_configurations'] if oc['property_id'] == reservation['property_id']]
        if not ota_configs:
            continue
        ota_config = random.choice(ota_configs)

        # Generate reservation dates
        check_in = fake.date_between(start_date='-60d', end_date='+90d')
        check_out = check_in + timedelta(days=random.randint(1, 7))

        cur.execute("""
            INSERT INTO ota_reservations_queue (id, tenant_id, property_id, ota_configuration_id,
                                               reservation_id, ota_reservation_id, ota_booking_reference,
                                               status, guest_name, guest_email,
                                               check_in_date, check_out_date,
                                               number_of_guests, total_amount, currency_code,
                                               raw_payload)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            generate_uuid(),
            reservation['tenant_id'],
            reservation['property_id'],
            ota_config['id'],
            reservation['id'],
            f"OTA{fake.random_int(100000, 999999)}",
            f"BKG{fake.random_int(10000, 99999)}",
            random.choice(statuses),
            fake.name(),
            fake.email(),
            check_in,
            check_out,
            random.randint(1, 4),
            reservation['total_amount'],
            'USD',
            json.dumps({"source": ota_config['channel_code'], "booking_data": "sample"})
        ))
        count += 1

    conn.commit()
    print(f"   → Inserted {count} OTA queue entries")
