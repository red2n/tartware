"""Insert function for revenue_forecasts table"""


from data_store import data_store
from datetime import datetime, timedelta
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random
import time


def insert_revenue_forecasts(conn):
    """Insert revenue forecast records"""
    print(f"\n✓ Inserting Revenue Forecasts...")
    cur = conn.cursor()

    forecast_periods = ['daily', 'weekly', 'monthly', 'quarterly']
    forecast_types = ['revenue', 'occupancy', 'adr', 'revpar']

    count = 0
    # Generate forecasts for each property (90 days forward)
    for property in data_store['properties']:
        for days_ahead in range(0, 90, 7):  # Weekly forecasts
            forecast_date = datetime.now().date() + timedelta(days=days_ahead)
            period_start = forecast_date
            period_end = forecast_date + timedelta(days=6)

            forecasted_revenue = round(random.uniform(10000, 50000), 2)

            cur.execute("""
                INSERT INTO revenue_forecasts (
                    forecast_id, tenant_id, property_id,
                    forecast_date, forecast_period, period_start_date, period_end_date,
                    forecast_type, forecasted_value,
                    forecasted_rooms_sold, forecasted_adr, forecasted_occupancy_percent,
                    total_revenue_forecast, confidence_level,
                    created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                forecast_date,
                random.choice(forecast_periods),
                period_start,
                period_end,
                random.choice(forecast_types),
                forecasted_revenue,
                random.randint(15, 30),
                round(random.uniform(100, 300), 2),
                round(random.uniform(60, 95), 2),
                forecasted_revenue,
                round(random.uniform(70, 95), 2),
                fake.date_time_between(start_date="-30d", end_date="now")
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} revenue forecasts")
