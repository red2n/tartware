"""Insert function for gdpr_consent_logs table"""


from data_store import data_store
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random


def insert_gdpr_consent_logs(conn):
    """Insert GDPR consent log records"""
    print(f"\n✓ Inserting GDPR Consent Logs...")
    cur = conn.cursor()

    consent_types = ['marketing_email', 'marketing_sms', 'data_processing', 'third_party_sharing', 'profiling', 'analytics']
    consent_methods = ['online_form', 'email_link', 'checkbox', 'verbal', 'written', 'opt_in', 'explicit']

    purpose_descriptions = {
        'marketing_email': 'To send promotional emails and newsletters about special offers and updates',
        'marketing_sms': 'To send promotional text messages about exclusive deals and events',
        'data_processing': 'To process personal data for booking and service delivery purposes',
        'third_party_sharing': 'To share data with trusted partners for service fulfillment',
        'profiling': 'To analyze preferences and provide personalized recommendations',
        'analytics': 'To analyze usage patterns and improve our services'
    }

    count = 0

    for guest in data_store['guests']:
        for consent_type in random.sample(consent_types, random.randint(2, 4)):
            consented = random.choice([True, True, True, False])

            cur.execute("""
                INSERT INTO gdpr_consent_logs (
                    consent_id, tenant_id, subject_type, subject_id,
                    subject_email, consent_type, purpose_description, consent_given, consent_date,
                    consent_method, ip_address, created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                guest['tenant_id'],
                'guest',
                guest['id'],
                guest['email'],
                consent_type,
                purpose_descriptions.get(consent_type, 'General data processing consent'),
                consented,
                fake.date_time_between(start_date="-2y", end_date="now"),
                random.choice(consent_methods),
                fake.ipv4(),
                fake.date_time_between(start_date="-2y", end_date="now")
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} GDPR consent logs")
