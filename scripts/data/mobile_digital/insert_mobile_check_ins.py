"""Insert sample data for mobile_check_ins table"""

import json
import random
from datetime import datetime, timedelta, time

from faker import Faker

from data_store import data_store
from db_config import generate_uuid

fake = Faker()

_CHECKIN_STATUSES = [
    "not_started",
    "in_progress",
    "identity_verification",
    "payment_verification",
    "room_assignment",
    "key_generated",
    "completed",
    "failed",
    "cancelled",
]
_ACCESS_METHODS = ["mobile_app", "web_browser", "qr_code", "sms_link", "email_link"]
_DEVICE_TYPES = ["iOS", "Android", "Web"]
_DEVICE_MODELS = [
    "iPhone 14",
    "iPhone 13",
    "Samsung Galaxy S23",
    "Pixel 8",
    "iPad Pro",
    "Surface Duo",
]
_OS_LIST = [
    "iOS 17",
    "Android 14",
    "Android 13",
    "iPadOS 17",
    "ChromeOS",
]
_ID_METHODS = [
    "government_id",
    "passport",
    "drivers_license",
    "face_recognition",
    "existing_profile",
]
_CHECKIN_LOCATIONS = ["off_property", "lobby", "parking_lot", "in_room"]
_ROOM_VIEWS = ["city", "garden", "pool", "ocean", "mountain"]
_BED_TYPES = ["king", "queen", "double", "twin"]
_KEY_TYPES = ["mobile_app_key", "nfc", "bluetooth", "qr_code", "pin_code"]
_KEY_DELIVERY = ["app_download", "sms", "email", "push_notification"]
_LANGUAGES = ["en", "es", "fr", "de", "it", "pt"]
_UPSELL_OFFERS = [
    {"id": "SPA-PKG", "name": "Spa Package", "price": 80.0},
    {"id": "LATE-CHECKOUT", "name": "Late Checkout", "price": 45.0},
    {"id": "ROOM-UPGRADE", "name": "Room Upgrade", "price": 120.0},
    {"id": "DINING", "name": "Dinner for Two", "price": 95.0},
]
_ERROR_MESSAGES = [
    "Identity verification timeout",
    "Payment authorization declined",
    "Guest abandoned session",
    "Network interruption detected",
]
_UTM_SOURCES = ["email", "sms", "app", "web", "search"]
_UTM_MEDIUM = ["campaign", "automation", "retargeting"]


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


