#!/usr/bin/env bash
###############################################################################
# smoke-events.sh — live write-path smoke test for function space.
#
# Covers ui-gaps/13-sales-catering.md slices 1 (meeting rooms), 2 (event
# bookings) and 3 (banquet orders). Everything goes through the API gateway on
# :8080, because the gateway's own routing for these paths is part of what is
# under test — the wildcard there was GET-only and swallowed every write.
#
# Needs the dev stack up (pnpm run dev). No direct SQL, per the house rule in
# executables/test-accounts-realdata: it creates its own room with a run-unique
# code, then cancels the bookings and retires the rooms it made. Rows are left
# behind in a cancelled/retired state rather than deleted, so re-runs are safe
# but the tables do grow. BEOs have no delete or cancel route of their own, so
# the ones this script creates are simply left in place under their run-unique
# BEO numbers.
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
D4="2027-03-04"; D5="2027-03-05"; D6="2027-03-06"

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
echo "── MIDNIGHT-CROSSING (day-boundary convention) ──"
# event_bookings stores one event_date plus bare TIME columns, so until the
# convention landed a wedding running 18:00 → 01:00 was rejected by the table
# itself and had to be recorded as ending 23:59. An end at or before the start
# is now the next morning; only a zero-length window is impossible.
code=$(req POST "$GW/v1/event-bookings" "$(mk_event 'Smoke Wedding' "$D4" 18:00 01:00)")
check "event running past midnight created" 201 "$code"; remember_event

code=$(req POST "$GW/v1/event-bookings" "$(mk_event 'Smoke Zero Length' "$D5" 10:00 10:00)")
check "zero-length event → bad request" 400 "$code"

# The first double-booking check filtered on `event_date = $3` and compared bare
# times, so a booking anchored the next morning never met the one still running
# into it. These two assert the resolved-instant comparison that replaced it.
code=$(req POST "$GW/v1/event-bookings" "$(mk_event 'Smoke Small Hours' "$D5" 00:30 02:00)")
check "next-day booking inside the overnight window → conflict" 409 "$code"

code=$(req POST "$GW/v1/event-bookings" "$(mk_event 'Smoke After Wedding' "$D5" 01:00 03:00)")
check "next-day booking starting as it ends allowed (half-open)" 201 "$code"; remember_event

# A setup after start_time is the previous evening — the case the dropped
# event_bookings_setup_time_check refused outright.
code=$(req POST "$GW/v1/event-bookings" "$(mk_event 'Smoke Overnight Setup' "$D6" 00:30 04:00 '"setup_start_time":"22:00"')")
check "setup on the previous evening accepted" 201 "$code"; remember_event

code=$(req POST "$GW/v1/event-bookings" "$(mk_event 'Smoke Eve Clash' "$D5" 21:00 23:00)")
check "booking inside the previous-evening setup → conflict" 409 "$code"

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
echo "── BANQUET ORDERS (slice 3) ──"

mk_beo() { # extra-json
  cat <<JSON
{"tenant_id":"$TID","property_id":"$PID","event_booking_id":"$EVENT_A",
 "meeting_room_id":"$ROOM_ID","event_date":"$D1",
 "setup_start_time":"07:00","event_start_time":"09:00","event_end_time":"12:00",
 "teardown_end_time":"13:00","room_setup":"BANQUET","guaranteed_count":120,
 "expected_count":130,"menu_type":"PLATED","service_style":"PLATED",
 "menu_items":[{"name":"Chicken roulade","quantity":120}],
 "entrees":[{"name":"Chicken roulade"},{"name":"Wild mushroom risotto"}],
 "bar_type":"HOST_BAR","vegetarian_count":12,"gluten_free_count":4,
 "servers_count":10,"chefs_count":4,"food_subtotal":7200,"beverage_subtotal":2400,
 "currency_code":"USD","kitchen_instructions":"Nut-free kitchen for this event",
 "distribution_list":["kitchen@example.com","setup@example.com"]
 ${1:+,$1}}
JSON
}

