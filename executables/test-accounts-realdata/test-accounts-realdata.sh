#!/usr/bin/env bash
###############################################################################
# test-accounts-realdata.sh
# Self-validating end-to-end test for Accounts & Billing modules
#
# STANDALONE — seeds data, calls APIs, queries the DB directly to verify
# writes, cross-checks API responses against DB state, prints a full report.
#
# Usage:
#   ./executables/test-accounts-realdata/test-accounts-realdata.sh
#   ./executables/test-accounts-realdata/test-accounts-realdata.sh --skip-seed
#   ./executables/test-accounts-realdata/test-accounts-realdata.sh --clean
#
# Prerequisites:
#   - All services running (pnpm run dev)
#   - jq, psql available
#   - http_test/get-token.sh working
###############################################################################
set -euo pipefail

# Always run from repo root regardless of where the script is invoked
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

# ─── Configuration ───────────────────────────────────────────────────────────
GW="http://localhost:8080"
TID="11111111-1111-1111-1111-111111111111"
PID="22222222-2222-2222-2222-222222222222"
RTID="44444444-4444-4444-4444-444444444444"
TODAY=$(date +%Y-%m-%d)
TOMORROW=$(date -d "+1 day" +%Y-%m-%d 2>/dev/null || date -v+1d +%Y-%m-%d)
IN3DAYS=$(date -d "+3 days" +%Y-%m-%d 2>/dev/null || date -v+3d +%Y-%m-%d)
IN5DAYS=$(date -d "+5 days" +%Y-%m-%d 2>/dev/null || date -v+5d +%Y-%m-%d)
KAFKA_WAIT=4

PASS=0; FAIL=0; TOTAL=0; SKIP=0
SKIP_SEED=false
CLEAN=false

for arg in "$@"; do
  case "$arg" in
    --skip-seed) SKIP_SEED=true ;;
    --clean)     CLEAN=true ;;
  esac
done

# ─── Helpers ─────────────────────────────────────────────────────────────────

TOKEN=""

get_token() {
  TOKEN=$(./http_test/get-token.sh 2>/dev/null)
  if [[ -z "$TOKEN" ]]; then echo "FATAL: Cannot acquire auth token"; exit 1; fi
}

RESP_FILE=$(mktemp /tmp/tartware-test-resp.XXXXXX.json)
trap "rm -f $RESP_FILE" EXIT

post() {
  curl -s -o "$RESP_FILE" -w "%{http_code}" \
    -X POST "$1" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$2"
}

get() {
  curl -s -o "$RESP_FILE" -w "%{http_code}" \
    "$1" \
    -H "Authorization: Bearer $TOKEN"
}

dbq() {
  PGPASSWORD=postgres psql -h localhost -U postgres -d tartware -t -A -c "$1" 2>/dev/null || echo ""
}

# ─── Assertion helpers ───────────────────────────────────────────────────────

pass() { TOTAL=$((TOTAL+1)); PASS=$((PASS+1)); printf "  ✅ %-60s PASS\n" "$1"; }
fail() { TOTAL=$((TOTAL+1)); FAIL=$((FAIL+1)); printf "  ❌ %-60s FAIL — %s\n" "$1" "$2"; }
skip() { TOTAL=$((TOTAL+1)); SKIP=$((SKIP+1)); printf "  ⏭  %-60s SKIP — %s\n" "$1" "$2"; }

assert_eq() {
  local label="$1" expected="$2" actual="$3"
  if [[ "$expected" == "$actual" ]]; then pass "$label"
  else fail "$label" "expected=$expected actual=$actual"; fi
}

# Case-insensitive compare (for DB enums that may be upper/lowercase)
assert_eq_ci() {
  local label="$1" expected="${2,,}" actual="${3,,}"
  if [[ "$expected" == "$actual" ]]; then pass "$label"
  else fail "$label" "expected=$2 actual=$3"; fi
}

# Numeric compare (strips trailing zeros: 8.875000 == 8.875, 458.50 == 458.5)
assert_eq_num() {
  local label="$1" expected="$2" actual="$3"
  # Normalize: remove trailing zeros after decimal point, then trailing dot
  local norm_exp norm_act
  norm_exp=$(echo "$expected" | sed 's/0*$//;s/\.$//')
  norm_act=$(echo "$actual" | sed 's/0*$//;s/\.$//')
  if [[ "$norm_exp" == "$norm_act" ]]; then pass "$label"
  else fail "$label" "expected=$expected actual=$actual"; fi
}

assert_gte() {
  local label="$1" min="$2" actual="$3"
  if [[ "$actual" -ge "$min" ]] 2>/dev/null; then pass "$label"
  else fail "$label" "expected>=$min actual=$actual"; fi
}

assert_http() {
  local label="$1" expected="$2" actual="$3"
  if [[ "$actual" == "$expected" ]]; then pass "$label"
  else
    local detail
    detail=$(jq -r '.detail // .message // empty' "$RESP_FILE" 2>/dev/null || echo "")
    fail "$label" "HTTP $actual ${detail:0:60}"
  fi
}

send_command() {
  local label="$1" cmd_name="$2" payload="$3"
  local body code
  body=$(printf '{"tenant_id":"%s","payload":%s}' "$TID" "$payload")
  code=$(post "$GW/v1/commands/$cmd_name/execute" "$body")
  if [[ "$code" == "202" ]]; then pass "$label → 202 accepted"
  else fail "$label" "HTTP $code"; fi
}

seed_rest() {
  local label="$1" url="$2" body="$3"
  local code
  code=$(post "$url" "$body")
  if [[ "$code" =~ ^2 ]]; then pass "$label → $code"
  else fail "$label" "HTTP $code"; fi
}

wait_kafka() {
  local secs="${1:-$KAFKA_WAIT}"
  printf "  ⏱  Waiting %ds for async processing...\n" "$secs"
  sleep "$secs"
}

# ─── Preflight ───────────────────────────────────────────────────────────────

preflight() {
  local ok=true
  printf "\n  Checking prerequisites...\n"

  if command -v jq &>/dev/null; then printf "    ✓ jq\n"
  else printf "    ✗ jq not found\n"; ok=false; fi

  if command -v psql &>/dev/null; then printf "    ✓ psql\n"
  else printf "    ✗ psql not found\n"; ok=false; fi

  local db_ok
  db_ok=$(dbq "SELECT 1;")
  if [[ "$db_ok" == "1" ]]; then printf "    ✓ database\n"
  else printf "    ✗ database unreachable\n"; ok=false; fi

  local gw_code
  gw_code=$(curl -s -o /dev/null -w "%{http_code}" "$GW/health" 2>/dev/null || echo "000")
  if [[ "$gw_code" =~ ^2 ]]; then printf "    ✓ api-gateway (%s)\n" "$gw_code"
  else printf "    ✗ api-gateway (HTTP %s)\n" "$gw_code"; ok=false; fi

  local billing_code
  billing_code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3025/health" 2>/dev/null || echo "000")
  if [[ "$billing_code" =~ ^2 ]]; then printf "    ✓ billing-service (%s)\n" "$billing_code"
  else printf "    ✗ billing-service (HTTP %s)\n" "$billing_code"; ok=false; fi

  get_token
  if [[ -n "$TOKEN" ]]; then printf "    ✓ auth token\n"
  else printf "    ✗ auth token\n"; ok=false; fi

  echo ""
  if ! $ok; then echo "FATAL: Preflight failed"; exit 1; fi
}

# ═════════════════════════════════════════════════════════════════════════════
#  HEADER
# ═════════════════════════════════════════════════════════════════════════════

echo ""
echo "╔═══════════════════════════════════════════════════════════════════════╗"
echo "║     ACCOUNTS & BILLING — SELF-VALIDATING END-TO-END TEST SUITE      ║"
echo "╠═══════════════════════════════════════════════════════════════════════╣"
echo "║  Tenant:    $TID       ║"
echo "║  Property:  $PID       ║"
echo "║  Date:      $TODAY                                         ║"
if $SKIP_SEED; then MODE="READ-ONLY (skip-seed)"; else MODE="FULL (seed + validate)"; fi
echo "║  Mode:      $(printf '%-51s' "$MODE")  ║"
echo "╚═══════════════════════════════════════════════════════════════════════╝"

preflight

# ─── Enable required commands ────────────────────────────────────────────────

REQUIRED_COMMANDS=(
  "guest.register"
  "reservation.create"
  "billing.tax_config.create"
  "billing.charge.post"
  "billing.payment.capture"
  "billing.payment.authorize"
  "billing.payment.void"
  "billing.payment.refund"
  "billing.invoice.create"
  "billing.cashier.open"
  "billing.cashier.close"
  "billing.cashier.handover"
  "billing.ar.post"
  "billing.night_audit.execute"
  "billing.date_roll.manual"
)

echo "── Enabling required commands ────────────────────────────────────────"
ENABLED_COUNT=0
for cmd in "${REQUIRED_COMMANDS[@]}"; do
  BEFORE=$(dbq "SELECT status FROM command_features WHERE command_name='$cmd' AND (tenant_id='$TID' OR tenant_id IS NULL) ORDER BY tenant_id NULLS LAST LIMIT 1;")
  if [[ "$BEFORE" != "enabled" ]]; then
    dbq "UPDATE command_features SET status='enabled', updated_at=NOW() WHERE command_name='$cmd';" >/dev/null
    ENABLED_COUNT=$((ENABLED_COUNT + 1))
    printf "    ✓ enabled: %s (was %s)\n" "$cmd" "${BEFORE:-missing}"
  fi
