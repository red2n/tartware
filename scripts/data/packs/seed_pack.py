#!/usr/bin/env python3
"""
Domain-focused sample data packs for QA environments.

Each pack creates a small, opinionated slice of the PMS dataset plus
edge cases that exercise booking and financial workflows.
"""

from __future__ import annotations

import argparse
import sys
from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

from typing import Iterable

import random

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPT_DIR.parent
if str(DATA_DIR) not in sys.path:
    sys.path.insert(0, str(DATA_DIR))

from psycopg2.extras import Json  # type: ignore

from db_config import get_db_connection, generate_uuid
from data_store import data_store

from core_business import (  # type: ignore
    insert_guests,
    insert_properties,
    insert_rates,
    insert_reservations,
    insert_rooms,
    insert_room_types,
    insert_services,
    insert_tenants,
    insert_user_tenant_associations,
    insert_users,
    insert_payments,
    insert_invoices,
    insert_invoice_items,
)
from financial import (  # type: ignore
    insert_folios,
    insert_charge_postings,
    insert_financial_closures,
)
from integrations import insert_reservation_status_history  # type: ignore


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed targeted QA data packs.")
    parser.add_argument(
        "--pack",
        choices=["core", "bookings", "financial", "all"],
        default="core",
        help="Pack to run (default: core).",
    )
    parser.add_argument(
        "--truncate",
        action="store_true",
        help="Truncate public tables (except settings catalog) before seeding.",
    )
    return parser.parse_args()


def reset_data_store() -> None:
    """Clear in-memory ID caches so loaders only reference fresh records."""
    for key in list(data_store.keys()):
        data_store[key] = []


def truncate_public_tables(conn) -> None:
    """Remove all tenant data while keeping catalog tables intact."""
    print("\n⚠ Truncating public tables (keeping setting catalog entries)...")
    cur = conn.cursor()
    cur.execute(
        """
        DO $$
        DECLARE
            r RECORD;
        BEGIN
            FOR r IN (
                SELECT tablename
                FROM pg_tables
                WHERE schemaname = 'public'
            ) LOOP
                IF r.tablename NOT IN ('setting_categories', 'setting_definitions') THEN
                    EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
                ELSE
                    RAISE NOTICE 'Skipping truncate for %', r.tablename;
                END IF;
            END LOOP;
        END $$;
        """
    )
    conn.commit()
    print("   → Truncate complete.")


def base_core_seed(
    conn,
    *,
    tenant_count: int = 2,
    user_count: int = 12,
    properties_per_tenant: int = 2,
    guests: int = 60,
    room_types_per_property: int = 3,
    rooms_per_property: int = 12,
) -> None:
    """Populate the foundational entities shared by every pack."""
    reset_data_store()
    insert_tenants(conn, count=tenant_count)
    insert_users(conn, count=user_count)
    insert_user_tenant_associations(conn)
    insert_properties(conn, count_per_tenant=properties_per_tenant)
    insert_guests(conn, count=guests)
    insert_room_types(conn, count_per_property=room_types_per_property)
    insert_rooms(conn, count_per_property=rooms_per_property)
    insert_rates(conn, count_per_property=2)
    insert_services(conn)


def seed_core_pack(conn) -> None:
    print("\n=== Core Foundation Pack ===")
    base_core_seed(conn, tenant_count=2, user_count=10, guests=45, rooms_per_property=10)
    print("✓ Core foundation seeded: tenants, users, properties, room types, rooms, rates.")


def seed_bookings_pack(conn) -> None:
    print("\n=== Bookings & CRM Pack ===")
    base_core_seed(conn, tenant_count=2, user_count=16, guests=90, rooms_per_property=18)
    insert_reservations(conn, count=60)
    insert_reservation_status_history(conn)
    insert_reservation_status_history(conn)  # Enrich timelines with additional noise
    inject_double_booking(conn)
    print("✓ Bookings pack complete with overlapping reservation anomalies.")


def seed_financial_pack(conn) -> None:
    print("\n=== Financial Edge-Case Pack ===")
    base_core_seed(conn, tenant_count=3, user_count=18, guests=75, rooms_per_property=20)
    insert_reservations(conn, count=40)
    insert_payments(conn)
    insert_invoices(conn)
    insert_invoice_items(conn)
    insert_folios(conn)
    insert_charge_postings(conn)
    insert_financial_closures(conn)
    inject_long_stay_folio(conn)
    print("✓ Financial pack complete with long-stay folio stress cases.")


def money(value: Decimal | float) -> Decimal:
    """Round monetary values to two decimals consistently."""
    return Decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def pick_guest_for_tenant(tenant_id: str):
    guests = [g for g in data_store["guests"] if g["tenant_id"] == tenant_id]
    return guests[0] if guests else data_store["guests"][0]


def pick_rate_for_room_type(room_type_id: str):
    for rate in data_store["rates"]:
        if rate["room_type_id"] == room_type_id:
            return rate
    return None


