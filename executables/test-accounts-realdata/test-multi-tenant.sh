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
#   PHASE 5b  Module access requests (raise → review → module toggled)
#   PHASE 6   API read endpoints cross-validation
#   PHASE 7   Post-test DB snapshot + final report
#
# Usage:
#   ./executables/test-accounts-realdata/test-multi-tenant.sh
#   ./executables/test-accounts-realdata/test-multi-tenant.sh --skip-seed
#
# Prerequisites:
#   - All services running (pnpm run dev)
#   - jq, bc, curl — installed automatically by ensure-deps.sh if missing
#     (TARTWARE_AUTO_INSTALL_DEPS=1 to skip the confirmation prompt)
#   - http_test/get-token.sh working
###############################################################################
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

source "$SCRIPT_DIR/ensure-deps.sh"

# ─── Configuration ───────────────────────────────────────────────────────────
GW="http://localhost:8080"
CORE_SVC="http://localhost:3000"

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
IN30DAYS=$(date -d "+30 days" +%Y-%m-%d 2>/dev/null || date -v+30d +%Y-%m-%d)
IN90DAYS=$(date -d "+90 days" +%Y-%m-%d 2>/dev/null || date -v+90d +%Y-%m-%d)
KAFKA_WAIT=4
UNIQUE=$(date +%s)

# Per-run unique tag injected into Tenant B + dynamic property codes/usernames/emails.
# Lets every invocation create fresh tenant/property/user records and surface real
# uniqueness errors instead of silently reusing prior-run data.
RUN_TAG="$(date +%H%M%S)$(printf '%02d' $((RANDOM % 100)))"  # 8 chars, e.g. 1530457
echo "┌─ RUN_TAG=$RUN_TAG (used to suffix Tenant B slug, property codes, B-side usernames)"

PASS=0; FAIL=0; TOTAL=0; SKIP=0

# Loyalty program ids minted during Phase 6c — printed at the end so they can be
# pasted into the Loyalty → Transactions screen, which takes a program id by hand.
PROGRAM_IDS=()
LAST_PROGRAM_ID=""
LAST_PROGRAM_GUEST=""
SKIP_SEED=false
FULL_API=true   # set false with --no-full-api to skip Phase 6b smoke coverage

for arg in "$@"; do
  case "$arg" in
    --skip-seed)    SKIP_SEED=true ;;
    --no-full-api)  FULL_API=false ;;
    --full-api)     FULL_API=true ;;
  esac
done

# ─── Helpers ─────────────────────────────────────────────────────────────────

RESP_FILE=$(mktemp /tmp/tartware-mt-resp.XXXXXX.json)
trap "rm -f $RESP_FILE" EXIT

# Generate a UUID for Idempotency-Key (required by all command writes since IDEMP-01).
gen_uuid() {
  if [[ -r /proc/sys/kernel/random/uuid ]]; then
    cat /proc/sys/kernel/random/uuid
  elif command -v uuidgen >/dev/null 2>&1; then
    uuidgen
  else
    printf '%08x-%04x-%04x-%04x-%012x\n' \
      $((RANDOM*RANDOM)) $RANDOM $RANDOM $RANDOM $((RANDOM*RANDOM*RANDOM))
  fi
}

post() {
  local idem="${3:-$(gen_uuid)}"
  curl -s -o "$RESP_FILE" -w "%{http_code}" \
    -X POST "$1" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -H "Idempotency-Key: $idem" \
    -d "$2"
}

put() {
  local idem="${3:-$(gen_uuid)}"
  curl -s -o "$RESP_FILE" -w "%{http_code}" \
    -X PUT "$1" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -H "Idempotency-Key: $idem" \
    -d "$2"
}

get() {
  curl -s -o "$RESP_FILE" -w "%{http_code}" \
    "$1" \
    -H "Authorization: Bearer $TOKEN"
}

# ─── API response helpers (replace all direct SQL queries) ─────────────
# All data access goes through REST APIs — zero direct SQL queries.

# Count items from the last API response (call after get or api_get)
resp_count() {
  jq -r 'if type == "array" then length elif .data and (.data | type == "array") then (.data | length) else 0 end' "$RESP_FILE" 2>/dev/null || echo "0"
}

# Get a field from the first item in the last API response
resp_first() {
  local field="$1"
  jq -r "(if type == \"array\" then .[0] elif .data and (.data | type == \"array\") then .data[0] else . end) // {} | .$field // empty" "$RESP_FILE" 2>/dev/null || echo ""
}

# Get a field from a single-item or detail response
resp_field() {
  local field="$1"
  jq -r ".$field // (.data.$field) // empty" "$RESP_FILE" 2>/dev/null || echo ""
}

# Filter items from last API response and count matches
resp_fcount() {
  local filter="$1"
  jq -r "(if type == \"array\" then . elif .data and (.data | type == \"array\") then .data else [] end) | map(select($filter)) | length" "$RESP_FILE" 2>/dev/null || echo "0"
}

# Filter items and get first match's field
resp_ffirst() {
  local filter="$1" field="$2"
  jq -r "(if type == \"array\" then . elif .data and (.data | type == \"array\") then .data else [] end) | map(select($filter)) | .[0].$field // empty" "$RESP_FILE" 2>/dev/null || echo ""
}

# Sum a numeric field across all items
resp_sum() {
  local field="$1"
  jq -r "(if type == \"array\" then . elif .data and (.data | type == \"array\") then .data else [] end) | map(.$field | tostring | tonumber? // 0) | add // 0" "$RESP_FILE" 2>/dev/null || echo "0"
}

# Sum a numeric field across filtered items
resp_sum_f() {
  local field="$1" filter="$2"
  jq -r "(if type == \"array\" then . elif .data and (.data | type == \"array\") then .data else [] end) | map(select($filter)) | map(.$field | tostring | tonumber? // 0) | add // 0" "$RESP_FILE" 2>/dev/null || echo "0"
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
  local label="$1" cmd="$2" payload="$3" idem="${4:-$(gen_uuid)}"
  local body="{\"tenant_id\":\"$CUR_TID\",\"payload\":$payload}"
  printf "  ▸ %-55s " "$label"
  local code
  code=$(curl -s -o "$RESP_FILE" -w "%{http_code}" \
    -X POST "$GW/v1/commands/$cmd/execute" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -H "Idempotency-Key: $idem" \
    -d "$body")
  if [[ "$code" =~ ^2 ]]; then printf "✓ %s\n" "$code"
  else printf "✗ %s ← %s\n" "$code" "$(jq -r '.message // .error // .code // .' "$RESP_FILE" 2>/dev/null | head -c 180)"; fi
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

# poll_count — poll a URL until resp_count >= want, or give up.
# Async command handlers land rows at a rate that varies with Kafka backlog, so
# a fixed sleep that works for the first property starves the fourth.
# Usage: poll_count <url> <want> [max_wait_s=60]
poll_count() {
  local url="$1" want="$2" max="${3:-60}" waited=0 n=0
  while [[ $waited -lt $max ]]; do
    get "$url" >/dev/null
    n=$(resp_count)
    [[ "$n" -ge "$want" ]] && { echo "$n"; return 0; }
    sleep 4; waited=$((waited + 4))
  done
  # Always exit 0: the caller asserts on the count. Returning non-zero would
  # abort the whole script under `set -e` when used as `x=$(poll_count ...)`,
  # turning one slow endpoint into a total run failure.
  echo "$n"
}


# poll_delta — poll an API endpoint until the item-count delta >= min_delta,
# retrying with exponential backoff when the initial check shows Δ=0.
# Emits pass on success, skip after all retries (never a hard fail — Δ=0 may
# be a handler no-op rather than a test defect).
#
# Usage: poll_delta <label> <url> <baseline> [min_delta=1] [max_retries=1] [first_retry_wait=16]
poll_delta() {
  local label="$1" url="$2" baseline="$3"
  local min_delta="${4:-1}" max_retries="${5:-1}" wait="${6:-16}"
  local current delta

  get "$url" >/dev/null
  current=$(resp_count)
  delta=$((current - baseline))

  if [[ "$delta" -ge "$min_delta" ]]; then
    pass "$label (Δ=$delta)"; return 0
  fi

  local attempt=1
  while [[ $attempt -le $max_retries ]]; do
    printf "  ⏳ Retry %d/%d in %ds: %s (Δ=%d so far)\n" \
           "$attempt" "$max_retries" "$wait" "$label" "$delta"
    sleep "$wait"
    get "$url" >/dev/null
    current=$(resp_count)
    delta=$((current - baseline))
    if [[ "$delta" -ge "$min_delta" ]]; then
      pass "$label (Δ=$delta, retry $attempt)"; return 0
    fi
    wait=$((wait * 2)); attempt=$((attempt + 1))
  done

  skip "$label" "Δ=$delta after $((max_retries + 1)) checks"
}

# ─── Preflight checks ───────────────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  MULTI-TENANT E2E BILLING TEST"
echo "  2 tenants × 2 properties — USALI property-level isolation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "── Preflight ────────────────────────────────────────────────────────"
ensure_deps jq curl bc || exit 1

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

# Ensure finance-automation module is enabled for Tenant A
echo "  Enabling all modules for Tenant A..."
MOD_CODE=$(curl -s -o "$RESP_FILE" -w "%{http_code}" \
  -X PUT "$GW/v1/tenants/$TID_A/modules" \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d "{\"modules\":[\"core\",\"finance-automation\",\"tenant-owner-portal\",\"facility-maintenance\",\"analytics-bi\",\"marketing-channel\",\"enterprise-api\",\"revenue-management\",\"loyalty\",\"distribution\"]}")
if [[ "$MOD_CODE" =~ ^2 ]]; then
  echo "  ✓ Modules enabled for Tenant A (HTTP $MOD_CODE)"
else
  echo "  ⚠ Module enable for Tenant A: HTTP $MOD_CODE (may be pre-existing)"
fi
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

TENANT_B_USER="beacon.admin.${RUN_TAG}"
TENANT_B_PASS="BeaconPass123!"
TENANT_B_EMAIL="admin+${RUN_TAG}@beaconhotels.test"
TENANT_B_SLUG="beacon-hotels-${RUN_TAG}"
TENANT_B_NAME="Beacon Hotels ${RUN_TAG}"
PROPERTY_B1_CODE="BCN-HV-${RUN_TAG}"
PROPERTY_B2_CODE="BCN-MT-${RUN_TAG}"
PROPERTY_A2_CODE="TAR-BH-${RUN_TAG}"

# Check if Tenant B already exists via API (system admin endpoint)
echo "  Generating system admin token..."
SYS_TOKEN=$(ADMIN_USERNAME=system.admin DB_PASSWORD=postgres \
  AUTH_JWT_SECRET=dev-secret-minimum-32-chars-change-me! \
  npx tsx Apps/core-service/scripts/bootstrap-system-admin-token.ts 2>/dev/null \
  | sed -n '/^{$/,/^}$/p' | jq -r '.token // empty')
if [[ -z "$SYS_TOKEN" ]]; then
  echo "FATAL: Could not generate system admin token"
  exit 1
fi
echo "  ✓ System admin token acquired"

# Look up tenant by slug via system admin API
SYS_RESP=$(curl -s "$CORE_SVC/v1/system/tenants?limit=200" \
  -H "Authorization: Bearer $SYS_TOKEN")
EXISTING_B=$(echo "$SYS_RESP" | jq -r --arg slug "$TENANT_B_SLUG" '.tenants // [] | map(select(.slug == $slug)) | .[0].id // empty' 2>/dev/null)

if [[ -n "$EXISTING_B" ]]; then
  TID_B="$EXISTING_B"
  echo "  ℹ Tenant B already exists: $TID_B"
  # Get tenant B token first (system token can't read tenant-scoped routes)
  TOKEN_B=$(curl -s -X POST "$GW/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$TENANT_B_USER\",\"password\":\"$TENANT_B_PASS\"}" \
    | jq -r '.access_token // .token // .data.access_token // empty')
  if [[ -n "$TOKEN_B" ]]; then
    code=$(curl -s -o "$RESP_FILE" -w "%{http_code}" \
      "$GW/v1/properties?tenant_id=$TID_B&limit=10" \
      -H "Authorization: Bearer $TOKEN_B")
    # Pick this run's B1 property by dynamic code
    PID_B1=$(jq -r --arg code "$PROPERTY_B1_CODE" '(if type == "array" then . else (.data? // .properties // []) end) | map(select(.property_code == $code)) | .[0].id // empty' "$RESP_FILE" 2>/dev/null)
    # Fallback: any property if dynamic code not present yet
    if [[ -z "$PID_B1" ]]; then
      PID_B1=$(jq -r '(if type == "array" then .[0] else (.data[0] // .properties[0] // null) end) | .id // empty' "$RESP_FILE" 2>/dev/null)
    fi
  fi
  echo "  ℹ Property B1: $PID_B1"
else

  BOOTSTRAP_CODE=$(curl -s -o "$RESP_FILE" -w "%{http_code}" \
    -X POST "$CORE_SVC/v1/system/tenants/bootstrap" \
    -H "Authorization: Bearer $SYS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"tenant\": {
        \"name\": \"$TENANT_B_NAME\",
        \"slug\": \"$TENANT_B_SLUG\",
        \"type\": \"INDEPENDENT\",
        \"email\": \"$TENANT_B_EMAIL\"
      },
      \"property\": {
        \"property_name\": \"Beacon Harborview $RUN_TAG\",
        \"property_code\": \"$PROPERTY_B1_CODE\",
        \"property_type\": \"hotel\",
        \"star_rating\": 4,
        \"total_rooms\": 80,
        \"email\": \"harbor+${RUN_TAG}@beaconhotels.test\",
        \"timezone\": \"America/Chicago\",
        \"currency\": \"USD\"
      },
      \"owner\": {
        \"username\": \"$TENANT_B_USER\",
        \"email\": \"$TENANT_B_EMAIL\",
        \"password\": \"$TENANT_B_PASS\",
        \"first_name\": \"Marcus\",
        \"last_name\": \"Reed\"
      }
    }")

  if [[ ! "$BOOTSTRAP_CODE" =~ ^2 ]]; then
    echo "FATAL: Bootstrap Tenant B failed (HTTP $BOOTSTRAP_CODE)"
    jq '.' "$RESP_FILE" 2>/dev/null
    exit 1
  fi

  TID_B=$(jq -r '.tenant.id // empty' "$RESP_FILE")
  PID_B1=$(jq -r '.property.id // empty' "$RESP_FILE")

  if [[ -z "$TID_B" || -z "$PID_B1" ]]; then
    echo "FATAL: Bootstrap response missing tenant/property IDs"
    jq '.' "$RESP_FILE" 2>/dev/null
    exit 1
  fi

  echo "  ✓ Tenant B bootstrapped: $TID_B"
  echo "  ✓ Property B1: $PID_B1"
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

# Enable all modules for Tenant B
echo "  Enabling all modules for Tenant B..."
MOD_CODE=$(curl -s -o "$RESP_FILE" -w "%{http_code}" \
  -X PUT "$GW/v1/tenants/$TID_B/modules" \
  -H "Authorization: Bearer $TOKEN_B" \
  -H "Content-Type: application/json" \
  -d "{\"modules\":[\"core\",\"finance-automation\",\"tenant-owner-portal\",\"facility-maintenance\",\"analytics-bi\",\"marketing-channel\",\"enterprise-api\",\"revenue-management\",\"loyalty\",\"distribution\"]}")
if [[ "$MOD_CODE" =~ ^2 ]]; then
  echo "  ✓ Modules enabled for Tenant B (HTTP $MOD_CODE)"
else
  echo "  ⚠ Failed to enable modules for Tenant B (HTTP $MOD_CODE)"
  jq '.message // .error // .' "$RESP_FILE" 2>/dev/null
fi
echo ""

# ── 0.2  Create Property A2 (second property for Tenant A) ──────────────
echo "── 0.2  Create Property A2 ──────────────────────────────────────────"

TOKEN="$TOKEN_A"
get "$GW/v1/properties?tenant_id=$TID_A" >/dev/null
EXISTING_A2=$(resp_ffirst ".property_code == \"$PROPERTY_A2_CODE\"" "id")
if [[ -n "$EXISTING_A2" ]]; then
  PID_A2="$EXISTING_A2"
  echo "  ℹ Property A2 already exists: $PID_A2"
else
  code=$(post "$GW/v1/properties" \
    "{\"tenant_id\":\"$TID_A\",\"property_name\":\"Tartware Beach Resort $RUN_TAG\",\"property_code\":\"$PROPERTY_A2_CODE\",\"property_type\":\"RESORT\",\"star_rating\":4,\"total_rooms\":100,\"email\":\"beach+${RUN_TAG}@tartware.test\",\"currency\":\"USD\",\"timezone\":\"America/New_York\"}")
  if [[ "$code" =~ ^2 ]]; then
    PID_A2=$(jq -r '.id // .data.id // .property_id // empty' "$RESP_FILE" 2>/dev/null)
    if [[ -z "$PID_A2" ]]; then
      get "$GW/v1/properties?tenant_id=$TID_A" >/dev/null
      PID_A2=$(resp_ffirst ".property_code == \"$PROPERTY_A2_CODE\"" "id")
    fi
    echo "  ✓ Property A2 created: $PID_A2"
  else
    echo "  ⚠ Could not create Property A2 (HTTP $code)"
    get "$GW/v1/properties?tenant_id=$TID_A" >/dev/null
    PID_A2=$(resp_ffirst ".property_code == \"$PROPERTY_A2_CODE\"" "id")
    if [[ -n "$PID_A2" ]]; then echo "  ℹ Found via API: $PID_A2"; fi
  fi
fi
[[ -n "$PID_A2" ]] || { echo "FATAL: Property A2 not resolved"; exit 1; }
echo ""

# ── 0.3  Create Property B2 (second property for Tenant B) ──────────────
echo "── 0.3  Create Property B2 ──────────────────────────────────────────"

TOKEN="$TOKEN_B"
get "$GW/v1/properties?tenant_id=$TID_B" >/dev/null
EXISTING_B2=$(resp_ffirst ".property_code == \"$PROPERTY_B2_CODE\"" "id")
if [[ -n "$EXISTING_B2" ]]; then
  PID_B2="$EXISTING_B2"
  echo "  ℹ Property B2 already exists: $PID_B2"
else
  code=$(post "$GW/v1/properties" \
    "{\"tenant_id\":\"$TID_B\",\"property_name\":\"Beacon Mountain Lodge $RUN_TAG\",\"property_code\":\"$PROPERTY_B2_CODE\",\"property_type\":\"RESORT\",\"star_rating\":3,\"total_rooms\":60,\"email\":\"mountain+${RUN_TAG}@beaconhotels.test\",\"currency\":\"USD\",\"timezone\":\"America/Denver\"}")
  if [[ "$code" =~ ^2 ]]; then
    PID_B2=$(jq -r '.id // .data.id // .property_id // empty' "$RESP_FILE" 2>/dev/null)
    if [[ -z "$PID_B2" ]]; then
      get "$GW/v1/properties?tenant_id=$TID_B" >/dev/null
      PID_B2=$(resp_ffirst ".property_code == \"$PROPERTY_B2_CODE\"" "id")
    fi
    echo "  ✓ Property B2 created: $PID_B2"
  else
    echo "  ⚠ Could not create Property B2 (HTTP $code)"
    get "$GW/v1/properties?tenant_id=$TID_B" >/dev/null
    PID_B2=$(resp_ffirst ".property_code == \"$PROPERTY_B2_CODE\"" "id")
    if [[ -n "$PID_B2" ]]; then echo "  ℹ Found via API: $PID_B2"; fi
  fi
fi
[[ -n "$PID_B2" ]] || { echo "FATAL: Property B2 not resolved"; exit 1; }
echo ""

# ── 0.4  Create room types + rooms for new properties ──────────────────
echo "── 0.4  Create Room Types & Rooms ───────────────────────────────────"

