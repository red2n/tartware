"""Insert function for report_schedules table"""


from datetime import datetime, timedelta
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import json
import random
import time


def insert_report_schedules(conn):
    """Insert report schedule records"""
    print(f"\n✓ Inserting Report Schedules...")
    cur = conn.cursor()

    report_types = ['occupancy_report', 'revenue_report', 'financial_summary', 'operational_metrics',
                    'guest_satisfaction', 'performance_dashboard']
    cron_expressions = ['0 0 * * *', '0 0 * * 0', '0 0 1 * *', '0 0 1 1,4,7,10 *']  # daily, weekly, monthly, quarterly
    count = 0

    for report_type in report_types:
        cron = random.choice(cron_expressions)
        now = datetime.now()
        last_run = now - timedelta(days=random.randint(1, 7))
        next_run = now + timedelta(days=random.randint(1, 7))

        cur.execute("""
            INSERT INTO report_schedules (
                schedule_id, report_type, schedule_expression,
                is_active, last_run, next_run, recipients, config
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb)
        """, (
            generate_uuid(),
            report_type,
            cron,
            random.choice([True, True, True, False]),
            last_run,
            next_run,
            [fake.email() for _ in range(random.randint(1, 4))],
            json.dumps({'format': random.choice(['pdf', 'excel', 'csv']), 'include_charts': True})
        ))
        count += 1

    conn.commit()
    print(f"   → Inserted {count} report schedules")
