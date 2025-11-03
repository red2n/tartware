"""Insert sample data for room_energy_usage"""

import random
from datetime import datetime, timedelta

from faker import Faker

from data_store import data_store
from db_config import generate_uuid

fake = Faker()

_HVAC_MODES = ["cool", "heat", "auto", "off"]
_FAN_SPEEDS = ["low", "medium", "high", "auto"]
_EFFICIENCY_RATINGS = ["excellent", "good", "average", "poor", "very_poor"]


def _choose_efficiency(variance: float) -> str:
    if variance <= -5:
        return "excellent"
    if variance <= -2:
        return "good"
    if variance <= 3:
        return "average"
    if variance <= 7:
        return "poor"
    return "very_poor"


def insert_room_energy_usage(conn, max_rooms_per_property: int = 8):
    """Insert energy usage records for sample rooms"""
    print("\n✓ Inserting Room Energy Usage...")
    cur = conn.cursor()

    count = 0
    today = datetime.utcnow().date()

    for property_rec in data_store["properties"]:
        property_rooms = [r for r in data_store["rooms"] if r["property_id"] == property_rec["id"]]
        if not property_rooms:
            continue

        cur.execute(
            "SELECT id, guest_id FROM reservations WHERE property_id = %s ORDER BY random() LIMIT 200",
            (property_rec["id"],),
        )
        reservation_rows = cur.fetchall()

        rooms_to_process = random.sample(
            property_rooms,
            k=min(len(property_rooms), max_rooms_per_property),
        )

        for room in rooms_to_process:
            measurement_days = random.randint(5, 10)

            for days_back in range(measurement_days):
                measurement_date = today - timedelta(days=days_back)
                measurement_hour = random.randint(0, 23)
                occupied = random.random() < 0.6

                guest_id = None
                reservation_id = None
                num_guests = 0

                if occupied and reservation_rows:
                    res_id, res_guest = random.choice(reservation_rows)
                    reservation_id = res_id
                    guest_id = res_guest
                    num_guests = random.randint(1, 3)
                elif occupied:
                    num_guests = random.randint(1, 2)

                total_energy = round(random.uniform(8.0, 65.0), 4)
                hvac_energy = round(total_energy * random.uniform(0.3, 0.6), 4)
                lighting_energy = round(total_energy * random.uniform(0.1, 0.25), 4)
                appliances_energy = round(total_energy * random.uniform(0.05, 0.2), 4)
                other_energy = max(0.0, round(total_energy - (hvac_energy + lighting_energy + appliances_energy), 4))

                energy_cost = round(total_energy * random.uniform(0.12, 0.25), 2)
                water_cost = round(random.uniform(2.0, 10.0), 2)
                total_cost = round(energy_cost + water_cost, 2)

                property_average = round(total_energy * random.uniform(0.85, 1.15), 4)
                variance = round(total_energy - property_average, 4)
                efficiency_rating = _choose_efficiency(variance)

                over_consumption = total_energy > property_average * 1.2
                anomaly_detected = random.random() < 0.07 or over_consumption
                anomaly_type = None
                if anomaly_detected:
                    anomaly_type = random.choice([
                        "unexpected_usage",
                        "sensor_mismatch",
                        "hvac_runtime_spike",
                        "water_leak_suspected",
                        "lights_left_on",
                    ])

                usage_id = generate_uuid()
                cur.execute(
                    """
                    INSERT INTO room_energy_usage (
                        usage_id, tenant_id, property_id, room_id,
                        measurement_date, measurement_hour,
                        is_occupied, guest_id, reservation_id, number_of_guests,
                        total_energy_kwh, hvac_energy_kwh, lighting_energy_kwh,
                        appliances_energy_kwh, other_energy_kwh,
                        indoor_temperature, outdoor_temperature,
                        indoor_humidity, outdoor_humidity,
                        hvac_mode, target_temperature, fan_speed, hvac_runtime_minutes,
                        lights_on_count, total_lighting_minutes,
                        hot_water_liters, cold_water_liters,
                        energy_cost, water_cost, total_cost,
                        property_average_kwh, variance_from_average, efficiency_rating,
                        over_consumption_alert, anomaly_detected, anomaly_type,
                        created_at
                    ) VALUES (
                        %s, %s, %s, %s,
                        %s, %s,
                        %s, %s, %s, %s,
                        %s, %s, %s,
                        %s, %s,
                        %s, %s,
                        %s, %s,
                        %s, %s, %s, %s,
                        %s, %s,
                        %s, %s,
                        %s, %s, %s,
                        %s, %s, %s,
                        %s, %s, %s,
                        %s
                    )
                    """,
                    (
                        usage_id,
                        property_rec["tenant_id"],
                        property_rec["id"],
                        room["id"],
                        measurement_date,
                        measurement_hour,
                        occupied,
                        guest_id,
                        reservation_id,
                        num_guests,
                        total_energy,
                        hvac_energy,
                        lighting_energy,
                        appliances_energy,
                        other_energy,
                        round(random.uniform(19.0, 25.0), 2),
                        round(random.uniform(15.0, 35.0), 2),
                        round(random.uniform(35.0, 65.0), 2),
                        round(random.uniform(30.0, 90.0), 2),
                        random.choice(_HVAC_MODES),
                        round(random.uniform(20.0, 23.0), 2),
                        random.choice(_FAN_SPEEDS),
                        random.randint(15, 240),
                        random.randint(0, 10),
                        random.randint(0, 240),
                        round(random.uniform(20.0, 120.0), 2),
                        round(random.uniform(20.0, 160.0), 2),
                        energy_cost,
                        water_cost,
                        total_cost,
                        property_average,
                        variance,
                        efficiency_rating,
                        over_consumption,
                        anomaly_detected,
                        anomaly_type,
                        datetime.utcnow(),
                    ),
                )

                data_store["room_energy_usage"].append(
                    {
                        "usage_id": usage_id,
                        "room_id": room["id"],
                        "tenant_id": property_rec["tenant_id"],
                    }
                )
                count += 1

    conn.commit()
    print(f"   → Inserted {count} room energy usage readings")