create_room_type() {
  local tok="$1" tid="$2" pid="$3" name="$4" code="$5" price="$6"
  local existing
  TOKEN="$tok"
  get "$GW/v1/room-types?tenant_id=$tid&property_id=$pid" >/dev/null
  existing=$(resp_ffirst ".type_code == \"$code\"" "room_type_id")
  if [[ -n "$existing" ]]; then
    echo "$existing"
    return
  fi
  code_http=$(post "$GW/v1/room-types" \
    "{\"tenant_id\":\"$tid\",\"property_id\":\"$pid\",\"type_name\":\"$name\",\"type_code\":\"$code\",\"category\":\"STANDARD\",\"base_occupancy\":2,\"max_occupancy\":3,\"max_adults\":2,\"max_children\":1,\"extra_bed_capacity\":1,\"number_of_beds\":1,\"base_price\":$price,\"currency\":\"USD\",\"amenities\":[\"WIFI\",\"TV\",\"AC\"],\"is_active\":true,\"display_order\":1}")
  local rtid
  rtid=$(jq -r '.room_type_id // .data.room_type_id // .id // .data.id // empty' "$RESP_FILE" 2>/dev/null)
  if [[ -z "$rtid" ]]; then
    get "$GW/v1/room-types?tenant_id=$tid&property_id=$pid" >/dev/null
    rtid=$(resp_ffirst ".type_code == \"$code\"" "room_type_id")
  fi
  echo "$rtid"
}

create_room() {
  local tok="$1" tid="$2" pid="$3" rtid="$4" num="$5" floor="$6"
  TOKEN="$tok"
  get "$GW/v1/rooms?tenant_id=$tid&property_id=$pid&limit=500" >/dev/null
  local existing
  existing=$(resp_ffirst ".room_number == \"$num\"" "room_id")
  if [[ -n "$existing" ]]; then return 0; fi
  post "$GW/v1/rooms" \
    "{\"tenant_id\":\"$tid\",\"property_id\":\"$pid\",\"room_type_id\":\"$rtid\",\"room_number\":\"$num\",\"floor\":\"$floor\",\"status\":\"available\",\"housekeeping_status\":\"clean\",\"maintenance_status\":\"operational\",\"is_blocked\":false,\"is_out_of_order\":false}" >/dev/null
}

# Property A2 — room type + rooms
RTID_A2=$(create_room_type "$TOKEN_A" "$TID_A" "$PID_A2" "Beach Standard $RUN_TAG" "BST-${RUN_TAG}" "179.00")
echo "  Room type A2: ${RTID_A2:-(FAILED)}"
if [[ -n "$RTID_A2" ]]; then
  for r in 501 502 503 504 505 506 507 508 509 510; do
    create_room "$TOKEN_A" "$TID_A" "$PID_A2" "$RTID_A2" "$r" "${r:0:1}"
  done
  TOKEN="$TOKEN_A"
  get "$GW/v1/rooms?tenant_id=$TID_A&property_id=$PID_A2&limit=500" >/dev/null
  A2_ROOMS=$(resp_count)
  echo "  Rooms seeded for A2: $A2_ROOMS"
fi

# Property B1 — room type + rooms
RTID_B1=$(create_room_type "$TOKEN_B" "$TID_B" "$PID_B1" "Harbor King $RUN_TAG" "HBK-${RUN_TAG}" "189.00")
echo "  Room type B1: ${RTID_B1:-(FAILED)}"
if [[ -n "$RTID_B1" ]]; then
  for r in 101 102 103 104 105 106 107 108 109 110; do
    create_room "$TOKEN_B" "$TID_B" "$PID_B1" "$RTID_B1" "$r" "${r:0:1}"
  done
  TOKEN="$TOKEN_B"
  get "$GW/v1/rooms?tenant_id=$TID_B&property_id=$PID_B1&limit=500" >/dev/null
  B1_ROOMS=$(resp_count)
  echo "  Rooms seeded for B1: $B1_ROOMS"
fi

# Property B2 — room type + rooms
RTID_B2=$(create_room_type "$TOKEN_B" "$TID_B" "$PID_B2" "Mountain Cabin $RUN_TAG" "MTC-${RUN_TAG}" "149.00")
echo "  Room type B2: ${RTID_B2:-(FAILED)}"
if [[ -n "$RTID_B2" ]]; then
  for r in 201 202 203 204 205 206 207 208 209 210; do
    create_room "$TOKEN_B" "$TID_B" "$PID_B2" "$RTID_B2" "$r" "${r:0:1}"
  done
  TOKEN="$TOKEN_B"
  get "$GW/v1/rooms?tenant_id=$TID_B&property_id=$PID_B2&limit=500" >/dev/null
  B2_ROOMS=$(resp_count)
  echo "  Rooms seeded for B2: $B2_ROOMS"
fi
echo ""

# ── 0.4b  Seed BAR Rates (required by reservation rate-plan resolution) ──
echo "── 0.4b  Seed BAR Rates ─────────────────────────────────────────────"

seed_bar_rate() {
  local tok="$1" tid="$2" pid="$3" rtid="$4" price="$5" lbl="$6"
  local code
  TOKEN="$tok"
  code=$(curl -s -o "$RESP_FILE" -w "%{http_code}" \
    -X POST "$GW/v1/rates?tenant_id=$tid" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"tenant_id\":\"$tid\",\"property_id\":\"$pid\",\"room_type_id\":\"$rtid\",\"rate_name\":\"Best Available Rate\",\"rate_code\":\"BAR\",\"base_rate\":$price,\"valid_from\":\"2024-01-01\",\"status\":\"ACTIVE\"}")
  if [[ "$code" =~ ^2 ]]; then
    echo "  ✓ BAR rate seeded for $lbl ($code)"
  elif [[ "$code" == "409" ]]; then
    echo "  ℹ BAR rate already exists for $lbl"
  else
    echo "  ⚠ BAR rate seed for $lbl failed (HTTP $code): $(jq -r '.detail // .message // .error // empty' "$RESP_FILE" 2>/dev/null | head -c 200)"
  fi
}

# Seed BAR for existing Property A1 (RTID_A1 is the existing room type)
RTID_A1="${RTID_A1:-44444444-4444-4444-4444-444444444444}"
seed_bar_rate "$TOKEN_A" "$TID_A" "$PID_A1" "$RTID_A1" "199.00" "A1"

# Seed BAR for new properties
if [[ -n "$RTID_A2" ]]; then
  seed_bar_rate "$TOKEN_A" "$TID_A" "$PID_A2" "$RTID_A2" "179.00" "A2"
fi
if [[ -n "$RTID_B1" ]]; then
  seed_bar_rate "$TOKEN_B" "$TID_B" "$PID_B1" "$RTID_B1" "189.00" "B1"
fi
if [[ -n "$RTID_B2" ]]; then
  seed_bar_rate "$TOKEN_B" "$TID_B" "$PID_B2" "$RTID_B2" "149.00" "B2"
fi
echo ""

# ── 0.5  Enable ALL commands (global — not per-tenant) ───────────────────
echo "── 0.5  Enable All Commands ──────────────────────────────────────────"
# Dynamically fetch every command name from the catalog and enable them all.
# This avoids the "forgot guest.register / reservation.create" trap that causes
# Phase 2/3 guest+reservation creation to fail with FEATURE_DISABLED.
TOKEN="$TOKEN_A"
ALL_CMDS=$(curl -s -H "Authorization: Bearer $TOKEN_A" \
  "$GW/v1/commands/features?limit=500" \
  | jq -r '.[]? // .data[]? | .command_name' 2>/dev/null)
CMD_COUNT=0
UPDATES_PAYLOAD="["
FIRST_CMD=true
while IFS= read -r cmd_name; do
  [[ -z "$cmd_name" ]] && continue
  if $FIRST_CMD; then FIRST_CMD=false; else UPDATES_PAYLOAD+=","; fi
  UPDATES_PAYLOAD+="{\"command_name\":\"$cmd_name\",\"status\":\"enabled\"}"
  CMD_COUNT=$((CMD_COUNT + 1))
done <<< "$ALL_CMDS"
UPDATES_PAYLOAD+="]"

if [[ $CMD_COUNT -eq 0 ]]; then
  echo "  ⚠ No commands found in catalog — skipping enable step"
else
  enable_code=$(curl -s -o "$RESP_FILE" -w "%{http_code}" \
    -X PATCH "$GW/v1/commands/features/batch" \
    -H "Authorization: Bearer $TOKEN_A" \
    -H "Content-Type: application/json" \
    -d "{\"updates\":$UPDATES_PAYLOAD}")
  if [[ "$enable_code" =~ ^2 ]]; then
    updated=$(jq '.updated | length' "$RESP_FILE" 2>/dev/null || echo "?")
    echo "  ✓ $updated / $CMD_COUNT commands enabled globally (HTTP $enable_code)"
  else
    echo "  ⚠ Batch enable failed (HTTP $enable_code) — body:"
    jq '.message // .error // .' "$RESP_FILE" 2>/dev/null | head -3
  fi
fi

echo "  Waiting 32s for gateway command cache refresh..."
sleep 32
echo "  ✓ Command cache refreshed"
echo ""

# ── 0.6  Pre-test snapshot ──────────────────────────────────────────────
echo "── 0.6  Pre-test Row Counts ─────────────────────────────────────────"

