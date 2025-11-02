"""Insert sample data for smart_room_devices"""

import json
import random
from datetime import datetime, timedelta

from faker import Faker

from data_store import data_store
from db_config import generate_uuid

fake = Faker()

_DEVICE_CATEGORY_MAP = {
    "smart_thermostat": "climate_control",
    "smart_lock": "access_control",
    "lighting_control": "lighting",
    "curtain_control": "convenience",
    "tv": "entertainment",
    "voice_assistant": "convenience",
    "occupancy_sensor": "security",
    "motion_sensor": "security",
    "door_sensor": "security",
    "window_sensor": "security",
    "smoke_detector": "security",
    "co_detector": "security",
    "leak_detector": "security",
    "air_quality_monitor": "environmental",
    "smart_mirror": "entertainment",
    "smart_shower": "convenience",
    "mini_bar_sensor": "energy_management",
    "safe": "security",
    "energy_monitor": "energy_management",
    "hub": "energy_management",
    "other": "convenience",
}

_DEVICE_NAMES = {
    "smart_thermostat": "Smart Thermostat",
    "smart_lock": "Keyless Door Lock",
    "lighting_control": "Lighting Controller",
    "curtain_control": "Automated Curtains",
    "tv": "4K Smart TV",
    "voice_assistant": "Voice Assistant Speaker",
    "occupancy_sensor": "Occupancy Sensor",
    "motion_sensor": "Motion Detector",
    "door_sensor": "Door Sensor",
    "window_sensor": "Window Sensor",
    "smoke_detector": "Smoke Detector",
    "co_detector": "CO Detector",
    "leak_detector": "Water Leak Sensor",
    "air_quality_monitor": "Air Quality Monitor",
    "smart_mirror": "Smart Mirror",
    "smart_shower": "Smart Shower Controller",
    "mini_bar_sensor": "Mini Bar Sensor",
    "safe": "Digital Safe Controller",
    "energy_monitor": "Energy Monitor",
    "hub": "Device Hub",
    "other": "Smart Device",
}

_NETWORK_TYPES = [
    "wifi",
    "ethernet",
    "zigbee",
    "z_wave",
    "bluetooth",
    "thread",
    "matter",
    "proprietary",
]

_INTEGRATION_PLATFORMS = [
    "Google Home",
    "Amazon Alexa",
    "Apple HomeKit",
    "Tartware Hub",
    "Control4",
    "Custom API",
]

_STATUS_CHOICES = [
    "active",
    "maintenance",
    "offline",
    "error",
    "decommissioned",
]

_OPERATIONAL_CHOICES = ["normal", "warning", "error"]

_BATTERY_DEVICE_TYPES = {
    "occupancy_sensor",
    "motion_sensor",
    "door_sensor",
    "window_sensor",
    "smoke_detector",
    "co_detector",
    "leak_detector",
    "air_quality_monitor",
}


def _build_state(device_type: str) -> dict:
    if device_type == "smart_thermostat":
        target = round(random.uniform(20.0, 23.0), 1)
        return {"temperature": target, "mode": random.choice(["cool", "heat", "auto"])}
    if device_type == "smart_lock":
        return {"locked": random.choice([True, False]), "battery": random.randint(40, 100)}
    if device_type == "lighting_control":
        return {"on": random.choice([True, False]), "brightness": random.randint(20, 100)}
    if device_type in {"motion_sensor", "occupancy_sensor"}:
        return {"motion_detected": random.choice([True, False]), "battery": random.randint(30, 100)}
    if device_type == "air_quality_monitor":
        return {
            "co2": random.randint(400, 900),
            "voc_index": random.randint(10, 200),
            "aqi": random.randint(20, 120),
        }
    if device_type == "energy_monitor":
        return {"current_watts": round(random.uniform(100.0, 500.0), 1)}
    return {"status": "normal"}


def _build_settings(device_type: str) -> dict:
    if device_type == "smart_thermostat":
        return {"eco_mode": random.choice([True, False]), "schedule": "comfort"}
    if device_type == "lighting_control":
        return {"default_scene": random.choice(["warm", "cool", "daylight"])}
    if device_type == "smart_lock":
        return {"auto_lock": random.choice([True, False]), "pin_required": random.choice([True, False])}
    if device_type == "air_quality_monitor":
        return {"sampling_interval_minutes": random.choice([5, 10, 15])}
    return {"firmware_auto_update": random.choice([True, False])}