def inject_double_booking(conn) -> None:
    """Insert two overlapping reservations for the same room + stay window."""
    if not data_store["rooms"] or not data_store["guests"]:
        print("   → Skipping double booking injection (missing prerequisites).")
        return

    conflict_room = random.choice(data_store["rooms"])
    tenant_id = conflict_room["tenant_id"]
    property_id = conflict_room["property_id"]
    room_type_id = conflict_room["room_type_id"]
    rate = pick_rate_for_room_type(room_type_id)
    guests = [g for g in data_store["guests"] if g["tenant_id"] == tenant_id] or data_store["guests"]

    base_check_in = date.today() + timedelta(days=10)
    base_check_out = base_check_in + timedelta(days=3)
    nightly_rate = money(225)
    total_amount = money(nightly_rate * (base_check_out - base_check_in).days)
    metadata = {"scenario": "double_booking_pack", "conflict_group": f"DBK-{base_check_in.isoformat()}"}

    cur = conn.cursor()
    created = 0
    for idx in range(2):
        guest = guests[idx % len(guests)]
        reservation_id = generate_uuid()
        confirmation_number = f"DBK{idx + 1:04d}"
        cur.execute(
            """
            INSERT INTO reservations (
                id, tenant_id, property_id, guest_id, room_type_id, rate_id,
                confirmation_number, check_in_date, check_out_date, booking_date,
                room_number, number_of_adults, number_of_children, room_rate,
                total_amount, tax_amount, paid_amount, status, source,
                guest_name, guest_email, metadata, created_at
            )
            VALUES (
                %(id)s, %(tenant_id)s, %(property_id)s, %(guest_id)s, %(room_type_id)s, %(rate_id)s,
                %(confirmation_number)s, %(check_in)s, %(check_out)s, %(booking)s,
                %(room_number)s, 2, 0, %(room_rate)s,
                %(total_amount)s, %(tax_amount)s, 0.00, 'CONFIRMED', 'DIRECT',
                %(guest_name)s, %(guest_email)s, %(metadata)s, %(booking)s
            )
            ON CONFLICT (confirmation_number) DO NOTHING
            RETURNING id
            """,
            {
                "id": reservation_id,
                "tenant_id": tenant_id,
                "property_id": property_id,
                "guest_id": guest["id"],
                "room_type_id": room_type_id,
                "rate_id": rate["id"] if rate else None,
                "confirmation_number": confirmation_number,
                "check_in": base_check_in,
                "check_out": base_check_out,
                "booking": datetime.utcnow(),
                "room_number": conflict_room["room_number"],
                "room_rate": nightly_rate,
                "total_amount": total_amount,
                "tax_amount": money(total_amount * Decimal("0.10")),
                "guest_name": guest.get("name", "QA Guest"),
                "guest_email": guest.get("email", "qa-bookings@example.com"),
                "metadata": Json({**metadata, "booking_index": idx}),
            },
        )
        inserted = cur.fetchone()
        if inserted:
            created += 1
            data_store["reservations"].append(
                {
                    "id": reservation_id,
                    "tenant_id": tenant_id,
                    "property_id": property_id,
                    "guest_id": guest["id"],
                    "total_amount": total_amount,
                    "status": "CONFIRMED",
                    "check_in_date": base_check_in,
                    "check_out_date": base_check_out,
                    "confirmation_number": confirmation_number,
                }
            )

    conn.commit()
    print(f"   → Injected {created} double-booked reservations for room {conflict_room['room_number']}.")


