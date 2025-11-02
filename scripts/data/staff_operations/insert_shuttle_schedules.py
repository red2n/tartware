"""Insert sample data for shuttle_schedules table"""

from __future__ import annotations

import json
import random
from datetime import date, datetime, time, timedelta
from uuid import UUID

from psycopg2.extras import register_uuid

from faker import Faker

from data_store import data_store
from db_config import generate_uuid

SHUTTLE_COLUMNS = [
    "schedule_id",
    "tenant_id",
    "property_id",
    "schedule_name",
    "schedule_code",
    "description",
    "route_type",
    "route_name",
    "is_roundtrip",
    "is_loop",
    "route_stops",
    "total_stops",
    "departure_location",
    "departure_address",
    "departure_coordinates",
    "destination_location",
    "destination_address",
    "destination_coordinates",
    "estimated_duration_minutes",
    "estimated_distance_km",
    "buffer_time_minutes",
    "schedule_type",
    "departure_times",
    "interval_minutes",
    "first_departure_time",
    "last_departure_time",
    "operates_monday",
    "operates_tuesday",
    "operates_wednesday",
    "operates_thursday",
    "operates_friday",
    "operates_saturday",
    "operates_sunday",
    "operates_holidays",
    "operates_on_closure_days",
    "special_operating_dates",
    "excluded_dates",
    "seasonal",
    "season_start_date",
    "season_end_date",
    "season_name",
    "default_vehicle_id",
    "alternate_vehicle_ids",
    "vehicle_type_required",
    "min_vehicle_capacity",
    "max_passengers_per_trip",
    "wheelchair_spots_available",
    "standee_capacity",
    "reservation_required",
    "walk_on_allowed",
    "advance_booking_hours",
    "service_type",
    "price_per_person",
    "child_price",
    "roundtrip_price",
    "currency_code",
    "guest_only",
    "public_access",
    "minimum_age",
    "requires_room_key",
    "schedule_status",
    "active_from_date",
    "active_to_date",
    "default_driver_id",
    "requires_specific_license",
    "license_type_required",
    "real_time_tracking_enabled",
    "tracking_available_to_guests",
    "tracking_url_template",
    "automated_notifications",
    "sms_reminders",
    "email_confirmations",
    "notification_minutes_before",
    "boarding_location",
    "boarding_instructions",
    "check_in_required",
    "check_in_minutes_before",
    "cancelled_if_weather",
    "weather_alternative_transport",
    "average_occupancy_percent",
    "total_trips_ytd",
    "total_passengers_ytd",
    "no_show_rate_percent",
    "on_time_performance_percent",
    "average_delay_minutes",
    "guest_satisfaction_rating",
    "displayed_on_website",
    "displayed_on_app",
    "available_for_booking",
    "booking_url",
    "external_booking_system",
    "safety_briefing_required",
    "safety_briefing_text",
    "insurance_required",
    "max_continuous_operation_hours",
    "capacity_alert_threshold",
    "maintenance_alert",
    "vehicle_unavailable_alert",
    "preferred_route_path",
    "avoid_tolls",
    "avoid_highways",
    "traffic_aware_routing",
    "wifi_available",
    "air_conditioning",
    "restroom_available",
    "refreshments_provided",
    "luggage_storage",
    "internal_notes",
    "driver_notes",
    "guest_facing_description",
    "terms_and_conditions",
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

register_uuid()

fake = Faker()

_ROUTE_CONFIGS = [
    {
        "route_type": "AIRPORT",
        "name": "Airport Shuttle",
        "route_name_suffix": "Airport Transfer",
        "code_prefix": "AS",
        "departure": "Hotel Main Entrance",
        "mid_stop": "Terminal Shuttle Bay",
        "destination": "International Airport Terminal 1",
        "duration_min": 35,
        "duration_max": 55,
        "distance_min": 18.0,
        "distance_max": 32.0,
        "service_type": "COMPLIMENTARY",
    },
    {
        "route_type": "LOCAL_ATTRACTION",
        "name": "City Sights Loop",
        "route_name_suffix": "City Highlights",
        "code_prefix": "CL",
        "departure": "Hotel Porte Cochere",
        "mid_stop": "Old Town Square",
        "destination": "Riverfront Promenade",
        "duration_min": 50,
        "duration_max": 80,
        "distance_min": 12.0,
        "distance_max": 20.0,
        "service_type": "PAID",
    },
    {
        "route_type": "SHOPPING",
        "name": "Outlet Shuttle",
        "route_name_suffix": "Retail Route",
        "code_prefix": "SS",
        "departure": "Hotel Bus Loop",
        "mid_stop": "Downtown Shopping Street",
        "destination": "Premium Outlet Center",
        "duration_min": 40,
        "duration_max": 70,
        "distance_min": 15.0,
        "distance_max": 28.0,
        "service_type": "COMPLIMENTARY",
    },
    {
        "route_type": "BUSINESS_DISTRICT",
        "name": "Corporate Express",
        "route_name_suffix": "Business District",
        "code_prefix": "BD",
        "departure": "Conference Center Exit",
        "mid_stop": "Tech Park Hub",
        "destination": "Financial District Plaza",
        "duration_min": 25,
        "duration_max": 45,
        "distance_min": 8.0,
        "distance_max": 16.0,
        "service_type": "PAID",
    },
    {
        "route_type": "BEACH",
        "name": "Beach Day Shuttle",
        "route_name_suffix": "Coastal Route",
        "code_prefix": "BH",
        "departure": "Resort Lobby",
        "mid_stop": "Scenic Viewpoint",
        "destination": "Coral Cove Beach Club",
        "duration_min": 30,
        "duration_max": 60,
        "distance_min": 10.0,
        "distance_max": 22.0,
        "service_type": "COMPLIMENTARY",
    },
]


def _build_route_stops(departure: str, mid_stop: str, destination: str) -> list[dict[str, object]]:
    """Generate ordered route stop definitions"""
    return [
        {
            "stop_order": 1,
            "location_name": departure,
            "address": fake.street_address(),
            "coordinates": {
                "lat": float(fake.latitude()),
                "lng": float(fake.longitude()),
            },
            "duration_minutes": 5,
        },
        {
            "stop_order": 2,
            "location_name": mid_stop,
            "address": fake.street_address(),
            "coordinates": {
                "lat": float(fake.latitude()),
                "lng": float(fake.longitude()),
            },
            "duration_minutes": random.randint(8, 18),
        },
        {
            "stop_order": 3,
            "location_name": destination,
            "address": fake.street_address(),
            "coordinates": {
                "lat": float(fake.latitude()),
                "lng": float(fake.longitude()),
            },
            "duration_minutes": 0,
        },
    ]


def insert_shuttle_schedules(conn, schedules_per_property: int = 2):
    """Insert recurring shuttle schedules for each property"""
    print("\n✓ Inserting Shuttle Schedules...")
    cur = conn.cursor()

    tenant_user_lookup = {u["id"]: u for u in data_store["users"]}
    tenant_users_cache: dict[str, list[str]] = {}

    def get_tenant_users(tenant_id: str) -> list[str]:
        if tenant_id in tenant_users_cache:
            return tenant_users_cache[tenant_id]
        cur.execute(
            "SELECT user_id FROM user_tenant_associations WHERE tenant_id = %s",
            (tenant_id,),
        )
        users = [row[0] for row in cur.fetchall()]
        if not users:
            users = list(tenant_user_lookup.keys())
        tenant_users_cache[tenant_id] = users
        return users

    property_vehicle_lookup: dict[str, list[dict[str, object]]] = {}
    for vehicle in data_store["vehicles"]:
        property_vehicle_lookup.setdefault(vehicle["property_id"], []).append(vehicle)

    columns_clause = ", ".join(SHUTTLE_COLUMNS)
    values_clause = ", ".join(["%s"] * len(SHUTTLE_COLUMNS))

    total_inserted = 0
    for property_rec in data_store["properties"]:
        tenant_id = property_rec["tenant_id"]
        property_id = property_rec["id"]
        property_code = property_rec.get("code", "PROP")
        property_name = property_rec.get("name", "Property")
        tenant_users = get_tenant_users(tenant_id)
        property_vehicles = property_vehicle_lookup.get(property_id, [])

        for index in range(schedules_per_property):
            config = random.choice(_ROUTE_CONFIGS)

            schedule_id = generate_uuid()
            schedule_code = f"{property_code[:3].upper()}-{config['code_prefix']}{index + 1:02d}"
            schedule_name = f"{config['name']} ({property_name.split()[0]})"
            route_name = f"{property_name} {config['route_name_suffix']}"

            departure_location = config["departure"]
            mid_stop = config["mid_stop"]
            destination_location = config["destination"]

            route_stops = _build_route_stops(departure_location, mid_stop, destination_location)
            estimated_duration = random.randint(config["duration_min"], config["duration_max"])
            estimated_distance = round(
                random.uniform(config["distance_min"], config["distance_max"]), 1
            )
            buffer_time = random.choice([10, 15, 20])

            schedule_type = random.choices(
                population=["FIXED_TIME", "INTERVAL", "ON_DEMAND"],
                weights=[0.55, 0.3, 0.15],
            )[0]
            departure_times = None
            interval_minutes = None
            first_departure_time = None
            last_departure_time = None
            if schedule_type == "FIXED_TIME":
                first_hour = random.choice([6, 7, 8])
                departures = []
                for offset in range(random.choice([5, 6])):
                    hour = first_hour + offset * random.choice([1, 2])
                    if hour >= 23:
                        hour = 22
                    departures.append(time(hour=hour, minute=random.choice([0, 15, 30, 45])))
                departure_times = sorted(departures)
            elif schedule_type == "INTERVAL":
                interval_minutes = random.choice([30, 45, 60])
                first_departure_time = time(hour=random.choice([5, 6, 7]), minute=0)
                last_departure_time = time(hour=random.choice([20, 21, 22]), minute=0)

            operates_matrix = {
                "operates_monday": True,
                "operates_tuesday": True,
                "operates_wednesday": True,
                "operates_thursday": True,
                "operates_friday": True,
                "operates_saturday": random.random() < 0.9,
                "operates_sunday": random.random() < 0.85,
            }

            operates_holidays = random.random() < 0.7
            operates_on_closure_days = random.random() < 0.1
            special_operating_dates = None
            excluded_dates = None

            seasonal = random.random() < 0.3
            if seasonal:
                season_start_date = date(date.today().year, 6, 1)
                season_end_date = date(date.today().year, 9, 30)
                season_name = "Summer Schedule"
            else:
                season_start_date = None
                season_end_date = None
                season_name = None

            default_vehicle_id_str = (
                random.choice(property_vehicles)["vehicle_id"] if property_vehicles else None
            )
            default_vehicle_id = (
                UUID(str(default_vehicle_id_str)) if default_vehicle_id_str else None
            )

            alternate_vehicle_ids = None
            if property_vehicles:
                alternates: list[UUID] = []
                for vehicle in property_vehicles:
                    vid = vehicle["vehicle_id"]
                    if vid == default_vehicle_id_str:
                        continue
                    try:
                        alternates.append(UUID(str(vid)))
                    except (ValueError, TypeError):
                        continue
                alternate_vehicle_ids = alternates[:2] or None

            vehicle_type_required = random.choice([None, "SHUTTLE_BUS", "VAN", "MINIBUS"])
            max_passengers_per_trip = random.randint(16, 32)
            wheelchair_spots_available = random.choice([0, 0, 1, 2])
            standee_capacity = random.choice([0, 4, 6])
            reservation_required = random.random() < 0.4
            walk_on_allowed = not reservation_required or random.random() < 0.7
            advance_booking_hours = random.choice([0, 1, 2, 4, 6]) if reservation_required else 0
            min_vehicle_capacity = random.choice([None, 12, 14, 16])

            service_type = config["service_type"]
            price_per_person = None
            child_price = None
            roundtrip_price = None
            if service_type == "PAID":
                price_per_person = round(random.uniform(12.0, 28.0), 2)
                child_price = round(price_per_person * 0.6, 2)
                roundtrip_price = round(price_per_person * 1.8, 2)

            guest_only = random.random() < 0.75
            public_access = not guest_only and random.random() < 0.4
            minimum_age = random.choice([None, 12, 16]) if public_access else None
            requires_room_key = guest_only and random.random() < 0.5

            schedule_status = "ACTIVE" if not seasonal else random.choice([
                "ACTIVE",
                "SEASONAL_INACTIVE",
            ])
            active_from_date = date.today() - timedelta(days=random.randint(15, 90))
            active_to_date = None if schedule_status == "ACTIVE" else season_start_date

            real_time_tracking_enabled = random.random() < 0.5
            tracking_available_to_guests = real_time_tracking_enabled and random.random() < 0.8
            tracking_url_template = None
            if real_time_tracking_enabled:
                tracking_url_template = (
                    f"https://shuttle.tartware.example/track/{schedule_code.lower()}/" "{{reservation_id}}"
                )

            automated_notifications = True
            sms_reminders = random.random() < 0.4
            email_confirmations = True
            notification_minutes_before = random.choice([30, 45, 60])

            boarding_location = f"{property_name} Shuttle Boarding"
            boarding_instructions = (
                "Present room key card and arrive 5 minutes prior to departure."
                if reservation_required
                else "Boarding is first-come, first-served for registered guests."
            )
            check_in_required = reservation_required and random.random() < 0.6
            check_in_minutes_before = 10 if check_in_required else None

            average_occupancy_percent = round(random.uniform(45.0, 88.0), 2)
            total_trips_ytd = random.randint(120, 680)
            total_passengers_ytd = total_trips_ytd * random.randint(8, 24)
            no_show_rate_percent = round(random.uniform(2.0, 8.5), 2)
            on_time_performance_percent = round(random.uniform(82.0, 97.5), 2)
            average_delay_minutes = round(random.uniform(0.0, 6.0), 1)
            guest_satisfaction_rating = round(random.uniform(3.6, 4.9), 2)

            displayed_on_website = True
            displayed_on_app = True
            available_for_booking = True
            booking_url = f"https://booking.tartware.example/shuttle/{schedule_code.lower()}"
            external_booking_system = random.choice([None, "ShuttlePro", "RouteMaster"])

            wifi_available = random.random() < 0.4
            air_conditioning = True
            restroom_available = random.random() < 0.1
            refreshments_provided = random.random() < 0.25
            luggage_storage = True

            created_at = datetime.utcnow() - timedelta(days=random.randint(20, 120))
            updated_at = created_at + timedelta(days=random.randint(1, 30))
            created_by = random.choice(tenant_users) if tenant_users else None
            updated_by = random.choice(tenant_users) if tenant_users else created_by
            default_driver_id = random.choice(tenant_users) if tenant_users else None
            requires_specific_license = random.random() < 0.3
            license_type_required = (
                random.choice(["Passenger Van", "Class B", "Airport Shuttle"])
                if requires_specific_license
                else None
            )

            cancelled_if_weather = random.choice([None, "Severe weather advisory", "Tropical storm warning"])
            weather_alternative_transport = (
                "Coordinate private car service for affected guests"
                if cancelled_if_weather
                else None
            )

            safety_briefing_required = random.random() < 0.15
            safety_briefing_text = (
                "Provide safety briefing before departure and confirm emergency exits"
                if safety_briefing_required
                else None
            )
            insurance_required = True
            max_continuous_operation_hours = random.randint(4, 8)
            capacity_alert_threshold = max_passengers_per_trip - random.randint(2, 6)
            maintenance_alert = random.random() < 0.08
            vehicle_unavailable_alert = random.random() < 0.05

            preferred_route_path = json.dumps(
                [
                    {
                        "lat": float(fake.latitude()),
                        "lng": float(fake.longitude()),
                        "sequence": idx + 1,
                    }
                    for idx in range(3)
                ]
            )
            avoid_tolls = random.random() < 0.2
            avoid_highways = random.random() < 0.1
            traffic_aware_routing = True

            internal_notes = random.choice(
                [
                    "Monitor passenger feedback for morning departures",
                    "Coordinate with concierge for VIP requests",
                    None,
                ]
            )
            driver_notes = random.choice(
                [
                    "Check tire pressure before first trip",
                    "Ensure shuttle cleaned after evening run",
                    None,
                ]
            )
            guest_facing_description = random.choice(
                [
                    "Complimentary shuttle service with multiple daily departures",
                    "Advance reservations recommended during peak hours",
                    "Comfortable air-conditioned shuttle with onboard Wi-Fi",
                ]
            )
            terms_and_conditions = (
                "Service subject to change without prior notice. Please arrive 5 minutes before departure."
            )

            metadata = json.dumps(
                {
                    "property_code": property_code,
                    "tags": ["shuttle", config["route_type"].lower()],
                    "schedule_type": schedule_type,
                }
            )

            route_stops_json = json.dumps(route_stops)
            departure_coordinates = json.dumps(
                {
                    "lat": float(fake.latitude()),
                    "lng": float(fake.longitude()),
                }
            )
            destination_coordinates = json.dumps(
                {
                    "lat": float(fake.latitude()),
                    "lng": float(fake.longitude()),
                }
            )

            schedule_data = {
                "schedule_id": schedule_id,
                "tenant_id": tenant_id,
                "property_id": property_id,
                "schedule_name": schedule_name,
                "schedule_code": schedule_code,
                "description": f"{config['name']} serving {property_name}",
                "route_type": config["route_type"],
                "route_name": route_name,
                "is_roundtrip": True,
                "is_loop": False,
                "route_stops": route_stops_json,
                "total_stops": len(route_stops),
                "departure_location": departure_location,
                "departure_address": f"{property_name} shuttle departure",
                "departure_coordinates": departure_coordinates,
                "destination_location": destination_location,
                "destination_address": fake.street_address(),
                "destination_coordinates": destination_coordinates,
                "estimated_duration_minutes": estimated_duration,
                "estimated_distance_km": estimated_distance,
                "buffer_time_minutes": buffer_time,
                "schedule_type": schedule_type,
                "departure_times": departure_times,
                "interval_minutes": interval_minutes,
                "first_departure_time": first_departure_time,
                "last_departure_time": last_departure_time,
                "operates_monday": operates_matrix["operates_monday"],
                "operates_tuesday": operates_matrix["operates_tuesday"],
                "operates_wednesday": operates_matrix["operates_wednesday"],
                "operates_thursday": operates_matrix["operates_thursday"],
                "operates_friday": operates_matrix["operates_friday"],
                "operates_saturday": operates_matrix["operates_saturday"],
                "operates_sunday": operates_matrix["operates_sunday"],
                "operates_holidays": operates_holidays,
                "operates_on_closure_days": operates_on_closure_days,
                "special_operating_dates": special_operating_dates,
                "excluded_dates": excluded_dates,
                "seasonal": seasonal,
                "season_start_date": season_start_date,
                "season_end_date": season_end_date,
                "season_name": season_name,
                "default_vehicle_id": default_vehicle_id,
                "alternate_vehicle_ids": alternate_vehicle_ids,
                "vehicle_type_required": vehicle_type_required,
                "min_vehicle_capacity": min_vehicle_capacity,
                "max_passengers_per_trip": max_passengers_per_trip,
                "wheelchair_spots_available": wheelchair_spots_available,
                "standee_capacity": standee_capacity,
                "reservation_required": reservation_required,
                "walk_on_allowed": walk_on_allowed,
                "advance_booking_hours": advance_booking_hours,
                "service_type": service_type,
                "price_per_person": price_per_person,
                "child_price": child_price,
                "roundtrip_price": roundtrip_price,
                "currency_code": "USD",
                "guest_only": guest_only,
                "public_access": public_access,
                "minimum_age": minimum_age,
                "requires_room_key": requires_room_key,
                "schedule_status": schedule_status,
                "active_from_date": active_from_date,
                "active_to_date": active_to_date,
                "default_driver_id": default_driver_id,
                "requires_specific_license": requires_specific_license,
                "license_type_required": license_type_required,
                "real_time_tracking_enabled": real_time_tracking_enabled,
                "tracking_available_to_guests": tracking_available_to_guests,
                "tracking_url_template": tracking_url_template,
                "automated_notifications": automated_notifications,
                "sms_reminders": sms_reminders,
                "email_confirmations": email_confirmations,
                "notification_minutes_before": notification_minutes_before,
                "boarding_location": boarding_location,
                "boarding_instructions": boarding_instructions,
                "check_in_required": check_in_required,
                "check_in_minutes_before": check_in_minutes_before,
                "cancelled_if_weather": cancelled_if_weather,
                "weather_alternative_transport": weather_alternative_transport,
                "average_occupancy_percent": average_occupancy_percent,
                "total_trips_ytd": total_trips_ytd,
                "total_passengers_ytd": total_passengers_ytd,
                "no_show_rate_percent": no_show_rate_percent,
                "on_time_performance_percent": on_time_performance_percent,
                "average_delay_minutes": average_delay_minutes,
                "guest_satisfaction_rating": guest_satisfaction_rating,
                "displayed_on_website": displayed_on_website,
                "displayed_on_app": displayed_on_app,
                "available_for_booking": available_for_booking,
                "booking_url": booking_url,
                "external_booking_system": external_booking_system,
                "safety_briefing_required": safety_briefing_required,
                "safety_briefing_text": safety_briefing_text,
                "insurance_required": insurance_required,
                "max_continuous_operation_hours": max_continuous_operation_hours,
                "capacity_alert_threshold": capacity_alert_threshold,
                "maintenance_alert": maintenance_alert,
                "vehicle_unavailable_alert": vehicle_unavailable_alert,
                "preferred_route_path": preferred_route_path,
                "avoid_tolls": avoid_tolls,
                "avoid_highways": avoid_highways,
                "traffic_aware_routing": traffic_aware_routing,
                "wifi_available": wifi_available,
                "air_conditioning": air_conditioning,
                "restroom_available": restroom_available,
                "refreshments_provided": refreshments_provided,
                "luggage_storage": luggage_storage,
                "internal_notes": internal_notes,
                "driver_notes": driver_notes,
                "guest_facing_description": guest_facing_description,
                "terms_and_conditions": terms_and_conditions,
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
                f"INSERT INTO shuttle_schedules ({columns_clause}) VALUES ({values_clause})",
                [schedule_data[column] for column in SHUTTLE_COLUMNS],
            )

            data_store["shuttle_schedules"].append(
                {
                    "schedule_id": schedule_id,
                    "tenant_id": tenant_id,
                    "property_id": property_id,
                    "route_type": config["route_type"],
                    "schedule_type": schedule_type,
                }
            )
            total_inserted += 1

    conn.commit()
    print(f"   → Inserted {total_inserted} shuttle schedules")
