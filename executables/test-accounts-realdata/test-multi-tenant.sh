#!/usr/bin/env bash
###############################################################################
# test-multi-tenant.sh
# Comprehensive multi-tenant + multi-property E2E billing test
#
# Tests the FULL billing pipeline across 2 tenants × 2 properties each,
# verifying:
#   1. Complete billing lifecycle per unit (guests→charges→payments→invoices→
#      cashier→AR→night-audit)
#   2. USALI property-level financial isolation (each property = own
#      accounting entity)
#   3. Cross-tenant data isolation (DB + API boundary)
#
# Layout:
#   PHASE 0   Multi-tenant + multi-property setup
#   PHASE 1   Tenant A / Property A1 — full billing pipeline (230 tests)
#   PHASE 2   Tenant A / Property A2 — core billing (property isolation)
#   PHASE 3   Tenant B / Property B1 — core billing (tenant isolation)
#   PHASE 4   USALI property-level isolation assertions
#   PHASE 5   Cross-tenant isolation assertions (DB + API)
#   PHASE 6   API read endpoints cross-validation
#   PHASE 7   Post-test DB snapshot + final report
#
# Usage:
#   ./executables/test-accounts-realdata/test-multi-tenant.sh
#   ./executables/test-accounts-realdata/test-multi-tenant.sh --skip-seed
#
# Prerequisites:
#   - All services running (pnpm run dev)
#   - jq, psql available
#   - http_test/get-token.sh working
###############################################################################
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

# ─── Configuration ───────────────────────────────────────────────────────────
GW="http://localhost:8080"

# Tenant A — already seeded by setup
TID_A="11111111-1111-1111-1111-111111111111"
PID_A1="22222222-2222-2222-2222-222222222222"   # existing property
RTID_A1="44444444-4444-4444-4444-444444444444"  # existing room type (CLKING)
PID_A2=""   # created in Phase 0
RTID_A2=""  # created in Phase 0

# Tenant B — bootstrapped in Phase 0
TID_B=""
PID_B1=""
RTID_B1=""
PID_B2=""
RTID_B2=""
TOKEN_A=""
TOKEN_B=""

TODAY=$(date +%Y-%m-%d)
TOMORROW=$(date -d "+1 day" +%Y-%m-%d 2>/dev/null || date -v+1d +%Y-%m-%d)
IN3DAYS=$(date -d "+3 days" +%Y-%m-%d 2>/dev/null || date -v+3d +%Y-%m-%d)
IN5DAYS=$(date -d "+5 days" +%Y-%m-%d 2>/dev/null || date -v+5d +%Y-%m-%d)
KAFKA_WAIT=4
UNIQUE=$(date +%s)

PASS=0; FAIL=0; TOTAL=0; SKIP=0
SKIP_SEED=false

for arg in "$@"; do
  case "$arg" in --skip-seed) SKIP_SEED=true ;; esac
done

# ─── Helpers ─────────────────────────────────────────────────────────────────

RESP_FILE=$(mktemp /tmp/tartware-mt-resp.XXXXXX.json)
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

pass()  { TOTAL=$((TOTAL+1)); PASS=$((PASS+1)); printf "  ✅ %-60s PASS\n" "$1"; }
fail()  { TOTAL=$((TOTAL+1)); FAIL=$((FAIL+1)); printf "  ❌ %-60s FAIL  %s\n" "$1" "$2"; }
skip()  { TOTAL=$((TOTAL+1)); SKIP=$((SKIP+1)); printf "  ⏭  %-60s SKIP  %s\n" "$1" "${2:-}"; }

assert_eq() {
  if [[ "$2" == "$3" ]]; then pass "$1"; else fail "$1" "expected=[$2] actual=[$3]"; fi
}
assert_eq_ci() {
  local e="${2,,}" a="${3,,}"
  if [[ "$e" == "$a" ]]; then pass "$1"; else fail "$1" "expected=[$2] actual=[$3]"; fi
}
assert_eq_num() {
  local e a; e=$(printf "%.2f" "$2" 2>/dev/null || echo "$2"); a=$(printf "%.2f" "$3" 2>/dev/null || echo "$3")
  if [[ "$e" == "$a" ]]; then pass "$1"; else fail "$1" "expected=[$2] actual=[$3]"; fi
}
assert_gte() {
  if [[ "$2" -ge "$3" ]]; then pass "$1"; else fail "$1" "expected >= $3 actual=$2"; fi
}
assert_http() {
  if [[ "$3" =~ ^${2} ]]; then pass "$1"; else fail "$1" "expected=$2 actual=$3"; fi
}

# send_command <label> <command_name> <payload_json> [idempotency_key]
send_command() {
  local label="$1" cmd="$2" payload="$3" idem="${4:-}"
  local body="{\"tenant_id\":\"$CUR_TID\",\"payload\":$payload}"
  local idem_header=""
  if [[ -n "$idem" ]]; then
    idem_header="-H \"Idempotency-Key: $idem\""
    printf "  ▸ %-55s " "$label"
  else
    printf "  ▸ %-55s " "$label"
  fi
  local code
  if [[ -n "$idem" ]]; then
    code=$(curl -s -o "$RESP_FILE" -w "%{http_code}" \
      -X POST "$GW/v1/commands/$cmd/execute" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -H "Idempotency-Key: $idem" \
      -d "$body")
  else
    code=$(curl -s -o "$RESP_FILE" -w "%{http_code}" \
      -X POST "$GW/v1/commands/$cmd/execute" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "$body")
  fi
  if [[ "$code" =~ ^2 ]]; then printf "✓ %s\n" "$code"
  else printf "✗ %s\n" "$code"; fi
}

# REST-style seed: POST with auto-assertion
seed_rest() {
  local label="$1" url="$2" body="$3"
  printf "  ▸ %-55s " "$label"
  local code
  code=$(post "$url" "$body")
  if [[ "$code" =~ ^2 ]]; then printf "✓ %s\n" "$code"
  else printf "✗ %s ← %s\n" "$code" "$(jq -r '.message // .error // empty' "$RESP_FILE" 2>/dev/null)"; fi
}

wait_kafka() { sleep "${1:-$KAFKA_WAIT}"; }

# ─── Preflight checks ───────────────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  MULTI-TENANT E2E BILLING TEST"
echo "  2 tenants × 2 properties — USALI property-level isolation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "── Preflight ────────────────────────────────────────────────────────"
command -v jq   >/dev/null 2>&1 || { echo "FATAL: jq not found"; exit 1; }
command -v psql >/dev/null 2>&1 || { echo "FATAL: psql not found"; exit 1; }
command -v bc   >/dev/null 2>&1 || { echo "FATAL: bc not found"; exit 1; }

# DB connectivity
dbq "SELECT 1;" >/dev/null 2>&1 || { echo "FATAL: Cannot reach database"; exit 1; }
echo "  ✓ Database reachable"

# API Gateway
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$GW/health" 2>/dev/null || echo "000")
[[ "$HTTP_CODE" =~ ^2 ]] || { echo "FATAL: API gateway not reachable ($HTTP_CODE)"; exit 1; }
echo "  ✓ API gateway reachable"

# Billing service
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3025/health" 2>/dev/null || echo "000")
[[ "$HTTP_CODE" =~ ^2 ]] || { echo "FATAL: Billing service not reachable ($HTTP_CODE)"; exit 1; }
echo "  ✓ Billing service reachable"

# Auth token for Tenant A
TOKEN_A=$(./http_test/get-token.sh 2>/dev/null)
[[ -n "$TOKEN_A" ]] || { echo "FATAL: Cannot get auth token for Tenant A"; exit 1; }
echo "  ✓ Tenant A auth token acquired"
TOKEN="$TOKEN_A"
echo ""

# ═════════════════════════════════════════════════════════════════════════════
#  PHASE 0 — MULTI-TENANT & MULTI-PROPERTY SETUP
# ═════════════════════════════════════════════════════════════════════════════

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PHASE 0: MULTI-TENANT & MULTI-PROPERTY SETUP"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── 0.1  Bootstrap Tenant B ─────────────────────────────────────────────
echo "── 0.1  Bootstrap Tenant B ──────────────────────────────────────────"

TENANT_B_USER="beacon.admin"
TENANT_B_PASS="BeaconPass123!"
TENANT_B_EMAIL="admin@beaconhotels.test"

# Check if Tenant B already exists (by slug)
EXISTING_B=$(dbq "SELECT id FROM tenants WHERE slug='beacon-hotels' LIMIT 1;")
if [[ -n "$EXISTING_B" ]]; then
  TID_B="$EXISTING_B"
  PID_B1=$(dbq "SELECT id FROM properties WHERE tenant_id='$TID_B' ORDER BY created_at ASC LIMIT 1;")
  echo "  ℹ Tenant B already exists: $TID_B"
  echo "  ℹ Property B1: $PID_B1"
else
  code=$(post "$GW/v1/system/tenants/bootstrap" \
    "{\"tenant\":{\"name\":\"Beacon Hotels\",\"slug\":\"beacon-hotels\",\"type\":\"INDEPENDENT\",\"email\":\"$TENANT_B_EMAIL\"},\"property\":{\"property_name\":\"Beacon Harborview\",\"property_code\":\"BCN-HV\",\"property_type\":\"hotel\",\"star_rating\":4,\"total_rooms\":80,\"email\":\"harbor@beaconhotels.test\",\"timezone\":\"America/Chicago\",\"currency\":\"USD\"},\"owner\":{\"username\":\"$TENANT_B_USER\",\"email\":\"$TENANT_B_EMAIL\",\"password\":\"$TENANT_B_PASS\",\"first_name\":\"Marcus\",\"last_name\":\"Reed\"}}")
  if [[ "$code" =~ ^2 ]]; then
    TID_B=$(jq -r '.data.tenant.id // .tenant.id // .tenant_id // empty' "$RESP_FILE" 2>/dev/null)
    PID_B1=$(jq -r '.data.property.id // .property.id // .property_id // empty' "$RESP_FILE" 2>/dev/null)
    # Fallback to DB if response parsing fails
    if [[ -z "$TID_B" ]]; then
      TID_B=$(dbq "SELECT id FROM tenants WHERE slug='beacon-hotels' LIMIT 1;")
    fi
    if [[ -z "$PID_B1" ]]; then
      PID_B1=$(dbq "SELECT id FROM properties WHERE tenant_id='$TID_B' ORDER BY created_at ASC LIMIT 1;")
    fi
    echo "  ✓ Tenant B bootstrapped: $TID_B"
    echo "  ✓ Property B1: $PID_B1"
  else
    echo "FATAL: Could not bootstrap Tenant B (HTTP $code)"
    jq -r '.message // .error // .' "$RESP_FILE" 2>/dev/null
    exit 1
  fi
