#!/usr/bin/env bash
# Seed the aggregates the full-flow load test operates on.
#
# Commands are asynchronous — a 202 means durably accepted, not applied — so a
# load scenario cannot create a guest and immediately book it. It has to work
# against aggregates that already exist, or every reservation fails its guest
# foreign key and the run measures nothing but rejection.
#
# This fires guest.register and reservation.create, waits for the consumers to
# apply them, and prints the resulting ids for GUEST_IDS / RESERVATION_IDS.
#
# Usage: ./loadtest/seed-flow-data.sh [gateway-url] [guest-count] [reservation-count]

set -euo pipefail

GW="${1:-http://localhost:8085}"
GUESTS="${2:-200}"
RESERVATIONS="${3:-400}"
TENANT="11111111-1111-1111-1111-111111111111"
PROPERTY="22222222-2222-2222-2222-222222222222"
ROOM_TYPE="44444444-4444-4444-4444-444444444444"
PSQL=(env PGPASSWORD=postgres psql -h 127.0.0.1 -p 5432 -U postgres -d tartware -t -A)

TOKEN=$(curl -s -m 15 -X POST "$GW/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"username":"setup.admin","password":"TempPass1234"}' |
  python3 -c "import sys,json;print(json.load(sys.stdin).get('access_token',''))")

if [ -z "$TOKEN" ]; then
  echo "login failed" >&2
  exit 1
fi

post_command() {
  curl -s -o /dev/null -m 15 -X POST "$GW/v1/commands/$1/execute" \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $TOKEN" \
    -H "Idempotency-Key: $(cat /proc/sys/kernel/random/uuid)" \
    -d "$2"
}

echo "seeding $GUESTS guests..."
for i in $(seq 1 "$GUESTS"); do
  post_command guest.register "$(printf '{"tenant_id":"%s","payload":{"first_name":"Seed%s","last_name":"Guest","email":"seed%s@example.com","phone":"+1555000%04d"}}' \
    "$TENANT" "$i" "$i" "$i")" &
  # Cap in-flight curls; the point is to seed quickly, not to load test here.
  if (( i % 40 == 0 )); then wait; fi
done
wait

# Consumers apply asynchronously, so poll for the rows rather than sleeping a
# guessed interval.
echo "waiting for guests to be applied..."
for _ in $(seq 1 60); do
  COUNT=$("${PSQL[@]}" -c "SELECT count(*) FROM guests;")
  [ "$COUNT" -ge "$((GUESTS / 2))" ] && break
  sleep 2
done
echo "  guests applied: $COUNT"

mapfile -t GUEST_ID_LIST < <("${PSQL[@]}" -c "SELECT id FROM guests LIMIT 500;")
if [ "${#GUEST_ID_LIST[@]}" -eq 0 ]; then
  echo "no guests were applied — check the guests-service consumer" >&2
  exit 1
fi

echo "seeding $RESERVATIONS reservations..."
for i in $(seq 1 "$RESERVATIONS"); do
  GID="${GUEST_ID_LIST[$((RANDOM % ${#GUEST_ID_LIST[@]}))]}"
  IN=$((1 + RANDOM % 60))
  post_command reservation.create "$(printf '{"tenant_id":"%s","payload":{"property_id":"%s","room_type_id":"%s","guest_id":"%s","check_in_date":"2026-%02d-%02d","check_out_date":"2026-%02d-%02d","adults":2,"children":0,"rate_code":"BAR","total_amount":%d.00}}' \
    "$TENANT" "$PROPERTY" "$ROOM_TYPE" "$GID" \
    $((10 + IN / 28)) $((1 + IN % 28)) $((10 + (IN + 2) / 28)) $((1 + (IN + 2) % 28)) \
    $((150 + RANDOM % 500)))" &
  if (( i % 40 == 0 )); then wait; fi
done
wait

echo "waiting for reservations to be applied..."
for _ in $(seq 1 60); do
  RCOUNT=$("${PSQL[@]}" -c "SELECT count(*) FROM reservations;")
  [ "$RCOUNT" -ge "$((RESERVATIONS / 4))" ] && break
  sleep 2
done
echo "  reservations applied: $RCOUNT"

{
  echo "GUEST_IDS=$("${PSQL[@]}" -c "SELECT string_agg(id::text, ',') FROM (SELECT id FROM guests LIMIT 500) g;")"
  echo "RESERVATION_IDS=$("${PSQL[@]}" -c "SELECT string_agg(id::text, ',') FROM (SELECT id FROM reservations LIMIT 500) r;")"
  echo "ROOM_IDS=$("${PSQL[@]}" -c "SELECT string_agg(id::text, ',') FROM (SELECT id FROM rooms LIMIT 200) r;")"
} > /tmp/tartware-flow-ids.env

echo "wrote /tmp/tartware-flow-ids.env"
