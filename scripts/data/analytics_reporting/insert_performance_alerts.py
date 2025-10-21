"""Insert function for performance_alerts table"""


from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random


def insert_performance_alerts(conn):
    """Insert performance alert records"""
    print(f"\n✓ Inserting Performance Alerts...")
    cur = conn.cursor()

    alert_types = ['occupancy', 'rate', 'cancellation', 'system', 'payment', 'response_time', 'error_rate']
    severities = ['INFO', 'WARNING', 'CRITICAL']
    count = 0

    for i in range(random.randint(50, 150)):
        current_val = random.uniform(0, 100)
        baseline_val = random.uniform(0, 100)

        cur.execute("""
            INSERT INTO performance_alerts (
                alert_id, alert_type, severity, metric_name,
                current_value, baseline_value, deviation_percent,
                alert_message, acknowledged
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            generate_uuid(),
            random.choice(alert_types),
            random.choice(severities),
            f"{random.choice(['occupancy_rate', 'adr', 'revpar', 'response_time', 'error_rate'])}",
            round(current_val, 2),
            round(baseline_val, 2),
            round(abs(current_val - baseline_val) / baseline_val * 100, 2) if baseline_val > 0 else 0,
            fake.sentence(),
            random.choice([True, True, False])
        ))
        count += 1

    conn.commit()
    print(f"   → Inserted {count} performance alerts")
