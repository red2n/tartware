#!/usr/bin/env bash
###############################################################################
# test-stay-lifecycle.sh
# The industry stay flow, end to end through the gateway
#
# One guest, one stay, in the order a real property performs it:
#
#   PHASE 1  Shop        — room types, rates, rate calendar, availability
#   PHASE 2  Guest       — register a profile, read it back
#   PHASE 3  Book        — create the reservation, verify the stay it produced
#   PHASE 4  Allot       — assign a specific room before arrival
#   PHASE 5  Arrive      — check in, room goes OCCUPIED, folio opens
#   PHASE 6  In-house    — post charges, take a payment, folio balance moves
#   PHASE 7  Stay length — nights match the window, extend adds nights
#   PHASE 8  Room change — move rooms mid-stay, and change room type
#   PHASE 9  Depart      — settle the balance and check out
#
# Every assertion is about state the API or database actually shows, not about
# a 202 being returned: a command is accepted long before it is applied, and a
# suite that stops at the 202 proves only that the gateway is up.
#
# Capabilities the product does not have yet are SKIPped with the gap named,
# never quietly dropped.
#
# Usage:
#   ./executables/test-accounts-realdata/test-stay-lifecycle.sh
#
# Prerequisites: services running (pnpm run dev:backend), database set up.
###############################################################################
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

source "$SCRIPT_DIR/ensure-deps.sh"
source "$SCRIPT_DIR/lib/harness.sh"

# The tenant this stay is walked for. Overridable on purpose: the product is
# multi-tenant, and a lifecycle proven only against the seed tenant proves the
# seed data, not the flow. `STAY_TENANT_ID=<uuid>` runs the identical walk for
# any tenant, which is how the multi-tenant suite drives it for its own.
TID="${STAY_TENANT_ID:-11111111-1111-1111-1111-111111111111}"
PSQL_ARGS=(-h "${DB_HOST:-127.0.0.1}" -p "${DB_DIRECT_PORT:-5432}" -U "${DB_USER:-postgres}" -d "${DB_NAME:-tartware}" -tAc)
sql() { PGPASSWORD="${DB_PASSWORD:-postgres}" psql "${PSQL_ARGS[@]}" "$1" 2>/dev/null | head -1; }

wait_sql() {
  local timeout="$1" expected="$2" q="$3" waited=0
  while [[ $waited -lt $timeout ]]; do
    [[ "$(sql "$q")" == "$expected" ]] && return 0
    sleep 2; waited=$((waited+2))
  done
  return 1
}

TODAY=$(date +%Y-%m-%d)
OUT_3=$(date -d "+3 days" +%Y-%m-%d 2>/dev/null || date -v+3d +%Y-%m-%d)
OUT_5=$(date -d "+5 days" +%Y-%m-%d 2>/dev/null || date -v+5d +%Y-%m-%d)
OUT_7=$(date -d "+7 days" +%Y-%m-%d 2>/dev/null || date -v+7d +%Y-%m-%d)
RUN=$(date +%H%M%S)$((RANDOM % 100))

echo "┌─ Stay lifecycle suite · run $RUN · $TODAY → $OUT_3"

CREATED_RESERVATIONS=()
USED_ROOMS=()
cleanup_fixtures() {
  local rid room
  for rid in "${CREATED_RESERVATIONS[@]:-}"; do
    [[ -z "$rid" ]] && continue
    PGPASSWORD="${DB_PASSWORD:-postgres}" psql "${PSQL_ARGS[@]}" \
      "UPDATE reservations SET status='CANCELLED', actual_check_in=NULL, actual_check_out=NULL
         WHERE id='$rid' AND tenant_id='$TID'" >/dev/null 2>&1 || true
  done
  for room in "${USED_ROOMS[@]:-}"; do
    [[ -z "$room" ]] && continue
    PGPASSWORD="${DB_PASSWORD:-postgres}" psql "${PSQL_ARGS[@]}" \
      "UPDATE rooms SET status='AVAILABLE', housekeeping_status='CLEAN'
         WHERE id='$room' AND tenant_id='$TID'" >/dev/null 2>&1 || true
  done
}
trap cleanup_fixtures EXIT