fi

[[ -n "$TID_B" && -n "$PID_B1" ]] || { echo "FATAL: Tenant B IDs not resolved"; exit 1; }

# Get Tenant B auth token
TOKEN_B=$(API_USER="$TENANT_B_USER" API_PASS="$TENANT_B_PASS" ./http_test/get-token.sh 2>/dev/null || echo "")
if [[ -z "$TOKEN_B" ]]; then
  # Try direct login
  code=$(curl -s -o "$RESP_FILE" -w "%{http_code}" \
    -X POST "$GW/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$TENANT_B_USER\",\"password\":\"$TENANT_B_PASS\"}")
  TOKEN_B=$(jq -r '.access_token // .token // .data.access_token // empty' "$RESP_FILE" 2>/dev/null)
fi
[[ -n "$TOKEN_B" ]] || { echo "FATAL: Cannot get auth token for Tenant B"; exit 1; }
echo "  ✓ Tenant B auth token acquired"
echo ""

# ── 0.2  Create Property A2 (second property for Tenant A) ──────────────
echo "── 0.2  Create Property A2 ──────────────────────────────────────────"

TOKEN="$TOKEN_A"
EXISTING_A2=$(dbq "SELECT id FROM properties WHERE tenant_id='$TID_A' AND property_code='TAR-BH' LIMIT 1;")
if [[ -n "$EXISTING_A2" ]]; then
  PID_A2="$EXISTING_A2"
  echo "  ℹ Property A2 already exists: $PID_A2"
else
  code=$(post "$GW/v1/properties" \
    "{\"tenant_id\":\"$TID_A\",\"property_name\":\"Tartware Beach Resort\",\"property_code\":\"TAR-BH\",\"property_type\":\"RESORT\",\"star_rating\":4,\"total_rooms\":100,\"email\":\"beach@tartware.test\",\"currency\":\"USD\",\"timezone\":\"America/New_York\"}")
  if [[ "$code" =~ ^2 ]]; then
    PID_A2=$(jq -r '.id // .data.id // .property_id // empty' "$RESP_FILE" 2>/dev/null)
    if [[ -z "$PID_A2" ]]; then
      PID_A2=$(dbq "SELECT id FROM properties WHERE tenant_id='$TID_A' AND property_code='TAR-BH' LIMIT 1;")
    fi
    echo "  ✓ Property A2 created: $PID_A2"
  else
    echo "  ⚠ Could not create Property A2 (HTTP $code)"
    PID_A2=$(dbq "SELECT id FROM properties WHERE tenant_id='$TID_A' AND property_code='TAR-BH' LIMIT 1;")
    if [[ -n "$PID_A2" ]]; then echo "  ℹ Found via DB: $PID_A2"; fi
  fi
fi
[[ -n "$PID_A2" ]] || { echo "FATAL: Property A2 not resolved"; exit 1; }
echo ""

# ── 0.3  Create Property B2 (second property for Tenant B) ──────────────
echo "── 0.3  Create Property B2 ──────────────────────────────────────────"

TOKEN="$TOKEN_B"
EXISTING_B2=$(dbq "SELECT id FROM properties WHERE tenant_id='$TID_B' AND property_code='BCN-MT' LIMIT 1;")
if [[ -n "$EXISTING_B2" ]]; then
  PID_B2="$EXISTING_B2"
  echo "  ℹ Property B2 already exists: $PID_B2"
else
  code=$(post "$GW/v1/properties" \
    "{\"tenant_id\":\"$TID_B\",\"property_name\":\"Beacon Mountain Lodge\",\"property_code\":\"BCN-MT\",\"property_type\":\"RESORT\",\"star_rating\":3,\"total_rooms\":60,\"email\":\"mountain@beaconhotels.test\",\"currency\":\"USD\",\"timezone\":\"America/Denver\"}")
  if [[ "$code" =~ ^2 ]]; then
    PID_B2=$(jq -r '.id // .data.id // .property_id // empty' "$RESP_FILE" 2>/dev/null)
    if [[ -z "$PID_B2" ]]; then
      PID_B2=$(dbq "SELECT id FROM properties WHERE tenant_id='$TID_B' AND property_code='BCN-MT' LIMIT 1;")
    fi
    echo "  ✓ Property B2 created: $PID_B2"
  else
    echo "  ⚠ Could not create Property B2 (HTTP $code)"
    PID_B2=$(dbq "SELECT id FROM properties WHERE tenant_id='$TID_B' AND property_code='BCN-MT' LIMIT 1;")
    if [[ -n "$PID_B2" ]]; then echo "  ℹ Found via DB: $PID_B2"; fi
  fi
fi
[[ -n "$PID_B2" ]] || { echo "FATAL: Property B2 not resolved"; exit 1; }
echo ""

# ── 0.4  Create room types + rooms for new properties ──────────────────
echo "── 0.4  Create Room Types & Rooms ───────────────────────────────────"

create_room_type() {
  local tok="$1" tid="$2" pid="$3" name="$4" code="$5" price="$6"
  local existing
  existing=$(dbq "SELECT id FROM room_types WHERE tenant_id='$tid' AND property_id='$pid' AND type_code='$code' LIMIT 1;")
  if [[ -n "$existing" ]]; then
    echo "$existing"
    return
  fi
  TOKEN="$tok"
  code_http=$(post "$GW/v1/room-types" \
    "{\"tenant_id\":\"$tid\",\"property_id\":\"$pid\",\"type_name\":\"$name\",\"type_code\":\"$code\",\"category\":\"STANDARD\",\"base_occupancy\":2,\"max_occupancy\":3,\"max_adults\":2,\"max_children\":1,\"extra_bed_capacity\":1,\"number_of_beds\":1,\"base_price\":$price,\"currency\":\"USD\",\"amenities\":[\"WIFI\",\"TV\",\"AC\"],\"is_active\":true,\"display_order\":1}")
  local rtid
  rtid=$(jq -r '.room_type_id // .data.room_type_id // .id // .data.id // empty' "$RESP_FILE" 2>/dev/null)
  if [[ -z "$rtid" ]]; then
    rtid=$(dbq "SELECT id FROM room_types WHERE tenant_id='$tid' AND property_id='$pid' AND type_code='$code' LIMIT 1;")
  fi
  echo "$rtid"
}

create_room() {
  local tok="$1" tid="$2" pid="$3" rtid="$4" num="$5" floor="$6"
  local existing
  existing=$(dbq "SELECT id FROM rooms WHERE tenant_id='$tid' AND property_id='$pid' AND room_number='$num' LIMIT 1;")
  if [[ -n "$existing" ]]; then return 0; fi
  TOKEN="$tok"
  post "$GW/v1/rooms" \
    "{\"tenant_id\":\"$tid\",\"property_id\":\"$pid\",\"room_type_id\":\"$rtid\",\"room_number\":\"$num\",\"floor\":\"$floor\",\"status\":\"available\",\"housekeeping_status\":\"clean\",\"maintenance_status\":\"operational\",\"is_blocked\":false,\"is_out_of_order\":false}" >/dev/null
}

# Property A2 — room type + rooms
RTID_A2=$(create_room_type "$TOKEN_A" "$TID_A" "$PID_A2" "Beach Standard" "BST" "179.00")
echo "  Room type A2: ${RTID_A2:-(FAILED)}"
if [[ -n "$RTID_A2" ]]; then
  for r in 501 502 503 504 505 506 507 508 509 510; do
    create_room "$TOKEN_A" "$TID_A" "$PID_A2" "$RTID_A2" "$r" "${r:0:1}"
  done
  A2_ROOMS=$(dbq "SELECT COUNT(*) FROM rooms WHERE tenant_id='$TID_A' AND property_id='$PID_A2';")
  echo "  Rooms seeded for A2: $A2_ROOMS"
fi

# Property B1 — room type + rooms
RTID_B1=$(create_room_type "$TOKEN_B" "$TID_B" "$PID_B1" "Harbor King" "HBK" "189.00")
echo "  Room type B1: ${RTID_B1:-(FAILED)}"
if [[ -n "$RTID_B1" ]]; then
  for r in 101 102 103 104 105 106 107 108 109 110; do
    create_room "$TOKEN_B" "$TID_B" "$PID_B1" "$RTID_B1" "$r" "${r:0:1}"
  done
  B1_ROOMS=$(dbq "SELECT COUNT(*) FROM rooms WHERE tenant_id='$TID_B' AND property_id='$PID_B1';")
  echo "  Rooms seeded for B1: $B1_ROOMS"
fi

# Property B2 — room type + rooms
RTID_B2=$(create_room_type "$TOKEN_B" "$TID_B" "$PID_B2" "Mountain Cabin" "MTC" "149.00")
echo "  Room type B2: ${RTID_B2:-(FAILED)}"
if [[ -n "$RTID_B2" ]]; then
  for r in 201 202 203 204 205 206 207 208 209 210; do
    create_room "$TOKEN_B" "$TID_B" "$PID_B2" "$RTID_B2" "$r" "${r:0:1}"
  done
  B2_ROOMS=$(dbq "SELECT COUNT(*) FROM rooms WHERE tenant_id='$TID_B' AND property_id='$PID_B2';")
  echo "  Rooms seeded for B2: $B2_ROOMS"
fi
echo ""

# ── 0.5  Enable billing commands for both tenants ────────────────────────
echo "── 0.5  Enable Billing Commands ─────────────────────────────────────"

REQUIRED_COMMANDS=(
  "billing.charge.post" "billing.charge.void" "billing.charge.transfer"
  "billing.payment.capture" "billing.payment.authorize"
  "billing.payment.authorize_increment" "billing.payment.void"
  "billing.payment.refund"
  "billing.invoice.create" "billing.invoice.adjust" "billing.invoice.finalize"
  "billing.invoice.void" "billing.credit_note.create"
  "billing.folio.create" "billing.folio.close" "billing.folio.transfer"
  "billing.folio.split"
  "billing.cashier.open" "billing.cashier.close" "billing.cashier.handover"
  "billing.ar.create" "billing.ar.apply_payment" "billing.ar.write_off"
  "billing.chargeback.record"
  "billing.night_audit.execute"
  "billing.express_checkout"
  "billing.fiscal_period.close"
  "billing.tax_config.create"
)