code=$(req POST "$GW/v1/banquet-orders" "$(mk_beo)")
check "POST /v1/banquet-orders creates" 201 "$code"
BEO_V1=$(jq -r '.data.beo_id // empty' "$RESP")
BEO_NUMBER=$(jq -r '.data.beo_number // empty' "$RESP")
check "  born as DRAFT" DRAFT "$(jq -r '.data.beo_status // empty' "$RESP")"
check "  version 1" 1 "$(jq -r '.data.beo_version // empty' "$RESP")"
check "  not superseded" false "$(jq -r '.data.is_superseded' "$RESP")"
check "  JSONB round-trips as JSON not an array literal" "Chicken roulade" \
  "$(jq -r '.data.menu_items[0].name // empty' "$RESP")"
check "  TEXT[] round-trips" "kitchen@example.com" \
  "$(jq -r '.data.distribution_list[0] // empty' "$RESP")"
[[ -n "$BEO_V1" ]] || { echo "FATAL: no beo_id — cannot continue"; exit 1; }

code=$(req POST "$GW/v1/banquet-orders" \
  "$(mk_beo '"event_booking_id":"'"$(uuid)"'"')")
check "unknown event booking → not found" 404 "$code"

code=$(req POST "$GW/v1/banquet-orders" "$(mk_beo '"guaranteed_count":0')")
check "guaranteed_count 0 → bad request (CHECK mirrored in zod)" 400 "$code"

# An end at or before the start is the next morning, not an inverted window —
# the same day-boundary convention event_bookings uses. Zero-length is the only
# window `beo_time_check` still refuses.
code=$(req POST "$GW/v1/banquet-orders" "$(mk_beo '"event_end_time":"08:00"')")
check "overnight banquet (ends 08:00, starts 09:00) accepted" 201 "$code"

code=$(req POST "$GW/v1/banquet-orders" "$(mk_beo '"event_end_time":"09:00"')")
check "zero-length banquet → bad request" 400 "$code"

# Setup and teardown are deliberately NOT ordered against the event window: they
# are bare TIME columns with no date, so a teardown at 01:00 after a 23:30 finish
# is the next morning and any string comparison reads it as thirteen hours early.
# An earlier draft of slice 3 enforced the ordering and rejected the most ordinary
# banquet there is; these two assertions exist to keep that from coming back.
code=$(req POST "$GW/v1/banquet-orders" "$(mk_beo '"teardown_end_time":"01:00","event_end_time":"23:30","event_start_time":"18:00"')")
check "teardown past midnight accepted" 201 "$code"

code=$(req POST "$GW/v1/banquet-orders" "$(mk_beo '"setup_start_time":"10:00"')")
check "setup after start accepted (no table CHECK backs it)" 201 "$code"

echo
echo "── BEO EDIT WHILE DRAFT ──"
code=$(req PUT "$GW/v1/banquet-orders/$BEO_V1" \
  "{\"tenant_id\":\"$TID\",\"guaranteed_count\":140,\"chefs_count\":6,\"allergy_warnings\":\"Severe nut allergy on table 4\"}")
check "PUT /v1/banquet-orders/:beoId updates a draft" 200 "$code"
check "  guaranteed_count persisted" 140 "$(jq -r '.data.guaranteed_count // empty' "$RESP")"
check "  untouched field kept" "PLATED" "$(jq -r '.data.menu_type // empty' "$RESP")"

echo
echo "── PUBLISH FREEZES THE DOCUMENT ──"
code=$(req POST "$GW/v1/banquet-orders/$BEO_V1/publish" \
  "{\"tenant_id\":\"$TID\",\"notify_client\":true}")
check "POST /v1/banquet-orders/:beoId/publish" 200 "$code"
check "  status APPROVED" APPROVED "$(jq -r '.data.beo_status // empty' "$RESP")"
sent=$(jq -r 'if (.data.last_sent_to_kitchen // null) != null then "ok" else "missing" end' "$RESP")
check "  last_sent_to_kitchen stamped" ok "$sent"
sent=$(jq -r 'if (.data.last_sent_to_client // null) != null then "ok" else "missing" end' "$RESP")
check "  last_sent_to_client stamped (notify_client)" ok "$sent"

