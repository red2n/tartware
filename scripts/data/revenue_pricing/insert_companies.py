"""Insert function for companies table"""

from data_store import data_store
from db_config import generate_uuid
from faker import Faker
import random

fake = Faker()


def insert_companies(conn, count=50):
    """Insert company records (corporate clients, travel agencies, partners)"""
    print(f"\n✓ Inserting {count} Companies...")
    cur = conn.cursor()

    company_types = [
        'corporate', 'travel_agency', 'wholesaler', 'ota',
        'event_planner', 'airline', 'government', 'educational',
        'consortium', 'partner'
    ]

    payment_terms_types = ['due_on_receipt', 'net_15', 'net_30', 'net_45', 'net_60', 'net_90']
    credit_statuses = ['active'] * 70 + ['pending'] * 15 + ['suspended'] * 10 + ['under_review'] * 5
    commission_types = ['percentage', 'flat_rate', 'tiered', 'net_rate', 'none']
    contract_statuses = ['active'] * 60 + ['pending_approval'] * 20 + ['expiring_soon'] * 10 + ['draft'] * 10

    for i in range(count):
        company_id = generate_uuid()
        tenant = random.choice(data_store['tenants'])
        company_type = random.choice(company_types)

        company_name = fake.company()
        company_code = f"COMP-{fake.numerify('######')}"

        # Payment terms based on company type
        if company_type in ['corporate', 'government', 'educational']:
            payment_terms = random.choice([30, 45, 60])
            payment_terms_type = f"net_{payment_terms}"
        else:
            payment_terms = random.choice([15, 30, 45])
            payment_terms_type = f"net_{payment_terms}"

        # Commission based on type
        if company_type in ['travel_agency', 'ota', 'wholesaler']:
            commission_rate = round(random.uniform(10, 20), 2)
            commission_type = 'percentage'
        elif company_type == 'corporate':
            commission_rate = 0.00
            commission_type = 'none'
        else:
            commission_rate = round(random.uniform(5, 15), 2)
            commission_type = random.choice(['percentage', 'flat_rate'])

        # Credit limit based on type
        if company_type in ['corporate', 'government']:
            credit_limit = round(random.uniform(50000, 500000), 2)
        elif company_type in ['travel_agency', 'wholesaler']:
            credit_limit = round(random.uniform(25000, 150000), 2)
        else:
            credit_limit = round(random.uniform(10000, 50000), 2)

        current_balance = round(random.uniform(0, credit_limit * 0.5), 2)

        # Contract dates
        contract_start = fake.date_between(start_date='-2y', end_date='-6m')
        contract_end = fake.date_between(start_date='+6m', end_date='+2y')

        cur.execute("""
            INSERT INTO companies (
                company_id, tenant_id, company_name, legal_name, company_code, company_type,
                primary_contact_name, primary_contact_title, primary_contact_email, primary_contact_phone,
                billing_contact_name, billing_contact_email, billing_contact_phone,
                address_line1, city, state_province, postal_code, country,
                credit_limit, current_balance, payment_terms, payment_terms_type, credit_status,
                commission_rate, commission_type, discount_percentage,
                tax_id, tax_exempt,
                contract_number, contract_start_date, contract_end_date, contract_status,
                is_active, created_at
            )
            VALUES (
                %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s,
                %s, %s, %s, %s,
                %s, %s
            )
        """, (
            company_id, tenant['id'], company_name, company_name + " LLC", company_code, company_type,
            fake.name(), fake.job(), fake.company_email(), fake.phone_number()[:20],
            fake.name(), fake.company_email(), fake.phone_number()[:20],
            fake.street_address(), fake.city(), fake.state(), fake.postcode(), fake.country(),
            credit_limit, current_balance, payment_terms, payment_terms_type, random.choice(credit_statuses),
            commission_rate, commission_type, round(random.uniform(0, 10), 2),
            fake.numerify('##-#######'), random.choice([True, False]),
            f"CTR-{fake.numerify('######')}", contract_start, contract_end, random.choice(contract_statuses),
            True, fake.date_time_between(start_date='-2y', end_date='now')
        ))

        data_store['companies'].append({
            'id': company_id,
            'tenant_id': tenant['id'],
            'company_name': company_name,
            'company_type': company_type,
            'company_code': company_code
        })

    conn.commit()
    print(f"   → Inserted {count} companies")
