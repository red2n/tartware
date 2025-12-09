# QA Data Packs

Targeted sample datasets for QA engineers who need realistic fixtures without loading the full 25k-record demo set. Each pack runs the familiar Python loaders with small counts and then injects domain-specific anomalies.

## Available Packs

| Pack | Focus | Notable Scenarios |
| --- | --- | --- |
| `core` | Tenants, users, properties, room inventory | Clean multi-tenant foundation with rates/rooms for smoke tests |
| `bookings` | Reservations, CRM flows | Two forced double-bookings for the same room and stay window |
| `financial` | Folios, payments, postings | 60-night folio with partial payments + oversized balance for stress tests |

## Usage

```bash
# Run from repo root
scripts/data/packs/seed_pack.py --pack bookings

# Wipe tenant data (keeps setting catalog) and seed all packs
scripts/data/packs/seed_pack.py --truncate --pack all
```

The script automatically:

1. Resets the in-memory `data_store` before each pack so inserts reference fresh IDs.
2. Calls the existing modular loaders with trimmed counts.
3. Injects anomaly records (double bookings / long-stay folios) using deterministic metadata.
4. Writes helpful console output summarizing what was created.

> **Heads-up:** The packs append data to whatever is already in your database unless you pass `--truncate`. Use them on disposable QA databases or after running `setup-database.sh`.

## Where to Look

- Double bookings land in `reservations.metadata->>'scenario' = 'double_booking_pack'`
- Long-stay folios carry `notes` that contain `QA anomaly`
- Markdown verification reports land in `reports/table-verification/` (see `scripts/tools/table-verification-report.sh`)
