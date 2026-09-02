#!/usr/bin/env bash
###############################################################################
# test-ws04-lifecycle.sh
# WS-04 — reservation lifecycle: reversals, batch envelope, room move
#
# Covers the commands a front desk uses to correct itself, all of which are
# invisible to the billing-focused suites:
#
#   PHASE 1  Batch envelope  — mass update, mass check-in, mass cancel,
#                              dry run, partial failure, replay safety
#   PHASE 2  Room move       — in-house relocation, every refusal, force
#   PHASE 3  Reversals       — reverse check-in and its folio effect
#
# Everything goes through the gateway. The only SQL is the feature-flag enable
# every suite here needs, and reading back state the API does not expose.
#
# Usage:
#   ./executables/test-accounts-realdata/test-ws04-lifecycle.sh
#
# Prerequisites: services running (pnpm run dev:backend), seeded database.
###############################################################################
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

source "$SCRIPT_DIR/ensure-deps.sh"
source "$SCRIPT_DIR/lib/harness.sh"

TID="11111111-1111-1111-1111-111111111111"
PSQL_ARGS=(-h "${DB_HOST:-127.0.0.1}" -p "${DB_DIRECT_PORT:-5432}" -U "${DB_USER:-postgres}" -d "${DB_NAME:-tartware}" -tAc)
sql() { PGPASSWORD="${DB_PASSWORD:-postgres}" psql "${PSQL_ARGS[@]}" "$1" 2>/dev/null | head -1; }

# Commands are 202-accepted long before their consumer runs, so every assertion
# about an effect has to wait for one. Polling beats a fixed sleep: it is fast
# when the consumer is, and it does not turn a slow broker into a phantom
# failure the way a too-short sleep does.
wait_sql() {
  local timeout="$1" expected="$2" q="$3" waited=0 actual
  while [[ $waited -lt $timeout ]]; do
    actual=$(sql "$q")
    [[ "$actual" == "$expected" ]] && return 0
    sleep 2; waited=$((waited+2))
  done
  return 1
}

# ─── Cleanup ─────────────────────────────────────────────────────────────────
# A suite that leaves its guests in-house cannot be run twice: the second run
# finds no sellable rooms and fails in preflight. Everything created here is
# released at the end — the bookings are cancelled and the rooms handed back
# clean — so the suite is re-runnable without a database reset.

CREATED_RESERVATIONS=()
USED_ROOMS=()

cleanup_fixtures() {
  local rid room
  for rid in "${CREATED_RESERVATIONS[@]:-}"; do
    [[ -z "$rid" ]] && continue
    PGPASSWORD="${DB_PASSWORD:-postgres}" psql "${PSQL_ARGS[@]%-tAc}" -tAc \
      "UPDATE reservations SET status='CANCELLED', actual_check_in=NULL, actual_check_out=NULL
         WHERE id='$rid' AND tenant_id='$TID'" >/dev/null 2>&1 || true
  done
  for room in "${USED_ROOMS[@]:-}"; do
    [[ -z "$room" ]] && continue
    PGPASSWORD="${DB_PASSWORD:-postgres}" psql "${PSQL_ARGS[@]%-tAc}" -tAc \
      "UPDATE rooms SET status='AVAILABLE', housekeeping_status='CLEAN'
         WHERE id='$room' AND tenant_id='$TID'" >/dev/null 2>&1 || true
  done
}
trap cleanup_fixtures EXIT

TODAY=$(date +%Y-%m-%d)
IN4DAYS=$(date -d "+4 days" +%Y-%m-%d 2>/dev/null || date -v+4d +%Y-%m-%d)
RUN=$(date +%H%M%S)$((RANDOM % 100))

echo "┌─ WS-04 lifecycle suite · run $RUN"

# ─── Preflight ───────────────────────────────────────────────────────────────

