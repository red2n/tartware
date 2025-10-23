"""Insert function for alert_rules table"""
from db_config import generate_uuid
import random


def insert_alert_rules(conn):
    """Insert alert rule records"""
    print(f"\n✓ Inserting Alert Rules...")
    cur = conn.cursor()

    metrics = ['occupancy_rate', 'adr', 'revpar', 'response_time', 'error_rate', 'cpu_usage']
    condition_types = ['threshold', 'deviation', 'trend', 'spike']
    severities = ['INFO', 'WARNING', 'CRITICAL']
    channels = ['email', 'sms', 'slack', 'webhook']
    count = 0

    for metric in metrics:
        for condition in condition_types[:2]:  # 2 rules per metric
            rule_name = f"{metric}_{condition}_{random.randint(1000, 9999)}"
            cur.execute("""
                INSERT INTO alert_rules (
                    rule_id, rule_name, metric_query, condition_type,
                    threshold_value, deviation_percent, time_window,
                    severity, is_active, notification_channels
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                rule_name,
                f"SELECT AVG({metric}) FROM metrics WHERE time > NOW() - INTERVAL '5 minutes'",
                condition,
                round(random.uniform(50, 100), 2) if condition == 'threshold' else None,
                round(random.uniform(10, 30), 2) if condition == 'deviation' else None,
                f"{random.choice([5, 10, 15, 30])} minutes",
                random.choice(severities),
                random.choice([True, True, True, False]),
                random.sample(channels, k=random.randint(1, 3))
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} alert rules")