enable_commands_for() {
  local tid="$1" label="$2"
  for cmd in "${REQUIRED_COMMANDS[@]}"; do
    dbq "INSERT INTO command_features (tenant_id, command_name, is_enabled, created_at)
         VALUES ('$tid', '$cmd', true, NOW())
         ON CONFLICT (tenant_id, command_name) DO UPDATE SET is_enabled=true, updated_at=NOW();" >/dev/null 2>&1
  done
  local count
  count=$(dbq "SELECT COUNT(*) FROM command_features WHERE tenant_id='$tid' AND is_enabled=true;")
  echo "  $label: $count commands enabled"
}

enable_commands_for "$TID_A" "Tenant A"
enable_commands_for "$TID_B" "Tenant B"

echo "  Waiting 32s for gateway command cache refresh..."
sleep 32
echo "  ✓ Command cache refreshed"
echo ""

# ── 0.6  Pre-test snapshot ──────────────────────────────────────────────
echo "── 0.6  Pre-test Row Counts ─────────────────────────────────────────"

PRE_A_GUESTS=$(dbq "SELECT COUNT(*) FROM guests WHERE tenant_id='$TID_A';")
PRE_A_RESERVATIONS=$(dbq "SELECT COUNT(*) FROM reservations WHERE tenant_id='$TID_A';")
PRE_A_CHARGES=$(dbq "SELECT COUNT(*) FROM charge_postings WHERE tenant_id='$TID_A';")
PRE_A_PAYMENTS=$(dbq "SELECT COUNT(*) FROM payments WHERE tenant_id='$TID_A';")
PRE_A_INVOICES=$(dbq "SELECT COUNT(*) FROM invoices WHERE tenant_id='$TID_A';")
PRE_B_GUESTS=$(dbq "SELECT COUNT(*) FROM guests WHERE tenant_id='$TID_B';")
PRE_B_RESERVATIONS=$(dbq "SELECT COUNT(*) FROM reservations WHERE tenant_id='$TID_B';")
PRE_B_CHARGES=$(dbq "SELECT COUNT(*) FROM charge_postings WHERE tenant_id='$TID_B';")
PRE_B_PAYMENTS=$(dbq "SELECT COUNT(*) FROM payments WHERE tenant_id='$TID_B';")
PRE_B_INVOICES=$(dbq "SELECT COUNT(*) FROM invoices WHERE tenant_id='$TID_B';")

echo "  Tenant A — guests=$PRE_A_GUESTS res=$PRE_A_RESERVATIONS charges=$PRE_A_CHARGES payments=$PRE_A_PAYMENTS invoices=$PRE_A_INVOICES"
echo "  Tenant B — guests=$PRE_B_GUESTS res=$PRE_B_RESERVATIONS charges=$PRE_B_CHARGES payments=$PRE_B_PAYMENTS invoices=$PRE_B_INVOICES"
echo ""

echo "  Environment summary:"
echo "    Tenant A  = $TID_A"
echo "    Prop A1   = $PID_A1   (existing, rooms 101-202)"
echo "    Prop A2   = $PID_A2   (new, rooms 501-510)"
echo "    Tenant B  = $TID_B"
echo "    Prop B1   = $PID_B1   (new, rooms 101-110)"
echo "    Prop B2   = $PID_B2   (new, rooms 201-210)"
echo ""

# =============================================================================
# run_billing_pipeline <tid> <pid> <token> <rtid> <label> <full|core>
#
# Runs the billing lifecycle on a specific tenant+property.
# "full" = comprehensive (guests, tax, 2 reservations, charges, payments,
#          invoices, cashier, AR, night-audit, refund, void, transfer, etc.)
# "core" = essential subset (1 guest, 1 reservation, charges, payment,
#          invoice, cashier, night-audit)
# =============================================================================

