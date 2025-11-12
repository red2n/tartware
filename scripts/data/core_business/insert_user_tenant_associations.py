"""
@package tartware.scripts.data.core_business.insert_user_tenant_associations
@summary Create role-aware links between users and tenants to model access control.
"""


from data_store import data_store
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random


def insert_user_tenant_associations(conn):
    """
    @summary Generate role assignments connecting users to their tenant accounts.
    @param conn: psycopg2 connection used for persistence.
    @returns None
    """
    print(f"\n✓ Inserting User-Tenant Associations...")
    cur = conn.cursor()

    roles = ['OWNER', 'ADMIN', 'MANAGER', 'STAFF', 'VIEWER']
    count = 0

    for tenant in data_store['tenants']:
        # Track assigned users for this tenant to avoid duplicates
        assigned_users = set()

        # Owner
        owner_user = random.choice(data_store['users'])
        assigned_users.add(owner_user['id'])

        cur.execute("""
            INSERT INTO user_tenant_associations (id, user_id, tenant_id, role, is_active, created_at)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (
            generate_uuid(),
            owner_user['id'],
            tenant['id'],
            'OWNER',
            True,
            fake.date_time_between(start_date="-2y", end_date="now")
        ))
        count += 1

        # Additional staff - ensure no duplicates
        num_staff = random.randint(3, 6)
        attempts = 0
        while len(assigned_users) < min(num_staff + 1, len(data_store['users'])) and attempts < 100:
            staff_user = random.choice(data_store['users'])
            if staff_user['id'] not in assigned_users:
                assigned_users.add(staff_user['id'])
                cur.execute("""
                    INSERT INTO user_tenant_associations (id, user_id, tenant_id, role, is_active, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (
                    generate_uuid(),
                    staff_user['id'],
                    tenant['id'],
                    random.choice(roles[1:]),
                    True,
                    fake.date_time_between(start_date="-2y", end_date="now")
                ))
                count += 1
            attempts += 1

    conn.commit()
    print(f"   → Inserted {count} associations")
