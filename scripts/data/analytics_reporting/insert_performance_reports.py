"""Insert function for performance_reports table"""


from db_config import generate_uuid
from faker import Faker

fake = Faker()
import json
import random


def insert_performance_reports(conn):
    """Insert performance report records"""
    print(f"\n✓ Inserting Performance Reports...")
    cur = conn.cursor()

    report_types = ['daily_summary', 'weekly_analysis', 'monthly_review', 'quarterly_report']
    severities = ['INFO', 'WARNING', 'CRITICAL']
    statuses = ['PENDING', 'SENT', 'FAILED']
    count = 0

    for i in range(random.randint(50, 150)):
        cur.execute("""
            INSERT INTO performance_reports (
                report_id, report_type, report_name, report_data,
                severity, status
            ) VALUES (%s, %s, %s, %s::jsonb, %s, %s)
        """, (
            generate_uuid(),
            random.choice(report_types),
            f"Performance Report - {fake.date()}",
            json.dumps({
                'occupancy': random.randint(50, 100),
                'adr': random.randint(100, 300),
                'revpar': random.randint(50, 250)
            }),
            random.choice(severities),
            random.choice(statuses)
        ))
        count += 1

    conn.commit()
    print(f"   → Inserted {count} performance reports")
