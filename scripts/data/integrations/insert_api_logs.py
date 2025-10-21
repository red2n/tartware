"""Insert function for api_logs table"""


from data_store import data_store
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random


def insert_api_logs(conn):
    """Insert API log records"""
    print(f"\n✓ Inserting API Logs...")
    cur = conn.cursor()

    endpoints = ['/api/reservations', '/api/guests', '/api/availability', '/api/rates', '/api/payments']
    methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
    status_codes = [200, 200, 200, 201, 400, 404, 500]
    count = 0

    for i in range(random.randint(500, 1000)):
        status_code = random.choice(status_codes)
        success = status_code < 400

        cur.execute("""
            INSERT INTO api_logs (
                log_id, tenant_id, endpoint, http_method,
                status_code, duration_ms, success,
                ip_address, user_agent
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            generate_uuid(),
            random.choice(data_store['tenants'])['id'],
            random.choice(endpoints),
            random.choice(methods),
            status_code,
            random.randint(50, 2000),
            success,
            fake.ipv4(),
            fake.user_agent()
        ))
        count += 1

    conn.commit()
    print(f"   → Inserted {count} API logs")


# Additional functions for remaining tables