code=$(req PUT "$GW/v1/banquet-orders/$BEO_V1" "{\"tenant_id\":\"$TID\",\"guaranteed_count\":150}")
check "editing a published BEO → conflict" 409 "$code"

code=$(req POST "$GW/v1/banquet-orders/$BEO_V1/publish" "{\"tenant_id\":\"$TID\"}")
check "publishing twice → conflict" 409 "$code"

echo
echo "── REVISE PRODUCES A NEW VERSION ──"
code=$(req POST "$GW/v1/banquet-orders/$BEO_V1/revise" \
  "{\"tenant_id\":\"$TID\",\"revision_reason\":\"Client added a vegan main\"}")
check "POST /v1/banquet-orders/:beoId/revise" 201 "$code"
BEO_V2=$(jq -r '.data.beo_id // empty' "$RESP")
check "  version 2" 2 "$(jq -r '.data.beo_version // empty' "$RESP")"
check "  same beo_number" "$BEO_NUMBER" "$(jq -r '.data.beo_number // empty' "$RESP")"
check "  back to DRAFT" DRAFT "$(jq -r '.data.beo_status // empty' "$RESP")"
check "  previous_beo_id points at v1" "$BEO_V1" "$(jq -r '.data.previous_beo_id // empty' "$RESP")"
check "  revision_reason recorded" "Client added a vegan main" "$(jq -r '.data.revision_reason // empty' "$RESP")"
check "  content copied forward" 140 "$(jq -r '.data.guaranteed_count // empty' "$RESP")"
check "  JSONB copied forward" "Chicken roulade" "$(jq -r '.data.menu_items[0].name // empty' "$RESP")"
check "  approvals reset" null "$(jq -r '.data.last_sent_to_kitchen // "null"' "$RESP")"

code=$(req GET "$GW/v1/banquet-orders/$BEO_V1?tenant_id=$TID")
check "GET v1 after revision" 200 "$code"
check "  v1 now reads as superseded" true "$(jq -r '.data.is_superseded' "$RESP")"
check "  v1 kept the status it was issued under" APPROVED "$(jq -r '.data.beo_status // empty' "$RESP")"

code=$(req POST "$GW/v1/banquet-orders/$BEO_V1/revise" \
  "{\"tenant_id\":\"$TID\",\"revision_reason\":\"forking the chain\"}")
check "revising a superseded version → conflict" 409 "$code"

code=$(req PUT "$GW/v1/banquet-orders/$BEO_V2" \
  "{\"tenant_id\":\"$TID\",\"entrees\":[{\"name\":\"Chicken roulade\"},{\"name\":\"Vegan wellington\"}]}")
check "the new draft is editable again" 200 "$code"
check "  revised menu persisted" "Vegan wellington" "$(jq -r '.data.entrees[1].name // empty' "$RESP")"

code=$(req POST "$GW/v1/banquet-orders/$BEO_V2/publish" "{\"tenant_id\":\"$TID\"}")
check "publishing the revision" 200 "$code"

echo
echo "── BEO READS ──"
code=$(req GET "$GW/v1/banquet-orders?tenant_id=$TID&meeting_room_id=$ROOM_ID")
check "GET /v1/banquet-orders list" 200 "$code"
versions=$(jq -r --arg n "$BEO_NUMBER" '(if type=="array" then . else (.data // []) end) | map(select(.beo_number==$n)) | length' "$RESP")
check "  both versions listed under one number" 2 "$versions"

code=$(req GET "$GW/v1/banquet-orders?tenant_id=$TID&beo_status=APPROVED&meeting_room_id=$ROOM_ID")
check "list filter beo_status=APPROVED" 200 "$code"

code=$(req GET "$GW/v1/banquet-orders/$(uuid)?tenant_id=$TID")
check "unknown beo_id → not found" 404 "$code"

echo
echo "── EVENT BILLING (UI item 6) ──"
# Cross-service, so these are commands rather than HTTP routes: the booking is
# core-service's and the folio is billing-service's. Dispatch answers 202 and the
# work lands asynchronously, so every assertion below reads the booking back
# rather than trusting the response body.

