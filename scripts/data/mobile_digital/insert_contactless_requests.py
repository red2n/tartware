"""Insert sample data for contactless_requests table"""

import random
from datetime import datetime, timedelta

from faker import Faker

from data_store import data_store
from db_config import generate_uuid

fake = Faker()

_REQUEST_TYPES = [
    "housekeeping",
    "maintenance",
    "room_service",
    "amenity_delivery",
    "wake_up_call",
    "extra_towels",
    "extra_pillows",
    "temperature_adjustment",
    "noise_complaint",
    "concierge_service",
    "valet_parking",
    "luggage_assistance",
    "late_checkout",
    "early_checkin",
]
_REQUEST_CATEGORIES = [
    "housekeeping",
    "maintenance",
    "food_beverage",
    "guest_services",
    "concierge",
    "front_desk",
]
_CHANNELS = [
    "mobile_app",
    "web_portal",
    "qr_code",
    "sms",
    "chatbot",
    "voice_assistant",
]
_STATUSES = [
    "pending",
    "acknowledged",
    "assigned",
    "in_progress",
    "completed",
    "cancelled",
]
_URGENCY = ["low", "normal", "high", "urgent"]
_NOTIFICATION_METHODS = ["push", "sms", "in_app"]
_DELIVERY_METHODS = ["room_delivery", "guest_pickup", "in_room_service"]


def _get_tenant_users(cur, tenant_id: str, cache: dict[str, list[str]]) -> list[str]:
    if tenant_id in cache:
        return cache[tenant_id]
    cur.execute(
        "SELECT user_id FROM user_tenant_associations WHERE tenant_id = %s",
        (tenant_id,),
    )
    users = [row[0] for row in cur.fetchall()]
    if not users:
        users = [u["id"] for u in data_store["users"]]
    cache[tenant_id] = users
    return users


