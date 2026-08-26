#!/usr/bin/env python3
"""Seed everything the load test needs, entirely through the HTTP API.

No database access. Reference data (room types, rates), aggregates (guests,
reservations), and the manifest the k6 scenario reads are all produced by
calling the same endpoints a real client would — so the setup exercises the
system rather than reaching around it, and a broken endpoint fails the run
instead of being silently bypassed.

Two things force per-tenant work:

  * Authorisation is per tenant. One token cannot drive fifty; each tenant's
    own owner logs in and acts for itself.
  * ``fk_reservations_tenant_guest_id`` is composite on (tenant_id, guest_id),
    so a guest belonging to one tenant cannot be booked under another. The
    manifest therefore groups ids by the tenant that owns them.

Usage:
  seed_via_api.py --gateways URL[,URL...] --tokens tokens.tsv
                  [--guests N] [--reservations N] [--out manifest.json]
"""

from __future__ import annotations

import argparse
import concurrent.futures as futures
import json
import sys
import urllib.error
import urllib.request
import uuid

TIMEOUT = 30


def request(method: str, url: str, token: str, body: dict | None = None) -> tuple[int, object]:
    """Issue one API call, returning (status, parsed-body-or-text)."""
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        url,
        method=method,
        data=data,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            # Every command write requires a client-supplied key.
            "Idempotency-Key": str(uuid.uuid4()),
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as response:
            raw = response.read()
            try:
                return response.status, json.loads(raw or "null")
            except json.JSONDecodeError:
                return response.status, raw.decode(errors="replace")
    except urllib.error.HTTPError as error:
        raw = error.read()
        try:
            return error.code, json.loads(raw or "null")
        except json.JSONDecodeError:
            return error.code, raw.decode(errors="replace")
    except Exception as error:  # noqa: BLE001 - reported, never swallowed
        return 0, str(error)


class Seeder:
    def __init__(self, gateways: list[str], tokens: list[tuple[str, str, str]]):
        self.gateways = gateways
        self.tokens = tokens
        self._cursor = 0

    def gateway(self) -> str:
        """Round-robin so seeding load is spread like the test's own traffic."""
        self._cursor += 1
        return self.gateways[self._cursor % len(self.gateways)]

    def command(self, token: str, tenant: str, name: str, payload: dict) -> int:
        status, _ = request(
            "POST",
            f"{self.gateway()}/v1/commands/{name}/execute",
            token,
            {"tenant_id": tenant, "payload": payload},
        )
        return status

    def get(self, token: str, path: str) -> object:
        _, body = request("GET", f"{self.gateway()}{path}", token)
        return body


def rows_of(body: object) -> list:
    """List endpoints answer either with a bare array or `{data: [...]}`."""
    if isinstance(body, list):
        return body
    if isinstance(body, dict) and isinstance(body.get("data"), list):
        return body["data"]
    return []


def seed_reference(seeder: Seeder, tenant: str, prop: str, token: str) -> str | None:
    """Ensure the tenant has a room type and an active rate, and return the type id.

    A reservation resolves its rate server-side, so a tenant bootstrapped
    without these cannot take a booking at all — `POST /v1/system/tenants/bootstrap`
    creates the tenant, its property and its owner, but neither of these.
    """
    existing = rows_of(seeder.get(token, f"/v1/room-types?tenant_id={tenant}&property_id={prop}"))
    room_type_id = existing[0].get("id") or existing[0].get("room_type_id") if existing else None

    if not room_type_id:
        status, body = request(
            "POST",
            f"{seeder.gateway()}/v1/room-types",
            token,
            {
                "tenant_id": tenant,
                "property_id": prop,
                "type_name": "Standard King",
                "type_code": "STDK",
                "base_price": 199.00,
            },
        )
        if status not in (200, 201) or not isinstance(body, dict):
            return None
        room_type_id = body.get("room_type_id") or body.get("id")

    if not room_type_id:
        return None

    # tenant_id travels in the query string on this route (tenantScopeFromQuery).
    status, _ = request(
        "POST",
        f"{seeder.gateway()}/v1/rates?tenant_id={tenant}",
        token,
        {
            "tenant_id": tenant,
            "property_id": prop,
            "room_type_id": room_type_id,
            "rate_name": "Best Available Rate",
            "rate_code": "BAR",
            "base_rate": 199.00,
            "valid_from": "2020-01-01",
            "valid_until": "2030-12-31",
            "status": "ACTIVE",
        },
    )
    # 409 means the rate is already there, which is success for seeding.
    if status not in (200, 201, 409):
        print(f"  rate creation for {tenant[:8]} returned HTTP {status}", file=sys.stderr)
    return room_type_id


