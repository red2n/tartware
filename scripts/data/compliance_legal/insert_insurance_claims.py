"""Insert function for insurance_claims table"""


from data_store import data_store
from datetime import datetime, timedelta
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random


def insert_insurance_claims(conn):
    """Insert insurance claim records"""
    print(f"\n✓ Inserting Insurance Claims...")
    cur = conn.cursor()

    claim_types = ['property_damage', 'liability', 'workers_comp', 'business_interruption', 'theft', 'fire', 'flood', 'equipment_breakdown', 'cyber', 'guest_injury', 'employee_injury', 'vehicle', 'other']
    count = 0

    for property in data_store['properties']:
        for i in range(random.randint(1, 4)):
            incident_date = fake.date_between(start_date="-1y", end_date="now")
            claim_filed_date = incident_date + timedelta(days=random.randint(1, 7))

            cur.execute("""
                INSERT INTO insurance_claims (
                    claim_id, tenant_id, property_id,
                    claim_number, claim_type, incident_date, incident_description,
                    claim_amount, claim_filed_date, claim_status,
                    insurance_company, policy_number, created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                f"CLM{fake.random_number(digits=8)}",
                random.choice(claim_types),
                incident_date,
                fake.text(max_nb_chars=500),
                round(random.uniform(1000, 100000), 2),
                claim_filed_date,
                random.choice(['draft', 'submitted', 'under_review', 'investigating', 'approved', 'denied', 'settled', 'closed']),
                fake.company(),
                f"POL{fake.random_number(digits=10)}",
                fake.date_time_between(start_date=claim_filed_date, end_date="now")
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} insurance claims")