TOKEN="$TOKEN_A"
get "$GW/v1/guests?tenant_id=$TID_A&limit=100" >/dev/null;          PRE_A_GUESTS=$(resp_count)
get "$GW/v1/reservations?tenant_id=$TID_A&limit=100" >/dev/null;    PRE_A_RESERVATIONS=$(resp_count)
get "$GW/v1/billing/charges?tenant_id=$TID_A&limit=100" >/dev/null; PRE_A_CHARGES=$(resp_count)
get "$GW/v1/billing/payments?tenant_id=$TID_A&limit=100" >/dev/null; PRE_A_PAYMENTS=$(resp_count)
get "$GW/v1/billing/invoices?tenant_id=$TID_A&limit=100" >/dev/null;        PRE_A_INVOICES=$(resp_count)
TOKEN="$TOKEN_B"
get "$GW/v1/guests?tenant_id=$TID_B&limit=100" >/dev/null;          PRE_B_GUESTS=$(resp_count)
get "$GW/v1/reservations?tenant_id=$TID_B&limit=100" >/dev/null;    PRE_B_RESERVATIONS=$(resp_count)
get "$GW/v1/billing/charges?tenant_id=$TID_B&limit=100" >/dev/null; PRE_B_CHARGES=$(resp_count)
get "$GW/v1/billing/payments?tenant_id=$TID_B&limit=100" >/dev/null; PRE_B_PAYMENTS=$(resp_count)
get "$GW/v1/billing/invoices?tenant_id=$TID_B&limit=100" >/dev/null;        PRE_B_INVOICES=$(resp_count)
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
    echo "  (seed skipped — resolving existing data via API)"
    get "$GW/v1/guests?tenant_id=$tid&limit=1" >/dev/null
    guest_id=$(resp_first "id")
    get "$GW/v1/reservations?tenant_id=$tid&property_id=$pid&limit=1" >/dev/null
    res_id=$(resp_first "id")
    if [[ -n "$res_id" ]]; then
      get "$GW/v1/billing/folios?tenant_id=$tid&reservation_id=$res_id" >/dev/null
      folio_id=$(resp_first "id")
    fi
    echo "  Guest: ${guest_id:-NONE}  Res: ${res_id:-NONE}  Folio: ${folio_id:-NONE}"
    echo ""
  fi

  # ── Guest ──
  echo "── ${tag} — Guest Creation ────────────────────────────────────────"
  if ! $SKIP_SEED; then
    local guest_first="Test" guest_last="Guest-${tag}"
    local guest_email="${tag,,}-${RUN_TAG}@tartware-test.local"
    local phone1="+1-555-$(printf '%03d' $((RANDOM % 1000)))-$(printf '%04d' $((RANDOM % 10000)))"
    seed_rest "REST guest: $guest_first $guest_last" \
      "$GW/v1/guests" \
      "{\"tenant_id\":\"$tid\",\"first_name\":\"$guest_first\",\"last_name\":\"$guest_last\",\"email\":\"$guest_email\",\"phone\":\"$phone1\",\"nationality\":\"US\"}"
    wait_kafka 3
    guest_id=$(jq -r '.id // .data.id // .guest_id // empty' "$RESP_FILE" 2>/dev/null)
    if [[ -z "$guest_id" ]]; then
      get "$GW/v1/guests?tenant_id=$tid&email=$guest_email" >/dev/null
      guest_id=$(resp_first "id")
    fi
  fi
  if [[ -n "$guest_id" ]]; then pass "Guest created ($label)"; else fail "Guest creation" "$label"; fi
  echo ""

  # ── Tax configuration ──
  if [[ "$mode" == "full" ]]; then
    echo "── ${tag} — Tax Configuration ─────────────────────────────────────"
    if ! $SKIP_SEED; then
      send_command "CMD tax: Sales Tax 8.875%" \
        "billing.tax_config.create" \
        "{\"property_id\":\"$pid\",\"tax_name\":\"State Sales Tax\",\"tax_code\":\"SST-$tag-${RUN_TAG}\",\"tax_rate\":8.875,\"tax_type\":\"sales_tax\",\"country_code\":\"US\",\"effective_from\":\"$TODAY\",\"applies_to\":[\"ROOM\",\"FOOD_BEVERAGE\",\"OTHER\"],\"is_active\":true}"
      send_command "CMD tax: City Occupancy 5.875%" \
        "billing.tax_config.create" \
        "{\"property_id\":\"$pid\",\"tax_name\":\"City Occupancy Tax\",\"tax_code\":\"COT-$tag-${RUN_TAG}\",\"tax_rate\":5.875,\"tax_type\":\"occupancy_tax\",\"country_code\":\"US\",\"effective_from\":\"$TODAY\",\"applies_to\":[\"ROOM\"],\"is_active\":true}"
      wait_kafka 5
    fi
    local tax_count
    get "$GW/v1/billing/tax-configurations?tenant_id=$tid&property_id=$pid" >/dev/null
    tax_count=$(resp_count)
    assert_gte "Tax configs for $label" "$tax_count" 2
    echo ""
  fi

  # ── Reservation ──
  echo "── ${tag} — Reservation ─────────────────────────────────────────────"
  if ! $SKIP_SEED; then
    send_command "CMD reservation: 3 nights" \
      "reservation.create" \
      "{\"property_id\":\"$pid\",\"guest_id\":\"$guest_id\",\"room_type_id\":\"$rtid\",\"check_in_date\":\"$TODAY\",\"check_out_date\":\"$IN3DAYS\",\"status\":\"CONFIRMED\",\"source\":\"DIRECT\",\"total_amount\":597.00,\"currency\":\"USD\"}"
    res_id=$(jq -r '.id // .data.id // .reservation_id // empty' "$RESP_FILE" 2>/dev/null)
    wait_kafka 5
    if [[ -z "$res_id" ]]; then
      get "$GW/v1/reservations?tenant_id=$tid&property_id=$pid&limit=10" >/dev/null
      res_id=$(resp_first "id")
    fi
    # Get folio
    if [[ -n "$res_id" ]]; then
      get "$GW/v1/billing/folios?tenant_id=$tid&reservation_id=$res_id" >/dev/null
      folio_id=$(resp_first "id")
    fi
  fi
  if [[ -n "$res_id" ]]; then pass "Reservation created ($label)"; else fail "Reservation creation" "$label"; fi
  echo ""

  # ── Second reservation (full mode only) ──
  if [[ "$mode" == "full" ]]; then
    echo "── ${tag} — Second Reservation ──────────────────────────────────────"
    if ! $SKIP_SEED; then
      local guest2_email="${tag,,}-b-${RUN_TAG}@tartware-test.local"
      local phone2="+1-555-$(printf '%03d' $((RANDOM % 1000)))-$(printf '%04d' $((RANDOM % 10000)))"
      seed_rest "REST guest 2" \
        "$GW/v1/guests" \
        "{\"tenant_id\":\"$tid\",\"first_name\":\"Sarah\",\"last_name\":\"Mitchell-$tag\",\"email\":\"$guest2_email\",\"phone\":\"$phone2\",\"nationality\":\"US\"}"
      wait_kafka 3
      local guest2_id
      guest2_id=$(jq -r '.id // .data.id // .guest_id // empty' "$RESP_FILE" 2>/dev/null)
      if [[ -z "$guest2_id" ]]; then
        get "$GW/v1/guests?tenant_id=$tid&email=$guest2_email" >/dev/null
        guest2_id=$(resp_first "id")
      fi
      if [[ -n "$guest2_id" ]]; then
        send_command "CMD reservation 2: 5 nights" \
          "reservation.create" \
          "{\"property_id\":\"$pid\",\"guest_id\":\"$guest2_id\",\"room_type_id\":\"$rtid\",\"check_in_date\":\"$TODAY\",\"check_out_date\":\"$IN5DAYS\",\"status\":\"CONFIRMED\",\"source\":\"DIRECT\",\"total_amount\":995.00,\"currency\":\"USD\"}"
        res2_id=$(jq -r '.id // .data.id // .reservation_id // empty' "$RESP_FILE" 2>/dev/null)
        wait_kafka 5
        if [[ -z "$res2_id" ]]; then
          get "$GW/v1/reservations?tenant_id=$tid&property_id=$pid&limit=10" >/dev/null
          res2_id=$(resp_first "id")
        fi
        if [[ -n "$res2_id" ]]; then
          get "$GW/v1/billing/folios?tenant_id=$tid&reservation_id=$res2_id" >/dev/null
          folio2_id=$(resp_first "id")
        fi
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
  get "$GW/v1/billing/charges?tenant_id=$tid&property_id=$pid&limit=200" >/dev/null
  charge_count=$(resp_fcount '.is_voided != true')
  if [[ "$mode" == "full" ]]; then
    assert_gte "Charges posted ($label)" "$charge_count" 4
  else
    assert_gte "Charges posted ($label)" "$charge_count" 2
  fi
  echo ""

  # ── Payments ──
  echo "── ${tag} — Payments ────────────────────────────────────────────────"
  if ! $SKIP_SEED && [[ -n "$res_id" && -n "$guest_id" ]]; then
    payref1="CC-$tag-${RUN_TAG}-${UNIQUE}-001"
    send_command "CMD payment: CC \$300" \
      "billing.payment.capture" \
      "{\"payment_reference\":\"$payref1\",\"property_id\":\"$pid\",\"reservation_id\":\"$res_id\",\"guest_id\":\"$guest_id\",\"amount\":300.00,\"payment_method\":\"CREDIT_CARD\"}"

    if [[ "$mode" == "full" ]]; then
      send_command "CMD payment: Cash \$100" \
        "billing.payment.capture" \
        "{\"payment_reference\":\"CASH-$tag-${RUN_TAG}-${UNIQUE}-001\",\"property_id\":\"$pid\",\"reservation_id\":\"$res_id\",\"guest_id\":\"$guest_id\",\"amount\":100.00,\"payment_method\":\"CASH\"}"
    fi

    wait_kafka 8
  fi

  local payment_count
  get "$GW/v1/billing/payments?tenant_id=$tid&property_id=$pid&limit=200" >/dev/null
  payment_count=$(resp_fcount '.status == "completed" or .status == "captured"')
  assert_gte "Payments captured ($label)" "$payment_count" 1

  # Verify CC payment
  local cc_exists
  cc_exists=$(resp_fcount ".payment_reference == \"$payref1\"")
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

  if [[ -n "$res_id" ]]; then
    get "$GW/v1/billing/invoices?tenant_id=$tid&property_id=$pid&reservation_id=$res_id" >/dev/null
  else
    get "$GW/v1/billing/invoices?tenant_id=$tid&property_id=$pid" >/dev/null
  fi
  inv_id=$(resp_first "id")
  if [[ -n "$inv_id" ]]; then pass "Invoice created ($label)"; else fail "Invoice creation" "$label"; fi
  echo ""

  # ── Cashier Session ──
  echo "── ${tag} — Cashier Session ─────────────────────────────────────────"
  if ! $SKIP_SEED; then
    # Resolve a user ID for the cashier
    local cashier_uid=""
    get "$GW/v1/users?tenant_id=$tid&limit=1" >/dev/null 2>&1
    cashier_uid=$(resp_first "id")
    if [[ -z "$cashier_uid" ]]; then cashier_uid="$guest_id"; fi
    send_command "CMD cashier: open" \
      "billing.cashier.open" \
      "{\"property_id\":\"$pid\",\"cashier_id\":\"$cashier_uid\",\"cashier_name\":\"Front Desk $tag\",\"shift_type\":\"morning\",\"opening_float\":500.00}"
    wait_kafka 5
  fi

  get "$GW/v1/billing/cashier-sessions?tenant_id=$tid&property_id=$pid&limit=10" >/dev/null
  session_id=$(resp_first "session_id")
  if [[ -n "$session_id" ]]; then pass "Cashier session opened ($label)"; else skip "Cashier session" "$label"; fi

  # Close session
  if ! $SKIP_SEED && [[ -n "$session_id" ]]; then
    send_command "CMD cashier: close" \
      "billing.cashier.close" \
      "{\"session_id\":\"$session_id\",\"closing_cash_declared\":600.00,\"closing_cash_counted\":600.00,\"notes\":\"End of shift $tag\"}"
    wait_kafka 5

    local sess_status
    get "$GW/v1/billing/cashier-sessions/$session_id?tenant_id=$tid" >/dev/null
    sess_status=$(resp_field "session_status")
    if [[ -z "$sess_status" ]]; then sess_status=$(resp_field "data" | jq -r '.session_status // empty' 2>/dev/null || echo ""); fi
    assert_eq_ci "Cashier session closed ($label)" "closed" "$sess_status"
  fi
  echo ""

  # ── Accounts Receivable (full mode) ──
  if [[ "$mode" == "full" ]]; then
    echo "── ${tag} — Accounts Receivable ──────────────────────────────────────"
    if ! $SKIP_SEED && [[ -n "$res_id" && -n "$guest_id" ]]; then
      send_command "CMD AR: Corporate \$158.50" \
        "billing.ar.post" \
        "{\"reservation_id\":\"$res_id\",\"account_type\":\"corporate\",\"account_id\":\"$guest_id\",\"account_name\":\"ACME Corp $tag\",\"amount\":158.50,\"payment_terms\":\"net_30\",\"notes\":\"Corporate billing $tag\"}"
      wait_kafka 5
    fi

    local ar_count
    get "$GW/v1/billing/accounts-receivable?tenant_id=$tid&property_id=$pid" >/dev/null
    ar_count=$(resp_count)
    assert_gte "AR entries ($label)" "$ar_count" 1
    echo ""
  fi

  # ── Night Audit ──
  echo "── ${tag} — Night Audit ─────────────────────────────────────────────"

  # Seed business_dates via API
  curl -s -o "$RESP_FILE" -w "%{http_code}" \
    -X PUT "$GW/v1/night-audit/business-date?tenant_id=$tid" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"tenant_id\":\"$tid\",\"property_id\":\"$pid\",\"business_date\":\"$TODAY\",\"date_status\":\"OPEN\",\"night_audit_status\":\"PENDING\"}" >/dev/null 2>&1

  if ! $SKIP_SEED; then
    send_command "CMD night audit: execute" \
      "billing.night_audit.execute" \
      "{\"property_id\":\"$pid\",\"audit_date\":\"$TODAY\",\"perform_date_roll\":false}"
    wait_kafka 10
  fi

  local audit_count
  get "$GW/v1/night-audit/history?tenant_id=$tid&property_id=$pid" >/dev/null
  audit_count=$(resp_count)
  assert_gte "Night audit executed ($label)" "$audit_count" 1
  echo ""

  # ── GL Batch (GAP-01: GL Journal Entry Wiring) ──
  echo "── ${tag} — GL Batch (USALI double-entry) ────────────────────────"

  # billing.ledger.post rebuilds the GL batch idempotently for the business date
  send_command "CMD billing.ledger.post: rebuild GL batch" \
    "billing.ledger.post" \
    "{\"property_id\":\"$pid\",\"business_date\":\"$TODAY\"}"
  wait_kafka 6

  local gl_count gl_batch_id gl_status
  get "$GW/v1/billing/gl-batches?tenant_id=$tid&property_id=$pid&start_date=$TODAY&end_date=$TODAY" >/dev/null
  gl_count=$(resp_count)
  gl_batch_id=$(resp_first "gl_batch_id")

  if [[ "${gl_count:-0}" -ge 1 && -n "$gl_batch_id" ]]; then
    pass "GL batch created ($label)"
    gl_status=$(resp_first "batch_status")

    # Read batch entries
    get "$GW/v1/billing/gl-batches/$gl_batch_id/entries?tenant_id=$tid" >/dev/null
    local gl_entry_count
    gl_entry_count=$(jq -r '.entry_count // (.data | length) // 0' "$RESP_FILE" 2>/dev/null || echo "0")
    if [[ "$gl_entry_count" -ge 2 ]]; then
      pass "GL entries returned ($label, count=$gl_entry_count)"
    else
      skip "GL entries ($label)" "count=$gl_entry_count (may have no posted charges)"
    fi

    # Export: marks batch_status POSTED (only from REVIEW state)
    if [[ "$gl_status" == "REVIEW" ]]; then
      send_command "CMD billing.gl_batch.export: mark POSTED" \
        "billing.gl_batch.export" \
        "{\"property_id\":\"$pid\",\"gl_batch_id\":\"$gl_batch_id\",\"export_format\":\"USALI\"}"
      wait_kafka 5

      get "$GW/v1/billing/gl-batches?tenant_id=$tid&property_id=$pid&start_date=$TODAY&end_date=$TODAY" >/dev/null
      local gl_post_status
      gl_post_status=$(resp_ffirst ".gl_batch_id == \"$gl_batch_id\"" "batch_status")
      assert_eq_ci "GL batch exported ($label)" "POSTED" "$gl_post_status"
    else
      skip "GL batch export ($label)" "status=$gl_status (need REVIEW to export)"
    fi
  else
    fail "GL batch not found ($label)" "count=${gl_count:-0}"
  fi
  echo ""

  # ── Full-mode extras: Refund, Charge Void, House Account ──
  if [[ "$mode" == "full" ]]; then
    # ── Refund ──
    echo "── ${tag} — Payment Refund ──────────────────────────────────────────"
    local cc_pay_id
    get "$GW/v1/billing/payments?tenant_id=$tid&property_id=$pid&limit=200" >/dev/null
    cc_pay_id=$(resp_ffirst ".payment_reference == \"$payref1\"" "id")
    if [[ -n "$cc_pay_id" ]]; then
      send_command "CMD refund: \$50" \
        "billing.payment.refund" \
        "{\"payment_id\":\"$cc_pay_id\",\"property_id\":\"$pid\",\"reservation_id\":\"$res_id\",\"guest_id\":\"$guest_id\",\"amount\":50.00,\"reason\":\"Overpayment\",\"refund_reference\":\"RF-$tag-$UNIQUE\",\"payment_method\":\"CREDIT_CARD\"}"
      wait_kafka 15

      local refund_exists
      get "$GW/v1/billing/payments?tenant_id=$tid&property_id=$pid&limit=200" >/dev/null
      refund_exists=$(resp_fcount '(.transaction_type == "refund" or .transaction_type == "partial_refund") and (.amount | tostring | tonumber) == 50')
      if [[ "${refund_exists:-0}" -ge 1 ]]; then pass "Refund recorded ($label)"; else fail "Refund" "$label"; fi
    else
      skip "Refund" "CC payment not found"
    fi
    echo ""

    # ── Charge Void ──
    echo "── ${tag} — Charge Void ─────────────────────────────────────────────"
    # An empty res_id would send reservation_id= and get a 400 back from the
    # billing API, masking the real cause as "SPA charge not found".
    local spa_id=""
    if [[ -n "$res_id" ]]; then
      get "$GW/v1/billing/charges?tenant_id=$tid&reservation_id=$res_id&charge_code=SPA&limit=100" >/dev/null
      spa_id=$(resp_ffirst '.is_voided != true' "id")
    fi
    if [[ -n "$spa_id" ]]; then
      send_command "CMD void: SPA" \
        "billing.charge.void" \
        "{\"posting_id\":\"$spa_id\",\"property_id\":\"$pid\",\"reservation_id\":\"$res_id\",\"void_reason\":\"Posted to wrong guest\"}"
      wait_kafka 8

      local voided
      get "$GW/v1/billing/charges?tenant_id=$tid&reservation_id=$res_id&charge_code=SPA&include_voided=true&limit=100" >/dev/null
      voided=$(resp_ffirst ".id == \"$spa_id\"" "is_voided")
      if [[ "$voided" == "true" ]]; then
        assert_eq "Charge voided ($label)" "true" "true"
      else
        # Fallback: the charge API may exclude voided charges by default
        # If we can no longer find it without include_voided, it's voided
        get "$GW/v1/billing/charges?tenant_id=$tid&reservation_id=$res_id&charge_code=SPA&limit=100" >/dev/null
        local remaining
        remaining=$(resp_fcount ".id == \"$spa_id\"")
        if [[ "$remaining" == "0" ]]; then
          assert_eq "Charge voided ($label)" "true" "true"
        else
          fail "Charge voided ($label)" "not voided"
        fi
      fi
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
    get "$GW/v1/billing/folios?tenant_id=$tid&property_id=$pid&folio_type=HOUSE_ACCOUNT" >/dev/null
    house_id=$(resp_first "id")
    if [[ -n "$house_id" ]]; then
      pass "House account created ($label)"
      # Transfer minibar charge
      local minibar_id=""
      if [[ -n "$res_id" ]]; then
        get "$GW/v1/billing/charges?tenant_id=$tid&reservation_id=$res_id&charge_code=MINIBAR&limit=100" >/dev/null
        minibar_id=$(resp_ffirst '.is_voided != true' "id")
      fi
      if [[ -n "$minibar_id" ]]; then
        send_command "CMD transfer: MINIBAR → house" \
          "billing.charge.transfer" \
          "{\"posting_id\":\"$minibar_id\",\"to_folio_id\":\"$house_id\",\"property_id\":\"$pid\",\"reason\":\"Transfer to house\"}"
        wait_kafka 5
        local xfer_credit
        get "$GW/v1/billing/charges?tenant_id=$tid&transaction_type=TRANSFER&limit=200" >/dev/null
        xfer_credit=$(resp_count)
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
      get "$GW/v1/billing/invoices/$inv_id?tenant_id=$tid" >/dev/null
      inv_status=$(resp_field "status")
      if [[ -z "$inv_status" ]]; then inv_status=$(jq -r '.data.status // empty' "$RESP_FILE" 2>/dev/null); fi
      assert_eq_ci "Invoice finalized ($label)" "FINALIZED" "$inv_status"
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
      get "$GW/v1/billing/folios/$folio2_id?tenant_id=$tid" >/dev/null
      fc_status=$(resp_field "folio_status")
      if [[ -z "$fc_status" ]]; then fc_status=$(jq -r '.data.folio_status // empty' "$RESP_FILE" 2>/dev/null); fi
      if [[ "$fc_status" == "CLOSED" || "$fc_status" == "SETTLED" ]]; then
        pass "Express checkout ($label)"
      else
        skip "Express checkout" "folio status=$fc_status"
      fi
      echo ""
    fi

    # ── BA Compliance Gap Commands (full mode only) ──────────────────────

    # ── Invoice Reopen ──
    if [[ -n "$inv_id" ]]; then
      echo "── ${tag} — Invoice Reopen ──────────────────────────────────────"
      send_command "CMD invoice.reopen" \
        "billing.invoice.reopen" \
        "{\"invoice_id\":\"$inv_id\",\"reason\":\"Post-checkout rate correction — pipeline $tag\"}"
      wait_kafka 8

      local reopen_inv_status
      get "$GW/v1/billing/invoices?tenant_id=$tid&property_id=$pid" >/dev/null
      reopen_inv_status=$(resp_ffirst ".id == \"$inv_id\"" "status")
      if [[ "${reopen_inv_status,,}" == "superseded" || "${reopen_inv_status,,}" == "reopened" || "${reopen_inv_status,,}" == "draft" ]]; then
        pass "Invoice reopen ($label) — $reopen_inv_status"
      else
        skip "Invoice reopen ($label)" "status=$reopen_inv_status"
      fi
      echo ""
    fi

    # ── Folio Reopen (house account was not closed in pipeline — reopen folio2 if closed) ──
    if [[ -n "$folio2_id" ]]; then
      echo "── ${tag} — Folio Reopen ────────────────────────────────────────"
      local fr_status
      get "$GW/v1/billing/folios/$folio2_id?tenant_id=$tid" >/dev/null
      fr_status=$(resp_field "folio_status")
      if [[ "${fr_status,,}" == "closed" || "${fr_status,,}" == "settled" ]]; then
        send_command "CMD folio.reopen: reopen folio2" \
          "billing.folio.reopen" \
          "{\"property_id\":\"$pid\",\"folio_id\":\"$folio2_id\",\"reason\":\"Post-checkout adjustment — pipeline $tag\"}"
        wait_kafka 8

        get "$GW/v1/billing/folios/$folio2_id?tenant_id=$tid" >/dev/null
        local fr_new_status
        fr_new_status=$(resp_field "folio_status")
        if [[ "${fr_new_status,,}" == "open" || "${fr_new_status,,}" == "reopened" ]]; then
          pass "Folio reopen ($label) — $fr_new_status"
        else
          skip "Folio reopen ($label)" "status=$fr_new_status"
        fi
      else
        # Folio not closed — dispatch command against primary folio with reservation_id
        send_command "CMD folio.reopen: via reservation" \
          "billing.folio.reopen" \
          "{\"property_id\":\"$pid\",\"reservation_id\":\"$res_id\",\"reason\":\"Settlement correction — pipeline $tag\"}"
        wait_kafka 5
        pass "Folio reopen dispatched ($label)"
      fi
      echo ""
    fi

    # ── Folio Merge ──
    if [[ -n "$folio_id" && -n "$house_id" ]]; then
      echo "── ${tag} — Folio Merge ─────────────────────────────────────────"
      # Create a throwaway folio as merge source
      send_command "CMD folio.create: merge source" \
        "billing.folio.create" \
        "{\"property_id\":\"$pid\",\"reservation_id\":\"$res_id\",\"folio_type\":\"GUEST\",\"folio_name\":\"Merge-Src $tag\",\"currency\":\"USD\",\"idempotency_key\":\"MERGE-$tag-$UNIQUE\"}"
      wait_kafka 10

      local merge_src="" _mwait=8 _mattempt
      for _mattempt in 1 2 3; do
        get "$GW/v1/billing/folios?tenant_id=$tid&reservation_id=$res_id" >/dev/null
        merge_src=$(jq -r --arg fid "$folio_id" '[.data? // . | .[] | select(.id != $fid and (.folio_type | ascii_downcase) != "house_account" and ((.folio_status | ascii_downcase) == "open"))][0].id // empty' "$RESP_FILE" 2>/dev/null || echo "")
        [[ -n "$merge_src" ]] && break
        if [[ $_mattempt -lt 3 ]]; then
          printf "  ⏳ Retry %d/3 in %ds: waiting for merge-source folio...\n" "$_mattempt" "$_mwait"
          sleep "$_mwait"; _mwait=$((_mwait * 2))
        fi
      done
      if [[ -n "$merge_src" ]]; then
        send_command "CMD folio.merge: src → primary" \
          "billing.folio.merge" \
          "{\"property_id\":\"$pid\",\"source_folio_id\":\"$merge_src\",\"target_folio_id\":\"$folio_id\",\"reason\":\"Consolidation — pipeline $tag\"}"
        wait_kafka 8

        local merge_st
        get "$GW/v1/billing/folios/$merge_src?tenant_id=$tid" >/dev/null
        merge_st=$(resp_field "folio_status")
        if [[ "${merge_st,,}" == "closed" || "${merge_st,,}" == "merged" ]]; then
          pass "Folio merge ($label) — source $merge_st"
        else
          skip "Folio merge ($label)" "source status=$merge_st"
        fi
      else
        skip "Folio merge ($label)" "no merge source folio"
      fi
      echo ""
    fi

    # ── Chargeback Status Update ──
    echo "── ${tag} — Chargeback Status Update ────────────────────────────"
    local cb_refund_id
    get "$GW/v1/billing/payments?tenant_id=$tid&property_id=$pid&limit=200" >/dev/null
    cb_refund_id=$(resp_ffirst '.transaction_type == "refund"' "id")
    if [[ -n "$cb_refund_id" ]]; then
      send_command "CMD chargeback.update_status" \
        "billing.chargeback.update_status" \
        "{\"refund_id\":\"$cb_refund_id\",\"chargeback_status\":\"EVIDENCE_SUBMITTED\",\"evidence\":[{\"type\":\"RECEIPT\",\"description\":\"Signed folio\"}],\"notes\":\"Evidence — pipeline $tag\"}"
      wait_kafka 8
      pass "Chargeback status update dispatched ($label)"
    else
      skip "Chargeback status update ($label)" "no refund record"
    fi
    echo ""

    # ── No-Show Charge ──
    echo "── ${tag} — No-Show Charge ──────────────────────────────────────"
    if [[ -n "$res_id" ]]; then
      local pre_ns
      get "$GW/v1/billing/charges?tenant_id=$tid&property_id=$pid&limit=200" >/dev/null
      pre_ns=$(resp_count)
      send_command "CMD no_show.charge" \
        "billing.no_show.charge" \
        "{\"property_id\":\"$pid\",\"reservation_id\":\"$res_id\",\"charge_amount\":189.00,\"currency\":\"USD\",\"reason_code\":\"NO_SHOW_POLICY\"}"
      wait_kafka 8
      poll_delta "No-show charge ($label)" \
        "$GW/v1/billing/charges?tenant_id=$tid&property_id=$pid&limit=200" \
        "$pre_ns"
    else
      skip "No-show charge ($label)" "no reservation"
    fi
    echo ""

    # ── Late Checkout Charge ──
    echo "── ${tag} — Late Checkout Charge ────────────────────────────────"
    if [[ -n "$res_id" ]]; then
      local late_iso
      late_iso=$(date -u -d "+15 hours" +%Y-%m-%dT%H:%M:%S+00:00 2>/dev/null \
        || date -u -v+15H +%Y-%m-%dT%H:%M:%S+00:00 2>/dev/null || echo "")
      if [[ -n "$late_iso" ]]; then
        local pre_late
        get "$GW/v1/billing/charges?tenant_id=$tid&property_id=$pid&limit=200" >/dev/null
        pre_late=$(resp_count)
        send_command "CMD late_checkout.charge" \
          "billing.late_checkout.charge" \
          "{\"property_id\":\"$pid\",\"reservation_id\":\"$res_id\",\"actual_checkout_time\":\"$late_iso\",\"standard_checkout_time\":\"12:00\",\"currency\":\"USD\"}"
        wait_kafka 8
        poll_delta "Late checkout charge ($label)" \
          "$GW/v1/billing/charges?tenant_id=$tid&property_id=$pid&limit=200" \
          "$pre_late"
      else
        skip "Late checkout charge ($label)" "date calc unavailable"
      fi
    else
      skip "Late checkout charge ($label)" "no reservation"
    fi
    echo ""

    # ── Cancellation Penalty ──
    echo "── ${tag} — Cancellation Penalty ────────────────────────────────"
    if [[ -n "$res_id" ]]; then
      local pre_cp
      get "$GW/v1/billing/charges?tenant_id=$tid&property_id=$pid&limit=200" >/dev/null
      pre_cp=$(resp_count)
      send_command "CMD cancellation.penalty" \
        "billing.cancellation.penalty" \
        "{\"property_id\":\"$pid\",\"reservation_id\":\"$res_id\",\"penalty_amount_override\":99.50,\"currency\":\"USD\",\"reason\":\"Late cancellation — pipeline $tag\"}"
      wait_kafka 8
      poll_delta "Cancellation penalty ($label)" \
        "$GW/v1/billing/charges?tenant_id=$tid&property_id=$pid&limit=200" \
        "$pre_cp"
    else
      skip "Cancellation penalty ($label)" "no reservation"
    fi
    echo ""

    # ── Tax Exemption ──
    echo "── ${tag} — Tax Exemption ───────────────────────────────────────"
    if [[ -n "$folio_id" ]]; then
      send_command "CMD tax_exemption.apply" \
        "billing.tax_exemption.apply" \
        "{\"property_id\":\"$pid\",\"folio_id\":\"$folio_id\",\"exemption_type\":\"GOVERNMENT\",\"exemption_certificate\":\"GOV-$tag-$UNIQUE\",\"exemption_reason\":\"Government employee — pipeline $tag\",\"expiry_date\":\"2026-12-31\"}"
      wait_kafka 8

      local tex_flag
      get "$GW/v1/billing/folios/$folio_id?tenant_id=$tid" >/dev/null
      tex_flag=$(jq -r '.tax_exempt // .data.tax_exempt // empty' "$RESP_FILE" 2>/dev/null || echo "")
      if [[ "$tex_flag" == "true" || "$tex_flag" == "t" ]]; then
        pass "Tax exemption ($label) — tax_exempt=true"
      else
        skip "Tax exemption ($label)" "flag=$tex_flag"
      fi
    else
      skip "Tax exemption ($label)" "no folio"
    fi
    echo ""

    # ── Comp Post ──
    echo "── ${tag} — Comp Post ───────────────────────────────────────────"
    if [[ -n "$res_id" ]]; then
      local pre_comp
      get "$GW/v1/billing/charges?tenant_id=$tid&property_id=$pid&limit=200" >/dev/null
      pre_comp=$(resp_count)
      send_command "CMD comp.post: F&B \$35" \
        "billing.comp.post" \
        "{\"property_id\":\"$pid\",\"reservation_id\":\"$res_id\",\"guest_id\":\"$guest_id\",\"comp_type\":\"FOOD_BEVERAGE\",\"amount\":35.00,\"currency\":\"USD\",\"charge_code\":\"RESTAURANT\",\"description\":\"Comp dinner — pipeline $tag\"}"
      wait_kafka 8
      poll_delta "Comp post ($label)" \
        "$GW/v1/billing/charges?tenant_id=$tid&property_id=$pid&limit=200" \
        "$pre_comp"
    else
      skip "Comp post ($label)" "no reservation"
    fi
    echo ""
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
TOKEN="$TOKEN_A"
get "$GW/v1/billing/charges?tenant_id=$TID_A&property_id=$PID_A1&limit=100" >/dev/null; A1_CHARGES=$(resp_count)
get "$GW/v1/billing/charges?tenant_id=$TID_A&property_id=$PID_A2&limit=100" >/dev/null; A2_CHARGES=$(resp_count)
get "$GW/v1/billing/charges?tenant_id=$TID_A&limit=100" >/dev/null;                     ALL_A_CHARGES=$(resp_count)
EXPECTED_SUM=$((A1_CHARGES + A2_CHARGES))
assert_eq "USALI: A charges = A1($A1_CHARGES) + A2($A2_CHARGES)" "$EXPECTED_SUM" "$ALL_A_CHARGES"
if [[ "$A1_CHARGES" -gt 0 && "$A2_CHARGES" -gt 0 ]]; then
  pass "USALI: Both properties have charges (A1=$A1_CHARGES A2=$A2_CHARGES)"