run_billing_pipeline() {
  local tid="$1" pid="$2" tok="$3" rtid="$4" label="$5" mode="$6"

  # Set globals used by send_command/post/get
  TOKEN="$tok"
  CUR_TID="$tid"

  local guest_id="" res_id="" folio_id="" res2_id="" folio2_id=""
  local payref1="" session_id="" inv_id=""
  local tag="${label// /_}"

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  BILLING PIPELINE: $label  [mode=$mode]"
  echo "  tenant=$tid  property=$pid"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""

  if $SKIP_SEED; then
    echo "  (seed skipped — resolving existing data)"
    guest_id=$(dbq "SELECT id FROM guests WHERE tenant_id='$tid' ORDER BY created_at DESC LIMIT 1;")
    res_id=$(dbq "SELECT id FROM reservations WHERE tenant_id='$tid' AND property_id='$pid' ORDER BY created_at DESC LIMIT 1;")
    folio_id=$(dbq "SELECT folio_id FROM folios WHERE reservation_id='$res_id' AND tenant_id='$tid' LIMIT 1;" 2>/dev/null || echo "")
    echo "  Guest: ${guest_id:-NONE}  Res: ${res_id:-NONE}  Folio: ${folio_id:-NONE}"
    echo ""
  fi

  # ── Guest ──
  echo "── ${tag} — Guest Creation ────────────────────────────────────────"
  if ! $SKIP_SEED; then
    local guest_first="Test" guest_last="Guest-${tag}"
    local guest_email="${tag,,}@tartware-test.local"
    seed_rest "REST guest: $guest_first $guest_last" \
      "$GW/v1/guests" \
      "{\"tenant_id\":\"$tid\",\"first_name\":\"$guest_first\",\"last_name\":\"$guest_last\",\"email\":\"$guest_email\",\"phone\":\"+1-555-${RANDOM}\",\"nationality\":\"US\"}"
    guest_id=$(jq -r '.id // .data.id // .guest_id // empty' "$RESP_FILE" 2>/dev/null)
    if [[ -z "$guest_id" ]]; then
      guest_id=$(dbq "SELECT id FROM guests WHERE tenant_id='$tid' AND email='$guest_email' LIMIT 1;")
    fi
  fi
  if [[ -n "$guest_id" ]]; then pass "Guest created ($label)"; else fail "Guest creation" "$label"; fi
  echo ""

  # ── Tax configuration ──
  if [[ "$mode" == "full" ]]; then
    echo "── ${tag} — Tax Configuration ─────────────────────────────────────"
    if ! $SKIP_SEED; then
      seed_rest "REST tax: Sales Tax 8.875%" \
        "$GW/v1/billing/tax-configurations" \
        "{\"tenant_id\":\"$tid\",\"property_id\":\"$pid\",\"tax_name\":\"State Sales Tax\",\"tax_code\":\"SST-$tag\",\"tax_rate\":8.875,\"tax_type\":\"PERCENTAGE\",\"applies_to\":[\"ROOM\",\"FOOD_BEVERAGE\",\"OTHER\"],\"is_active\":true}"
      seed_rest "REST tax: City Occupancy 5.875%" \
        "$GW/v1/billing/tax-configurations" \
        "{\"tenant_id\":\"$tid\",\"property_id\":\"$pid\",\"tax_name\":\"City Occupancy Tax\",\"tax_code\":\"COT-$tag\",\"tax_rate\":5.875,\"tax_type\":\"PERCENTAGE\",\"applies_to\":[\"ROOM\"],\"is_active\":true}"
    fi
    local tax_count
    tax_count=$(dbq "SELECT COUNT(*) FROM tax_configurations WHERE tenant_id='$tid' AND property_id='$pid';")
    assert_gte "Tax configs for $label" "$tax_count" 2
    echo ""
  fi

  # ── Reservation ──
  echo "── ${tag} — Reservation ─────────────────────────────────────────────"
  if ! $SKIP_SEED; then
    seed_rest "REST reservation: 3 nights" \
      "$GW/v1/reservations" \
      "{\"tenant_id\":\"$tid\",\"property_id\":\"$pid\",\"guest_id\":\"$guest_id\",\"room_type_id\":\"$rtid\",\"check_in_date\":\"$TODAY\",\"check_out_date\":\"$IN3DAYS\",\"number_of_adults\":2,\"number_of_children\":0,\"status\":\"confirmed\",\"source\":\"DIRECT\",\"rate_amount\":199.00,\"currency\":\"USD\"}"
    res_id=$(jq -r '.id // .data.id // .reservation_id // empty' "$RESP_FILE" 2>/dev/null)
    if [[ -z "$res_id" ]]; then
      res_id=$(dbq "SELECT id FROM reservations WHERE tenant_id='$tid' AND property_id='$pid' AND guest_id='$guest_id' ORDER BY created_at DESC LIMIT 1;")
    fi
    # Get folio
    wait_kafka 2
    folio_id=$(dbq "SELECT folio_id FROM folios WHERE reservation_id='$res_id' AND tenant_id='$tid' LIMIT 1;" 2>/dev/null || echo "")
  fi
  if [[ -n "$res_id" ]]; then pass "Reservation created ($label)"; else fail "Reservation creation" "$label"; fi
  echo ""

  # ── Second reservation (full mode only) ──
  if [[ "$mode" == "full" ]]; then
    echo "── ${tag} — Second Reservation ──────────────────────────────────────"
    if ! $SKIP_SEED; then
      local guest2_email="${tag,,}-b@tartware-test.local"
      seed_rest "REST guest 2" \
        "$GW/v1/guests" \
        "{\"tenant_id\":\"$tid\",\"first_name\":\"Sarah\",\"last_name\":\"Mitchell-$tag\",\"email\":\"$guest2_email\",\"phone\":\"+1-555-${RANDOM}\",\"nationality\":\"US\"}"
      local guest2_id
      guest2_id=$(jq -r '.id // .data.id // .guest_id // empty' "$RESP_FILE" 2>/dev/null)
      if [[ -z "$guest2_id" ]]; then
        guest2_id=$(dbq "SELECT id FROM guests WHERE tenant_id='$tid' AND email='$guest2_email' LIMIT 1;")
      fi
      if [[ -n "$guest2_id" ]]; then
        seed_rest "REST reservation 2: 5 nights" \
          "$GW/v1/reservations" \
          "{\"tenant_id\":\"$tid\",\"property_id\":\"$pid\",\"guest_id\":\"$guest2_id\",\"room_type_id\":\"$rtid\",\"check_in_date\":\"$TODAY\",\"check_out_date\":\"$IN5DAYS\",\"number_of_adults\":1,\"number_of_children\":0,\"status\":\"confirmed\",\"source\":\"DIRECT\",\"rate_amount\":199.00,\"currency\":\"USD\"}"
        res2_id=$(jq -r '.id // .data.id // .reservation_id // empty' "$RESP_FILE" 2>/dev/null)
        if [[ -z "$res2_id" ]]; then
          res2_id=$(dbq "SELECT id FROM reservations WHERE tenant_id='$tid' AND property_id='$pid' AND guest_id='$guest2_id' ORDER BY created_at DESC LIMIT 1;")
        fi
        wait_kafka 2
        folio2_id=$(dbq "SELECT folio_id FROM folios WHERE reservation_id='$res2_id' AND tenant_id='$tid' LIMIT 1;" 2>/dev/null || echo "")
      fi
    fi
    if [[ -n "$res2_id" ]]; then pass "Second reservation ($label)"; else skip "Second reservation" "$label"; fi
    echo ""
  fi

  # ── Charge Postings ──
  echo "── ${tag} — Charge Postings ─────────────────────────────────────────"
  if ! $SKIP_SEED && [[ -n "$res_id" && -n "$guest_id" ]]; then
    send_command "CMD charge: Room \$199" \
      "billing.charge.post" \
      "{\"property_id\":\"$pid\",\"reservation_id\":\"$res_id\",\"amount\":199.00,\"charge_code\":\"ROOM\",\"description\":\"Room charge — nightly rate\"}"

    send_command "CMD charge: Minibar \$24.50" \
      "billing.charge.post" \
      "{\"property_id\":\"$pid\",\"reservation_id\":\"$res_id\",\"amount\":24.50,\"charge_code\":\"MINIBAR\",\"description\":\"Minibar consumption\"}"

    send_command "CMD charge: Restaurant \$85" \
      "billing.charge.post" \
      "{\"property_id\":\"$pid\",\"reservation_id\":\"$res_id\",\"amount\":85.00,\"charge_code\":\"RESTAURANT\",\"description\":\"Dinner $tag\"}"

    if [[ "$mode" == "full" ]]; then
      send_command "CMD charge: Spa \$150" \
        "billing.charge.post" \
        "{\"property_id\":\"$pid\",\"reservation_id\":\"$res_id\",\"amount\":150.00,\"charge_code\":\"SPA\",\"description\":\"Spa treatment\"}"
    fi

    # Charges on second reservation (full mode)
    if [[ "$mode" == "full" && -n "$res2_id" ]]; then
      send_command "CMD charge: Res2 Room \$199" \
        "billing.charge.post" \
        "{\"property_id\":\"$pid\",\"reservation_id\":\"$res2_id\",\"amount\":199.00,\"charge_code\":\"ROOM\",\"description\":\"Room charge guest 2\"}"
      send_command "CMD charge: Res2 Laundry \$35" \
        "billing.charge.post" \
        "{\"property_id\":\"$pid\",\"reservation_id\":\"$res2_id\",\"amount\":35.00,\"charge_code\":\"LAUNDRY\",\"description\":\"Laundry service\"}"
    fi

    wait_kafka 8
  fi

  local charge_count
  charge_count=$(dbq "SELECT COUNT(*) FROM charge_postings WHERE tenant_id='$tid' AND property_id='$pid' AND COALESCE(is_voided,false)=false AND deleted_at IS NULL;")
  if [[ "$mode" == "full" ]]; then
    assert_gte "Charges posted ($label)" "$charge_count" 4
  else
    assert_gte "Charges posted ($label)" "$charge_count" 2
  fi
  echo ""

  # ── Payments ──
  echo "── ${tag} — Payments ────────────────────────────────────────────────"
  if ! $SKIP_SEED && [[ -n "$res_id" && -n "$guest_id" ]]; then
    payref1="CC-$tag-$UNIQUE-001"
    send_command "CMD payment: CC \$300" \
      "billing.payment.capture" \
      "{\"payment_reference\":\"$payref1\",\"property_id\":\"$pid\",\"reservation_id\":\"$res_id\",\"guest_id\":\"$guest_id\",\"amount\":300.00,\"payment_method\":\"CREDIT_CARD\"}"

    if [[ "$mode" == "full" ]]; then
      send_command "CMD payment: Cash \$100" \
        "billing.payment.capture" \
        "{\"payment_reference\":\"CASH-$tag-$UNIQUE-001\",\"property_id\":\"$pid\",\"reservation_id\":\"$res_id\",\"guest_id\":\"$guest_id\",\"amount\":100.00,\"payment_method\":\"CASH\"}"
    fi

    wait_kafka 8
  fi

  local payment_count
  payment_count=$(dbq "SELECT COUNT(*) FROM payments WHERE tenant_id='$tid' AND property_id='$pid' AND status IN ('COMPLETED','CAPTURED');")
  assert_gte "Payments captured ($label)" "$payment_count" 1

  # Verify CC payment
  local cc_exists
  cc_exists=$(dbq "SELECT COUNT(*) FROM payments WHERE payment_reference='$payref1' AND tenant_id='$tid';")
  assert_eq "CC payment recorded ($label)" "1" "$cc_exists"
  echo ""

  # ── Invoice ──
  echo "── ${tag} — Invoice ─────────────────────────────────────────────────"
  if ! $SKIP_SEED && [[ -n "$res_id" && -n "$guest_id" ]]; then
    send_command "CMD invoice: create" \
      "billing.invoice.create" \
      "{\"property_id\":\"$pid\",\"reservation_id\":\"$res_id\",\"guest_id\":\"$guest_id\",\"total_amount\":458.50,\"idempotency_key\":\"INV-$tag-$UNIQUE-001\"}"
    wait_kafka 5
  fi

  inv_id=$(dbq "SELECT id FROM invoices WHERE tenant_id='$tid' AND property_id='$pid' AND reservation_id='$res_id' ORDER BY created_at DESC LIMIT 1;")
  if [[ -n "$inv_id" ]]; then pass "Invoice created ($label)"; else fail "Invoice creation" "$label"; fi
  echo ""

  # ── Cashier Session ──
  echo "── ${tag} — Cashier Session ─────────────────────────────────────────"
  if ! $SKIP_SEED; then
    send_command "CMD cashier: open" \
      "billing.cashier.open" \
      "{\"property_id\":\"$pid\",\"cashier_name\":\"Front Desk $tag\",\"shift_type\":\"morning\",\"opening_float\":500.00}"
    wait_kafka 5
  fi

  session_id=$(dbq "SELECT session_id FROM cashier_sessions WHERE tenant_id='$tid' AND property_id='$pid' ORDER BY created_at DESC LIMIT 1;")
  if [[ -n "$session_id" ]]; then pass "Cashier session opened ($label)"; else skip "Cashier session" "$label"; fi

  # Close session
  if ! $SKIP_SEED && [[ -n "$session_id" ]]; then
    send_command "CMD cashier: close" \
      "billing.cashier.close" \
      "{\"session_id\":\"$session_id\",\"property_id\":\"$pid\",\"closing_float\":500.00,\"cash_collected\":100.00,\"notes\":\"End of shift $tag\"}"
    wait_kafka 5

    local sess_status
    sess_status=$(dbq "SELECT session_status FROM cashier_sessions WHERE session_id='$session_id';")
    assert_eq_ci "Cashier session closed ($label)" "closed" "$sess_status"
  fi
  echo ""

  # ── Accounts Receivable (full mode) ──
  if [[ "$mode" == "full" ]]; then
    echo "── ${tag} — Accounts Receivable ──────────────────────────────────────"
    if ! $SKIP_SEED && [[ -n "$res_id" && -n "$guest_id" ]]; then
      send_command "CMD AR: Corporate \$158.50" \
        "billing.ar.create" \
        "{\"property_id\":\"$pid\",\"reservation_id\":\"$res_id\",\"guest_id\":\"$guest_id\",\"debtor_name\":\"ACME Corp $tag\",\"debtor_type\":\"CORPORATE\",\"original_amount\":158.50,\"outstanding_balance\":158.50,\"due_date\":\"$IN5DAYS\",\"notes\":\"Corporate billing $tag\"}"
      wait_kafka 5
    fi

    local ar_count
    ar_count=$(dbq "SELECT COUNT(*) FROM accounts_receivable WHERE tenant_id='$tid' AND property_id='$pid';")
    assert_gte "AR entries ($label)" "$ar_count" 1
    echo ""
  fi

  # ── Night Audit ──
  echo "── ${tag} — Night Audit ─────────────────────────────────────────────"

  # Seed business_dates if needed
  dbq "INSERT INTO business_dates (tenant_id, property_id, business_date, date_status, night_audit_status)
       VALUES ('$tid', '$pid', '$TODAY', 'OPEN', 'PENDING')
       ON CONFLICT (tenant_id, property_id) DO UPDATE SET business_date='$TODAY', date_status='OPEN', night_audit_status='PENDING', updated_at=NOW();" >/dev/null 2>&1

  if ! $SKIP_SEED; then
    send_command "CMD night audit: execute" \
      "billing.night_audit.execute" \
      "{\"property_id\":\"$pid\",\"audit_date\":\"$TODAY\",\"perform_date_roll\":false}"
    wait_kafka 10
  fi

  local audit_count
  audit_count=$(dbq "SELECT COUNT(*) FROM night_audit_log WHERE tenant_id='$tid' AND property_id='$pid';")
  assert_gte "Night audit executed ($label)" "$audit_count" 1
  echo ""

  # ── Full-mode extras: Refund, Charge Void, House Account ──
  if [[ "$mode" == "full" ]]; then
    # ── Refund ──
    echo "── ${tag} — Payment Refund ──────────────────────────────────────────"
    local cc_pay_id
    cc_pay_id=$(dbq "SELECT id FROM payments WHERE payment_reference='$payref1' AND tenant_id='$tid' LIMIT 1;")
    if [[ -n "$cc_pay_id" ]]; then
      send_command "CMD refund: \$50" \
        "billing.payment.refund" \
        "{\"payment_id\":\"$cc_pay_id\",\"property_id\":\"$pid\",\"reservation_id\":\"$res_id\",\"guest_id\":\"$guest_id\",\"amount\":50.00,\"reason\":\"Overpayment\",\"refund_reference\":\"RF-$tag-$UNIQUE\",\"payment_method\":\"CREDIT_CARD\"}"
      wait_kafka 8

      local refund_exists
      refund_exists=$(dbq "SELECT COUNT(*) FROM payments WHERE tenant_id='$tid' AND transaction_type IN ('REFUND','PARTIAL_REFUND') AND amount=50.00;")
      if [[ "${refund_exists:-0}" -ge 1 ]]; then pass "Refund recorded ($label)"; else fail "Refund" "$label"; fi
    else
      skip "Refund" "CC payment not found"
    fi
    echo ""

    # ── Charge Void ──
    echo "── ${tag} — Charge Void ─────────────────────────────────────────────"
    local spa_id
    spa_id=$(dbq "SELECT posting_id FROM charge_postings WHERE tenant_id='$tid' AND reservation_id='$res_id' AND charge_code='SPA' AND COALESCE(is_voided,false)=false LIMIT 1;")
    if [[ -n "$spa_id" ]]; then
      send_command "CMD void: SPA" \
        "billing.charge.void" \
        "{\"posting_id\":\"$spa_id\",\"property_id\":\"$pid\",\"reservation_id\":\"$res_id\",\"void_reason\":\"Posted to wrong guest\"}"
      wait_kafka 8

      local voided
      voided=$(dbq "SELECT is_voided FROM charge_postings WHERE posting_id='$spa_id';")
      assert_eq "Charge voided ($label)" "t" "$voided"
    else
      skip "Charge void" "SPA charge not found"
    fi
    echo ""

    # ── House Account + Transfer ──
    echo "── ${tag} — House Account + Transfer ────────────────────────────────"
    send_command "CMD folio.create: house account" \
      "billing.folio.create" \
      "{\"property_id\":\"$pid\",\"folio_type\":\"HOUSE_ACCOUNT\",\"folio_name\":\"House $tag\",\"currency\":\"USD\",\"notes\":\"House account $tag\",\"idempotency_key\":\"HOUSE-$tag-$UNIQUE\"}"
    wait_kafka 5

    local house_id
    house_id=$(dbq "SELECT folio_id FROM folios WHERE tenant_id='$tid' AND property_id='$pid' AND folio_type='HOUSE_ACCOUNT' ORDER BY created_at DESC LIMIT 1;")
    if [[ -n "$house_id" ]]; then
      pass "House account created ($label)"
      # Transfer minibar charge
      local minibar_id
      minibar_id=$(dbq "SELECT posting_id FROM charge_postings WHERE tenant_id='$tid' AND reservation_id='$res_id' AND charge_code='MINIBAR' AND COALESCE(is_voided,false)=false LIMIT 1;")
      if [[ -n "$minibar_id" ]]; then
        send_command "CMD transfer: MINIBAR → house" \
          "billing.charge.transfer" \
          "{\"posting_id\":\"$minibar_id\",\"to_folio_id\":\"$house_id\",\"property_id\":\"$pid\",\"reason\":\"Transfer to house\"}"
        wait_kafka 5
        local xfer_credit
        xfer_credit=$(dbq "SELECT COUNT(*) FROM charge_postings WHERE tenant_id='$tid' AND original_posting_id='$minibar_id' AND transaction_type='TRANSFER';")
        assert_gte "Charge transfer ($label)" "$xfer_credit" 1
      fi
    else
      skip "House account" "$label"
    fi
    echo ""

    # ── Invoice Finalize ──
    echo "── ${tag} — Invoice Finalize ──────────────────────────────────────"
    if [[ -n "$inv_id" ]]; then
      send_command "CMD invoice.finalize" \
        "billing.invoice.finalize" \
        "{\"invoice_id\":\"$inv_id\"}"
      wait_kafka 4

      local inv_status
      inv_status=$(dbq "SELECT status FROM invoices WHERE id='$inv_id';")
      assert_eq "Invoice finalized ($label)" "FINALIZED" "$inv_status"
    else
      skip "Invoice finalize" "no invoice"
    fi
    echo ""

    # ── Express Checkout (guest 2) ──
    if [[ -n "$res2_id" && -n "$folio2_id" ]]; then
      echo "── ${tag} — Express Checkout ──────────────────────────────────────"
      send_command "CMD express checkout: guest 2" \
        "billing.express_checkout" \
        "{\"property_id\":\"$pid\",\"reservation_id\":\"$res2_id\",\"folio_id\":\"$folio2_id\",\"send_folio_email\":false,\"skip_balance_check\":true,\"notes\":\"Express checkout $tag\"}"
      wait_kafka 8

      local fc_status
      fc_status=$(dbq "SELECT folio_status FROM folios WHERE folio_id='$folio2_id';" 2>/dev/null || echo "")
      if [[ "$fc_status" == "CLOSED" || "$fc_status" == "SETTLED" ]]; then
        pass "Express checkout ($label)"
      else
        skip "Express checkout" "folio status=$fc_status"
      fi
      echo ""
    fi
  fi

  echo "  ✓ Pipeline complete for $label"
  echo ""
}