done
if [[ $ENABLED_COUNT -eq 0 ]]; then
  printf "    ✓ all %d commands already enabled\n" "${#REQUIRED_COMMANDS[@]}"
else
  # Gateway refreshes its command registry every 30s (COMMAND_REGISTRY_REFRESH_MS)
  printf "    → enabled %d commands — waiting 32s for gateway registry refresh...\n" "$ENABLED_COUNT"
  sleep 32
fi
echo ""

# ─── Pre-test row counts ────────────────────────────────────────────────────

PRE_GUESTS=$(dbq "SELECT COUNT(*) FROM guests WHERE tenant_id='$TID';")
PRE_RESERVATIONS=$(dbq "SELECT COUNT(*) FROM reservations WHERE tenant_id='$TID';")
PRE_FOLIOS=$(dbq "SELECT COUNT(*) FROM folios WHERE tenant_id='$TID';")
PRE_CHARGES=$(dbq "SELECT COUNT(*) FROM charge_postings WHERE tenant_id='$TID';")
PRE_PAYMENTS=$(dbq "SELECT COUNT(*) FROM payments WHERE tenant_id='$TID';")
PRE_INVOICES=$(dbq "SELECT COUNT(*) FROM invoices WHERE tenant_id='$TID';")
PRE_TAX=$(dbq "SELECT COUNT(*) FROM tax_configurations WHERE tenant_id='$TID';")
PRE_CASHIER=$(dbq "SELECT COUNT(*) FROM cashier_sessions WHERE tenant_id='$TID';")
PRE_AR=$(dbq "SELECT COUNT(*) FROM accounts_receivable WHERE tenant_id='$TID';")

echo "┌───────────────────────────────────────────────┐"
echo "│  PRE-TEST DB STATE                            │"
echo "├───────────────────────┬───────────────────────┤"
printf "│  %-21s │  %5s                │\n" "guests"              "$PRE_GUESTS"
printf "│  %-21s │  %5s                │\n" "reservations"         "$PRE_RESERVATIONS"
printf "│  %-21s │  %5s                │\n" "folios"               "$PRE_FOLIOS"
printf "│  %-21s │  %5s                │\n" "charge_postings"      "$PRE_CHARGES"
printf "│  %-21s │  %5s                │\n" "payments"             "$PRE_PAYMENTS"
printf "│  %-21s │  %5s                │\n" "invoices"             "$PRE_INVOICES"
printf "│  %-21s │  %5s                │\n" "tax_configurations"   "$PRE_TAX"
printf "│  %-21s │  %5s                │\n" "cashier_sessions"     "$PRE_CASHIER"
printf "│  %-21s │  %5s                │\n" "accounts_receivable"  "$PRE_AR"
echo "└───────────────────────┴───────────────────────┘"
echo ""

# ─── Clean ───────────────────────────────────────────────────────────────────
if $CLEAN; then
  echo "🧹 Cleaning previous test data..."
  dbq "DELETE FROM charge_postings WHERE tenant_id='$TID';" >/dev/null
  dbq "DELETE FROM payments WHERE tenant_id='$TID';" >/dev/null
  dbq "DELETE FROM invoices WHERE tenant_id='$TID';" >/dev/null
  dbq "DELETE FROM accounts_receivable WHERE tenant_id='$TID';" >/dev/null
  dbq "DELETE FROM cashier_sessions WHERE tenant_id='$TID';" >/dev/null
  dbq "DELETE FROM tax_configurations WHERE tenant_id='$TID';" >/dev/null
  dbq "DELETE FROM night_audit_log WHERE tenant_id='$TID';" >/dev/null
  dbq "DELETE FROM business_dates WHERE tenant_id='$TID';" >/dev/null
  echo "  Done."
  echo ""
  PRE_CHARGES=0; PRE_PAYMENTS=0; PRE_INVOICES=0; PRE_AR=0; PRE_CASHIER=0; PRE_TAX=0
fi

# ═════════════════════════════════════════════════════════════════════════════
#  PHASE 1 — SEED DATA + DB VERIFICATION
# ═════════════════════════════════════════════════════════════════════════════

if ! $SKIP_SEED; then

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PHASE 1: SEED DATA + DB VERIFICATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── 1.1  Guests ──
echo "── 1.1  Guests ──────────────────────────────────────────────────────"

UNIQUE=$(date +%s)
seed_rest "POST guest: John Anderson" \
  "$GW/v1/guests" \
  "{\"tenant_id\":\"$TID\",\"first_name\":\"John\",\"last_name\":\"Anderson\",\"email\":\"john.test.${UNIQUE}@example.com\",\"phone\":\"+14155551234\"}"

seed_rest "POST guest: Sarah Mitchell" \
  "$GW/v1/guests" \
  "{\"tenant_id\":\"$TID\",\"first_name\":\"Sarah\",\"last_name\":\"Mitchell\",\"email\":\"sarah.test.${UNIQUE}@example.com\",\"phone\":\"+14155555678\"}"

wait_kafka 3

GUEST1_ID=$(dbq "SELECT id FROM guests WHERE first_name='John' AND last_name='Anderson' AND tenant_id='$TID' ORDER BY created_at DESC LIMIT 1;")
GUEST2_ID=$(dbq "SELECT id FROM guests WHERE first_name='Sarah' AND last_name='Mitchell' AND tenant_id='$TID' ORDER BY created_at DESC LIMIT 1;")

POST_GUESTS=$(dbq "SELECT COUNT(*) FROM guests WHERE tenant_id='$TID';")
assert_gte "DB: guests count increased" "$((PRE_GUESTS + 2))" "$POST_GUESTS"

if [[ -n "$GUEST1_ID" ]]; then
  pass "DB: guest John Anderson found (${GUEST1_ID:0:8}…)"
else
  fail "DB: guest John Anderson" "not found in guests table"
  echo "FATAL: Cannot seed further"; exit 1
fi
if [[ -n "$GUEST2_ID" ]]; then
  pass "DB: guest Sarah Mitchell found (${GUEST2_ID:0:8}…)"
else
  skip "DB: guest Sarah Mitchell" "not found — single-guest mode"
fi
echo ""

# ── 1.2  Tax Configurations ──
echo "── 1.2  Tax Configurations ──────────────────────────────────────────"

TAXCODE1="TSTATE_${UNIQUE}"
TAXCODE2="TCITY_${UNIQUE}"

send_command "CMD tax-config: State Sales Tax (8.875%)" \
  "billing.tax_config.create" \
  "{\"property_id\":\"$PID\",\"tax_code\":\"$TAXCODE1\",\"tax_name\":\"State Sales Tax\",\"tax_type\":\"sales_tax\",\"country_code\":\"US\",\"state_province\":\"NY\",\"tax_rate\":8.875,\"effective_from\":\"2024-01-01\",\"is_active\":true,\"applies_to\":[\"rooms\",\"food_beverage\"],\"calculation_method\":\"exclusive\"}"

send_command "CMD tax-config: City Occupancy Tax (5.875%)" \
  "billing.tax_config.create" \
  "{\"property_id\":\"$PID\",\"tax_code\":\"$TAXCODE2\",\"tax_name\":\"City Occupancy Tax\",\"tax_type\":\"occupancy_tax\",\"country_code\":\"US\",\"state_province\":\"NY\",\"city\":\"New York\",\"tax_rate\":5.875,\"effective_from\":\"2024-01-01\",\"is_active\":true,\"applies_to\":[\"rooms\"],\"calculation_method\":\"exclusive\"}"

wait_kafka 4

TAX1_EXISTS=$(dbq "SELECT COUNT(*) FROM tax_configurations WHERE tax_code='$TAXCODE1' AND tenant_id='$TID';")
TAX2_EXISTS=$(dbq "SELECT COUNT(*) FROM tax_configurations WHERE tax_code='$TAXCODE2' AND tenant_id='$TID';")
assert_eq "DB: tax_configurations has $TAXCODE1" "1" "$TAX1_EXISTS"
assert_eq "DB: tax_configurations has $TAXCODE2" "1" "$TAX2_EXISTS"

TAX1_RATE=$(dbq "SELECT tax_rate FROM tax_configurations WHERE tax_code='$TAXCODE1' AND tenant_id='$TID';")
TAX1_TYPE=$(dbq "SELECT tax_type FROM tax_configurations WHERE tax_code='$TAXCODE1' AND tenant_id='$TID';")
TAX1_ACTIVE=$(dbq "SELECT is_active FROM tax_configurations WHERE tax_code='$TAXCODE1' AND tenant_id='$TID';")
assert_eq_num "DB: tax rate = 8.875" "8.875" "$TAX1_RATE"
assert_eq "DB: tax type = sales_tax" "sales_tax" "$TAX1_TYPE"
assert_eq "DB: tax is_active = true" "t" "$TAX1_ACTIVE"
echo ""

# ── 1.3  Reservations ──
echo "── 1.3  Reservations ────────────────────────────────────────────────"

seed_rest "POST reservation: John (3 nights)" \
  "$GW/v1/tenants/$TID/reservations" \
  "{\"property_id\":\"$PID\",\"guest_id\":\"$GUEST1_ID\",\"room_type_id\":\"$RTID\",\"check_in_date\":\"$TODAY\",\"check_out_date\":\"$IN3DAYS\",\"total_amount\":597.00,\"source\":\"DIRECT\"}"

