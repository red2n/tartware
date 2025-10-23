"""Insert function for rate_recommendations table"""


from data_store import data_store
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random


def insert_rate_recommendations(conn):
    """Insert rate recommendation records"""
    print(f"\n✓ Inserting Rate Recommendations...")
    cur = conn.cursor()

    recommendation_actions = ['increase', 'decrease', 'hold']
    reasons = ['High demand period', 'Competitor pricing', 'Historical trends', 'Event in area', 'Low occupancy', 'Seasonal pattern']
    count = 0

    for property in data_store['properties']:
        property_room_types = [rt for rt in data_store['room_types'] if rt['property_id'] == property['id']]

        for room_type in property_room_types:
            for i in range(random.randint(10, 30)):
                recommendation_date = fake.date_between(start_date="-30d", end_date="+60d")
                recommended_rate = round(random.uniform(100, 400), 2)
                current_rate = round(random.uniform(100, 400), 2)
                rate_difference = round(recommended_rate - current_rate, 2)
                rate_difference_percent = round((rate_difference / current_rate * 100) if current_rate > 0 else 0, 2)

                cur.execute("""
                    INSERT INTO rate_recommendations (
                        recommendation_id, tenant_id, property_id,
                        room_type_id, recommendation_date, recommended_rate,
                        current_rate, rate_difference, rate_difference_percent,
                        confidence_score, recommendation_action, primary_reason
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    generate_uuid(),
                    property['tenant_id'],
                    property['id'],
                    room_type['id'],
                    recommendation_date,
                    recommended_rate,
                    current_rate,
                    rate_difference,
                    rate_difference_percent,
                    round(random.uniform(0.6, 0.95), 2),
                    'increase' if recommended_rate > current_rate else ('decrease' if recommended_rate < current_rate else 'hold'),
                    random.choice(reasons)
                ))
                count += 1

    conn.commit()
    print(f"   → Inserted {count} rate recommendations")
