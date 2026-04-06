#!/usr/bin/env bash
###############################################################################
# test-accounts-realdata.sh
# End-to-end accounts/billing test with real data seeding
#
# Seeds guests → reservations → charges → payments → invoices → cashier
# sessions → tax configs → AR entries, then validates all read endpoints.
#
# Usage:
#   ./http_test/test-accounts-realdata.sh          # Full run
#   ./http_test/test-accounts-realdata.sh --skip-seed   # Skip seeding, just test reads
#   ./http_test/test-accounts-realdata.sh --clean       # Clean seeded data first
#
# Prerequisites:
#   - All services running (pnpm run dev)
#   - jq installed
#   - get-token.sh working
###############################################################################
set -euo pipefail
cd "$(dirname "$0")/.."

# ─── Configuration ───────────────────────────────────────────────────────────
GW="http://localhost:8080"
TID="11111111-1111-1111-1111-111111111111"
PID="22222222-2222-2222-2222-222222222222"
RTID="44444444-4444-4444-4444-444444444444"  # Cityline King room type
TODAY=$(date +%Y-%m-%d)
TOMORROW=$(date -d "+1 day" +%Y-%m-%d 2>/dev/null || date -v+1d +%Y-%m-%d)
IN3DAYS=$(date -d "+3 days" +%Y-%m-%d 2>/dev/null || date -v+3d +%Y-%m-%d)
IN5DAYS=$(date -d "+5 days" +%Y-%m-%d 2>/dev/null || date -v+5d +%Y-%m-%d)

PASS=0; FAIL=0; TOTAL=0; WARN=0
SKIP_SEED=false
CLEAN=false

# Parse args
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
  if [[ -z "$TOKEN" ]]; then
    echo "❌ Failed to get auth token"; exit 1
  fi
}

# POST helper — sends JSON, returns HTTP status code, body in /tmp/test_resp.json
post() {
  local url="$1" body="$2"
  curl -s -o /tmp/test_resp.json -w "%{http_code}" \
    -X POST "$url" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$body"
}

# GET helper — returns HTTP status code, body in /tmp/test_resp.json
get() {
  local url="$1"
  curl -s -o /tmp/test_resp.json -w "%{http_code}" \
    "$url" \
    -H "Authorization: Bearer $TOKEN"
}

# Test a GET endpoint
smoke() {
  local label="$1" url="$2"
  TOTAL=$((TOTAL+1))
  local code
  code=$(get "$url")
  if [[ "$code" =~ ^2 ]]; then
    PASS=$((PASS+1))
    local count
    count=$(jq -r 'if type == "object" then (.data | if type == "array" then length else "obj" end) // "ok" else length end' /tmp/test_resp.json 2>/dev/null || echo "?")
    printf "  ✅ %-50s %s  items=%s\n" "$label" "$code" "$count"
  else
    FAIL=$((FAIL+1))
    local msg
    msg=$(jq -r '.detail // .message // .error // empty' /tmp/test_resp.json 2>/dev/null || echo "")
    printf "  ❌ %-50s %s  %s\n" "$label" "$code" "${msg:0:80}"
  fi
}

# Seed a command via REST shortcut and wait for Kafka processing
seed_command() {
  local label="$1" url="$2" body="$3"
  printf "  ⏳ %-50s " "$label"
  local code
  code=$(post "$url" "$body")
  if [[ "$code" == "202" ]]; then
    local cmd_id
    cmd_id=$(jq -r '.command_id // empty' /tmp/test_resp.json 2>/dev/null || echo "")
    printf "✅ 202  cmd=%s\n" "${cmd_id:0:8}"
  elif [[ "$code" =~ ^2 ]]; then
    printf "✅ %s\n" "$code"
  else
    local msg
    msg=$(jq -r '.detail // .message // .error // empty' /tmp/test_resp.json 2>/dev/null || echo "")
    printf "❌ %s  %s\n" "$code" "${msg:0:80}"
    return 1
  fi
  return 0
}

