# Housekeeping → Incident Log
#
# POST /v1/incidents on housekeeping-service, gated on facility-maintenance.
#
# incident_reports.created_by is NOT NULL and the handler refuses to attribute a
# report to a placeholder actor, so this must run with a real user token — the
# tenant tokens Phase 0 mints satisfy that.
#
# severity is (minor|moderate|serious|critical|catastrophic) — note it does NOT
# include "low"/"high", and severity_score is CHECK-bounded to 1..10.
seed_incidents() {
  local tok="$1" tid="$2" pid="$3" lbl="$4"
  TOKEN="$tok"

  local before
  get "$GW/v1/incidents?tenant_id=$tid&property_id=$pid&limit=200" >/dev/null
  before=$(resp_count)
  if [[ "$before" -ge 3 ]]; then
    pass "Incidents seeded ($lbl) — already has $before"
    return
  fi

  local specs=(
    "slip_fall|moderate|minor|4|Guest slipped near pool|Pool deck|Wet floor signage placed; guest declined medical attention"
    "equipment_failure|minor|none|2|Lift 2 out of service|Main lobby|Lift isolated and contractor called"
    "guest_complaint|minor|none|1|Noise complaint from 512|Floor 5|Adjacent party asked to lower volume; guest offered late checkout"
  )
  local spec itype severity injury score title loc actions n=0
  for spec in "${specs[@]}"; do
    IFS='|' read -r itype severity injury score title loc actions <<<"$spec"
    local code
    code=$(post "$GW/v1/incidents" \
      "{\"tenant_id\":\"$tid\",\"property_id\":\"$pid\",\"incident_title\":\"$title ($RUN_TAG)\",\"incident_type\":\"$itype\",\"severity\":\"$severity\",\"severity_score\":$score,\"injury_severity\":\"$injury\",\"incident_date\":\"$TODAY\",\"incident_time\":\"14:15\",\"incident_location\":\"$loc\",\"incident_description\":\"$title — logged by E2E $RUN_TAG\",\"immediate_actions_taken\":\"$actions\",\"police_notified\":false,\"discovered_by_name\":\"Duty Manager\"}")
    [[ "$code" =~ ^2 ]] && n=$((n + 1))
  done

  local total
  total=$(poll_count "$GW/v1/incidents?tenant_id=$tid&property_id=$pid&limit=200" 3 40)
  assert_gte "Incidents seeded ($lbl)" "$total" 3
}
