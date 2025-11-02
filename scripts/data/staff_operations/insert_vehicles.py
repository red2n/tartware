"""Insert sample data for vehicles table"""

import json
import random
from datetime import date, datetime, time, timedelta

from faker import Faker

from data_store import data_store
from db_config import generate_uuid

VEHICLE_COLUMNS = [
    "vehicle_id",
    "tenant_id",
    "property_id",
    "vehicle_number",
    "vehicle_name",
    "license_plate",
    "vin",
    "registration_number",
    "vehicle_type",
    "vehicle_category",
    "passenger_capacity",
    "wheelchair_accessible",
    "wheelchair_capacity",
    "luggage_capacity",
    "cargo_capacity_cubic_meters",
    "manufacturer",
    "model",
    "model_year",
    "trim_level",
    "color",
    "color_code",
    "fuel_type",
    "fuel_tank_capacity_liters",
    "electric_range_km",
    "battery_capacity_kwh",
    "charging_time_minutes",
    "vehicle_status",
    "operational",
    "out_of_service_reason",
    "out_of_service_since",
    "ownership_type",
    "owner_name",
    "lease_start_date",
    "lease_end_date",
    "lease_monthly_cost",
    "insurance_company",
    "insurance_policy_number",
    "insurance_expiration_date",
    "insurance_coverage_amount",
    "insurance_deductible",
    "registration_expiration_date",
    "inspection_due_date",
    "emissions_test_date",
    "safety_certification_date",
    "odometer_reading_km",
    "last_odometer_update",
    "total_km_driven",
    "average_km_per_day",
    "last_service_date",
    "last_service_km",
    "next_service_due_date",
    "next_service_due_km",
    "service_interval_km",
    "service_interval_months",
    "maintenance_notes",
    "air_conditioning",
    "gps_navigation",
    "wifi_enabled",
    "bluetooth_audio",
    "usb_charging",
    "leather_seats",
    "sunroof",
    "entertainment_system",
    "child_seat_available",
    "pet_friendly",
    "abs_brakes",
    "airbags_count",
    "backup_camera",
    "blind_spot_monitoring",
    "lane_departure_warning",
    "collision_avoidance",
    "emergency_kit",
    "fire_extinguisher",
    "gps_tracker_installed",
    "tracker_serial_number",
    "telematics_provider",
    "real_time_tracking",
    "last_gps_location",
    "default_driver_id",
    "current_driver_id",
    "home_location",
    "parking_spot",
    "service_hours_start",
    "service_hours_end",
    "available_days",
    "operates_24_7",
    "base_rate_per_km",
    "base_rate_per_hour",
    "minimum_charge",
    "airport_transfer_flat_rate",
    "currency_code",
    "purchase_price",
    "purchase_date",
    "current_value",
    "depreciation_per_year",
    "average_fuel_cost_per_km",
    "maintenance_cost_ytd",
    "total_operating_cost_ytd",
    "accident_history_count",
    "last_accident_date",
    "last_accident_description",
    "safety_inspection_dates",
    "emissions_test_dates",
    "mechanical_inspection_dates",
    "registration_document_url",
    "insurance_document_url",
    "inspection_certificate_url",
    "vehicle_photo_url",
    "manual_url",
    "co2_emissions_per_km",
    "euro_emissions_standard",
    "green_vehicle",
    "total_trips_ytd",
    "total_hours_used_ytd",
    "utilization_rate_percent",
    "revenue_generated_ytd",
    "maintenance_alert",
    "insurance_expiry_alert",
    "registration_expiry_alert",
    "inspection_due_alert",
    "internal_notes",
    "driver_notes",
    "guest_facing_description",
    "metadata",
    "created_at",
    "updated_at",
    "created_by",
    "updated_by",
    "is_deleted",
    "deleted_at",
    "deleted_by",
    "version",
]

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

    columns_clause = ", ".join(VEHICLE_COLUMNS)
    values_clause = ", ".join(["%s"] * len(VEHICLE_COLUMNS))

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
            wheelchair_accessible = (
                vehicle_type in {"SHUTTLE_BUS", "MINIBUS"} and random.random() < 0.3
            )
            wheelchair_capacity = random.randint(1, 2) if wheelchair_accessible else 0
            vehicle_category = random.choice(["ECONOMY", "STANDARD", "LUXURY", "EXECUTIVE"])
            luggage_capacity = random.randint(8, 30)
            cargo_capacity_cubic_meters = round(random.uniform(1.5, 12.0), 2)
            model_year = random.randint(2018, 2024)
            trim_level = random.choice(["Premium", "Standard", "Comfort"])
            color = random.choice(_COLORS)
            color_code = fake.hexify(text="^^^^^^")

            fuel_tank_capacity = (
                round(random.uniform(50.0, 120.0), 1) if fuel_type != "ELECTRIC" else None
            )
            electric_range = random.randint(220, 420) if fuel_type == "ELECTRIC" else None
            battery_capacity = (
                round(random.uniform(60.0, 120.0), 1) if fuel_type == "ELECTRIC" else None
            )
            charging_time = random.randint(45, 120) if fuel_type == "ELECTRIC" else None

            operational = vehicle_status != "OUT_OF_SERVICE"
            out_of_service_reason = (
                "Scheduled maintenance" if vehicle_status == "MAINTENANCE" else None
            )
            out_of_service_since = (
                datetime.utcnow() - timedelta(days=random.randint(1, 5))
                if vehicle_status == "OUT_OF_SERVICE"
                else None
            )

            lease_start_date = (
                date.today() - timedelta(days=random.randint(200, 800))
                if ownership_type == "LEASED"
                else None
            )
            lease_end_date = (
                date.today() + timedelta(days=random.randint(200, 800))
                if ownership_type == "LEASED"
                else None
            )
            lease_monthly_cost = (
                round(random.uniform(800.0, 2500.0), 2)
                if ownership_type == "LEASED"
                else None
            )

            insurance_company = random.choice(["Allianz", "Geico", "Zurich", "AXA"])
            insurance_policy_number = f"POL-{random.randint(100000, 999999)}"
            insurance_expiration_date = date.today() + timedelta(days=random.randint(120, 360))
            insurance_coverage_amount = round(random.uniform(250000.0, 1000000.0), 2)
            insurance_deductible = round(random.uniform(500.0, 2000.0), 2)

            registration_expiration_date = date.today() + timedelta(days=random.randint(180, 365))
            inspection_due_date = date.today() + timedelta(days=random.randint(90, 200))
            emissions_test_date = date.today() + timedelta(days=random.randint(90, 200))
            safety_certification_date = date.today() + timedelta(days=random.randint(120, 250))

            odometer_reading = random.randint(5000, 75000)
            last_odometer_update = datetime.utcnow() - timedelta(days=random.randint(1, 14))
            total_km_driven = random.randint(15000, 120000)
            average_km_per_day = round(random.uniform(40.0, 120.0), 1)

            last_service_date = date.today() - timedelta(days=random.randint(30, 120))
            last_service_km = random.randint(10000, 30000)
            next_service_due_date = date.today() + timedelta(days=random.randint(60, 180))
            next_service_due_km = random.randint(20000, 60000)
            service_interval_km = random.randint(4000, 8000)
            service_interval_months = random.randint(4, 12)
            maintenance_notes = random.choice(
                ["Detailed inspection completed", "Pending tire rotation", None]
            )

            air_conditioning = True
            gps_navigation = random.random() < 0.6
            wifi_enabled = random.random() < 0.5
            bluetooth_audio = random.random() < 0.7
            usb_charging = random.random() < 0.65
            leather_seats = random.random() < 0.4
            sunroof = random.random() < 0.3
            entertainment_system = random.random() < 0.2
            child_seat_available = random.random() < 0.25
            pet_friendly = random.random() < 0.5

            abs_brakes = True
            airbags_count = random.randint(2, 8)
            backup_camera = random.random() < 0.7
            blind_spot_monitoring = random.random() < 0.4
            lane_departure_warning = random.random() < 0.35
            collision_avoidance = random.random() < 0.3
            emergency_kit = random.random() < 0.9
            fire_extinguisher = random.random() < 0.9

            gps_tracker_installed = random.random() < 0.6
            tracker_serial_number = (
                f"GPS-{random.randint(100000, 999999)}" if gps_tracker_installed else None
            )
            telematics_provider = random.choice(["Geotab", "Verizon Connect", "Samsara", None])
            real_time_tracking = random.random() < 0.5
            last_gps_location = (
                json.dumps(
                    {
                        "lat": float(fake.latitude()),
                        "lng": float(fake.longitude()),
                        "timestamp": datetime.utcnow().isoformat(),
                    }
                )
                if random.random() < 0.5
                else None
            )

            default_driver_id = random.choice(tenant_users) if tenant_users else None
            current_driver_id = random.choice(tenant_users) if tenant_users else None
            home_location = property_rec.get("name")
            parking_spot = f"Spot-{random.randint(1, 60)}"
            service_hours_start = time(hour=random.randint(6, 9), minute=0)
            service_hours_end = time(hour=random.randint(18, 22), minute=0)
            available_days = "Mon-Sun"
            operates_24_7 = random.random() < 0.3

            base_rate_per_km = round(random.uniform(2.5, 6.5), 2)
            base_rate_per_hour = round(random.uniform(45.0, 120.0), 2)
            minimum_charge = round(random.uniform(30.0, 80.0), 2)
            airport_transfer_flat_rate = round(random.uniform(60.0, 150.0), 2)
            currency_code = "USD"

            purchase_price = round(random.uniform(55000.0, 140000.0), 2)
            purchase_date = date.today() - timedelta(days=random.randint(400, 1800))
            current_value = round(random.uniform(30000.0, 90000.0), 2)
            depreciation_per_year = round(random.uniform(1500.0, 6000.0), 2)
            average_fuel_cost_per_km = round(random.uniform(0.12, 0.45), 3)
            maintenance_cost_ytd = round(random.uniform(1200.0, 5500.0), 2)
            total_operating_cost_ytd = round(random.uniform(8500.0, 28000.0), 2)

            accident_history_count = random.randint(0, 2)
            last_accident_date = (
                date.today() - timedelta(days=random.randint(30, 400))
                if random.random() < 0.1
                else None
            )
            last_accident_description = (
                random.choice(["Minor collision", "Scratched bumper"])
                if last_accident_date
                else None
            )

            safety_inspection_dates = [
                date.today() - timedelta(days=random.randint(30, 180))
                for _ in range(random.randint(1, 2))
            ]
            emissions_test_dates = [
                date.today() - timedelta(days=random.randint(60, 240))
                for _ in range(random.randint(1, 2))
            ]
            mechanical_inspection_dates = [
                date.today() - timedelta(days=random.randint(45, 200))
                for _ in range(random.randint(1, 2))
            ]

            registration_document_url = (
                f"https://assets.tartware.example/vehicles/{vehicle_number}_registration.pdf"
            )
            insurance_document_url = (
                f"https://assets.tartware.example/vehicles/{vehicle_number}_insurance.pdf"
            )
            inspection_certificate_url = (
                f"https://assets.tartware.example/vehicles/{vehicle_number}_inspection.pdf"
            )
            vehicle_photo_url = (
                f"https://assets.tartware.example/vehicles/{vehicle_number}.jpg"
            )
            manual_url = f"https://assets.tartware.example/vehicles/{vehicle_number}_manual.pdf"

            co2_emissions_per_km = (
                round(random.uniform(90.0, 250.0), 2) if fuel_type != "ELECTRIC" else 0.0
            )
            euro_emissions_standard = random.choice(["Euro5", "Euro6", "ZeroEmission"])
            green_vehicle = fuel_type == "ELECTRIC"

            total_trips_ytd = random.randint(50, 280)
            total_hours_used_ytd = random.randint(40, 300)
            utilization_rate_percent = round(random.uniform(45.0, 85.0), 2)
            revenue_generated_ytd = round(random.uniform(25000.0, 120000.0), 2)

            maintenance_alert = random.random() < 0.2
            insurance_expiry_alert = random.random() < 0.15
            registration_expiry_alert = random.random() < 0.15
            inspection_due_alert = random.random() < 0.15

            internal_notes = random.choice(
                [
                    "Vehicle cleaned and sanitized",
                    "Ready for next shuttle cycle",
                    None,
                ]
            )
            driver_notes = random.choice(
                [
                    "Driver prefers morning assignments",
                    "Check tire pressure weekly",
                    None,
                ]
            )
            guest_facing_description = random.choice(
                [
                    "Complimentary airport shuttle",
                    "Executive transfer vehicle",
                    "Available upon request",
                ]
            )

            metadata = json.dumps({"tags": ["fleet", vehicle_type.lower()]})
            created_at = datetime.utcnow() - timedelta(days=random.randint(1, 60))
            updated_at = datetime.utcnow()
            updated_by = created_by

            vehicle_data = {
                "vehicle_id": generate_uuid(),
                "tenant_id": property_rec["tenant_id"],
                "property_id": property_rec["id"],
                "vehicle_number": vehicle_number,
                "vehicle_name": f"{manufacturer} {model} #{index + 1}",
                "license_plate": license_plate,
                "vin": fake.bothify(text="????????????????"),
                "registration_number": f"REG-{random.randint(100000, 999999)}",
                "vehicle_type": vehicle_type,
                "vehicle_category": vehicle_category,
                "passenger_capacity": passenger_capacity,
                "wheelchair_accessible": wheelchair_accessible,
                "wheelchair_capacity": wheelchair_capacity,
                "luggage_capacity": luggage_capacity,
                "cargo_capacity_cubic_meters": cargo_capacity_cubic_meters,
                "manufacturer": manufacturer,
                "model": model,
                "model_year": model_year,
                "trim_level": trim_level,
                "color": color,
                "color_code": color_code,
                "fuel_type": fuel_type,
                "fuel_tank_capacity_liters": fuel_tank_capacity,
                "electric_range_km": electric_range,
                "battery_capacity_kwh": battery_capacity,
                "charging_time_minutes": charging_time,
                "vehicle_status": vehicle_status,
                "operational": operational,
                "out_of_service_reason": out_of_service_reason,
                "out_of_service_since": out_of_service_since,
                "ownership_type": ownership_type,
                "owner_name": property_rec.get("name"),
                "lease_start_date": lease_start_date,
                "lease_end_date": lease_end_date,
                "lease_monthly_cost": lease_monthly_cost,
                "insurance_company": insurance_company,
                "insurance_policy_number": insurance_policy_number,
                "insurance_expiration_date": insurance_expiration_date,
                "insurance_coverage_amount": insurance_coverage_amount,
                "insurance_deductible": insurance_deductible,
                "registration_expiration_date": registration_expiration_date,
                "inspection_due_date": inspection_due_date,
                "emissions_test_date": emissions_test_date,
                "safety_certification_date": safety_certification_date,
                "odometer_reading_km": odometer_reading,
                "last_odometer_update": last_odometer_update,
                "total_km_driven": total_km_driven,
                "average_km_per_day": average_km_per_day,
                "last_service_date": last_service_date,
                "last_service_km": last_service_km,
                "next_service_due_date": next_service_due_date,
                "next_service_due_km": next_service_due_km,
                "service_interval_km": service_interval_km,
                "service_interval_months": service_interval_months,
                "maintenance_notes": maintenance_notes,
                "air_conditioning": air_conditioning,
                "gps_navigation": gps_navigation,
                "wifi_enabled": wifi_enabled,
                "bluetooth_audio": bluetooth_audio,
                "usb_charging": usb_charging,
                "leather_seats": leather_seats,
                "sunroof": sunroof,
                "entertainment_system": entertainment_system,
                "child_seat_available": child_seat_available,
                "pet_friendly": pet_friendly,
                "abs_brakes": abs_brakes,
                "airbags_count": airbags_count,
                "backup_camera": backup_camera,
                "blind_spot_monitoring": blind_spot_monitoring,
                "lane_departure_warning": lane_departure_warning,
                "collision_avoidance": collision_avoidance,
                "emergency_kit": emergency_kit,
                "fire_extinguisher": fire_extinguisher,
                "gps_tracker_installed": gps_tracker_installed,
                "tracker_serial_number": tracker_serial_number,
                "telematics_provider": telematics_provider,
                "real_time_tracking": real_time_tracking,
                "last_gps_location": last_gps_location,
                "default_driver_id": default_driver_id,
                "current_driver_id": current_driver_id,
                "home_location": home_location,
                "parking_spot": parking_spot,
                "service_hours_start": service_hours_start,
                "service_hours_end": service_hours_end,
                "available_days": available_days,
                "operates_24_7": operates_24_7,
                "base_rate_per_km": base_rate_per_km,
                "base_rate_per_hour": base_rate_per_hour,
                "minimum_charge": minimum_charge,
                "airport_transfer_flat_rate": airport_transfer_flat_rate,
                "currency_code": currency_code,
                "purchase_price": purchase_price,
                "purchase_date": purchase_date,
                "current_value": current_value,
                "depreciation_per_year": depreciation_per_year,
                "average_fuel_cost_per_km": average_fuel_cost_per_km,
                "maintenance_cost_ytd": maintenance_cost_ytd,
                "total_operating_cost_ytd": total_operating_cost_ytd,
                "accident_history_count": accident_history_count,
                "last_accident_date": last_accident_date,
                "last_accident_description": last_accident_description,
                "safety_inspection_dates": safety_inspection_dates,
                "emissions_test_dates": emissions_test_dates,
                "mechanical_inspection_dates": mechanical_inspection_dates,
                "registration_document_url": registration_document_url,
                "insurance_document_url": insurance_document_url,
                "inspection_certificate_url": inspection_certificate_url,
                "vehicle_photo_url": vehicle_photo_url,
                "manual_url": manual_url,
                "co2_emissions_per_km": co2_emissions_per_km,
                "euro_emissions_standard": euro_emissions_standard,
                "green_vehicle": green_vehicle,
                "total_trips_ytd": total_trips_ytd,
                "total_hours_used_ytd": total_hours_used_ytd,
                "utilization_rate_percent": utilization_rate_percent,
                "revenue_generated_ytd": revenue_generated_ytd,
                "maintenance_alert": maintenance_alert,
                "insurance_expiry_alert": insurance_expiry_alert,
                "registration_expiry_alert": registration_expiry_alert,
                "inspection_due_alert": inspection_due_alert,
                "internal_notes": internal_notes,
                "driver_notes": driver_notes,
                "guest_facing_description": guest_facing_description,
                "metadata": metadata,
                "created_at": created_at,
                "updated_at": updated_at,
                "created_by": created_by,
                "updated_by": updated_by,
                "is_deleted": False,
                "deleted_at": None,
                "deleted_by": None,
                "version": 1,
            }

            cur.execute(
                f"INSERT INTO vehicles ({columns_clause}) VALUES ({values_clause})",
                [vehicle_data[column] for column in VEHICLE_COLUMNS],
            )

            data_store.setdefault("vehicles", []).append(
                {
                    "vehicle_id": vehicle_data["vehicle_id"],
                    "tenant_id": property_rec["tenant_id"],
                    "property_id": property_rec["id"],
                    "vehicle_type": vehicle_type,
                    "vehicle_number": vehicle_number,
                }
            )
            count += 1

    conn.commit()
    print(f"   → Inserted {count} vehicles")