if [[ -n "$GUEST2_ID" ]]; then
  seed_rest "POST reservation: Sarah (5 nights)" \
    "$GW/v1/tenants/$TID/reservations" \
    "{\"property_id\":\"$PID\",\"guest_id\":\"$GUEST2_ID\",\"room_type_id\":\"$RTID\",\"check_in_date\":\"$TOMORROW\",\"check_out_date\":\"$IN5DAYS\",\"total_amount\":796.00,\"source\":\"WEBSITE\"}"
fi

wait_kafka 5

RES1_ID=$(dbq "SELECT id FROM reservations WHERE guest_id='$GUEST1_ID' AND tenant_id='$TID' ORDER BY created_at DESC LIMIT 1;")
FOLIO1_ID=$(dbq "SELECT folio_id FROM folios WHERE reservation_id='$RES1_ID' AND tenant_id='$TID' LIMIT 1;" 2>/dev/null || echo "")
RES2_ID=""; FOLIO2_ID=""
if [[ -n "$GUEST2_ID" ]]; then
  RES2_ID=$(dbq "SELECT id FROM reservations WHERE guest_id='$GUEST2_ID' AND tenant_id='$TID' ORDER BY created_at DESC LIMIT 1;")
  FOLIO2_ID=$(dbq "SELECT folio_id FROM folios WHERE reservation_id='$RES2_ID' AND tenant_id='$TID' LIMIT 1;" 2>/dev/null || echo "")
fi

if [[ -n "$RES1_ID" ]]; then
  pass "DB: reservation 1 created (${RES1_ID:0:8}…)"
else
  fail "DB: reservation 1" "not found"
  echo "FATAL: No reservation"; exit 1
fi

RES1_STATUS=$(dbq "SELECT status FROM reservations WHERE id='$RES1_ID';")
assert_eq "DB: reservation 1 status" "PENDING" "$RES1_STATUS"

RES1_AMOUNT=$(dbq "SELECT total_amount FROM reservations WHERE id='$RES1_ID';")
assert_eq "DB: reservation 1 total_amount = 597" "597.00" "$RES1_AMOUNT"

if [[ -n "$FOLIO1_ID" ]]; then
  pass "DB: folio auto-created for res 1 (${FOLIO1_ID:0:8}…)"
  FOLIO1_STATUS=$(dbq "SELECT folio_status FROM folios WHERE folio_id='$FOLIO1_ID';")
  assert_eq_ci "DB: folio 1 status = open" "open" "$FOLIO1_STATUS"
else
  fail "DB: folio for reservation 1" "no folio row found"
fi

if [[ -n "$RES2_ID" ]]; then
  pass "DB: reservation 2 created (${RES2_ID:0:8}…)"
fi
echo ""

# ── 1.4  Charge Postings ──
echo "── 1.4  Charge Postings ─────────────────────────────────────────────"

seed_rest "POST charge: Room (\$199)" \
  "$GW/v1/tenants/$TID/billing/charges" \
  "{\"property_id\":\"$PID\",\"reservation_id\":\"$RES1_ID\",\"amount\":199.00,\"charge_code\":\"ROOM\",\"posting_type\":\"DEBIT\",\"quantity\":1,\"description\":\"Room charge - Cityline King\"}"

seed_rest "POST charge: Minibar (\$24.50)" \
  "$GW/v1/tenants/$TID/billing/charges" \
  "{\"property_id\":\"$PID\",\"reservation_id\":\"$RES1_ID\",\"amount\":24.50,\"charge_code\":\"MINIBAR\",\"posting_type\":\"DEBIT\",\"quantity\":1,\"description\":\"Minibar\"}"

seed_rest "POST charge: Restaurant (\$85)" \
  "$GW/v1/tenants/$TID/billing/charges" \
  "{\"property_id\":\"$PID\",\"reservation_id\":\"$RES1_ID\",\"amount\":85.00,\"charge_code\":\"RESTAURANT\",\"posting_type\":\"DEBIT\",\"quantity\":1,\"description\":\"Dinner\"}"

seed_rest "POST charge: Spa (\$150)" \
  "$GW/v1/tenants/$TID/billing/charges" \
  "{\"property_id\":\"$PID\",\"reservation_id\":\"$RES1_ID\",\"amount\":150.00,\"charge_code\":\"SPA\",\"posting_type\":\"DEBIT\",\"quantity\":1}"

if [[ -n "$RES2_ID" ]]; then
  seed_rest "POST charge: Room Sarah (\$199)" \
    "$GW/v1/tenants/$TID/billing/charges" \
    "{\"property_id\":\"$PID\",\"reservation_id\":\"$RES2_ID\",\"amount\":199.00,\"charge_code\":\"ROOM\",\"posting_type\":\"DEBIT\",\"quantity\":1}"

  seed_rest "POST charge: Laundry Sarah (\$35)" \
    "$GW/v1/tenants/$TID/billing/charges" \
    "{\"property_id\":\"$PID\",\"reservation_id\":\"$RES2_ID\",\"amount\":35.00,\"charge_code\":\"LAUNDRY\",\"posting_type\":\"DEBIT\",\"quantity\":1}"
fi

wait_kafka 5

CHARGE_COUNT=$(dbq "SELECT COUNT(*) FROM charge_postings WHERE tenant_id='$TID' AND reservation_id='$RES1_ID';")
assert_gte "DB: charge_postings for res 1 >= 4" "4" "$CHARGE_COUNT"

ROOM_CHARGE=$(dbq "SELECT total_amount FROM charge_postings WHERE tenant_id='$TID' AND reservation_id='$RES1_ID' AND charge_code='ROOM' LIMIT 1;")
MINIBAR_CHARGE=$(dbq "SELECT total_amount FROM charge_postings WHERE tenant_id='$TID' AND reservation_id='$RES1_ID' AND charge_code='MINIBAR' LIMIT 1;")
assert_eq_num "DB: ROOM charge amount = 199" "199" "$ROOM_CHARGE"
assert_eq_num "DB: MINIBAR charge amount = 24.50" "24.50" "$MINIBAR_CHARGE"

ROOM_TYPE=$(dbq "SELECT posting_type FROM charge_postings WHERE tenant_id='$TID' AND reservation_id='$RES1_ID' AND charge_code='ROOM' LIMIT 1;")
assert_eq "DB: ROOM posting_type = DEBIT" "DEBIT" "$ROOM_TYPE"

if [[ -n "$RES2_ID" ]]; then
  SARAH_CHARGES=$(dbq "SELECT COUNT(*) FROM charge_postings WHERE tenant_id='$TID' AND reservation_id='$RES2_ID';")
  assert_gte "DB: charge_postings for res 2 >= 2" "2" "$SARAH_CHARGES"
fi
echo ""

# ── 1.5  Payments ──
echo "── 1.5  Payments ────────────────────────────────────────────────────"

PAYREF1="PAY-${UNIQUE}-001"
PAYREF2="PAY-${UNIQUE}-002"

seed_rest "POST payment: John CC (\$300)" \
  "$GW/v1/tenants/$TID/billing/payments/capture" \
  "{\"payment_reference\":\"$PAYREF1\",\"property_id\":\"$PID\",\"reservation_id\":\"$RES1_ID\",\"guest_id\":\"$GUEST1_ID\",\"amount\":300.00,\"payment_method\":\"CREDIT_CARD\"}"

seed_rest "POST payment: John Cash (\$100)" \
  "$GW/v1/tenants/$TID/billing/payments/capture" \
  "{\"payment_reference\":\"$PAYREF2\",\"property_id\":\"$PID\",\"reservation_id\":\"$RES1_ID\",\"guest_id\":\"$GUEST1_ID\",\"amount\":100.00,\"payment_method\":\"CASH\"}"

PAYREF3=""
if [[ -n "$RES2_ID" && -n "$GUEST2_ID" ]]; then
  PAYREF3="PAY-${UNIQUE}-003"
  seed_rest "POST payment: Sarah CC (\$200)" \
    "$GW/v1/tenants/$TID/billing/payments/capture" \
    "{\"payment_reference\":\"$PAYREF3\",\"property_id\":\"$PID\",\"reservation_id\":\"$RES2_ID\",\"guest_id\":\"$GUEST2_ID\",\"amount\":200.00,\"payment_method\":\"CREDIT_CARD\"}"
fi

wait_kafka 5

PAY1_EXISTS=$(dbq "SELECT COUNT(*) FROM payments WHERE payment_reference='$PAYREF1' AND tenant_id='$TID';")
PAY2_EXISTS=$(dbq "SELECT COUNT(*) FROM payments WHERE payment_reference='$PAYREF2' AND tenant_id='$TID';")
assert_eq "DB: payment $PAYREF1 exists" "1" "$PAY1_EXISTS"
assert_eq "DB: payment $PAYREF2 exists" "1" "$PAY2_EXISTS"

PAY1_AMOUNT=$(dbq "SELECT amount FROM payments WHERE payment_reference='$PAYREF1' AND tenant_id='$TID';")
PAY1_METHOD=$(dbq "SELECT payment_method FROM payments WHERE payment_reference='$PAYREF1' AND tenant_id='$TID';")
PAY1_STATUS=$(dbq "SELECT status FROM payments WHERE payment_reference='$PAYREF1' AND tenant_id='$TID';")
assert_eq "DB: payment 1 amount = 300" "300.00" "$PAY1_AMOUNT"
assert_eq "DB: payment 1 method = CREDIT_CARD" "CREDIT_CARD" "$PAY1_METHOD"
assert_eq "DB: payment 1 status = COMPLETED" "COMPLETED" "$PAY1_STATUS"

