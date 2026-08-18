#!/usr/bin/env bash
###############################################################################
# smoke-events.sh — live write-path smoke test for function space.
#
# Covers ui-gaps/13-sales-catering.md slices 1 (meeting rooms) and 2 (event
# bookings). Everything goes through the API gateway on :8080, because the
# gateway's own routing for these paths is part of what is under test — the
# wildcard there was GET-only and swallowed every write.
#
# Needs the dev stack up (pnpm run dev). No direct SQL, per the house rule in
# executables/test-accounts-realdata: it creates its own room with a run-unique
# code, then cancels the bookings and retires the rooms it made. Rows are left
# behind in a cancelled/retired state rather than deleted, so re-runs are safe
# but the tables do grow.
#
# Note: right after a core-service restart the gateway's circuit breaker can
# still be open and the first write returns 503. Re-run; it is not a code fault.
###############################################################################
set -uo pipefail
cd "$(dirname "$0")/.."

GW="${GW:-http://localhost:8080}"
TOKEN=$(./http_test/get-token.sh 2>/dev/null)
TID="${TENANT_ID:-11111111-1111-1111-1111-111111111111}"
PID="${PROPERTY_ID:-22222222-2222-2222-2222-222222222222}"
RESP=$(mktemp)
SUFFIX=$(date +%y%m%d-%H%M%S)
ROOM_CODE="SMOKE-$SUFFIX"
ROOM_CODE2="SMOKE2-$SUFFIX"
# Dates far enough out that they never collide with seeded demo data.
D1="2027-03-01"; D2="2027-03-02"; D3="2027-03-03"

PASS=0; FAIL=0
declare -a FAILURES=()
declare -a CREATED_EVENTS=()

uuid() { cat /proc/sys/kernel/random/uuid; }

req() { # method url [body] -> echoes http code, body lands in $RESP
  local m="$1" url="$2" body="${3:-}"
  if [[ -n "$body" ]]; then
    curl -s -o "$RESP" -w "%{http_code}" -X "$m" "$url" \
      -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
      -H "Idempotency-Key: $(uuid)" -d "$body"
  else
    curl -s -o "$RESP" -w "%{http_code}" -X "$m" "$url" \
      -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: $(uuid)"
  fi
}

check() { # label expected actual
  if [[ "$2" == "$3" ]]; then
    printf '  ✅ %-56s %s\n' "$1" "$3"; PASS=$((PASS+1))
  else
    printf '  ❌ %-56s expected %s got %s\n' "$1" "$2" "$3"
    printf '        %s\n' "$(head -c 300 "$RESP")"
    FAIL=$((FAIL+1)); FAILURES+=("$1 (expected $2, got $3)")
  fi
}

echo "═══════════════════════════════════════════════════════════════"
echo "  FUNCTION SPACE WRITE-PATH SMOKE TEST  ($ROOM_CODE)"
echo "═══════════════════════════════════════════════════════════════"

echo
echo "── MEETING ROOMS (slice 1) ──"

ROOM_BODY=$(cat <<JSON
{"tenant_id":"$TID","property_id":"$PID","room_code":"$ROOM_CODE",
 "room_name":"Smoke Test Ballroom","room_type":"BALLROOM","max_capacity":300,
 "theater_capacity":300,"banquet_capacity":200,"area_sqm":420.5,
 "has_natural_light":true,"has_audio_visual":true,"has_wifi":true,
 "default_setup":"BANQUET","setup_time_minutes":60,"teardown_time_minutes":45,
 "hourly_rate":250,"full_day_rate":1800,"currency_code":"USD",
 "operating_hours_start":"07:00","operating_hours_end":"23:00"}
JSON
)
code=$(req POST "$GW/v1/meeting-rooms" "$ROOM_BODY")
check "POST /v1/meeting-rooms creates" 201 "$code"
ROOM_ID=$(jq -r '.data.room_id // empty' "$RESP")
[[ -n "$ROOM_ID" ]] || { echo "FATAL: no room_id — cannot continue"; exit 1; }

code=$(req POST "$GW/v1/meeting-rooms" "$ROOM_BODY")
check "POST duplicate room_code → conflict" 409 "$code"