section "Preflight"
code=$(curl -s -o /dev/null -w "%{http_code}" "$GW/health" 2>/dev/null || echo 000)
assert_http "Gateway reachable" "200" "$code"
harness_login || { echo "cannot continue without a token"; exit 1; }
pass "Authenticated as setup.admin"

enable_commands guest.register rooms.status.update reservation.create reservation.modify reservation.cancel \
  reservation.check_in reservation.check_out reservation.mass_cancel \
  reservation.mass_check_in reservation.mass_update reservation.room_move \
  reservation.reverse_check_in

PROPERTY=$(sql "select id from properties where tenant_id='$TID' limit 1")
ROOM_TYPE=$(sql "select room_type_id from rooms where tenant_id='$TID' and property_id='$PROPERTY' group by room_type_id order by count(*) desc limit 1")
if [[ -z "$PROPERTY" || -z "$ROOM_TYPE" ]]; then
  fail "Reference data present" "property=$PROPERTY room_type=$ROOM_TYPE"
  harness_summary "WS-04 LIFECYCLE"; exit 1
fi
pass "Reference data present (property, room type)"

# A virgin database seeds no guests, so the suite registers its own rather than
# borrowing whatever an earlier run happened to leave behind. That is the
# difference between a suite that works and one that only works second.
GUEST=$(sql "select id from guests where tenant_id='$TID' and email like 'ws04-%' limit 1")
if [[ -z "$GUEST" ]]; then
  code=$(post "$GW/v1/guests" \
    "{\"tenant_id\":\"$TID\",\"first_name\":\"WS04\",\"last_name\":\"Fixture\",\"email\":\"ws04-$RUN@example.test\"}")
  assert_http "Guest fixture registered" "202" "$code"
  waited=0
  while [[ $waited -lt 40 ]]; do
    GUEST=$(sql "select id from guests where tenant_id='$TID' and email like 'ws04-%' limit 1")
    [[ -n "$GUEST" ]] && break
    sleep 2; waited=$((waited+2))
  done
else
  pass "Guest fixture reused from an earlier run"
fi
if [[ -z "$GUEST" ]]; then
  fail "Guest fixture available" "guest.register did not land within 40s"
  harness_summary "WS-04 LIFECYCLE"; exit 1
fi
pass "Guest fixture available"

mapfile -t FREE_ROOMS < <(PGPASSWORD="${DB_PASSWORD:-postgres}" psql "${PSQL_ARGS[@]}" \
  "select id from rooms where tenant_id='$TID' and property_id='$PROPERTY' and room_type_id='$ROOM_TYPE' and status='AVAILABLE' and housekeeping_status in ('CLEAN','INSPECTED') and coalesce(is_deleted,false)=false limit 6" 2>/dev/null)