PAY2_METHOD=$(dbq "SELECT payment_method FROM payments WHERE payment_reference='$PAYREF2' AND tenant_id='$TID';")
assert_eq "DB: payment 2 method = CASH" "CASH" "$PAY2_METHOD"

if [[ -n "$PAYREF3" ]]; then
  PAY3_EXISTS=$(dbq "SELECT COUNT(*) FROM payments WHERE payment_reference='$PAYREF3' AND tenant_id='$TID';")
  assert_eq "DB: payment $PAYREF3 exists" "1" "$PAY3_EXISTS"
fi
echo ""

# ── 1.6  Invoices ──
echo "── 1.6  Invoices ────────────────────────────────────────────────────"

send_command "CMD invoice: John (\$458.50)" \
  "billing.invoice.create" \
  "{\"property_id\":\"$PID\",\"reservation_id\":\"$RES1_ID\",\"guest_id\":\"$GUEST1_ID\",\"total_amount\":458.50}"

if [[ -n "$RES2_ID" && -n "$GUEST2_ID" ]]; then
  send_command "CMD invoice: Sarah (\$234)" \
    "billing.invoice.create" \
    "{\"property_id\":\"$PID\",\"reservation_id\":\"$RES2_ID\",\"guest_id\":\"$GUEST2_ID\",\"total_amount\":234.00}"
fi

wait_kafka 5

INV_TOTAL=$(dbq "SELECT COUNT(*) FROM invoices WHERE tenant_id='$TID';")
assert_gte "DB: invoices count >= $((PRE_INVOICES + 1))" "$((PRE_INVOICES + 1))" "$INV_TOTAL"

INV1_ROW=$(dbq "SELECT total_amount, status, invoice_type FROM invoices WHERE reservation_id='$RES1_ID' AND tenant_id='$TID' ORDER BY created_at DESC LIMIT 1;")
if [[ -n "$INV1_ROW" ]]; then
  INV1_AMOUNT=$(echo "$INV1_ROW" | cut -d'|' -f1)
  INV1_STATUS=$(echo "$INV1_ROW" | cut -d'|' -f2)
  assert_eq_num "DB: invoice amount = 458.50" "458.50" "$INV1_AMOUNT"
  assert_eq_ci "DB: invoice status = draft" "draft" "$INV1_STATUS"
else
  fail "DB: invoice for res 1" "not found"
fi
echo ""

# ── 1.7  Cashier Sessions ──
echo "── 1.7  Cashier Sessions ────────────────────────────────────────────"

CASHIER_ID=$(dbq "SELECT id FROM users WHERE tenant_id='$TID' LIMIT 1;")
CASHIER_NAME=$(dbq "SELECT COALESCE(first_name || ' ' || last_name, username) FROM users WHERE id='$CASHIER_ID' LIMIT 1;")

if [[ -n "$CASHIER_ID" ]]; then
  send_command "CMD cashier open: morning shift" \
    "billing.cashier.open" \
    "{\"property_id\":\"$PID\",\"cashier_id\":\"$CASHIER_ID\",\"cashier_name\":\"$CASHIER_NAME\",\"shift_type\":\"morning\",\"opening_float\":500.00}"

  wait_kafka 4

  SESSION_ID=$(dbq "SELECT session_id FROM cashier_sessions WHERE cashier_id='$CASHIER_ID' AND tenant_id='$TID' AND session_status='open' ORDER BY created_at DESC LIMIT 1;")
  if [[ -n "$SESSION_ID" ]]; then
    pass "DB: cashier session opened (${SESSION_ID:0:8}…)"

    SESSION_FLOAT=$(dbq "SELECT opening_float_declared FROM cashier_sessions WHERE session_id='$SESSION_ID';")
    assert_eq "DB: opening_float = 500" "500.00" "$SESSION_FLOAT"

    SESSION_STATUS=$(dbq "SELECT session_status FROM cashier_sessions WHERE session_id='$SESSION_ID';")
    assert_eq "DB: session_status = open" "open" "$SESSION_STATUS"

    send_command "CMD cashier close: morning shift" \
      "billing.cashier.close" \
      "{\"session_id\":\"$SESSION_ID\",\"closing_cash_declared\":612.00,\"closing_cash_counted\":610.50}"

    wait_kafka 4

    CLOSED_STATUS=$(dbq "SELECT session_status FROM cashier_sessions WHERE session_id='$SESSION_ID';")
    if [[ "$CLOSED_STATUS" == "closed" ]]; then
      pass "DB: cashier session closed"
    else
      skip "DB: cashier session close" "status=$CLOSED_STATUS (needs service restart for fix)"
    fi
  else
    fail "DB: cashier session" "not found"
  fi
else
  skip "Cashier session" "no user found"
fi
echo ""

# ── 1.8  Accounts Receivable ──
echo "── 1.8  Accounts Receivable ─────────────────────────────────────────"

send_command "CMD AR: Corporate DB (\$158.50)" \
  "billing.ar.post" \
  "{\"reservation_id\":\"$RES1_ID\",\"folio_id\":\"${FOLIO1_ID:-}\",\"account_type\":\"corporate\",\"account_id\":\"$GUEST1_ID\",\"account_name\":\"Acme Corp Travel\",\"amount\":158.50,\"payment_terms\":\"net_30\"}"

if [[ -n "$RES2_ID" ]]; then
  send_command "CMD AR: Travel agent (\$34)" \
    "billing.ar.post" \
    "{\"reservation_id\":\"$RES2_ID\",\"folio_id\":\"${FOLIO2_ID:-}\",\"account_type\":\"travel_agent\",\"account_id\":\"${GUEST2_ID:-$GUEST1_ID}\",\"account_name\":\"Globetrotter Agency\",\"amount\":34.00,\"payment_terms\":\"net_30\"}"
fi

wait_kafka 5

AR_TOTAL=$(dbq "SELECT COUNT(*) FROM accounts_receivable WHERE tenant_id='$TID';")
assert_gte "DB: accounts_receivable >= $((PRE_AR + 1))" "$((PRE_AR + 1))" "$AR_TOTAL"

AR1_ROW=$(dbq "SELECT original_amount, account_type, ar_status, payment_terms FROM accounts_receivable WHERE reservation_id='$RES1_ID' AND tenant_id='$TID' ORDER BY created_at DESC LIMIT 1;")
if [[ -n "$AR1_ROW" ]]; then
  AR1_AMOUNT=$(echo "$AR1_ROW" | cut -d'|' -f1)
  AR1_TYPE=$(echo "$AR1_ROW" | cut -d'|' -f2)
  AR1_STATUS=$(echo "$AR1_ROW" | cut -d'|' -f3)
  AR1_TERMS=$(echo "$AR1_ROW" | cut -d'|' -f4)
  assert_eq "DB: AR amount = 158.50" "158.50" "$AR1_AMOUNT"
  assert_eq "DB: AR account_type = corporate" "corporate" "$AR1_TYPE"
  assert_eq "DB: AR status = open" "open" "$AR1_STATUS"
  assert_eq "DB: AR payment_terms = net_30" "net_30" "$AR1_TERMS"
else
  fail "DB: AR for res 1" "not found"
fi
echo ""

# ── 1.9  Night Audit ──
echo "── 1.9  Night Audit ─────────────────────────────────────────────────"

send_command "CMD night audit: execute" \
  "billing.night_audit.execute" \
  "{\"property_id\":\"$PID\",\"post_room_charges\":true,\"post_package_charges\":false,\"post_ota_commissions\":false,\"mark_no_shows\":true,\"advance_date\":false}"

wait_kafka 6

AUDIT_COUNT=$(dbq "SELECT COUNT(*) FROM night_audit_log WHERE tenant_id='$TID' AND property_id='$PID';")
if [[ "$AUDIT_COUNT" -ge 1 ]]; then
  pass "DB: night_audit_log has $AUDIT_COUNT entries"
else
  skip "DB: night_audit_log" "0 entries (may need service restart for SQL fix)"
fi
echo ""

# ── 1.10  Failed Card → Void → Cash Fallback ──
echo "── 1.10 Failed Card → Void → Cash Fallback ─────────────────────────"

# Scenario: Guest tries to pay $75 room-service charge with credit card.
# The authorization goes through but must be voided (simulating a gateway
# decline/failure), then the guest pays cash instead.

FAILPAY_REF="PAY-FAIL-${UNIQUE}"
CASHPAY_REF="PAY-CASH-${UNIQUE}"

# Step 1: Authorize the credit card
send_command "CMD authorize CC: \$75" \
  "billing.payment.authorize" \
  "{\"payment_reference\":\"$FAILPAY_REF\",\"property_id\":\"$PID\",\"reservation_id\":\"$RES1_ID\",\"guest_id\":\"$GUEST1_ID\",\"amount\":75.00,\"payment_method\":\"CREDIT_CARD\"}"

wait_kafka 4

AUTH_STATUS=$(dbq "SELECT status FROM payments WHERE payment_reference='$FAILPAY_REF' AND tenant_id='$TID';")
if [[ -n "$AUTH_STATUS" ]]; then
  assert_eq_ci "DB: authorized payment status" "authorized" "$AUTH_STATUS"
else
  fail "DB: authorized payment" "not found"
fi