code=$(req GET "$GW/v1/meeting-rooms?tenant_id=$TID&property_id=$PID")
check "GET /v1/meeting-rooms list" 200 "$code"
found=$(jq -r --arg c "$ROOM_CODE" '(if type=="array" then . else (.data // []) end) | map(select(.room_code==$c)) | length' "$RESP")
check "  new room present in list" 1 "$found"

code=$(req GET "$GW/v1/meeting-rooms/$ROOM_ID?tenant_id=$TID")
check "GET /v1/meeting-rooms/:roomId detail" 200 "$code"

code=$(req PUT "$GW/v1/meeting-rooms/$ROOM_ID" \
  "{\"tenant_id\":\"$TID\",\"max_capacity\":350,\"room_name\":\"Smoke Test Grand Ballroom\"}")
check "PUT /v1/meeting-rooms/:roomId updates" 200 "$code"
check "  max_capacity persisted" 350 "$(jq -r '.data.max_capacity // empty' "$RESP")"

echo
echo "── EVENT BOOKINGS (slice 2) ──"

mk_event() { # name date start end [extra-json]
  cat <<JSON
{"tenant_id":"$TID","property_id":"$PID","event_name":"$1",
 "event_type":"CONFERENCE","meeting_room_id":"$ROOM_ID","event_date":"$2",
 "start_time":"$3","end_time":"$4","organizer_name":"Smoke Organizer",
 "organizer_email":"smoke@example.com","expected_attendees":120,
 "setup_type":"THEATER","currency_code":"USD","rental_rate":1800
 ${5:+,$5}}
JSON
}

remember_event() { # captures the id from $RESP for cleanup
  local id
  id=$(jq -r '.data.event_id // empty' "$RESP")
  [[ -n "$id" ]] && CREATED_EVENTS+=("$id")
}

code=$(req POST "$GW/v1/event-bookings" "$(mk_event 'Smoke Event A' "$D1" 09:00 12:00)")
check "POST /v1/event-bookings creates" 201 "$code"
EVENT_A=$(jq -r '.data.event_id // empty' "$RESP"); remember_event
check "  defaults to TENTATIVE" TENTATIVE "$(jq -r '.data.booking_status // empty' "$RESP")"
[[ -n "$EVENT_A" ]] || { echo "FATAL: no event_id — cannot continue"; exit 1; }

code=$(req POST "$GW/v1/event-bookings" "$(mk_event 'Smoke Overlap' "$D1" 11:00 13:00)")
check "overlapping booking → conflict" 409 "$code"

code=$(req POST "$GW/v1/event-bookings" "$(mk_event 'Smoke Adjacent' "$D1" 12:00 14:00)")
check "adjacent booking allowed (half-open window)" 201 "$code"; remember_event

code=$(req POST "$GW/v1/event-bookings" "$(mk_event 'Smoke Teardown' "$D2" 09:00 12:00 '"teardown_end_time":"12:30"')")
check "booking with teardown window created" 201 "$code"; remember_event

code=$(req POST "$GW/v1/event-bookings" "$(mk_event 'Smoke In Teardown' "$D2" 12:00 13:00)")
check "booking inside teardown window → conflict" 409 "$code"

code=$(req POST "$GW/v1/event-bookings" "$(mk_event 'Smoke Setup' "$D3" 14:00 16:00 '"setup_start_time":"13:00"')")
check "booking with setup window created" 201 "$code"
EVENT_SU=$(jq -r '.data.event_id // empty' "$RESP"); remember_event

code=$(req POST "$GW/v1/event-bookings" "$(mk_event 'Smoke In Setup' "$D3" 12:30 13:30)")
check "booking inside setup window → conflict" 409 "$code"

echo
echo "── LIFECYCLE ──"
code=$(req POST "$GW/v1/event-bookings/$EVENT_A/status" "{\"tenant_id\":\"$TID\",\"booking_status\":\"DEFINITE\"}")
check "TENTATIVE → DEFINITE" 200 "$code"

code=$(req POST "$GW/v1/event-bookings/$EVENT_A/status" "{\"tenant_id\":\"$TID\",\"booking_status\":\"CONFIRMED\"}")
check "DEFINITE → CONFIRMED" 200 "$code"
stamped=$(jq -r 'if (.data.confirmed_date // null) != null then "ok" else "missing" end' "$RESP")
check "  confirmed_date stamped" ok "$stamped"