# Execute a command via the generic command center route
exec_command() {
  local label="$1" cmd_name="$2" payload="$3"
  local body
  body=$(printf '{"tenant_id":"%s","payload":%s}' "$TID" "$payload")
  seed_command "$label" "$GW/v1/commands/$cmd_name/execute" "$body"
}

# Wait for async Kafka processing
wait_kafka() {
  local secs="${1:-3}"
  printf "  ⏱  Waiting %ds for Kafka processing...\n" "$secs"
  sleep "$secs"
}

# DB query helper (read-only diagnostics)
dbq() {
  PGPASSWORD=postgres psql -h localhost -U postgres -d tartware -t -A -c "$1" 2>/dev/null
}

# ─── Header ─────────────────────────────────────────────────────────────────

echo ""
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║       ACCOUNTS & BILLING — REAL DATA END-TO-END TEST            ║"
echo "╠═══════════════════════════════════════════════════════════════════╣"
echo "║  Tenant:   $TID  ║"
echo "║  Property: $PID  ║"
echo "║  Date:     $TODAY                                    ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

get_token
echo "🔑 Auth token acquired"
echo ""

# ─── Optional: Clean previous test data ─────────────────────────────────────
if $CLEAN; then
  echo "🧹 Cleaning previous test data..."
  dbq "DELETE FROM charge_postings WHERE tenant_id = '$TID';" || true
  dbq "DELETE FROM payment_transactions WHERE tenant_id = '$TID';" || true
  dbq "DELETE FROM invoices WHERE tenant_id = '$TID';" || true
  dbq "DELETE FROM accounts_receivable WHERE tenant_id = '$TID';" || true
  dbq "DELETE FROM cashier_sessions WHERE tenant_id = '$TID';" || true
  dbq "DELETE FROM tax_configurations WHERE tenant_id = '$TID';" || true
  dbq "DELETE FROM folios WHERE tenant_id = '$TID';" || true
  dbq "DELETE FROM reservations WHERE tenant_id = '$TID';" || true
  echo "  ✅ Cleaned"
  echo ""
fi

# ═══════════════════════════════════════════════════════════════════════════
# PHASE 1: SEED DATA
# ═══════════════════════════════════════════════════════════════════════════

if ! $SKIP_SEED; then

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PHASE 1: SEED DATA"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── 1.1  Guests ──────────────────────────────────────────────────────────
echo "── 1.1  Create Guests ──"

seed_command "Guest: John Anderson" \
  "$GW/v1/guests" \
  "{\"tenant_id\":\"$TID\",\"first_name\":\"John\",\"last_name\":\"Anderson\",\"email\":\"john.anderson.test@example.com\",\"phone\":\"+14155551234\"}"

seed_command "Guest: Sarah Mitchell" \
  "$GW/v1/guests" \
  "{\"tenant_id\":\"$TID\",\"first_name\":\"Sarah\",\"last_name\":\"Mitchell\",\"email\":\"sarah.mitchell.test@example.com\",\"phone\":\"+14155555678\"}"

wait_kafka 4

# Look up guest IDs from DB
GUEST1_ID=$(dbq "SELECT id FROM guests WHERE email = 'john.anderson.test@example.com' AND tenant_id = '$TID' LIMIT 1;")
GUEST2_ID=$(dbq "SELECT id FROM guests WHERE email = 'sarah.mitchell.test@example.com' AND tenant_id = '$TID' LIMIT 1;")

if [[ -z "$GUEST1_ID" ]]; then
  echo "  ⚠️  Guest 1 not found in DB — checking if any guest exists..."
  GUEST1_ID=$(dbq "SELECT id FROM guests WHERE tenant_id = '$TID' ORDER BY created_at DESC LIMIT 1;")
fi
if [[ -z "$GUEST2_ID" ]]; then
  GUEST2_ID=$(dbq "SELECT id FROM guests WHERE tenant_id = '$TID' AND id != '$GUEST1_ID' ORDER BY created_at DESC LIMIT 1;")