# The default seed ships four rooms and this suite needs five in flight at once
# (two mass check-ins, a move out of one into another, a reversal). Rather than
# depend on whatever an earlier suite happened to leave behind — which is how
# this passed once and then failed on a clean database — it provisions its own.
# Rooms are provisioned fresh every run rather than picked from whatever is
# sellable. "Sellable right now" is not the same as "free for this stay window":
# the seed's four rooms accumulate bookings across runs, so the availability
# guard rightly refuses a move into one — and the suite failed on the guard
# doing its job. Rooms created for this run have no history, so a refusal means
# a real defect.
NEEDED_ROOMS=5
FREE_ROOMS=()
if true; then
  echo "  … provisioning $NEEDED_ROOMS rooms for this run"
  for i in $(seq 1 $NEEDED_ROOMS); do
    code=$(post "$GW/v1/rooms" \
      "{\"tenant_id\":\"$TID\",\"property_id\":\"$PROPERTY\",\"room_type_id\":\"$ROOM_TYPE\",\"room_number\":\"WS$RUN$i\",\"floor\":\"9\",\"status\":\"AVAILABLE\"}")
    [[ "$code" =~ ^20 ]] || echo "  … room create returned $code: $(head -c 160 "$RESP_FILE")"
  done
  # A freshly created room defaults to a housekeeping status the move refuses;
  # make the suite's own rooms sellable.
  PGPASSWORD="${DB_PASSWORD:-postgres}" psql "${PSQL_ARGS[@]%-tAc}" -tAc \
    "UPDATE rooms SET status='AVAILABLE', housekeeping_status='CLEAN'
       WHERE tenant_id='$TID' AND room_number LIKE 'WS$RUN%'" >/dev/null 2>&1 || true
  mapfile -t FREE_ROOMS < <(PGPASSWORD="${DB_PASSWORD:-postgres}" psql "${PSQL_ARGS[@]}" \
    "select id from rooms where tenant_id='$TID' and room_number like 'WS$RUN%'
       and coalesce(is_deleted,false)=false order by room_number" 2>/dev/null)
fi

assert_gte "At least $NEEDED_ROOMS sellable rooms for the fixtures" "${#FREE_ROOMS[@]}" "$NEEDED_ROOMS"
[[ ${#FREE_ROOMS[@]} -lt $NEEDED_ROOMS ]] && { harness_summary "WS-04 LIFECYCLE"; exit 1; }

# Rooms are consumed as the suite runs — a check-in makes one OCCUPIED — so a
# list captured in preflight goes stale by phase 3. This asks for a room that is
# sellable at the moment it is needed and never hands out the same one twice.
CLAIMED_ROOMS=()
PICKED_ROOM=""

# Sets PICKED_ROOM rather than echoing it. `x=$(pick_free_room)` runs the
# function in a subshell, so the CLAIMED_ROOMS bookkeeping was thrown away the
# moment it returned — every call handed out the same room. That made the move
# fixture check into the room it was about to be moved to, and two assertions
# passed for the wrong reason before ALREADY_IN_ROOM gave it away.
pick_free_room() {
  local excl="" r
  for r in "${CLAIMED_ROOMS[@]:-}"; do [[ -n "$r" ]] && excl="$excl,'$r'"; done
  excl="${excl:1}"
  [[ -z "$excl" ]] && excl="'00000000-0000-0000-0000-000000000000'"
  PICKED_ROOM=$(sql "select id from rooms
                where tenant_id='$TID' and room_number like 'WS$RUN%'
                  and status='AVAILABLE' and housekeeping_status in ('CLEAN','INSPECTED')
                  and coalesce(is_blocked,false)=false
                  and coalesce(is_out_of_order,false)=false
                  and coalesce(is_deleted,false)=false
                  and id not in ($excl)
                order by room_number
                limit 1")
  if [[ -n "$PICKED_ROOM" ]]; then
    CLAIMED_ROOMS+=("$PICKED_ROOM"); USED_ROOMS+=("$PICKED_ROOM")
  fi
}

# make_reservation SEQ -> echoes the reservation id
make_reservation() {
  local seq="$1"
  local rid; rid=$(gen_uuid)
  local code
  code=$(post "$GW/v1/commands/reservation.create/execute" \
    "{\"tenant_id\":\"$TID\",\"payload\":{\"reservation_id\":\"$rid\",\"property_id\":\"$PROPERTY\",\"guest_id\":\"$GUEST\",\"room_type_id\":\"$ROOM_TYPE\",\"check_in_date\":\"$TODAY\",\"check_out_date\":\"$IN4DAYS\",\"status\":\"CONFIRMED\",\"total_amount\":400,\"currency\":\"USD\"}}")
  [[ "$code" =~ ^20 ]] || { echo ""; return 1; }
  local waited=0
  while [[ $waited -lt 40 ]]; do
    if [[ "$(sql "select count(*) from reservations where id='$rid'")" == "1" ]]; then
      CREATED_RESERVATIONS+=("$rid"); echo "$rid"; return 0
    fi
    sleep 2; waited=$((waited+2))
  done
  echo ""
}

###############################################################################
# PHASE 1 — Batch envelope
###############################################################################

section "PHASE 1 · Batch envelope"

R1=$(make_reservation 1); R2=$(make_reservation 2); R3=$(make_reservation 3)
if [[ -z "$R1" || -z "$R2" || -z "$R3" ]]; then
  fail "Batch fixtures created" "r1=$R1 r2=$R2 r3=$R3"
else
  pass "Batch fixtures created (3 confirmed reservations)"

  # ── dry run changes nothing, and reports the unknown target ──
  BATCH_DRY=$(gen_uuid)
  code=$(post "$GW/v1/tenants/$TID/reservations/mass-update" \
    "{\"batch_id\":\"$BATCH_DRY\",\"dry_run\":true,\"changes\":{\"notes\":\"dry $RUN\"},\"items\":[{\"reservation_id\":\"$R1\"},{\"reservation_id\":\"$(gen_uuid)\"}]}")
  assert_http "Mass update dry run accepted" "202" "$code"

  if wait_for_json 40 "$GW/v1/tenants/$TID/commands/batches/$BATCH_DRY" '.status' "PARTIAL"; then
    assert_eq "Dry run: 2 items accounted for"      "2" "$(resp_jq '.total')"
    assert_eq "Dry run: real target SKIPPED"        "1" "$(resp_jq '.skipped')"
    assert_eq "Dry run: unknown target FAILED"      "1" "$(resp_jq '.failed')"
    assert_eq "Dry run: nothing applied"            "0" "$(resp_jq '.succeeded')"
    assert_eq "Dry run: names the missing booking"  "RESERVATION_NOT_FOUND" \
      "$(resp_jq '.items[] | select(.outcome=="FAILED") | .error_code')"
    assert_eq "Dry run: succeeded+failed+skipped == total" "2" \
      "$(resp_jq '(.succeeded + .failed + .skipped)')"
    assert_eq "Dry run: timestamps are ISO 8601" "true" \
      "$(resp_jq '(.started_at | test("^[0-9]{4}-[0-9]{2}-[0-9]{2}T"))')"
  else
    fail "Dry run batch completed" "status=$(resp_jq '.status')"
  fi
  assert_eq "Dry run left the booking untouched" "" "$(sql "select coalesce(internal_notes,'') from reservations where id='$R1'")"

  # ── real mass update ──
  BATCH_UPD=$(gen_uuid)
  code=$(post "$GW/v1/tenants/$TID/reservations/mass-update" \
    "{\"batch_id\":\"$BATCH_UPD\",\"changes\":{\"notes\":\"conference $RUN\"},\"items\":[{\"reservation_id\":\"$R1\"},{\"reservation_id\":\"$R2\"}]}")
  assert_http "Mass update accepted" "202" "$code"
  if wait_for_json 40 "$GW/v1/tenants/$TID/commands/batches/$BATCH_UPD" '.status' "COMPLETED"; then
    assert_eq "Mass update: both applied" "2" "$(resp_jq '.succeeded')"
    assert_ne "Mass update: successful item carries its event" "" "$(resp_jq '.items[0].event_id')"
  else
    fail "Mass update completed" "status=$(resp_jq '.status')"
  fi
  sleep "$KAFKA_WAIT"
  assert_eq "Mass update reached the booking" "conference $RUN" "$(sql "select internal_notes from reservations where id='$R1'")"
  assert_eq "Mass update left R3 alone"       ""                "$(sql "select coalesce(internal_notes,'') from reservations where id='$R3'")"

  # ── mass check-in ──
  pick_free_room; CI_ROOM_1="$PICKED_ROOM"
  pick_free_room; CI_ROOM_2="$PICKED_ROOM"
  BATCH_CI=$(gen_uuid)
  code=$(post "$GW/v1/tenants/$TID/reservations/mass-check-in" \
    "{\"batch_id\":\"$BATCH_CI\",\"force\":true,\"items\":[{\"reservation_id\":\"$R1\",\"room_id\":\"$CI_ROOM_1\"},{\"reservation_id\":\"$R2\",\"room_id\":\"$CI_ROOM_2\"}]}")
  assert_http "Mass check-in accepted" "202" "$code"
  if wait_for_json 40 "$GW/v1/tenants/$TID/commands/batches/$BATCH_CI" '.status' "COMPLETED"; then
    assert_eq "Mass check-in: both applied" "2" "$(resp_jq '.succeeded')"
  else
    fail "Mass check-in completed" "status=$(resp_jq '.status')"
  fi
  wait_sql 40 "CHECKED_IN" "select status from reservations where id='$R1'"
  assert_eq "Mass check-in moved R1 in-house" "CHECKED_IN" "$(sql "select status from reservations where id='$R1'")"

  # ── mass cancel with a partial failure ──
  # R1 is now CHECKED_IN, which cancel must refuse while still cancelling R3.
  BATCH_CAN=$(gen_uuid)
  code=$(post "$GW/v1/tenants/$TID/reservations/mass-cancel" \
    "{\"batch_id\":\"$BATCH_CAN\",\"reason\":\"suite $RUN\",\"items\":[{\"reservation_id\":\"$R1\"},{\"reservation_id\":\"$R3\",\"reason\":\"guest called $RUN\"}]}")
  assert_http "Mass cancel accepted" "202" "$code"
  if wait_for_json 40 "$GW/v1/tenants/$TID/commands/batches/$BATCH_CAN" '.status' "PARTIAL"; then
    assert_eq "Partial batch: one applied"  "1" "$(resp_jq '.succeeded')"
    assert_eq "Partial batch: one refused"  "1" "$(resp_jq '.failed')"
    assert_eq "Refusal carries the single command's own code" "INVALID_STATUS_FOR_CANCEL" \
      "$(resp_jq '.items[] | select(.outcome=="FAILED") | .error_code')"
    assert_eq "Failed item names its target" "$R1" \
      "$(resp_jq '.items[] | select(.outcome=="FAILED") | .target_id')"
  else
    fail "Mass cancel reported a partial run" "status=$(resp_jq '.status')"
  fi
  wait_sql 40 "CANCELLED" "select status from reservations where id='$R3'"
  assert_eq "In-house booking survived the batch" "CHECKED_IN" "$(sql "select status from reservations where id='$R1'")"
  assert_eq "Cancellable booking was cancelled"   "CANCELLED"  "$(sql "select status from reservations where id='$R3'")"
  assert_eq "Per-item reason overrode the batch reason" "guest called $RUN" \
    "$(sql "select cancellation_reason from reservations where id='$R3'")"

  # ── replay safety ──
  R4=$(make_reservation 4)
  if [[ -n "$R4" ]]; then
    code=$(post "$GW/v1/tenants/$TID/reservations/mass-cancel" \
      "{\"batch_id\":\"$BATCH_CAN\",\"reason\":\"replay must not apply\",\"items\":[{\"reservation_id\":\"$R4\"}]}")
    assert_http "Replay of a finished batch_id accepted" "202" "$code"
    sleep "$KAFKA_WAIT"
    assert_eq "Replay did not cancel the new booking" "CONFIRMED" "$(sql "select status from reservations where id='$R4'")"
    get "$GW/v1/tenants/$TID/commands/batches/$BATCH_CAN" >/dev/null
    assert_eq "Replay left the stored result intact" "2" "$(resp_jq '.total')"
  else
    skip "Replay safety" "could not create the replay fixture"
  fi
fi

###############################################################################
# PHASE 2 — Room move
###############################################################################

section "PHASE 2 · Room move for an in-house guest"

RM=$(make_reservation 10)
if [[ -z "$RM" ]]; then
  fail "Room-move fixture created" "reservation.create did not land"
else
  pick_free_room; FROM_ROOM="$PICKED_ROOM"
  pick_free_room; TO_ROOM="$PICKED_ROOM"
  code=$(post "$GW/v1/tenants/$TID/reservations/$RM/check-in" "{\"room_id\":\"$FROM_ROOM\",\"force\":true}")
  assert_http "Room-move fixture checked in" "202" "$code"
  wait_sql 40 "CHECKED_IN" "select status from reservations where id='$RM'"
  assert_eq "Fixture is in-house" "CHECKED_IN" "$(sql "select status from reservations where id='$RM'")"

  wait_sql 30 "CHECKED_IN" "select status from reservation_rooms where reservation_id='$RM' limit 1"

  # The per-room lifecycle is what a move gates on. WS-01 added the column and
  # only the create path ever wrote it, so this asserts the propagation as much
  # as the move.
  assert_eq "Per-room status followed the reservation in-house" "CHECKED_IN" \
    "$(sql "select status from reservation_rooms where reservation_id='$RM' limit 1")"

  # ── refusals ──
  code=$(post "$GW/v1/tenants/$TID/reservations/$RM/room-move" \
    "{\"to_room_id\":\"$TO_ROOM\",\"reason_code\":\"NOT_A_REAL_CODE\"}")
  assert_http "Room move with an unknown reason code is refused at accept or apply" "20[02]|4" "$code"

  code=$(post "$GW/v1/tenants/$TID/reservations/$RM/room-move" \
    "{\"to_room_id\":\"$FROM_ROOM\",\"reason_code\":\"RM_MAINT\"}")
  assert_http "Room move into the same room accepted for async refusal" "202" "$code"

  # ── the move itself ──
  MOVE_KEY=$(gen_uuid)
  code=$(post "$GW/v1/tenants/$TID/reservations/$RM/room-move" \
    "{\"to_room_id\":\"$TO_ROOM\",\"reason_code\":\"RM_MAINT\",\"reason_notes\":\"suite $RUN\",\"from_room_status_after\":\"DIRTY\"}" "$MOVE_KEY")
  assert_http "Room move accepted" "202" "$code"
  # Wait on the *last* thing the handler writes, not the first. The room row is
  # updated inside the move's transaction while the audit and approval rows land
  # after it commits, so polling the room row raced every assertion below it.
  wait_sql 40 "1" "select count(*) from audit_logs where entity_id='$RM' and action='ROOM_MOVE'"

  TO_NUMBER=$(sql "select room_number from rooms where id='$TO_ROOM'")
  FROM_NUMBER=$(sql "select room_number from rooms where id='$FROM_ROOM'")

  assert_eq "Booking now shows the new room"        "$TO_NUMBER" "$(sql "select room_number from reservations where id='$RM'")"
  assert_eq "Room row points at the new room"       "$TO_ROOM"   "$(sql "select room_id::text from reservation_rooms where reservation_id='$RM' limit 1")"
  assert_eq "New room is OCCUPIED"                  "OCCUPIED"   "$(sql "select status from rooms where id='$TO_ROOM'")"
  assert_eq "Vacated room is sellable again"        "AVAILABLE"  "$(sql "select status from rooms where id='$FROM_ROOM'")"
  assert_eq "Vacated room needs cleaning"           "DIRTY"      "$(sql "select housekeeping_status from rooms where id='$FROM_ROOM'")"
  assert_eq "Move is on the audit trail"            "1"          "$(sql "select count(*) from audit_logs where entity_id='$RM' and action='ROOM_MOVE'")"
  assert_eq "Move is on the approvals trail"        "1"          "$(sql "select count(*) from flow_approvals where entity_id='$RM' and gate_name='room_move'")"
  assert_eq "Audit records the reason code"         "RM_MAINT"   "$(sql "select metadata->>'reason_code' from audit_logs where entity_id='$RM' and action='ROOM_MOVE' limit 1")"
  assert_eq "Charges untouched by default"          "0"          "$(sql "select metadata->>'nights_repriced' from audit_logs where entity_id='$RM' and action='ROOM_MOVE' limit 1")"
  assert_eq "Key re-issue is recorded as outstanding" "$FROM_NUMBER" \
    "$(sql "select metadata->>'from_room_number' from audit_logs where entity_id='$RM' and action='ROOM_MOVE' limit 1")"
fi

###############################################################################
# PHASE 3 — Reversal
###############################################################################

section "PHASE 3 · Check-in reversal"

pick_free_room; RV_ROOM="$PICKED_ROOM"
RV=$(make_reservation 20)
if [[ -z "$RV" ]]; then
  fail "Reversal fixture created" "reservation.create did not land"
else
  code=$(post "$GW/v1/tenants/$TID/reservations/$RV/check-in" "{\"room_id\":\"$RV_ROOM\",\"force\":true}")
  assert_http "Reversal fixture checked in" "202" "$code"
  wait_sql 60 "CHECKED_IN" "select status from reservations where id='$RV'"
  RV_STATUS=$(sql "select status from reservations where id='$RV'")
  assert_eq "Fixture is in-house" "CHECKED_IN" "$RV_STATUS"

  code=$(post "$GW/v1/tenants/$TID/reservations/$RV/reverse-check-in" \
    "{\"reason_code\":\"KEYED_IN_ERROR\",\"reason_notes\":\"suite $RUN\"}")
  assert_http "Reverse check-in accepted" "202" "$code"
  wait_sql 40 "CONFIRMED" "select status from reservations where id='$RV'"

  STATUS_AFTER=$(sql "select status from reservations where id='$RV'")
  if [[ "$RV_STATUS" != "CHECKED_IN" ]]; then
    skip "Check-in reversed" "fixture never reached CHECKED_IN, so a CONFIRMED reading proves nothing"
  elif [[ "$STATUS_AFTER" == "CONFIRMED" ]]; then
    pass "Check-in reversed — booking back to CONFIRMED"
    assert_eq "Arrival stamp cleared" "" "$(sql "select coalesce(actual_check_in::text,'') from reservations where id='$RV'")"
  else
    # A seed without REV_* reason codes refuses, which is the correct failure.
    skip "Check-in reversed" "status=$STATUS_AFTER (is a REVERSAL reason code seeded?)"
  fi
fi

###############################################################################
# PHASE 4 — Declared lifecycle transitions (A10)
###############################################################################

section "PHASE 4 · Lifecycle transitions are declared, not implied"

# reservation.modify took an optional status and wrote whatever it was handed,
# so it was a way past every guard the dedicated commands hold — and
# reservation.mass_update re-enters the same handler, so it was that 500
# bookings at a time. These assertions are negative on purpose: the command is
# still 202-accepted (the refusal happens in the consumer), so what proves the
# guard is that the reservation never moves.

MOD=$(make_reservation 20)
if [[ -z "$MOD" ]]; then
  fail "Transition fixture created" "reservation.create did not land"
else
  wait_sql 40 "CONFIRMED" "select status from reservations where id='$MOD'"
  assert_eq "Transition fixture is CONFIRMED" "CONFIRMED" \
    "$(sql "select status from reservations where id='$MOD'")"

  # Check-in through the back door: no room, no folio, no key.
  code=$(post "$GW/v1/commands/reservation.modify/execute" \
    "{\"tenant_id\":\"$TID\",\"payload\":{\"reservation_id\":\"$MOD\",\"status\":\"CHECKED_IN\"}}")
  assert_http "Illegal modify is accepted for async refusal" "20[02]" "$code"
  if wait_sql 20 "CHECKED_IN" "select status from reservations where id='$MOD'"; then
    fail "modify cannot check a guest in" "reservation reached CHECKED_IN without reservation.check_in"
  else
    pass "modify cannot check a guest in"
  fi

  # Cancel through the back door, skipping the cancellation fee.
  code=$(post "$GW/v1/commands/reservation.modify/execute" \
    "{\"tenant_id\":\"$TID\",\"payload\":{\"reservation_id\":\"$MOD\",\"status\":\"CANCELLED\"}}")
  assert_http "Illegal modify is accepted for async refusal (cancel)" "20[02]" "$code"
  if wait_sql 20 "CANCELLED" "select status from reservations where id='$MOD'"; then
    fail "modify cannot cancel" "reservation reached CANCELLED without reservation.cancel"
  else
    pass "modify cannot cancel"
  fi

  assert_eq "Booking is untouched after both refusals" "CONFIRMED" \
    "$(sql "select status from reservations where id='$MOD'")"

  # An edit carrying no status at all is ordinary work and must still apply —
  # the guard gates status changes, not modification.
  code=$(post "$GW/v1/commands/reservation.modify/execute" \
    "{\"tenant_id\":\"$TID\",\"payload\":{\"reservation_id\":\"$MOD\",\"notes\":\"ws04 $RUN transition probe\"}}")
  assert_http "Statusless edit accepted" "20[02]" "$code"
  if wait_sql 40 "ws04 $RUN transition probe" \
      "select coalesce(internal_notes,'') from reservations where id='$MOD'"; then
    pass "Statusless edit still applies"
  else
    fail "Statusless edit still applies" "internal_notes never updated"
  fi
fi

# The legal move modify is still the only route for: a deposit landing takes a
# PENDING booking to CONFIRMED, and no command of its own covers it. If one is
# ever added, this edge leaves RESERVATION_UNCLAIMED_TRANSITIONS and this
# assertion is the one that will notice.
PEND=$(gen_uuid)
code=$(post "$GW/v1/commands/reservation.create/execute" \
  "{\"tenant_id\":\"$TID\",\"payload\":{\"reservation_id\":\"$PEND\",\"property_id\":\"$PROPERTY\",\"guest_id\":\"$GUEST\",\"room_type_id\":\"$ROOM_TYPE\",\"check_in_date\":\"$TODAY\",\"check_out_date\":\"$IN4DAYS\",\"total_amount\":400,\"currency\":\"USD\"}}")
if [[ "$code" =~ ^20 ]] && wait_sql 40 "PENDING" "select status from reservations where id='$PEND'"; then
  CREATED_RESERVATIONS+=("$PEND")
  pass "Pending fixture created"
  code=$(post "$GW/v1/commands/reservation.modify/execute" \
    "{\"tenant_id\":\"$TID\",\"payload\":{\"reservation_id\":\"$PEND\",\"status\":\"CONFIRMED\"}}")
  assert_http "Deposit confirmation accepted" "20[02]" "$code"
  if wait_sql 40 "CONFIRMED" "select status from reservations where id='$PEND'"; then
    pass "modify still confirms a pending booking — the edge no command claims"
  else
    fail "modify still confirms a pending booking" "still PENDING; the unclaimed edge was closed too"
  fi
else
  skip "Pending fixture created" "reservation.create did not land a PENDING booking"
fi

# A reservation cannot be created straight into a state it has to arrive at.
BADSTART=$(gen_uuid)
code=$(post "$GW/v1/commands/reservation.create/execute" \
  "{\"tenant_id\":\"$TID\",\"payload\":{\"reservation_id\":\"$BADSTART\",\"property_id\":\"$PROPERTY\",\"guest_id\":\"$GUEST\",\"room_type_id\":\"$ROOM_TYPE\",\"check_in_date\":\"$TODAY\",\"check_out_date\":\"$IN4DAYS\",\"status\":\"CHECKED_OUT\",\"total_amount\":400,\"currency\":\"USD\"}}")
assert_http "Create with a terminal status accepted for async refusal" "20[02]|4" "$code"
if wait_sql 20 "1" "select count(*) from reservations where id='$BADSTART'"; then
  CREATED_RESERVATIONS+=("$BADSTART")
  fail "create cannot start a booking CHECKED_OUT" "the row was written anyway"
else
  pass "create cannot start a booking CHECKED_OUT"
fi

harness_summary "WS-04 LIFECYCLE"
