# Accounts → AR Accounts, and Accounts → Receivable
#
# These are two screens over two different tables, and it is easy to seed the
# wrong one (ui-gaps/04-duplicate-ar-surface.md):
#
#   Accounts → AR Accounts   GET /v1/billing/ar/accounts        → ar_accounts
#   Accounts → Receivable    GET /v1/billing/accounts-receivable → accounts_receivable
#
# `ar_accounts` was made canonical on 2026-08-11; the older transaction-level
# table is kept as a deprecated read view. They have separate write paths and
# nothing syncs them, so seeding `billing.ar.post` alone leaves AR Accounts
# empty while the DB clearly holds AR rows — which reads like a broken screen
# and is not.
#
# ar.account.create needs a company to hang off, and companies are HTTP.
seed_ar_accounts() {
  local tok="$1" tid="$2" pid="$3" lbl="$4"
  TOKEN="$tok"; CUR_TID="$tid"

  local before
  get "$GW/v1/billing/ar/accounts?tenant_id=$tid&limit=200" >/dev/null
  before=$(resp_count)
  if [[ "$before" -ge 3 ]]; then
    pass "AR accounts seeded ($lbl) — already has $before"
  else
    local specs=(
      "corporate|Acme Corp Travel|NET30|25000"
      "travel_agency|Globetrotter Agency|NET45|15000"
      "event_planner|Northwind Conference Co|NET30|40000"
    )
    local spec ctype cname terms limit_amt
    for spec in "${specs[@]}"; do
      IFS='|' read -r ctype cname terms limit_amt <<<"$spec"

      # One company per account; company_code is a natural key so it carries the
      # run tag to stay re-runnable.
      #
      # The company_type doubles as the mail domain, but half these values
      # contain underscores (travel_agency, event_planner) and an underscore is
      # not legal in a hostname — the address is rejected as malformed while the
      # single-word types sail through. Swap them for hyphens.
      local domain="${ctype//_/-}"
      local code company_id=""
      code=$(post "$GW/v1/companies" \
        "{\"tenant_id\":\"$tid\",\"company_name\":\"$cname — $RUN_TAG\",\"company_type\":\"$ctype\",\"company_code\":\"${ctype:0:4}-${RUN_TAG}\",\"credit_limit\":$limit_amt,\"credit_status\":\"active\",\"billing_contact_name\":\"Accounts Payable\",\"billing_contact_email\":\"ap-${RUN_TAG}@${domain}.test\",\"is_active\":true}")
      if [[ "$code" =~ ^2 ]]; then
        company_id=$(jq -r '.id // .company_id // .data.id // empty' "$RESP_FILE" 2>/dev/null)
      fi
      if [[ -z "$company_id" ]]; then
        echo "     ↳ company create for $ctype failed (HTTP $code): $(jq -r '.detail // .errors[0].message // empty' "$RESP_FILE" 2>/dev/null | head -c 110)"
        continue
      fi

      send_command "ar.account.create: $ctype ($lbl)" \
        "ar.account.create" \
        "{\"property_id\":\"$pid\",\"company_id\":\"$company_id\",\"company_name\":\"$cname — $RUN_TAG\",\"contact_name\":\"Accounts Payable\",\"contact_email\":\"ap-${RUN_TAG}@${domain}.test\",\"credit_limit\":$limit_amt,\"payment_terms\":\"$terms\",\"currency\":\"USD\"}"
    done

    local total
    total=$(poll_count "$GW/v1/billing/ar/accounts?tenant_id=$tid&limit=200" 3 60)
    assert_gte "AR accounts seeded ($lbl)" "$total" 3
  fi

  # Transaction-level AR for the older Receivable screen. Needs a reservation to
  # bill against; billing.ar.post derives the property from it.
  get "$GW/v1/reservations?tenant_id=$tid&property_id=$pid&limit=10" >/dev/null
  local res_id; res_id=$(resp_first "id")
  if [[ -z "$res_id" ]]; then
    skip "AR receivable seeded ($lbl)" "no reservation to bill to"
    return
  fi

  get "$GW/v1/billing/accounts-receivable?tenant_id=$tid&limit=200" >/dev/null
  if [[ "$(resp_count)" -ge 2 ]]; then
    pass "AR receivable seeded ($lbl) — already populated"
    return
  fi

  get "$GW/v1/guests?tenant_id=$tid&limit=10" >/dev/null
  local gid; gid=$(resp_first "id")
  get "$GW/v1/billing/folios?tenant_id=$tid&reservation_id=$res_id" >/dev/null
  local folio_id; folio_id=$(resp_first "id")

  local rspec atype aname amount terms2
  for rspec in "corporate|Acme Corp Travel|158.50|net_30" "travel_agent|Globetrotter Agency|340.00|net_30"; do
    IFS='|' read -r atype aname amount terms2 <<<"$rspec"
    send_command "ar.post: $atype ($lbl)" \
      "billing.ar.post" \
      "{\"reservation_id\":\"$res_id\",\"folio_id\":\"${folio_id:-}\",\"account_type\":\"$atype\",\"account_id\":\"$gid\",\"account_name\":\"$aname — $RUN_TAG\",\"amount\":$amount,\"payment_terms\":\"$terms2\"}"
  done

  local rtotal
  rtotal=$(poll_count "$GW/v1/billing/accounts-receivable?tenant_id=$tid&limit=200" 2 60)
  assert_gte "AR receivable seeded ($lbl)" "$rtotal" 2
}