def insert_smart_room_devices(conn, devices_per_property: int | None = None):
    """Insert smart room device records"""
    print("\n✓ Inserting Smart Room Devices...")
    cur = conn.cursor()

    count = 0
    for property_rec in data_store["properties"]:
        property_rooms = [r for r in data_store["rooms"] if r["property_id"] == property_rec["id"]]
        cur.execute(
            "SELECT user_id FROM user_tenant_associations WHERE tenant_id = %s LIMIT 25",
            (property_rec["tenant_id"],),
        )
        tenant_users = [row[0] for row in cur.fetchall()]
        if not tenant_users:
            tenant_users = [u["id"] for u in data_store["users"]]

        per_property = devices_per_property or random.randint(12, 18)

        for _ in range(per_property):
            device_type = random.choice(list(_DEVICE_CATEGORY_MAP.keys()))
            room_ref = random.choice(property_rooms) if property_rooms and random.random() < 0.75 else None
            location = (
                f"Room {room_ref['room_number']}"
                if room_ref
                else random.choice(["Lobby", "Front Desk", "Fitness Center", "Conference Hall", "Spa", "Business Lounge"])
            )

            installation_date = fake.date_between(start_date="-18m", end_date="-1m")
            last_maintenance = installation_date + timedelta(days=random.randint(30, 300))
            next_maintenance = last_maintenance + timedelta(days=random.randint(60, 180))

            installed_by = random.choice(tenant_users) if tenant_users else None
            device_id = generate_uuid()
            serial_token = generate_uuid().replace("-", "").upper()
            mac_address = fake.unique.mac_address().upper()
            api_key_reference = f"device-key-{device_id.replace('-', '')[:12]}"

            cur.execute(
                """
                INSERT INTO smart_room_devices (
                    device_id, tenant_id, property_id, room_id, location,
                    device_name, device_type, device_category,
                    manufacturer, model_number, serial_number,
                    firmware_version, hardware_version,
                    mac_address, ip_address, network_type,
                    is_online, last_online_at, signal_strength,
                    battery_level, is_battery_powered,
                    installation_date, installed_by, warranty_expiry_date,
                    status, operational_status,
                    supports_voice_control, supports_remote_control,
                    supports_scheduling, supports_automation,
                    current_state, device_settings, automation_rules,
                    power_consumption_watts, energy_usage_kwh,
                    last_maintenance_date, next_maintenance_date, maintenance_interval_days,
                    maintenance_notes, issue_count,
                    integration_platform, api_endpoint, api_key_reference,
                    guest_controllable, guest_visible, requires_training,
                    total_activations, last_activated_at, average_daily_activations,
                    alert_enabled, alert_threshold, last_alert_at,
                    notes, created_at, created_by, updated_at, updated_by
                ) VALUES (
                    %s, %s, %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s,
                    %s, %s,
                    %s, %s, %s,
                    %s, %s, %s,
                    %s, %s,
                    %s, %s, %s,
                    %s, %s,
                    %s, %s,
                    %s, %s,
                    %s, %s, %s,
                    %s, %s,
                    %s, %s, %s,
                    %s, %s,
                    %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s, %s
                )
                """,
                (
                    device_id,
                    property_rec["tenant_id"],
                    property_rec["id"],
                    room_ref["id"] if room_ref else None,
                    location,
                    _DEVICE_NAMES.get(device_type, "Smart Device"),
                    device_type,
                    _DEVICE_CATEGORY_MAP.get(device_type, "convenience"),
                    random.choice(["Nest", "August", "Philips", "Samsung", "Honeywell", "Bosch", "Tartware IoT"]),
                    f"{device_type[:3].upper()}-{random.randint(100, 999)}",
                    f"SRD-{serial_token[:12]}",
                    f"{random.randint(1, 4)}.{random.randint(0, 9)}.{random.randint(0, 20)}",
                    f"HW-{random.randint(1, 3)}.0",
                    mac_address,
                    fake.ipv4_private(),
                    random.choice(_NETWORK_TYPES),
                    random.choice([True, True, False]),
                    fake.date_time_between(start_date="-7d", end_date="now"),
                    random.randint(45, 100),
                    random.randint(20, 100) if device_type in _BATTERY_DEVICE_TYPES else None,
                    device_type in _BATTERY_DEVICE_TYPES,
                    installation_date,
                    installed_by,
                    installation_date + timedelta(days=random.randint(365, 720)),
                    random.choice(_STATUS_CHOICES),
                    random.choice(_OPERATIONAL_CHOICES),
                    random.choice([True, False]),
                    True,
                    random.choice([True, True, False]),
                    random.choice([True, False]),
                    json.dumps(_build_state(device_type)),
                    json.dumps(_build_settings(device_type)),
                    json.dumps({"automation_mode": random.choice(["schedule", "sensor", "manual"])}),
                    round(random.uniform(5.0, 120.0), 2),
                    round(random.uniform(0.5, 25.0), 2),
                    last_maintenance,
                    next_maintenance,
                    random.randint(60, 180),
                    random.choice([
                        "Routine calibration completed.",
                        "Battery replaced during maintenance.",
                        "Firmware verified and up to date.",
                        None,
                    ]),
                    random.randint(0, 3),
                    random.choice(_INTEGRATION_PLATFORMS),
                    f"https://iot.tartware.example/devices/{device_id}",
                    api_key_reference,
                    random.choice([True, True, False]),
                    random.choice([True, True, False]),
                    random.choice([True, False]),
                    random.randint(10, 500),
                    fake.date_time_between(start_date="-5d", end_date="now"),
                    round(random.uniform(0.5, 12.0), 2),
                    random.choice([True, True, False]),
                    json.dumps({"threshold": random.randint(60, 90)}),
                    fake.date_time_between(start_date="-30d", end_date="now"),
                    random.choice(["Initial provisioning", "Auto-generated for sample dataset", None]),
                    fake.date_time_between(start_date="-12m", end_date="now"),
                    installed_by,
                    datetime.utcnow(),
                    installed_by,
                ),
            )

            data_store["smart_room_devices"].append(
                {
                    "device_id": device_id,
                    "tenant_id": property_rec["tenant_id"],
                    "property_id": property_rec["id"],
                    "room_id": room_ref["id"] if room_ref else None,
                    "device_type": device_type,
                }
            )
            count += 1

    conn.commit()
    fake.unique.clear()
    print(f"   → Inserted {count} smart room devices")