def insert_mobile_check_ins(conn, sample_size: int = 180):
    """Insert mobile check-in workflow records"""
    print("\n✓ Inserting Mobile Check-Ins...")
    cur = conn.cursor()

    tenant_user_cache: dict[str, list[str]] = {}
    room_lookup = {
        (room["property_id"], room["room_number"]): room
        for room in data_store["rooms"]
    }
    guest_lookup = {guest["id"]: guest for guest in data_store["guests"]}

    cur.execute(
        """
        SELECT id, tenant_id, property_id, guest_id, room_number,
               check_in_date, check_out_date
        FROM reservations
        ORDER BY booking_date DESC
        LIMIT %s
        """,
        (sample_size,),
    )
    reservations = cur.fetchall()

    count = 0
    for (
        reservation_id,
        tenant_id,
        property_id,
        guest_id,
        room_number,
        check_in_date,
        check_out_date,
    ) in reservations:
        status = random.choice(_CHECKIN_STATUSES)
        access_method = random.choice(_ACCESS_METHODS)
        device_type = random.choice(_DEVICE_TYPES)
        device_model = random.choice(_DEVICE_MODELS)
        operating_system = random.choice(_OS_LIST)
        checkin_location = random.choice(_CHECKIN_LOCATIONS)
        id_method = random.choice(_ID_METHODS)
        key_type = random.choice(_KEY_TYPES)
        key_delivery = random.choice(_KEY_DELIVERY)
        preferred_view = random.choice(_ROOM_VIEWS)
        preferred_bed = random.choice(_BED_TYPES)
        preferred_language = random.choice(_LANGUAGES)
        accessibility_requirements = None
        if random.random() < 0.1:
            accessibility_requirements = random.sample(
                ["wheelchair", "hearing_assistance", "low_mobility"],
                k=1,
            )

        start_date = check_in_date or fake.date_between(start_date="-15d", end_date="-1d")
        start_time = datetime.combine(start_date, fake.time_object()) - timedelta(hours=random.randint(1, 6))
        completed = None
        if status in {"completed", "key_generated", "room_assignment"}:
            completed = start_time + timedelta(minutes=random.randint(8, 25))
        elif status in {"failed", "cancelled"}:
            completed = None

        id_verified = status in {"completed", "key_generated", "payment_verification", "room_assignment"}
        id_verified_at = completed or (start_time + timedelta(minutes=random.randint(3, 10)))
        tenant_users = _get_tenant_users(cur, tenant_id, tenant_user_cache)
        staff_user = random.choice(tenant_users) if tenant_users else None
        staff_assist = staff_user if random.random() < 0.25 else None

        room_ref = room_lookup.get((property_id, room_number))
        room_id = room_ref["id"] if room_ref else None

        upsell_offers = random.sample(_UPSELL_OFFERS, k=random.randint(0, 2))
        accepted = [offer for offer in upsell_offers if random.random() < 0.4]
        total_upsell = round(sum(offer["price"] for offer in accepted), 2) if accepted else 0.0

        special_request = random.choice([
            "High-floor room requested",
            "Quiet location if possible",
            "Provide hypoallergenic pillows",
            None,
        ])
        dietary_needs = random.choice([
            "Vegetarian",
            "Gluten-free",
            "Vegan",
            None,
        ])

        requires_assistance = status in {"failed", "identity_verification"} and random.random() < 0.5
        error_message = None
        last_error_at = None
        error_count = 0
        if status == "failed":
            error_message = random.choice(_ERROR_MESSAGES)
            error_count = random.randint(1, 3)
            last_error_at = start_time + timedelta(minutes=random.randint(2, 15))

        checkin_rating = random.randint(4, 5) if status == "completed" else None
        nps_score = random.randint(7, 10) if status == "completed" and random.random() < 0.7 else None
        checkin_feedback = None
        if checkin_rating and random.random() < 0.4:
            checkin_feedback = random.choice([
                "Smooth mobile experience",
                "Quick and easy check-in",
                "Loved the digital key convenience",
            ])

        session_id = f"sess-{generate_uuid()[:8]}"
        utm_source = random.choice(_UTM_SOURCES)
        utm_medium = random.choice(_UTM_MEDIUM)
        utm_campaign = random.choice([
            "summer_launch",
            "mobile_push",
            "loyalty_drive",
            "ota_shift",
        ])

        geolocation = json.dumps(
            {
                "latitude": float(fake.latitude()),
                "longitude": float(fake.longitude()),
            }
        )
        upsells_presented = json.dumps(upsell_offers)
        upsells_accepted = json.dumps(accepted)

        mobile_checkin_id = generate_uuid()
        cur.execute(
            """
            INSERT INTO mobile_check_ins (
                mobile_checkin_id, tenant_id, property_id, reservation_id, guest_id,
                checkin_status, checkin_started_at, checkin_completed_at,
                access_method, device_type, device_model, app_version,
                operating_system, checkin_location, ip_address, geolocation,
                identity_verification_method, id_document_type, id_document_uploaded,
                id_document_verified, id_verified_at, id_verified_by, face_match_score,
                liveness_check_passed, registration_card_signed, signature_captured,
                signature_url, registration_card_url, terms_accepted, terms_accepted_at,
                payment_method_verified, payment_authorization_code, deposit_collected,
                deposit_amount, room_preference_submitted, preferred_floor,
                preferred_view, preferred_bed_type, accessibility_requirements,
                room_id, room_assigned, room_assigned_at, room_assignment_method,
                upgrade_offered, upgrade_accepted, upgrade_amount,
                digital_key_type, digital_key_generated, digital_key_id, digital_key_expires_at,
                key_delivery_method, early_checkin_requested, early_checkin_approved,
                requested_checkin_time, special_requests, dietary_restrictions,
                upsells_presented, upsells_accepted, total_upsell_revenue,
                sms_notifications_enabled, email_notifications_enabled, push_notifications_enabled,
                preferred_language, arrival_instructions_viewed, property_map_viewed, amenities_guide_viewed,
                chatbot_interaction_count, help_requested, checkin_rating, checkin_feedback, nps_score,
                requires_staff_assistance, staff_notified, staff_assisted_by, staff_notes,
                error_count, last_error_message, last_error_at,
                checkin_confirmation_sent, confirmation_sent_at,
                welcome_message_sent, welcome_message_viewed,
                session_id, utm_source, utm_medium, utm_campaign, referrer,
                notes, created_at, created_by, updated_at, updated_by
            ) VALUES (
                %s, %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                %s, %s,
                %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s
            )
            """,
            (
                mobile_checkin_id,
                tenant_id,
                property_id,
                reservation_id,
                guest_id,
                status,
                start_time,
                completed,
                access_method,
                device_type,
                device_model,
                f"{random.randint(3, 6)}.{random.randint(0, 9)}.{random.randint(0, 9)}",
                operating_system,
                checkin_location,
                fake.ipv4_public(),
                geolocation,
                id_method,
                random.choice(["passport", "drivers_license", "id_card"]),
                random.random() < 0.85,
                id_verified,
                id_verified_at if id_verified else None,
                staff_user if id_verified else None,
                round(random.uniform(85.0, 98.5), 2) if id_method == "face_recognition" else None,
                random.random() < 0.9,
                random.random() < 0.7,
                random.random() < 0.7,
                f"https://assets.tartware.example/signatures/{generate_uuid()[:10]}.png" if random.random() < 0.6 else None,
                f"https://assets.tartware.example/registration/{generate_uuid()[:10]}.pdf" if random.random() < 0.5 else None,
                random.random() < 0.9,
                completed if random.random() < 0.9 else None,
                random.random() < 0.85,
                f"AUTH-{random.randint(100000, 999999)}" if random.random() < 0.6 else None,
                random.random() < 0.5,
                round(random.uniform(50.0, 200.0), 2) if random.random() < 0.4 else None,
                random.random() < 0.5,
                random.randint(2, 12),
                preferred_view,
                preferred_bed,
                accessibility_requirements,
                room_id,
                completed is not None,
                completed if completed and random.random() < 0.6 else None,
                random.choice(["guest_selected", "auto_assigned", "staff_assigned", "ai_optimized"]),
                random.random() < 0.2,
                random.random() < 0.1,
                round(random.uniform(40.0, 180.0), 2) if random.random() < 0.1 else None,
                key_type,
                random.random() < 0.85,
                f"DK-{generate_uuid()[:12]}" if random.random() < 0.8 else None,
                datetime.combine(check_out_date, time(hour=11)) if check_out_date else None,
                key_delivery,
                random.random() < 0.2,
                random.random() < 0.15,
                fake.time_object(),
                special_request,
                dietary_needs,
                upsells_presented,
                upsells_accepted,
                total_upsell,
                random.random() < 0.9,
                random.random() < 0.85,
                random.random() < 0.8,
                preferred_language,
                random.random() < 0.7,
                random.random() < 0.6,
                random.random() < 0.5,
                random.randint(0, 3),
                random.random() < 0.2,
                checkin_rating,
                checkin_feedback,
                nps_score,
                requires_assistance,
                requires_assistance,
                staff_assist,
                "Staff assisted with manual ID verification" if requires_assistance and staff_assist else None,
                error_count,
                error_message,
                last_error_at,
                status in {"completed", "key_generated"},
                completed if status in {"completed", "key_generated"} else None,
                random.random() < 0.8,
                random.random() < 0.7,
                session_id,
                utm_source,
                utm_medium,
                utm_campaign,
                fake.uri(),
                random.choice([
                    "Guest opted for early check-in via mobile",
                    "Digital key sent via push notification",
                    "Contactless check-in completed successfully",
                    None,
                ]),
                start_time - timedelta(days=random.randint(1, 7)),
                staff_user,
                datetime.utcnow(),
                staff_user,
            ),
        )

        data_store["mobile_check_ins"].append(
            {
                "mobile_checkin_id": mobile_checkin_id,
                "reservation_id": reservation_id,
                "tenant_id": tenant_id,
                "property_id": property_id,
                "guest_id": guest_id,
            }
        )
        count += 1

    conn.commit()
    print(f"   → Inserted {count} mobile check-ins")
