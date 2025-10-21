"""Insert function for police_reports table"""


from data_store import data_store
from datetime import datetime, timedelta
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random


def insert_police_reports(conn):
    """Insert police report records"""
    print(f"\n✓ Inserting Police Reports...")
    cur = conn.cursor()

    incident_types = ['theft', 'vandalism', 'assault', 'trespassing', 'noise_complaint', 'vehicle_incident', 'suspicious_activity', 'fraud']
    count = 0

    for property in data_store['properties']:
        for i in range(random.randint(1, 5)):
            incident_date = fake.date_between(start_date="-1y", end_date="now")
            reported_date = incident_date + timedelta(days=random.randint(0, 2))

            cur.execute("""
                INSERT INTO police_reports (
                    report_id, tenant_id, property_id,
                    report_number, incident_type, incident_date, reported_date,
                    incident_description, agency_name, responding_officer_name,
                    responding_officer_badge, report_status, created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                f"POL{fake.random_number(digits=8)}",
                random.choice(incident_types),
                incident_date,
                reported_date,
                fake.text(max_nb_chars=500),
                f"{fake.city()} Police Department",
                fake.name(),
                f"#{fake.random_number(digits=5)}",
                random.choice(['filed', 'under_investigation', 'closed', 'pending']),
                fake.date_time_between(start_date=reported_date, end_date="now")
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} police reports")
