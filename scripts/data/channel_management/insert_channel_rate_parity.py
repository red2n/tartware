"""Insert function for channel_rate_parity table"""
from data_store import data_store
from datetime import datetime, timedelta
from db_config import generate_uuid
import json
import random
import time


def insert_channel_rate_parity(conn):
    """Insert channel rate parity monitoring records"""
    print(f"\n✓ Inserting Channel Rate Parity...")
    cur = conn.cursor()

    parity_statuses = ['compliant', 'compliant', 'compliant', 'minor_variance', 'major_variance']

    count = 0
    # Monitor rate parity for each room type across channels (daily for last 7 days)
    for property in data_store['properties']:
        property_room_types = [rt for rt in data_store['room_types'] if rt['property_id'] == property['id']]

        for days_ago in range(7):
            check_date = datetime.now().date() - timedelta(days=days_ago)

            for room_type in property_room_types:
                base_rate = round(random.uniform(100, 300), 2)

                # Create channel rates JSONB
                channel_rates = {
                    "booking.com": round(base_rate * random.uniform(0.95, 1.05), 2),
                    "expedia": round(base_rate * random.uniform(0.95, 1.05), 2),
                    "airbnb": round(base_rate * random.uniform(0.95, 1.05), 2)
                }

                parity_status = random.choice(parity_statuses)
                is_compliant = parity_status == 'compliant'

                cur.execute("""
                    INSERT INTO channel_rate_parity (
                        parity_id, tenant_id, property_id,
                        room_type_id, check_date,
                        pms_rate, pms_currency, channel_rates,
                        parity_status, is_parity_maintained,
                        check_initiated_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    generate_uuid(),
                    property['tenant_id'],
                    property['id'],
                    room_type['id'],
                    check_date,
                    base_rate,
                    'USD',
                    json.dumps(channel_rates),
                    parity_status,
                    is_compliant,
                    datetime.now() - timedelta(days=days_ago, hours=random.randint(0, 23))
                ))
                count += 1

    conn.commit()
    print(f"   → Inserted {count} rate parity checks")
