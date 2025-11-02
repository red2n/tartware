"""Insert sample data for guest_room_preferences"""

import json
import random
from datetime import datetime

from faker import Faker

from data_store import data_store
from db_config import generate_uuid

fake = Faker()

_STREAMING_SERVICES = [
    "Netflix",
    "Disney+",
    "Hulu",
    "Prime Video",
    "HBO Max",
    "Apple TV+",
    "YouTube",
]

_MUSIC_GENRES = [
    "jazz",
    "classical",
    "lofi",
    "pop",
    "ambient",
    "electronic",
    "rock",
]

_TV_CHANNELS = [
    "CNN",
    "BBC",
    "ESPN",
    "Discovery",
    "National Geographic",
    "HBO",
    "CNBC",
]

_VOICE_WAKE_WORDS = ["Alexa", "Hey Google", "Hey Siri", "Cortana", "Computer"]
_LANGUAGES = ["en-US", "en-GB", "es-ES", "fr-FR", "de-DE", "it-IT"]


def insert_guest_room_preferences(conn, adoption_ratio: float = 0.4):
    """Create guest-specific smart room preferences"""
    print("\n✓ Inserting Guest Room Preferences...")
    cur = conn.cursor()

    count = 0
    for guest in data_store["guests"]:
        if random.random() > adoption_ratio:
            continue

        property_candidates = [p for p in data_store["properties"] if p["tenant_id"] == guest["tenant_id"]]
        property_id = random.choice(property_candidates)["id"] if property_candidates else None

        preference_id = generate_uuid()
        wake_up_time = fake.time_object()
        sleep_time = fake.time_object()
        open_curtain_time = fake.time_object()
        close_curtain_time = fake.time_object()

        preferred_streaming = random.sample(_STREAMING_SERVICES, k=random.randint(1, 3))
        preferred_music = random.sample(_MUSIC_GENRES, k=random.randint(1, 3))
        preferred_channels = random.sample(_TV_CHANNELS, k=random.randint(2, 4))

        device_preferences = {
            "smart_thermostat": {
                "target_temperature": round(random.uniform(20.0, 22.5), 1),
                "mode": random.choice(["auto", "eco", "cool", "heat"]),
            },
            "lighting_control": {
                "default_scene": random.choice(["warm", "daylight", "reading", "relax"]),
                "dim_level": random.randint(40, 80),
            },
            "voice_assistant": {
                "voice": random.choice(["default", "british", "australian", "indian"]),
                "preferred_service": random.choice(_STREAMING_SERVICES),
            },
        }

        cur.execute(
            """
            INSERT INTO guest_room_preferences (
                preference_id, tenant_id, property_id, guest_id,
                preferred_temperature, temperature_unit, preferred_hvac_mode,
                preferred_humidity, preferred_lighting_level, preferred_color_temperature,
                prefers_natural_light,
                wake_up_lighting_time, sleep_lighting_time,
                auto_curtains_open_time, auto_curtains_close_time,
                motion_sensor_enabled, auto_lights_off_when_vacant,
                preferred_tv_channels, preferred_streaming_services, preferred_music_genre,
                voice_assistant_enabled, voice_assistant_wake_word, voice_assistant_language,
                accessibility_mode, hearing_accessible, mobility_accessible, visual_accessible,
                do_not_disturb_default, privacy_mode_enabled, camera_disabled, microphone_disabled,
                learning_mode_enabled, last_learned_at,
                profile_name, is_default_profile,
                device_preferences, special_requests, notes,
                created_at, updated_at
            ) VALUES (
                %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                %s,
                %s, %s,
                %s, %s,
                %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s,
                %s, %s,
                %s, %s, %s,
                %s, %s
            )
            """,
            (
                preference_id,
                guest["tenant_id"],
                property_id,
                guest["id"],
                round(random.uniform(20.0, 23.0), 1),
                random.choice(["C", "F"]),
                random.choice(["cool", "heat", "auto", "eco"]),
                round(random.uniform(35.0, 55.0), 1),
                random.randint(40, 90),
                random.randint(2700, 5000),
                random.choice([True, False]),
                wake_up_time,
                sleep_time,
                open_curtain_time,
                close_curtain_time,
                True,
                random.choice([True, True, False]),
                preferred_channels,
                preferred_streaming,
                preferred_music,
                random.choice([True, False]),
                random.choice(_VOICE_WAKE_WORDS),
                random.choice(_LANGUAGES),
                random.choice([True, False]),
                random.choice([True, False]),
                random.choice([True, False]),
                random.choice([True, False]),
                random.choice([True, False]),
                random.choice([True, False]),
                random.choice([True, False]),
                random.choice([True, False]),
                True,
                fake.date_time_between(start_date="-90d", end_date="now"),
                random.choice(["Business Travel", "Relaxation", "Family Trip", "Wellness Retreat"]),
                random.choice([True, False]),
                json.dumps(device_preferences),
                random.choice([
                    "Extra pillows requested",
                    "Prefers aromatherapy diffuser",
                    "Allergic to strong scents",
                    None,
                ]),
                random.choice([
                    "Guest prefers quiet HVAC operation",
                    "Enable adaptive lighting before arrival",
                    None,
                ]),
                fake.date_time_between(start_date="-180d", end_date="now"),
                datetime.utcnow(),
            ),
        )

        data_store["guest_room_preferences"].append(
            {
                "preference_id": preference_id,
                "guest_id": guest["id"],
                "tenant_id": guest["tenant_id"],
            }
        )
        count += 1

    conn.commit()
    print(f"   → Inserted {count} guest room preference profiles")
