# Revenue → Promotional Codes
#
# POST /v1/promo-codes on core-service. Required by the API: tenant_id,
# promo_code, promo_name, valid_from, valid_to.
#
# promo_type and discount_type are separate CHECK-constrained enums and they are
# easy to cross up: discount_type is the narrow list
# (percentage|fixed_amount|free_night|upgrade|other), promo_type the wide one
# (discount_percent|discount_fixed|free_night|...).
seed_promo_codes() {
  local tok="$1" tid="$2" pid="$3" lbl="$4"
  TOKEN="$tok"

  local before
  get "$GW/v1/promo-codes?tenant_id=$tid&limit=200" >/dev/null
  before=$(resp_count)
  if [[ "$before" -ge 3 ]]; then
    pass "Promo codes seeded ($lbl) — already has $before"
    return
  fi

  local valid_to
  valid_to=$(date -d "+90 days" +%Y-%m-%d 2>/dev/null || date -v+90d +%Y-%m-%d)

  # promo_code is a natural key — without $RUN_TAG the second run 409s.
  local specs=(
    "SUMMER|Summer Escape|discount_percent|percentage|15|0|active"
    "EARLYBIRD|Early Bird 30|early_bird|percentage|20|0|active"
    "STAYMORE|Stay 3 Pay 2|free_night|free_night|0|0|scheduled"
  )
  local spec code_prefix name ptype dtype pct amt status n=0
  for spec in "${specs[@]}"; do
    IFS='|' read -r code_prefix name ptype dtype pct amt status <<<"$spec"
    local discount_field="\"discount_percent\":$pct"
    [[ "$dtype" == "fixed_amount" ]] && discount_field="\"discount_amount\":$amt,\"discount_currency\":\"USD\""

    local code
    code=$(post "$GW/v1/promo-codes" \
      "{\"tenant_id\":\"$tid\",\"property_id\":\"$pid\",\"promo_code\":\"${code_prefix}-${RUN_TAG}\",\"promo_name\":\"$name\",\"promo_description\":\"Seeded by E2E $RUN_TAG\",\"promo_type\":\"$ptype\",\"promo_status\":\"$status\",\"discount_type\":\"$dtype\",$discount_field,\"valid_from\":\"$TODAY\",\"valid_to\":\"$valid_to\",\"is_active\":true,\"is_public\":true,\"display_on_website\":true,\"has_usage_limit\":true,\"total_usage_limit\":100,\"per_user_limit\":1}")
    [[ "$code" =~ ^2 ]] && n=$((n + 1))
  done

  local total
  total=$(poll_count "$GW/v1/promo-codes?tenant_id=$tid&limit=200" 3 40)
  assert_gte "Promo codes seeded ($lbl)" "$total" 3
}
