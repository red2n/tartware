"""Locust-based load test for Tartware's API Gateway.
The tasks mirror the k6 command pipeline scenario so both tools hit the same routes.
"""

import json
import os
import random
import uuid
from datetime import datetime, timedelta

from locust import HttpUser, task, between
from locust.contrib.fasthttp import FastHttpUser

API_TOKEN = os.getenv("API_TOKEN")
TENANT_IDS = [tenant.strip() for tenant in (os.getenv("TENANT_IDS") or "").split(",") if tenant.strip()]
PROPERTY_IDS = [prop.strip() for prop in (os.getenv("PROPERTY_IDS") or "").split(",") if prop.strip()]
ROOM_TYPE_IDS = [room.strip() for room in (os.getenv("ROOM_TYPE_IDS") or "").split(",") if room.strip()]
RESERVATION_IDS = [res.strip() for res in (os.getenv("RESERVATION_IDS") or "").split(",") if res.strip()]
GUEST_IDS = [guest.strip() for guest in (os.getenv("GUEST_IDS") or "").split(",") if guest.strip()]
HOUSEKEEPING_TASK_IDS = [
    task.strip() for task in (os.getenv("HOUSEKEEPING_TASK_IDS") or "").split(",") if task.strip()
]
HOUSEKEEPING_STAFF_IDS = [
    staff.strip() for staff in (os.getenv("HOUSEKEEPING_STAFF_IDS") or "").split(",") if staff.strip()
]


def _require(values, label):
    if not values:
        raise RuntimeError(f"Set {label} environment variable before running Locust.")
    return random.choice(values)


def _pick_with_fallback(values):
    return random.choice(values) if values else str(uuid.uuid4())


def _future_date(days):
    return (datetime.utcnow() + timedelta(days=days)).isoformat() + "Z"