# New commands seed as 'disabled' with requires_activation — that is the house
# convention for a capability nobody has turned on yet, so activate them the way
# an operator would rather than reaching into the table.
for cmd in billing.event.setup billing.event.post_charges; do
  code=$(req PATCH "$GW/v1/commands/$cmd/features" '{"status":"enabled"}')
  check "enable $cmd" 200 "$code"
done
# The gateway holds the command registry in memory and refreshes it on a timer
# (COMMAND_REGISTRY_REFRESH_MS, 30s by default), so the flag it was just told
# about is not the flag it is dispatching against yet. The first dispatch below
# retries through that window rather than asserting against a stale snapshot.

# A fully priced booking: 1800 rental + 250 setup + 400 equipment + 600 AV
# + 300 labour + 4200 F&B = 7550 subtotal; 20% service charge = 1510;
# less 550 discount = 8510 taxable; 10% tax = 851; total 9361.
BILL_EXTRA='"setup_fee":250,"equipment_rental_fee":400,"av_equipment_fee":600,"labor_charges":300,"estimated_food_beverage":4200,"service_charge_percent":20,"tax_rate":10,"discount_amount":550'
code=$(req POST "$GW/v1/event-bookings" "$(mk_event 'Smoke Billing' "$D6" 18:00 23:00 "$BILL_EXTRA")")
check "POST priced event booking" 201 "$code"
EVENT_BILL=$(jq -r '.data.event_id // empty' "$RESP"); remember_event
check "  starts unbilled" null "$(jq -r '.data.charges_posted_at // "null"' "$RESP")"
check "  starts with no folio" null "$(jq -r '.data.folio_id // "null"' "$RESP")"

# Poll the read model: `field` non-null means the consumer has landed the write.
wait_for_event_field() { # eventId jq-path
  for _ in $(seq 1 30); do
    req GET "$GW/v1/event-bookings/$1?tenant_id=$TID" >/dev/null
    local value
    value=$(jq -r "$2 // \"null\"" "$RESP")
    [[ "$value" != "null" && -n "$value" ]] && { echo "$value"; return 0; }
    sleep 0.5
  done
  echo "null"; return 1
}

for _ in $(seq 1 15); do
  code=$(req POST "$GW/v1/tenants/$TID/billing/events/$EVENT_BILL/folio" "{\"property_id\":\"$PID\"}")
  [[ "$code" != "409" ]] && break
  sleep 3
done
check "POST …/billing/events/:eventId/folio accepted" 202 "$code"
FOLIO_ID=$(wait_for_event_field "$EVENT_BILL" '.folio_id')
check "  folio linked back to the booking" 1 "$([[ "$FOLIO_ID" != "null" ]] && echo 1 || echo 0)"
check "  folio opens with a zero balance" 0 "$(jq -r '.folio_balance // "null"' "$RESP")"
check "  folio number is derived from the event" 1 \
  "$(jq -r '.folio_number | if . != null and startswith("EVT-") then 1 else 0 end' "$RESP")"

# Idempotent: a second setup adopts the folio that exists rather than opening
# another one for the same event.
code=$(req POST "$GW/v1/tenants/$TID/billing/events/$EVENT_BILL/folio" "{\"property_id\":\"$PID\"}")
check "second folio open accepted" 202 "$code"
sleep 2
req GET "$GW/v1/event-bookings/$EVENT_BILL?tenant_id=$TID" >/dev/null
check "  still the same folio" "$FOLIO_ID" "$(jq -r '.folio_id // "null"' "$RESP")"

