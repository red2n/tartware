"""Insert function for analytics_reports table"""


from data_store import data_store
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import json
import random


def insert_analytics_reports(conn):
    """Insert analytics report records"""
    print(f"\n✓ Inserting Analytics Reports...")
    cur = conn.cursor()

    report_types = ['occupancy', 'revenue', 'adr', 'revpar', 'guest_satisfaction', 'operational', 'financial']
    count = 0

    for property in data_store['properties']:
        for i in range(random.randint(10, 20)):
            report_code = f"RPT-{fake.random_number(digits=6)}"
            report_name = f"{random.choice(report_types).upper()} Report - {fake.month_name()} {fake.year()}"

            cur.execute("""
                INSERT INTO analytics_reports (
                    id, tenant_id, report_name, report_code,
                    report_type, description, definition,
                    created_by_user_id, is_active
                ) VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                report_name,
                report_code,
                random.choice(report_types),
                f"Analytics report for {property['name']}",
                json.dumps({
                    'metrics': ['revenue', 'occupancy'],
                    'dimensions': ['date', 'property'],
                    'dateRange': {'start': '-30d', 'end': 'now'},
                    'filters': {},
                    'groupBy': ['property'],
                    'sortBy': []
                }),
                random.choice(data_store['users'])['id'],
                random.choice([True, False])
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} analytics reports")
