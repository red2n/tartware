# Accounts → Approvals
#
# Required: tenant_id, operation_type, entity_type, entity_id, requested_by.
#
# Both the read and the write go straight to billing-service, because the
# gateway has no route for this prefix at all: with a valid token
# GET and POST $GW/v1/billing/approvals both return
# "Route ...:/v1/billing/approvals not found".
#
# The collection path is write-only — billing-service registers POST on
# /v1/billing/approvals and GET only on /v1/billing/approvals/pending, so
# reading back from the collection 404s even when talking to the service
# directly. The pending list is the screen's queue and returns {"data":[...]}.
#
# That is a genuine gap, not a seeding problem — Accounts → Approvals cannot be
# read by the UI through the gateway either, so seeding alone will not light the
# screen up until a proxy route is registered. Seed anyway so the data is there
# the moment it is.
#
# (An unauthenticated probe returns 401 here, not 404, because the auth hook
# runs before routing — do not read that as proof the route exists.)
#
# operation_type is a narrow enum and does NOT include the obvious
# RATE_OVERRIDE/REFUND: it is INVOICE_VOID | WRITEOFF | FISCAL_REOPEN |
# FOLIO_REOPEN | CHARGEBACK_RESPONSE | COMP_LARGE | MANUAL_DATE_ROLL.
BILLING_DIRECT="${BILLING_DIRECT:-http://localhost:3025}"

seed_approvals() {
  local tok="$1" tid="$2" pid="$3" lbl="$4"
  TOKEN="$tok"

  local before
  get "$BILLING_DIRECT/v1/billing/approvals/pending?tenant_id=$tid&limit=200" >/dev/null
  before=$(resp_count)
  if [[ "$before" -ge 3 ]]; then
    pass "Approvals seeded ($lbl) — already has $before"
    return
  fi

  get "$GW/v1/users?tenant_id=$tid&limit=100" >/dev/null
  local requester
  requester=$(jq -r '(if type=="array" then . else (.data // []) end) | .[0].id // empty' "$RESP_FILE" 2>/dev/null)
  if [[ -z "$requester" ]]; then
    skip "Approvals seeded ($lbl)" "no user to attribute the request to"
    return
  fi

  # Approvals hang off a real billing entity; a folio is the one this pipeline
  # always has by the time Phase 6c runs.
  get "$GW/v1/billing/folios?tenant_id=$tid&limit=50" >/dev/null
  local folio_id; folio_id=$(resp_first "id")
  if [[ -z "$folio_id" ]]; then
    skip "Approvals seeded ($lbl)" "no folio to raise an approval against"
    return
  fi

  # required_role must be a real TenantRoleEnum value. It was a free-form
  # VARCHAR when this seeder was written, and "FINANCE" — a role the product has
  # never had — was accepted and stored. A01 made the column load-bearing (the
  # approver's role is now compared against it, failing closed on a value that
  # is not a known role), so the route validates it and this row 400'd: three
  # approvals were posted and two landed.
  #
  # OWNER matches where a write-off actually sits on the ladder — it is the
  # approver role COMMAND_DUAL_CONTROL demands for the write-off commands.
  local specs=(
    "COMP_LARGE|MANAGER|Comp dinner for service recovery"
    "FOLIO_REOPEN|MANAGER|Reopen folio to post a late minibar charge"
    "WRITEOFF|OWNER|Write off uncollectable balance under policy"
  )
  local spec op role desc n=0
  for spec in "${specs[@]}"; do
    IFS='|' read -r op role desc <<<"$spec"
    local code
    code=$(post "$BILLING_DIRECT/v1/billing/approvals" \
      "{\"tenant_id\":\"$tid\",\"property_id\":\"$pid\",\"operation_type\":\"$op\",\"entity_type\":\"folio\",\"entity_id\":\"$folio_id\",\"requested_by\":\"$requester\",\"requested_by_name\":\"E2E Seeder\",\"required_role\":\"$role\",\"description\":\"$desc — E2E $RUN_TAG\",\"operation_payload\":{\"amount\":125.00,\"currency\":\"USD\",\"run_tag\":\"$RUN_TAG\"}}")
    [[ "$code" =~ ^2 ]] && n=$((n + 1))
  done

  local total
  total=$(poll_count "$BILLING_DIRECT/v1/billing/approvals/pending?tenant_id=$tid&limit=200" 3 40)
  assert_gte "Approvals seeded ($lbl)" "$total" 3
}