fi

echo "  📋 Guest 1: ${GUEST1_ID:-NOT_FOUND}"
echo "  📋 Guest 2: ${GUEST2_ID:-NOT_FOUND}"

if [[ -z "$GUEST1_ID" ]]; then
  echo "  ❌ No guests found — cannot continue seeding"
  exit 1
fi
echo ""

# ── 1.2  Tax Configurations ─────────────────────────────────────────────
echo "── 1.2  Create Tax Configurations ──"

exec_command 'Tax: State Sales Tax (8.875%)' \
  "billing.tax_config.create" \
  "{\"property_id\":\"$PID\",\"tax_code\":\"STATE_SALES\",\"tax_name\":\"State Sales Tax\",\"tax_type\":\"sales_tax\",\"country_code\":\"US\",\"state_province\":\"NY\",\"tax_rate\":8.875,\"effective_from\":\"2024-01-01\",\"is_active\":true,\"applies_to\":[\"ROOM\",\"MINIBAR\",\"RESTAURANT\",\"BAR\",\"ROOM_SVC\"],\"calculation_method\":\"standard\"}"

exec_command 'Tax: City Occupancy Tax (5.875%)' \
  "billing.tax_config.create" \
  "{\"property_id\":\"$PID\",\"tax_code\":\"CITY_OCC\",\"tax_name\":\"City Occupancy Tax\",\"tax_type\":\"occupancy_tax\",\"country_code\":\"US\",\"state_province\":\"NY\",\"city\":\"New York\",\"tax_rate\":5.875,\"effective_from\":\"2024-01-01\",\"is_active\":true,\"applies_to\":[\"ROOM\"],\"calculation_method\":\"standard\"}"

exec_command 'Tax: Tourism Fee ($2.00 flat)' \
  "billing.tax_config.create" \
  "{\"property_id\":\"$PID\",\"tax_code\":\"TOURISM_FEE\",\"tax_name\":\"Tourism Development Fee\",\"tax_type\":\"tourism_tax\",\"country_code\":\"US\",\"tax_rate\":0,\"is_percentage\":false,\"fixed_amount\":2.00,\"effective_from\":\"2024-01-01\",\"is_active\":true,\"applies_to\":[\"ROOM\"],\"calculation_method\":\"standard\"}"

wait_kafka 3
echo ""

# ── 1.3  Reservations ───────────────────────────────────────────────────
echo "── 1.3  Create Reservations ──"

seed_command "Reservation: John (3 nights)" \
  "$GW/v1/tenants/$TID/reservations" \
  "{\"property_id\":\"$PID\",\"guest_id\":\"$GUEST1_ID\",\"room_type_id\":\"$RTID\",\"check_in_date\":\"$TODAY\",\"check_out_date\":\"$IN3DAYS\",\"total_amount\":597.00,\"source\":\"DIRECT\"}"

if [[ -n "$GUEST2_ID" ]]; then
  seed_command "Reservation: Sarah (5 nights)" \
    "$GW/v1/tenants/$TID/reservations" \
    "{\"property_id\":\"$PID\",\"guest_id\":\"$GUEST2_ID\",\"room_type_id\":\"$RTID\",\"check_in_date\":\"$TOMORROW\",\"check_out_date\":\"$IN5DAYS\",\"total_amount\":796.00,\"source\":\"WEBSITE\"}"
fi

wait_kafka 5

# Look up reservation & folio IDs
RES1_ID=$(dbq "SELECT id FROM reservations WHERE guest_id = '$GUEST1_ID' AND tenant_id = '$TID' ORDER BY created_at DESC LIMIT 1;")
FOLIO1_ID=$(dbq "SELECT folio_id FROM folios WHERE reservation_id = '$RES1_ID' AND tenant_id = '$TID' LIMIT 1;")

