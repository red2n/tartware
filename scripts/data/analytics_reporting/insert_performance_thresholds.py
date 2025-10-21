"""Insert function for performance_thresholds table"""
from db_config import generate_uuid
import random


def insert_performance_thresholds(conn):
    """Insert performance threshold records"""
    print(f"\n✓ Inserting Performance Thresholds...")
    cur = conn.cursor()

    metric_names = ['occupancy_rate', 'cancellation_rate', 'no_show_rate', 'average_daily_rate', 'response_time', 'error_rate']
    count = 0

    for metric in metric_names:
        cur.execute("""
            INSERT INTO performance_thresholds (
                threshold_id, metric_name, warning_threshold, critical_threshold,
                is_active
            ) VALUES (%s, %s, %s, %s, %s)
        """, (
            generate_uuid(),
            metric,
            round(random.uniform(60, 80), 2),
            round(random.uniform(40, 60), 2),
            random.choice([True, True, False])
        ))
        count += 1

    conn.commit()
    print(f"   → Inserted {count} performance thresholds")
