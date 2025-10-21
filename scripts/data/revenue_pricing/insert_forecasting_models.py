"""Insert function for forecasting_models table"""
from data_store import data_store
from db_config import generate_uuid
import json
import random


def insert_forecasting_models(conn):
    """Insert forecasting model records"""
    print(f"\n✓ Inserting Forecasting Models...")
    cur = conn.cursor()

    model_types = ['occupancy', 'revenue', 'demand', 'pricing']
    count = 0

    for property in data_store['properties']:
        for model_type in model_types:
            cur.execute("""
                INSERT INTO forecasting_models (
                    model_id, tenant_id, property_id,
                    model_name, model_type, parameters,
                    accuracy_score, is_active
                ) VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                f"{model_type.title()} Forecast Model - {property.get('name', 'Property')}",
                model_type,
                json.dumps({'algorithm': 'random_forest', 'features': ['historical_data', 'seasonality', 'events']}),
                round(random.uniform(0.75, 0.95), 2),
                random.choice([True, True, False])
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} forecasting models")