code=$(req POST "$GW/v1/event-bookings/$EVENT_A/status" "{\"tenant_id\":\"$TID\",\"booking_status\":\"INQUIRY\"}")
check "CONFIRMED → INQUIRY illegal → conflict" 409 "$code"

echo
echo "── UPDATE ──"
code=$(req PUT "$GW/v1/event-bookings/$EVENT_A" \
  "{\"tenant_id\":\"$TID\",\"expected_attendees\":150,\"special_requests\":\"Smoke test note\"}")
check "PUT /v1/event-bookings/:eventId updates" 200 "$code"
check "  expected_attendees persisted" 150 "$(jq -r '.data.expected_attendees // empty' "$RESP")"

code=$(req PUT "$GW/v1/event-bookings/$EVENT_A" "{\"tenant_id\":\"$TID\",\"end_time\":\"13:00\"}")
check "PUT extending into the neighbour → conflict" 409 "$code"

echo
echo "── CANCELLATION RELEASES THE SPACE ──"
code=$(req POST "$GW/v1/event-bookings/$EVENT_SU/status" \
  "{\"tenant_id\":\"$TID\",\"booking_status\":\"CANCELLED\",\"cancellation_reason\":\"smoke test\"}")
check "CANCELLED accepted" 200 "$code"

code=$(req POST "$GW/v1/event-bookings" "$(mk_event 'Smoke Rebook' "$D3" 14:00 16:00 '"setup_start_time":"13:00"')")
check "rebooking the cancelled slot allowed" 201 "$code"; remember_event

echo
echo "── READS ──"
code=$(req GET "$GW/v1/event-bookings?tenant_id=$TID&meeting_room_id=$ROOM_ID")
check "GET /v1/event-bookings list" 200 "$code"

code=$(req GET "$GW/v1/event-bookings/$EVENT_A?tenant_id=$TID")
check "GET /v1/event-bookings/:eventId detail" 200 "$code"

code=$(req GET "$GW/v1/event-bookings?tenant_id=$TID&booking_status=confirmed&meeting_room_id=$ROOM_ID")
check "list filter booking_status=confirmed (lowercase in)" 200 "$code"
confirmed=$(jq -r '(if type=="array" then . else (.data // []) end) | map(select(.booking_status=="CONFIRMED")) | length' "$RESP")
check "  filter returns the confirmed booking" 1 "$confirmed"

echo
echo "── ROOM RETIREMENT ──"
code=$(req POST "$GW/v1/meeting-rooms" \
  "{\"tenant_id\":\"$TID\",\"property_id\":\"$PID\",\"room_code\":\"$ROOM_CODE2\",\"room_name\":\"Smoke Throwaway\",\"room_type\":\"BOARDROOM\",\"max_capacity\":12}")
check "POST second meeting room" 201 "$code"
ROOM_ID2=$(jq -r '.data.room_id // empty' "$RESP")

code=$(req DELETE "$GW/v1/meeting-rooms/$ROOM_ID2?tenant_id=$TID")
check "DELETE /v1/meeting-rooms/:roomId retires" 200 "$code"

code=$(req DELETE "$GW/v1/meeting-rooms/$ROOM_ID2?tenant_id=$TID")
check "DELETE again → not found" 404 "$code"

echo
echo "── CLEANUP ──"
for id in "${CREATED_EVENTS[@]}"; do
  req POST "$GW/v1/event-bookings/$id/status" \
    "{\"tenant_id\":\"$TID\",\"booking_status\":\"CANCELLED\",\"cancellation_reason\":\"smoke test cleanup\"}" >/dev/null
done
req DELETE "$GW/v1/meeting-rooms/$ROOM_ID?tenant_id=$TID" >/dev/null
echo "  cancelled ${#CREATED_EVENTS[@]} bookings, retired $ROOM_CODE"

echo
echo "═══════════════════════════════════════════════════════════════"
echo "  $PASS passed, $FAIL failed"
if ((FAIL)); then printf '  ❌ %s\n' "${FAILURES[@]}"; fi
echo "═══════════════════════════════════════════════════════════════"
exit $((FAIL > 0))