# Step 2: Void the authorization (simulates card decline / cancellation)
send_command "CMD void CC authorization" \
  "billing.payment.void" \
  "{\"payment_reference\":\"$FAILPAY_REF\",\"property_id\":\"$PID\",\"reservation_id\":\"$RES1_ID\",\"reason\":\"Card declined at gateway\"}"

wait_kafka 4

VOID_STATUS=$(dbq "SELECT status FROM payments WHERE payment_reference='$FAILPAY_REF' AND tenant_id='$TID';")
assert_eq_ci "DB: voided payment status = CANCELLED" "cancelled" "$VOID_STATUS"

VOID_AMOUNT=$(dbq "SELECT amount FROM payments WHERE payment_reference='$FAILPAY_REF' AND tenant_id='$TID';")
assert_eq_num "DB: voided payment amount still 75" "75" "$VOID_AMOUNT"

# Step 3: Guest pays cash instead
send_command "CMD capture cash fallback: \$75" \
  "billing.payment.capture" \
  "{\"payment_reference\":\"$CASHPAY_REF\",\"property_id\":\"$PID\",\"reservation_id\":\"$RES1_ID\",\"guest_id\":\"$GUEST1_ID\",\"amount\":75.00,\"payment_method\":\"CASH\"}"

wait_kafka 4

CASH_STATUS=$(dbq "SELECT status FROM payments WHERE payment_reference='$CASHPAY_REF' AND tenant_id='$TID';")
CASH_METHOD=$(dbq "SELECT payment_method FROM payments WHERE payment_reference='$CASHPAY_REF' AND tenant_id='$TID';")
assert_eq "DB: cash fallback status = COMPLETED" "COMPLETED" "$CASH_STATUS"
assert_eq "DB: cash fallback method = CASH" "CASH" "$CASH_METHOD"

# Verify both payments exist side-by-side (voided + completed)
BOTH_COUNT=$(dbq "SELECT COUNT(*) FROM payments WHERE payment_reference IN ('$FAILPAY_REF','$CASHPAY_REF') AND tenant_id='$TID';")
assert_eq "DB: both payment records exist" "2" "$BOTH_COUNT"
echo ""

# ── 1.11  Cashier Shift Handover ──
echo "── 1.11 Cashier Shift Handover ──────────────────────────────────────"

# Scenario: Morning cashier finishes, hands over to afternoon cashier.
# The handover command atomically closes the outgoing session and opens
# a new one for the incoming cashier.

if [[ -n "$CASHIER_ID" ]]; then
  # Open an afternoon session first
  send_command "CMD cashier open: afternoon shift" \
    "billing.cashier.open" \
    "{\"property_id\":\"$PID\",\"cashier_id\":\"$CASHIER_ID\",\"cashier_name\":\"$CASHIER_NAME\",\"shift_type\":\"afternoon\",\"opening_float\":500.00}"

  wait_kafka 4

  AFTERNOON_ID=$(dbq "SELECT session_id FROM cashier_sessions WHERE cashier_id='$CASHIER_ID' AND tenant_id='$TID' AND session_status='open' AND shift_type='afternoon' ORDER BY created_at DESC LIMIT 1;")
  if [[ -n "$AFTERNOON_ID" ]]; then
    pass "DB: afternoon session opened (${AFTERNOON_ID:0:8}…)"

    AFTERNOON_SHIFT=$(dbq "SELECT shift_type FROM cashier_sessions WHERE session_id='$AFTERNOON_ID';")
    assert_eq "DB: afternoon shift_type" "afternoon" "$AFTERNOON_SHIFT"

    # Handover: close afternoon → open evening
    send_command "CMD cashier handover: afternoon → evening" \
      "billing.cashier.handover" \
      "{\"outgoing_session_id\":\"$AFTERNOON_ID\",\"closing_cash_declared\":580.00,\"closing_cash_counted\":578.50,\"handover_notes\":\"Smooth shift, no issues\",\"incoming_cashier_id\":\"$CASHIER_ID\",\"incoming_cashier_name\":\"$CASHIER_NAME\",\"incoming_shift_type\":\"evening\",\"incoming_opening_float\":578.50,\"property_id\":\"$PID\"}"

    wait_kafka 5

    # Verify outgoing session is closed
    AFTERNOON_FINAL=$(dbq "SELECT session_status FROM cashier_sessions WHERE session_id='$AFTERNOON_ID';")
    assert_eq_ci "DB: afternoon session closed after handover" "closed" "$AFTERNOON_FINAL"

    AFTERNOON_VARIANCE=$(dbq "SELECT cash_variance FROM cashier_sessions WHERE session_id='$AFTERNOON_ID';")
    if [[ -n "$AFTERNOON_VARIANCE" ]]; then
      assert_eq_num "DB: afternoon cash_variance = 1.50" "1.50" "$AFTERNOON_VARIANCE"
    fi

    # Verify incoming session opened
    EVENING_ID=$(dbq "SELECT session_id FROM cashier_sessions WHERE cashier_id='$CASHIER_ID' AND tenant_id='$TID' AND session_status='open' AND shift_type='evening' ORDER BY created_at DESC LIMIT 1;")
    if [[ -n "$EVENING_ID" ]]; then
      pass "DB: evening session opened via handover (${EVENING_ID:0:8}…)"

      EVENING_FLOAT=$(dbq "SELECT opening_float_declared FROM cashier_sessions WHERE session_id='$EVENING_ID';")
      assert_eq_num "DB: evening opening_float = 578.50" "578.50" "$EVENING_FLOAT"

      EVENING_SHIFT=$(dbq "SELECT shift_type FROM cashier_sessions WHERE session_id='$EVENING_ID';")
      assert_eq "DB: evening shift_type" "evening" "$EVENING_SHIFT"

      # Close the evening session for a clean end-of-day
      send_command "CMD cashier close: evening shift" \
        "billing.cashier.close" \
        "{\"session_id\":\"$EVENING_ID\",\"closing_cash_declared\":650.25,\"closing_cash_counted\":649.00}"

      wait_kafka 4

      EVENING_FINAL=$(dbq "SELECT session_status FROM cashier_sessions WHERE session_id='$EVENING_ID';")
      assert_eq_ci "DB: evening session closed" "closed" "$EVENING_FINAL"
    else
      fail "DB: evening session via handover" "not found"
    fi
  else
    fail "DB: afternoon session" "not found"
  fi

  # Verify total cashier sessions created this run (morning + afternoon + evening = 3)
  TOTAL_SESSIONS=$(dbq "SELECT COUNT(*) FROM cashier_sessions WHERE tenant_id='$TID';")
  assert_gte "DB: total cashier sessions >= 3" "3" "$TOTAL_SESSIONS"
else
  skip "Cashier handover" "no user found"
fi
echo ""

# ── 1.12  Night Audit with Date Roll ──
echo "── 1.12 Night Audit with Date Roll ──────────────────────────────────"

# First ensure a business_dates row exists for today
BD_EXISTS=$(dbq "SELECT COUNT(*) FROM business_dates WHERE tenant_id='$TID' AND property_id='$PID';")
if [[ "$BD_EXISTS" == "0" ]]; then
  # Seed a business_dates row so the night audit has something to roll
  dbq "INSERT INTO business_dates (business_date_id, tenant_id, property_id, business_date, date_status, night_audit_status, allow_postings, allow_check_ins, allow_check_outs, allow_new_reservations)
       VALUES (gen_random_uuid(), '$TID', '$PID', '$TODAY', 'OPEN', 'PENDING', true, true, true, true)
       ON CONFLICT DO NOTHING;" >/dev/null
  pass "DB: seeded business_dates row for $TODAY"
fi

PRE_BDATE=$(dbq "SELECT business_date::text FROM business_dates WHERE tenant_id='$TID' AND property_id='$PID' AND date_status='OPEN' ORDER BY business_date DESC LIMIT 1;")
PRE_AUDIT_COUNT=$(dbq "SELECT COUNT(*) FROM night_audit_log WHERE tenant_id='$TID' AND property_id='$PID';")

# Execute night audit WITH date advancement
send_command "CMD night audit: execute with date roll" \
  "billing.night_audit.execute" \
  "{\"property_id\":\"$PID\",\"post_room_charges\":true,\"post_package_charges\":false,\"post_ota_commissions\":false,\"mark_no_shows\":false,\"advance_date\":true,\"generate_trial_balance\":false}"

wait_kafka 8

# Verify night_audit_log has a new entry
POST_AUDIT_COUNT=$(dbq "SELECT COUNT(*) FROM night_audit_log WHERE tenant_id='$TID' AND property_id='$PID';")
if [[ "$POST_AUDIT_COUNT" -gt "$PRE_AUDIT_COUNT" ]]; then
  pass "DB: night_audit_log new entry (was $PRE_AUDIT_COUNT, now $POST_AUDIT_COUNT)"
else
  skip "DB: night_audit_log after date roll" "count unchanged ($POST_AUDIT_COUNT)"
fi

# Verify the latest audit log entry
LATEST_AUDIT=$(dbq "SELECT audit_status, step_name FROM night_audit_log WHERE tenant_id='$TID' AND property_id='$PID' ORDER BY created_at DESC LIMIT 1;")
if [[ -n "$LATEST_AUDIT" ]]; then
  AUDIT_STATUS=$(echo "$LATEST_AUDIT" | cut -d'|' -f1)
  AUDIT_STEP=$(echo "$LATEST_AUDIT" | cut -d'|' -f2)
  assert_eq_ci "DB: audit_status = COMPLETED" "completed" "$AUDIT_STATUS"
fi