RES2_ID=""
FOLIO2_ID=""
if [[ -n "$GUEST2_ID" ]]; then
  RES2_ID=$(dbq "SELECT id FROM reservations WHERE guest_id = '$GUEST2_ID' AND tenant_id = '$TID' ORDER BY created_at DESC LIMIT 1;")
  FOLIO2_ID=$(dbq "SELECT folio_id FROM folios WHERE reservation_id = '$RES2_ID' AND tenant_id = '$TID' LIMIT 1;")
fi

echo "  📋 Reservation 1: ${RES1_ID:-NOT_FOUND}  Folio: ${FOLIO1_ID:-NOT_FOUND}"
echo "  📋 Reservation 2: ${RES2_ID:-N/A}  Folio: ${FOLIO2_ID:-N/A}"

if [[ -z "$RES1_ID" ]]; then
  echo "  ❌ No reservation found — cannot continue"
  exit 1
fi
echo ""

# ── 1.4  Charge Postings ────────────────────────────────────────────────
echo "── 1.4  Post Charges ──"

seed_command 'Charge: Room night ($199)' \
  "$GW/v1/tenants/$TID/billing/charges" \
  "{\"property_id\":\"$PID\",\"reservation_id\":\"$RES1_ID\",\"amount\":199.00,\"charge_code\":\"ROOM\",\"posting_type\":\"DEBIT\",\"quantity\":1,\"description\":\"Room charge - Cityline King\"}"

seed_command 'Charge: Minibar ($24.50)' \
  "$GW/v1/tenants/$TID/billing/charges" \
  "{\"property_id\":\"$PID\",\"reservation_id\":\"$RES1_ID\",\"amount\":24.50,\"charge_code\":\"MINIBAR\",\"posting_type\":\"DEBIT\",\"quantity\":1,\"description\":\"Minibar consumption\"}"

seed_command 'Charge: Restaurant ($85.00)' \
  "$GW/v1/tenants/$TID/billing/charges" \
  "{\"property_id\":\"$PID\",\"reservation_id\":\"$RES1_ID\",\"amount\":85.00,\"charge_code\":\"RESTAURANT\",\"posting_type\":\"DEBIT\",\"quantity\":1,\"description\":\"Dinner for two\"}"

seed_command 'Charge: Spa ($150.00)' \
  "$GW/v1/tenants/$TID/billing/charges" \
  "{\"property_id\":\"$PID\",\"reservation_id\":\"$RES1_ID\",\"amount\":150.00,\"charge_code\":\"SPA\",\"posting_type\":\"DEBIT\",\"quantity\":1}"

if [[ -n "$RES2_ID" ]]; then
  seed_command 'Charge: Room (Sarah, $199)' \
    "$GW/v1/tenants/$TID/billing/charges" \
    "{\"property_id\":\"$PID\",\"reservation_id\":\"$RES2_ID\",\"amount\":199.00,\"charge_code\":\"ROOM\",\"posting_type\":\"DEBIT\",\"quantity\":1}"

  seed_command 'Charge: Laundry (Sarah, $35)' \
    "$GW/v1/tenants/$TID/billing/charges" \
    "{\"property_id\":\"$PID\",\"reservation_id\":\"$RES2_ID\",\"amount\":35.00,\"charge_code\":\"LAUNDRY\",\"posting_type\":\"DEBIT\",\"quantity\":1}"
fi

wait_kafka 3
echo ""

# ── 1.5  Payment Capture ────────────────────────────────────────────────
echo "── 1.5  Capture Payments ──"

PAY_REF1="PAY-TEST-$(date +%s)-001"
seed_command 'Payment: John CC ($300)' \
  "$GW/v1/tenants/$TID/billing/payments/capture" \
  "{\"payment_reference\":\"$PAY_REF1\",\"property_id\":\"$PID\",\"reservation_id\":\"$RES1_ID\",\"guest_id\":\"$GUEST1_ID\",\"amount\":300.00,\"payment_method\":\"CREDIT_CARD\"}"

