"""
@package tartware.scripts.data.core_business.insert_tenants
@summary Seed foundational tenant records for integration and demo scenarios.
"""


from data_store import data_store
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import json
import random


def insert_tenants(conn, count=5):
    """
    @summary Insert tenant records with realistic configuration payloads.
    @param conn: psycopg2 connection bound to the target database.
    @param count: Number of tenant entities to create.
    @returns None
    """
    print(f"\n✓ Inserting {count} Tenants...")
    cur = conn.cursor()

    tenant_types = ['INDEPENDENT', 'CHAIN', 'FRANCHISE', 'MANAGEMENT_COMPANY']
    statuses = ['ACTIVE', 'ACTIVE', 'ACTIVE', 'TRIAL', 'ACTIVE']

    for i in range(count):
        tenant_id = generate_uuid()
        company_name = fake.company()
        slug = company_name.lower().replace(' ', '-').replace(',', '').replace('.', '')[:200]

        config = {
            "brandingEnabled": True,
            "enableMultiProperty": True,
            "enableChannelManager": random.choice([True, False]),
            "enableAdvancedReporting": random.choice([True, False]),
            "enablePaymentProcessing": True,
            "enableLoyaltyProgram": random.choice([True, False]),
            "maxProperties": random.choice([5, 10, 25, 50]),
            "maxUsers": random.choice([10, 25, 50, 100]),
            "defaultCurrency": "USD",
            "defaultLanguage": "en",
            "defaultTimezone": "UTC"
        }

        subscription = {
            "plan": random.choice(["BASIC", "PROFESSIONAL", "ENTERPRISE"]),
            "billingCycle": "MONTHLY",
            "amount": random.choice([99, 299, 999]),
            "currency": "USD"
        }

        cur.execute("""
            INSERT INTO tenants (id, name, slug, type, status, email, phone, country, config, subscription, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            tenant_id,
            company_name,
            slug,
            tenant_types[i % len(tenant_types)],
            statuses[i],
            fake.company_email(),
            fake.phone_number()[:20],
            fake.country_code(),
            json.dumps(config),
            json.dumps(subscription),
            fake.date_time_between(start_date="-2y", end_date="now")
        ))

        data_store['tenants'].append({
            'id': tenant_id,
            'name': company_name,
            'slug': slug
        })

    conn.commit()
    print(f"   → Inserted {count} tenants")
