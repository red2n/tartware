"""Insert function for incident_reports table"""


from data_store import data_store
from datetime import datetime, timedelta
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random
import time


def insert_incident_reports(conn):
    """Insert incident report records"""
    print(f"\n✓ Inserting Incident Reports...")
    cur = conn.cursor()

    incident_types = ['accident', 'theft', 'damage', 'slip_fall', 'medical_emergency', 'security_breach']
    severities = ['minor', 'moderate', 'serious', 'critical']

    count = 0
    # Generate 1-2 incidents per property
    for property in data_store['properties']:
        num_incidents = random.randint(1, 2)
        for i in range(num_incidents):
            incident_date = fake.date_between(start_date="-60d", end_date="now")
            incident_time = fake.time()
            incident_datetime = datetime.combine(incident_date, datetime.strptime(incident_time, '%H:%M:%S').time())

            user_id = random.choice([u['id'] for u in data_store['users']])
            cur.execute("""
                INSERT INTO incident_reports (incident_id, tenant_id, property_id,
                                             incident_number, incident_title, incident_type,
                                             incident_location, incident_description,
                                             immediate_actions_taken, severity,
                                             incident_date, incident_time, incident_datetime,
                                             discovered_by, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                f"INC{count + 1:06d}",
                fake.sentence(nb_words=5),
                random.choice(incident_types),
                fake.word().title() + " Area",
                fake.paragraph(),
                fake.sentence(nb_words=8),
                random.choice(severities),
                incident_date,
                incident_time,
                incident_datetime,
                user_id,
                user_id
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} incident reports")