PAY_REF2="PAY-TEST-$(date +%s)-002"
seed_command 'Payment: John Cash ($100)' \
  "$GW/v1/tenants/$TID/billing/payments/capture" \
  "{\"payment_reference\":\"$PAY_REF2\",\"property_id\":\"$PID\",\"reservation_id\":\"$RES1_ID\",\"guest_id\":\"$GUEST1_ID\",\"amount\":100.00,\"payment_method\":\"CASH\"}"

if [[ -n "$RES2_ID" && -n "$GUEST2_ID" ]]; then
  PAY_REF3="PAY-TEST-$(date +%s)-003"
  seed_command 'Payment: Sarah CC ($200)' \
    "$GW/v1/tenants/$TID/billing/payments/capture" \
    "{\"payment_reference\":\"$PAY_REF3\",\"property_id\":\"$PID\",\"reservation_id\":\"$RES2_ID\",\"guest_id\":\"$GUEST2_ID\",\"amount\":200.00,\"payment_method\":\"CREDIT_CARD\"}"
fi

wait_kafka 3
echo ""

# ── 1.6  Invoices ────────────────────────────────────────────────────────
echo "── 1.6  Create Invoices ──"

seed_command 'Invoice: John Anderson ($458.50)' \
  "$GW/v1/tenants/$TID/billing/invoices" \
  "{\"property_id\":\"$PID\",\"reservation_id\":\"$RES1_ID\",\"guest_id\":\"$GUEST1_ID\",\"total_amount\":458.50}"

if [[ -n "$RES2_ID" && -n "$GUEST2_ID" ]]; then
  seed_command 'Invoice: Sarah Mitchell ($234)' \
    "$GW/v1/tenants/$TID/billing/invoices" \
    "{\"property_id\":\"$PID\",\"reservation_id\":\"$RES2_ID\",\"guest_id\":\"$GUEST2_ID\",\"total_amount\":234.00}"
fi

wait_kafka 3
echo ""

# ── 1.7  Cashier Sessions ───────────────────────────────────────────────
echo "── 1.7  Cashier Sessions ──"

# Use the first user as cashier (the logged-in admin)
CASHIER_ID=$(dbq "SELECT id FROM users WHERE tenant_id = '$TID' LIMIT 1;")
CASHIER_NAME=$(dbq "SELECT COALESCE(first_name || ' ' || last_name, username) FROM users WHERE id = '$CASHIER_ID' LIMIT 1;")
echo "  📋 Cashier: ${CASHIER_NAME:-admin} (${CASHIER_ID:-?})"

if [[ -n "$CASHIER_ID" ]]; then
  seed_command "Cashier: Open morning shift" \
    "$GW/v1/tenants/$TID/billing/cashier-sessions/open" \
    "{\"property_id\":\"$PID\",\"cashier_id\":\"$CASHIER_ID\",\"cashier_name\":\"$CASHIER_NAME\",\"shift_type\":\"morning\",\"opening_float\":500.00}"

  wait_kafka 3

  # Look up session ID to close it
  SESSION_ID=$(dbq "SELECT session_id FROM cashier_sessions WHERE cashier_id = '$CASHIER_ID' AND tenant_id = '$TID' ORDER BY created_at DESC LIMIT 1;")
  echo "  📋 Session: ${SESSION_ID:-NOT_FOUND}"

  if [[ -n "$SESSION_ID" ]]; then
    seed_command "Cashier: Close morning shift" \
      "$GW/v1/tenants/$TID/billing/cashier-sessions/close" \
      "{\"session_id\":\"$SESSION_ID\",\"closing_cash_declared\":612.00,\"closing_cash_counted\":610.50}"

    wait_kafka 2
  fi
fi
echo ""

# ── 1.8  Accounts Receivable ────────────────────────────────────────────
echo "── 1.8  Accounts Receivable ──"

exec_command 'AR: Corporate direct-bill ($158.50)' \
  "billing.ar.post" \
  "{\"reservation_id\":\"$RES1_ID\",\"account_type\":\"corporate\",\"account_id\":\"$GUEST1_ID\",\"account_name\":\"Acme Corp Travel\",\"amount\":158.50,\"payment_terms\":\"NET_30\"}"