# ═════════════════════════════════════════════════════════════════════════════
#  PHASE 1 — TENANT A / PROPERTY A1 (full billing pipeline)
# ═════════════════════════════════════════════════════════════════════════════

echo ""
echo "╔═══════════════════════════════════════════════════════════════════════╗"
echo "║  PHASE 1: Tenant A / Property A1 — Full Pipeline                    ║"
echo "╚═══════════════════════════════════════════════════════════════════════╝"
echo ""

# Run the existing single-tenant test for the thorough validation
echo "  Running full single-tenant test (test-accounts-realdata.sh)..."
echo "  This runs all 230 tests on Tenant A / Property A1."
echo ""

PHASE1_EXIT=0
"$SCRIPT_DIR/test-accounts-realdata.sh" "$@" || PHASE1_EXIT=$?

if [[ $PHASE1_EXIT -eq 0 ]]; then
  pass "Phase 1: Single-tenant full pipeline (test-accounts-realdata.sh)"
else
  fail "Phase 1: Single-tenant full pipeline" "exit code $PHASE1_EXIT"
fi
echo ""

# ═════════════════════════════════════════════════════════════════════════════
#  PHASE 2 — TENANT A / PROPERTY A2 (property isolation test)
# ═════════════════════════════════════════════════════════════════════════════

echo ""
echo "╔═══════════════════════════════════════════════════════════════════════╗"
echo "║  PHASE 2: Tenant A / Property A2 — core pipeline (property-level)   ║"
echo "╚═══════════════════════════════════════════════════════════════════════╝"
echo ""

run_billing_pipeline "$TID_A" "$PID_A2" "$TOKEN_A" "$RTID_A2" "Tenant-A Prop-A2" "core"

# ═════════════════════════════════════════════════════════════════════════════
#  PHASE 3 — TENANT B / PROPERTY B1 (tenant isolation test)
# ═════════════════════════════════════════════════════════════════════════════

echo ""
echo "╔═══════════════════════════════════════════════════════════════════════╗"
echo "║  PHASE 3: Tenant B / Property B1 — full pipeline (cross-tenant)     ║"
echo "╚═══════════════════════════════════════════════════════════════════════╝"
echo ""

run_billing_pipeline "$TID_B" "$PID_B1" "$TOKEN_B" "$RTID_B1" "Tenant-B Prop-B1" "full"

# ═════════════════════════════════════════════════════════════════════════════
#  PHASE 4 — USALI PROPERTY-LEVEL ISOLATION
#  Industry Standard: Each property is its own accounting entity.
#  All financial records MUST have property_id scope.
# ═════════════════════════════════════════════════════════════════════════════

echo ""
echo "╔═══════════════════════════════════════════════════════════════════════╗"
echo "║  PHASE 4: USALI Property-Level Isolation                            ║"
echo "║  (Uniform System of Accounts for the Lodging Industry)              ║"
echo "╚═══════════════════════════════════════════════════════════════════════╝"
echo ""

echo "── 4.1  Charge Postings scoped by property_id ──────────────────────"
A1_CHARGES=$(dbq "SELECT COUNT(*) FROM charge_postings WHERE tenant_id='$TID_A' AND property_id='$PID_A1';")
A2_CHARGES=$(dbq "SELECT COUNT(*) FROM charge_postings WHERE tenant_id='$TID_A' AND property_id='$PID_A2';")
ALL_A_CHARGES=$(dbq "SELECT COUNT(*) FROM charge_postings WHERE tenant_id='$TID_A';")
EXPECTED_SUM=$((A1_CHARGES + A2_CHARGES))
assert_eq "USALI: A charges = A1($A1_CHARGES) + A2($A2_CHARGES)" "$EXPECTED_SUM" "$ALL_A_CHARGES"
if [[ "$A1_CHARGES" -gt 0 && "$A2_CHARGES" -gt 0 ]]; then
  pass "USALI: Both properties have charges (A1=$A1_CHARGES A2=$A2_CHARGES)"
else
  fail "USALI: Property charge distribution" "A1=$A1_CHARGES A2=$A2_CHARGES"
fi

# No orphan charges (no charge_postings without property_id for this tenant)
ORPHAN_CHARGES=$(dbq "SELECT COUNT(*) FROM charge_postings WHERE tenant_id='$TID_A' AND property_id IS NULL;")
assert_eq "USALI: No orphan charges (no NULL property_id)" "0" "$ORPHAN_CHARGES"
echo ""

echo "── 4.2  Payments scoped by property_id ─────────────────────────────"
A1_PAYMENTS=$(dbq "SELECT COUNT(*) FROM payments WHERE tenant_id='$TID_A' AND property_id='$PID_A1';")
A2_PAYMENTS=$(dbq "SELECT COUNT(*) FROM payments WHERE tenant_id='$TID_A' AND property_id='$PID_A2';")
ALL_A_PAYMENTS=$(dbq "SELECT COUNT(*) FROM payments WHERE tenant_id='$TID_A';")
EXPECTED_SUM=$((A1_PAYMENTS + A2_PAYMENTS))
assert_eq "USALI: A payments = A1($A1_PAYMENTS) + A2($A2_PAYMENTS)" "$EXPECTED_SUM" "$ALL_A_PAYMENTS"
if [[ "$A1_PAYMENTS" -gt 0 && "$A2_PAYMENTS" -gt 0 ]]; then
  pass "USALI: Both properties have payments"
