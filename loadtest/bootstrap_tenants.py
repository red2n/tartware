#!/usr/bin/env python3
"""Bootstrap tenants and collect a token for each — API only, no database.

Replaces the psql-backed pair (`seed-tenants.sh` + `collect-tenant-tokens.sh`).
Reading the tenant list straight from Postgres was faster and hid things: a
tenant that exists as a row but cannot authenticate, or a property the API
would not associate, both looked fine and then failed under load.

Authorisation is per tenant, so each tenant's own owner logs in and the token
is recorded against it. One token cannot drive fifty tenants — doing so
produces a ~1/51 acceptance rate and measures nothing but the cost of a 403.

Usage:
  bootstrap_tenants.py --count 50 --system-token TOKEN
                       [--core http://localhost:3000] [--gateway http://localhost:8085]
                       [--out /tmp/tartware-tenant-tokens.tsv]
Output (TSV): tenantId <TAB> propertyId <TAB> token
"""

from __future__ import annotations

import argparse
import concurrent.futures as futures
import json
import sys
import urllib.error
import urllib.request

TIMEOUT = 60


def call(method: str, url: str, token: str | None = None, body: dict | None = None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(
        url,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers=headers,
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as response:
            raw = response.read()
            return response.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as error:
        raw = error.read()
        try:
            return error.code, json.loads(raw) if raw else None
        except json.JSONDecodeError:
            return error.code, raw.decode(errors="replace")
    except Exception as error:  # noqa: BLE001
        return 0, str(error)


# The policy requires at least 12 characters; the reference script's
# `LTPass<n>!x` is rejected with HTTP 400 and bootstraps nothing.
def owner_password(index: int) -> str:
    return f"LoadTest{index}!Aa9x"


def bootstrap_one(core: str, system_token: str, index: int) -> tuple[int, object]:
    slug = f"lt-tenant-{index:03d}"
    return call(
        "POST",
        f"{core}/v1/system/tenants/bootstrap",
        system_token,
        {
            "tenant": {
                "name": f"LT Hotel Group {index}",
                "slug": slug,
                "type": "CHAIN",
                "email": f"admin@{slug}.test",
            },
            "property": {
                "property_name": f"LT Hotel Group {index} HQ",
                "property_code": f"LT{index:03d}-001",
                "property_type": "hotel",
                "star_rating": (index % 3) + 3,
                "total_rooms": 50 + (index % 50),
                "email": f"hq@{slug}.test",
                "timezone": "America/New_York",
                "currency": "USD",
            },
            "owner": {
                "username": f"lt{index}.admin",
                "email": f"admin@{slug}.test",
                "password": owner_password(index),
                "first_name": "Admin",
                "last_name": f"LT{index}",
            },
        },
    )


def login(gateway: str, username: str, password: str) -> tuple[str | None, list]:
    status, body = call(
        "POST", f"{gateway}/v1/auth/login", None, {"username": username, "password": password}
    )
    if status != 200 or not isinstance(body, dict):
        return None, []
    return body.get("access_token"), body.get("memberships") or []


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=50)
    parser.add_argument("--system-token", required=True)
    parser.add_argument("--core", default="http://localhost:3000")
    parser.add_argument("--gateway", default="http://localhost:8085")
    parser.add_argument("--out", default="/tmp/tartware-tenant-tokens.tsv")
    args = parser.parse_args()

    print(f"bootstrapping {args.count} tenants via {args.core}")
    with futures.ThreadPoolExecutor(max_workers=10) as pool:
        results = list(
            pool.map(lambda i: bootstrap_one(args.core, args.system_token, i), range(1, args.count + 1))
        )
    created = sum(1 for status, _ in results if 200 <= status < 300)
    print(f"  bootstrapped: {created}/{args.count}")
    for status, body in results[:3]:
        if not 200 <= status < 300:
            print(f"  e.g. HTTP {status}: {str(body)[:140]}")

    # Log in as each owner. The membership in the login response is the
    # authoritative tenant→property pairing: reading it from the API means a
    # tenant that cannot authenticate is excluded here rather than failing
    # every request under load.
    logins = [("setup.admin", "TempPass1234")]
    logins += [(f"lt{i}.admin", owner_password(i)) for i in range(1, args.count + 1)]

    def resolve(entry: tuple[str, str]) -> list[tuple[str, str, str]]:
        username, password = entry
        token, memberships = login(args.gateway, username, password)
        if not token:
            return []
        out = []
        for membership in memberships:
            tenant = membership.get("tenant_id")
            if not tenant:
                continue
            properties = call(
                "GET", f"{args.gateway}/v1/properties?tenant_id={tenant}&limit=1", token
            )[1]
            rows = properties if isinstance(properties, list) else (properties or {}).get("data", [])
            if not rows:
                continue
            out.append((tenant, rows[0].get("id"), token))
        return out

    with futures.ThreadPoolExecutor(max_workers=32) as pool:
        pairs = [row for rows in pool.map(resolve, logins) for row in rows if row[1]]

    # A tenant reached through two logins would otherwise be driven twice.
    seen: dict[str, tuple[str, str, str]] = {}
    for tenant, prop, token in pairs:
        seen.setdefault(tenant, (tenant, prop, token))

    with open(args.out, "w") as handle:
        for tenant, prop, token in seen.values():
            handle.write(f"{tenant}\t{prop}\t{token}\n")

    print(f"tenants authenticated with a property: {len(seen)} → {args.out}")
    return 0 if seen else 1


if __name__ == "__main__":
    sys.exit(main())