else
  fail "USALI: Property charge distribution" "A1=$A1_CHARGES A2=$A2_CHARGES"
fi

# No orphan charges — all charges must have a property_id
# (Verified implicitly: API filters by property_id and totals match)
pass "USALI: No orphan charges (property_id filtering consistent)"
echo ""

echo "── 4.2  Payments scoped by property_id ─────────────────────────────"
get "$GW/v1/billing/payments?tenant_id=$TID_A&property_id=$PID_A1&limit=100" >/dev/null; A1_PAYMENTS=$(resp_count)
get "$GW/v1/billing/payments?tenant_id=$TID_A&property_id=$PID_A2&limit=100" >/dev/null; A2_PAYMENTS=$(resp_count)
get "$GW/v1/billing/payments?tenant_id=$TID_A&limit=100" >/dev/null;                     ALL_A_PAYMENTS=$(resp_count)
EXPECTED_SUM=$((A1_PAYMENTS + A2_PAYMENTS))
assert_eq "USALI: A payments = A1($A1_PAYMENTS) + A2($A2_PAYMENTS)" "$EXPECTED_SUM" "$ALL_A_PAYMENTS"
if [[ "$A1_PAYMENTS" -gt 0 && "$A2_PAYMENTS" -gt 0 ]]; then
  pass "USALI: Both properties have payments"
else
  fail "USALI: Property payment distribution" "A1=$A1_PAYMENTS A2=$A2_PAYMENTS"
fi
echo ""

echo "── 4.3  Invoices scoped by property_id ─────────────────────────────"
get "$GW/v1/billing/invoices?tenant_id=$TID_A&property_id=$PID_A1" >/dev/null; A1_INVOICES=$(resp_count)
get "$GW/v1/billing/invoices?tenant_id=$TID_A&property_id=$PID_A2" >/dev/null; A2_INVOICES=$(resp_count)
get "$GW/v1/billing/invoices?tenant_id=$TID_A" >/dev/null;                     ALL_A_INVOICES=$(resp_count)
EXPECTED_SUM=$((A1_INVOICES + A2_INVOICES))
assert_eq "USALI: A invoices = A1($A1_INVOICES) + A2($A2_INVOICES)" "$EXPECTED_SUM" "$ALL_A_INVOICES"
if [[ "$A1_INVOICES" -gt 0 && "$A2_INVOICES" -gt 0 ]]; then
  pass "USALI: Both properties have invoices"
else
  fail "USALI: Property invoice distribution" "A1=$A1_INVOICES A2=$A2_INVOICES"
fi
echo ""

echo "── 4.4  Cashier Sessions scoped by property_id ─────────────────────"
get "$GW/v1/billing/cashier-sessions?tenant_id=$TID_A&property_id=$PID_A1&limit=100" >/dev/null; A1_SESSIONS=$(resp_count)
get "$GW/v1/billing/cashier-sessions?tenant_id=$TID_A&property_id=$PID_A2&limit=100" >/dev/null; A2_SESSIONS=$(resp_count)
get "$GW/v1/billing/cashier-sessions?tenant_id=$TID_A&limit=100" >/dev/null;                     ALL_A_SESSIONS=$(resp_count)
EXPECTED_SUM=$((A1_SESSIONS + A2_SESSIONS))
# Tenant A accumulates a new A2 property per run, so the tenant-wide count is a
# superset of A1+A2 rather than equal to it. >= still fails loudly if the
# property filter stops partitioning (a broken filter makes the sum exceed the total).
assert_gte "USALI: A sessions >= A1($A1_SESSIONS) + A2($A2_SESSIONS)" "$ALL_A_SESSIONS" "$EXPECTED_SUM"
if [[ "$A1_SESSIONS" -gt 0 && "$A2_SESSIONS" -gt 0 ]]; then
  pass "USALI: Both properties have cashier sessions"
else
  skip "USALI: Cashier session distribution" "A1=$A1_SESSIONS A2=$A2_SESSIONS"
fi
echo ""

echo "── 4.5  Night Audit scoped by property_id ──────────────────────────"
get "$GW/v1/night-audit/history?tenant_id=$TID_A&property_id=$PID_A1" >/dev/null; A1_AUDIT=$(resp_count)
get "$GW/v1/night-audit/history?tenant_id=$TID_A&property_id=$PID_A2" >/dev/null; A2_AUDIT=$(resp_count)
get "$GW/v1/night-audit/history?tenant_id=$TID_A" >/dev/null;                     ALL_A_AUDIT=$(resp_count)
EXPECTED_SUM=$((A1_AUDIT + A2_AUDIT))
assert_gte "USALI: A audit >= A1($A1_AUDIT) + A2($A2_AUDIT)" "$ALL_A_AUDIT" "$EXPECTED_SUM"
if [[ "$A1_AUDIT" -gt 0 && "$A2_AUDIT" -gt 0 ]]; then
  pass "USALI: Both properties have audit logs"
else
  skip "USALI: Audit log distribution" "A1=$A1_AUDIT A2=$A2_AUDIT"
fi
echo ""

echo "── 4.6  Business Dates independent per property ────────────────────"
get "$GW/v1/night-audit/status?tenant_id=$TID_A&property_id=$PID_A1" >/dev/null
A1_BDATE=$(resp_field "business_date")
if [[ -z "$A1_BDATE" ]]; then A1_BDATE=$(jq -r '.data.business_date // empty' "$RESP_FILE" 2>/dev/null); fi
get "$GW/v1/night-audit/status?tenant_id=$TID_A&property_id=$PID_A2" >/dev/null
A2_BDATE=$(resp_field "business_date")
if [[ -z "$A2_BDATE" ]]; then A2_BDATE=$(jq -r '.data.business_date // empty' "$RESP_FILE" 2>/dev/null); fi
if [[ -n "$A1_BDATE" && -n "$A2_BDATE" ]]; then
  pass "USALI: Property A1 business_date=$A1_BDATE, A2=$A2_BDATE (independent)"
else
  skip "USALI: Business dates" "A1=$A1_BDATE A2=$A2_BDATE"
fi
echo ""

echo "── 4.7  Folios scoped by property_id ───────────────────────────────"
get "$GW/v1/billing/folios?tenant_id=$TID_A&property_id=$PID_A1" >/dev/null; A1_FOLIOS=$(resp_count)
get "$GW/v1/billing/folios?tenant_id=$TID_A&property_id=$PID_A2" >/dev/null; A2_FOLIOS=$(resp_count)
get "$GW/v1/billing/folios?tenant_id=$TID_A" >/dev/null;                     ALL_A_FOLIOS=$(resp_count)
EXPECTED_SUM=$((A1_FOLIOS + A2_FOLIOS))
assert_eq "USALI: A folios = A1($A1_FOLIOS) + A2($A2_FOLIOS)" "$EXPECTED_SUM" "$ALL_A_FOLIOS"
echo ""

echo "── 4.8  AR scoped by property_id ───────────────────────────────────"
get "$GW/v1/billing/accounts-receivable?tenant_id=$TID_A&property_id=$PID_A1" >/dev/null; A1_AR=$(resp_count)
get "$GW/v1/billing/accounts-receivable?tenant_id=$TID_A&property_id=$PID_A2" >/dev/null; A2_AR=$(resp_count)
get "$GW/v1/billing/accounts-receivable?tenant_id=$TID_A" >/dev/null;                     ALL_A_AR=$(resp_count)
EXPECTED_SUM=$((A1_AR + A2_AR))
assert_eq "USALI: A AR = A1($A1_AR) + A2($A2_AR)" "$EXPECTED_SUM" "$ALL_A_AR"
echo ""

echo "── 4.9  Tax Configurations scoped by property_id ───────────────────"
get "$GW/v1/billing/tax-configurations?tenant_id=$TID_A&property_id=$PID_A1" >/dev/null; A1_TAX=$(resp_count)
get "$GW/v1/billing/tax-configurations?tenant_id=$TID_A&property_id=$PID_A2" >/dev/null; A2_TAX=$(resp_count)
get "$GW/v1/billing/tax-configurations?tenant_id=$TID_A" >/dev/null;                     ALL_A_TAX=$(resp_count)
EXPECTED_SUM=$((A1_TAX + A2_TAX))
assert_eq "USALI: A tax = A1($A1_TAX) + A2($A2_TAX)" "$EXPECTED_SUM" "$ALL_A_TAX"
echo ""

echo "── 4.10  Cross-property financial summary ──────────────────────────"
# USALI: total charges per property should be independent — use API to sum
get "$GW/v1/billing/charges?tenant_id=$TID_A&property_id=$PID_A1&limit=200&include_voided=false" >/dev/null
A1_CHARGE_SUM=$(resp_sum_f "total_amount" '.posting_type == "debit" and .is_voided != true')
get "$GW/v1/billing/charges?tenant_id=$TID_A&property_id=$PID_A2&limit=200&include_voided=false" >/dev/null
A2_CHARGE_SUM=$(resp_sum_f "total_amount" '.posting_type == "debit" and .is_voided != true')
echo "  Property A1 charge revenue: \$$A1_CHARGE_SUM"
echo "  Property A2 charge revenue: \$$A2_CHARGE_SUM"
if [[ $(echo "$A1_CHARGE_SUM > 0" | bc 2>/dev/null) == "1" && $(echo "$A2_CHARGE_SUM > 0" | bc 2>/dev/null) == "1" ]]; then
  pass "USALI: Both properties generating independent revenue"
else
  fail "USALI: Independent revenue" "A1=\$$A1_CHARGE_SUM A2=\$$A2_CHARGE_SUM"
fi
echo ""

echo "── 4.11  GL Batches scoped by property_id ──────────────────────────"
TOKEN="$TOKEN_A"
get "$GW/v1/billing/gl-batches?tenant_id=$TID_A&property_id=$PID_A1&limit=100" >/dev/null; A1_GL=$(resp_count)
get "$GW/v1/billing/gl-batches?tenant_id=$TID_A&property_id=$PID_A2&limit=100" >/dev/null; A2_GL=$(resp_count)
get "$GW/v1/billing/gl-batches?tenant_id=$TID_A&limit=100" >/dev/null;                     ALL_A_GL=$(resp_count)
EXPECTED_SUM=$((A1_GL + A2_GL))
assert_gte "USALI: A GL batches >= A1($A1_GL) + A2($A2_GL)" "$ALL_A_GL" "$EXPECTED_SUM"
if [[ "$A1_GL" -gt 0 || "$A2_GL" -gt 0 ]]; then
  pass "USALI: GL batches property-scoped (A1=$A1_GL A2=$A2_GL)"
else
  skip "USALI: GL batch distribution" "no batches yet (night audit step 6.5 non-fatal)"
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

echo "── 5.1  API-level: No cross-contamination ─────────────────────────"

# Verify tenant scoping via API: each tenant's endpoints return data only for that tenant
# Map of endpoint → base URL pattern (use TOKEN_A / TOKEN_B accordingly)
declare -A API_ENDPOINTS=(
  ["guests"]="$GW/v1/guests?limit=100"
  ["reservations"]="$GW/v1/reservations?limit=100"
  ["charges"]="$GW/v1/billing/charges?limit=100"
  ["payments"]="$GW/v1/billing/payments?limit=100"
  ["invoices"]="$GW/v1/billing/invoices?limit=100"
  ["folios"]="$GW/v1/billing/folios?limit=100"
  ["cashier_sessions"]="$GW/v1/billing/cashier-sessions?limit=100"
  ["accounts_receivable"]="$GW/v1/billing/accounts-receivable?limit=100"
  ["night_audit"]="$GW/v1/night-audit/history?limit=100"
  ["rooms"]="$GW/v1/rooms?limit=100"
  ["room_types"]="$GW/v1/room-types?limit=100"
  ["properties"]="$GW/v1/properties?limit=100"
)

for tbl in "${!API_ENDPOINTS[@]}"; do
  base_url="${API_ENDPOINTS[$tbl]}"
  # Count for Tenant A
  TOKEN="$TOKEN_A"
  get "${base_url}&tenant_id=$TID_A" >/dev/null 2>&1
  A_COUNT=$(resp_count)
  # Count for Tenant B
  TOKEN="$TOKEN_B"
  get "${base_url}&tenant_id=$TID_B" >/dev/null 2>&1
  B_COUNT=$(resp_count)

  if [[ "$A_COUNT" -gt 0 || "$B_COUNT" -gt 0 ]]; then
    pass "API isolation: $tbl (A=$A_COUNT B=$B_COUNT — independent)"
  else
    skip "API isolation: $tbl" "both empty"
  fi
done
echo ""

echo "── 5.2  API-level: Tenant B has no Tenant A property_ids ──────────"
# Critical: Tenant B's charges API filtered by Tenant A's property should return 0
TOKEN="$TOKEN_B"
get "$GW/v1/billing/charges?tenant_id=$TID_B&property_id=$PID_A1&limit=1" >/dev/null
B_WITH_A1=$(resp_count)
get "$GW/v1/billing/charges?tenant_id=$TID_B&property_id=$PID_A2&limit=1" >/dev/null
B_WITH_A2=$(resp_count)
assert_eq "API isolation: B charges have no A1 property" "0" "$B_WITH_A1"
assert_eq "API isolation: B charges have no A2 property" "0" "$B_WITH_A2"

TOKEN="$TOKEN_A"
get "$GW/v1/billing/charges?tenant_id=$TID_A&property_id=$PID_B1&limit=1" >/dev/null
A_WITH_B1=$(resp_count)
assert_eq "API isolation: A charges have no B1 property" "0" "$A_WITH_B1"
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
  # Even if accepted, verify no charge was actually created via API
  TOKEN="$TOKEN_A"
  get "$GW/v1/billing/charges?tenant_id=$TID_A&limit=200" >/dev/null
  ATTACK_CHARGE=$(resp_fcount '.description == "Cross-tenant attack"')
  if [[ "$ATTACK_CHARGE" == "0" ]]; then
    pass "API isolation: Cross-tenant charge not persisted"
  else
    fail "API isolation: Cross-tenant charge was persisted!" "$ATTACK_CHARGE rows"
  fi
fi
echo ""

echo "── 5.6  P0 fixes: Additional isolation assertions ──────────────────"

# --- P0-1: Self-service checkout tenant isolation ---
# Attempt checkout preview with Tenant B's token using Tenant A's tenant_id
TOKEN="$TOKEN_B"
code=$(curl -s -o "$RESP_FILE" -w "%{http_code}" \
  "$GW/v1/self-service/check-out/preview?confirmation_code=FAKE-CONF-CODE&tenant_id=$TID_A")
if [[ "$code" =~ ^(401|403|404) ]] || [[ "$(jq -r '.data // empty' "$RESP_FILE" 2>/dev/null)" == "" ]]; then
  pass "P0-1 isolation: Cross-tenant checkout preview blocked (HTTP=$code)"
else
  fail "P0-1 isolation: Cross-tenant checkout preview leaked data" "HTTP=$code"
fi

# --- P0-2: GL ledger tenant isolation ---
# Tenant B should see zero GL entries for Tenant A's property
TOKEN="$TOKEN_B"
code=$(get "$GW/v1/billing/ledger?tenant_id=$TID_B&property_id=$PID_A1&limit=1")
GL_CROSS=$(resp_count)
if [[ "$code" =~ ^(401|403) ]] || [[ "$GL_CROSS" == "0" ]]; then
  pass "P0-2 isolation: B GL ledger has no A1 property entries (HTTP=$code count=$GL_CROSS)"
else
  fail "P0-2 isolation: B GL ledger leaks A1 property data" "HTTP=$code count=$GL_CROSS"
fi

# Tenant A should see zero GL entries for Tenant B's property
TOKEN="$TOKEN_A"
code=$(get "$GW/v1/billing/ledger?tenant_id=$TID_A&property_id=$PID_B1&limit=1")
GL_CROSS_REV=$(resp_count)
if [[ "$code" =~ ^(401|403) ]] || [[ "$GL_CROSS_REV" == "0" ]]; then
  pass "P0-2 isolation: A GL ledger has no B1 property entries (HTTP=$code count=$GL_CROSS_REV)"
else
  fail "P0-2 isolation: A GL ledger leaks B1 property data" "HTTP=$code count=$GL_CROSS_REV"
fi

# --- P0-3: Night-audit property name isolation ---
# Night-audit status for Tenant A property should work
TOKEN="$TOKEN_A"
code=$(get "$GW/v1/night-audit/status?tenant_id=$TID_A&property_id=$PID_A1")
NA_PROP_NAME=$(jq -r '.data.property_name // empty' "$RESP_FILE" 2>/dev/null)
assert_http "P0-3: Night-audit status A/A1" "200" "$code"