def insert_contactless_requests(conn, requests_per_property: int = 25):
    """Insert contactless guest service requests"""
    print("\n✓ Inserting Contactless Requests...")
    cur = conn.cursor()

    tenant_user_cache: dict[str, list[str]] = {}
    guest_lookup = {guest["id"]: guest for guest in data_store["guests"]}
    rooms_by_property = {}
    for room in data_store["rooms"]:
        rooms_by_property.setdefault(room["property_id"], []).append(room)

    count = 0
    for property_rec in data_store["properties"]:
        property_rooms = rooms_by_property.get(property_rec["id"], [])
        tenant_users = _get_tenant_users(cur, property_rec["tenant_id"], tenant_user_cache)

        # Fetch reservations for property for richer context
        cur.execute(
            """
            SELECT id, guest_id, room_number
            FROM reservations
            WHERE property_id = %s
            ORDER BY booking_date DESC
            LIMIT %s
            """,
            (property_rec["id"], requests_per_property * 2),
        )
        reservations = cur.fetchall()
        if not reservations:
            continue

        for _ in range(requests_per_property):
            reservation_id, guest_id, room_number = random.choice(reservations)
            guest = guest_lookup.get(guest_id)
            if not guest:
                continue

            request_type = random.choice(_REQUEST_TYPES)
            request_category = random.choice(_REQUEST_CATEGORIES)
            request_channel = random.choice(_CHANNELS)
            status = random.choice(_STATUSES)
            urgency = random.choice(_URGENCY)

            requested_at = datetime.utcnow() - timedelta(hours=random.randint(1, 72))
            acknowledged_at = requested_at + timedelta(minutes=random.randint(5, 45)) if status != "pending" else None
            started_at = acknowledged_at + timedelta(minutes=random.randint(5, 30)) if acknowledged_at and status in {"in_progress", "completed"} else None
            completed_at = (
                started_at + timedelta(minutes=random.randint(10, 60))
                if started_at and status == "completed"
                else None
            )

            assigned_to = random.choice(tenant_users) if tenant_users and status not in {"pending", "cancelled"} else None
            department = random.choice([
                "Housekeeping",
                "Engineering",
                "Guest Services",
                "Concierge",
                "Front Desk",
            ])

            request_id = generate_uuid()
            room_ref = None
            if property_rooms:
                room_ref = next((r for r in property_rooms if r["room_number"] == room_number), None)
                if not room_ref:
                    room_ref = random.choice(property_rooms)

            cur.execute(
                """
                INSERT INTO contactless_requests (
                    request_id, tenant_id, property_id, guest_id, reservation_id, room_id,
                    request_type, request_category, request_title, request_description,
                    urgency, request_channel,
                    qr_code_scanned, qr_code_location,
                    requested_at, preferred_service_time,
                    assigned_to, assigned_at, department,
                    status, acknowledged_at, acknowledged_by,
                    started_at, completed_at,
                    service_delivered, delivery_method,
                    delivery_photo_url, delivery_signature_url,
                    guest_notified, notification_method, notification_sent_at,
                    guest_satisfaction_rating, guest_feedback, feedback_submitted_at,
                    staff_notes, completion_notes,
                    service_charge, add_to_folio,
                    session_id, notes,
                    created_at, created_by, updated_at, updated_by
                ) VALUES (
                    %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s,
                    %s, %s,
                    %s, %s,
                    %s, %s, %s,
                    %s, %s, %s,
                    %s, %s,
                    %s, %s,
                    %s, %s,
                    %s, %s, %s,
                    %s, %s, %s,
                    %s, %s,
                    %s, %s,
                    %s, %s,
                    %s, %s, %s, %s
                )
                """,
                (
                    request_id,
                    property_rec["tenant_id"],
                    property_rec["id"],
                    guest_id,
                    reservation_id,
                    room_ref["id"] if room_ref else None,
                    request_type,
                    request_category,
                    f"{request_type.replace('_', ' ').title()} request",
                    fake.sentence(nb_words=10),
                    urgency,
                    request_channel,
                    random.random() < 0.5,
                    random.choice(["Room Door", "Lobby", "Fitness Center", None]),
                    requested_at,
                    requested_at + timedelta(hours=random.randint(1, 6)) if random.random() < 0.5 else None,
                    assigned_to,
                    acknowledged_at if assigned_to else None,
                    department,
                    status,
                    acknowledged_at,
                    assigned_to if acknowledged_at else None,
                    started_at,
                    completed_at,
                    status == "completed",
                    random.choice(_DELIVERY_METHODS) if status == "completed" else None,
                    f"https://assets.tartware.example/delivery/{generate_uuid()[:8]}.jpg" if status == "completed" and random.random() < 0.4 else None,
                    f"https://assets.tartware.example/signatures/{generate_uuid()[:8]}.png" if status == "completed" and random.random() < 0.3 else None,
                    random.random() < 0.8,
                    random.choice(_NOTIFICATION_METHODS),
                    requested_at + timedelta(minutes=random.randint(2, 15)),
                    random.randint(4, 5) if status == "completed" and random.random() < 0.6 else None,
                    random.choice([
                        "Quick response time",
                        "Appreciated the contactless delivery",
                        "Room serviced within 15 minutes",
                        None,
                    ]),
                    completed_at + timedelta(minutes=5) if completed_at and random.random() < 0.7 else None,
                    random.choice([
                        "Handled via mobile concierge",
                        "Staff notified via push alert",
                        None,
                    ]),
                    random.choice([
                        "Guest satisfied with resolution",
                        "Escalated to supervisor",
                        None,
                    ]),
                    round(random.uniform(10.0, 85.0), 2) if request_type in {"room_service", "amenity_delivery", "late_checkout"} else None,
                    random.random() < 0.3,
                    f"sess-{generate_uuid()[:8]}",
                    random.choice([
                        "Guest used QR code on in-room tablet",
                        "Automated via chatbot flow",
                        None,
                    ]),
                    requested_at - timedelta(minutes=10),
                    assigned_to,
                    datetime.utcnow(),
                    assigned_to,
                ),
            )

            data_store["contactless_requests"].append(
                {
                    "request_id": request_id,
                    "tenant_id": property_rec["tenant_id"],
                    "property_id": property_rec["id"],
                }
            )
            count += 1

    conn.commit()
    print(f"   → Inserted {count} contactless requests")
