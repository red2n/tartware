"""Seed application user accounts with realistic profile metadata."""


from data_store import data_store
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random


def insert_users(conn, count=25):
    """Insert synthetic user records referenced throughout the platform.

    Args:
        conn: psycopg2 connection bound to the Tartware database.
        count: Number of user rows to generate.
    """
    print(f"\n✓ Inserting {count} Users...")
    cur = conn.cursor()

    for i in range(count):
        user_id = generate_uuid()
        first_name = fake.first_name()
        last_name = fake.last_name()
        username = f"{first_name.lower()}.{last_name.lower()}{random.randint(1, 999)}"

        cur.execute("""
            INSERT INTO users (id, username, email, password_hash, first_name, last_name, phone, is_active, is_verified, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            user_id,
            username,
            fake.email(),
            '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5NU7xlL.RGbKW',
            first_name,
            last_name,
            fake.phone_number()[:20],
            random.choice([True, True, True, False]),
            random.choice([True, True, False]),
            fake.date_time_between(start_date="-2y", end_date="now")
        ))

        data_store['users'].append({
            'id': user_id,
            'username': username,
            'name': f"{first_name} {last_name}"
        })

    conn.commit()
    print(f"   → Inserted {count} users")