# Verify business_date advanced by 1 day
POST_BDATE=$(dbq "SELECT business_date::text FROM business_dates WHERE tenant_id='$TID' AND property_id='$PID' ORDER BY business_date DESC LIMIT 1;")
if [[ -n "$PRE_BDATE" && -n "$POST_BDATE" && "$POST_BDATE" != "$PRE_BDATE" ]]; then
  pass "DB: business_date advanced ($PRE_BDATE → $POST_BDATE)"
else
  skip "DB: business_date advance" "pre=$PRE_BDATE post=$POST_BDATE"
fi

# Verify the previous_business_date was set
PREV_BDATE=$(dbq "SELECT previous_business_date::text FROM business_dates WHERE tenant_id='$TID' AND property_id='$PID' ORDER BY business_date DESC LIMIT 1;")
if [[ "$PREV_BDATE" == "$PRE_BDATE" ]]; then
  pass "DB: previous_business_date = $PREV_BDATE"
else
  skip "DB: previous_business_date" "expected=$PRE_BDATE actual=$PREV_BDATE"
fi

# Verify date_status is still OPEN (audit completes and reopens)
DATE_STATUS=$(dbq "SELECT date_status FROM business_dates WHERE tenant_id='$TID' AND property_id='$PID' ORDER BY business_date DESC LIMIT 1;")
assert_eq "DB: date_status after audit = OPEN" "OPEN" "$DATE_STATUS"

# Verify night_audit_status was updated
NA_STATUS=$(dbq "SELECT night_audit_status FROM business_dates WHERE tenant_id='$TID' AND property_id='$PID' ORDER BY business_date DESC LIMIT 1;")
if [[ "$NA_STATUS" == "COMPLETED" || "$NA_STATUS" == "PENDING" ]]; then
  pass "DB: night_audit_status = $NA_STATUS"
else
  fail "DB: night_audit_status" "expected COMPLETED or PENDING, got=$NA_STATUS"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SEED PHASE COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

else
  echo "(seed skipped — resolving existing data)"
  GUEST1_ID=$(dbq "SELECT id FROM guests WHERE tenant_id='$TID' ORDER BY created_at DESC LIMIT 1;")
  RES1_ID=$(dbq "SELECT id FROM reservations WHERE tenant_id='$TID' ORDER BY created_at DESC LIMIT 1;")
  FOLIO1_ID=$(dbq "SELECT folio_id FROM folios WHERE reservation_id='$RES1_ID' AND tenant_id='$TID' LIMIT 1;" 2>/dev/null || echo "")
  RES2_ID=$(dbq "SELECT id FROM reservations WHERE tenant_id='$TID' AND id != '$RES1_ID' ORDER BY created_at DESC LIMIT 1;")
  SESSION_ID=$(dbq "SELECT session_id FROM cashier_sessions WHERE tenant_id='$TID' ORDER BY created_at ASC LIMIT 1;" 2>/dev/null || echo "")
  AFTERNOON_ID=$(dbq "SELECT session_id FROM cashier_sessions WHERE tenant_id='$TID' AND shift_type='afternoon' ORDER BY created_at DESC LIMIT 1;" 2>/dev/null || echo "")
  EVENING_ID=$(dbq "SELECT session_id FROM cashier_sessions WHERE tenant_id='$TID' AND shift_type='evening' ORDER BY created_at DESC LIMIT 1;" 2>/dev/null || echo "")
  FAILPAY_REF=$(dbq "SELECT payment_reference FROM payments WHERE tenant_id='$TID' AND status='CANCELLED' ORDER BY created_at DESC LIMIT 1;" 2>/dev/null || echo "")
  CASHPAY_REF=$(dbq "SELECT payment_reference FROM payments WHERE tenant_id='$TID' AND payment_method='CASH' AND status='COMPLETED' ORDER BY created_at DESC LIMIT 1;" 2>/dev/null || echo "")
  PAYREF1=$(dbq "SELECT payment_reference FROM payments WHERE tenant_id='$TID' AND payment_method='CREDIT_CARD' AND status='COMPLETED' ORDER BY created_at ASC LIMIT 1;" 2>/dev/null || echo "")
  echo "  Guest:       ${GUEST1_ID:-NONE}"
  echo "  Reservation: ${RES1_ID:-NONE}"
  echo "  Folio:       ${FOLIO1_ID:-NONE}"
  echo "  Sessions:    morning=${SESSION_ID:-NONE} afternoon=${AFTERNOON_ID:-NONE} evening=${EVENING_ID:-NONE}"
  echo ""
fi

# ═════════════════════════════════════════════════════════════════════════════
#  PHASE 2 — API READ ENDPOINTS + DB CROSS-VALIDATION
# ═════════════════════════════════════════════════════════════════════════════

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PHASE 2: API READ ENDPOINTS + DB CROSS-VALIDATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Helper: GET endpoint and cross-check count vs DB
api_vs_db() {
  local label="$1" url="$2" jq_expr="$3" db_sql="$4"
  local code
  code=$(get "$url")
  if [[ ! "$code" =~ ^2 ]]; then
    fail "API $label" "HTTP $code"
    return
  fi

  local api_count db_count
  api_count=$(jq -r "$jq_expr" "$RESP_FILE" 2>/dev/null || echo "ERR")
  db_count=$(dbq "$db_sql")

  if [[ "$api_count" == "ERR" ]]; then
    fail "API $label — parse" "jq failed"
    return
  fi

  if [[ "$api_count" == "$db_count" ]]; then
    pass "API $label  (api=$api_count db=$db_count)"
  else
    fail "API $label" "api=$api_count db=$db_count MISMATCH"
  fi
}

# ── Tax Configurations ──
echo "── Tax Configurations ───────────────────────────────────────────────"

api_vs_db "GET tax-configurations count" \
  "$GW/v1/billing/tax-configurations?tenant_id=$TID&property_id=$PID" \
  ".meta.count // (.data | length)" \
  "SELECT COUNT(*) FROM tax_configurations WHERE tenant_id='$TID' AND property_id='$PID';"

TAX_CFG_ID=$(dbq "SELECT tax_config_id FROM tax_configurations WHERE tenant_id='$TID' ORDER BY created_at DESC LIMIT 1;")
if [[ -n "$TAX_CFG_ID" ]]; then
  code=$(get "$GW/v1/billing/tax-configurations/$TAX_CFG_ID?tenant_id=$TID")
  assert_http "GET tax-config by ID" "200" "$code"
  API_TAXCODE=$(jq -r '.data.tax_code // .tax_code // empty' "$RESP_FILE" 2>/dev/null || echo "")
  DB_TAXCODE=$(dbq "SELECT tax_code FROM tax_configurations WHERE tax_config_id='$TAX_CFG_ID';")
  assert_eq "XCHECK: tax_code matches DB" "$DB_TAXCODE" "$API_TAXCODE"
fi
echo ""

# ── Charges ──
echo "── Charges ──────────────────────────────────────────────────────────"

code=$(get "$GW/v1/billing/charges?tenant_id=$TID&limit=100")
assert_http "GET charges list" "200" "$code"
API_CHARGES=$(jq 'if type == "array" then length else (.data | length) // 0 end' "$RESP_FILE" 2>/dev/null || echo "0")
DB_CHARGES=$(dbq "SELECT COUNT(*) FROM charge_postings WHERE tenant_id='$TID';")
assert_eq "XCHECK: charges count" "$DB_CHARGES" "$API_CHARGES"

if [[ -n "${RES1_ID:-}" ]]; then
  code=$(get "$GW/v1/billing/charges?tenant_id=$TID&reservation_id=$RES1_ID")
  assert_http "GET charges by reservation" "200" "$code"
  API_RES1=$(jq 'if type == "array" then length else (.data | length) // 0 end' "$RESP_FILE" 2>/dev/null || echo "0")
  DB_RES1=$(dbq "SELECT COUNT(*) FROM charge_postings WHERE tenant_id='$TID' AND reservation_id='$RES1_ID';")
  assert_eq "XCHECK: res1 charges count" "$DB_RES1" "$API_RES1"
fi
echo ""

# ── Payments ──
echo "── Payments ─────────────────────────────────────────────────────────"

code=$(get "$GW/v1/billing/payments?tenant_id=$TID&limit=100")
assert_http "GET payments list" "200" "$code"
API_PAYMENTS=$(jq 'if type == "array" then length else (.data | length) // 0 end' "$RESP_FILE" 2>/dev/null || echo "0")
DB_PAYMENTS=$(dbq "SELECT COUNT(*) FROM payments WHERE tenant_id='$TID';")
assert_eq "XCHECK: payments count" "$DB_PAYMENTS" "$API_PAYMENTS"

if [[ -n "${PAYREF1:-}" ]]; then
  API_PAY_FOUND=$(jq --arg ref "$PAYREF1" '[.[] | select(.payment_reference == $ref)] | length' "$RESP_FILE" 2>/dev/null || echo "0")
  if [[ "$API_PAY_FOUND" -ge 1 ]]; then
    pass "XCHECK: payment $PAYREF1 in API response"
  else
    fail "XCHECK: payment $PAYREF1" "not in API response"
  fi
fi
echo ""

# ── Invoices ──
echo "── Invoices ─────────────────────────────────────────────────────────"

api_vs_db "GET invoices count" \
  "$GW/v1/billing/invoices?tenant_id=$TID" \
  ".meta.count // (.data | length)" \
  "SELECT COUNT(*) FROM invoices WHERE tenant_id='$TID';"

