"""Insert function for contract_agreements table"""


from data_store import data_store
from datetime import datetime, timedelta
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random


def insert_contract_agreements(conn):
    """Insert contract agreement records"""
    print(f"\n✓ Inserting Contract Agreements...")
    cur = conn.cursor()

    agreement_types = ['service', 'lease', 'employment', 'vendor', 'partnership', 'license', 'nda', 'corporate', 'management']
    count = 0

    for property in data_store['properties']:
        for i in range(random.randint(3, 8)):
            start_date = fake.date_between(start_date="-1y", end_date="now")
            end_date = start_date + timedelta(days=random.randint(180, 730))
            agreement_type = random.choice(agreement_types)
            party_b = fake.company()

            cur.execute("""
                INSERT INTO contract_agreements (
                    agreement_id, tenant_id, property_id,
                    agreement_number, agreement_title, agreement_type,
                    party_a_name, party_b_name,
                    effective_date, expiry_date, agreement_status,
                    contract_value, agreement_description, created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                f"AGR{fake.random_number(digits=6)}",
                f"{agreement_type.replace('_', ' ').title()} with {party_b}",
                agreement_type,
                property['name'],
                party_b,
                start_date,
                end_date,
                random.choice(['active', 'pending_review', 'pending_signature', 'expired', 'terminated', 'renewed']),
                round(random.uniform(10000, 500000), 2),
                fake.text(max_nb_chars=300),
                fake.date_time_between(start_date="-1y", end_date="now")
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} contract agreements")