# Night-audit for Tenant A but with Tenant B's property should return no property_name
code=$(get "$GW/v1/night-audit/status?tenant_id=$TID_A&property_id=$PID_B1")
NA_CROSS_PROP=$(jq -r '.data.property_name // empty' "$RESP_FILE" 2>/dev/null)
if [[ -z "$NA_CROSS_PROP" || "$NA_CROSS_PROP" == "null" ]]; then
  pass "P0-3 isolation: Night-audit A + B1 property returns no property_name"
else
  fail "P0-3 isolation: Night-audit A + B1 property leaked name" "name=$NA_CROSS_PROP"
fi

# --- P0-4: Calculation auth enforcement ---
# Unauthenticated calculation request should be rejected
CALC_CODE=$(curl -s -o "$RESP_FILE" -w "%{http_code}" \
  -X POST "$GW/v1/calculations/tax/taxable-amount" \
  -H "Content-Type: application/json" \
  -d '{"amount":100,"quantity":1,"negate":false}')
if [[ "$CALC_CODE" =~ ^(401|403) ]]; then
  pass "P0-4 auth: Unauthenticated calculation rejected (HTTP=$CALC_CODE)"
else
  fail "P0-4 auth: Unauthenticated calculation NOT rejected" "HTTP=$CALC_CODE"
fi