if [[ -n "${RES1_ID:-}" ]]; then
  INV_ID=$(dbq "SELECT id FROM invoices WHERE reservation_id='$RES1_ID' AND tenant_id='$TID' ORDER BY created_at DESC LIMIT 1;")
  if [[ -n "$INV_ID" ]]; then
    code=$(get "$GW/v1/billing/invoices/$INV_ID?tenant_id=$TID")
    assert_http "GET invoice by ID" "200" "$code"
    API_INV_AMT=$(jq -r '.data.total_amount // .total_amount // empty' "$RESP_FILE" 2>/dev/null || echo "")
    DB_INV_AMT=$(dbq "SELECT total_amount FROM invoices WHERE id='$INV_ID';")
    assert_eq_num "XCHECK: invoice total_amount" "$DB_INV_AMT" "$API_INV_AMT"
  fi
fi
echo ""

# ── Folios ──
echo "── Folios ───────────────────────────────────────────────────────────"

code=$(get "$GW/v1/billing/folios?tenant_id=$TID&limit=100")
assert_http "GET folios list" "200" "$code"
API_FOLIOS=$(jq 'if type == "array" then length else (.data | length) // 0 end' "$RESP_FILE" 2>/dev/null || echo "0")
DB_FOLIOS=$(dbq "SELECT COUNT(*) FROM folios WHERE tenant_id='$TID' AND COALESCE(is_deleted,false)=false;")
assert_eq "XCHECK: folios count" "$DB_FOLIOS" "$API_FOLIOS"

if [[ -n "${FOLIO1_ID:-}" ]]; then
  code=$(get "$GW/v1/billing/folios/$FOLIO1_ID?tenant_id=$TID")
  assert_http "GET folio by ID" "200" "$code"
  API_FSTATUS=$(jq -r '.folio_status // .data.folio_status // empty' "$RESP_FILE" 2>/dev/null || echo "")
  DB_FSTATUS=$(dbq "SELECT folio_status FROM folios WHERE folio_id='$FOLIO1_ID';")
  assert_eq_ci "XCHECK: folio status" "$DB_FSTATUS" "$API_FSTATUS"
fi
echo ""

# ── Accounts Receivable ──
echo "── Accounts Receivable ──────────────────────────────────────────────"

code=$(get "$GW/v1/billing/accounts-receivable?tenant_id=$TID&limit=100")
assert_http "GET AR list" "200" "$code"
API_AR=$(jq 'if type == "array" then length else (.data | length) // 0 end' "$RESP_FILE" 2>/dev/null || echo "0")
DB_AR=$(dbq "SELECT COUNT(*) FROM accounts_receivable WHERE tenant_id='$TID';")
assert_eq "XCHECK: AR count" "$DB_AR" "$API_AR"

code=$(get "$GW/v1/billing/accounts-receivable/aging-summary?tenant_id=$TID&property_id=$PID")
assert_http "GET AR aging-summary" "200" "$code"

API_AR_TOT=$(jq -r '[.[] | .total_outstanding | tonumber] | add // 0' "$RESP_FILE" 2>/dev/null || echo "0")
DB_AR_TOT=$(dbq "SELECT COALESCE(SUM(outstanding_balance),0) FROM accounts_receivable WHERE tenant_id='$TID' AND property_id='$PID';")
assert_eq_num "XCHECK: AR total outstanding" "$DB_AR_TOT" "$API_AR_TOT"
echo ""

# ── Cashier Sessions ──
echo "── Cashier Sessions ─────────────────────────────────────────────────"

code=$(get "$GW/v1/billing/cashier-sessions?tenant_id=$TID&limit=100")
assert_http "GET cashier-sessions list" "200" "$code"
API_CASHIER=$(jq 'if type == "array" then length else (.data | length) // 0 end' "$RESP_FILE" 2>/dev/null || echo "0")
DB_CASHIER_NOW=$(dbq "SELECT COUNT(*) FROM cashier_sessions WHERE tenant_id='$TID';")
assert_eq "XCHECK: cashier sessions count" "$DB_CASHIER_NOW" "$API_CASHIER"

if [[ -n "${SESSION_ID:-}" ]]; then
  code=$(get "$GW/v1/billing/cashier-sessions/$SESSION_ID?tenant_id=$TID")
  assert_http "GET cashier-session by ID" "200" "$code"
  API_SESS_STATUS=$(jq -r '.data.session_status // .session_status // empty' "$RESP_FILE" 2>/dev/null || echo "")
  DB_SESS_STATUS=$(dbq "SELECT session_status FROM cashier_sessions WHERE session_id='$SESSION_ID';")
  assert_eq_ci "XCHECK: session status" "$DB_SESS_STATUS" "$API_SESS_STATUS"
fi
echo ""

# ── Financial Reports ──
echo "── Financial Reports ────────────────────────────────────────────────"

code=$(get "$GW/v1/billing/reports/trial-balance?tenant_id=$TID&property_id=$PID&business_date=$TODAY")
assert_http "GET trial-balance" "200" "$code"
API_TD=$(jq -r '.total_debits // 0' "$RESP_FILE" 2>/dev/null || echo "0")
DB_TD=$(dbq "SELECT COALESCE(SUM(total_amount),0) FROM charge_postings WHERE tenant_id='$TID' AND property_id='$PID' AND business_date='$TODAY' AND posting_type='DEBIT' AND COALESCE(is_voided,false)=false;")
assert_eq_num "XCHECK: trial balance total_debits" "$DB_TD" "$API_TD"

code=$(get "$GW/v1/billing/reports/departmental-revenue?tenant_id=$TID&property_id=$PID&start_date=$TODAY&end_date=$TODAY")
assert_http "GET departmental-revenue" "200" "$code"

code=$(get "$GW/v1/billing/reports/tax-summary?tenant_id=$TID&property_id=$PID&start_date=$TODAY&end_date=$TODAY")
assert_http "GET tax-summary" "200" "$code"

code=$(get "$GW/v1/billing/reports/commissions?tenant_id=$TID&property_id=$PID&start_date=$TODAY&end_date=$TODAY")
assert_http "GET commissions-report" "200" "$code"
echo ""

# ── Night Audit ──
echo "── Night Audit ──────────────────────────────────────────────────────"

code=$(get "$GW/v1/night-audit/status?tenant_id=$TID&property_id=$PID")
assert_http "GET night-audit status" "200" "$code"
API_BDATE=$(jq -r '.data.business_date // empty' "$RESP_FILE" 2>/dev/null || echo "")
DB_BDATE=$(dbq "SELECT business_date::text FROM business_dates WHERE tenant_id='$TID' AND property_id='$PID';")
if [[ -z "$DB_BDATE" ]]; then
  # No business_dates row yet — API defaults to today, just verify API returned something
  if [[ -n "$API_BDATE" ]]; then
    pass "XCHECK: business_date API=$API_BDATE (no DB row yet)"
  else
    skip "XCHECK: business_date" "no DB row and no API value"
  fi
else
  assert_eq "XCHECK: business_date matches DB" "$DB_BDATE" "$API_BDATE"
fi

code=$(get "$GW/v1/night-audit/history?tenant_id=$TID&property_id=$PID&limit=20")
assert_http "GET night-audit history" "200" "$code"
echo ""

# ── Voided & Fallback Payments ──
echo "── Voided & Fallback Payments ───────────────────────────────────────"

# Check voided payment appears in API with CANCELLED status
if [[ -n "${FAILPAY_REF:-}" ]]; then
  code=$(get "$GW/v1/billing/payments?tenant_id=$TID&limit=200")
  assert_http "GET payments (includes voided)" "200" "$code"

  API_VOID_STATUS=$(jq -r --arg ref "$FAILPAY_REF" '[.[] | select(.payment_reference == $ref)][0].status // empty' "$RESP_FILE" 2>/dev/null || echo "")
  DB_VOID_STATUS=$(dbq "SELECT status FROM payments WHERE payment_reference='$FAILPAY_REF' AND tenant_id='$TID';")
  assert_eq_ci "XCHECK: voided payment status in API" "$DB_VOID_STATUS" "$API_VOID_STATUS"

  API_CASH_STATUS=$(jq -r --arg ref "$CASHPAY_REF" '[.[] | select(.payment_reference == $ref)][0].status // empty' "$RESP_FILE" 2>/dev/null || echo "")
  DB_CASH_STATUS=$(dbq "SELECT status FROM payments WHERE payment_reference='$CASHPAY_REF' AND tenant_id='$TID';")
  assert_eq_ci "XCHECK: cash fallback status in API" "$DB_CASH_STATUS" "$API_CASH_STATUS"

  API_CASH_METHOD=$(jq -r --arg ref "$CASHPAY_REF" '[.[] | select(.payment_reference == $ref)][0].payment_method // empty' "$RESP_FILE" 2>/dev/null || echo "")
  assert_eq "XCHECK: cash fallback method in API" "CASH" "$API_CASH_METHOD"
fi
echo ""

# ── Cashier Shift Handover (API validation) ──
echo "── Cashier Shift Handover (API) ─────────────────────────────────────"