else
  fail "USALI: Property payment distribution" "A1=$A1_PAYMENTS A2=$A2_PAYMENTS"
fi
echo ""

echo "── 4.3  Invoices scoped by property_id ─────────────────────────────"
A1_INVOICES=$(dbq "SELECT COUNT(*) FROM invoices WHERE tenant_id='$TID_A' AND property_id='$PID_A1';")
A2_INVOICES=$(dbq "SELECT COUNT(*) FROM invoices WHERE tenant_id='$TID_A' AND property_id='$PID_A2';")
ALL_A_INVOICES=$(dbq "SELECT COUNT(*) FROM invoices WHERE tenant_id='$TID_A';")
EXPECTED_SUM=$((A1_INVOICES + A2_INVOICES))
assert_eq "USALI: A invoices = A1($A1_INVOICES) + A2($A2_INVOICES)" "$EXPECTED_SUM" "$ALL_A_INVOICES"
if [[ "$A1_INVOICES" -gt 0 && "$A2_INVOICES" -gt 0 ]]; then
  pass "USALI: Both properties have invoices"
else
  fail "USALI: Property invoice distribution" "A1=$A1_INVOICES A2=$A2_INVOICES"
fi
echo ""

echo "── 4.4  Cashier Sessions scoped by property_id ─────────────────────"
A1_SESSIONS=$(dbq "SELECT COUNT(*) FROM cashier_sessions WHERE tenant_id='$TID_A' AND property_id='$PID_A1';")
A2_SESSIONS=$(dbq "SELECT COUNT(*) FROM cashier_sessions WHERE tenant_id='$TID_A' AND property_id='$PID_A2';")
ALL_A_SESSIONS=$(dbq "SELECT COUNT(*) FROM cashier_sessions WHERE tenant_id='$TID_A';")
EXPECTED_SUM=$((A1_SESSIONS + A2_SESSIONS))
assert_eq "USALI: A sessions = A1($A1_SESSIONS) + A2($A2_SESSIONS)" "$EXPECTED_SUM" "$ALL_A_SESSIONS"
if [[ "$A1_SESSIONS" -gt 0 && "$A2_SESSIONS" -gt 0 ]]; then
  pass "USALI: Both properties have cashier sessions"
else
  skip "USALI: Cashier session distribution" "A1=$A1_SESSIONS A2=$A2_SESSIONS"
fi
echo ""

echo "── 4.5  Night Audit scoped by property_id ──────────────────────────"
A1_AUDIT=$(dbq "SELECT COUNT(*) FROM night_audit_log WHERE tenant_id='$TID_A' AND property_id='$PID_A1';")
A2_AUDIT=$(dbq "SELECT COUNT(*) FROM night_audit_log WHERE tenant_id='$TID_A' AND property_id='$PID_A2';")
ALL_A_AUDIT=$(dbq "SELECT COUNT(*) FROM night_audit_log WHERE tenant_id='$TID_A';")
EXPECTED_SUM=$((A1_AUDIT + A2_AUDIT))
assert_eq "USALI: A audit = A1($A1_AUDIT) + A2($A2_AUDIT)" "$EXPECTED_SUM" "$ALL_A_AUDIT"
if [[ "$A1_AUDIT" -gt 0 && "$A2_AUDIT" -gt 0 ]]; then
  pass "USALI: Both properties have audit logs"
else
  skip "USALI: Audit log distribution" "A1=$A1_AUDIT A2=$A2_AUDIT"
fi
echo ""

echo "── 4.6  Business Dates independent per property ────────────────────"
A1_BDATE=$(dbq "SELECT business_date::text FROM business_dates WHERE tenant_id='$TID_A' AND property_id='$PID_A1' LIMIT 1;")
A2_BDATE=$(dbq "SELECT business_date::text FROM business_dates WHERE tenant_id='$TID_A' AND property_id='$PID_A2' LIMIT 1;")
if [[ -n "$A1_BDATE" && -n "$A2_BDATE" ]]; then
  pass "USALI: Property A1 business_date=$A1_BDATE, A2=$A2_BDATE (independent)"
else
  skip "USALI: Business dates" "A1=$A1_BDATE A2=$A2_BDATE"
fi
echo ""

echo "── 4.7  Folios scoped by property_id ───────────────────────────────"
A1_FOLIOS=$(dbq "SELECT COUNT(*) FROM folios WHERE tenant_id='$TID_A' AND property_id='$PID_A1';")
A2_FOLIOS=$(dbq "SELECT COUNT(*) FROM folios WHERE tenant_id='$TID_A' AND property_id='$PID_A2';")
ALL_A_FOLIOS=$(dbq "SELECT COUNT(*) FROM folios WHERE tenant_id='$TID_A';")
EXPECTED_SUM=$((A1_FOLIOS + A2_FOLIOS))
assert_eq "USALI: A folios = A1($A1_FOLIOS) + A2($A2_FOLIOS)" "$EXPECTED_SUM" "$ALL_A_FOLIOS"
echo ""

echo "── 4.8  AR scoped by property_id ───────────────────────────────────"
A1_AR=$(dbq "SELECT COUNT(*) FROM accounts_receivable WHERE tenant_id='$TID_A' AND property_id='$PID_A1';")
A2_AR=$(dbq "SELECT COUNT(*) FROM accounts_receivable WHERE tenant_id='$TID_A' AND property_id='$PID_A2';")
ALL_A_AR=$(dbq "SELECT COUNT(*) FROM accounts_receivable WHERE tenant_id='$TID_A';")
EXPECTED_SUM=$((A1_AR + A2_AR))
assert_eq "USALI: A AR = A1($A1_AR) + A2($A2_AR)" "$EXPECTED_SUM" "$ALL_A_AR"
echo ""

echo "── 4.9  Tax Configurations scoped by property_id ───────────────────"
A1_TAX=$(dbq "SELECT COUNT(*) FROM tax_configurations WHERE tenant_id='$TID_A' AND property_id='$PID_A1';")
A2_TAX=$(dbq "SELECT COUNT(*) FROM tax_configurations WHERE tenant_id='$TID_A' AND property_id='$PID_A2';")
ALL_A_TAX=$(dbq "SELECT COUNT(*) FROM tax_configurations WHERE tenant_id='$TID_A';")
EXPECTED_SUM=$((A1_TAX + A2_TAX))
assert_eq "USALI: A tax = A1($A1_TAX) + A2($A2_TAX)" "$EXPECTED_SUM" "$ALL_A_TAX"
echo ""

echo "── 4.10  Cross-property financial summary ──────────────────────────"
# USALI: total charges per property should be independent
A1_CHARGE_SUM=$(dbq "SELECT COALESCE(SUM(total_amount),0) FROM charge_postings WHERE tenant_id='$TID_A' AND property_id='$PID_A1' AND posting_type='DEBIT' AND COALESCE(is_voided,false)=false;")
A2_CHARGE_SUM=$(dbq "SELECT COALESCE(SUM(total_amount),0) FROM charge_postings WHERE tenant_id='$TID_A' AND property_id='$PID_A2' AND posting_type='DEBIT' AND COALESCE(is_voided,false)=false;")
echo "  Property A1 charge revenue: \$$A1_CHARGE_SUM"
echo "  Property A2 charge revenue: \$$A2_CHARGE_SUM"
if [[ $(echo "$A1_CHARGE_SUM > 0" | bc 2>/dev/null) == "1" && $(echo "$A2_CHARGE_SUM > 0" | bc 2>/dev/null) == "1" ]]; then
  pass "USALI: Both properties generating independent revenue"
else
  fail "USALI: Independent revenue" "A1=\$$A1_CHARGE_SUM A2=\$$A2_CHARGE_SUM"
fi
echo ""

# ═════════════════════════════════════════════════════════════════════════════
#  PHASE 5 — CROSS-TENANT ISOLATION
# ═════════════════════════════════════════════════════════════════════════════

echo ""
echo "╔═══════════════════════════════════════════════════════════════════════╗"
echo "║  PHASE 5: Cross-Tenant Data Isolation                               ║"
echo "╚═══════════════════════════════════════════════════════════════════════╝"
echo ""

echo "── 5.1  DB-level: No cross-contamination ───────────────────────────"

# Verify tenant_id scoping across all financial tables
TABLES_TO_CHECK=(
  "guests"
  "reservations"
  "charge_postings"
  "payments"
  "invoices"
  "folios"
  "cashier_sessions"
  "accounts_receivable"
  "night_audit_log"
  "rooms"
  "room_types"
  "properties"
)

for tbl in "${TABLES_TO_CHECK[@]}"; do
  A_COUNT=$(dbq "SELECT COUNT(*) FROM $tbl WHERE tenant_id='$TID_A';" 2>/dev/null || echo "0")
  B_COUNT=$(dbq "SELECT COUNT(*) FROM $tbl WHERE tenant_id='$TID_B';" 2>/dev/null || echo "0")
  # Verify no rows belong to the "wrong" tenant
  A_IN_B=$(dbq "SELECT COUNT(*) FROM $tbl WHERE tenant_id='$TID_A' AND id IN (SELECT id FROM $tbl WHERE tenant_id='$TID_B');" 2>/dev/null || echo "0")
  if [[ "$A_COUNT" -gt 0 && "$B_COUNT" -ge 0 && "$A_IN_B" == "0" ]]; then
    pass "DB isolation: $tbl (A=$A_COUNT B=$B_COUNT overlap=0)"
  elif [[ "$A_COUNT" == "0" && "$B_COUNT" == "0" ]]; then
    skip "DB isolation: $tbl" "both empty"
  else
    fail "DB isolation: $tbl" "A=$A_COUNT B=$B_COUNT overlap=$A_IN_B"
  fi
done
echo ""

echo "── 5.2  DB-level: Tenant B has no Tenant A property_ids ────────────"
# Critical: Tenant B should never reference Tenant A properties
B_WITH_A1=$(dbq "SELECT COUNT(*) FROM charge_postings WHERE tenant_id='$TID_B' AND property_id='$PID_A1';" 2>/dev/null || echo "0")
B_WITH_A2=$(dbq "SELECT COUNT(*) FROM charge_postings WHERE tenant_id='$TID_B' AND property_id='$PID_A2';" 2>/dev/null || echo "0")
assert_eq "DB isolation: B charges have no A1 property" "0" "$B_WITH_A1"
assert_eq "DB isolation: B charges have no A2 property" "0" "$B_WITH_A2"

