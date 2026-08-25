#!/usr/bin/env bash
# Seed per-tenant aggregates for the multi-tenant full-flow load test.
#
# Two things make this tenant-scoped rather than a flat pool:
#
#   1. Authorisation. A user is authorised per tenant, so the seeded
#      `setup.admin` can only write to its own. Every command sent to another
#      tenant is refused, which is why each tenant's own owner has to log in —
#      the same thing test-concurrent-50-tenants.sh does.
#   2. Foreign keys. `fk_reservations_tenant_guest_id` is composite on
#      (tenant_id, guest_id), so a guest belonging to tenant A cannot be booked
#      under tenant B.
#
# The manifest therefore carries, per tenant: its token, its property, and only
# the ids that tenant owns.
#
# Usage: ./loadtest/seed-multi-tenant-flow.sh [guests-per-tenant] [reservations-per-tenant] [gateway]
# Output: /tmp/tartware-flow-manifest.json

set -uo pipefail

GUESTS_PER="${1:-20}"
RES_PER="${2:-20}"
GW="${3:-http://localhost:8085}"
MANIFEST="/tmp/tartware-flow-manifest.json"
TOKENS="/tmp/tartware-tenant-tokens.tsv"
PSQL=(env PGPASSWORD=postgres psql -h 127.0.0.1 -p 5432 -U postgres -d tartware -t -A)

login() { # <username> <password>
  curl -s -m 15 -X POST "$GW/v1/auth/login" \
    -H 'Content-Type: application/json' \
    -d "$(printf '{"username":"%s","password":"%s"}' "$1" "$2")" |
    python3 -c "import sys,json
try: print(json.load(sys.stdin).get('access_token',''))
except Exception: print('')"
}

post() { # <token> <command> <json>
  curl -s -o /dev/null -m 20 -X POST "$GW/v1/commands/$2/execute" \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $1" \
    -H "Idempotency-Key: $(cat /proc/sys/kernel/random/uuid)" \
    -d "$3"
}

# ── Collect a token per tenant ────────────────────────────────────────────
: > "$TOKENS"
mapfile -t ROWS < <("${PSQL[@]}" -c \
  "SELECT t.id || E'\t' || p.id || E'\t' || COALESCE(t.slug,'') FROM tenants t JOIN properties p ON p.tenant_id = t.id ORDER BY t.created_at;")

echo "tenants with a property: ${#ROWS[@]}"

for row in "${ROWS[@]}"; do
  IFS=$'\t' read -r TID PID SLUG <<< "$row"
  if [[ "$SLUG" =~ ^lt-tenant-0*([0-9]+)$ ]]; then
    IDX="${BASH_REMATCH[1]}"
    TOK=$(login "lt${IDX}.admin" "LoadTest${IDX}!Aa9x")
  else
    TOK=$(login "setup.admin" "TempPass1234")
  fi
  [ -n "$TOK" ] && printf '%s\t%s\t%s\n' "$TID" "$PID" "$TOK" >> "$TOKENS"
done
echo "tenants authenticated: $(wc -l < "$TOKENS")"

# ── Guests ────────────────────────────────────────────────────────────────
echo "seeding $GUESTS_PER guests per tenant..."
n=0
while IFS=$'\t' read -r TID PID TOK; do
  for g in $(seq 1 "$GUESTS_PER"); do
    BODY=$(printf '{"tenant_id":"%s","payload":{"first_name":"G%s","last_name":"Seed","email":"g%s-%s@seed.test","phone":"+15550000000"}}' \
      "$TID" "$g" "${TID:0:8}" "$g")
    post "$TOK" guest.register "$BODY" &
    n=$((n + 1))
    if (( n % 60 == 0 )); then wait; fi
  done
done < "$TOKENS"
wait

echo "waiting for guests to be applied..."
TARGET=$(( $(wc -l < "$TOKENS") * GUESTS_PER / 2 ))
for _ in $(seq 1 90); do
  C=$("${PSQL[@]}" -c "SELECT count(*) FROM guests;")
  [ "$C" -ge "$TARGET" ] && break
  sleep 2