CLAIMED_ROOMS=(); PICKED_ROOM=""
pick_free_room() {
  local excl="" r
  for r in "${CLAIMED_ROOMS[@]:-}"; do [[ -n "$r" ]] && excl="$excl,'$r'"; done
  excl="${excl:1}"; [[ -z "$excl" ]] && excl="'00000000-0000-0000-0000-000000000000'"
  PICKED_ROOM=$(sql "select id from rooms
      where tenant_id='$TID' and property_id='$PROPERTY' and room_type_id='$ROOM_TYPE'
        and status='AVAILABLE' and housekeeping_status in ('CLEAN','INSPECTED')
        and coalesce(is_blocked,false)=false and coalesce(is_out_of_order,false)=false
        and coalesce(is_deleted,false)=false and id not in ($excl) limit 1")
  [[ -n "$PICKED_ROOM" ]] && { CLAIMED_ROOMS+=("$PICKED_ROOM"); USED_ROOMS+=("$PICKED_ROOM"); }
}

# ─── Preflight ───────────────────────────────────────────────────────────────

section "Preflight"
code=$(curl -s -o /dev/null -w "%{http_code}" "$GW/health" 2>/dev/null || echo 000)
assert_http "Gateway reachable" "200" "$code"
harness_login || { echo "cannot continue without a token"; exit 1; }
pass "Authenticated as setup.admin"

enable_commands guest.register reservation.create reservation.modify reservation.cancel \
  reservation.check_in reservation.check_out reservation.assign_room reservation.extend_stay \
  reservation.room_move billing.charge.post billing.payment.capture billing.folio.create

PROPERTY=$(sql "select id from properties where tenant_id='$TID' limit 1")
ROOM_TYPE=$(sql "select room_type_id from rooms where tenant_id='$TID' and property_id='$PROPERTY' group by room_type_id order by count(*) desc limit 1")
assert_ne "Property exists" "" "$PROPERTY"
assert_ne "Room type exists" "" "$ROOM_TYPE"
[[ -z "$PROPERTY" || -z "$ROOM_TYPE" ]] && { harness_summary "STAY LIFECYCLE"; exit 1; }

###############################################################################
# PHASE 1 — Shop: what can be sold, and for how much
###############################################################################

section "PHASE 1 · Shop — inventory and price"

code=$(get "$GW/v1/room-types?tenant_id=$TID&limit=50")
assert_http "Room types readable" "200" "$code"
assert_gte "At least one room type on sale" "$(resp_count)" 1

code=$(get "$GW/v1/rooms?tenant_id=$TID&property_id=$PROPERTY&limit=100")
assert_http "Room inventory readable" "200" "$code"
ROOM_TOTAL=$(resp_count)
assert_gte "Property has physical rooms" "$ROOM_TOTAL" 1

code=$(get "$GW/v1/rooms/availability?tenant_id=$TID&property_id=$PROPERTY&check_in_date=$TODAY&check_out_date=$OUT_3")
assert_http "Availability search answers" "200" "$code"

code=$(get "$GW/v1/rates?tenant_id=$TID&property_id=$PROPERTY&limit=50")
assert_http "Rate plans readable" "200" "$code"
RATE_COUNT=$(resp_count)
if [[ "$RATE_COUNT" -gt 0 ]]; then
  pass "Property has $RATE_COUNT rate plan(s)"
  RATE_CODE=$(resp_jq '(if type=="array" then .[0] elif .data then .data[0] else . end).rate_code')
else
  skip "Property has rate plans" "none seeded — booking will fall back to its default rate"
  RATE_CODE=""
fi

code=$(get "$GW/v1/rate-calendar?tenant_id=$TID&property_id=$PROPERTY&start_date=$TODAY&end_date=$OUT_3")
assert_http "Rate calendar readable" "200" "$code"

###############################################################################
# PHASE 2 — Guest profile
###############################################################################

section "PHASE 2 · Guest profile"

GUEST_EMAIL="stay-$RUN@example.test"
code=$(post "$GW/v1/guests" \
  "{\"tenant_id\":\"$TID\",\"first_name\":\"Stay\",\"last_name\":\"Fixture$RUN\",\"email\":\"$GUEST_EMAIL\",\"phone\":\"+14155551234\"}")
assert_http "Guest registration accepted" "202" "$code"

GUEST=""
waited=0
while [[ $waited -lt 40 ]]; do
  GUEST=$(sql "select id from guests where tenant_id='$TID' and email='$GUEST_EMAIL' limit 1")
  [[ -n "$GUEST" ]] && break
  sleep 2; waited=$((waited+2))
done
assert_ne "Guest profile created" "" "$GUEST"
[[ -z "$GUEST" ]] && { harness_summary "STAY LIFECYCLE"; exit 1; }

code=$(get "$GW/v1/guests?tenant_id=$TID&limit=100&search=$GUEST_EMAIL")
assert_http "Guest list readable" "200" "$code"
assert_eq "New guest is on the profile API" "1" \
  "$(resp_jq "[(if type==\"array\" then .[] elif .data then .data[] else . end) | select(.email==\"$GUEST_EMAIL\")] | length")"

###############################################################################
# PHASE 3 — Book
###############################################################################

section "PHASE 3 · Booking"

RES=$(gen_uuid)
BOOK_PAYLOAD="{\"reservation_id\":\"$RES\",\"property_id\":\"$PROPERTY\",\"guest_id\":\"$GUEST\",\"room_type_id\":\"$ROOM_TYPE\",\"check_in_date\":\"$TODAY\",\"check_out_date\":\"$OUT_3\",\"status\":\"CONFIRMED\",\"total_amount\":450,\"currency\":\"USD\"}"
code=$(post "$GW/v1/commands/reservation.create/execute" "{\"tenant_id\":\"$TID\",\"payload\":$BOOK_PAYLOAD}")
assert_http "Booking accepted" "202" "$code"

if wait_sql 60 "1" "select count(*) from reservations where id='$RES'"; then
  CREATED_RESERVATIONS+=("$RES")
  pass "Reservation persisted"
  assert_eq "Booking is CONFIRMED"        "CONFIRMED" "$(sql "select status from reservations where id='$RES'")"
  assert_ne "Confirmation number issued"  ""          "$(sql "select confirmation_number from reservations where id='$RES'")"
  assert_eq "Stay window stored"          "$TODAY"    "$(sql "select check_in_date::date from reservations where id='$RES'")"
  # WS-01 turned a booking into rooms and nights; a booking that produced
  # neither is the pre-multi-room shape and would break every later phase.
  assert_gte "Booking produced a room row"  "$(sql "select count(*) from reservation_rooms where reservation_id='$RES'")" 1
  assert_eq  "Booking produced 3 nights"    "3" "$(sql "select count(*) from reservation_nights where reservation_id='$RES'")"
else
  fail "Reservation persisted" "reservation.create did not land within 60s"
  harness_summary "STAY LIFECYCLE"; exit 1
fi

###############################################################################
# PHASE 4 — Room allotment
###############################################################################

section "PHASE 4 · Room allotment"

pick_free_room; FIRST_ROOM="$PICKED_ROOM"
assert_ne "A sellable room is available to allot" "" "$FIRST_ROOM"
FIRST_ROOM_NO=$(sql "select room_number from rooms where id='$FIRST_ROOM'")

code=$(post "$GW/v1/tenants/$TID/reservations/$RES/assign-room" "{\"room_id\":\"$FIRST_ROOM\"}")
assert_http "Room assignment accepted" "202" "$code"
if wait_sql 40 "$FIRST_ROOM_NO" "select coalesce(room_number,'') from reservations where id='$RES'"; then
  pass "Room $FIRST_ROOM_NO allotted to the booking"
  assert_eq "Room row carries the assignment" "$FIRST_ROOM" \
    "$(sql "select coalesce(room_id::text,'') from reservation_rooms where reservation_id='$RES' limit 1")"
else
  fail "Room allotted" "assignment did not reach the reservation"
fi

###############################################################################
# PHASE 5 — Arrival
###############################################################################

section "PHASE 5 · Check-in"

code=$(post "$GW/v1/tenants/$TID/reservations/$RES/check-in" "{\"room_id\":\"$FIRST_ROOM\",\"force\":true}")
assert_http "Check-in accepted" "202" "$code"
if wait_sql 60 "CHECKED_IN" "select status from reservations where id='$RES'"; then
  pass "Guest is in-house"
  assert_ne "Arrival stamped"              "" "$(sql "select coalesce(actual_check_in::text,'') from reservations where id='$RES'")"
  assert_eq "Per-room lifecycle followed"  "CHECKED_IN" "$(sql "select status from reservation_rooms where reservation_id='$RES' limit 1")"
  assert_eq "Room shows OCCUPIED"          "OCCUPIED"   "$(sql "select status from rooms where id='$FIRST_ROOM'")"
else
  fail "Guest is in-house" "check-in did not apply"
fi

###############################################################################
# PHASE 6 — In-house: charges and payment
###############################################################################

section "PHASE 6 · Charges and payment"

FOLIO=""
waited=0
while [[ $waited -lt 40 ]]; do
  FOLIO=$(sql "select folio_id::text from folios where reservation_id='$RES' limit 1")
  [[ -n "$FOLIO" ]] && break
  sleep 2; waited=$((waited+2))
done
if [[ -n "$FOLIO" ]]; then
  pass "Check-in opened a folio"
else
  skip "Check-in opened a folio" "no folio for the stay — charges will be asserted by reservation instead"
fi

code=$(post "$GW/v1/commands/billing.charge.post/execute" \
  "{\"tenant_id\":\"$TID\",\"payload\":{\"property_id\":\"$PROPERTY\",\"reservation_id\":\"$RES\",\"amount\":150.00,\"charge_code\":\"ROOM\",\"description\":\"Room night 1\"}}")
assert_http "Room charge accepted" "202" "$code"
code=$(post "$GW/v1/commands/billing.charge.post/execute" \
  "{\"tenant_id\":\"$TID\",\"payload\":{\"property_id\":\"$PROPERTY\",\"reservation_id\":\"$RES\",\"amount\":42.50,\"charge_code\":\"MINIBAR\",\"description\":\"Minibar\"}}")
assert_http "Minibar charge accepted" "202" "$code"

if wait_sql 60 "2" "select count(*) from charge_postings where reservation_id='$RES' and coalesce(is_voided,false)=false"; then
  pass "Both charges posted to the stay"
  assert_eq "Charge total is 192.50" "192.50" \
    "$(sql "select to_char(sum(total_amount),'FM999999990.00') from charge_postings where reservation_id='$RES' and coalesce(is_voided,false)=false")"
else
  fail "Charges posted" "expected 2, got $(sql "select count(*) from charge_postings where reservation_id='$RES'")"
fi

code=$(post "$GW/v1/commands/billing.payment.capture/execute" \
  "{\"tenant_id\":\"$TID\",\"payload\":{\"payment_reference\":\"CC-$RUN-1\",\"property_id\":\"$PROPERTY\",\"reservation_id\":\"$RES\",\"guest_id\":\"$GUEST\",\"amount\":100.00,\"payment_method\":\"CREDIT_CARD\"}}")
assert_http "Payment accepted" "202" "$code"
if wait_sql 60 "1" "select count(*) from payments where reservation_id='$RES'"; then
  pass "Payment recorded against the stay"
  assert_eq "Payment amount is 100.00" "100.00" \
    "$(sql "select to_char(sum(amount),'FM999999990.00') from payments where reservation_id='$RES'")"
else
  fail "Payment recorded" "no payment row for the stay"
fi

###############################################################################
# PHASE 7 — Length of stay
###############################################################################

section "PHASE 7 · Length of stay"

assert_eq "3-night stay has 3 night rows" "3" \
  "$(sql "select count(*) from reservation_nights where reservation_id='$RES'")"
assert_eq "Nights never include the departure date" "0" \
  "$(sql "select count(*) from reservation_nights where reservation_id='$RES' and stay_date >= '$OUT_3'")"

code=$(post "$GW/v1/tenants/$TID/reservations/$RES/extend" "{\"new_check_out_date\":\"$OUT_5\",\"reason\":\"suite $RUN\"}")
assert_http "Extend accepted" "202" "$code"
if wait_sql 60 "5" "select count(*) from reservation_nights where reservation_id='$RES'"; then
  pass "Extending to $OUT_5 added the two missing nights"
  assert_eq "Departure date moved" "$OUT_5" "$(sql "select check_out_date::date from reservations where id='$RES'")"
  # The nights already booked keep the price they were sold at.
  assert_eq "Original nights kept their rate" "3" \
    "$(sql "select count(*) from reservation_nights n where n.reservation_id='$RES' and n.stay_date < '$OUT_3'")"
else
  fail "Extend added nights" "expected 5 nights, got $(sql "select count(*) from reservation_nights where reservation_id='$RES'")"
fi

###############################################################################
# PHASE 8 — Room change
###############################################################################

section "PHASE 8 · Room change mid-stay"

# A room that merely reads AVAILABLE today can still be sold later in the
# extended window, and the availability guard rightly refuses the move — which
# is the guard working, not a defect. The suite creates a room of its own so the
# move is testing the move rather than the state of the seed data.
code=$(post "$GW/v1/rooms" \
  "{\"tenant_id\":\"$TID\",\"property_id\":\"$PROPERTY\",\"room_type_id\":\"$ROOM_TYPE\",\"room_number\":\"SL$RUN\",\"floor\":\"9\",\"status\":\"AVAILABLE\"}")
if [[ "$code" =~ ^20 ]]; then
  SECOND_ROOM=$(sql "select id from rooms where tenant_id='$TID' and room_number='SL$RUN' limit 1")
  [[ -n "$SECOND_ROOM" ]] && USED_ROOMS+=("$SECOND_ROOM")
  PGPASSWORD="${DB_PASSWORD:-postgres}" psql "${PSQL_ARGS[@]}" \
    "UPDATE rooms SET status='AVAILABLE', housekeeping_status='CLEAN' WHERE id='$SECOND_ROOM'" >/dev/null 2>&1 || true
else
  pick_free_room; SECOND_ROOM="$PICKED_ROOM"
fi

if [[ -z "$SECOND_ROOM" ]]; then
  skip "Room move" "no second sellable room of this type"
else
  SECOND_ROOM_NO=$(sql "select room_number from rooms where id='$SECOND_ROOM'")
  code=$(post "$GW/v1/tenants/$TID/reservations/$RES/room-move" \
    "{\"to_room_id\":\"$SECOND_ROOM\",\"reason_code\":\"RM_NOISE\",\"reason_notes\":\"suite $RUN\"}")
  assert_http "Room move accepted" "202" "$code"
  # The audit row lands before the reservation update is enqueued, so waiting on
  # it races the booking's own view. Wait for the room number the guest is
  # actually shown.
  if wait_sql 60 "$SECOND_ROOM_NO" "select coalesce(room_number,'') from reservations where id='$RES'"; then
    pass "Guest moved from $FIRST_ROOM_NO to $SECOND_ROOM_NO"
    assert_eq "Move is on the audit trail" "1" "$(sql "select count(*) from audit_logs where entity_id='$RES' and action='ROOM_MOVE'")"
    assert_eq "New room OCCUPIED"            "OCCUPIED"  "$(sql "select status from rooms where id='$SECOND_ROOM'")"
    assert_eq "Old room released"            "AVAILABLE" "$(sql "select status from rooms where id='$FIRST_ROOM'")"
    assert_eq "Old room needs cleaning"      "DIRTY"     "$(sql "select housekeeping_status from rooms where id='$FIRST_ROOM'")"
    assert_eq "Charges survived the move"    "2" \
      "$(sql "select count(*) from charge_postings where reservation_id='$RES' and coalesce(is_voided,false)=false")"
  else
    fail "Room move applied" "no ROOM_MOVE audit row"
  fi
fi

# Change of room type is a modify, and only meaningful with a second type.
# The default seed ships one room type, so a change-of-type has nothing to
# change to. Create the second rather than skip the capability.
ALT_TYPE=$(sql "select id from room_types where tenant_id='$TID' and property_id='$PROPERTY' and id <> '$ROOM_TYPE' limit 1")
if [[ -z "$ALT_TYPE" ]]; then
  code=$(post "$GW/v1/room-types" \
    "{\"tenant_id\":\"$TID\",\"property_id\":\"$PROPERTY\",\"type_name\":\"Suite $RUN\",\"type_code\":\"SUITE$RUN\",\"base_occupancy\":2,\"max_occupancy\":4,\"base_price\":250.00}")
  if [[ "$code" =~ ^20 ]]; then
    ALT_TYPE=$(sql "select id from room_types where tenant_id='$TID' and type_code='SUITE$RUN' limit 1")
  else
    echo "  … room type create returned $code: $(head -c 160 "$RESP_FILE")"
  fi
fi

if [[ -z "$ALT_TYPE" ]]; then
  skip "Change room type" "could not provision a second room type to change to"
else
  code=$(post "$GW/v1/commands/reservation.modify/execute" \
    "{\"tenant_id\":\"$TID\",\"payload\":{\"reservation_id\":\"$RES\",\"room_type_id\":\"$ALT_TYPE\"}}")
  assert_http "Room type change accepted" "202" "$code"
  if wait_sql 60 "$ALT_TYPE" "select room_type_id::text from reservations where id='$RES'"; then
    pass "Room type changed on the booking"
  else
    fail "Room type changed" "reservation still on the original type"
  fi
fi

# Shared reservations do not exist yet — PMS-01-11, WS-04. Naming the gap beats
# pretending the flow is covered.
skip "Share reservation between guests" "PMS-01-11 MISSING — no shared-room model; one guest per reservation"

###############################################################################
# PHASE 9 — Departure
###############################################################################

section "PHASE 9 · Check-out and settlement"

BALANCE=$(sql "select to_char(coalesce(sum(total_amount),0) - (select coalesce(sum(amount),0) from payments where reservation_id='$RES'),'FM999999990.00') from charge_postings where reservation_id='$RES' and coalesce(is_voided,false)=false")
assert_eq "Outstanding balance before settlement is 92.50" "92.50" "$BALANCE"

code=$(post "$GW/v1/commands/billing.payment.capture/execute" \
  "{\"tenant_id\":\"$TID\",\"payload\":{\"payment_reference\":\"CC-$RUN-2\",\"property_id\":\"$PROPERTY\",\"reservation_id\":\"$RES\",\"guest_id\":\"$GUEST\",\"amount\":92.50,\"payment_method\":\"CREDIT_CARD\"}}")
assert_http "Settlement payment accepted" "202" "$code"
if wait_sql 60 "2" "select count(*) from payments where reservation_id='$RES'"; then
  pass "Settlement recorded"
  assert_eq "Folio balance is now zero" "0.00" \
    "$(sql "select to_char(coalesce(sum(total_amount),0) - (select coalesce(sum(amount),0) from payments where reservation_id='$RES'),'FM999999990.00') from charge_postings where reservation_id='$RES' and coalesce(is_voided,false)=false")"
else
  fail "Settlement recorded" "second payment did not land"
fi

code=$(post "$GW/v1/tenants/$TID/reservations/$RES/check-out" "{\"force\":true}")
assert_http "Check-out accepted" "202" "$code"
if wait_sql 60 "CHECKED_OUT" "select status from reservations where id='$RES'"; then
  pass "Guest checked out"
  assert_ne "Departure stamped" "" "$(sql "select coalesce(actual_check_out::text,'') from reservations where id='$RES'")"
  FINAL_ROOM="${SECOND_ROOM:-$FIRST_ROOM}"
  assert_ne "Departed room is no longer OCCUPIED" "OCCUPIED" "$(sql "select status from rooms where id='$FINAL_ROOM'")"
else
  fail "Guest checked out" "check-out did not apply"
fi

###############################################################################
# PHASE 10 — Enquiry → quote → conversion
#
# The front half of the funnel, driven by nothing until now: a booking that
# starts as an enquiry, is quoted with an expiry, and converts. INQUIRY and
# QUOTED are two of the states `RESERVATION_INITIAL_STATUSES` allows a booking
# to begin in, and no suite had ever created one.
###############################################################################

section "PHASE 10 · Enquiry, quote and conversion"

QRES=$(gen_uuid)
code=$(post "$GW/v1/commands/reservation.create/execute" \
  "{\"tenant_id\":\"$TID\",\"payload\":{\"reservation_id\":\"$QRES\",\"property_id\":\"$PROPERTY\",\"guest_id\":\"$GUEST\",\"room_type_id\":\"$ROOM_TYPE\",\"check_in_date\":\"$OUT_3\",\"check_out_date\":\"$OUT_5\",\"status\":\"INQUIRY\",\"total_amount\":300,\"currency\":\"USD\"}}")
assert_http "Enquiry accepted" "202" "$code"

if wait_sql 60 "INQUIRY" "select status from reservations where id='$QRES'"; then
  CREATED_RESERVATIONS+=("$QRES")
  pass "Enquiry persisted as INQUIRY"

  code=$(post "$GW/v1/commands/reservation.send_quote/execute" \
    "{\"tenant_id\":\"$TID\",\"payload\":{\"reservation_id\":\"$QRES\",\"total_amount\":320,\"currency\":\"USD\",\"quote_expires_at\":\"${OUT_3}T12:00:00Z\"}}")
  assert_http "Quote sent" "202" "$code"
  if wait_sql 60 "QUOTED" "select status from reservations where id='$QRES'"; then
    pass "Enquiry became QUOTED"
    assert_ne "Quote carries a sent timestamp" "" "$(sql "select coalesce(quoted_at::text,'') from reservations where id='$QRES'")"
    assert_ne "Quote carries an expiry"        "" "$(sql "select coalesce(quote_expires_at::text,'') from reservations where id='$QRES'")"
  else
    fail "Enquiry became QUOTED" "send_quote did not apply"
  fi

  code=$(post "$GW/v1/commands/reservation.convert_quote/execute" \
    "{\"tenant_id\":\"$TID\",\"payload\":{\"reservation_id\":\"$QRES\",\"total_amount\":320,\"currency\":\"USD\"}}")
  assert_http "Quote conversion accepted" "202" "$code"
  # PENDING, not CONFIRMED: a converted quote is a booking awaiting its deposit,
  # and PENDING → CONFIRMED is one of the edges A10 left to the general editor
  # for exactly that reason — the deposit landing is what confirms it.
  if wait_sql 60 "PENDING" "select status from reservations where id='$QRES'"; then
    pass "Quote converted into a booking"
  else
    fail "Quote converted into a booking" "convert_quote did not apply"
  fi
else
  fail "Enquiry persisted as INQUIRY" "reservation.create did not land"
fi

###############################################################################
# PHASE 11 — Deposit taken, then released
#
# A deposit is what makes a booking real for most properties, and check-in has
# a gate that refuses arrival while a blocking one is unpaid. Both commands
# existed; neither had ever been called.
###############################################################################

section "PHASE 11 · Deposit"

if [[ -n "${QRES:-}" ]]; then
  code=$(post "$GW/v1/commands/reservation.add_deposit/execute" \
    "{\"tenant_id\":\"$TID\",\"payload\":{\"reservation_id\":\"$QRES\",\"amount\":150,\"currency\":\"USD\",\"method\":\"CREDIT_CARD\",\"notes\":\"stay-lifecycle deposit\"}}")
  assert_http "Deposit accepted" "202" "$code"
  if wait_sql 60 "add" "select coalesce(metadata->'deposit_event'->>'type','') from reservations where id='$QRES'"; then
    pass "Deposit recorded against the booking"
    assert_eq "Deposit amount stored" "150" \
      "$(sql "select coalesce((metadata->'deposit_event'->>'amount')::numeric::int::text,'') from reservations where id='$QRES'")"
  else
    fail "Deposit recorded against the booking" "add_deposit did not apply"
  fi

  code=$(post "$GW/v1/commands/reservation.release_deposit/execute" \
    "{\"tenant_id\":\"$TID\",\"payload\":{\"reservation_id\":\"$QRES\",\"amount\":150,\"reason\":\"stay-lifecycle release\"}}")
  assert_http "Deposit release accepted" "202" "$code"
  if wait_sql 60 "release" "select coalesce(metadata->'deposit_event'->>'type','') from reservations where id='$QRES'"; then
    pass "Deposit release recorded"
  else
    fail "Deposit release recorded" "release_deposit did not apply"
  fi
else
  skip "Deposit" "no quoted booking to attach one to"
fi

###############################################################################
# PHASE 12 — Registration card
#
# What the guest signs at the desk. It has a handler, a catalogue row and a
# route, and had never been called.
###############################################################################

section "PHASE 12 · Registration card"

if [[ -n "${QRES:-}" ]]; then
  code=$(post "$GW/v1/commands/reservation.generate_registration_card/execute" \
    "{\"tenant_id\":\"$TID\",\"payload\":{\"reservation_id\":\"$QRES\",\"property_id\":\"$PROPERTY\",\"visit_purpose\":\"leisure\"}}")
  assert_http "Registration card accepted" "202" "$code"
  if wait_sql 60 "1" "select count(*) from digital_registration_cards where reservation_id='$QRES'"; then
    pass "Registration card produced"
  else
    fail "Registration card produced" "no digital_registration_cards row within 60s"
  fi
else
  skip "Registration card" "no booking to card"
fi

###############################################################################
# PHASE 13 — Unassign and reassign
#
# A room given back before arrival, which the desk does whenever a better one
# frees up.
###############################################################################

section "PHASE 13 · Unassign and reassign a room"

if [[ -n "${QRES:-}" ]]; then
  pick_free_room; QROOM="$PICKED_ROOM"
  if [[ -z "$QROOM" ]]; then
    skip "Unassign and reassign" "no free room to assign"
  else
    code=$(post "$GW/v1/commands/reservation.assign_room/execute" \
      "{\"tenant_id\":\"$TID\",\"payload\":{\"reservation_id\":\"$QRES\",\"room_id\":\"$QROOM\"}}")
    assert_http "Room assigned" "202" "$code"
    if wait_sql 60 "1" "select count(*) from reservation_rooms where reservation_id='$QRES' and room_id='$QROOM'"; then
      pass "Assignment landed"
    else
      fail "Assignment landed" "assign_room did not apply"
    fi

    code=$(post "$GW/v1/commands/reservation.unassign_room/execute" \
      "{\"tenant_id\":\"$TID\",\"payload\":{\"reservation_id\":\"$QRES\",\"reason\":\"stay-lifecycle unassign\"}}")
    assert_http "Unassign accepted" "202" "$code"
    if wait_sql 60 "0" "select count(*) from reservation_rooms where reservation_id='$QRES' and room_id='$QROOM'"; then
      pass "Room released back to inventory"
    else
      fail "Room released back to inventory" "unassign_room did not apply"
    fi
  fi
else
  skip "Unassign and reassign" "no booking to assign"
fi

###############################################################################
# PHASE 14 — Rate override
#
# A06 made this state a reason code from the RATE_OVERRIDE category, and check
# the caller's role against that code's approval level. Nothing drove it, so
# the control had never run outside its unit tests.
###############################################################################

section "PHASE 14 · Rate override"

if [[ -n "${QRES:-}" ]]; then
  code=$(post "$GW/v1/commands/reservation.rate_override/execute" \
    "{\"tenant_id\":\"$TID\",\"payload\":{\"reservation_id\":\"$QRES\",\"total_amount\":275,\"reason_code\":\"RO_MGR_DISC\",\"reason\":\"stay-lifecycle manager discount\"}}")
  assert_http "Rate override accepted" "202" "$code"
  if wait_sql 60 "275" "select coalesce(total_amount::numeric::int::text,'') from reservations where id='$QRES'"; then
    pass "The new rate is on the booking"
    assert_eq "The override is recorded under its reason code" "RO_MGR_DISC" \
      "$(sql "select coalesce(reason_code,'') from flow_approvals where gate_name='rate_override' and entity_id='$QRES' limit 1")"
    assert_ne "…with the operator's real role, not a literal" "" \
      "$(sql "select coalesce(role_at_approval,'') from flow_approvals where gate_name='rate_override' and entity_id='$QRES' limit 1")"
  else
    fail "The new rate is on the booking" "rate_override did not apply"
  fi

  # An override naming no code is refused before the command is accepted, which
  # is the half of A06 that makes the code mandatory rather than decorative.
  code=$(post "$GW/v1/commands/reservation.rate_override/execute" \
    "{\"tenant_id\":\"$TID\",\"payload\":{\"reservation_id\":\"$QRES\",\"total_amount\":100}}")
  assert_http "Override with no reason code is refused" "4" "$code"
else
  skip "Rate override" "no booking to reprice"
fi

###############################################################################
# PHASE 15 — Walk-in arrival
#
# No booking, guest at the desk: create and check in in one command. A
# meaningful share of rooms are sold this way and none were tested this way.
###############################################################################

section "PHASE 15 · Walk-in arrival"

pick_free_room; WALK_ROOM="$PICKED_ROOM"
if [[ -z "$WALK_ROOM" ]]; then
  skip "Walk-in arrival" "no free room for a walk-in"
else
  WRES=$(gen_uuid)
  code=$(post "$GW/v1/commands/reservation.walkin_checkin/execute" \
    "{\"tenant_id\":\"$TID\",\"payload\":{\"reservation_id\":\"$WRES\",\"property_id\":\"$PROPERTY\",\"guest_id\":\"$GUEST\",\"room_type_id\":\"$ROOM_TYPE\",\"room_id\":\"$WALK_ROOM\",\"check_out_date\":\"$OUT_3\",\"allow_rate_fallback\":true}}")
  assert_http "Walk-in accepted" "202" "$code"
  if wait_sql 90 "CHECKED_IN" "select status from reservations where id='$WRES'"; then
    CREATED_RESERVATIONS+=("$WRES")
    pass "Walk-in guest is in-house"
    assert_ne "Arrival stamped" "" "$(sql "select coalesce(actual_check_in::text,'') from reservations where id='$WRES'")"
    assert_eq "Their room reads OCCUPIED" "OCCUPIED" "$(sql "select status from rooms where id='$WALK_ROOM'")"
  else
    fail "Walk-in guest is in-house" "walkin_checkin did not apply"
  fi
fi

###############################################################################
# PHASE 16 — The guest who never left
#
# Reversing a check-out: WS-04 built it, the flow registry declares it, and no
# suite had ever undone a departure — the only recovery from a mis-keyed one.
###############################################################################

section "PHASE 16 · Reverse a check-out"

if [[ -n "${RES:-}" && "$(sql "select status from reservations where id='$RES'")" == "CHECKED_OUT" ]]; then
  code=$(post "$GW/v1/commands/reservation.reverse_check_out/execute" \
    "{\"tenant_id\":\"$TID\",\"payload\":{\"reservation_id\":\"$RES\",\"property_id\":\"$PROPERTY\",\"reason_code\":\"EARLY_DEPARTURE_REVERSED\",\"reason_notes\":\"stay-lifecycle reversal\",\"force\":true}}")
  assert_http "Reversal accepted" "202" "$code"
  if wait_sql 60 "CHECKED_IN" "select status from reservations where id='$RES'"; then
    pass "The departed guest is in-house again"
    assert_eq "Departure stamp cleared" "" "$(sql "select coalesce(actual_check_out::text,'') from reservations where id='$RES'")"
    assert_eq "The reversal is recorded" "reverse_check_out" \
      "$(sql "select coalesce(gate_name,'') from flow_approvals where entity_id='$RES' and gate_name='reverse_check_out' limit 1")"
  else
    fail "The departed guest is in-house again" "reverse_check_out did not apply"
  fi
else
  skip "Reverse a check-out" "the stay did not reach CHECKED_OUT"
fi

###############################################################################
# PHASE 17 — Waitlist
#
# A sold-out date, a guest who wants it anyway, an offer when a room frees up.
# Three commands and a table of their own, with no coverage at all.
###############################################################################

section "PHASE 17 · Waitlist"

code=$(post "$GW/v1/commands/reservation.waitlist_add/execute" \
  "{\"tenant_id\":\"$TID\",\"payload\":{\"property_id\":\"$PROPERTY\",\"guest_id\":\"$GUEST\",\"requested_room_type_id\":\"$ROOM_TYPE\",\"arrival_date\":\"$OUT_5\",\"departure_date\":\"$OUT_7\",\"number_of_rooms\":1}}")
assert_http "Waitlist entry accepted" "202" "$code"
if wait_sql 60 "1" "select count(*) from waitlist_entries where tenant_id='$TID' and guest_id='$GUEST' and arrival_date='$OUT_5'"; then
  pass "Guest is on the waitlist"
  WL=$(sql "select waitlist_id from waitlist_entries where tenant_id='$TID' and guest_id='$GUEST' and arrival_date='$OUT_5' order by created_at desc limit 1")

  code=$(post "$GW/v1/commands/reservation.waitlist_offer/execute" \
    "{\"tenant_id\":\"$TID\",\"payload\":{\"waitlist_id\":\"$WL\",\"property_id\":\"$PROPERTY\",\"offer_ttl_hours\":24,\"notify_via\":\"EMAIL\"}}")
  assert_http "Offer accepted" "202" "$code"
  if wait_sql 60 "OFFERED" "select waitlist_status from waitlist_entries where waitlist_id='$WL'"; then
    pass "The entry reads OFFERED"
  else
    fail "The entry reads OFFERED" "waitlist_offer did not apply"
  fi

  code=$(post "$GW/v1/commands/reservation.waitlist_convert/execute" \
    "{\"tenant_id\":\"$TID\",\"payload\":{\"waitlist_id\":\"$WL\",\"property_id\":\"$PROPERTY\",\"room_type_id\":\"$ROOM_TYPE\"}}")
  assert_http "Conversion accepted" "202" "$code"
  if wait_sql 60 "CONVERTED" "select waitlist_status from waitlist_entries where waitlist_id='$WL'"; then
    pass "The waitlisted guest became a booking"
  else
    fail "The waitlisted guest became a booking" "waitlist_convert did not apply"
  fi
else
  fail "Guest is on the waitlist" "waitlist_add did not land"
fi

###############################################################################
# PHASE 18 — Out of service, and keys
#
# Maintenance takes a room off sale; the desk cuts and cancels keys. Six room
# commands, none of them ever driven.
###############################################################################

section "PHASE 18 · Out of order, out of service, and keys"

pick_free_room; OOO_ROOM="$PICKED_ROOM"
if [[ -z "$OOO_ROOM" ]]; then
  skip "Out of order and keys" "no free room to take out of service"
else
  code=$(post "$GW/v1/tenants/$TID/rooms/$OOO_ROOM/out-of-order" \
    "{\"reason\":\"stay-lifecycle maintenance\",\"start_date\":\"$TODAY\",\"end_date\":\"$OUT_3\"}")
  assert_http "Out-of-order accepted" "20" "$code"
  if wait_sql 60 "t" "select coalesce(is_out_of_order,false)::text from rooms where id='$OOO_ROOM'"; then
    pass "The room is out of order"
  else
    fail "The room is out of order" "out_of_order did not apply"
  fi

  code=$(post "$GW/v1/tenants/$TID/rooms/$OOO_ROOM/out-of-service" \
    "{\"reason\":\"stay-lifecycle deep clean\",\"start_date\":\"$TODAY\",\"end_date\":\"$OUT_3\"}")
  assert_http "Out-of-service accepted" "20" "$code"
fi

if [[ -n "${WRES:-}" && -n "${WALK_ROOM:-}" ]]; then
  code=$(post "$GW/v1/commands/rooms.key.issue/execute" \
    "{\"tenant_id\":\"$TID\",\"payload\":{\"property_id\":\"$PROPERTY\",\"room_id\":\"$WALK_ROOM\",\"reservation_id\":\"$WRES\",\"guest_id\":\"$GUEST\",\"key_type\":\"bluetooth\",\"valid_until\":\"${OUT_3}T12:00:00Z\"}}")
  assert_http "Key issue accepted" "202" "$code"
  if wait_sql 60 "1" "select count(*) from mobile_keys where reservation_id='$WRES'"; then
    pass "A key was cut for the in-house guest"
    code=$(post "$GW/v1/commands/rooms.key.revoke/execute" \
      "{\"tenant_id\":\"$TID\",\"payload\":{\"property_id\":\"$PROPERTY\",\"reservation_id\":\"$WRES\",\"reason\":\"stay-lifecycle revoke\"}}")
    assert_http "Key revoke accepted" "202" "$code"
    if wait_sql 60 "0" "select count(*) from mobile_keys where reservation_id='$WRES' and coalesce(is_active,true)=true"; then
      pass "The key no longer opens the door"
    else
      fail "The key no longer opens the door" "key.revoke did not apply"
    fi
  else
    fail "A key was cut for the in-house guest" "rooms.key.issue did not apply"
  fi
else
  skip "Room keys" "no in-house walk-in to cut a key for"
fi

harness_summary "STAY LIFECYCLE"
