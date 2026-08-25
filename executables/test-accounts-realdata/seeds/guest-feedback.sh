# Guests → Guest Feedback
#
# POST /v1/guest-feedback on core-service (single table, no fan-out — HTTP write
# per the rule in ui-gaps/18-write-path-gap.md).
#
# overall_rating is CHECK-bounded to 0..rating_scale, so rating_scale must be
# sent whenever a rating above 5 is used.
#
# feedback_source is UPPERCASE here, unlike the lowercase enums on the
# housekeeping registers — the API rejects a lowercase value outright.
seed_guest_feedback() {
  local tok="$1" tid="$2" pid="$3" lbl="$4"
  TOKEN="$tok"

  local before
  get "$GW/v1/guest-feedback?tenant_id=$tid&property_id=$pid&limit=200" >/dev/null
  before=$(resp_count)
  if [[ "$before" -ge 4 ]]; then
    pass "Guest feedback seeded ($lbl) — already has $before"
    return
  fi

  get "$GW/v1/guests?tenant_id=$tid&limit=50" >/dev/null
  local gid; gid=$(resp_first "id")

  local guest_field=""
  [[ -n "$gid" ]] && guest_field=",\"guest_id\":\"$gid\""

  # A spread of sentiment, not four glowing reviews — the screen's filters and
  # sentiment badges are only exercised if the data disagrees with itself.
  local specs=(
    "EMAIL_SURVEY|5|5|5|positive|true|Outstanding stay|Staff went out of their way to help."
    "OTA_REVIEW|4|4|3|positive|true|Great location|Close to everything, room a little small."
    "EMAIL|2|3|1|negative|false|Slow check-in|Waited 40 minutes at the desk on arrival."
    "STAFF_ENTERED|3|3|3|neutral|true|Fine, unremarkable|Everything worked, nothing stood out."
  )
  local spec src overall clean staff sentiment recommend title body n=0
  for spec in "${specs[@]}"; do
    IFS='|' read -r src overall clean staff sentiment recommend title body <<<"$spec"
    local code
    code=$(post "$GW/v1/guest-feedback" \
      "{\"tenant_id\":\"$tid\",\"property_id\":\"$pid\"$guest_field,\"feedback_source\":\"$src\",\"rating_scale\":5,\"overall_rating\":$overall,\"cleanliness_rating\":$clean,\"staff_rating\":$staff,\"sentiment_label\":\"$sentiment\",\"would_recommend\":$recommend,\"would_return\":$recommend,\"is_public\":true,\"language_code\":\"en\",\"review_title\":\"$title\",\"review_text\":\"$body ($RUN_TAG)\"}")
    [[ "$code" =~ ^2 ]] && n=$((n + 1))
  done

  local total
  total=$(poll_count "$GW/v1/guest-feedback?tenant_id=$tid&property_id=$pid&limit=200" 4 40)
  assert_gte "Guest feedback seeded ($lbl)" "$total" 4
}