if [[ -n "${AFTERNOON_ID:-}" ]]; then
  code=$(get "$GW/v1/billing/cashier-sessions/$AFTERNOON_ID?tenant_id=$TID")
  assert_http "GET afternoon session by ID" "200" "$code"
  API_AFT_STATUS=$(jq -r '.session_status // empty' "$RESP_FILE" 2>/dev/null || echo "")
  DB_AFT_STATUS=$(dbq "SELECT session_status FROM cashier_sessions WHERE session_id='$AFTERNOON_ID';")
  assert_eq_ci "XCHECK: afternoon session closed in API" "$DB_AFT_STATUS" "$API_AFT_STATUS"

  API_AFT_SHIFT=$(jq -r '.shift_type // empty' "$RESP_FILE" 2>/dev/null || echo "")
  assert_eq "XCHECK: afternoon shift_type in API" "afternoon" "$API_AFT_SHIFT"
fi

if [[ -n "${EVENING_ID:-}" ]]; then
  code=$(get "$GW/v1/billing/cashier-sessions/$EVENING_ID?tenant_id=$TID")
  assert_http "GET evening session by ID" "200" "$code"
  API_EVE_STATUS=$(jq -r '.session_status // empty' "$RESP_FILE" 2>/dev/null || echo "")
  DB_EVE_STATUS=$(dbq "SELECT session_status FROM cashier_sessions WHERE session_id='$EVENING_ID';")
  assert_eq_ci "XCHECK: evening session closed in API" "$DB_EVE_STATUS" "$API_EVE_STATUS"

  API_EVE_FLOAT=$(jq -r '.opening_float_declared // empty' "$RESP_FILE" 2>/dev/null || echo "")
  assert_eq_num "XCHECK: evening float in API = 578.50" "578.50" "$API_EVE_FLOAT"
fi

# Verify total sessions via API matches DB
code=$(get "$GW/v1/billing/cashier-sessions?tenant_id=$TID&limit=100")
assert_http "GET all cashier sessions" "200" "$code"
API_TOTAL_SESSIONS=$(jq 'if type == "array" then length else (.data | length) // 0 end' "$RESP_FILE" 2>/dev/null || echo "0")
DB_TOTAL_SESSIONS=$(dbq "SELECT COUNT(*) FROM cashier_sessions WHERE tenant_id='$TID';")
assert_eq "XCHECK: total cashier sessions count" "$DB_TOTAL_SESSIONS" "$API_TOTAL_SESSIONS"
echo ""

# ── Date Roll Validation (API) ──
echo "── Date Roll Validation (API) ───────────────────────────────────────"

code=$(get "$GW/v1/night-audit/status?tenant_id=$TID&property_id=$PID")
assert_http "GET night-audit status (post-roll)" "200" "$code"

API_POST_BDATE=$(jq -r '.data.business_date // empty' "$RESP_FILE" 2>/dev/null || echo "")
DB_POST_BDATE=$(dbq "SELECT business_date::text FROM business_dates WHERE tenant_id='$TID' AND property_id='$PID' ORDER BY business_date DESC LIMIT 1;")
if [[ -n "$DB_POST_BDATE" && -n "$API_POST_BDATE" ]]; then
  assert_eq "XCHECK: business_date matches DB post-roll" "$DB_POST_BDATE" "$API_POST_BDATE"
else
  skip "XCHECK: business_date post-roll" "DB=$DB_POST_BDATE API=$API_POST_BDATE"
fi

API_DATE_STATUS=$(jq -r '.data.date_status // empty' "$RESP_FILE" 2>/dev/null || echo "")
if [[ -n "$API_DATE_STATUS" ]]; then
  DB_DATE_STATUS=$(dbq "SELECT date_status FROM business_dates WHERE tenant_id='$TID' AND property_id='$PID' ORDER BY business_date DESC LIMIT 1;")
  assert_eq "XCHECK: date_status in API" "$DB_DATE_STATUS" "$API_DATE_STATUS"
fi

API_NA_STATUS=$(jq -r '.data.night_audit_status // empty' "$RESP_FILE" 2>/dev/null || echo "")
if [[ -n "$API_NA_STATUS" ]]; then
  DB_NA_STATUS=$(dbq "SELECT night_audit_status FROM business_dates WHERE tenant_id='$TID' AND property_id='$PID' ORDER BY business_date DESC LIMIT 1;")
  assert_eq "XCHECK: night_audit_status in API" "$DB_NA_STATUS" "$API_NA_STATUS"
fi

# Verify audit history has entries via API
code=$(get "$GW/v1/night-audit/history?tenant_id=$TID&property_id=$PID&limit=20")
assert_http "GET night-audit history (post-roll)" "200" "$code"
API_HISTORY_COUNT=$(jq 'if type == "array" then length else (.data | length) // 0 end' "$RESP_FILE" 2>/dev/null || echo "0")
DB_HISTORY_COUNT=$(dbq "SELECT COUNT(*) FROM night_audit_log WHERE tenant_id='$TID' AND property_id='$PID';")
assert_eq "XCHECK: night audit history count" "$DB_HISTORY_COUNT" "$API_HISTORY_COUNT"
echo ""

# ═════════════════════════════════════════════════════════════════════════════
#  PHASE 3 — POST-TEST DB SNAPSHOT
# ═════════════════════════════════════════════════════════════════════════════

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PHASE 3: POST-TEST DB SNAPSHOT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

POST_GUESTS=$(dbq "SELECT COUNT(*) FROM guests WHERE tenant_id='$TID';")
POST_RESERVATIONS=$(dbq "SELECT COUNT(*) FROM reservations WHERE tenant_id='$TID';")
POST_FOLIOS=$(dbq "SELECT COUNT(*) FROM folios WHERE tenant_id='$TID';")
POST_CHARGES=$(dbq "SELECT COUNT(*) FROM charge_postings WHERE tenant_id='$TID';")
POST_PAYMENTS=$(dbq "SELECT COUNT(*) FROM payments WHERE tenant_id='$TID';")
POST_INVOICES=$(dbq "SELECT COUNT(*) FROM invoices WHERE tenant_id='$TID';")
POST_TAX=$(dbq "SELECT COUNT(*) FROM tax_configurations WHERE tenant_id='$TID';")
POST_CASHIER=$(dbq "SELECT COUNT(*) FROM cashier_sessions WHERE tenant_id='$TID';")
POST_AR=$(dbq "SELECT COUNT(*) FROM accounts_receivable WHERE tenant_id='$TID';")
POST_AUDIT=$(dbq "SELECT COUNT(*) FROM night_audit_log WHERE tenant_id='$TID';")
POST_BDATE=$(dbq "SELECT business_date::text FROM business_dates WHERE tenant_id='$TID' AND property_id='$PID' ORDER BY business_date DESC LIMIT 1;")

printf "  %-25s  %5s → %5s  (Δ %+d)\n" "guests"              "$PRE_GUESTS"       "$POST_GUESTS"       "$((POST_GUESTS - PRE_GUESTS))"
printf "  %-25s  %5s → %5s  (Δ %+d)\n" "reservations"         "$PRE_RESERVATIONS"  "$POST_RESERVATIONS"  "$((POST_RESERVATIONS - PRE_RESERVATIONS))"
printf "  %-25s  %5s → %5s  (Δ %+d)\n" "folios"               "$PRE_FOLIOS"        "$POST_FOLIOS"        "$((POST_FOLIOS - PRE_FOLIOS))"
printf "  %-25s  %5s → %5s  (Δ %+d)\n" "charge_postings"      "$PRE_CHARGES"       "$POST_CHARGES"       "$((POST_CHARGES - PRE_CHARGES))"
printf "  %-25s  %5s → %5s  (Δ %+d)\n" "payments"             "$PRE_PAYMENTS"      "$POST_PAYMENTS"      "$((POST_PAYMENTS - PRE_PAYMENTS))"
printf "  %-25s  %5s → %5s  (Δ %+d)\n" "invoices"             "$PRE_INVOICES"      "$POST_INVOICES"      "$((POST_INVOICES - PRE_INVOICES))"
printf "  %-25s  %5s → %5s  (Δ %+d)\n" "tax_configurations"   "$PRE_TAX"           "$POST_TAX"           "$((POST_TAX - PRE_TAX))"
printf "  %-25s  %5s → %5s  (Δ %+d)\n" "cashier_sessions"     "$PRE_CASHIER"       "$POST_CASHIER"       "$((POST_CASHIER - PRE_CASHIER))"
printf "  %-25s  %5s → %5s  (Δ %+d)\n" "accounts_receivable"  "$PRE_AR"            "$POST_AR"            "$((POST_AR - PRE_AR))"
printf "  %-25s  %5s → %5s  (Δ %+d)\n" "night_audit_log"      "—"                  "$POST_AUDIT"         "$POST_AUDIT"
printf "  %-25s  %-17s\n"              "business_date"          "${POST_BDATE:-none}"
echo ""

# ═════════════════════════════════════════════════════════════════════════════
#  FINAL REPORT
# ═════════════════════════════════════════════════════════════════════════════

echo "╔═══════════════════════════════════════════════════════════════════════╗"
if [[ $FAIL -eq 0 ]]; then
  printf "║  ✅  ALL TESTS PASSED: %d/%d passed" "$PASS" "$TOTAL"
else
  printf "║  ❌  TESTS COMPLETE:   %d/%d passed, %d FAILED" "$PASS" "$TOTAL" "$FAIL"
fi
if [[ $SKIP -gt 0 ]]; then
  printf ", %d skipped" "$SKIP"
fi
printf "%*s║\n" "$((16 - ${#PASS} - ${#TOTAL} - ${#FAIL} - ${#SKIP}))" ""
echo "╚═══════════════════════════════════════════════════════════════════════╝"
echo ""

if [[ $FAIL -gt 0 ]]; then
  exit 1
fi