code=$(req POST "$GW/v1/tenants/$TID/billing/events/$EVENT_BILL/charges" "{\"property_id\":\"$PID\"}")
check "POST …/billing/events/:eventId/charges accepted" 202 "$code"
# `charges_posted_at` is claimed *before* the first line posts — that is what
# makes a double dispatch safe — so waiting on it would read an empty folio.
# The balance settling is what says every line landed.
# Settle, not "started": the lines post one command at a time, so the balance is
# non-zero from the first of them. Waiting for two consecutive reads to agree is
# what distinguishes a folio mid-post from a finished one — the first cut of this
# broke on the rental line and read a three-line folio.
prev=""; settled=""
for _ in $(seq 1 40); do
  req GET "$GW/v1/event-bookings/$EVENT_BILL?tenant_id=$TID" >/dev/null
  cur=$(jq -r '.folio_balance // 0' "$RESP")
  if [[ "$cur" != "0" && "$cur" == "$prev" ]]; then settled="$cur"; break; fi
  prev="$cur"; sleep 0.5
done
check "  charges_posted_at stamped" 1 \
  "$([[ "$(jq -r '.charges_posted_at // "null"' "$RESP")" != "null" ]] && echo 1 || echo 0)"
check "  folio balance is the derived total" 9361 "$(jq -r '.folio_balance // "null"' "$RESP")"
check "  actual_total written back" 9361 "$(jq -r '.actual_total // "null"' "$RESP")"

code=$(req GET "$GW/v1/billing/charges?tenant_id=$TID&folio_id=$FOLIO_ID&limit=200")
check "GET /v1/billing/charges for the event folio" 200 "$code"
LINES=$(jq -r '(if type=="array" then . else (.data // []) end) | length' "$RESP")
check "  one posting per priced line" 9 "$LINES"
check "  rental posted under SPACE_RENTAL" 1800 \
  "$(jq -r '(if type=="array" then . else (.data // []) end) | map(select(.charge_code=="SPACE_RENTAL")) | .[0].total_amount // "null"' "$RESP")"
check "  service charge computed, not copied" 1510 \
  "$(jq -r '(if type=="array" then . else (.data // []) end) | map(select(.charge_code=="EVENT_SERVICE_CHARGE")) | .[0].total_amount // "null"' "$RESP")"
# The charge read model lowercases posting_type, as it does folio_status.
check "  discount posted as a credit" credit \
  "$(jq -r '(if type=="array" then . else (.data // []) end) | map(select(.charge_code=="EVENT_DISCOUNT")) | .[0].posting_type // "null"' "$RESP")"
check "  tax on the discounted base" 851 \
  "$(jq -r '(if type=="array" then . else (.data // []) end) | map(select(.charge_code=="EVENT_TAX")) | .[0].total_amount // "null"' "$RESP")"

# The post-once guard. Dispatch is asynchronous, so the gateway still answers
# 202 — what must not happen is a second set of postings on the folio.
code=$(req POST "$GW/v1/tenants/$TID/billing/events/$EVENT_BILL/charges" "{\"property_id\":\"$PID\"}")
check "second charge post accepted at the edge" 202 "$code"
sleep 5
req GET "$GW/v1/billing/charges?tenant_id=$TID&folio_id=$FOLIO_ID&limit=200" >/dev/null
check "  no second set of postings" "$LINES" \
  "$(jq -r '(if type=="array" then . else (.data // []) end) | length' "$RESP")"
req GET "$GW/v1/event-bookings/$EVENT_BILL?tenant_id=$TID" >/dev/null
check "  balance unchanged" 9361 "$(jq -r '.folio_balance // "null"' "$RESP")"

# An event with nothing priced has nothing to post — the handler refuses rather
# than opening a folio and leaving it empty.
code=$(req POST "$GW/v1/event-bookings" "$(mk_event 'Smoke Unpriced' "$D6" 08:00 09:00 '"rental_rate":0')")
check "POST unpriced event booking" 201 "$code"
EVENT_FREE=$(jq -r '.data.event_id // empty' "$RESP"); remember_event
code=$(req POST "$GW/v1/tenants/$TID/billing/events/$EVENT_FREE/charges" "{\"property_id\":\"$PID\"}")
check "unpriced charge post accepted at the edge" 202 "$code"
sleep 3
req GET "$GW/v1/event-bookings/$EVENT_FREE?tenant_id=$TID" >/dev/null
check "  nothing posted" null "$(jq -r '.charges_posted_at // "null"' "$RESP")"

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
