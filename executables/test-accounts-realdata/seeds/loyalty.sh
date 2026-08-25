# Loyalty → Transactions
#
# The screen is a lookup, not a list: loyalty.ts refuses to fetch until a
# program_id is typed into the box ("Enter a program ID to load transactions"),
# so it renders empty no matter how much data exists. Seeding therefore has to
# hand back a program id worth pasting — this seeder prints one.
#
# Enrolment is per guest and `guest_loyalty_programs.membership_number` is
# UNIQUE, so re-enrolling the same guest collides. The collision is classified
# retryable, so it burns four attempts and lands in the DLQ while the command
# still answers 202 — the only visible symptom is a screen that stays empty.
# Enrol a guest created for this run instead of reusing whoever comes back first.
#
# program_id is client-generated: enrol invents the id rather than returning one,
# so the ledger commands can use it immediately.
SEEDED_PROGRAM_ID=""

seed_loyalty() {
  local tok="$1" tid="$2" pid="$3" lbl="$4"
  TOKEN="$tok"; CUR_TID="$tid"

  local email="loyalty-${RUN_TAG}@tartware-test.local"
  send_command "guest.register for loyalty ($lbl)" \
    "guest.register" \
    "{\"first_name\":\"Loyalty\",\"last_name\":\"Member-$RUN_TAG\",\"email\":\"$email\",\"phone\":\"+1-415-555-$(printf '%04d' $((RANDOM % 10000)))\",\"nationality\":\"US\"}"

  local gid=""
  if [[ "$(poll_count "$GW/v1/guests?tenant_id=$tid&email=$email" 1 45)" -ge 1 ]]; then
    gid=$(resp_first "id")
  fi
  if [[ -z "$gid" ]]; then
    skip "Loyalty transactions seeded ($lbl)" "loyalty guest did not materialise"
    return
  fi

  local prog_id; prog_id=$(gen_uuid)
  SEEDED_PROGRAM_ID="$prog_id"

  # program_tier is a lowercase CHECK enum
  # (bronze|silver|gold|platinum|diamond|elite).
  send_command "loyalty.program.enroll ($lbl)" \
    "loyalty.program.enroll" \
    "{\"guest_id\":\"$gid\",\"program_id\":\"$prog_id\",\"property_id\":\"$pid\",\"program_name\":\"Tartware Rewards\",\"program_tier\":\"gold\",\"points_balance\":5000,\"enrollment_channel\":\"property\"}"

  # A one-row ledger shows nothing useful — earn and redeem so the screen has
  # both directions and a running balance to render.
  send_command "loyalty.points.earn ($lbl)" \
    "loyalty.points.earn" \
    "{\"guest_id\":\"$gid\",\"program_id\":\"$prog_id\",\"points\":2500,\"reference_type\":\"stay\",\"description\":\"Stay credit — seeded $RUN_TAG\"}"
  send_command "loyalty.points.redeem ($lbl)" \
    "loyalty.points.redeem" \
    "{\"guest_id\":\"$gid\",\"program_id\":\"$prog_id\",\"points\":500,\"reference_type\":\"reward\",\"description\":\"Room upgrade — seeded $RUN_TAG\"}"

  local total
  total=$(poll_count "$GW/v1/loyalty/transactions?tenant_id=$tid&program_id=$prog_id&limit=100" 2 60)
  assert_gte "Loyalty transactions seeded ($lbl)" "$total" 2
  [[ "$total" -ge 2 ]] && echo "     ↳ program_id for the Loyalty screen: $prog_id"
}
