"""Insert function for competitor_rates table"""
from data_store import data_store
from datetime import datetime, timedelta
from db_config import generate_uuid
import random
import time


def insert_competitor_rates(conn):
    """Insert competitor rate monitoring records"""
    print(f"\n✓ Inserting Competitor Rates...")
    cur = conn.cursor()

    competitors = ['Hilton Downtown', 'Marriott Center', 'Holiday Inn Express', 'Best Western']
    source_channels = ['booking.com', 'expedia.com', 'direct_website', 'google_hotels']

    count = 0
    # Monitor competitor rates for each property (last 30 days)
    for property in data_store['properties']:
        property_room_types = [rt for rt in data_store['room_types'] if rt['property_id'] == property['id']]

        for days_ago in range(30):
            check_date = datetime.now().date() - timedelta(days=days_ago)
            stay_date = check_date + timedelta(days=random.randint(0, 7))

            for competitor in competitors[:2]:  # 2 competitors per property
                for room_type in property_room_types[:2]:  # 2 room types
                    our_rate = round(random.uniform(100, 300), 2)
                    comp_rate = round(our_rate * random.uniform(0.85, 1.15), 2)

                    cur.execute("""
                        INSERT INTO competitor_rates (
                            rate_id, tenant_id, property_id,
                            competitor_property_name, check_date, stay_date,
                            competitor_rate, currency, source_channel,
                            our_property_rate, our_property_room_type_id,
                            rate_difference, rate_difference_percent,
                            scrape_timestamp
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, (
                        generate_uuid(),
                        property['tenant_id'],
                        property['id'],
                        competitor,
                        check_date,
                        stay_date,
                        comp_rate,
                        'USD',
                        random.choice(source_channels),
                        our_rate,
                        room_type['id'],
                        comp_rate - our_rate,
                        round(((comp_rate - our_rate) / our_rate) * 100, 2),
                        datetime.now() - timedelta(days=days_ago, hours=random.randint(0, 23))
                    ))
                    count += 1

    conn.commit()
    print(f"   → Inserted {count} competitor rate records")
