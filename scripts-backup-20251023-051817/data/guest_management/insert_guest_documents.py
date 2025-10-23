"""Insert function for guest_documents table"""


from data_store import data_store
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random


def insert_guest_documents(conn):
    """Insert guest document records"""
    print(f"\n✓ Inserting Guest Documents...")
    cur = conn.cursor()

    doc_types = ['passport', 'drivers_license', 'national_id', 'visa', 'credit_card']

    count = 0
    # Each guest has 1-2 documents
    for guest in data_store['guests']:
        # Get a property for this guest (use first property of tenant)
        guest_property = next((p for p in data_store['properties'] if p['tenant_id'] == guest['tenant_id']), None)
        if not guest_property:
            continue

        num_docs = random.randint(1, 2)
        for i in range(num_docs):
            doc_type = random.choice(doc_types)
            cur.execute("""
                INSERT INTO guest_documents (document_id, tenant_id, property_id, guest_id,
                                           document_type, document_name, file_path, file_name,
                                           document_number, is_verified)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                guest['tenant_id'],
                guest_property['id'],
                guest['id'],
                doc_type,
                f"{doc_type} - {fake.name()}",
                f"/uploads/guests/{guest['id']}/",
                f"{fake.uuid4()}.pdf",
                fake.bothify('??########'),
                random.choice([True, True, True, False])
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} guest documents")
