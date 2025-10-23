"""Insert function for vendor_contracts table"""


from data_store import data_store
from datetime import datetime, timedelta
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random


def insert_vendor_contracts(conn):
    """Insert vendor contract records"""
    print(f"\n✓ Inserting Vendor Contracts...")
    cur = conn.cursor()

    contract_types = ['service', 'supply', 'maintenance', 'lease', 'license', 'consulting', 'subscription']
    statuses = ['active', 'active', 'active', 'approved', 'expired', 'renewed']
    count = 0

    for property in data_store['properties']:
        for i in range(random.randint(5, 10)):
            start_date = fake.date_between(start_date="-2y", end_date="-6m")
            end_date = start_date + timedelta(days=random.randint(180, 730))
            contract_type = random.choice(contract_types)
            vendor_name = fake.company()

            # Generate service description based on contract type
            service_descriptions = {
                'supply': f"Supply of {vendor_name} products and materials",
                'service': f"Professional services provided by {vendor_name}",
                'maintenance': f"Ongoing maintenance services by {vendor_name}",
                'lease': f"Lease agreement with {vendor_name}",
                'license': f"Software/licensing agreement with {vendor_name}",
                'consulting': f"Consulting services provided by {vendor_name}",
                'subscription': f"Subscription services from {vendor_name}"
            }
            service_description = service_descriptions.get(contract_type, f"Services provided by {vendor_name}")

            cur.execute("""
                INSERT INTO vendor_contracts (
                    contract_id, tenant_id, property_id,
                    contract_number, contract_name, vendor_name, contract_type,
                    start_date, end_date, contract_status,
                    contract_value, currency, payment_terms, service_description, created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                f"VND{count + 1:06d}",
                f"{contract_type.replace('_', ' ').title()} Contract - {vendor_name[:30]}",
                vendor_name,
                contract_type,
                start_date,
                end_date,
                random.choice(statuses),
                round(random.uniform(5000, 100000), 2),
                'USD',
                random.choice(['net_30', 'net_60', 'net_90', 'monthly', 'quarterly', 'annual']),
                service_description,
                fake.date_time_between(start_date="-2y", end_date="-6m")
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} vendor contracts")
