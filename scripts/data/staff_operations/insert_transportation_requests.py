"""Insert sample data for transportation_requests table"""

from __future__ import annotations

import json
import random
from datetime import date, datetime, time, timedelta

from faker import Faker

from data_store import data_store
from db_config import generate_uuid

fake = Faker()

_REQUEST_TYPES = [
    "AIRPORT_ARRIVAL",
    "AIRPORT_DEPARTURE",
    "SHUTTLE",
    "PRIVATE_TRANSFER",
    "LOCAL_TRANSPORT",
    "TOUR",
]
_REQUEST_STATUSES = [
    "PENDING",
    "CONFIRMED",
    "ASSIGNED",
    "DISPATCHED",
    "EN_ROUTE",
    "ARRIVED",
    "IN_PROGRESS",
    "COMPLETED",
    "CANCELLED",
    "NO_SHOW",
]
_FLIGHT_STATUSES = ["ON_TIME", "DELAYED", "CANCELLED", "BOARDING"]
_PAYMENT_METHODS = ["ROOM_CHARGE", "CREDIT_CARD", "ACCOUNT", "CASH"]
_PAYMENT_STATUSES = ["PENDING", "AUTHORIZED", "POSTED", "VOID", "REFUNDED"]
_THIRD_PARTY_PROVIDERS = [None, "Uber", "Lyft", "CityTaxi", "Local Limo"]
_AIRLINES = ["Delta", "American Airlines", "Lufthansa", "Emirates", "Qatar Airways"]
_TERMINALS = ["T1", "T2", "T3", "T4"]
_TRAFFIC_CONDITIONS = ["LIGHT", "MODERATE", "HEAVY", "INCIDENT"]
_WEATHER_CONDITIONS = ["Clear", "Light Rain", "Heavy Rain", "Snow", "Windy"]


def _load_guest_lookup(cur) -> dict[str, dict[str, object]]:
    cur.execute(
        """
        SELECT id, tenant_id,
               CONCAT(first_name, ' ', last_name) AS full_name,
               COALESCE(phone, '') AS phone,
               COALESCE(email, '') AS email
        FROM guests
        """
    )
    return {
        row[0]: {
            "tenant_id": row[1],
            "name": row[2],
            "phone": row[3],
            "email": row[4],
        }
        for row in cur.fetchall()
    }


def _build_coordinates() -> str:
    return json.dumps({"lat": float(fake.latitude()), "lng": float(fake.longitude())})


def _build_recurring_schedule() -> str:
    weekdays = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
    pattern_days = random.sample(weekdays, k=random.randint(2, 4))
    return json.dumps({
        "frequency": random.choice(["DAILY", "WEEKLY", "CUSTOM"]),
        "days": pattern_days,
        "interval_minutes": random.choice([30, 45, 60, 90]),
    })