class TartwareUser(FastHttpUser):
    """Simulates tenant operators submitting commands through the API Gateway."""

    wait_time = between(0.2, 1.5)
    host = os.getenv("LOCUST_HOST") or os.getenv("GATEWAY_BASE_URL") or "http://localhost:8080"

    def on_start(self):
        if not API_TOKEN:
            raise RuntimeError("API_TOKEN env var is required for authenticated routes.")
        self.headers = {
            "Authorization": f"Bearer {API_TOKEN}",
            "Content-Type": "application/json",
        }

    @task(5)
    def health_check(self):
        self.client.get("/health", headers=self.headers, name="GET /health")

    @task(10)
    def list_rooms(self):
        tenant_id = _require(TENANT_IDS, "TENANT_IDS")
        self.client.get(
            "/v1/rooms",
            params={"tenant_id": tenant_id, "limit": 50},
            headers=self.headers,
            name="GET /v1/rooms",
        )

    @task(10)
    def list_guests(self):
        tenant_id = _require(TENANT_IDS, "TENANT_IDS")
        self.client.get(
            "/v1/guests",
            params={"tenant_id": tenant_id, "limit": 50},
            headers=self.headers,
            name="GET /v1/guests",
        )

    @task(20)
    def register_guest(self):
        tenant_id = _require(TENANT_IDS, "TENANT_IDS")
        payload = {
            "tenant_id": tenant_id,
            "first_name": f"Locust{random.randint(1000, 9999)}",
            "last_name": "Tester",
            "email": f"locust{random.randint(100000, 999999)}@example.com",
            "phone": f"+1{random.randint(1000000000, 1999999999)}",
            "address": {
                "street": "123 Load Rd",
                "city": "Locust",
                "state": "CA",
                "country": "US",
                "postal_code": "90001",
            },
        }
        self.client.post(
            "/v1/guests",
            headers=self.headers,
            data=json.dumps(payload),
            name="POST /v1/guests",
        )

    @task(25)
    def create_reservation(self):
        tenant_id = _require(TENANT_IDS, "TENANT_IDS")
        payload = {
            "property_id": _require(PROPERTY_IDS, "PROPERTY_IDS"),
            "guest_id": str(uuid.uuid4()),
            "room_type_id": _require(ROOM_TYPE_IDS, "ROOM_TYPE_IDS"),
            "check_in_date": _future_date(2),
            "check_out_date": _future_date(5),
            "total_amount": random.randint(120, 600),
            "currency": "USD",
            "status": "PENDING",
            "notes": "locust reservation",
        }
        self.client.post(
            f"/v1/tenants/{tenant_id}/reservations",
            headers=self.headers,
            data=json.dumps(payload),
            name="POST /v1/tenants/:tenantId/reservations",
        )

    @task(15)
    def modify_reservation(self):
        tenant_id = _require(TENANT_IDS, "TENANT_IDS")
        reservation_id = str(uuid.uuid4())
        payload = {
            "property_id": _require(PROPERTY_IDS, "PROPERTY_IDS"),
            "check_in_date": _future_date(3),
            "check_out_date": _future_date(6),
            "total_amount": random.randint(200, 700),
            "notes": "locust modify",
        }
        self.client.patch(
            f"/v1/tenants/{tenant_id}/reservations/{reservation_id}",
            headers=self.headers,
            data=json.dumps(payload),
            name="PATCH /v1/tenants/:tenantId/reservations/:reservationId",
        )

    @task(10)
    def cancel_reservation(self):
        tenant_id = _require(TENANT_IDS, "TENANT_IDS")
        reservation_id = str(uuid.uuid4())
        payload = {
            "property_id": _require(PROPERTY_IDS, "PROPERTY_IDS"),
            "reason": "load-test",
        }
        self.client.delete(
            f"/v1/tenants/{tenant_id}/reservations/{reservation_id}",
            headers=self.headers,
            data=json.dumps(payload),
            name="DELETE /v1/tenants/:tenantId/reservations/:reservationId",
        )

    @task(12)
    def capture_billing_payment(self):
        tenant_id = _require(TENANT_IDS, "TENANT_IDS")
        payload = {
            "property_id": _require(PROPERTY_IDS, "PROPERTY_IDS"),
            "reservation_id": _pick_with_fallback(RESERVATION_IDS),
            "guest_id": _pick_with_fallback(GUEST_IDS),
            "payment_reference": f"locust-{uuid.uuid4()}",
            "payment_method": "CARD",
            "amount": random.randint(50, 500),
            "currency": "USD",
            "gateway": {
                "name": "locust-gateway",
                "reference": str(uuid.uuid4()),
                "response": {"status": "APPROVED"},
            },
            "metadata": {"loadTest": True, "source": "locust"},
        }
        self.client.post(
            f"/v1/tenants/{tenant_id}/billing/payments/capture",
            headers=self.headers,
            data=json.dumps(payload),
            name="POST /v1/tenants/:tenantId/billing/payments/capture",
        )

    @task(8)
    def assign_housekeeping_task(self):
        tenant_id = _require(TENANT_IDS, "TENANT_IDS")
        task_id = _require(HOUSEKEEPING_TASK_IDS, "HOUSEKEEPING_TASK_IDS")
        assignee = _require(HOUSEKEEPING_STAFF_IDS, "HOUSEKEEPING_STAFF_IDS")
        payload = {
            "priority": random.choice(["NORMAL", "HIGH"]),
            "notes": "locust assignment",
            "assigned_to": assignee,
        }
        self.client.post(
            f"/v1/tenants/{tenant_id}/housekeeping/tasks/{task_id}/assign",
            headers=self.headers,
            data=json.dumps(payload),
            name="POST /v1/tenants/:tenantId/housekeeping/tasks/:taskId/assign",
        )

    @task(8)
    def complete_housekeeping_task(self):
        tenant_id = _require(TENANT_IDS, "TENANT_IDS")
        task_id = _require(HOUSEKEEPING_TASK_IDS, "HOUSEKEEPING_TASK_IDS")
        completed_by = _require(HOUSEKEEPING_STAFF_IDS, "HOUSEKEEPING_STAFF_IDS")
        payload = {
            "completed_by": completed_by,
            "notes": "locust completion",
            "inspection": {
                "inspected_by": completed_by,
                "passed": random.random() > 0.2,
                "notes": "auto inspection",
            },
        }
        self.client.post(
            f"/v1/tenants/{tenant_id}/housekeeping/tasks/{task_id}/complete",
            headers=self.headers,
            data=json.dumps(payload),
            name="POST /v1/tenants/:tenantId/housekeeping/tasks/:taskId/complete",
        )


class PowerUser(TartwareUser):
    wait_time = between(0.1, 0.4)
    weight = 2


class AdminUser(HttpUser):
    wait_time = between(5, 10)
    host = os.getenv("LOCUST_HOST") or os.getenv("GATEWAY_BASE_URL") or "http://localhost:8080"

    def on_start(self):
        if not API_TOKEN:
            raise RuntimeError("API_TOKEN env var is required for authenticated routes.")
        self.headers = {
            "Authorization": f"Bearer {API_TOKEN}",
            "Content-Type": "application/json",
        }

    @task
    def health(self):
        self.client.get("/health", headers=self.headers, name="GET /health (admin)")

    @task
    def list_guests(self):
        tenant_id = _require(TENANT_IDS, "TENANT_IDS")
        self.client.get(
            "/v1/guests",
            params={"tenant_id": tenant_id, "limit": 25},
            headers=self.headers,
            name="GET /v1/guests (admin)",
        )
