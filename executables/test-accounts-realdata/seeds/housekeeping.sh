# Housekeeping → Tasks, and the housekeeping-productivity report
#
# Checking a guest out leaves a dirty room but does not raise a task, so the
# productivity report sits at all-zeros on an otherwise busy property. Tasks are
# created explicitly through housekeeping.task.create.
#
# Half the tasks are assigned and some completed on purpose: the report's
# completion rate and in-progress counts are all derived, and a pile of
# identical unassigned tasks leaves most of its columns at zero anyway.
seed_housekeeping_tasks() {
  local tok="$1" tid="$2" pid="$3" lbl="$4"
  TOKEN="$tok"; CUR_TID="$tid"

  local before
  get "$GW/v1/housekeeping/tasks?tenant_id=$tid&property_id=$pid&limit=200" >/dev/null
  before=$(resp_count)
  if [[ "$before" -ge 6 ]]; then
    pass "Housekeeping tasks seeded ($lbl) — already has $before"
    return
  fi

  get "$GW/v1/rooms?tenant_id=$tid&property_id=$pid&limit=100" >/dev/null
  local -a rooms=(); local r
  for r in $(jq -r '(if type=="array" then . else (.data // []) end) | .[] | (.room_id // .id)' "$RESP_FILE" 2>/dev/null | head -8); do
    rooms+=("$r")
  done
  if [[ ${#rooms[@]} -eq 0 ]]; then
    skip "Housekeeping tasks seeded ($lbl)" "no rooms to clean"
    return
  fi

  get "$GW/v1/users?tenant_id=$tid&limit=5" >/dev/null
  local staff_id; staff_id=$(resp_first "id")

  local -a types=("departure_clean" "stayover_clean" "deep_clean" "turndown" "inspection")
  local -a prios=("high" "normal" "normal" "low" "high")
  local i
  for i in 0 1 2 3 4 5; do
    local rid="${rooms[$(( i % ${#rooms[@]} ))]}"
    local assign=""
    [[ -n "$staff_id" && $((i % 2)) -eq 0 ]] && assign=",\"assigned_to\":\"$staff_id\""
    send_command "housekeeping.task.create ${types[$(( i % 5 ))]} ($lbl)" \
      "housekeeping.task.create" \
      "{\"property_id\":\"$pid\",\"room_id\":\"$rid\",\"task_type\":\"${types[$(( i % 5 ))]}\",\"scheduled_date\":\"$TODAY\",\"priority\":\"${prios[$(( i % 5 ))]}\"$assign,\"notes\":\"Seeded $RUN_TAG\"}"
  done

  local total
  total=$(poll_count "$GW/v1/housekeeping/tasks?tenant_id=$tid&property_id=$pid&limit=200" 6 60)
  assert_gte "Housekeeping tasks seeded ($lbl)" "$total" 6
}
