# Housekeeping → Shift Handovers
#
# POST /v1/shift-handovers on core-service. Required: tenant_id, property_id,
# shift_date, department, outgoing_shift, outgoing_user_id, incoming_shift,
# incoming_user_id, key_points.
#
# The two user ids must be real users, so they are read back from /v1/users
# rather than invented. Note /v1/users caps limit at 100 — asking for 200 is a
# 400, not a clamp.
seed_shift_handovers() {
  local tok="$1" tid="$2" pid="$3" lbl="$4"
  TOKEN="$tok"

  local before
  get "$GW/v1/shift-handovers?tenant_id=$tid&property_id=$pid&limit=200" >/dev/null
  before=$(resp_count)
  if [[ "$before" -ge 3 ]]; then
    pass "Shift handovers seeded ($lbl) — already has $before"
    return
  fi

  get "$GW/v1/users?tenant_id=$tid&limit=100" >/dev/null
  local u_out u_in
  u_out=$(jq -r '(if type=="array" then . else (.data // []) end) | .[0].id // empty' "$RESP_FILE" 2>/dev/null)
  u_in=$(jq -r '(if type=="array" then . else (.data // []) end) | (.[1] // .[0]).id // empty' "$RESP_FILE" 2>/dev/null)
  if [[ -z "$u_out" || -z "$u_in" ]]; then
    skip "Shift handovers seeded ($lbl)" "no users to attribute the handover to"
    return
  fi

  local specs=(
    "front_desk|morning|afternoon|false|3 late checkouts pending; VIP arrival in 402 at 16:00"
    "housekeeping|afternoon|evening|true|Room 512 deep clean not finished — carried to evening shift"
    "front_desk|evening|night|false|Night audit ready to run; no outstanding cash variances"
  )
  local spec dept out_shift in_shift follow_up points n=0
  for spec in "${specs[@]}"; do
    IFS='|' read -r dept out_shift in_shift follow_up points <<<"$spec"
    local code
    code=$(post "$GW/v1/shift-handovers" \
      "{\"tenant_id\":\"$tid\",\"property_id\":\"$pid\",\"shift_date\":\"$TODAY\",\"department\":\"$dept\",\"outgoing_shift\":\"$out_shift\",\"outgoing_user_id\":\"$u_out\",\"incoming_shift\":\"$in_shift\",\"incoming_user_id\":\"$u_in\",\"handover_title\":\"${dept} ${out_shift}→${in_shift} ($RUN_TAG)\",\"key_points\":\"$points\",\"requires_follow_up\":$follow_up,\"important_notes\":\"Seeded by E2E $RUN_TAG\"}")
    [[ "$code" =~ ^2 ]] && n=$((n + 1))
  done

  local total
  total=$(poll_count "$GW/v1/shift-handovers?tenant_id=$tid&property_id=$pid&limit=200" 3 40)
  assert_gte "Shift handovers seeded ($lbl)" "$total" 3
}