if [[ -n "$RES2_ID" ]]; then
  exec_command 'AR: Travel agent ($34.00)' \
    "billing.ar.post" \
    "{\"reservation_id\":\"$RES2_ID\",\"account_type\":\"travel_agent\",\"account_id\":\"$GUEST2_ID\",\"account_name\":\"Globetrotter Agency\",\"amount\":34.00,\"payment_terms\":\"NET_30\"}"
fi

wait_kafka 3
echo ""

# ── 1.9  Night Audit ────────────────────────────────────────────────────
echo "── 1.9  Night Audit ──"

exec_command "Night Audit: Execute" \
  "billing.night_audit.execute" \
  "{\"property_id\":\"$PID\",\"post_room_charges\":true,\"post_package_charges\":false,\"mark_no_shows\":true,\"advance_date\":false}"

wait_kafka 5
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SEED COMPLETE — Data counts:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Guests:         $(dbq "SELECT COUNT(*) FROM guests WHERE tenant_id = '$TID';")"
echo "  Reservations:   $(dbq "SELECT COUNT(*) FROM reservations WHERE tenant_id = '$TID';")"
echo "  Folios:         $(dbq "SELECT COUNT(*) FROM folios WHERE tenant_id = '$TID';")"
echo "  Charges:        $(dbq "SELECT COUNT(*) FROM charge_postings WHERE tenant_id = '$TID';")"
echo "  Payments:       $(dbq "SELECT COUNT(*) FROM payment_transactions WHERE tenant_id = '$TID';")"
echo "  Invoices:       $(dbq "SELECT COUNT(*) FROM invoices WHERE tenant_id = '$TID';")"
echo "  Tax configs:    $(dbq "SELECT COUNT(*) FROM tax_configurations WHERE tenant_id = '$TID';")"
echo "  Cashier sess:   $(dbq "SELECT COUNT(*) FROM cashier_sessions WHERE tenant_id = '$TID';")"
echo "  AR entries:     $(dbq "SELECT COUNT(*) FROM accounts_receivable WHERE tenant_id = '$TID';")"
echo ""

else
  echo "(Skipping seed — --skip-seed flag set)"
  echo ""
  # Resolve IDs from existing data for read tests
  GUEST1_ID=$(dbq "SELECT id FROM guests WHERE tenant_id = '$TID' ORDER BY created_at DESC LIMIT 1;")
  RES1_ID=$(dbq "SELECT id FROM reservations WHERE tenant_id = '$TID' ORDER BY created_at DESC LIMIT 1;")
  FOLIO1_ID=$(dbq "SELECT folio_id FROM folios WHERE reservation_id = '$RES1_ID' AND tenant_id = '$TID' LIMIT 1;" 2>/dev/null || echo "")
fi


# ═══════════════════════════════════════════════════════════════════════════
# PHASE 2: VALIDATE READ ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PHASE 2: VALIDATE READ ENDPOINTS (expect real data)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "── FOLIOS ──"
smoke "folios list"                  "$GW/v1/billing/folios?tenant_id=$TID&limit=10"
smoke "folios by property"           "$GW/v1/billing/folios?tenant_id=$TID&property_id=$PID"
if [[ -n "${FOLIO1_ID:-}" ]]; then
  smoke "folio by ID"                "$GW/v1/billing/folios/$FOLIO1_ID?tenant_id=$TID"
fi

echo ""
echo "── CHARGES ──"
smoke "charges list"                 "$GW/v1/billing/charges?tenant_id=$TID&limit=50"
smoke "charges by property"          "$GW/v1/billing/charges?tenant_id=$TID&property_id=$PID"
if [[ -n "${RES1_ID:-}" ]]; then
  smoke "charges by reservation"     "$GW/v1/billing/charges?tenant_id=$TID&reservation_id=$RES1_ID"
