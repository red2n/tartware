"""Insert sample data for vehicles table"""

import json
import random
from datetime import date, datetime, time, timedelta

from faker import Faker

from data_store import data_store
from db_config import generate_uuid

fake = Faker()

_VEHICLE_TYPES = [
    "SHUTTLE_BUS",
    "MINIBUS",
    "VAN",
    "SEDAN",
    "SUV",
    "LIMOUSINE",
]
_VEHICLE_STATUS = ["AVAILABLE", "IN_USE", "MAINTENANCE", "OUT_OF_SERVICE", "RESERVED"]
_FUEL_TYPES = ["GASOLINE", "DIESEL", "ELECTRIC", "HYBRID"]
_OWNERSHIP_TYPES = ["OWNED", "LEASED", "CONTRACTED"]
_COLORS = ["White", "Black", "Silver", "Blue", "Gray"]
_MANUFACTURERS = ["Mercedes-Benz", "Ford", "Toyota", "Tesla", "Chevrolet"]
_MODELS = {
    "Mercedes-Benz": ["Sprinter", "V-Class"],
    "Ford": ["Transit", "Expedition"],
    "Toyota": ["HiAce", "Sienna"],
    "Tesla": ["Model X", "Model Y"],
    "Chevrolet": ["Suburban", "Express"],
}