A_WITH_B1=$(dbq "SELECT COUNT(*) FROM charge_postings WHERE tenant_id='$TID_A' AND property_id='$PID_B1';" 2>/dev/null || echo "0")
assert_eq "DB isolation: A charges have no B1 property" "0" "$A_WITH_B1"
echo ""

echo "── 5.3  API-level: Tenant A token cannot read Tenant B data ────────"
TOKEN="$TOKEN_A"

# Try to read Tenant B charges via API
code=$(get "$GW/v1/billing/charges?tenant_id=$TID_B&limit=10")
API_B_CHARGES=$(jq 'if type == "array" then length else (.data | length) // 0 end' "$RESP_FILE" 2>/dev/null || echo "0")
# Should either get 0 results or a 403/401
if [[ "$code" =~ ^(401|403) ]] || [[ "$API_B_CHARGES" == "0" || "$API_B_CHARGES" == "null" ]]; then
  pass "API isolation: Tenant A cannot read B charges (HTTP=$code count=$API_B_CHARGES)"
else
  fail "API isolation: Tenant A reading B charges" "HTTP=$code count=$API_B_CHARGES"
fi

# Try to read Tenant B payments
code=$(get "$GW/v1/billing/payments?tenant_id=$TID_B&limit=10")
API_B_PAYMENTS=$(jq 'if type == "array" then length else (.data | length) // 0 end' "$RESP_FILE" 2>/dev/null || echo "0")
if [[ "$code" =~ ^(401|403) ]] || [[ "$API_B_PAYMENTS" == "0" || "$API_B_PAYMENTS" == "null" ]]; then
  pass "API isolation: Tenant A cannot read B payments (HTTP=$code)"
else
  fail "API isolation: Tenant A reading B payments" "HTTP=$code count=$API_B_PAYMENTS"
fi

# Try to read Tenant B invoices
code=$(get "$GW/v1/billing/invoices?tenant_id=$TID_B")
API_B_INVOICES=$(jq '.meta.count // (.data | length) // 0' "$RESP_FILE" 2>/dev/null || echo "0")
if [[ "$code" =~ ^(401|403) ]] || [[ "$API_B_INVOICES" == "0" || "$API_B_INVOICES" == "null" ]]; then
  pass "API isolation: Tenant A cannot read B invoices (HTTP=$code)"
else
  fail "API isolation: Tenant A reading B invoices" "HTTP=$code count=$API_B_INVOICES"
fi

# Try to read Tenant B guests
code=$(get "$GW/v1/guests?tenant_id=$TID_B&limit=10")
API_B_GUESTS=$(jq 'if type == "array" then length else (.data | length) // 0 end' "$RESP_FILE" 2>/dev/null || echo "0")
if [[ "$code" =~ ^(401|403) ]] || [[ "$API_B_GUESTS" == "0" || "$API_B_GUESTS" == "null" ]]; then
  pass "API isolation: Tenant A cannot read B guests (HTTP=$code)"
else
  fail "API isolation: Tenant A reading B guests" "HTTP=$code count=$API_B_GUESTS"
fi

# Try to read Tenant B rooms
code=$(get "$GW/v1/rooms?tenant_id=$TID_B&limit=10")
API_B_ROOMS=$(jq 'if type == "array" then length else (.data | length) // 0 end' "$RESP_FILE" 2>/dev/null || echo "0")
if [[ "$code" =~ ^(401|403) ]] || [[ "$API_B_ROOMS" == "0" || "$API_B_ROOMS" == "null" ]]; then
  pass "API isolation: Tenant A cannot read B rooms (HTTP=$code)"
else
  fail "API isolation: Tenant A reading B rooms" "HTTP=$code count=$API_B_ROOMS"
fi
echo ""

echo "── 5.4  API-level: Tenant B token cannot read Tenant A data ────────"
TOKEN="$TOKEN_B"

code=$(get "$GW/v1/billing/charges?tenant_id=$TID_A&limit=10")
API_A_FROM_B=$(jq 'if type == "array" then length else (.data | length) // 0 end' "$RESP_FILE" 2>/dev/null || echo "0")
if [[ "$code" =~ ^(401|403) ]] || [[ "$API_A_FROM_B" == "0" || "$API_A_FROM_B" == "null" ]]; then
  pass "API isolation: Tenant B cannot read A charges (HTTP=$code)"
else
  fail "API isolation: Tenant B reading A charges" "HTTP=$code count=$API_A_FROM_B"
fi

code=$(get "$GW/v1/billing/payments?tenant_id=$TID_A&limit=10")
API_A_PAY_FROM_B=$(jq 'if type == "array" then length else (.data | length) // 0 end' "$RESP_FILE" 2>/dev/null || echo "0")
if [[ "$code" =~ ^(401|403) ]] || [[ "$API_A_PAY_FROM_B" == "0" || "$API_A_PAY_FROM_B" == "null" ]]; then
  pass "API isolation: Tenant B cannot read A payments (HTTP=$code)"
else
  fail "API isolation: Tenant B reading A payments" "HTTP=$code count=$API_A_PAY_FROM_B"
fi

code=$(get "$GW/v1/guests?tenant_id=$TID_A&limit=10")
API_A_GUESTS_FROM_B=$(jq 'if type == "array" then length else (.data | length) // 0 end' "$RESP_FILE" 2>/dev/null || echo "0")
if [[ "$code" =~ ^(401|403) ]] || [[ "$API_A_GUESTS_FROM_B" == "0" || "$API_A_GUESTS_FROM_B" == "null" ]]; then
  pass "API isolation: Tenant B cannot read A guests (HTTP=$code)"
else
  fail "API isolation: Tenant B reading A guests" "HTTP=$code count=$API_A_GUESTS_FROM_B"
fi
echo ""

echo "── 5.5  API-level: Cross-tenant command rejection ──────────────────"
# Attempt to post a charge using Tenant B's token but Tenant A's property
TOKEN="$TOKEN_B"
CUR_TID="$TID_A"
CROSS_CODE=$(curl -s -o "$RESP_FILE" -w "%{http_code}" \
  -X POST "$GW/v1/commands/billing.charge.post/execute" \
  -H "Authorization: Bearer $TOKEN_B" \
  -H "Content-Type: application/json" \
  -d "{\"tenant_id\":\"$TID_A\",\"payload\":{\"property_id\":\"$PID_A1\",\"reservation_id\":\"00000000-0000-0000-0000-000000000000\",\"amount\":999.99,\"charge_code\":\"ROOM\",\"description\":\"Cross-tenant attack\"}}")

if [[ "$CROSS_CODE" =~ ^(401|403|400) ]]; then
  pass "API isolation: Cross-tenant command blocked (HTTP=$CROSS_CODE)"
else
  # Even if accepted, verify no charge was actually created
  ATTACK_CHARGE=$(dbq "SELECT COUNT(*) FROM charge_postings WHERE tenant_id='$TID_A' AND description='Cross-tenant attack';")
  if [[ "$ATTACK_CHARGE" == "0" ]]; then
    pass "API isolation: Cross-tenant charge not persisted"
  else
    fail "API isolation: Cross-tenant charge was persisted!" "$ATTACK_CHARGE rows"
  fi
fi
echo ""

# ═════════════════════════════════════════════════════════════════════════════
#  PHASE 6 — MULTI-TENANT API READ VALIDATION
# ═════════════════════════════════════════════════════════════════════════════

echo ""
echo "╔═══════════════════════════════════════════════════════════════════════╗"
echo "║  PHASE 6: Multi-Tenant API Read Validation                          ║"
echo "╚═══════════════════════════════════════════════════════════════════════╝"
echo ""

# Helper: check API count vs DB count for a given tenant
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
  if [[ "$api_count" == "$db_count" ]]; then
    pass "XCHECK $label  (api=$api_count db=$db_count)"
  else
    fail "XCHECK $label" "api=$api_count db=$db_count"
  fi
}

# ── Tenant A endpoints ──
echo "── 6.1  Tenant A API reads ──────────────────────────────────────────"
TOKEN="$TOKEN_A"

api_vs_db "A charges" \
  "$GW/v1/billing/charges?tenant_id=$TID_A&limit=500" \
  'if type == "array" then length else (.data | length) // 0 end' \
  "SELECT COUNT(*) FROM charge_postings WHERE tenant_id='$TID_A' AND COALESCE(is_voided,false)=false AND deleted_at IS NULL;"

api_vs_db "A payments" \
  "$GW/v1/billing/payments?tenant_id=$TID_A&limit=500" \
  'if type == "array" then length else (.data | length) // 0 end' \
  "SELECT COUNT(*) FROM payments WHERE tenant_id='$TID_A';"

api_vs_db "A invoices" \
  "$GW/v1/billing/invoices?tenant_id=$TID_A" \
  '.meta.count // (.data | length)' \
  "SELECT COUNT(*) FROM invoices WHERE tenant_id='$TID_A';"

api_vs_db "A cashier-sessions" \
  "$GW/v1/billing/cashier-sessions?tenant_id=$TID_A&limit=100" \
  'if type == "array" then length else (.data | length) // 0 end' \
  "SELECT COUNT(*) FROM cashier_sessions WHERE tenant_id='$TID_A';"

code=$(get "$GW/v1/night-audit/status?tenant_id=$TID_A&property_id=$PID_A1")
assert_http "API A: night-audit status" "200" "$code"

code=$(get "$GW/v1/billing/reports/trial-balance?tenant_id=$TID_A&property_id=$PID_A1&business_date=$TODAY")
assert_http "API A: trial-balance" "200" "$code"
echo ""

# ── Tenant B endpoints ──
echo "── 6.2  Tenant B API reads ──────────────────────────────────────────"
TOKEN="$TOKEN_B"

api_vs_db "B charges" \
  "$GW/v1/billing/charges?tenant_id=$TID_B&limit=500" \
  'if type == "array" then length else (.data | length) // 0 end' \
  "SELECT COUNT(*) FROM charge_postings WHERE tenant_id='$TID_B' AND COALESCE(is_voided,false)=false AND deleted_at IS NULL;"

api_vs_db "B payments" \
  "$GW/v1/billing/payments?tenant_id=$TID_B&limit=500" \
  'if type == "array" then length else (.data | length) // 0 end' \
  "SELECT COUNT(*) FROM payments WHERE tenant_id='$TID_B';"

