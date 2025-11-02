"""Insert sample data for device_events_log"""

import json
import random
from datetime import datetime, timedelta

from faker import Faker

from data_store import data_store
from db_config import generate_uuid

fake = Faker()

_EVENT_TYPES = [
    "state_change",
    "activation",
    "deactivation",
    "error",
    "warning",
    "maintenance",
    "update",
    "connection",
    "disconnection",
    "alert",
    "guest_interaction",
    "automation_triggered",
]

_TRIGGERED_BY = ["guest", "staff", "automation", "schedule", "sensor", "system", "api", "voice_command"]
_SEVERITY_BY_EVENT = {
    "state_change": "info",
    "activation": "info",
    "deactivation": "info",
    "error": "error",
    "warning": "warning",
    "maintenance": "warning",
    "update": "info",
    "connection": "info",
    "disconnection": "warning",
    "alert": "warning",
    "guest_interaction": "info",
    "automation_triggered": "info",
}

_ACTION_TEMPLATES = [
    "Notification sent to engineering",
    "Device reset remotely",
    "Firmware patch applied",
    "Awaiting technician visit",
    "Logged for monitoring",
]


def _state_transition(device_type: str) -> tuple[dict, dict]:
    base_state = {"status": "normal"}
    if device_type == "smart_lock":
        prev = {"locked": random.choice([True, False])}
        new = {"locked": not prev["locked"]}
        return prev, new
    if device_type == "smart_thermostat":
        prev_temp = round(random.uniform(20.0, 23.0), 1)
        new_temp = prev_temp + random.choice([-0.5, 0.5, 1.0, -1.0])
        return {"temperature": prev_temp}, {"temperature": new_temp}
    if device_type == "lighting_control":
        prev = {"brightness": random.randint(20, 70), "on": True}
        new = {"brightness": random.randint(30, 100), "on": random.choice([True, False])}
        return prev, new
    if device_type in {"motion_sensor", "occupancy_sensor"}:
        prev = {"motion": random.choice([False, True])}
        new = {"motion": not prev["motion"]}
        return prev, new
    return base_state, base_state


def insert_device_events_log(conn, max_events_per_device: int = 6):
    """Insert events for smart devices"""
    print("\n✓ Inserting Device Events Log...")
    if not data_store["smart_room_devices"]:
        print("   → Skipping: no smart room devices available")
        return

    cur = conn.cursor()

    cur.execute("SELECT tenant_id, user_id FROM user_tenant_associations")
    tenant_user_map: dict[str, list[str]] = {}
    for tenant_id, user_id in cur.fetchall():
        tenant_user_map.setdefault(tenant_id, []).append(user_id)

    guest_ids = [g["id"] for g in data_store["guests"]]

    count = 0
    event_start = datetime.utcnow() - timedelta(days=30)

    for device in data_store["smart_room_devices"]:
        events_for_device = random.randint(3, max_events_per_device)
        tenant_users = tenant_user_map.get(device["tenant_id"], [])

        for _ in range(events_for_device):
            event_type = random.choice(_EVENT_TYPES)
            severity = _SEVERITY_BY_EVENT.get(event_type, "info")
            triggered_by = random.choice(_TRIGGERED_BY)
            event_time = fake.date_time_between(start_date=event_start, end_date="now")

            prev_state, new_state = _state_transition(device.get("device_type", "other"))
            event_payload = {
                "location": device.get("room_id"),
                "property_id": device.get("property_id"),
                "message": random.choice([
                    "Routine automation executed",
                    "Energy optimization triggered",
                    "Guest adjusted settings",
                    "Sensor threshold crossed",
                ]),
            }

            triggered_by_user = None
            triggered_by_guest = None

            if triggered_by in {"staff", "automation", "schedule", "system", "api"} and tenant_users:
                triggered_by_user = random.choice(tenant_users)
            if triggered_by in {"guest", "voice_command"} and guest_ids:
                triggered_by_guest = random.choice(guest_ids)

            resolved = severity in {"info"} or random.random() < 0.6
            resolved_at = event_time + timedelta(minutes=random.randint(5, 120)) if resolved else None

            error_code = None
            error_message = None
            if severity in {"warning", "error"}:
                error_code = random.choice(["ERR-201", "ERR-305", "WARN-102", "WARN-410"])
                error_message = random.choice([
                    "Device reported intermittent connectivity",
                    "Battery level below threshold",
                    "Temperature variance exceeded limit",
                    "Unexpected offline event",
                ])

            action_taken = random.choice(_ACTION_TEMPLATES) if severity != "info" else "No action required"

            event_id = generate_uuid()
            cur.execute(
                """
                INSERT INTO device_events_log (
                    event_id, device_id, event_type, event_timestamp,
                    previous_state, new_state, event_data,
                    triggered_by, triggered_by_user_id, triggered_by_guest_id,
                    error_code, error_message, severity,
                    action_taken, resolved, resolved_at, created_at
                ) VALUES (
                    %s, %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s, %s
                )
                """,
                (
                    event_id,
                    device["device_id"],
                    event_type,
                    event_time,
                    json.dumps(prev_state),
                    json.dumps(new_state),
                    json.dumps(event_payload),
                    triggered_by,
                    triggered_by_user,
                    triggered_by_guest,
                    error_code,
                    error_message,
                    severity,
                    action_taken,
                    resolved,
                    resolved_at,
                    event_time,
                ),
            )

            data_store["device_events_log"].append(
                {
                    "event_id": event_id,
                    "device_id": device["device_id"],
                    "tenant_id": device["tenant_id"],
                }
            )
            count += 1

    conn.commit()
    print(f"   → Inserted {count} device events")
