# Reports — a realistic operating day
#
# The report endpoints are wired and correct; they just compute over whatever
# the day actually holds. On a thin database every one of them answers 200 with
# zeros, which reads as "reports are broken" when it is really "nothing has
# happened yet". in-house in particular is empty until somebody is CHECKED_IN —
# a CONFIRMED reservation does not appear on it.
#
# So this seeder produces the states the reports slice by rather than more rows:
# arrivals due in, guests in-house, and a departure (which is also what gives
# Housekeeping something to clean).
#
# Each check-in needs its own AVAILABLE room — a room is OCCUPIED after the
# first, so the cohort is capped at the number of free rooms.
seed_operations_day() {
  local tok="$1" tid="$2" pid="$3" rtid="$4" lbl="$5"
  TOKEN="$tok"; CUR_TID="$tid"

  [[ -n "$rtid" ]] || { skip "Operating day seeded ($lbl)" "no room type"; return; }

  get "$GW/v1/rooms?tenant_id=$tid&property_id=$pid&limit=100" >/dev/null
  local -a rooms=(); local r
  for r in $(jq -r '(if type=="array" then . else (.data // []) end)
      | map(select((.status // .room_status // "" | ascii_upcase) == "AVAILABLE"))
      | .[] | (.room_id // .id)' "$RESP_FILE" 2>/dev/null); do
    rooms+=("$r")
  done
  if [[ ${#rooms[@]} -eq 0 ]]; then
    skip "Operating day seeded ($lbl)" "no AVAILABLE rooms to check into"
    return
  fi

  # Top up to a handful of reservations so arrivals/pace have something to show.
  get "$GW/v1/reservations?tenant_id=$tid&property_id=$pid&limit=200" >/dev/null
  local have; have=$(resp_count)
  local want=5 i
  if [[ "$have" -lt "$want" ]]; then
    get "$GW/v1/guests?tenant_id=$tid&limit=10" >/dev/null
    local gid; gid=$(resp_first "id")
    if [[ -n "$gid" ]]; then
      for ((i = have; i < want; i++)); do
        send_command "reservation.create #$((i + 1)) ($lbl)" \
          "reservation.create" \
          "{\"property_id\":\"$pid\",\"guest_id\":\"$gid\",\"room_type_id\":\"$rtid\",\"check_in_date\":\"$TODAY\",\"check_out_date\":\"$IN3DAYS\",\"status\":\"CONFIRMED\",\"source\":\"DIRECT\",\"adults\":2,\"children\":0,\"total_amount\":$((360 + i * 20)).00,\"currency\":\"USD\"}"
      done
      poll_count "$GW/v1/reservations?tenant_id=$tid&property_id=$pid&limit=200" "$want" 60 >/dev/null
    fi
  fi

  # Drive a few into the house. force bypasses the deposit gate.
  get "$GW/v1/reservations?tenant_id=$tid&property_id=$pid&limit=200" >/dev/null
  local -a pending=(); local x
  for x in $(jq -r '(if type=="array" then . else (.data // []) end)
      | map(select((.status // "" | ascii_upcase) as $s | $s == "CONFIRMED" or $s == "PENDING"))
      | .[].id' "$RESP_FILE" 2>/dev/null); do
    pending+=("$x")
  done

  local max_in=3
  [[ ${#rooms[@]} -lt $max_in ]] && max_in=${#rooms[@]}
  [[ ${#pending[@]} -lt $max_in ]] && max_in=${#pending[@]}

  local n=0
  while [[ $n -lt $max_in ]]; do
    send_command "reservation.check_in #$((n + 1)) ($lbl)" \
      "reservation.check_in" \
      "{\"reservation_id\":\"${pending[$n]}\",\"room_id\":\"${rooms[$n]}\",\"force\":true,\"notes\":\"Seeded in-house\"}"
    n=$((n + 1))
  done

  # The report endpoints answer {"total":N,"items":[...]} — neither a bare array
  # nor the {data:[...]} envelope resp_count knows, so read total directly.
  local in_house=0 waited=0
  while [[ $waited -lt 60 ]]; do
    get "$GW/v1/reports/in-house?tenant_id=$tid&property_id=$pid&business_date=$TODAY" >/dev/null
    in_house=$(jq -r '.total // (.items | length) // 0' "$RESP_FILE" 2>/dev/null || echo 0)
    [[ "$in_house" -ge 1 ]] && break
    sleep 4; waited=$((waited + 4))
  done
  assert_gte "Operating day — guests in-house ($lbl)" "$in_house" 1

  # One departure, which is also what puts a dirty room in front of Housekeeping.
  get "$GW/v1/reservations?tenant_id=$tid&property_id=$pid&limit=200" >/dev/null
  local out_id
  out_id=$(jq -r '(if type=="array" then . else (.data // []) end)
      | map(select((.status // "" | ascii_upcase) == "CHECKED_IN")) | .[0].id // empty' "$RESP_FILE" 2>/dev/null)
  if [[ -n "$out_id" ]]; then
    send_command "reservation.check_out ($lbl)" \
      "reservation.check_out" \
      "{\"reservation_id\":\"$out_id\",\"force\":true,\"express\":true,\"notes\":\"Seeded departure\"}"
    # departures takes a date range (start_date/end_date), not business_date —
    # passing the wrong one is a 400, which polls as "zero departures" and looks
    # like the checkout never happened. in-house next door takes no date at all.
    local departures=0 dwait=0
    while [[ $dwait -lt 45 ]]; do
      get "$GW/v1/reports/departures?tenant_id=$tid&property_id=$pid&start_date=$TODAY&end_date=$IN5DAYS" >/dev/null
      departures=$(jq -r '.total // (.items | length) // 0' "$RESP_FILE" 2>/dev/null || echo 0)
      [[ "$departures" -ge 1 ]] && break
      sleep 4; dwait=$((dwait + 4))
    done
    assert_gte "Operating day — departure recorded ($lbl)" "$departures" 1
  else
    skip "Operating day — departure ($lbl)" "nothing checked in to check out"
  fi
}