done
echo "  guests: $C"

# ── Reservations ──────────────────────────────────────────────────────────
echo "seeding $RES_PER reservations per tenant..."
n=0
while IFS=$'\t' read -r TID PID TOK; do
  mapfile -t GIDS < <("${PSQL[@]}" -c "SELECT id FROM guests WHERE tenant_id='$TID' LIMIT 50;")
  [ "${#GIDS[@]}" -gt 0 ] || continue
  RT=$("${PSQL[@]}" -c "SELECT id FROM room_types WHERE tenant_id='$TID' LIMIT 1;")
  [ -n "$RT" ] || RT="44444444-4444-4444-4444-444444444444"
  for r in $(seq 1 "$RES_PER"); do
    GID="${GIDS[$((RANDOM % ${#GIDS[@]}))]}"
    D=$((1 + RANDOM % 25))
    OUT=$((D + 2))
    AMT=$((150 + RANDOM % 400))
    BODY=$(printf '{"tenant_id":"%s","payload":{"property_id":"%s","room_type_id":"%s","guest_id":"%s","check_in_date":"2026-11-%02d","check_out_date":"2026-11-%02d","adults":2,"children":0,"rate_code":"BAR","total_amount":%d.00}}' \
      "$TID" "$PID" "$RT" "$GID" "$D" "$OUT" "$AMT")
    post "$TOK" reservation.create "$BODY" &
    n=$((n + 1))
    if (( n % 60 == 0 )); then wait; fi
  done
done < "$TOKENS"
wait

echo "waiting for reservations to be applied..."
RTARGET=$(( $(wc -l < "$TOKENS") * RES_PER / 4 ))
for _ in $(seq 1 90); do
  R=$("${PSQL[@]}" -c "SELECT count(*) FROM reservations;")
  [ "$R" -ge "$RTARGET" ] && break
  sleep 2
done
echo "  reservations: $R"

# ── Manifest ──────────────────────────────────────────────────────────────
"${PSQL[@]}" -c "
  SELECT json_agg(row_to_json(x))::text FROM (
    SELECT
      t.id::text AS \"tenantId\",
      p.id::text AS \"propertyId\",
      COALESCE((SELECT json_agg(g.id) FROM (SELECT id FROM guests WHERE tenant_id = t.id LIMIT 60) g), '[]'::json) AS \"guestIds\",
      COALESCE((SELECT json_agg(r.id) FROM (SELECT id FROM reservations WHERE tenant_id = t.id LIMIT 60) r), '[]'::json) AS \"reservationIds\",
      COALESCE((SELECT json_agg(rm.id) FROM (SELECT id FROM rooms WHERE tenant_id = t.id LIMIT 30) rm), '[]'::json) AS \"roomIds\",
      COALESCE((SELECT rt.id::text FROM room_types rt WHERE rt.tenant_id = t.id LIMIT 1), '44444444-4444-4444-4444-444444444444') AS \"roomTypeId\"
    FROM tenants t JOIN properties p ON p.tenant_id = t.id
  ) x;" > "$MANIFEST.raw"

# Splice each tenant's token into its manifest entry.
python3 - "$MANIFEST.raw" "$TOKENS" "$MANIFEST" <<'PY'
import json, sys
raw, tokens_path, out = sys.argv[1], sys.argv[2], sys.argv[3]
entries = json.load(open(raw)) or []
tokens = {}
for line in open(tokens_path):
    parts = line.rstrip("\n").split("\t")
    if len(parts) == 3:
        tokens[parts[0]] = parts[2]
kept = []
for entry in entries:
    token = tokens.get(entry["tenantId"])
    # A tenant with no token cannot be driven, and one with no reservations
    # would make most of the command mix fail its foreign key.
    if token and entry.get("reservationIds"):
        entry["token"] = token
        kept.append(entry)
json.dump(kept, open(out, "w"))
print(f"manifest tenants: {len(kept)} of {len(entries)}")
PY
rm -f "$MANIFEST.raw"
echo "wrote $MANIFEST"
