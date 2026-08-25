# Housekeeping → Lost & Found
#
# POST /v1/lost-and-found on housekeeping-service. Gated on the
# facility-maintenance module, which Phase 0 enables for both tenants — if that
# ever stops being true this seeder 403s rather than silently writing nothing.
#
# item_category and item_status are lowercase CHECK enums.
seed_lost_and_found() {
  local tok="$1" tid="$2" pid="$3" lbl="$4"
  TOKEN="$tok"

  local before
  get "$GW/v1/lost-and-found?tenant_id=$tid&property_id=$pid&limit=200" >/dev/null
  before=$(resp_count)
  if [[ "$before" -ge 4 ]]; then
    pass "Lost & found seeded ($lbl) — already has $before"
    return
  fi

  # Mixed statuses so the screen's status filter has something to separate, and
  # one valuable item so the secure-storage flag is exercised.
  local specs=(
    "electronics|Apple AirPods Pro|Room 204|registered|true|249.00"
    "clothing|Navy wool coat|Lobby cloakroom|stored|false|180.00"
    "documents|Passport folder|Restaurant table 12|pending_claim|true|0.00"
    "keys|Car key fob|Pool deck|claimed|false|350.00"
  )
  local spec cat item loc status valuable value n=0
  for spec in "${specs[@]}"; do
    IFS='|' read -r cat item loc status valuable value <<<"$spec"
    local code
    code=$(post "$GW/v1/lost-and-found" \
      "{\"tenant_id\":\"$tid\",\"property_id\":\"$pid\",\"item_name\":\"$item\",\"item_category\":\"$cat\",\"item_description\":\"$item found by housekeeping — E2E $RUN_TAG\",\"item_status\":\"$status\",\"found_date\":\"$TODAY\",\"found_time\":\"10:30\",\"found_location\":\"$loc\",\"found_by_name\":\"Housekeeping Attendant\",\"is_valuable\":$valuable,\"requires_secure_storage\":$valuable,\"estimated_value\":$value,\"hold_days\":90,\"notes\":\"Seeded by E2E $RUN_TAG\"}")
    [[ "$code" =~ ^2 ]] && n=$((n + 1))
  done

  local total
  total=$(poll_count "$GW/v1/lost-and-found?tenant_id=$tid&property_id=$pid&limit=200" 4 40)
  assert_gte "Lost & found seeded ($lbl)" "$total" 4
}
