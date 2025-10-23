"""Insert function for analytics_metrics table"""


from data_store import data_store
from datetime import datetime, timedelta
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random
import time


def insert_analytics_metrics(conn):
    """Insert analytics metrics records"""
    print(f"\n✓ Inserting Analytics Metrics...")
    cur = conn.cursor()

    # Valid enum values for metric_type
    metric_types = ['OCCUPANCY_RATE', 'ADR', 'REVPAR', 'TOTAL_REVENUE', 'BOOKING_COUNT', 'CANCELLATION_RATE', 'LENGTH_OF_STAY', 'LEAD_TIME']
    time_granularities = ['DAILY', 'WEEKLY', 'MONTHLY']
    count = 0

    for property in data_store['properties']:
        for days_ago in range(30):
            metric_date = datetime.now().date() - timedelta(days=days_ago)

            for metric_type in random.sample(metric_types, 2):
                # Different value ranges based on metric type
                if metric_type in ['ADR', 'REVPAR']:
                    metric_value = round(random.uniform(100, 500), 2)
                elif metric_type == 'TOTAL_REVENUE':
                    metric_value = round(random.uniform(5000, 25000), 2)
                elif metric_type in ['OCCUPANCY_RATE', 'CANCELLATION_RATE']:
                    metric_value = round(random.uniform(50, 95), 2)
                elif metric_type in ['BOOKING_COUNT']:
                    metric_value = round(random.uniform(10, 100), 0)
                elif metric_type in ['LENGTH_OF_STAY', 'LEAD_TIME']:
                    metric_value = round(random.uniform(1, 10), 1)
                else:
                    metric_value = round(random.uniform(100, 1000), 2)

                cur.execute("""
                    INSERT INTO analytics_metrics (
                        id, tenant_id, property_id,
                        metric_type, metric_name, metric_code,
                        metric_date, time_granularity, metric_value,
                        status, created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    generate_uuid(),
                    property['tenant_id'],
                    property['id'],
                    metric_type,
                    f"{metric_type} Daily",
                    f"MTR_{metric_type}",
                    metric_date,
                    'DAILY',
                    metric_value,
                    'COMPLETED',
                    fake.date_time_between(start_date="-30d", end_date="now")
                ))
                count += 1

    conn.commit()
    print(f"   → Inserted {count} analytics metrics")
