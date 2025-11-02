"""Insert sample data for digital_registration_cards table"""

import random
from datetime import datetime, timedelta

from faker import Faker

from data_store import data_store
from db_config import generate_uuid

fake = Faker()

_SIGNATURE_METHODS = ["touchscreen", "stylus", "electronic_consent"]
_VISIT_PURPOSE = ["leisure", "business", "conference", "wedding", "family_event", "other"]


def insert_digital_registration_cards(conn, adoption_ratio: float = 0.7):
    """Insert digital registration card records"""
    print("\n✓ Inserting Digital Registration Cards...")
    cur = conn.cursor()

    # Build quick lookup helpers
    property_lookup = {prop["id"]: prop for prop in data_store["properties"]}
    guest_ids = [guest["id"] for guest in data_store["guests"]]

    # Fetch guest contact info directly from DB for accuracy
    cur.execute(
        "SELECT id, first_name, last_name, email, phone, nationality FROM guests"
    )
    guest_info = {
        row[0]: {
            "first_name": row[1],
            "last_name": row[2],
            "email": row[3],
            "phone": row[4],
            "nationality": row[5],
        }
        for row in cur.fetchall()
    }

    # Map reservation to mobile check-in if available
    mobile_by_reservation: dict[str, str] = {}
    for record in data_store["mobile_check_ins"]:
        mobile_by_reservation.setdefault(record["reservation_id"], record["mobile_checkin_id"])

    cur.execute(
        """
        SELECT id, tenant_id, property_id, guest_id, check_in_date, check_out_date,
               number_of_adults, number_of_children, room_number, rate_id
        FROM reservations
        ORDER BY check_in_date DESC NULLS LAST
        """
    )
    reservations = cur.fetchall()

    count = 0
    for (
        reservation_id,
        tenant_id,
        property_id,
        guest_id,
        check_in_date,
        check_out_date,
        number_of_adults,
        number_of_children,
        room_number,
        rate_id,
    ) in reservations:
        if guest_id not in guest_ids:
            continue
        if random.random() > adoption_ratio:
            continue

        guest_record = guest_info.get(guest_id)
        if not guest_record:
            continue

        property_record = property_lookup.get(property_id)
        if not property_record:
            continue

        arrival_date = check_in_date or fake.date_between(start_date="-10d", end_date="-1d")
        departure_date = check_out_date or (arrival_date + timedelta(days=random.randint(1, 5)))
        number_of_nights = max((departure_date - arrival_date).days, 1)

        registration_date = arrival_date - timedelta(days=random.randint(0, 2))
        registration_time = fake.time_object()

        registration_id = generate_uuid()
        registration_number = f"REG-{registration_date.year}-{random.randint(10000, 99999)}"
        companion_count = random.randint(0, 2)
        companion_names = [fake.name() for _ in range(companion_count)] if companion_count else []

        vehicle_details = random.choice([
            None,
            {
                "make": random.choice(["Tesla", "BMW", "Mercedes", "Audi", "Toyota"]),
                "model": random.choice(["Model Y", "X5", "E-Class", "A6", "Camry"]),
                "color": random.choice(["Black", "White", "Silver", "Blue"]),
                "plate": fake.bothify(text="??-####"),
                "parking": random.choice(["P1-12", "Garage B", "Level 3"]),
            },
        ])

        cur.execute(
            """
            INSERT INTO digital_registration_cards (
                registration_id, tenant_id, property_id, reservation_id, guest_id, mobile_checkin_id,
                registration_number, registration_date, registration_time,
                guest_full_name, guest_email, guest_phone, guest_date_of_birth, guest_nationality,
                id_type, id_number, id_issuing_country, id_issue_date, id_expiry_date,
                id_front_image_url, id_back_image_url,
                home_address, home_city, home_state, home_country, home_postal_code,
                arrival_date, departure_date, number_of_nights, number_of_adults, number_of_children,
                room_number, room_type, rate_code,
                companion_names, companion_count,
                vehicle_make, vehicle_model, vehicle_color, vehicle_license_plate, parking_space_assigned,
                visit_purpose, company_name,
                guest_signature_url, signature_captured_at, signature_method,
                terms_and_conditions_url, privacy_policy_url,
                terms_accepted, privacy_accepted, marketing_consent,
                emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
                pdf_url, pdf_generated_at,
                verified, verified_by, verified_at,
                regulatory_compliance_status, government_reporting_submitted, government_reporting_date,
                special_notes, staff_notes,
                created_at, created_by, updated_at, updated_by
            ) VALUES (
                %s, %s, %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s,
                %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s,
                %s, %s, %s,
                %s, %s,
                %s, %s, %s,
                %s, %s,
                %s, %s, %s,
                %s, %s,
                %s, %s,
                %s, %s, %s, %s
            )
            """,
            (
                registration_id,
                tenant_id,
                property_id,
                reservation_id,
                guest_id,
                mobile_by_reservation.get(reservation_id),
                registration_number,
                registration_date,
                registration_time,
                f"{guest_record['first_name']} {guest_record['last_name']}",
                guest_record["email"],
                guest_record["phone"],
                fake.date_between(start_date="-60y", end_date="-25y"),
                guest_record.get("nationality") or fake.country(),
                random.choice(["passport", "drivers_license", "national_id"]),
                fake.bothify(text="##########"),
                guest_record.get("nationality") or fake.country(),
                fake.date_between(start_date="-10y", end_date="-1y"),
                fake.date_between(start_date="+1y", end_date="+8y"),
                f"https://assets.tartware.example/id/{generate_uuid()[:10]}.png",
                f"https://assets.tartware.example/id/{generate_uuid()[:10]}_b.png",
                fake.street_address(),
                fake.city(),
                fake.state_abbr(),
                fake.country(),
                fake.postcode(),
                arrival_date,
                departure_date,
                number_of_nights,
                number_of_adults or random.randint(1, 2),
                number_of_children or random.randint(0, 1),
                room_number,
                random.choice(["Deluxe", "Superior", "Studio", "Suite"]),
                rate_id or f"R-{random.randint(100, 999)}",
                companion_names,
                companion_count,
                vehicle_details["make"] if vehicle_details else None,
                vehicle_details["model"] if vehicle_details else None,
                vehicle_details["color"] if vehicle_details else None,
                vehicle_details["plate"] if vehicle_details else None,
                vehicle_details["parking"] if vehicle_details else None,
                random.choice(_VISIT_PURPOSE),
                property_record.get("name"),
                f"https://assets.tartware.example/signatures/{generate_uuid()[:10]}.png",
                datetime.combine(registration_date, registration_time) + timedelta(minutes=random.randint(1, 30)),
                random.choice(_SIGNATURE_METHODS),
                "https://tartware.example/legal/terms",
                "https://tartware.example/legal/privacy",
                True,
                True,
                random.random() < 0.35,
                fake.name(),
                fake.phone_number()[:20],
                random.choice(["Friend", "Partner", "Parent", "Sibling"]),
                f"https://assets.tartware.example/registration/{generate_uuid()[:10]}.pdf",
                datetime.combine(registration_date, registration_time) + timedelta(minutes=5),
                random.random() < 0.9,
                random.choice([None] + [u["id"] for u in data_store["users"]]),
                datetime.combine(registration_date, registration_time) + timedelta(minutes=random.randint(10, 60)),
                random.choice(["compliant", "pending"]),
                random.random() < 0.4,
                arrival_date if random.random() < 0.3 else None,
                random.choice([
                    "Guest prefers eco-friendly amenities",
                    "All documents verified electronically",
                    None,
                ]),
                random.choice([
                    "Staff confirmed ID match",
                    "Verified via biometric kiosk",
                    None,
                ]),
                datetime.combine(registration_date, registration_time) - timedelta(minutes=10),
                random.choice([None] + [u["id"] for u in data_store["users"]]),
                datetime.utcnow(),
                random.choice([None] + [u["id"] for u in data_store["users"]]),
            ),
        )

        data_store["digital_registration_cards"].append(
            {
                "registration_id": registration_id,
                "reservation_id": reservation_id,
                "tenant_id": tenant_id,
                "property_id": property_id,
            }
        )
        count += 1

    conn.commit()
    print(f"   → Inserted {count} digital registration cards")