def insert_vehicles(conn, per_property: int = 3):
    """Insert fleet vehicle records"""
    print("\n✓ Inserting Vehicles...")
    cur = conn.cursor()

    tenant_user_lookup = {u["id"]: u for u in data_store["users"]}
    tenant_users_per_tenant: dict[str, list[str]] = {}

    def get_tenant_users(tenant_id: str) -> list[str]:
        if tenant_id in tenant_users_per_tenant:
            return tenant_users_per_tenant[tenant_id]
        cur.execute(
            "SELECT user_id FROM user_tenant_associations WHERE tenant_id = %s",
            (tenant_id,),
        )
        users = [row[0] for row in cur.fetchall()]
        if not users:
            users = list(tenant_user_lookup.keys())
        tenant_users_per_tenant[tenant_id] = users
        return users

    count = 0
    for property_rec in data_store["properties"]:
        tenant_users = get_tenant_users(property_rec["tenant_id"])
        property_code = property_rec.get("code", "PROP")

        for index in range(per_property):
            vehicle_type = random.choice(_VEHICLE_TYPES)
            manufacturer = random.choice(_MANUFACTURERS)
            model = random.choice(_MODELS[manufacturer])
            vehicle_number = f"{property_code}-{vehicle_type[:3]}-{index + 1:02d}"
            license_plate = fake.bothify(text="??-####")
            ownership_type = random.choice(_OWNERSHIP_TYPES)
            fuel_type = random.choice(_FUEL_TYPES)
            vehicle_status = random.choice(_VEHICLE_STATUS)
            created_by = random.choice(tenant_users) if tenant_users else None

            passenger_capacity = random.randint(4, 28) if vehicle_type != "LIMOUSINE" else 4
            wheelchair_accessible = vehicle_type in {"SHUTTLE_BUS", "MINIBUS"} and random.random() < 0.3
            wheelchair_capacity = random.randint(1, 2) if wheelchair_accessible else 0

            vehicle_id = generate_uuid()
            cur.execute(
                """
                INSERT INTO vehicles (
                    vehicle_id, tenant_id, property_id,
                    vehicle_number, vehicle_name, license_plate, vin, registration_number,
                    vehicle_type, vehicle_category,
                    passenger_capacity, wheelchair_accessible, wheelchair_capacity, luggage_capacity,
                    manufacturer, model, model_year, trim_level, color, color_code,
                    fuel_type, fuel_tank_capacity_liters, electric_range_km, battery_capacity_kwh, charging_time_minutes,
                    vehicle_status, operational, out_of_service_reason, out_of_service_since,
                    ownership_type, owner_name, lease_start_date, lease_end_date, lease_monthly_cost,
                    insurance_company, insurance_policy_number, insurance_expiration_date, insurance_coverage_amount, insurance_deductible,
                    registration_expiration_date, inspection_due_date, emissions_test_date, safety_certification_date,
                    odometer_reading_km, last_odometer_update, total_km_driven, average_km_per_day,
                    last_service_date, last_service_km, next_service_due_date, next_service_due_km,
                    service_interval_km, service_interval_months, maintenance_notes,
                    air_conditioning, gps_navigation, wifi_enabled, bluetooth_audio, usb_charging,
                    leather_seats, sunroof, entertainment_system, child_seat_available, pet_friendly,
                    abs_brakes, airbags_count, backup_camera, blind_spot_monitoring, lane_departure_warning, collision_avoidance, emergency_kit, fire_extinguisher,
                    gps_tracker_installed, tracker_serial_number, telematics_provider, real_time_tracking, last_gps_location,
                    default_driver_id, current_driver_id, home_location, parking_spot,
                    service_hours_start, service_hours_end, available_days, operates_24_7,
                    base_rate_per_km, base_rate_per_hour, minimum_charge, airport_transfer_flat_rate, currency_code,
                    purchase_price, purchase_date, current_value, depreciation_per_year,
                    average_fuel_cost_per_km, maintenance_cost_ytd, total_operating_cost_ytd,
                    accident_history_count, last_accident_date, last_accident_description,
                    safety_inspection_dates, emissions_test_dates, mechanical_inspection_dates,
                    registration_document_url, insurance_document_url, inspection_certificate_url, vehicle_photo_url, manual_url,
                    co2_emissions_per_km, euro_emissions_standard, green_vehicle,
                    total_trips_ytd, total_hours_used_ytd, utilization_rate_percent, revenue_generated_ytd,
                    maintenance_alert, insurance_expiry_alert, registration_expiry_alert, inspection_due_alert,
                    internal_notes, driver_notes, guest_facing_description,
                    metadata, created_at, updated_at, created_by, updated_by
                ) VALUES (
                    %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s, %s
                )
                """,
                (
                    vehicle_id,
                    property_rec["tenant_id"],
                    property_rec["id"],
                    vehicle_number,
                    f"{manufacturer} {model} #{index + 1}",
                    license_plate,
                    fake.bothify(text="????????????????"),
                    f"REG-{random.randint(100000, 999999)}",
                    vehicle_type,
                    random.choice(["ECONOMY", "STANDARD", "LUXURY", "EXECUTIVE"]),
                    passenger_capacity,
                    wheelchair_accessible,
                    wheelchair_capacity,
                    random.randint(8, 30),
                    manufacturer,
                    model,
                    random.randint(2018, 2024),
                    random.choice(["Premium", "Standard", "Comfort"]),
                    random.choice(_COLORS),
                    fake.hexify(text="^^^^^^"),
                    fuel_type,
                    round(random.uniform(50.0, 120.0), 1) if fuel_type != "ELECTRIC" else None,
                    random.randint(220, 420) if fuel_type == "ELECTRIC" else None,
                    round(random.uniform(60.0, 120.0), 1) if fuel_type == "ELECTRIC" else None,
                    random.randint(45, 120) if fuel_type == "ELECTRIC" else None,
                    vehicle_status,
                    vehicle_status != "OUT_OF_SERVICE",
                    "Scheduled maintenance" if vehicle_status == "MAINTENANCE" else None,
                    datetime.utcnow() - timedelta(days=random.randint(1, 5)) if vehicle_status == "OUT_OF_SERVICE" else None,
                    ownership_type,
                    property_rec.get("name"),
                    date.today() - timedelta(days=random.randint(200, 800)) if ownership_type == "LEASED" else None,
                    date.today() + timedelta(days=random.randint(200, 800)) if ownership_type == "LEASED" else None,
                    round(random.uniform(800.0, 2500.0), 2) if ownership_type == "LEASED" else None,
                    random.choice(["Allianz", "Geico", "Zurich", "AXA"]),
                    f"POL-{random.randint(100000, 999999)}",
                    date.today() + timedelta(days=random.randint(120, 360)),
                    round(random.uniform(250000.0, 1000000.0), 2),
                    round(random.uniform(500.0, 2000.0), 2),
                    date.today() + timedelta(days=random.randint(180, 365)),
                    date.today() + timedelta(days=random.randint(90, 200)),
                    date.today() + timedelta(days=random.randint(90, 200)),
                    date.today() + timedelta(days=random.randint(120, 250)),
                    random.randint(5000, 75000),
                    datetime.utcnow() - timedelta(days=random.randint(1, 14)),
                    random.randint(15000, 120000),
                    round(random.uniform(40.0, 120.0), 1),
                    date.today() - timedelta(days=random.randint(30, 120)),
                    random.randint(10000, 30000),
                    date.today() + timedelta(days=random.randint(60, 180)),
                    random.randint(20000, 60000),
                    random.randint(4000, 8000),
                    random.randint(4, 12),
                    random.choice([
                        "Detailed inspection completed",
                        "Pending tire rotation",
                        None,
                    ]),
                    True,
                    random.random() < 0.6,
                    random.random() < 0.5,
                    random.random() < 0.7,
                    random.random() < 0.65,
                    random.random() < 0.4,
                    random.random() < 0.3,
                    random.random() < 0.2,
                    random.random() < 0.25,
                    random.random() < 0.5,
                    random.randint(2, 8),
                    random.random() < 0.7,
                    random.random() < 0.4,
                    random.random() < 0.35,
                    random.random() < 0.3,
                    random.random() < 0.9,
                    random.random() < 0.9,
                    random.random() < 0.6,
                    f"GPS-{random.randint(100000, 999999)}" if random.random() < 0.7 else None,
                    random.choice(["Geotab", "Verizon Connect", "Samsara", None]),
                    random.random() < 0.5,
                    json.dumps(
                        {
                            "lat": float(fake.latitude()),
                            "lng": float(fake.longitude()),
                            "timestamp": datetime.utcnow().isoformat(),
                        }
                    ) if random.random() < 0.5 else None,
                    None,
                    None,
                    property_rec.get("name"),
                    f"Spot-{random.randint(1, 60)}",
                    time(hour=random.randint(6, 9), minute=0),
                    time(hour=random.randint(18, 22), minute=0),
                    "Mon-Sun",
                    random.random() < 0.3,
                    round(random.uniform(2.5, 6.5), 2),
                    round(random.uniform(45.0, 120.0), 2),
                    round(random.uniform(30.0, 80.0), 2),
                    round(random.uniform(60.0, 150.0), 2),
                    "USD",
                    round(random.uniform(55000.0, 140000.0), 2),
                    date.today() - timedelta(days=random.randint(400, 1800)),
                    round(random.uniform(30000.0, 90000.0), 2),
                    round(random.uniform(1500.0, 6000.0), 2),
                    round(random.uniform(0.12, 0.45), 3),
                    round(random.uniform(1200.0, 5500.0), 2),
                    round(random.uniform(8500.0, 28000.0), 2),
                    random.randint(0, 2),
                    None,
                    None,
                    None,
                    None,
                    [date.today() - timedelta(days=random.randint(30, 180))],
                    [date.today() - timedelta(days=random.randint(60, 240))],
                    [date.today() - timedelta(days=random.randint(45, 200))],
                    f"https://assets.tartware.example/vehicles/{vehicle_id[:8]}.pdf",
                    f"https://assets.tartware.example/vehicles/{vehicle_id[:8]}_insurance.pdf",
                    f"https://assets.tartware.example/vehicles/{vehicle_id[:8]}_inspect.pdf",
                    f"https://assets.tartware.example/vehicles/{vehicle_id[:8]}.jpg",
                    f"https://assets.tartware.example/vehicles/{vehicle_id[:8]}_manual.pdf",
                    round(random.uniform(90.0, 250.0), 2) if fuel_type != "ELECTRIC" else 0.0,
                    random.choice(["Euro5", "Euro6", "ZeroEmission"]),
                    fuel_type == "ELECTRIC",
                    random.randint(50, 280),
                    random.randint(40, 300),
                    round(random.uniform(45.0, 85.0), 2),
                    round(random.uniform(25000.0, 120000.0), 2),
                    random.random() < 0.2,
                    random.random() < 0.15,
                    random.random() < 0.15,
                    random.random() < 0.15,
                    random.choice([
                        "Vehicle cleaned and sanitized",
                        "Ready for next shuttle cycle",
                        None,
                    ]),
                    random.choice([
                        "Driver prefers morning assignments",
                        "Check tire pressure weekly",
                        None,
                    ]),
                    random.choice([
                        "Complimentary airport shuttle",
                        "Executive transfer vehicle",
                        "Available upon request",
                    ]),
                    json.dumps({"tags": ["fleet", vehicle_type.lower()]}),
                    datetime.utcnow() - timedelta(days=random.randint(1, 60)),
                    datetime.utcnow(),
                    created_by,
                    created_by,
                ),
            )

            data_store["vehicles"].append(
                {
                    "vehicle_id": vehicle_id,
                    "tenant_id": property_rec["tenant_id"],
                    "property_id": property_rec["id"],
                    "vehicle_type": vehicle_type,
                    "vehicle_number": vehicle_number,
                }
            )
            count += 1

    conn.commit()
    print(f"   → Inserted {count} vehicles")