def insert_transportation_requests(conn, requests_per_property: int = 12):
    """Insert guest transportation requests for each property"""
    print("\n✓ Inserting Transportation Requests...")
    cur = conn.cursor()

    guest_lookup = _load_guest_lookup(cur)

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

    property_schedule_lookup: dict[str, list[dict[str, object]]] = {}
    for schedule in data_store["shuttle_schedules"]:
        property_schedule_lookup.setdefault(schedule["property_id"], []).append(schedule)

    folio_lookup = {folio["reservation_id"]: folio for folio in data_store.get("folios", [])}

    total_inserted = 0
    for property_rec in data_store["properties"]:
        tenant_id = property_rec["tenant_id"]
        property_id = property_rec["id"]
        property_code = property_rec.get("code", "PROP")
        property_name = property_rec.get("name", "Property")

        tenant_users = get_tenant_users(tenant_id)
        property_vehicles = property_vehicle_lookup.get(property_id, [])
        property_schedules = property_schedule_lookup.get(property_id, [])

        cur.execute(
            """
            SELECT id, guest_id, guest_name, guest_email, room_number,
                   check_in_date, check_out_date, confirmation_number, status
            FROM reservations
            WHERE property_id = %s
            ORDER BY check_in_date DESC
            LIMIT %s
            """,
            (property_id, max(requests_per_property * 3, 30)),
        )
        reservation_rows = cur.fetchall()
        if not reservation_rows:
            continue

        for index in range(requests_per_property):
            reservation_row = random.choice(reservation_rows)
            reservation_id = reservation_row[0]
            reservation_guest_id = reservation_row[1]
            reservation_guest_name = reservation_row[2]
            reservation_guest_email = reservation_row[3]
            room_number = reservation_row[4]
            check_in_date = reservation_row[5]
            check_out_date = reservation_row[6]
            confirmation_number = reservation_row[7]

            guest_id = reservation_guest_id or random.choice(list(guest_lookup.keys()))
            guest_details = guest_lookup.get(guest_id)
            guest_name = reservation_guest_name or (guest_details["name"] if guest_details else fake.name())
            guest_email = reservation_guest_email or (guest_details["email"] if guest_details else fake.email())
            guest_phone = (guest_details["phone"] if guest_details and guest_details["phone"] else fake.phone_number())

            request_type = random.choice(_REQUEST_TYPES)
            request_id = generate_uuid()
            request_number = f"TRANS-{property_code}-{total_inserted + 1:05d}"

            base_date = check_in_date or check_out_date or date.today()
            if request_type == "AIRPORT_DEPARTURE" and check_out_date:
                base_date = check_out_date
            elif request_type == "AIRPORT_ARRIVAL" and check_in_date:
                base_date = check_in_date

            pickup_time = time(hour=random.randint(5, 22), minute=random.choice([0, 15, 30, 45]))
            requested_pickup_datetime = datetime.combine(base_date, pickup_time)
            requested_pickup_time = pickup_time
            estimated_duration = random.randint(20, 75)
            estimated_arrival_datetime = requested_pickup_datetime + timedelta(minutes=estimated_duration)

            request_status = random.choices(
                population=_REQUEST_STATUSES,
                weights=[0.06, 0.12, 0.12, 0.09, 0.08, 0.08, 0.08, 0.25, 0.06, 0.06],
            )[0]

            actual_pickup_datetime = None
            actual_arrival_datetime = None
            completed_datetime = None
            if request_status in {"ARRIVED", "IN_PROGRESS", "COMPLETED"}:
                actual_pickup_datetime = requested_pickup_datetime + timedelta(minutes=random.randint(-5, 10))
                actual_arrival_datetime = actual_pickup_datetime + timedelta(minutes=estimated_duration + random.randint(-5, 10))
                completed_datetime = actual_arrival_datetime
            elif request_status == "EN_ROUTE":
                actual_pickup_datetime = requested_pickup_datetime + timedelta(minutes=random.randint(-3, 5))
            elif request_status == "DISPATCHED":
                actual_pickup_datetime = requested_pickup_datetime

            vehicle = random.choice(property_vehicles) if property_vehicles else None
            driver_id = random.choice(tenant_users) if tenant_users else None
            driver_user = tenant_user_lookup.get(driver_id) if driver_id else None

            schedule = random.choice(property_schedules) if property_schedules else None

            pickup_location = "Hotel Main Entrance"
            pickup_location_type = "HOTEL"
            dropoff_location = "City Center"
            dropoff_location_type = "ADDRESS"
            signage_name = None
            special_instructions = None
            guest_preferences = None
            is_flight_related = request_type in {"AIRPORT_ARRIVAL", "AIRPORT_DEPARTURE"}

            if request_type == "AIRPORT_ARRIVAL":
                pickup_location = f"{fake.city()} International Airport"
                pickup_location_type = "AIRPORT"
                dropoff_location = property_name
                dropoff_location_type = "HOTEL"
                signage_name = guest_name
            elif request_type == "AIRPORT_DEPARTURE":
                pickup_location = property_name
                pickup_location_type = "HOTEL"
                dropoff_location = f"{fake.city()} International Airport"
                dropoff_location_type = "AIRPORT"
                special_instructions = "Ensure luggage is loaded 15 minutes before departure."
            elif request_type == "SHUTTLE" and schedule:
                pickup_location = "Hotel Shuttle Bay"
                dropoff_location = "Local Attraction Hub"
                guest_preferences = "Seated near exit"
            elif request_type == "PRIVATE_TRANSFER":
                dropoff_location = f"{fake.company()} Headquarters"
                special_instructions = "Provide bottled water and phone charger."
            elif request_type == "TOUR":
                dropoff_location = f"{fake.city()} Heritage Tour"
                guest_preferences = "Include museum stop"

            luggage_count = random.randint(0, 5)
            oversized_luggage = luggage_count > 3 and random.random() < 0.3
            special_items = None
            if oversized_luggage:
                special_items = random.choice([
                    "Golf clubs",
                    "Ski equipment",
                    "Large instrument case",
                ])

            passenger_count = random.randint(1, 4)
            child_count = random.randint(0, 2) if passenger_count > 1 else 0
            infant_count = random.randint(0, 1) if child_count else 0
            wheelchair_required = random.random() < 0.08
            child_seat_required = child_count > 0 and random.random() < 0.5
            special_needs = None
            if wheelchair_required:
                special_needs = "Wheelchair accessible van required"

            flight_number = None
            airline = None
            airline_code = None
            terminal = None
            arrival_departure = None
            flight_datetime = None
            flight_tracking_enabled = False
            flight_status = None
            if is_flight_related:
                flight_number = fake.bothify(text="??####")
                airline = random.choice(_AIRLINES)
                airline_code = airline[:3].upper()
                terminal = random.choice(_TERMINALS)
                arrival_departure = "ARRIVAL" if request_type == "AIRPORT_ARRIVAL" else "DEPARTURE"
                flight_datetime = requested_pickup_datetime + timedelta(hours=random.choice([-3, -2, -1, 0, 1]))
                flight_tracking_enabled = random.random() < 0.7
                flight_status = random.choices(_FLIGHT_STATUSES, weights=[0.7, 0.2, 0.05, 0.05])[0]

            confirmation_sent = request_status not in {"PENDING"}
            confirmation_sent_at = (
                requested_pickup_datetime - timedelta(hours=random.randint(3, 24))
                if confirmation_sent
                else None
            )

            dispatched = request_status in {"DISPATCHED", "EN_ROUTE", "ARRIVED", "IN_PROGRESS", "COMPLETED"}
            dispatch_time = requested_pickup_datetime - timedelta(minutes=random.randint(20, 45)) if dispatched else None
            dispatched_by = random.choice(tenant_users) if dispatched and tenant_users else None
            dispatch_notes = None
            if dispatched:
                dispatch_notes = random.choice([
                    "Driver confirmed via mobile app",
                    "Vehicle inspected before dispatch",
                    "Guest notified of vehicle details",
                ])

            actual_distance_km = round(random.uniform(estimated_duration * 0.6, estimated_duration * 1.1) / 3, 2)
            actual_duration_minutes = (
                (actual_arrival_datetime - actual_pickup_datetime).seconds // 60
                if actual_arrival_datetime and actual_pickup_datetime
                else None
            )

            meet_and_greet = request_type == "AIRPORT_ARRIVAL" and random.random() < 0.6
            vip_service = request_type in {"PRIVATE_TRANSFER", "TOUR"} and random.random() < 0.5

            service_type = "COMPLIMENTARY" if request_type in {"SHUTTLE", "AIRPORT_ARRIVAL"} else "CHARGED"
            base_rate = round(random.uniform(25.0, 120.0), 2) if service_type == "CHARGED" else 0.0
            per_km_rate = round(random.uniform(1.5, 3.5), 2) if service_type == "CHARGED" else None
            per_hour_rate = round(random.uniform(35.0, 55.0), 2) if service_type == "CHARGED" else None
            surcharge_amount = 0.0
            surcharge_reason = None
            if service_type == "CHARGED" and requested_pickup_datetime.hour in {5, 6, 22}:
                surcharge_amount = round(random.uniform(8.0, 18.0), 2)
                surcharge_reason = "Off-peak surcharge"
            gratuity_amount = round(base_rate * 0.12, 2) if service_type == "CHARGED" else 0.0
            total_charge = round(base_rate + surcharge_amount + gratuity_amount, 2)

            complimentary = service_type == "COMPLIMENTARY"
            complimentary_reason = "Included for hotel guests" if complimentary else None
            charge_to_room = service_type == "CHARGED"
            folio_entry = folio_lookup.get(reservation_id)
            folio_id = folio_entry["id"] if folio_entry and charge_to_room else None
            posted_to_folio = charge_to_room and random.random() < 0.6
            posted_at = (
                completed_datetime + timedelta(hours=2) if posted_to_folio and completed_datetime else None
            )
            payment_method = random.choice(_PAYMENT_METHODS)
            payment_status = random.choice(_PAYMENT_STATUSES)

            package_included = random.random() < 0.15
            package_choice = None
            if package_included:
                property_packages = [p for p in data_store.get("packages", []) if p["property_id"] == property_id]
                package_choice = random.choice(property_packages) if property_packages else None
            discount_percent = round(random.uniform(5.0, 20.0), 2) if package_included else None
            discount_amount = round(total_charge * (discount_percent or 0) / 100, 2) if package_included else None

            third_party_service = service_type == "CHARGED" and random.random() < 0.2
            third_party_provider = random.choice(_THIRD_PARTY_PROVIDERS) if third_party_service else None
            third_party_booking_id = f"THIRD-{random.randint(10000, 99999)}" if third_party_service else None
            third_party_cost = round(total_charge * random.uniform(0.7, 0.95), 2) if third_party_service else None

            sms_sent = random.random() < 0.7
            sms_sent_at = confirmation_sent_at if sms_sent else None
            email_sent = confirmation_sent
            email_sent_at = confirmation_sent_at if confirmation_sent else None
            reminder_sent = random.random() < 0.4
            reminder_sent_at = requested_pickup_datetime - timedelta(minutes=30) if reminder_sent else None
            guest_notified_arrival = request_status in {"ARRIVED", "IN_PROGRESS", "COMPLETED"}

            real_time_tracking_enabled = random.random() < 0.5
            tracking_url = (
                f"https://transport.tartware.example/track/{request_number}" if real_time_tracking_enabled else None
            )
            current_location = (
                json.dumps({"lat": float(fake.latitude()), "lng": float(fake.longitude())})
                if real_time_tracking_enabled and request_status not in {"COMPLETED", "CANCELLED"}
                else None
            )
            last_location_update = (
                datetime.utcnow() - timedelta(minutes=random.randint(5, 20))
                if current_location
                else None
            )

            guest_rating = None
            guest_feedback = None
            feedback_date = None
            driver_rating = None
            service_quality_score = None
            if request_status == "COMPLETED":
                guest_rating = random.randint(4, 5)
                guest_feedback = random.choice([
                    "Driver was prompt and courteous",
                    "Smooth ride, will book again",
                    "Appreciated the luggage assistance",
                    None,
                ])
                feedback_date = completed_datetime + timedelta(hours=6) if completed_datetime else None
                driver_rating = random.randint(4, 5)
                service_quality_score = random.randint(85, 100)

            issues_reported = request_status in {"CANCELLED", "NO_SHOW"} and random.random() < 0.7
            issue_description = None
            compensation_provided = False
            compensation_amount = None
            if issues_reported:
                issue_description = random.choice([
                    "Guest reported flight cancellation",
                    "Vehicle delay due to traffic incident",
                    "Guest failed to appear at pickup location",
                ])
                if request_status == "NO_SHOW":
                    compensation_provided = False
                else:
                    compensation_provided = random.random() < 0.4
                    compensation_amount = round(random.uniform(10.0, 50.0), 2) if compensation_provided else None

            cancelled_by = None
            cancellation_datetime = None
            cancellation_reason = None
            cancellation_fee = None
            cancellation_policy_applied = None
            if request_status == "CANCELLED":
                cancelled_by = random.choice(["GUEST", "HOTEL", "SYSTEM", "WEATHER"])
                cancellation_datetime = requested_pickup_datetime - timedelta(hours=random.randint(1, 12))
                cancellation_reason = random.choice([
                    "Flight delay",
                    "Guest requested cancellation",
                    "Vehicle unavailable",
                    "Severe weather conditions",
                ])
                if cancelled_by == "GUEST" and charge_to_room:
                    cancellation_fee = round(total_charge * 0.5, 2)
                    cancellation_policy_applied = "50% late cancellation fee"

            no_show_recorded = request_status == "NO_SHOW"
            no_show_fee = round(total_charge * 0.75, 2) if no_show_recorded and charge_to_room else None
            no_show_follow_up = "Guest informed about fee" if no_show_recorded else None

            weather_conditions = random.choice(_WEATHER_CONDITIONS)
            traffic_conditions = random.choice(_TRAFFIC_CONDITIONS)
            route_notes = random.choice([
                "Route adjusted due to construction",
                "Express lane utilized",
                "Standard hotel to airport route",
            ])

            carbon_offset_offered = random.random() < 0.4
            carbon_offset_accepted = carbon_offset_offered and random.random() < 0.5
            carbon_offset_amount = round(actual_distance_km * 0.3, 2) if carbon_offset_accepted else None

            recurring = random.random() < 0.12
            parent_request_id = None
            if recurring and data_store["transportation_requests"]:
                parent_request_id = random.choice(data_store["transportation_requests"])["request_id"]
            recurring_schedule = _build_recurring_schedule() if recurring else None

            pos_transaction_id = f"POS-{random.randint(100000, 999999)}" if charge_to_room else None
            accounting_code = f"TRANS-{property_code}"
            gl_account = "4300-TRANS"
            external_system_id = generate_uuid()[:10]

            internal_notes = random.choice([
                "Guest prefers quiet driver",
                "Confirm child seat availability",
                "VIP guest from corporate account",
                None,
            ])
            driver_notes = random.choice([
                "Bring luggage cart",
                "Pre-cool vehicle cabin",
                "Assist with mobility scooter",
                None,
            ])
            guest_visible_notes = random.choice([
                "Meet driver at concierge desk",
                "Text driver upon landing",
                None,
            ])

            metadata = json.dumps(
                {
                    "schedule_id": schedule["schedule_id"] if schedule else None,
                    "vehicle_id": vehicle["vehicle_id"] if vehicle else None,
                    "confirmation_number": confirmation_number,
                    "source": random.choice(["mobile_app", "front_desk", "concierge_portal"]),
                }
            )

            request_date = requested_pickup_datetime - timedelta(hours=random.randint(6, 48))
            created_at = request_date - timedelta(hours=random.randint(1, 12))
            updated_at = datetime.utcnow()
            created_by = random.choice(tenant_users) if tenant_users else None
            updated_by = random.choice(tenant_users) if tenant_users else created_by

            cur.execute(
                """
                INSERT INTO transportation_requests (
                    request_id, tenant_id, property_id,
                    request_number, request_date, request_type,
                    reservation_id, guest_id, guest_name, guest_phone, guest_email, room_number,
                    passenger_count, child_count, infant_count, wheelchair_required, child_seat_required, special_needs,
                    luggage_count, oversized_luggage, special_items,
                    pickup_location, pickup_location_type, pickup_address, pickup_coordinates,
                    dropoff_location, dropoff_location_type, dropoff_address, dropoff_coordinates,
                    requested_pickup_datetime, requested_pickup_time, actual_pickup_datetime, estimated_arrival_datetime, actual_arrival_datetime,
                    is_flight_related, flight_number, airline, airline_code, terminal, arrival_departure, flight_datetime, flight_tracking_enabled, flight_status,
                    vehicle_id, vehicle_number, vehicle_type, driver_id, driver_name, driver_phone,
                    request_status, confirmation_sent, confirmation_sent_at,
                    dispatched, dispatch_time, dispatched_by, dispatch_notes,
                    completed_datetime, completed_by, actual_distance_km, actual_duration_minutes,
                    meet_and_greet, signage_name, vip_service, special_instructions, guest_preferences,
                    service_type, base_rate, per_km_rate, per_hour_rate, surcharge_amount, surcharge_reason, gratuity_amount, total_charge, currency_code,
                    complimentary, complimentary_reason, charge_to_room, folio_id, posted_to_folio, posted_at, payment_method, payment_status,
                    package_included, package_id, promotional_code, discount_percent, discount_amount,
                    third_party_service, third_party_provider, third_party_booking_id, third_party_cost,
                    sms_sent, sms_sent_at, email_sent, email_sent_at, reminder_sent, reminder_sent_at, guest_notified_arrival,
                    real_time_tracking_enabled, tracking_url, current_location, last_location_update,
                    guest_rating, guest_feedback, feedback_date, driver_rating, service_quality_score,
                    issues_reported, issue_description, incident_report_id, compensation_provided, compensation_amount,
                    cancelled_by, cancellation_datetime, cancellation_reason, cancellation_fee, cancellation_policy_applied,
                    no_show_recorded, no_show_fee, no_show_follow_up,
                    weather_conditions, traffic_conditions, route_notes,
                    carbon_offset_offered, carbon_offset_accepted, carbon_offset_amount,
                    recurring, recurring_schedule, parent_request_id,
                    pos_transaction_id, accounting_code, gl_account, external_system_id,
                    internal_notes, driver_notes, guest_visible_notes,
                    metadata, created_at, updated_at, created_by, updated_by
                ) VALUES (
                    %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s, %s
                )
                """,
                (
                    request_id,
                    tenant_id,
                    property_id,
                    request_number,
                    request_date,
                    request_type,
                    reservation_id,
                    guest_id,
                    guest_name,
                    guest_phone,
                    guest_email,
                    room_number,
                    passenger_count,
                    child_count,
                    infant_count,
                    wheelchair_required,
                    child_seat_required,
                    special_needs,
                    luggage_count,
                    oversized_luggage,
                    special_items,
                    pickup_location,
                    pickup_location_type,
                    fake.street_address(),
                    _build_coordinates(),
                    dropoff_location,
                    dropoff_location_type,
                    fake.street_address(),
                    _build_coordinates(),
                    requested_pickup_datetime,
                    requested_pickup_time,
                    actual_pickup_datetime,
                    estimated_arrival_datetime,
                    actual_arrival_datetime,
                    is_flight_related,
                    flight_number,
                    airline,
                    airline_code,
                    terminal,
                    arrival_departure,
                    flight_datetime,
                    flight_tracking_enabled,
                    flight_status,
                    vehicle["vehicle_id"] if vehicle else None,
                    vehicle["vehicle_number"] if vehicle else None,
                    vehicle["vehicle_type"] if vehicle else None,
                    driver_id,
                    driver_user["name"] if driver_user else None,
                    fake.phone_number() if driver_user else None,
                    request_status,
                    confirmation_sent,
                    confirmation_sent_at,
                    dispatched,
                    dispatch_time,
                    dispatched_by,
                    dispatch_notes,
                    completed_datetime,
                    driver_id if completed_datetime else None,
                    actual_distance_km,
                    actual_duration_minutes,
                    meet_and_greet,
                    signage_name,
                    vip_service,
                    special_instructions,
                    guest_preferences,
                    service_type,
                    base_rate,
                    per_km_rate,
                    per_hour_rate,
                    surcharge_amount,
                    surcharge_reason,
                    gratuity_amount,
                    total_charge,
                    "USD",
                    complimentary,
                    complimentary_reason,
                    charge_to_room,
                    folio_id,
                    posted_to_folio,
                    posted_at,
                    payment_method,
                    payment_status,
                    package_included,
                    package_choice["id"] if package_choice else None,
                    package_choice["package_code"] if package_choice else None,
                    discount_percent,
                    discount_amount,
                    third_party_service,
                    third_party_provider,
                    third_party_booking_id,
                    third_party_cost,
                    sms_sent,
                    sms_sent_at,
                    email_sent,
                    email_sent_at,
                    reminder_sent,
                    reminder_sent_at,
                    guest_notified_arrival,
                    real_time_tracking_enabled,
                    tracking_url,
                    current_location,
                    last_location_update,
                    guest_rating,
                    guest_feedback,
                    feedback_date,
                    driver_rating,
                    service_quality_score,
                    issues_reported,
                    issue_description,
                    None,
                    compensation_provided,
                    compensation_amount,
                    cancelled_by,
                    cancellation_datetime,
                    cancellation_reason,
                    cancellation_fee,
                    cancellation_policy_applied,
                    no_show_recorded,
                    no_show_fee,
                    no_show_follow_up,
                    weather_conditions,
                    traffic_conditions,
                    route_notes,
                    carbon_offset_offered,
                    carbon_offset_accepted,
                    carbon_offset_amount,
                    recurring,
                    recurring_schedule,
                    parent_request_id,
                    pos_transaction_id,
                    accounting_code,
                    gl_account,
                    external_system_id,
                    internal_notes,
                    driver_notes,
                    guest_visible_notes,
                    metadata,
                    created_at,
                    updated_at,
                    created_by,
                    updated_by,
                ),
            )

            data_store["transportation_requests"].append(
                {
                    "request_id": request_id,
                    "tenant_id": tenant_id,
                    "property_id": property_id,
                    "request_type": request_type,
                    "status": request_status,
                }
            )
            total_inserted += 1

    conn.commit()
    print(f"   → Inserted {total_inserted} transportation requests")
