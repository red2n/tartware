"""Insert function for guest_feedback table"""


from data_store import data_store
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random


def insert_guest_feedback(conn):
    """Insert guest feedback records"""
    print(f"\n✓ Inserting Guest Feedback...")
    cur = conn.cursor()

    feedback_sources = ['DIRECT', 'EMAIL', 'SURVEY', 'BOOKING_COM', 'TRIPADVISOR', 'GOOGLE']

    count = 0
    # 40% of reservations get feedback
    for reservation in data_store['reservations'][:200]:
        rating = round(random.uniform(3.0, 5.0), 2)
        cur.execute("""
            INSERT INTO guest_feedback (id, tenant_id, property_id, reservation_id, guest_id,
                                       feedback_source, overall_rating, cleanliness_rating,
                                       staff_rating, location_rating, amenities_rating,
                                       value_rating, review_text)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            generate_uuid(),
            reservation['tenant_id'],
            reservation['property_id'],
            reservation['id'],
            reservation['guest_id'],
            random.choice(feedback_sources),
            rating,
            round(random.uniform(max(1.0, rating-1), min(5.0, rating+1)), 2),
            round(random.uniform(max(1.0, rating-1), min(5.0, rating+1)), 2),
            round(random.uniform(max(1.0, rating-1), min(5.0, rating+1)), 2),
            round(random.uniform(max(1.0, rating-1), min(5.0, rating+1)), 2),
            round(random.uniform(max(1.0, rating-1), min(5.0, rating+1)), 2),
            fake.paragraph()
        ))
        count += 1

    conn.commit()
    print(f"   → Inserted {count} guest feedback records")