fi

echo ""
echo "── PAYMENTS ──"
smoke "payments list"                "$GW/v1/billing/payments?tenant_id=$TID&limit=50"
smoke "payments by property"         "$GW/v1/billing/payments?tenant_id=$TID&property_id=$PID"

echo ""
echo "── INVOICES ──"
smoke "invoices list"                "$GW/v1/billing/invoices?tenant_id=$TID&limit=10"
smoke "invoices by property"         "$GW/v1/billing/invoices?tenant_id=$TID&property_id=$PID"
smoke "invoices status=draft"        "$GW/v1/billing/invoices?tenant_id=$TID&status=draft"

echo ""
echo "── ACCOUNTS RECEIVABLE ──"
smoke "AR list"                      "$GW/v1/billing/accounts-receivable?tenant_id=$TID&limit=50"
smoke "AR by property"               "$GW/v1/billing/accounts-receivable?tenant_id=$TID&property_id=$PID"
smoke "AR aging-summary"             "$GW/v1/billing/accounts-receivable/aging-summary?tenant_id=$TID"
smoke "AR aging-summary by property" "$GW/v1/billing/accounts-receivable/aging-summary?tenant_id=$TID&property_id=$PID"

echo ""
echo "── TAX CONFIGURATIONS ──"
smoke "tax-config list"              "$GW/v1/billing/tax-configurations?tenant_id=$TID&limit=10"
smoke "tax-config active"            "$GW/v1/billing/tax-configurations?tenant_id=$TID&is_active=true"
smoke "tax-config sales_tax"         "$GW/v1/billing/tax-configurations?tenant_id=$TID&tax_type=sales_tax"

echo ""
echo "── CASHIER SESSIONS ──"
smoke "cashier-sessions list"        "$GW/v1/billing/cashier-sessions?tenant_id=$TID&limit=10"
smoke "cashier-sessions by property" "$GW/v1/billing/cashier-sessions?tenant_id=$TID&property_id=$PID"

echo ""
echo "── FINANCIAL REPORTS ──"
smoke "trial-balance"                "$GW/v1/billing/reports/trial-balance?tenant_id=$TID&property_id=$PID&business_date=$TODAY"
smoke "departmental-revenue"         "$GW/v1/billing/reports/departmental-revenue?tenant_id=$TID&property_id=$PID&start_date=$TODAY&end_date=$TODAY"
smoke "tax-summary"                  "$GW/v1/billing/reports/tax-summary?tenant_id=$TID&property_id=$PID&start_date=$TODAY&end_date=$TODAY"
smoke "commissions"                  "$GW/v1/billing/reports/commissions?tenant_id=$TID&property_id=$PID&start_date=$TODAY&end_date=$TODAY"

echo ""
echo "── NIGHT AUDIT ──"
smoke "night-audit status"           "$GW/v1/night-audit/status?tenant_id=$TID&property_id=$PID"
smoke "night-audit history"          "$GW/v1/night-audit/history?tenant_id=$TID&limit=20"
smoke "night-audit history by prop"  "$GW/v1/night-audit/history?tenant_id=$TID&property_id=$PID"

echo ""
echo "── GUEST FOLIO (via reservation) ──"
if [[ -n "${RES1_ID:-}" ]]; then
  smoke "reservation detail"         "$GW/v1/reservations/$RES1_ID?tenant_id=$TID"
fi

# ═══════════════════════════════════════════════════════════════════════════
# RESULTS
# ═══════════════════════════════════════════════════════════════════════════

echo ""
echo "╔═══════════════════════════════════════════════════════════════════╗"
printf "║  RESULTS: %d/%d passed" "$PASS" "$TOTAL"
if [ $FAIL -gt 0 ]; then
  printf ", %d FAILED" "$FAIL"
fi
echo "$(printf '%*s' $((40 - ${#PASS} - ${#TOTAL} - ${#FAIL})) '')║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

if [ $FAIL -gt 0 ]; then
  exit 1
fi