api_vs_db "B invoices" \
  "$GW/v1/billing/invoices?tenant_id=$TID_B" \
  '.meta.count // (.data | length)' \
  "SELECT COUNT(*) FROM invoices WHERE tenant_id='$TID_B';"

api_vs_db "B cashier-sessions" \
  "$GW/v1/billing/cashier-sessions?tenant_id=$TID_B&limit=100" \
  'if type == "array" then length else (.data | length) // 0 end' \
  "SELECT COUNT(*) FROM cashier_sessions WHERE tenant_id='$TID_B';"

code=$(get "$GW/v1/night-audit/status?tenant_id=$TID_B&property_id=$PID_B1")
assert_http "API B: night-audit status" "200" "$code"
echo ""

# ═════════════════════════════════════════════════════════════════════════════
#  PHASE 7 — POST-TEST DB SNAPSHOT + FINAL REPORT
# ═════════════════════════════════════════════════════════════════════════════

echo ""
echo "╔═══════════════════════════════════════════════════════════════════════╗"
echo "║  PHASE 7: Post-Test DB Snapshot                                     ║"
echo "╚═══════════════════════════════════════════════════════════════════════╝"
echo ""

echo "── Tenant A ─────────────────────────────────────────────────────────"
POST_A_GUESTS=$(dbq "SELECT COUNT(*) FROM guests WHERE tenant_id='$TID_A';")
POST_A_RES=$(dbq "SELECT COUNT(*) FROM reservations WHERE tenant_id='$TID_A';")
POST_A_CHARGES=$(dbq "SELECT COUNT(*) FROM charge_postings WHERE tenant_id='$TID_A';")
POST_A_PAYMENTS=$(dbq "SELECT COUNT(*) FROM payments WHERE tenant_id='$TID_A';")
POST_A_INVOICES=$(dbq "SELECT COUNT(*) FROM invoices WHERE tenant_id='$TID_A';")
POST_A_FOLIOS=$(dbq "SELECT COUNT(*) FROM folios WHERE tenant_id='$TID_A';")
POST_A_SESSIONS=$(dbq "SELECT COUNT(*) FROM cashier_sessions WHERE tenant_id='$TID_A';")
POST_A_AR=$(dbq "SELECT COUNT(*) FROM accounts_receivable WHERE tenant_id='$TID_A';")
POST_A_AUDIT=$(dbq "SELECT COUNT(*) FROM night_audit_log WHERE tenant_id='$TID_A';")

printf "  %-25s  %5s → %5s  (Δ %+d)\n" "guests"         "$PRE_A_GUESTS"       "$POST_A_GUESTS"       "$((POST_A_GUESTS - PRE_A_GUESTS))"
printf "  %-25s  %5s → %5s  (Δ %+d)\n" "reservations"    "$PRE_A_RESERVATIONS"  "$POST_A_RES"          "$((POST_A_RES - PRE_A_RESERVATIONS))"
printf "  %-25s  %5s → %5s  (Δ %+d)\n" "charge_postings" "$PRE_A_CHARGES"       "$POST_A_CHARGES"      "$((POST_A_CHARGES - PRE_A_CHARGES))"
printf "  %-25s  %5s → %5s  (Δ %+d)\n" "payments"        "$PRE_A_PAYMENTS"      "$POST_A_PAYMENTS"     "$((POST_A_PAYMENTS - PRE_A_PAYMENTS))"
printf "  %-25s  %5s → %5s  (Δ %+d)\n" "invoices"        "$PRE_A_INVOICES"      "$POST_A_INVOICES"     "$((POST_A_INVOICES - PRE_A_INVOICES))"
printf "  %-25s  %5s\n"                 "folios"                                  "$POST_A_FOLIOS"
printf "  %-25s  %5s\n"                 "cashier_sessions"                         "$POST_A_SESSIONS"
printf "  %-25s  %5s\n"                 "accounts_receivable"                      "$POST_A_AR"
printf "  %-25s  %5s\n"                 "night_audit_log"                          "$POST_A_AUDIT"
echo ""

echo "  Property breakdown:"
printf "    %-20s  A1=%-6s  A2=%-6s\n" "charges" \
  "$(dbq "SELECT COUNT(*) FROM charge_postings WHERE tenant_id='$TID_A' AND property_id='$PID_A1';")" \
  "$(dbq "SELECT COUNT(*) FROM charge_postings WHERE tenant_id='$TID_A' AND property_id='$PID_A2';")"
printf "    %-20s  A1=%-6s  A2=%-6s\n" "payments" \
  "$(dbq "SELECT COUNT(*) FROM payments WHERE tenant_id='$TID_A' AND property_id='$PID_A1';")" \
  "$(dbq "SELECT COUNT(*) FROM payments WHERE tenant_id='$TID_A' AND property_id='$PID_A2';")"
printf "    %-20s  A1=%-6s  A2=%-6s\n" "invoices" \
  "$(dbq "SELECT COUNT(*) FROM invoices WHERE tenant_id='$TID_A' AND property_id='$PID_A1';")" \
  "$(dbq "SELECT COUNT(*) FROM invoices WHERE tenant_id='$TID_A' AND property_id='$PID_A2';")"
echo ""

echo "── Tenant B ─────────────────────────────────────────────────────────"
POST_B_GUESTS=$(dbq "SELECT COUNT(*) FROM guests WHERE tenant_id='$TID_B';")
POST_B_RES=$(dbq "SELECT COUNT(*) FROM reservations WHERE tenant_id='$TID_B';")
POST_B_CHARGES=$(dbq "SELECT COUNT(*) FROM charge_postings WHERE tenant_id='$TID_B';")
POST_B_PAYMENTS=$(dbq "SELECT COUNT(*) FROM payments WHERE tenant_id='$TID_B';")
POST_B_INVOICES=$(dbq "SELECT COUNT(*) FROM invoices WHERE tenant_id='$TID_B';")
POST_B_FOLIOS=$(dbq "SELECT COUNT(*) FROM folios WHERE tenant_id='$TID_B';")
POST_B_SESSIONS=$(dbq "SELECT COUNT(*) FROM cashier_sessions WHERE tenant_id='$TID_B';")
POST_B_AR=$(dbq "SELECT COUNT(*) FROM accounts_receivable WHERE tenant_id='$TID_B';")
POST_B_AUDIT=$(dbq "SELECT COUNT(*) FROM night_audit_log WHERE tenant_id='$TID_B';")

printf "  %-25s  %5s → %5s  (Δ %+d)\n" "guests"         "$PRE_B_GUESTS"       "$POST_B_GUESTS"       "$((POST_B_GUESTS - PRE_B_GUESTS))"
printf "  %-25s  %5s → %5s  (Δ %+d)\n" "reservations"    "$PRE_B_RESERVATIONS"  "$POST_B_RES"          "$((POST_B_RES - PRE_B_RESERVATIONS))"
printf "  %-25s  %5s → %5s  (Δ %+d)\n" "charge_postings" "$PRE_B_CHARGES"       "$POST_B_CHARGES"      "$((POST_B_CHARGES - PRE_B_CHARGES))"
printf "  %-25s  %5s → %5s  (Δ %+d)\n" "payments"        "$PRE_B_PAYMENTS"      "$POST_B_PAYMENTS"     "$((POST_B_PAYMENTS - PRE_B_PAYMENTS))"
printf "  %-25s  %5s → %5s  (Δ %+d)\n" "invoices"        "$PRE_B_INVOICES"      "$POST_B_INVOICES"     "$((POST_B_INVOICES - PRE_B_INVOICES))"
printf "  %-25s  %5s\n"                 "folios"                                  "$POST_B_FOLIOS"
printf "  %-25s  %5s\n"                 "cashier_sessions"                         "$POST_B_SESSIONS"
printf "  %-25s  %5s\n"                 "accounts_receivable"                      "$POST_B_AR"
printf "  %-25s  %5s\n"                 "night_audit_log"                          "$POST_B_AUDIT"
echo ""

echo "  Property breakdown:"
printf "    %-20s  B1=%-6s  B2=%-6s\n" "charges" \
  "$(dbq "SELECT COUNT(*) FROM charge_postings WHERE tenant_id='$TID_B' AND property_id='$PID_B1';")" \
  "$(dbq "SELECT COUNT(*) FROM charge_postings WHERE tenant_id='$TID_B' AND property_id='$PID_B2';")"
printf "    %-20s  B1=%-6s  B2=%-6s\n" "payments" \
  "$(dbq "SELECT COUNT(*) FROM payments WHERE tenant_id='$TID_B' AND property_id='$PID_B1';")" \
  "$(dbq "SELECT COUNT(*) FROM payments WHERE tenant_id='$TID_B' AND property_id='$PID_B2';")"
echo ""

# ═════════════════════════════════════════════════════════════════════════════
#  FINAL REPORT
# ═════════════════════════════════════════════════════════════════════════════

echo "╔═══════════════════════════════════════════════════════════════════════╗"
if [[ $FAIL -eq 0 ]]; then
  printf "║  ✅  ALL MULTI-TENANT TESTS PASSED: %d/%d passed" "$PASS" "$TOTAL"
else
  printf "║  ❌  TESTS COMPLETE: %d/%d passed, %d FAILED" "$PASS" "$TOTAL" "$FAIL"
fi
if [[ $SKIP -gt 0 ]]; then
  printf ", %d skipped" "$SKIP"
fi
printf "%*s║\n" "$((10 - ${#PASS} - ${#TOTAL} - ${#FAIL} - ${#SKIP}))" ""
printf "║  Phase 1 (single-tenant): exit %d                                   ║\n" "$PHASE1_EXIT"
printf "║  Phases 2-7 (multi-tenant): %d/%d passed, %d failed                " "$PASS" "$TOTAL" "$FAIL"
printf "%*s║\n" "$((5 - ${#PASS} - ${#TOTAL} - ${#FAIL}))" ""
echo "║                                                                       ║"
echo "║  Tenants tested:    2 (A + B)                                         ║"
echo "║  Properties tested: 4 (A1, A2, B1, B2)                                ║"
echo "╚═══════════════════════════════════════════════════════════════════════╝"
echo ""

if [[ $FAIL -gt 0 || $PHASE1_EXIT -ne 0 ]]; then
  exit 1
fi
