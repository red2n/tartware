# Reservations → Waitlist
#
# Waitlist has no HTTP write path by design: the gateway registers GET only and
# writes go through the command bus (ui-gaps/18-write-path-gap.md). So this
# seeds via reservation.waitlist_add rather than POST /v1/waitlist, which does
# not exist and would 404 at the edge.
#
# waitlist_entries CHECK constraints use UPPERCASE enums — unlike the
# housekeeping registers, which are lowercase.
seed_waitlist() {
  local tok="$1" tid="$2" pid="$3" rtid="$4" lbl="$5"
  TOKEN="$tok"; CUR_TID="$tid"

  local before
  get "$GW/v1/waitlist?tenant_id=$tid&property_id=$pid&limit=200" >/dev/null
  before=$(resp_count)
  if [[ "$before" -ge 3 ]]; then
    pass "Waitlist seeded ($lbl) — already has $before"
    return
  fi

  # A waitlist entry is a guest who could not be booked, so it needs a guest to
  # point at. Reuse the ones the reservation seeding already created.
  get "$GW/v1/guests?tenant_id=$tid&limit=50" >/dev/null
  local gid; gid=$(resp_first "id")
  if [[ -z "$gid" ]]; then
    skip "Waitlist seeded ($lbl)" "no guest to attach"
    return
  fi

  local specs=(
    "ACTIVE|EITHER|2|1|Anniversary suite request"
    "ACTIVE|DATE|1|2|Flexible on dates, wants sea view"
    "OFFERED|ROOM_TYPE|3|1|Offered upgrade, awaiting reply"
  )
  # requested_room_type_id is optional, but an empty string is not a valid uuid —
  # omit the field entirely when the caller could not resolve a room type.
  local rt_field=""
  [[ -n "$rtid" ]] && rt_field=",\"requested_room_type_id\":\"$rtid\""

  local spec status flex adults rooms note
  for spec in "${specs[@]}"; do
    IFS='|' read -r status flex adults rooms note <<<"$spec"
    send_command "waitlist_add: $status ($lbl)" \
      "reservation.waitlist_add" \
      "{\"property_id\":\"$pid\",\"guest_id\":\"$gid\"$rt_field,\"arrival_date\":\"$IN3DAYS\",\"departure_date\":\"$IN5DAYS\",\"number_of_adults\":$adults,\"number_of_rooms\":$rooms,\"flexibility\":\"$flex\",\"waitlist_status\":\"$status\",\"notes\":\"$note — $RUN_TAG\"}"
  done

  local total
  total=$(poll_count "$GW/v1/waitlist?tenant_id=$tid&property_id=$pid&limit=200" 3 60)
  assert_gte "Waitlist seeded ($lbl)" "$total" 3
}
