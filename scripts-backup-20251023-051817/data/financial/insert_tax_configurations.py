"""Insert function for tax_configurations table"""


from data_store import data_store
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random


def insert_tax_configurations(conn):
    """Insert tax configuration records"""
    print(f"\n✓ Inserting Tax Configurations...")
    cur = conn.cursor()

    tax_types = ['sales_tax', 'occupancy_tax', 'city_tax', 'tourism_tax', 'vat']

    count = 0
    # Create 3-5 tax configs per property
    for property in data_store['properties']:
        for tax_type in random.sample(tax_types, random.randint(3, 5)):
            # Make tax_code unique by including property prefix
            tax_code = f"{property['name'][:3].upper()}_{tax_type[:5].upper()}_{random.randint(1000,9999)}"

            cur.execute("""
                INSERT INTO tax_configurations (
                    tax_config_id, tenant_id, property_id,
                    tax_name, tax_code, tax_type,
                    tax_rate, country_code, effective_from
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                f"{tax_type.replace('_', ' ').title()}",
                tax_code,
                tax_type,
                round(random.uniform(5, 15), 6),  # 6 decimal places
                'USA',
                fake.date_between(start_date="-1y", end_date="-6m")
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} tax configurations")