def wait_for_registry(gateways: list[str], probe: tuple[str, str, str]) -> bool:
    """Block until every gateway accepts a command.

    Each gateway caches the command registry and refreshes on an interval, so a
    feature flag enabled a moment ago is not yet visible to every process.
    Seeding into that gap makes every write 409 and produces an empty manifest —
    which looks exactly like a broken seeder.
    """
    import time

    tenant, _prop, token = probe
    for _ in range(60):
        ready = 0
        for gateway in gateways:
            status, _ = request(
                "POST",
                f"{gateway}/v1/commands/guest.register/execute",
                token,
                {
                    "tenant_id": tenant,
                    "payload": {
                        "first_name": "Probe",
                        "last_name": "Ready",
                        "email": f"probe-{uuid.uuid4().hex[:12]}@seed.test",
                        "phone": "+15550000000",
                    },
                },
            )
            if status == 202:
                ready += 1
        if ready == len(gateways):
            print(f"  gateways accepting commands: {ready}/{len(gateways)}")
            return True
        time.sleep(3)
    print(f"  gateways accepting commands: {ready}/{len(gateways)}", file=sys.stderr)
    return False


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--gateways", required=True)
    parser.add_argument("--tokens", required=True)
    parser.add_argument("--guests", type=int, default=20)
    parser.add_argument("--reservations", type=int, default=20)
    parser.add_argument("--out", default="/tmp/tartware-flow-manifest.json")
    parser.add_argument("--workers", type=int, default=64)
    args = parser.parse_args()

    gateways = [g.strip() for g in args.gateways.split(",") if g.strip()]
    tenants: list[tuple[str, str, str]] = []
    with open(args.tokens) as handle:
        for line in handle:
            parts = line.rstrip("\n").split("\t")
            if len(parts) == 3:
                tenants.append((parts[0], parts[1], parts[2]))

    if not tenants:
        print("no tenants with tokens", file=sys.stderr)
        return 1

    seeder = Seeder(gateways, tenants)
    print(f"seeding {len(tenants)} tenants across {len(gateways)} gateways")

    if not wait_for_registry(gateways, tenants[0]):
        print("gateways never started accepting commands", file=sys.stderr)
        return 1

    # ── Reference data ────────────────────────────────────────────────────
    room_types: dict[str, str] = {}
    with futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        results = pool.map(
            lambda t: (t[0], seed_reference(seeder, t[0], t[1], t[2])), tenants
        )
        for tenant, room_type in results:
            if room_type:
                room_types[tenant] = room_type
    print(f"  tenants with a room type and rate: {len(room_types)}/{len(tenants)}")

    # ── Guests ────────────────────────────────────────────────────────────
    jobs = [
        (tenant, token, index)
        for tenant, _prop, token in tenants
        for index in range(args.guests)
    ]
    with futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        list(
            pool.map(
                lambda job: seeder.command(
                    job[1],
                    job[0],
                    "guest.register",
                    {
                        "first_name": f"Seed{job[2]}",
                        "last_name": "Guest",
                        "email": f"seed-{job[0][:8]}-{job[2]}-{uuid.uuid4().hex[:6]}@seed.test",
                        "phone": "+15550000000",
                    },
                ),
                jobs,
            )
        )
    print(f"  guest.register issued: {len(jobs)}")

    # Commands apply asynchronously, so poll the API for the rows rather than
    # sleeping a guessed interval.
    guests_by_tenant = wait_for(
        seeder, tenants, "guests", args.guests // 2, args.workers
    )

    # ── Reservations ──────────────────────────────────────────────────────
    jobs = []
    for tenant, prop, token in tenants:
        owned = guests_by_tenant.get(tenant, [])
        room_type = room_types.get(tenant)
        if not owned or not room_type:
            continue
        for index in range(args.reservations):
            guest = owned[index % len(owned)]
            day = 1 + (index % 25)
            jobs.append(
                (
                    token,
                    tenant,
                    {
                        "property_id": prop,
                        "room_type_id": room_type,
                        "guest_id": guest,
                        "check_in_date": f"2026-11-{day:02d}",
                        "check_out_date": f"2026-11-{min(day + 2, 28):02d}",
                        "adults": 2,
                        "children": 0,
                        "rate_code": "BAR",
                        "total_amount": 199.00,
                    },
                )
            )
    with futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        list(pool.map(lambda job: seeder.command(job[0], job[1], "reservation.create", job[2]), jobs))
    print(f"  reservation.create issued: {len(jobs)}")

    reservations_by_tenant = wait_for(
        seeder, tenants, "reservations", max(1, args.reservations // 4), args.workers
    )

    # ── Manifest ──────────────────────────────────────────────────────────
    manifest = []
    for tenant, prop, token in tenants:
        guests = guests_by_tenant.get(tenant, [])
        if not guests:
            continue
        rooms = [
            row.get("id")
            for row in rows_of(seeder.get(token, f"/v1/rooms?tenant_id={tenant}&limit=30"))
            if row.get("id")
        ]
        manifest.append(
            {
                "tenantId": tenant,
                "propertyId": prop,
                "token": token,
                "roomTypeId": room_types.get(tenant, ""),
                "guestIds": guests[:60],
                "reservationIds": reservations_by_tenant.get(tenant, [])[:60],
                "roomIds": rooms,
            }
        )

    with open(args.out, "w") as handle:
        json.dump(manifest, handle)

    with_res = sum(1 for entry in manifest if entry["reservationIds"])
    print(f"manifest tenants: {len(manifest)}/{len(tenants)}  with reservations: {with_res}")
    print(f"wrote {args.out}")
    return 0 if manifest else 1


def wait_for(
    seeder: Seeder,
    tenants: list[tuple[str, str, str]],
    resource: str,
    target_per_tenant: int,
    workers: int,
) -> dict[str, list[str]]:
    """Poll the list endpoint until enough tenants have their rows applied."""
    import time

    by_tenant: dict[str, list[str]] = {}
    for attempt in range(40):
        def fetch(entry: tuple[str, str, str]) -> tuple[str, list[str]]:
            tenant, _prop, token = entry
            rows = rows_of(
                seeder.get(token, f"/v1/{resource}?tenant_id={tenant}&limit=100")
            )
            return tenant, [row.get("id") for row in rows if row.get("id")]

        with futures.ThreadPoolExecutor(max_workers=workers) as pool:
            by_tenant = dict(pool.map(fetch, tenants))

        ready = sum(1 for ids in by_tenant.values() if len(ids) >= target_per_tenant)
        if ready >= len(tenants) * 0.8:
            break
        time.sleep(3)

    total = sum(len(ids) for ids in by_tenant.values())
    print(f"  {resource} applied: {total} across {sum(1 for v in by_tenant.values() if v)} tenants")
    return by_tenant


if __name__ == "__main__":
    sys.exit(main())