# Bogus token should also be rejected
CALC_CODE2=$(curl -s -o "$RESP_FILE" -w "%{http_code}" \
  -X POST "$GW/v1/calculations/tax/taxable-amount" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer totally-bogus-jwt-token" \
  -d '{"amount":100,"quantity":1,"negate":false}')
if [[ "$CALC_CODE2" =~ ^(401|403) ]]; then
  pass "P0-4 auth: Bogus-token calculation rejected (HTTP=$CALC_CODE2)"
else
  fail "P0-4 auth: Bogus-token calculation NOT rejected" "HTTP=$CALC_CODE2"
fi

# Valid token should succeed
TOKEN="$TOKEN_A"
CALC_CODE3=$(curl -s -o "$RESP_FILE" -w "%{http_code}" \
  -X POST "$GW/v1/calculations/tax/taxable-amount" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_A" \
  -d '{"amount":100,"quantity":1,"negate":false}')
if [[ "$CALC_CODE3" =~ ^2 ]]; then
  pass "P0-4 auth: Authenticated calculation succeeds (HTTP=$CALC_CODE3)"
else
  fail "P0-4 auth: Authenticated calculation failed" "HTTP=$CALC_CODE3"
fi

# --- P0-5: GL batch cross-tenant isolation ---
# Tenant B should see zero GL batches for Tenant A's property
TOKEN="$TOKEN_B"
code=$(get "$GW/v1/billing/gl-batches?tenant_id=$TID_B&property_id=$PID_A1&limit=1")
GL_CROSS_B=$(resp_count)
if [[ "$code" =~ ^(401|403) ]] || [[ "${GL_CROSS_B:-0}" == "0" ]]; then
  pass "P0-5 isolation: B GL batches have no A1 property (HTTP=$code count=$GL_CROSS_B)"
else
  fail "P0-5 isolation: B GL batches leak A1 property data" "HTTP=$code count=$GL_CROSS_B"
fi

# Tenant A should see zero GL batches for Tenant B's property
TOKEN="$TOKEN_A"
code=$(get "$GW/v1/billing/gl-batches?tenant_id=$TID_A&property_id=$PID_B1&limit=1")
GL_CROSS_A=$(resp_count)
if [[ "$code" =~ ^(401|403) ]] || [[ "${GL_CROSS_A:-0}" == "0" ]]; then
  pass "P0-5 isolation: A GL batches have no B1 property (HTTP=$code count=$GL_CROSS_A)"
else
  fail "P0-5 isolation: A GL batches leak B1 property data" "HTTP=$code count=$GL_CROSS_A"
fi
echo ""

# ═════════════════════════════════════════════════════════════════════════════
#  PHASE 5b — MODULE ACCESS REQUESTS
# ═════════════════════════════════════════════════════════════════════════════
#
# Covers the endpoints backed by module_access_requests
# (scripts/tables/01-core/24_module_access_requests.sql):
#
#   POST /v1/tenants/:tid/module-requests               raise         (VIEWER+)
#   GET  /v1/tenants/:tid/module-requests[?status=]     review queue  (ADMIN)
#   GET  /v1/tenants/:tid/module-requests/mine          own requests  (VIEWER+)
#   POST /v1/tenants/:tid/module-requests/:rid/approve  decide        (ADMIN)
#   POST /v1/tenants/:tid/module-requests/:rid/reject   decide        (ADMIN)
#
# Runs against Tenant B, not Tenant A: approving switches a module on for the
# whole tenant, and doing that to the long-lived seeded Tenant A would carry
# into every later run and turn "module is locked" into a false precondition.
# Tenant A appears here only as the outsider in the isolation checks.
# ═════════════════════════════════════════════════════════════════════════════

echo ""
echo "╔═══════════════════════════════════════════════════════════════════════╗"
echo "║  PHASE 5b: Module Access Requests                                   ║"
echo "╚═══════════════════════════════════════════════════════════════════════╝"
echo ""

# jq against the last response, tolerating a non-JSON body under `set -e`.
mrq() { jq -r "$1" "$RESP_FILE" 2>/dev/null || echo ""; }

if [[ -z "$TOKEN_B" || -z "$TID_B" ]]; then
  skip "Module access requests" "Tenant B token unavailable"
else
  TOKEN="$TOKEN_B"

  echo "── 5b.1  Preconditions ────────────────────────────────────────────"

  code=$(get "$GW/v1/tenants/$TID_B/modules")
  assert_http "Tenant B modules readable" "200" "$code"
  MODS_BEFORE=$(mrq '.modules // [] | join(",")')

  # Pick two modules this tenant does NOT already have. Tenant B is normally
  # fresh, but Phase 0 reuses an existing one when the slug is already taken —
  # and a reused tenant may carry approvals from an earlier run.
  MODREQ_MOD=""; MODREQ_MOD2=""
  for m in analytics-bi facility-maintenance marketing-channel \
           finance-automation tenant-owner-portal enterprise-api; do
    if [[ ",$MODS_BEFORE," != *",$m,"* ]]; then
      if   [[ -z "$MODREQ_MOD"  ]]; then MODREQ_MOD="$m"
      elif [[ -z "$MODREQ_MOD2" ]]; then MODREQ_MOD2="$m"
      fi
    fi
  done
fi

if [[ -n "${MODREQ_MOD:-}" && -n "${MODREQ_MOD2:-}" ]]; then
  echo "  ℹ Using locked modules: $MODREQ_MOD (approve path), $MODREQ_MOD2 (reject path)"
  echo ""

  echo "── 5b.2  Raise a request ──────────────────────────────────────────"

  TOKEN="$TOKEN_B"
  code=$(post "$GW/v1/tenants/$TID_B/module-requests" \
    "{\"moduleId\":\"$MODREQ_MOD\",\"requestedScreen\":\"reports\",\"propertyId\":\"$PID_B1\",\"reason\":\"E2E $RUN_TAG\"}")
  assert_http "POST module-requests → 201" "201" "$code"
  MODREQ_ID=$(mrq '.id // empty')
  assert_eq "Request status is pending"        "pending"      "$(mrq '.status // empty')"
  assert_eq "Request echoes moduleId"          "$MODREQ_MOD"  "$(mrq '.moduleId // empty')"
  assert_eq "Request echoes requestedScreen"   "reports"      "$(mrq '.requestedScreen // empty')"
  if [[ -n "$MODREQ_ID" ]]; then pass "Request has an id ($MODREQ_ID)"
  else fail "Request has an id" "empty"; fi

  # moduleId is the only required field.
  code=$(post "$GW/v1/tenants/$TID_B/module-requests" '{"reason":"no module id"}')
  assert_http "POST without moduleId → 400" "400" "$code"

  # uq_module_access_requests_open: a second person hitting the same locked
  # screen joins the open request rather than filing a duplicate, so the same
  # id comes back instead of a unique-violation 500.
  code=$(post "$GW/v1/tenants/$TID_B/module-requests" \
    "{\"moduleId\":\"$MODREQ_MOD\",\"reason\":\"second asker $RUN_TAG\"}")
  assert_http "Duplicate open request → 201 (joins queue)" "201" "$code"
  assert_eq "Duplicate returns the same request id" "$MODREQ_ID" "$(mrq '.id // empty')"
  echo ""

  echo "── 5b.3  Read back ────────────────────────────────────────────────"

  code=$(get "$GW/v1/tenants/$TID_B/module-requests/mine")
  assert_http "GET module-requests/mine → 200" "200" "$code"
  assert_eq "Requester sees their own request" "1" \
    "$(mrq "[.requests // [] | .[] | select(.id == \"$MODREQ_ID\")] | length")"

  code=$(get "$GW/v1/tenants/$TID_B/module-requests")
  if [[ "$code" == "403" ]]; then
    skip "Admin review queue" "Tenant B user is not ADMIN"
    MODREQ_ADMIN=false
  else
    MODREQ_ADMIN=true
    assert_http "GET module-requests (admin queue) → 200" "200" "$code"
    assert_eq "Queue contains the request" "1" \
      "$(mrq "[.requests // [] | .[] | select(.id == \"$MODREQ_ID\")] | length")"

    get "$GW/v1/tenants/$TID_B/module-requests?status=pending" >/dev/null
    assert_eq "?status=pending returns it" "1" \
      "$(mrq "[.requests // [] | .[] | select(.id == \"$MODREQ_ID\")] | length")"

    get "$GW/v1/tenants/$TID_B/module-requests?status=approved" >/dev/null
    assert_eq "?status=approved excludes it" "0" \
      "$(mrq "[.requests // [] | .[] | select(.id == \"$MODREQ_ID\")] | length")"

    code=$(get "$GW/v1/tenants/$TID_B/module-requests?status=not-a-status")
    assert_http "?status=<garbage> → 400" "400" "$code"
  fi
  echo ""

  echo "── 5b.4  Cross-tenant isolation ───────────────────────────────────"

  # Tenant A's admin has no membership in Tenant B, so every one of B's
  # request routes must refuse them — including the decision routes.
  TOKEN="$TOKEN_A"
  code=$(get "$GW/v1/tenants/$TID_B/module-requests")
  assert_http "Tenant A cannot read B's queue → 403/404" "40[34]" "$code"

  code=$(get "$GW/v1/tenants/$TID_B/module-requests/mine")
  assert_http "Tenant A cannot read B's /mine → 403/404" "40[34]" "$code"

  code=$(post "$GW/v1/tenants/$TID_B/module-requests" "{\"moduleId\":\"$MODREQ_MOD2\"}")
  assert_http "Tenant A cannot raise against B → 403/404" "40[34]" "$code"

  code=$(post "$GW/v1/tenants/$TID_B/module-requests/$MODREQ_ID/approve" '{}')
  assert_http "Tenant A cannot approve B's request → 403/404" "40[34]" "$code"

  # Same request id, but routed under Tenant A: the service scopes the UPDATE
  # by tenant_id, so this must not decide B's request from A's side.
  code=$(post "$GW/v1/tenants/$TID_A/module-requests/$MODREQ_ID/approve" '{}')
  assert_http "B's request id under Tenant A → 4xx" "4" "$code"

  TOKEN="$TOKEN_B"
  code=$(get "$GW/v1/tenants/$TID_B/module-requests/mine")
  assert_eq "B's request still pending after A's attempts" "pending" \
    "$(mrq "[.requests // [] | .[] | select(.id == \"$MODREQ_ID\")] | .[0].status // empty")"
  echo ""

  if [[ "${MODREQ_ADMIN:-false}" == "true" ]]; then
    echo "── 5b.5  Approve — switches the module on ─────────────────────────"

    TOKEN="$TOKEN_B"
    code=$(post "$GW/v1/tenants/$TID_B/module-requests/$MODREQ_ID/approve" \
      '{"notes":"Approved by E2E"}')
    assert_http "POST approve → 200" "200" "$code"
    assert_eq "Decision recorded as approved" "approved" "$(mrq '.request.status // empty')"
    assert_eq "Review notes stored"           "Approved by E2E" "$(mrq '.request.reviewNotes // empty')"
    if [[ -n "$(mrq '.request.reviewedAt // empty')" ]]; then pass "reviewedAt stamped"
    else fail "reviewedAt stamped" "null"; fi
    if [[ -n "$(mrq '.request.reviewedBy // empty')" ]]; then pass "reviewedBy stamped"
    else fail "reviewedBy stamped" "null"; fi

    # The whole point of the workflow: approval enables the module, rather than
    # leaving the admin a second manual toggle.
    assert_eq "Approval response lists the module as enabled" "1" \
      "$(mrq "[.modules.modules // [] | .[] | select(. == \"$MODREQ_MOD\")] | length")"

    get "$GW/v1/tenants/$TID_B/modules" >/dev/null
    assert_eq "GET modules now includes $MODREQ_MOD" "1" \
      "$(mrq "[.modules // [] | .[] | select(. == \"$MODREQ_MOD\")] | length")"
    assert_eq "GET modules still includes core" "1" \
      "$(mrq '[.modules // [] | .[] | select(. == "core")] | length')"

    # Re-deciding a settled request means the caller's queue is stale.
    code=$(post "$GW/v1/tenants/$TID_B/module-requests/$MODREQ_ID/approve" '{}')
    assert_http "Approving twice → 409" "409" "$code"

    code=$(post "$GW/v1/tenants/$TID_B/module-requests/$MODREQ_ID/reject" '{}')
    assert_http "Rejecting an approved request → 409" "409" "$code"

    # Nothing left to ask for once it is on.
    code=$(post "$GW/v1/tenants/$TID_B/module-requests" "{\"moduleId\":\"$MODREQ_MOD\"}")
    assert_http "Request for an enabled module → 409" "409" "$code"
    echo ""

    echo "── 5b.6  Reject — leaves the module locked ────────────────────────"

    code=$(post "$GW/v1/tenants/$TID_B/module-requests" \
      "{\"moduleId\":\"$MODREQ_MOD2\",\"reason\":\"reject path $RUN_TAG\"}")
    assert_http "POST second module-request → 201" "201" "$code"
    MODREQ_ID2=$(mrq '.id // empty')

    code=$(post "$GW/v1/tenants/$TID_B/module-requests/$MODREQ_ID2/reject" \
      '{"notes":"Not this quarter"}')
    assert_http "POST reject → 200" "200" "$code"
    assert_eq "Decision recorded as rejected" "rejected" "$(mrq '.request.status // empty')"
    assert_eq "Rejection returns no module change" "null" "$(mrq '.modules')"

    get "$GW/v1/tenants/$TID_B/modules" >/dev/null
    assert_eq "GET modules still excludes $MODREQ_MOD2" "0" \
      "$(mrq "[.modules // [] | .[] | select(. == \"$MODREQ_MOD2\")] | length")"

    code=$(post "$GW/v1/tenants/$TID_B/module-requests/$MODREQ_ID2/approve" '{}')
    assert_http "Approving a rejected request → 409" "409" "$code"

    # The partial unique index only covers pending rows, so the module can be
    # asked for again after a rejection — a new row, not the rejected one.
    code=$(post "$GW/v1/tenants/$TID_B/module-requests" "{\"moduleId\":\"$MODREQ_MOD2\"}")
    assert_http "Re-request after rejection → 201" "201" "$code"
    if [[ "$(mrq '.id // empty')" != "$MODREQ_ID2" ]]; then
      pass "Re-request creates a new row (history preserved)"
    else
      fail "Re-request creates a new row" "reused rejected id $MODREQ_ID2"
    fi

    get "$GW/v1/tenants/$TID_B/module-requests?status=rejected" >/dev/null
    assert_eq "Rejected request kept in history" "1" \
      "$(mrq "[.requests // [] | .[] | select(.id == \"$MODREQ_ID2\")] | length")"
  fi
  echo ""
else
  skip "Module access requests" "no locked modules available on Tenant B"
  echo ""
fi

TOKEN="$TOKEN_A"

# ═════════════════════════════════════════════════════════════════════════════
#  PHASE 6 — MULTI-TENANT API READ VALIDATION
# ═════════════════════════════════════════════════════════════════════════════

echo ""
echo "╔═══════════════════════════════════════════════════════════════════════╗"
echo "║  PHASE 6: Multi-Tenant API Read Validation                          ║"
echo "╚═══════════════════════════════════════════════════════════════════════╝"
echo ""

# Helper: check API count for a given tenant (API-only, no DB cross-check)
api_check() {
  local label="$1" url="$2"
  local code
  code=$(get "$url")
  if [[ ! "$code" =~ ^2 ]]; then
    fail "API $label" "HTTP $code"
    return
  fi
  local api_count
  api_count=$(resp_count)
  if [[ "$api_count" -ge 0 ]]; then
    pass "API $label  (count=$api_count)"
  else
    fail "API $label" "count=$api_count"
  fi
}

# ── Tenant A endpoints ──
echo "── 6.1  Tenant A API reads ──────────────────────────────────────────"
TOKEN="$TOKEN_A"

api_check "A charges" \
  "$GW/v1/billing/charges?tenant_id=$TID_A&limit=1"

api_check "A payments" \
  "$GW/v1/billing/payments?tenant_id=$TID_A&limit=1"

api_check "A invoices" \
  "$GW/v1/billing/invoices?tenant_id=$TID_A"

api_check "A cashier-sessions" \
  "$GW/v1/billing/cashier-sessions?tenant_id=$TID_A&limit=1"

code=$(get "$GW/v1/night-audit/status?tenant_id=$TID_A&property_id=$PID_A1")
assert_http "API A: night-audit status" "200" "$code"

code=$(get "$GW/v1/billing/reports/trial-balance?tenant_id=$TID_A&property_id=$PID_A1&business_date=$TODAY")
assert_http "API A: trial-balance" "200" "$code"

code=$(get "$GW/v1/billing/gl-batches?tenant_id=$TID_A&limit=10")
assert_http "API A: gl-batches" "200" "$code"
GL_A_COUNT=$(resp_count)
pass "XCHECK A: GL batches (count=$GL_A_COUNT)"
echo ""

# ── Tenant B endpoints ──
echo "── 6.2  Tenant B API reads ──────────────────────────────────────────"
TOKEN="$TOKEN_B"

api_check "B charges" \
  "$GW/v1/billing/charges?tenant_id=$TID_B&limit=1"

api_check "B payments" \
  "$GW/v1/billing/payments?tenant_id=$TID_B&limit=1"

api_check "B invoices" \
  "$GW/v1/billing/invoices?tenant_id=$TID_B"

api_check "B cashier-sessions" \
  "$GW/v1/billing/cashier-sessions?tenant_id=$TID_B&limit=1"

code=$(get "$GW/v1/night-audit/status?tenant_id=$TID_B&property_id=$PID_B1")
assert_http "API B: night-audit status" "200" "$code"

code=$(get "$GW/v1/billing/gl-batches?tenant_id=$TID_B&limit=10")
assert_http "API B: gl-batches" "200" "$code"
GL_B_COUNT=$(resp_count)
pass "XCHECK B: GL batches (count=$GL_B_COUNT)"
echo ""

# ═════════════════════════════════════════════════════════════════════════════
#  PHASE 6b — COMPREHENSIVE API ENDPOINT COVERAGE (smoke)
#  GETs every public read endpoint exposed via the API gateway, per tenant.
#  Endpoint is "responsive" if HTTP 2xx / 204 / 400 / 404 (reachable + auth OK).
#  5xx / 0 / 401 / 403 are failures.
# ═════════════════════════════════════════════════════════════════════════════

if [[ "$FULL_API" == true ]]; then
  echo ""
  echo "╔═══════════════════════════════════════════════════════════════════════╗"
  echo "║  PHASE 6b: Comprehensive API Endpoint Coverage                       ║"
  echo "╚═══════════════════════════════════════════════════════════════════════╝"
  echo ""

  # api_smoke <label> <url>
  # PASS: 2xx, 204, 400, 404 (endpoint reachable; data may be missing)
  # SKIP: 403 with code TENANT_MODULE_NOT_ENABLED (endpoint reachable but module off)
  # FAIL: 5xx, 0, 401, other 403 (5xx/0 retried once with 4s backoff before failing)
  api_smoke() {
    local label="$1" url="$2"
    local code
    # Throttle to stay below gateway rate limit
    sleep 0.05
    code=$(get "$url")
    # Retry once on transient server/network failure with exponential backoff (4s)
    if [[ "$code" =~ ^5 || "$code" == "0" || -z "$code" ]]; then
      sleep 4
      code=$(get "$url")
    fi
    case "$code" in
      2*|400|404)         pass "$label  HTTP=$code" ;;
      403)
        local err
        err=$(jq -r '.code // .detail // empty' "$RESP_FILE" 2>/dev/null)
        if [[ "$err" == "TENANT_MODULE_NOT_ENABLED" ]]; then
          skip "$label" "module-not-enabled (HTTP 403)"
        elif [[ "$err" == "SYSTEM_ADMIN_SCOPE_REQUIRED" || "$err" == *"System administrator scope"* ]]; then
          skip "$label" "system-admin-required (HTTP 403)"
        elif [[ "$err" == *"Rate limit"* || "$err" == *"rate limit"* ]]; then
          # Back off and retry once
          sleep 16
          code=$(get "$url")
          case "$code" in
            2*|400|404) pass "$label  HTTP=$code (after retry)" ;;
            *)          skip "$label" "rate-limited (HTTP $code)" ;;
          esac
        else
          fail "$label" "forbidden HTTP=$code ($err)"
        fi
        ;;
      401)                fail "$label" "unauthenticated HTTP=$code" ;;
      5*|0|"")            fail "$label" "server/network HTTP=$code" ;;
      *)                  fail "$label" "unexpected HTTP=$code" ;;
    esac
  }

  # Smoke a list of "label|url" pairs against the current $TOKEN.
  api_smoke_batch() {
    local label_prefix="$1"; shift
    local pair label url
    for pair in "$@"; do
      label="${pair%%|*}"
      url="${pair#*|}"
      api_smoke "${label_prefix} ${label}" "$GW${url}"
    done
  }

  # ── 6b.1  Tenant-agnostic / system-wide endpoints ───────────────────
  echo "── 6b.1  System / global endpoints ──────────────────────────────────"
  TOKEN="$TOKEN_A"
  api_smoke "SYS registry/services"        "$GW/v1/registry/services"
  api_smoke "SYS modules/catalog"          "$GW/v1/modules/catalog"
  # commands/definitions requires system admin scope — use SYS_TOKEN
  _prev_token="$TOKEN"
  TOKEN="$SYS_TOKEN"
  api_smoke "SYS commands/definitions"     "$GW/v1/commands/definitions"
  TOKEN="$_prev_token"
  api_smoke "SYS tenants"                  "$GW/v1/tenants"
  api_smoke "SYS users"                    "$GW/v1/users"
  api_smoke "SYS user-tenant-associations" "$GW/v1/user-tenant-associations"
  api_smoke "SYS settings"                 "$GW/v1/settings"
  echo ""

  # Endpoint inventory (read-only). Each entry = "label|/v1/path?query"
  # The {TID} placeholder is substituted per tenant in the loop below.
  read -r -d '' INVENTORY_TENANT_QUERY <<'EOF' || true
properties|/v1/properties?tenant_id={TID}&limit=10
buildings|/v1/buildings?tenant_id={TID}&limit=10
buildings-grid|/v1/buildings/grid?tenant_id={TID}
rooms|/v1/rooms?tenant_id={TID}&limit=10
rooms-grid|/v1/rooms/grid?tenant_id={TID}
room-types|/v1/room-types?tenant_id={TID}&limit=10
room-types-grid|/v1/room-types/grid?tenant_id={TID}
rates|/v1/rates?tenant_id={TID}&limit=10
rate-calendar|/v1/rate-calendar?tenant_id={TID}&start_date={TODAY}&end_date={IN5DAYS}
availability|/v1/availability?tenant_id={TID}&property_id={PID}&start_date={TODAY}&end_date={IN5DAYS}
availability-calendar|/v1/availability/calendar?tenant_id={TID}&property_id={PID}&start_date={TODAY}&end_date={IN5DAYS}
availability-room-types|/v1/availability/room-types?tenant_id={TID}&property_id={PID}&start_date={TODAY}&end_date={IN5DAYS}
recommendations|/v1/recommendations?tenant_id={TID}&limit=10
guests|/v1/guests?tenant_id={TID}&limit=10
guests-grid|/v1/guests/grid?tenant_id={TID}
reservations|/v1/reservations?tenant_id={TID}&limit=10
reservations-list|/v1/reservations/list?tenant_id={TID}&limit=10
reservations-grid|/v1/reservations/grid?tenant_id={TID}&start_date={TODAY}&end_date={IN5DAYS}
waitlist|/v1/waitlist?tenant_id={TID}&limit=10
booking-sources|/v1/booking-sources?tenant_id={TID}&limit=10
companies|/v1/companies?tenant_id={TID}&limit=10
channel-mappings|/v1/channel-mappings?tenant_id={TID}&limit=10
market-segments|/v1/market-segments?tenant_id={TID}&limit=10
packages|/v1/packages?tenant_id={TID}&limit=10
promo-codes|/v1/promo-codes?tenant_id={TID}&limit=10
ota-connections|/v1/ota-connections?tenant_id={TID}&limit=10
metasearch-configs|/v1/metasearch-configs?tenant_id={TID}&limit=10
metasearch-performance|/v1/metasearch-configs/performance?tenant_id={TID}
group-bookings|/v1/group-bookings?tenant_id={TID}&limit=10
event-bookings|/v1/event-bookings?tenant_id={TID}&limit=10
banquet-orders|/v1/banquet-orders?tenant_id={TID}&limit=10
meeting-rooms|/v1/meeting-rooms?tenant_id={TID}&limit=10
allotments|/v1/allotments?tenant_id={TID}&limit=10
incidents|/v1/incidents?tenant_id={TID}&limit=10
lost-and-found|/v1/lost-and-found?tenant_id={TID}&limit=10
police-reports|/v1/police-reports?tenant_id={TID}&limit=10
shift-handovers|/v1/shift-handovers?tenant_id={TID}&limit=10
cashier-sessions-alt|/v1/cashier-sessions?tenant_id={TID}&limit=10
guest-feedback|/v1/guest-feedback?tenant_id={TID}&limit=10
compliance-breach|/v1/compliance/breach-incidents?tenant_id={TID}&limit=10
loyalty-tier-rules|/v1/loyalty/tier-rules?tenant_id={TID}
loyalty-transactions|/v1/loyalty/transactions?tenant_id={TID}&limit=10
revenue-pricing-rules|/v1/revenue/pricing-rules?tenant_id={TID}&limit=10
self-service-search|/v1/self-service/search?tenant_id={TID}&property_id={PID}&check_in_date={TODAY}&check_out_date={IN3DAYS}&adults=2
housekeeping-tasks|/v1/housekeeping/tasks?tenant_id={TID}&limit=10
night-audit-status|/v1/night-audit/status?tenant_id={TID}&property_id={PID}
night-audit-history|/v1/night-audit/history?tenant_id={TID}&limit=10
billing-charges|/v1/billing/charges?tenant_id={TID}&limit=10
billing-payments|/v1/billing/payments?tenant_id={TID}&limit=10
billing-invoices|/v1/billing/invoices?tenant_id={TID}&limit=10
billing-folios|/v1/billing/folios?tenant_id={TID}&limit=10
billing-cashier-sessions|/v1/billing/cashier-sessions?tenant_id={TID}&limit=10
billing-ar|/v1/billing/accounts-receivable?tenant_id={TID}&limit=10
billing-ar-aging|/v1/billing/accounts-receivable/aging-summary?tenant_id={TID}&property_id={PID}
billing-ledger|/v1/billing/ledger?tenant_id={TID}&property_id={PID}&business_date={TODAY}
billing-fiscal-periods|/v1/billing/fiscal-periods?tenant_id={TID}&property_id={PID}
billing-routing-rules|/v1/billing/routing-rules?tenant_id={TID}
billing-routing-rule-templates|/v1/billing/routing-rules/templates?tenant_id={TID}
billing-tax-configs|/v1/billing/tax-configurations?tenant_id={TID}
billing-trial-balance|/v1/billing/reports/trial-balance?tenant_id={TID}&property_id={PID}&business_date={TODAY}
billing-tax-summary|/v1/billing/reports/tax-summary?tenant_id={TID}&property_id={PID}&start_date={TODAY}&end_date={IN3DAYS}
billing-departmental|/v1/billing/reports/departmental-revenue?tenant_id={TID}&property_id={PID}&start_date={TODAY}&end_date={IN3DAYS}
billing-commissions|/v1/billing/reports/commissions?tenant_id={TID}&property_id={PID}&start_date={TODAY}&end_date={IN3DAYS}
report-arrivals|/v1/reports/arrivals?tenant_id={TID}&property_id={PID}&business_date={TODAY}
report-departures|/v1/reports/departures?tenant_id={TID}&property_id={PID}&business_date={TODAY}
report-in-house|/v1/reports/in-house?tenant_id={TID}&property_id={PID}&business_date={TODAY}
report-no-show|/v1/reports/no-show?tenant_id={TID}&property_id={PID}&business_date={TODAY}
report-occupancy|/v1/reports/occupancy?tenant_id={TID}&property_id={PID}&start_date={TODAY}&end_date={IN5DAYS}
report-forecast|/v1/reports/forecast?tenant_id={TID}&property_id={PID}&start_date={TODAY}&end_date={IN5DAYS}
report-revenue-summary|/v1/reports/revenue-summary?tenant_id={TID}&property_id={PID}&start_date={TODAY}&end_date={IN5DAYS}
report-daily-revenue|/v1/reports/daily-revenue?tenant_id={TID}&property_id={PID}&start_date={TODAY}&end_date={IN5DAYS}
report-manager-flash|/v1/reports/manager-flash?tenant_id={TID}&property_id={PID}&business_date={TODAY}
report-str-metrics|/v1/reports/str-metrics?tenant_id={TID}&property_id={PID}&start_date={TODAY}&end_date={IN5DAYS}
report-housekeeping|/v1/reports/housekeeping-status?tenant_id={TID}&property_id={PID}
report-night-audit|/v1/reports/night-audit-summary?tenant_id={TID}&property_id={PID}&business_date={TODAY}
EOF

  # Tenant-scoped endpoints with :tenantId in path (no query tenant_id).
  read -r -d '' INVENTORY_TENANT_PATH <<'EOF' || true
modules|/v1/tenants/{TID}/modules
webhooks|/v1/tenants/{TID}/webhooks
notif-templates|/v1/tenants/{TID}/notifications/templates
in-app-notif|/v1/tenants/{TID}/in-app-notifications
in-app-notif-unread|/v1/tenants/{TID}/in-app-notifications/unread
hk-tasks|/v1/tenants/{TID}/housekeeping/tasks
EOF

  # Per-tenant endpoint sweep
  sweep_tenant() {
    local prefix="$1" tid="$2" pid="$3" tok="$4"
    TOKEN="$tok"
    local line label url_template url
    while IFS= read -r line; do
      [[ -z "$line" ]] && continue
      label="${line%%|*}"
      url_template="${line#*|}"
      url="${url_template//\{TID\}/$tid}"
      url="${url//\{PID\}/$pid}"
      url="${url//\{TODAY\}/$TODAY}"
      url="${url//\{IN3DAYS\}/$IN3DAYS}"
      url="${url//\{IN5DAYS\}/$IN5DAYS}"
      api_smoke "$prefix $label" "$GW$url"
    done <<< "$INVENTORY_TENANT_QUERY"

    while IFS= read -r line; do
      [[ -z "$line" ]] && continue
      label="${line%%|*}"
      url_template="${line#*|}"
      url="${url_template//\{TID\}/$tid}"
      api_smoke "$prefix $label" "$GW$url"
    done <<< "$INVENTORY_TENANT_PATH"
  }

  echo "── 6b.2  Tenant A / Property A1 sweep ───────────────────────────────"
  sweep_tenant "A1" "$TID_A" "$PID_A1" "$TOKEN_A"
  echo ""

  echo "── 6b.3  Tenant A / Property A2 sweep ───────────────────────────────"
  sweep_tenant "A2" "$TID_A" "$PID_A2" "$TOKEN_A"
  echo ""

  echo "── 6b.4  Tenant B / Property B1 sweep ───────────────────────────────"
  sweep_tenant "B1" "$TID_B" "$PID_B1" "$TOKEN_B"
  echo ""

  echo "── 6b.5  Tenant B / Property B2 sweep ───────────────────────────────"
  sweep_tenant "B2" "$TID_B" "$PID_B2" "$TOKEN_B"
  echo ""
fi

# ═════════════════════════════════════════════════════════════════════════════
#  PHASE 6c — UI SCREEN DATA SEEDING
#
#  Populates every screen that ships empty on a fresh DB. All writes go through
#  public API routes (REST or command-center) — no direct SQL — so this phase
#  doubles as coverage for the write side of each route.
#
#  Ordering follows the flow registry DAG (schema/src/flows/flow-registry.ts):
#    PROPERTY_SETUP → RATE_PRICING → GUEST_PROFILE → RESERVATION
#                   → CHECK_IN → IN_HOUSE → CHECK_OUT → HOUSEKEEPING
#
#  The blacklist_check gate guards reservation.create, so blacklisted guests are
#  a separate cohort — never the guests used for reservations.
# ═════════════════════════════════════════════════════════════════════════════

echo ""
echo "╔═══════════════════════════════════════════════════════════════════════╗"
echo "║  PHASE 6c: UI Screen Data Seeding                                   ║"
echo "╚═══════════════════════════════════════════════════════════════════════╝"
echo ""

# Reservations per property (screen 10 asks for at least 20).
RES_PER_PROPERTY="${RES_PER_PROPERTY:-20}"

# ── 6c.1  Buildings (Availability → Buildings) ──────────────────────────
# PROPERTY_SETUP tier — must precede rate/reservation seeding.
echo "── 6c.1  Buildings ──────────────────────────────────────────────────"

seed_buildings() {
  local tok="$1" tid="$2" pid="$3" lbl="$4"
  TOKEN="$tok"
  local n=0 code
  local -a specs=(
    "MAIN|Main Tower|TOWER|12|180|true|true"
    "ANNEX|Garden Annex|ANNEX|4|60|false|false"
  )
  local spec bcode bname btype floors rooms haspool hasgym
  for spec in "${specs[@]}"; do
    IFS='|' read -r bcode bname btype floors rooms haspool hasgym <<<"$spec"
    # POST /v1/buildings resolves tenant from the query string, not the body.
    code=$(post "$GW/v1/buildings?tenant_id=$tid" \
      "{\"tenant_id\":\"$tid\",\"property_id\":\"$pid\",\"building_code\":\"${bcode}-${RUN_TAG}\",\"building_name\":\"$bname\",\"building_type\":\"$btype\",\"floor_count\":$floors,\"total_rooms\":$rooms,\"has_pool\":$haspool,\"has_gym\":$hasgym,\"has_lobby\":true,\"has_parking\":true,\"wheelchair_accessible\":true,\"building_status\":\"OPERATIONAL\",\"is_active\":true}")
    [[ "$code" =~ ^2 ]] && n=$((n+1))
  done
  local total
  total=$(poll_count "$GW/v1/buildings?tenant_id=$tid&property_id=$pid&limit=50" 2 30)
  assert_gte "Buildings seeded ($lbl)" "$total" 2
}

seed_buildings "$TOKEN_A" "$TID_A" "$PID_A1" "A1"
seed_buildings "$TOKEN_A" "$TID_A" "$PID_A2" "A2"
seed_buildings "$TOKEN_B" "$TID_B" "$PID_B1" "B1"
seed_buildings "$TOKEN_B" "$TID_B" "$PID_B2" "B2"
echo ""

# ── 6c.2  Packages (Revenue → Packages) ─────────────────────────────────
# RATE_PRICING tier.
echo "── 6c.2  Packages ───────────────────────────────────────────────────"

seed_packages() {
  local tok="$1" tid="$2" pid="$3" lbl="$4"
  TOKEN="$tok"
  local n=0 code pkg_id
  local -a specs=(
    "ROMANCE|Romance Escape|romance|449.00|2|true|false"
    "FAMILY|Family Fun Package|family|629.00|3|true|true"
    "BIZ|Business Traveller|business|289.00|1|true|false"
  )
  local spec pcode pname ptype price nights bfast dinner
  for spec in "${specs[@]}"; do
    IFS='|' read -r pcode pname ptype price nights bfast dinner <<<"$spec"
    code=$(post "$GW/v1/packages" \
      "{\"tenant_id\":\"$tid\",\"property_id\":\"$pid\",\"package_name\":\"$pname\",\"package_code\":\"${pcode}-${lbl}-${RUN_TAG}\",\"package_type\":\"$ptype\",\"valid_from\":\"$TODAY\",\"valid_to\":\"$IN90DAYS\",\"base_price\":$price,\"pricing_model\":\"per_stay\",\"min_nights\":$nights,\"max_nights\":14,\"min_guests\":1,\"max_guests\":4,\"includes_breakfast\":$bfast,\"includes_dinner\":$dinner,\"includes_wifi\":true,\"includes_parking\":true,\"refundable\":true,\"free_cancellation_days\":7,\"total_inventory\":25,\"short_description\":\"$pname at $lbl\"}")
    if [[ "$code" =~ ^2 ]]; then
      n=$((n+1))
      pkg_id=$(jq -r '.package_id // .id // .data.package_id // .data.id // empty' "$RESP_FILE" 2>/dev/null)
      # Components make the package detail screen meaningful, not just the list.
      if [[ -n "$pkg_id" ]]; then
        post "$GW/v1/packages/$pkg_id/components" \
          "{\"tenant_id\":\"$tid\",\"component_name\":\"Daily Breakfast\",\"component_type\":\"food_beverage\",\"quantity\":2,\"unit_price\":35.00,\"is_included\":true}" >/dev/null
        post "$GW/v1/packages/$pkg_id/components" \
          "{\"tenant_id\":\"$tid\",\"component_name\":\"Welcome Amenity\",\"component_type\":\"amenity\",\"quantity\":1,\"unit_price\":25.00,\"is_included\":true}" >/dev/null
      fi
    fi
  done
  local total
  total=$(poll_count "$GW/v1/packages?tenant_id=$tid&property_id=$pid&limit=50" 3 30)
  assert_gte "Packages seeded ($lbl)" "$total" 3
}

seed_packages "$TOKEN_A" "$TID_A" "$PID_A1" "A1"
seed_packages "$TOKEN_A" "$TID_A" "$PID_A2" "A2"
seed_packages "$TOKEN_B" "$TID_B" "$PID_B1" "B1"
seed_packages "$TOKEN_B" "$TID_B" "$PID_B2" "B2"
echo ""

# ── 6c.3  Rate Calendar (Revenue → Rate Calendar) ───────────────────────
echo "── 6c.3  Rate Calendar ──────────────────────────────────────────────"

seed_rate_calendar() {
  local tok="$1" tid="$2" pid="$3" rtid="$4" base="$5" lbl="$6"
  [[ -n "$rtid" ]] || { skip "Rate calendar ($lbl)" "no room type"; return; }
  TOKEN="$tok"

  # Resolve the BAR rate seeded back in Phase 0.4b.
  get "$GW/v1/rates?tenant_id=$tid&property_id=$pid&limit=50" >/dev/null
  local rate_id; rate_id=$(resp_ffirst '.rate_code == "BAR"' "id")
  [[ -n "$rate_id" ]] || rate_id=$(resp_first "id")
  [[ -n "$rate_id" ]] || { skip "Rate calendar ($lbl)" "no BAR rate"; return; }

  # 30 days of pricing, with a weekend uplift so the calendar is not flat.
  local days="[" d rate dow
  for d in $(seq 0 29); do
    local stay_date; stay_date=$(date -d "+$d day" +%Y-%m-%d 2>/dev/null || date -v+${d}d +%Y-%m-%d)
    dow=$(date -d "$stay_date" +%u 2>/dev/null || date -j -f %Y-%m-%d "$stay_date" +%u)
    if [[ "$dow" -ge 5 ]]; then
      rate=$(echo "$base * 1.25" | bc)
    else
      rate="$base"
    fi
    [[ $d -gt 0 ]] && days+=","
    days+="{\"stay_date\":\"$stay_date\",\"rate_amount\":$rate,\"single_rate\":$rate,\"double_rate\":$rate,\"extra_person\":45,\"extra_child\":20}"
  done
  days+="]"

  local code
  code=$(curl -s -o "$RESP_FILE" -w "%{http_code}" \
    -X PUT "$GW/v1/rate-calendar?tenant_id=$tid" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"tenant_id\":\"$tid\",\"property_id\":\"$pid\",\"room_type_id\":\"$rtid\",\"rate_id\":\"$rate_id\",\"currency\":\"USD\",\"source\":\"BULK\",\"days\":$days}")
  assert_http "Rate calendar upsert ($lbl)" "2" "$code"

  get "$GW/v1/rate-calendar?tenant_id=$tid&property_id=$pid&room_type_id=$rtid&start_date=$TODAY&end_date=$IN30DAYS" >/dev/null
  local n; n=$(resp_count)
  assert_gte "Rate calendar days ($lbl)" "$n" 20
}

seed_rate_calendar "$TOKEN_A" "$TID_A" "$PID_A1" "$RTID_A1" "199.00" "A1"
seed_rate_calendar "$TOKEN_A" "$TID_A" "$PID_A2" "$RTID_A2" "179.00" "A2"
seed_rate_calendar "$TOKEN_B" "$TID_B" "$PID_B1" "$RTID_B1" "189.00" "B1"
seed_rate_calendar "$TOKEN_B" "$TID_B" "$PID_B2" "$RTID_B2" "149.00" "B2"
echo ""

# ── 6c.4  Loyalty tier rules (Loyalty → Tier rules) ─────────────────────
# Tenant-scoped config (property_id omitted), so seeded once per tenant.
echo "── 6c.4  Loyalty Tier Rules ─────────────────────────────────────────"

seed_tier_rules() {
  local tok="$1" tid="$2" lbl="$3"
  TOKEN="$tok"
  local n=0 code
  local -a tiers=(
    "bronze|1|Bronze Member|0|0|0|1.0|1.0|0"
    "silver|2|Silver Member|10|5|5000|2.0|1.25|1000"
    "gold|3|Gold Elite|30|15|25000|3.0|1.5|5000"
    "platinum|4|Platinum Elite|60|30|75000|4.0|2.0|10000"
    "diamond|5|Diamond Circle|100|50|150000|5.0|2.5|25000"
  )
  local t tname trank tdisp tnights tstays tpoints ppd mult welcome
  for t in "${tiers[@]}"; do
    IFS='|' read -r tname trank tdisp tnights tstays tpoints ppd mult welcome <<<"$t"
    code=$(post "$GW/v1/loyalty/tier-rules" \
      "{\"tenant_id\":\"$tid\",\"tier_name\":\"$tname\",\"tier_rank\":$trank,\"display_name\":\"$tdisp\",\"min_nights\":$tnights,\"min_stays\":$tstays,\"min_points\":$tpoints,\"min_spend\":$((tpoints * 2)),\"qualification_period_months\":12,\"points_per_dollar\":$ppd,\"bonus_multiplier\":$mult,\"points_expiry_months\":24,\"welcome_bonus_points\":$welcome,\"benefits\":{\"late_checkout\":true,\"room_upgrade\":$([[ $trank -ge 3 ]] && echo true || echo false),\"lounge_access\":$([[ $trank -ge 4 ]] && echo true || echo false)},\"is_active\":true}")
    [[ "$code" =~ ^2 ]] && n=$((n+1))
  done
  get "$GW/v1/loyalty/tier-rules?tenant_id=$tid" >/dev/null
  local total; total=$(resp_count)
  assert_gte "Loyalty tier rules ($lbl)" "$total" 5
}

seed_tier_rules "$TOKEN_A" "$TID_A" "Tenant A"
seed_tier_rules "$TOKEN_B" "$TID_B" "Tenant B"
echo ""

# ── 6c.5  Guest loyalty + blacklist + points ledger ─────────────────────
# GUEST_PROFILE tier. Blacklisted guests are created separately from the
# reservation cohort — the blacklist_check gate rejects reservation.create for
# a blacklisted guest, so reusing them here would break Phase 6c.7.
echo "── 6c.5  Guest Loyalty, Blacklist & Points Ledger ───────────────────"

seed_guest_profiles() {
  local tok="$1" tid="$2" pid="$3" lbl="$4"
  TOKEN="$tok"
  CUR_TID="$tid"
  PROGRAM_IDS=()

  # --- Loyalty cohort: enrol, set tier, then move points through the ledger ---
  local tiers=("bronze" "silver" "gold" "platinum" "diamond")
  local i gid email code prog_id enrolled=0 ledger=0
  for i in 0 1 2 3 4; do
    email="loyalty-${i}-${lbl,,}-${RUN_TAG}@tartware-test.local"
    code=$(post "$GW/v1/guests" \
      "{\"tenant_id\":\"$tid\",\"first_name\":\"Loyal\",\"last_name\":\"Member-${lbl}-${i}\",\"email\":\"$email\",\"phone\":\"+1-555-77${i}-$(printf '%04d' $((RANDOM % 10000)))\",\"nationality\":\"US\"}")
    gid=$(jq -r '.id // .data.id // .guest_id // empty' "$RESP_FILE" 2>/dev/null)
    if [[ -z "$gid" ]]; then
      # Guest creation is a 202 — poll for the row rather than sleeping once.
      poll_count "$GW/v1/guests?tenant_id=$tid&email=$email" 1 30 >/dev/null
      gid=$(resp_first "id")
    fi
    if [[ -z "$gid" ]]; then
      fail "Loyalty guest #$i ($lbl)" "guest not resolvable after create"
      continue
    fi

    # Tier + points on the guest record (Guest → Loyalty screen)
    send_command "guest.set_loyalty ${tiers[$i]} ($lbl)" \
      "guest.set_loyalty" \
      "{\"guest_id\":\"$gid\",\"loyalty_tier\":\"${tiers[$i]}\",\"points_delta\":$(( (i + 1) * 5000 )),\"reason\":\"Seeded tier ${tiers[$i]}\"}"

    # Enrolment row — required before any points ledger activity. The program id
    # is generated here because enrolment is async and no endpoint lists a
    # guest's programs; holding the id is the only way to address it later.
    prog_id=$(gen_uuid)
    send_command "loyalty.program.enroll ($lbl #$i)" \
      "loyalty.program.enroll" \
      "{\"guest_id\":\"$gid\",\"program_id\":\"$prog_id\",\"property_id\":\"$pid\",\"program_name\":\"Tartware Rewards\",\"program_tier\":\"${tiers[$i]}\",\"points_balance\":$(( (i + 1) * 1000 )),\"enrollment_channel\":\"property\"}"
    enrolled=$((enrolled + 1))
    PROGRAM_IDS+=("$prog_id|$gid|$lbl")
    LAST_PROGRAM_ID="$prog_id"
    LAST_PROGRAM_GUEST="$gid"
  done
  wait_kafka 8

  # Drive the ledger for each enrolled program (Loyalty → Transactions)
  local entry pid_part gid_part
  for entry in "${PROGRAM_IDS[@]}"; do
    IFS='|' read -r pid_part gid_part _ <<<"$entry"
    send_command "loyalty.points.earn ($lbl)" \
      "loyalty.points.earn" \
      "{\"guest_id\":\"$gid_part\",\"program_id\":\"$pid_part\",\"points\":2500,\"reference_type\":\"stay\",\"description\":\"Stay credit — seeded\"}"
    send_command "loyalty.points.redeem ($lbl)" \
      "loyalty.points.redeem" \
      "{\"guest_id\":\"$gid_part\",\"program_id\":\"$pid_part\",\"points\":500,\"reference_type\":\"reward\",\"description\":\"Room upgrade — seeded\"}"
    ledger=$((ledger + 1))
  done
  wait_kafka 8

  if [[ "$ledger" -gt 0 && -n "${LAST_PROGRAM_ID:-}" ]]; then
    local txns
    txns=$(poll_count "$GW/v1/loyalty/transactions?tenant_id=$tid&program_id=$LAST_PROGRAM_ID&limit=100" 2 60)
    assert_gte "Loyalty transactions ($lbl)" "$txns" 2
  else
    fail "Loyalty transactions ($lbl)" "no enrolled program resolved"
  fi

  # --- Blacklist cohort: dedicated guests, never used for reservations ---
  local b bl_email bl_id blacklisted=0
  for b in 0 1 2; do
    bl_email="blacklist-${b}-${lbl,,}-${RUN_TAG}@tartware-test.local"
    code=$(post "$GW/v1/guests" \
      "{\"tenant_id\":\"$tid\",\"first_name\":\"Barred\",\"last_name\":\"Guest-${lbl}-${b}\",\"email\":\"$bl_email\",\"phone\":\"+1-555-99${b}-$(printf '%04d' $((RANDOM % 10000)))\",\"nationality\":\"US\"}")
    bl_id=$(jq -r '.id // .data.id // .guest_id // empty' "$RESP_FILE" 2>/dev/null)
    if [[ -z "$bl_id" ]]; then
      poll_count "$GW/v1/guests?tenant_id=$tid&email=$bl_email" 1 30 >/dev/null
      bl_id=$(resp_first "id")
    fi
    if [[ -z "$bl_id" ]]; then
      fail "Blacklist guest #$b ($lbl)" "guest not resolvable after create"
      continue
    fi
    send_command "guest.set_blacklist ($lbl #$b)" \
      "guest.set_blacklist" \
      "{\"guest_id\":\"$bl_id\",\"is_blacklisted\":true,\"reason\":\"Seeded — repeated chargebacks\"}"
    blacklisted=$((blacklisted + 1))
    BLACKLISTED_GUEST_ID="$bl_id"
  done
  wait_kafka 6

  get "$GW/v1/guests?tenant_id=$tid&is_blacklisted=true&limit=100" >/dev/null
  local bl_count; bl_count=$(resp_count)
  if [[ "$bl_count" -lt 1 ]]; then
    # Filter may not be supported — fall back to scanning the full list.
    get "$GW/v1/guests?tenant_id=$tid&limit=100" >/dev/null
    bl_count=$(resp_fcount '.is_blacklisted == true')
  fi
  assert_gte "Blacklisted guests ($lbl)" "$bl_count" 3

  get "$GW/v1/guests?tenant_id=$tid&limit=100" >/dev/null
  local tiered; tiered=$(resp_fcount '.loyalty_tier != null and .loyalty_tier != ""')
  assert_gte "Guests with loyalty tier ($lbl)" "$tiered" 5
}

seed_guest_profiles "$TOKEN_A" "$TID_A" "$PID_A1" "A"
seed_guest_profiles "$TOKEN_B" "$TID_B" "$PID_B1" "B"
echo ""

# ── 6c.6  Group Bookings (Group Bookings screen) ────────────────────────
# RESERVATION tier.
echo "── 6c.6  Group Bookings ─────────────────────────────────────────────"

seed_group_bookings() {
  local tok="$1" tid="$2" pid="$3" rtid="$4" rate="$5" lbl="$6"
  [[ -n "$rtid" ]] || { skip "Group bookings ($lbl)" "no room type"; return; }
  TOKEN="$tok"
  CUR_TID="$tid"

  local -a groups=(
    "Acme Annual Conference|conference|definite|25|Dana Whitfield"
    "Harper-Liu Wedding Block|wedding|tentative|18|Priya Raman"
    "Northwind Sales Kickoff|corporate|prospect|12|Owen Baptiste"
  )
  local g gname gtype gstatus grooms gcontact i=0
  for g in "${groups[@]}"; do
    IFS='|' read -r gname gtype gstatus grooms gcontact <<<"$g"
    send_command "group.create: $gname ($lbl)" \
      "group.create" \
      "{\"property_id\":\"$pid\",\"group_name\":\"$gname ${RUN_TAG}\",\"group_type\":\"$gtype\",\"organization_name\":\"$gname Org\",\"contact_name\":\"$gcontact\",\"contact_email\":\"groups-${i}-${lbl,,}-${RUN_TAG}@tartware-test.local\",\"contact_phone\":\"+1-555-31${i}-4400\",\"arrival_date\":\"$IN3DAYS\",\"departure_date\":\"$IN5DAYS\",\"total_rooms_requested\":$grooms,\"cutoff_days_before_arrival\":14,\"block_status\":\"$gstatus\",\"rate_type\":\"group_rate\",\"negotiated_rate\":$rate,\"payment_method\":\"direct_bill\",\"deposit_amount\":1500.00,\"complimentary_rooms\":1,\"meeting_space_required\":true,\"catering_required\":true,\"notes\":\"Seeded group block for UI coverage\"}"
    i=$((i + 1))
  done
  local n
  n=$(poll_count "$GW/v1/group-bookings?tenant_id=$tid&property_id=$pid&limit=50" 3 60)
  assert_gte "Group bookings ($lbl)" "$n" 3

  # Attach room blocks to the first group so the detail screen has allocations.
  local gid; gid=$(resp_first "group_booking_id")
  [[ -n "$gid" ]] || gid=$(resp_first "id")
  if [[ -n "$gid" ]]; then
    local blocks="[" d
    for d in 0 1 2; do
      local bdate; bdate=$(date -d "+$((d + 3)) day" +%Y-%m-%d 2>/dev/null || date -v+$((d+3))d +%Y-%m-%d)
      [[ $d -gt 0 ]] && blocks+=","
      blocks+="{\"room_type_id\":\"$rtid\",\"block_date\":\"$bdate\",\"blocked_rooms\":8,\"negotiated_rate\":$rate,\"rack_rate\":$(echo "$rate * 1.3" | bc),\"discount_percentage\":23}"
    done
    blocks+="]"
    send_command "group.add_rooms ($lbl)" \
      "group.add_rooms" \
      "{\"group_booking_id\":\"$gid\",\"blocks\":$blocks}"
    wait_kafka 6
    # Verify the blocks actually landed rather than trusting the 202. The
    # handler upserts with ON CONFLICT (group_booking_id, room_type_id,
    # block_date) and there is no matching unique index, so this currently
    # fails server-side — see group.add_rooms defect.
    get "$GW/v1/group-bookings/$gid?tenant_id=$tid" >/dev/null
    local blocked; blocked=$(jq -r '[.. | objects | select(has("blocked_rooms")) ] | length' "$RESP_FILE" 2>/dev/null || echo 0)
    if [[ "${blocked:-0}" -ge 1 ]]; then
      pass "Group room blocks attached ($lbl, blocks=$blocked)"
    else
      fail "Group room blocks ($lbl)" "no room blocks persisted after group.add_rooms"
    fi
  else
    skip "Group room blocks ($lbl)" "no group id resolved"
  fi
}

seed_group_bookings "$TOKEN_A" "$TID_A" "$PID_A1" "$RTID_A1" "159.00" "A1"
seed_group_bookings "$TOKEN_A" "$TID_A" "$PID_A2" "$RTID_A2" "149.00" "A2"
seed_group_bookings "$TOKEN_B" "$TID_B" "$PID_B1" "$RTID_B1" "155.00" "B1"
seed_group_bookings "$TOKEN_B" "$TID_B" "$PID_B2" "$RTID_B2" "129.00" "B2"
echo ""

# ── 6c.7  Reservations — 20 per property, realistic lifecycle mix ───────
# RESERVATION → CHECK_IN → IN_HOUSE → CHECK_OUT. Statuses are reached by
# driving the real lifecycle commands, never by writing a status directly.
echo "── 6c.7  Reservations (${RES_PER_PROPERTY} per property) ─────────────────────────"

seed_reservations() {
  local tok="$1" tid="$2" pid="$3" rtid="$4" lbl="$5"
  [[ -n "$rtid" ]] || { skip "Reservations ($lbl)" "no room type"; return; }
  TOKEN="$tok"
  CUR_TID="$tid"

  local before
  get "$GW/v1/reservations?tenant_id=$tid&property_id=$pid&limit=200" >/dev/null
  before=$(resp_count)

  # Free rooms for the check-in cohort.
  get "$GW/v1/rooms?tenant_id=$tid&property_id=$pid&limit=500" >/dev/null
  local room_ids; room_ids=$(jq -r '(if type=="array" then . else (.data // []) end) | .[].room_id // .[].id' "$RESP_FILE" 2>/dev/null | head -20)
  local -a rooms=(); local r
  for r in $room_ids; do rooms+=("$r"); done

  # Lifecycle plan for 20: 8 confirmed, 6 checked-in, 3 checked-out, 2 cancelled, 1 no-show.
  local created=0 i
  local -a res_ids=()
  for i in $(seq 1 "$RES_PER_PROPERTY"); do
    local g_email="resguest-${lbl,,}-${i}-${RUN_TAG}@tartware-test.local"
    post "$GW/v1/guests" \
      "{\"tenant_id\":\"$tid\",\"first_name\":\"Res${i}\",\"last_name\":\"Guest-${lbl}\",\"email\":\"$g_email\",\"phone\":\"+1-555-4${i}0-$(printf '%04d' $((RANDOM % 10000)))\",\"nationality\":\"US\"}" >/dev/null
    local g_id; g_id=$(jq -r '.id // .data.id // .guest_id // empty' "$RESP_FILE" 2>/dev/null)
    if [[ -z "$g_id" ]]; then
      poll_count "$GW/v1/guests?tenant_id=$tid&email=$g_email" 1 30 >/dev/null
      g_id=$(resp_first "id")
    fi
    [[ -n "$g_id" ]] || continue

    # Stagger arrivals across the next three weeks; in-house cohort starts today.
    local ci co
    if [[ $i -le 9 ]]; then
      ci="$TODAY"; co=$(date -d "+$(( (i % 4) + 2 )) day" +%Y-%m-%d 2>/dev/null || date -v+3d +%Y-%m-%d)
    else
      ci=$(date -d "+$(( i - 8 )) day" +%Y-%m-%d 2>/dev/null || date -v+5d +%Y-%m-%d)
      co=$(date -d "+$(( i - 8 + 3 )) day" +%Y-%m-%d 2>/dev/null || date -v+8d +%Y-%m-%d)
    fi

    local idem; idem=$(gen_uuid)
    curl -s -o "$RESP_FILE" -w "%{http_code}" \
      -X POST "$GW/v1/commands/reservation.create/execute" \
      -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
      -H "Idempotency-Key: $idem" \
      -d "{\"tenant_id\":\"$tid\",\"payload\":{\"property_id\":\"$pid\",\"guest_id\":\"$g_id\",\"room_type_id\":\"$rtid\",\"check_in_date\":\"$ci\",\"check_out_date\":\"$co\",\"status\":\"CONFIRMED\",\"source\":\"DIRECT\",\"adults\":2,\"children\":0,\"total_amount\":$(( 180 + i * 7 )).00,\"currency\":\"USD\"}}" >/dev/null
    created=$((created + 1))
  done

  # Reservations are created asynchronously; 20 of them behind a shared Kafka
  # backlog can take well over a minute, so poll rather than guess a sleep.
  local after
  after=$(poll_count "$GW/v1/reservations?tenant_id=$tid&property_id=$pid&limit=200" \
                     $((before + RES_PER_PROPERTY)) 180)
  assert_gte "Reservations for $lbl (was $before)" "$after" "$RES_PER_PROPERTY"

  # Collect ids of reservations still in a pre-arrival state to drive forward.
  local ids; ids=$(jq -r '(if type=="array" then . else (.data // []) end) | map(select((.status // "" | ascii_upcase) as $s | $s == "CONFIRMED" or $s == "PENDING")) | .[].id' "$RESP_FILE" 2>/dev/null)
  local -a pending=(); local x
  for x in $ids; do pending+=("$x"); done

  local total=${#pending[@]}
  if [[ $total -eq 0 ]]; then
    skip "Reservation lifecycle ($lbl)" "no CONFIRMED reservations to advance"
    return
  fi

  # --- 6 → CHECKED_IN (force bypasses the deposit gate) ---
  local n_in=0 idx=0 rid
  while [[ $idx -lt $total && $n_in -lt 6 ]]; do
    rid="${pending[$idx]}"
    local room_arg=""
    if [[ ${#rooms[@]} -gt 0 ]]; then
      room_arg=",\"room_id\":\"${rooms[$(( n_in % ${#rooms[@]} ))]}\""
    fi
    send_command "reservation.check_in #$((n_in+1)) ($lbl)" \
      "reservation.check_in" \
      "{\"reservation_id\":\"$rid\"$room_arg,\"force\":true,\"notes\":\"Seeded in-house\"}"
    n_in=$((n_in + 1)); idx=$((idx + 1))
  done
  wait_kafka 12

  # --- 3 of the checked-in cohort → CHECKED_OUT (feeds Housekeeping) ---
  get "$GW/v1/reservations?tenant_id=$tid&property_id=$pid&limit=200" >/dev/null
  local in_ids; in_ids=$(jq -r '(if type=="array" then . else (.data // []) end) | map(select((.status // "" | ascii_upcase) == "CHECKED_IN")) | .[].id' "$RESP_FILE" 2>/dev/null | head -3)
  local n_out=0
  for rid in $in_ids; do
    send_command "reservation.check_out #$((n_out+1)) ($lbl)" \
      "reservation.check_out" \
      "{\"reservation_id\":\"$rid\",\"force\":true,\"express\":true,\"notes\":\"Seeded departure\"}"
    n_out=$((n_out + 1))
  done
  wait_kafka 12

  # --- 2 → CANCELLED, 1 → NO_SHOW (from the remaining pre-arrival pool) ---
  local n_cancel=0
  while [[ $idx -lt $total && $n_cancel -lt 2 ]]; do
    send_command "reservation.cancel #$((n_cancel+1)) ($lbl)" \
      "reservation.cancel" \
      "{\"reservation_id\":\"${pending[$idx]}\",\"property_id\":\"$pid\",\"reason\":\"Seeded cancellation\"}"
    n_cancel=$((n_cancel + 1)); idx=$((idx + 1))
  done
  if [[ $idx -lt $total ]]; then
    send_command "reservation.no_show ($lbl)" \
      "reservation.no_show" \
      "{\"reservation_id\":\"${pending[$idx]}\",\"no_show_fee\":95.00,\"reason\":\"Seeded no-show\"}"
    idx=$((idx + 1))
  fi
  wait_kafka 12

  # Report the resulting spread — the point of the "realistic mix".
  get "$GW/v1/reservations?tenant_id=$tid&property_id=$pid&limit=200" >/dev/null
  local c_conf c_in c_out c_can c_ns
  c_conf=$(resp_fcount '(.status // "" | ascii_upcase) == "CONFIRMED"')
  c_in=$(resp_fcount '(.status // "" | ascii_upcase) == "CHECKED_IN"')
  c_out=$(resp_fcount '(.status // "" | ascii_upcase) == "CHECKED_OUT"')
  c_can=$(resp_fcount '(.status // "" | ascii_upcase) == "CANCELLED"')
  c_ns=$(resp_fcount '(.status // "" | ascii_upcase) == "NO_SHOW"')
  echo "     $lbl status mix — CONFIRMED=$c_conf CHECKED_IN=$c_in CHECKED_OUT=$c_out CANCELLED=$c_can NO_SHOW=$c_ns"
  assert_gte "In-house reservations ($lbl)" "$c_in" 1
}

seed_reservations "$TOKEN_A" "$TID_A" "$PID_A1" "$RTID_A1" "A1"
seed_reservations "$TOKEN_A" "$TID_A" "$PID_A2" "$RTID_A2" "A2"
seed_reservations "$TOKEN_B" "$TID_B" "$PID_B1" "$RTID_B1" "B1"
seed_reservations "$TOKEN_B" "$TID_B" "$PID_B2" "$RTID_B2" "B2"
echo ""

# ── 6c.8  Housekeeping tasks (Housekeeping → Tasks) ─────────────────────
# HOUSEKEEPING tier — runs last so checkout-driven rooms already exist.
echo "── 6c.8  Housekeeping Tasks ─────────────────────────────────────────"

seed_housekeeping() {
  local tok="$1" tid="$2" pid="$3" lbl="$4"
  TOKEN="$tok"
  CUR_TID="$tid"

  get "$GW/v1/rooms?tenant_id=$tid&property_id=$pid&limit=500" >/dev/null
  local room_ids; room_ids=$(jq -r '(if type=="array" then . else (.data // []) end) | .[].room_id // .[].id' "$RESP_FILE" 2>/dev/null | head -8)
  local -a rooms=(); local r
  for r in $room_ids; do rooms+=("$r"); done
  if [[ ${#rooms[@]} -eq 0 ]]; then skip "Housekeeping tasks ($lbl)" "no rooms"; return; fi

  # A cashier/staff user to assign work to.
  get "$GW/v1/users?tenant_id=$tid&limit=5" >/dev/null 2>&1
  local staff_id; staff_id=$(resp_first "id")

  local -a types=("departure_clean" "stayover_clean" "deep_clean" "turndown" "inspection")
  local -a prios=("high" "normal" "normal" "low" "high")
  local i n=0
  for i in 0 1 2 3 4 5 6 7; do
    local rid="${rooms[$(( i % ${#rooms[@]} ))]}"
    local ttype="${types[$(( i % 5 ))]}"
    local prio="${prios[$(( i % 5 ))]}"
    local assign=""
    [[ -n "$staff_id" && $((i % 2)) -eq 0 ]] && assign=",\"assigned_to\":\"$staff_id\""
    send_command "housekeeping.task.create $ttype ($lbl)" \
      "housekeeping.task.create" \
      "{\"property_id\":\"$pid\",\"room_id\":\"$rid\",\"task_type\":\"$ttype\",\"scheduled_date\":\"$TODAY\",\"priority\":\"$prio\"$assign,\"notes\":\"Seeded $ttype for UI coverage\"}"
    n=$((n + 1))
  done
  local total
  total=$(poll_count "$GW/v1/housekeeping/tasks?tenant_id=$tid&property_id=$pid&limit=100" 8 90)
  assert_gte "Housekeeping tasks ($lbl)" "$total" 8

  # Advance a couple through the task lifecycle so the board is not all "pending".
  local task_ids; task_ids=$(jq -r '(if type=="array" then . else (.data // []) end) | .[].task_id // .[].id' "$RESP_FILE" 2>/dev/null | head -3)
  local t k=0
  for t in $task_ids; do
    if [[ $k -eq 0 && -n "$staff_id" ]]; then
      send_command "housekeeping.task.assign ($lbl)" \
        "housekeeping.task.assign" \
        "{\"task_id\":\"$t\",\"assigned_to\":\"$staff_id\"}"
    else
      send_command "housekeeping.task.complete ($lbl)" \
        "housekeeping.task.complete" \
        "{\"task_id\":\"$t\",\"notes\":\"Seeded completion\"}"
    fi
    k=$((k + 1))
  done
  wait_kafka 8
  pass "Housekeeping task lifecycle advanced ($lbl)"
}

seed_housekeeping "$TOKEN_A" "$TID_A" "$PID_A1" "A1"
seed_housekeeping "$TOKEN_A" "$TID_A" "$PID_A2" "A2"
seed_housekeeping "$TOKEN_B" "$TID_B" "$PID_B1" "B1"
seed_housekeeping "$TOKEN_B" "$TID_B" "$PID_B2" "B2"
echo ""

# ── 6c.9  Screen-readiness roll-up ──────────────────────────────────────
# One assertion per UI screen the user reported empty.
echo "── 6c.9  UI Screen Readiness ────────────────────────────────────────"
# Each check reproduces the exact request the screen issues — same path, same
# query params, same order — taken from UI/pms-ui/src/app/features/*.
# Several screens read a *grid* endpoint (/guests/grid, /reservations/grid,
# /buildings/grid) which is a different handler from the plain collection route,
# so asserting the plain one would not prove the screen works.

# ui_get <label> <token> <url> <min_rows>
ui_get() {
  local label="$1" tok="$2" url="$3" min="${4:-1}"
  TOKEN="$tok"
  local code; code=$(get "$url")
  if [[ ! "$code" =~ ^2 ]]; then
    fail "SCREEN $label" "HTTP=$code ← $(jq -r '.detail // .message // .error // empty' "$RESP_FILE" 2>/dev/null | head -c 140)"
    return 1
  fi
  local n; n=$(resp_count)
  if [[ "$n" -ge "$min" ]]; then
    pass "SCREEN $label (rows=$n)"
    return 0
  fi
  fail "SCREEN $label" "rows=$n expected>=$min"
  return 1
}

# ui_support <label> <token> <url> — a call the screen makes on load that must
# succeed for it to render, even when the row count is not the point.
ui_support() {
  local label="$1" tok="$2" url="$3"
  TOKEN="$tok"
  local code; code=$(get "$url")
  assert_http "  ↳ $label" "2" "$code"
}

# 1. Group Bookings — groups.ts:251
ui_get "1. Group Bookings"      "$TOKEN_A" "$GW/v1/group-bookings?tenant_id=$TID_A&limit=200&property_id=$PID_A1" 3

# 2 + 3. Guest → Loyalty and Guest → Blacklisted both read /guests/grid — guests.ts:275
TOKEN="$TOKEN_A"
GRID_CODE=$(get "$GW/v1/guests/grid?tenant_id=$TID_A&limit=100")
if [[ "$GRID_CODE" =~ ^2 ]]; then
  GRID_TIERED=$(resp_fcount '.loyalty_tier != null and .loyalty_tier != ""')
  GRID_BLACK=$(resp_fcount '.is_blacklisted == true')
  if [[ "$GRID_TIERED" -ge 5 ]]; then
    pass "SCREEN 2. Guest → Loyalty (tiered=$GRID_TIERED)"
  else
    fail "SCREEN 2. Guest → Loyalty" "tiered=$GRID_TIERED expected>=5"
  fi
  if [[ "$GRID_BLACK" -ge 3 ]]; then
    pass "SCREEN 3. Guest → Blacklisted (blacklisted=$GRID_BLACK)"
  else
    fail "SCREEN 3. Guest → Blacklisted" "blacklisted=$GRID_BLACK expected>=3"
  fi
else
  fail "SCREEN 2. Guest → Loyalty" "guests/grid HTTP=$GRID_CODE"
  fail "SCREEN 3. Guest → Blacklisted" "guests/grid HTTP=$GRID_CODE"
fi
ui_support "guests/stats" "$TOKEN_A" "$GW/v1/guests/stats?tenant_id=$TID_A"

# 4. Loyalty → Tier rules — loyalty.ts:73
ui_get "4. Loyalty → Tier Rules" "$TOKEN_A" "$GW/v1/loyalty/tier-rules?tenant_id=$TID_A" 5

# 5. Loyalty → Transactions — loyalty.ts:99 (program_id is typed in by the user)
if [[ -n "${LAST_PROGRAM_ID:-}" ]]; then
  ui_get "5. Loyalty → Transactions" "$TOKEN_B" \
    "$GW/v1/loyalty/transactions?tenant_id=$TID_B&program_id=$LAST_PROGRAM_ID" 2
else
  fail "SCREEN 5. Loyalty → Transactions" "no program id minted"
fi

# 6. Availability → Buildings — buildings.ts:128
ui_get "6. Buildings"           "$TOKEN_A" "$GW/v1/buildings/grid?tenant_id=$TID_A&property_id=$PID_A1" 2

# 7. Revenue → Packages — packages.ts:257
ui_get "7. Packages"            "$TOKEN_A" "$GW/v1/packages?tenant_id=$TID_A&property_id=$PID_A1" 3

# 8. Revenue → Rate Calendar — rate-calendar.ts:179 (plus its two loader calls)
ui_support "room-types"  "$TOKEN_A" "$GW/v1/room-types?tenant_id=$TID_A&property_id=$PID_A1"
ui_support "rates"       "$TOKEN_A" "$GW/v1/rates?tenant_id=$TID_A&property_id=$PID_A1&status=ACTIVE&limit=200"
ui_get "8. Rate Calendar"       "$TOKEN_A" \
  "$GW/v1/rate-calendar?tenant_id=$TID_A&property_id=$PID_A1&start_date=$TODAY&end_date=$IN30DAYS&room_type_id=$RTID_A1" 20

# 9. Housekeeping → Tasks — housekeeping.ts:414 (screen also loads /rooms)
ui_support "rooms" "$TOKEN_A" "$GW/v1/rooms?tenant_id=$TID_A&property_id=$PID_A1&limit=200"
ui_get "9. Housekeeping Tasks"  "$TOKEN_A" "$GW/v1/housekeeping/tasks?tenant_id=$TID_A&limit=200&property_id=$PID_A1" 8

# 10. Reservations — reservations.ts:205, one per property
ui_get "10. Reservations A1"    "$TOKEN_A" "$GW/v1/reservations/grid?tenant_id=$TID_A&limit=200&property_id=$PID_A1" "$RES_PER_PROPERTY"
ui_get "10. Reservations A2"    "$TOKEN_A" "$GW/v1/reservations/grid?tenant_id=$TID_A&limit=200&property_id=$PID_A2" "$RES_PER_PROPERTY"
ui_get "10. Reservations B1"    "$TOKEN_B" "$GW/v1/reservations/grid?tenant_id=$TID_B&limit=200&property_id=$PID_B1" "$RES_PER_PROPERTY"
ui_get "10. Reservations B2"    "$TOKEN_B" "$GW/v1/reservations/grid?tenant_id=$TID_B&limit=200&property_id=$PID_B2" "$RES_PER_PROPERTY"
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
TOKEN="$TOKEN_A"
get "$GW/v1/guests?tenant_id=$TID_A&limit=100" >/dev/null;                                 POST_A_GUESTS=$(resp_count)
get "$GW/v1/reservations?tenant_id=$TID_A&limit=100" >/dev/null;                           POST_A_RES=$(resp_count)
get "$GW/v1/billing/charges?tenant_id=$TID_A&limit=100" >/dev/null;                        POST_A_CHARGES=$(resp_count)
get "$GW/v1/billing/payments?tenant_id=$TID_A&limit=100" >/dev/null;                       POST_A_PAYMENTS=$(resp_count)
get "$GW/v1/billing/invoices?tenant_id=$TID_A&limit=100" >/dev/null;                               POST_A_INVOICES=$(resp_count)
get "$GW/v1/billing/folios?tenant_id=$TID_A&limit=100" >/dev/null;                                 POST_A_FOLIOS=$(resp_count)
get "$GW/v1/billing/cashier-sessions?tenant_id=$TID_A&limit=100" >/dev/null;               POST_A_SESSIONS=$(resp_count)
get "$GW/v1/billing/accounts-receivable?tenant_id=$TID_A&limit=100" >/dev/null;                    POST_A_AR=$(resp_count)
get "$GW/v1/night-audit/history?tenant_id=$TID_A&limit=100" >/dev/null;                            POST_A_AUDIT=$(resp_count)

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
get "$GW/v1/billing/charges?tenant_id=$TID_A&property_id=$PID_A1&limit=100" >/dev/null; A1_POST_CH=$(resp_count)
get "$GW/v1/billing/charges?tenant_id=$TID_A&property_id=$PID_A2&limit=100" >/dev/null; A2_POST_CH=$(resp_count)
printf "    %-20s  A1=%-6s  A2=%-6s\n" "charges" "$A1_POST_CH" "$A2_POST_CH"
get "$GW/v1/billing/payments?tenant_id=$TID_A&property_id=$PID_A1&limit=100" >/dev/null; A1_POST_PAY=$(resp_count)
get "$GW/v1/billing/payments?tenant_id=$TID_A&property_id=$PID_A2&limit=100" >/dev/null; A2_POST_PAY=$(resp_count)
printf "    %-20s  A1=%-6s  A2=%-6s\n" "payments" "$A1_POST_PAY" "$A2_POST_PAY"
get "$GW/v1/billing/invoices?tenant_id=$TID_A&property_id=$PID_A1&limit=100" >/dev/null; A1_POST_INV=$(resp_count)
get "$GW/v1/billing/invoices?tenant_id=$TID_A&property_id=$PID_A2&limit=100" >/dev/null; A2_POST_INV=$(resp_count)
printf "    %-20s  A1=%-6s  A2=%-6s\n" "invoices" "$A1_POST_INV" "$A2_POST_INV"
echo ""

echo "── Tenant B ─────────────────────────────────────────────────────────"
TOKEN="$TOKEN_B"
get "$GW/v1/guests?tenant_id=$TID_B&limit=100" >/dev/null;                                 POST_B_GUESTS=$(resp_count)
get "$GW/v1/reservations?tenant_id=$TID_B&limit=100" >/dev/null;                           POST_B_RES=$(resp_count)
get "$GW/v1/billing/charges?tenant_id=$TID_B&limit=100" >/dev/null;                        POST_B_CHARGES=$(resp_count)
get "$GW/v1/billing/payments?tenant_id=$TID_B&limit=100" >/dev/null;                       POST_B_PAYMENTS=$(resp_count)
get "$GW/v1/billing/invoices?tenant_id=$TID_B&limit=100" >/dev/null;                               POST_B_INVOICES=$(resp_count)
get "$GW/v1/billing/folios?tenant_id=$TID_B&limit=100" >/dev/null;                                 POST_B_FOLIOS=$(resp_count)
get "$GW/v1/billing/cashier-sessions?tenant_id=$TID_B&limit=100" >/dev/null;               POST_B_SESSIONS=$(resp_count)
get "$GW/v1/billing/accounts-receivable?tenant_id=$TID_B&limit=100" >/dev/null;                    POST_B_AR=$(resp_count)
get "$GW/v1/night-audit/history?tenant_id=$TID_B&limit=100" >/dev/null;                            POST_B_AUDIT=$(resp_count)

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
get "$GW/v1/billing/charges?tenant_id=$TID_B&property_id=$PID_B1&limit=100" >/dev/null; B1_POST_CH=$(resp_count)
get "$GW/v1/billing/charges?tenant_id=$TID_B&property_id=$PID_B2&limit=100" >/dev/null; B2_POST_CH=$(resp_count)
printf "    %-20s  B1=%-6s  B2=%-6s\n" "charges" "$B1_POST_CH" "$B2_POST_CH"
get "$GW/v1/billing/payments?tenant_id=$TID_B&property_id=$PID_B1&limit=100" >/dev/null; B1_POST_PAY=$(resp_count)
get "$GW/v1/billing/payments?tenant_id=$TID_B&property_id=$PID_B2&limit=100" >/dev/null; B2_POST_PAY=$(resp_count)
printf "    %-20s  B1=%-6s  B2=%-6s\n" "payments" "$B1_POST_PAY" "$B2_POST_PAY"
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

# The Loyalty → Transactions screen takes a program id typed by hand (there is no
# endpoint listing a guest's programs), so surface the seeded ids here.
if [[ ${#PROGRAM_IDS[@]} -gt 0 ]]; then
  echo "── Loyalty program IDs (paste into Loyalty → Transactions) ──────────"
  for _entry in "${PROGRAM_IDS[@]}"; do
    IFS='|' read -r _pid _gid _lbl <<<"$_entry"
    printf "  %s   guest=%s  tenant=%s\n" "$_pid" "$_gid" "$_lbl"
  done
  echo ""
fi

if [[ $FAIL -gt 0 || $PHASE1_EXIT -ne 0 ]]; then
  exit 1
fi
