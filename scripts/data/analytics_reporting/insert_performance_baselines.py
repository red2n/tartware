"""Insert function for performance_baselines table"""
from db_config import generate_uuid
import random


def insert_performance_baselines(conn):
    """Insert performance baseline records"""
    print(f"\n✓ Inserting Performance Baselines...")
    cur = conn.cursor()

    metric_names = ['occupancy_rate', 'average_daily_rate', 'revenue_per_available_room', 'booking_lead_time', 'response_time', 'error_rate']
    time_windows = ['hourly', 'daily', 'weekly', 'monthly']
    count = 0

    for metric in metric_names:
        for time_window in time_windows:
            baseline_val = round(random.uniform(50, 95), 2)
            cur.execute("""
                INSERT INTO performance_baselines (
                    baseline_id, metric_name, time_window,
                    baseline_value, stddev_value, min_value, max_value,
                    sample_count
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                metric,
                time_window,
                baseline_val,
                round(random.uniform(5, 15), 2),
                round(baseline_val * 0.8, 2),
                round(baseline_val * 1.2, 2),
                random.randint(100, 10000)
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} performance baselines")