def inject_long_stay_folio(conn) -> None:
    """Create a multi-month stay folio with large outstanding balance."""
    if not data_store["rooms"] or not data_store["users"] or not data_store["guests"]:
        print("   → Skipping long-stay folio injection (missing prerequisites).")
        return

    target_room = random.choice(data_store["rooms"])
    tenant_id = target_room["tenant_id"]
    property_id = target_room["property_id"]
    guest = pick_guest_for_tenant(tenant_id)
    rate = pick_rate_for_room_type(target_room["room_type_id"])
    created_by = data_store["users"][0]["id"]

    check_in = date.today() - timedelta(days=20)
    check_out = check_in + timedelta(days=60)
    nights = (check_out - check_in).days
    nightly_rate = money(189)
    subtotal = money(nightly_rate * nights)
    tax_amount = money(subtotal * Decimal("0.12"))
    total_amount = money(subtotal + tax_amount)
    paid_amount = money(total_amount * Decimal("0.35"))
    balance = money(total_amount - paid_amount)

    reservation_id = generate_uuid()
    confirmation_number = f"LS{datetime.utcnow():%Y%m%d%H%M}"
    metadata = Json({"scenario": "long_stay_pack", "nights": nights})

    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO reservations (
            id, tenant_id, property_id, guest_id, room_type_id, rate_id,
            confirmation_number, check_in_date, check_out_date, booking_date,
            room_number, number_of_adults, number_of_children, room_rate,
            total_amount, tax_amount, paid_amount, status, source,
            guest_name, guest_email, metadata, created_at
        )
        VALUES (
            %(id)s, %(tenant_id)s, %(property_id)s, %(guest_id)s, %(room_type_id)s, %(rate_id)s,
            %(confirmation_number)s, %(check_in)s, %(check_out)s, %(booking)s,
            %(room_number)s, 2, 0, %(room_rate)s,
            %(total_amount)s, %(tax_amount)s, %(paid_amount)s, 'CHECKED_IN', 'DIRECT',
            %(guest_name)s, %(guest_email)s, %(metadata)s, %(booking)s
        )
        ON CONFLICT (confirmation_number) DO NOTHING
        RETURNING id
        """,
        {
            "id": reservation_id,
            "tenant_id": tenant_id,
            "property_id": property_id,
            "guest_id": guest["id"],
            "room_type_id": target_room["room_type_id"],
            "rate_id": rate["id"] if rate else None,
            "confirmation_number": confirmation_number,
            "check_in": check_in,
            "check_out": check_out,
            "booking": datetime.utcnow(),
            "room_number": target_room["room_number"],
            "room_rate": nightly_rate,
            "total_amount": total_amount,
            "tax_amount": tax_amount,
            "paid_amount": paid_amount,
            "guest_name": guest.get("name", "QA Long Stay Guest"),
            "guest_email": guest.get("email", "qa-longstay@example.com"),
            "metadata": metadata,
        },
    )
    cur.fetchone()

    data_store["reservations"].append(
        {
            "id": reservation_id,
            "tenant_id": tenant_id,
            "property_id": property_id,
            "guest_id": guest["id"],
            "total_amount": total_amount,
            "status": "CHECKED_IN",
            "check_in_date": check_in,
            "check_out_date": check_out,
            "confirmation_number": confirmation_number,
        }
    )

    folio_id = generate_uuid()
    folio_number = f"QA-LONG-STAY-{datetime.utcnow():%Y%m%d%H%M%S}"
    cur.execute(
        """
        INSERT INTO folios (
            folio_id, tenant_id, property_id, reservation_id, guest_id,
            guest_name, folio_number, folio_type, folio_status,
            balance, total_charges, total_payments, total_credits,
            currency_code, notes, opened_at, created_by
        )
        VALUES (
            %(folio_id)s, %(tenant_id)s, %(property_id)s, %(reservation_id)s, %(guest_id)s,
            %(guest_name)s, %(folio_number)s, 'GUEST', 'OPEN',
            %(balance)s, %(total_charges)s, %(total_payments)s, 0.00,
            'USD', %(notes)s, CURRENT_TIMESTAMP, %(created_by)s
        )
        RETURNING folio_id
        """,
        {
            "folio_id": folio_id,
            "tenant_id": tenant_id,
            "property_id": property_id,
            "reservation_id": reservation_id,
            "guest_id": guest["id"],
            "guest_name": guest.get("name", "QA Long Stay Guest"),
            "folio_number": folio_number,
            "balance": balance,
            "total_charges": total_amount,
            "total_payments": paid_amount,
            "notes": "QA anomaly: simulate 60-night extended stay with partial payments.",
            "created_by": created_by,
        },
    )

    data_store["folios"].append(
        {
            "id": folio_id,
            "reservation_id": reservation_id,
            "tenant_id": tenant_id,
            "property_id": property_id,
        }
    )

    cur.execute(
        """
        INSERT INTO charge_postings (
            posting_id, tenant_id, property_id, folio_id, reservation_id, guest_id,
            business_date, transaction_type, posting_type,
            charge_code, charge_description, charge_category,
            quantity, unit_price, subtotal, tax_amount, total_amount,
            currency_code, notes, created_by
        )
        VALUES (
            %(posting_id)s, %(tenant_id)s, %(property_id)s, %(folio_id)s, %(reservation_id)s, %(guest_id)s,
            %(business_date)s, 'CHARGE', 'DEBIT',
            'ROOM', 'QA Long Stay Room Revenue', 'ROOM_REVENUE',
            %(quantity)s, %(unit_price)s, %(subtotal)s, %(tax_amount)s, %(total_amount)s,
            'USD', %(notes)s, %(created_by)s
        )
        """,
        {
            "posting_id": generate_uuid(),
            "tenant_id": tenant_id,
            "property_id": property_id,
            "folio_id": folio_id,
            "reservation_id": reservation_id,
            "guest_id": guest["id"],
            "business_date": date.today(),
            "quantity": nights,
            "unit_price": nightly_rate,
            "subtotal": subtotal,
            "tax_amount": tax_amount,
            "total_amount": total_amount,
            "notes": "QA anomaly: extended-stay posting inserted by packs/seed_pack.py.",
            "created_by": created_by,
        },
    )

    conn.commit()
    print(f"   → Long-stay folio {folio_number} created with balance ${balance}.")


PACK_HANDLERS = {
    "core": seed_core_pack,
    "bookings": seed_bookings_pack,
    "financial": seed_financial_pack,
}


def main() -> None:
    args = parse_args()
    conn = get_db_connection()

    if args.truncate:
        truncate_public_tables(conn)

    packs: Iterable[str]
    if args.pack == "all":
        packs = ("core", "bookings", "financial")
    else:
        packs = (args.pack,)

    for pack in packs:
        PACK_HANDLERS[pack](conn)

    conn.close()
    print("\n✅ Sample data packs finished.")


if __name__ == "__main__":
    main()
