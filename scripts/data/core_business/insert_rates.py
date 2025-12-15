"""Seed deterministic BAR and RACK rate plans for every property."""

from datetime import datetime, date

from data_store import data_store
from db_config import generate_uuid

DEFAULT_RATE_PLANS = [
    {
        "rate_name": "Best Available Rate",
        "rate_code": "BAR",
        "strategy": "DYNAMIC",
        "multiplier": 1.0,
    },
    {
        "rate_name": "Rack Rate",
        "rate_code": "RACK",
        "strategy": "FIXED",
        "multiplier": 1.15,
    },
]


def insert_rates(conn, count_per_property=None):
    """Insert BAR and RACK plans per property to support fallback pricing."""

    print("\n✓ Seeding default BAR/RACK rate plans...")
    cur = conn.cursor()

    cur.execute("DELETE FROM rates;")
    data_store["rates"].clear()
    conn.commit()

    today = date.today()
    now = datetime.utcnow()
    count = 0

    for property in data_store["properties"]:
        property_room_types = [
            rt for rt in data_store["room_types"] if rt["property_id"] == property["id"]
        ]
        if not property_room_types:
            continue

        # Use the first room type as the default association for BAR/RACK
        default_room_type = property_room_types[0]
        base_price = default_room_type.get("base_price") or 150.0

        for template in DEFAULT_RATE_PLANS:
            rate_id = generate_uuid()
            base_rate = round(base_price * template["multiplier"], 2)

            cur.execute(
                """
                INSERT INTO rates (
                    id,
                    tenant_id,
                    property_id,
                    room_type_id,
                    rate_name,
                    rate_code,
                    base_rate,
                    strategy,
                    status,
                    valid_from,
                    valid_until,
                    created_at
                ) VALUES (
                    %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s
                )
                """,
                (
                    rate_id,
                    property["tenant_id"],
                    property["id"],
                    default_room_type["id"],
                    template["rate_name"],
                    template["rate_code"],
                    base_rate,
                    template["strategy"],
                    "ACTIVE",
                    today,
                    None,
                    now,
                ),
            )

            data_store["rates"].append(
                {
                    "id": rate_id,
                    "property_id": property["id"],
                    "tenant_id": property["tenant_id"],
                    "room_type_id": default_room_type["id"],
                    "rate_code": template["rate_code"],
                }
            )
            count += 1

    conn.commit()
    print(f"   → Inserted {count} default rate plans (BAR/RACK)")
