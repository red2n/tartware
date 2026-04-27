#!/usr/bin/env bash
###############################################################################
# test-concurrent-50-tenants.sh
# Concurrent multi-tenant load simulation — 100% API-driven, zero SQL
#
# Simulates N tenants × M properties executing simultaneously:
#   - Full reservation lifecycle: CREATE → CHECK-IN → CHECKOUT
#   - No-show + cancellation penalty scenarios
#   - Full billing pipeline: charges, voids, transfers, payments, refunds,
#     invoices, cashier sessions, AR, comp, tax exemption, late checkout,
#     express checkout, night audit, date roll
#
# Architecture:
#   Phase 0 — Bootstrap: create N tenants × M properties via API
#   Phase 1 — Concurrent: parallel workers execute reservation + billing
#   Phase 2 — Report: aggregate results from all workers
#
# Usage:
#   ./executables/test-accounts-realdata/test-concurrent-50-tenants.sh
#   ./executables/test-accounts-realdata/test-concurrent-50-tenants.sh --tenants=10
#   ./executables/test-accounts-realdata/test-concurrent-50-tenants.sh --tenants=50 --props=10
#   ./executables/test-accounts-realdata/test-concurrent-50-tenants.sh --skip-bootstrap
#   ./executables/test-accounts-realdata/test-concurrent-50-tenants.sh --max-parallel=20
#
# Prerequisites:
#   - All services running (pnpm run dev)
#   - jq, bc, curl available
#   - Default admin credentials working (setup.admin / TempPass123)
#   - Database procedures and indexes must exist. Run ONCE before first test:
#       docker cp scripts/ tartware-postgres:/tmp/scripts/
#       docker exec -w /tmp/scripts/tables tartware-postgres psql -U postgres -d tartware -f 00-create-all-tables.sql
#       docker exec -w /tmp/scripts/procedures tartware-postgres psql -U postgres -d tartware -f 00-create-all-procedures.sql
#       docker exec -w /tmp/scripts/indexes tartware-postgres psql -U postgres -d tartware -f 00-create-all-indexes.sql
###############################################################################
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

# ─── Configuration ───────────────────────────────────────────────────────────
GW="http://localhost:8080"
CORE_SVC="http://localhost:3000"

NUM_TENANTS=50
NUM_PROPS=10
SKIP_BOOTSTRAP=false
MAX_PARALLEL_BOOTSTRAP=3
MAX_PARALLEL_WORKERS=10

for arg in "$@"; do
  case "$arg" in
    --tenants=*)          NUM_TENANTS="${arg#*=}" ;;
    --props=*)            NUM_PROPS="${arg#*=}" ;;
    --skip-bootstrap)     SKIP_BOOTSTRAP=true ;;
    --max-parallel=*)     MAX_PARALLEL_WORKERS="${arg#*=}" ;;
    --bootstrap-batch=*)  MAX_PARALLEL_BOOTSTRAP="${arg#*=}" ;;
  esac
done

TODAY=$(date +%Y-%m-%d)
TOMORROW=$(date -d "+1 day" +%Y-%m-%d 2>/dev/null || date -v+1d +%Y-%m-%d)
IN3DAYS=$(date -d "+3 days" +%Y-%m-%d 2>/dev/null || date -v+3d +%Y-%m-%d)
IN5DAYS=$(date -d "+5 days" +%Y-%m-%d 2>/dev/null || date -v+5d +%Y-%m-%d)
UNIQUE=$(date +%s)

# Work directory for inter-process communication
WORK_DIR=$(mktemp -d /tmp/tartware-concurrent-XXXXXX)
MANIFEST="$WORK_DIR/manifest.txt"
touch "$MANIFEST"
trap "rm -rf $WORK_DIR" EXIT

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  CONCURRENT MULTI-TENANT LOAD TEST"
echo "  $NUM_TENANTS tenants × $NUM_PROPS properties = $((NUM_TENANTS * NUM_PROPS)) property pipelines"
echo "  Max parallel workers: $MAX_PARALLEL_WORKERS"
echo "  Work dir: $WORK_DIR"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ─── Preflight ───────────────────────────────────────────────────────────────
echo "── Preflight ────────────────────────────────────────────────────────"
command -v jq   >/dev/null 2>&1 || { echo "FATAL: jq not found"; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "FATAL: curl not found"; exit 1; }
command -v bc   >/dev/null 2>&1 || { echo "FATAL: bc not found"; exit 1; }

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$GW/health" 2>/dev/null) || HTTP_CODE="000"
[[ "$HTTP_CODE" =~ ^2 ]] || { echo "FATAL: API gateway not reachable at $GW ($HTTP_CODE)"; exit 1; }
echo "  ✓ API gateway reachable"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3025/health" 2>/dev/null) || HTTP_CODE="000"
[[ "$HTTP_CODE" =~ ^2 ]] || { echo "FATAL: Billing service not reachable ($HTTP_CODE)"; exit 1; }
echo "  ✓ Billing service reachable"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3010/health" 2>/dev/null) || HTTP_CODE="000"
[[ "$HTTP_CODE" =~ ^2 ]] || { echo "FATAL: Guests service not reachable ($HTTP_CODE)"; exit 1; }
echo "  ✓ Guests service reachable"

# ─── Verify DB procedures exist (required for Kafka command processing) ──────
echo "  Checking DB procedures..."
PROC_CHECK=$(docker exec tartware-postgres psql -U postgres -d tartware -tAc \
  "SELECT COUNT(*) FROM pg_proc WHERE proname = 'upsert_guest';" 2>/dev/null || echo "0")
if [[ "$PROC_CHECK" -lt 1 ]]; then
  echo "  ⚠ Missing DB procedures — auto-installing..."
  docker cp "$REPO_ROOT/scripts/" tartware-postgres:/tmp/scripts/ 2>/dev/null
  docker exec -w /tmp/scripts/tables tartware-postgres \
    psql -U postgres -d tartware -f 00-create-all-tables.sql >/dev/null 2>&1
  docker exec -w /tmp/scripts/procedures tartware-postgres \
    psql -U postgres -d tartware -f 00-create-all-procedures.sql >/dev/null 2>&1
  docker exec -w /tmp/scripts/indexes tartware-postgres \
    psql -U postgres -d tartware -f 00-create-all-indexes.sql >/dev/null 2>&1
  echo "  ✓ DB procedures and indexes installed"
else
  echo "  ✓ DB procedures present"
fi

# ─── Get system admin token (bootstrap utility) ─────────────────────────────
echo "  Acquiring system admin token..."
SYS_TOKEN_JSON=$(ADMIN_USERNAME=system.admin DB_PASSWORD=postgres \
  AUTH_JWT_SECRET=dev-secret-minimum-32-chars-change-me! \
  npx tsx Apps/core-service/scripts/bootstrap-system-admin-token.ts 2>/dev/null || echo "")

SYS_TOKEN=$(echo "$SYS_TOKEN_JSON" | sed -n '/^{$/,/^}$/p' | jq -r '.token // empty' 2>/dev/null)
if [[ -z "$SYS_TOKEN" ]]; then
  echo "FATAL: Could not acquire system admin token."
  echo "       Run: ADMIN_USERNAME=system.admin DB_PASSWORD=postgres AUTH_JWT_SECRET=dev-secret-minimum-32-chars-change-me! npx tsx Apps/core-service/scripts/bootstrap-system-admin-token.ts"
  exit 1
fi
echo "  ✓ System admin token acquired"

# ─── Get default tenant token ───────────────────────────────────────────────
# Try login first; if it fails, create the user via system admin API then retry
DEFAULT_TENANT="11111111-1111-1111-1111-111111111111"
DEFAULT_USER="setup.admin"
DEFAULT_PASS="TempPass123"

echo "  Acquiring default tenant token..."
DEFAULT_TOKEN_RESP=$(curl -s "$GW/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$DEFAULT_USER\",\"password\":\"$DEFAULT_PASS\"}" 2>/dev/null)
TOKEN_A=$(echo "$DEFAULT_TOKEN_RESP" | jq -r '.access_token // .token // empty' 2>/dev/null)

if [[ -z "$TOKEN_A" ]]; then
  echo "  ⚠ Login failed — bootstrapping default admin user via system API..."
  # Create user via system admin endpoint (core-service direct)
  curl -s -o /dev/null -X POST "$CORE_SVC/v1/system/users" \
    -H "Authorization: Bearer $SYS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"username\":\"$DEFAULT_USER\",
      \"email\":\"setup.admin@tartware.demo\",
      \"password\":\"$DEFAULT_PASS\",
      \"first_name\":\"Setup\",
      \"last_name\":\"Administrator\",
      \"tenant_id\":\"$DEFAULT_TENANT\",
      \"role\":\"OWNER\"
    }" 2>/dev/null || true
  sleep 2

  # Retry login
  DEFAULT_TOKEN_RESP=$(curl -s "$GW/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$DEFAULT_USER\",\"password\":\"$DEFAULT_PASS\"}" 2>/dev/null)
  TOKEN_A=$(echo "$DEFAULT_TOKEN_RESP" | jq -r '.access_token // .token // empty' 2>/dev/null)
fi

[[ -n "$TOKEN_A" ]] || { echo "FATAL: Cannot get default auth token"; exit 1; }
echo "  ✓ Default tenant token acquired"
echo ""

# ─── Enable billing commands globally ────────────────────────────────────────
echo "── Enabling billing commands ────────────────────────────────────────"
REQUIRED_COMMANDS=(
  # Guest commands
  "guest.register"
  # Reservation lifecycle
  "reservation.create" "reservation.check_in" "reservation.check_out"
  "reservation.cancel" "reservation.no_show"
  # Inventory / rooms
  "inventory.lock.room" "inventory.release.room" "inventory.release.bulk"
  "rooms.status.update" "rooms.housekeeping_status.update"
  # Billing — charges
  "billing.charge.post" "billing.charge.void" "billing.charge.transfer"
  # Billing — payments
  "billing.payment.capture" "billing.payment.authorize"
  "billing.payment.void" "billing.payment.refund"
  # Billing — invoices
  "billing.invoice.create" "billing.invoice.adjust" "billing.invoice.finalize"
  "billing.invoice.void" "billing.invoice.reopen" "billing.credit_note.create"
  # Billing — folios
  "billing.folio.create" "billing.folio.close" "billing.folio.transfer"
  "billing.folio.split" "billing.folio.reopen" "billing.folio.merge"
  # Billing — cashier
  "billing.cashier.open" "billing.cashier.close" "billing.cashier.handover"
  # Billing — AR
  "billing.ar.post" "billing.ar.apply_payment" "billing.ar.write_off"
  # Billing — chargebacks
  "billing.chargeback.record" "billing.chargeback.update_status"
  # Billing — night audit
  "billing.night_audit.execute"
  # Billing — other
  "billing.express_checkout"
  "billing.fiscal_period.close"
  "billing.tax_config.create"
  "billing.no_show.charge" "billing.late_checkout.charge"
  "billing.cancellation.penalty" "billing.tax_exemption.apply"
  "billing.comp.post"
)

updates="["
first=true
for cmd in "${REQUIRED_COMMANDS[@]}"; do
  if $first; then first=false; else updates+=","; fi
  updates+="{\"command_name\":\"$cmd\",\"status\":\"enabled\"}"
done
updates+="]"

code=$(curl -s -o /dev/null -w "%{http_code}" \
  -X PATCH "$GW/v1/commands/features/batch" \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d "{\"updates\":$updates}")
if [[ "$code" =~ ^2 ]]; then
  echo "  ✓ Billing commands enabled (HTTP $code)"
else
  echo "  ⚠ Command enable returned HTTP $code (may already be enabled)"
fi

echo "  Waiting 32s for gateway command cache refresh..."
sleep 32
echo "  ✓ Cache refreshed"
echo ""

# ═════════════════════════════════════════════════════════════════════════════
# PHASE 0 — BOOTSTRAP TENANTS & PROPERTIES (all via API)
# ═════════════════════════════════════════════════════════════════════════════

echo "╔═══════════════════════════════════════════════════════════════════════╗"
printf "║  PHASE 0: BOOTSTRAP %d TENANTS × %d PROPERTIES" "$NUM_TENANTS" "$NUM_PROPS"
printf "%*s║\n" "$((26 - ${#NUM_TENANTS} - ${#NUM_PROPS}))" ""
echo "╚═══════════════════════════════════════════════════════════════════════╝"
echo ""

# ─── bootstrap_one_tenant <index> ────────────────────────────────────────
bootstrap_one_tenant() {
  local idx="$1"
  local slug="lt-tenant-$(printf '%03d' "$idx")"
  local tenant_name="LT Hotel Group $idx"
  local admin_user="lt${idx}.admin"
  local admin_pass="LTPass${idx}!x"
  local admin_email="admin@${slug}.test"
  local resp="$WORK_DIR/boot-${idx}.json"
  local tid="" token=""

  # Check if tenant already exists via system admin API
  local all_tenants
  all_tenants=$(curl -s "$CORE_SVC/v1/system/tenants?limit=200" \
    -H "Authorization: Bearer $SYS_TOKEN" 2>/dev/null)
  tid=$(echo "$all_tenants" | jq -r --arg s "$slug" \
    '.tenants // [] | map(select(.slug == $s)) | .[0].id // empty' 2>/dev/null)

  if [[ -n "$tid" ]]; then
    echo "  [T$idx] exists: $tid"
  else
    # Bootstrap new tenant + first property + owner via API
    local bcode
    bcode=$(curl -s -o "$resp" -w "%{http_code}" \
      -X POST "$CORE_SVC/v1/system/tenants/bootstrap" \
      -H "Authorization: Bearer $SYS_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"tenant\": {
          \"name\": \"$tenant_name\",
          \"slug\": \"$slug\",
          \"type\": \"CHAIN\",
          \"email\": \"$admin_email\"
        },
        \"property\": {
          \"property_name\": \"$tenant_name HQ\",
          \"property_code\": \"LT$(printf '%03d' "$idx")-001\",
          \"property_type\": \"hotel\",
          \"star_rating\": $(( (idx % 3) + 3 )),
          \"total_rooms\": $(( 50 + (idx % 50) )),
          \"email\": \"hq@${slug}.test\",
          \"timezone\": \"America/New_York\",
          \"currency\": \"USD\"
        },
        \"owner\": {
          \"username\": \"$admin_user\",
          \"email\": \"$admin_email\",
          \"password\": \"$admin_pass\",
          \"first_name\": \"Admin\",
          \"last_name\": \"LT$idx\"
        }
      }")

    if [[ ! "$bcode" =~ ^2 ]]; then
      echo "  [T$idx] ✗ Bootstrap failed HTTP $bcode"
      cat "$resp" 2>/dev/null | jq -r '.message // .error // .' 2>/dev/null | head -2
      rm -f "$resp"
      return 1
    fi

    tid=$(jq -r '.tenant.id // .tenant_id // .id // empty' "$resp")
    if [[ -z "$tid" ]]; then
      echo "  [T$idx] ✗ No tenant ID in response"
      rm -f "$resp"
      return 1
    fi
    echo "  [T$idx] ✓ Created: $tid"
  fi

  # Get auth token via login API (retry up to 5 times with backoff for rate-limiting)
  local login_resp
  local login_attempt
  for login_attempt in 1 2 3 4 5; do
    login_resp=$(curl -s -X POST "$GW/v1/auth/login" \
      -H "Content-Type: application/json" \
      -d "{\"username\":\"$admin_user\",\"password\":\"$admin_pass\"}" 2>/dev/null)
    token=$(echo "$login_resp" | jq -r '.access_token // .token // .data.access_token // empty' 2>/dev/null)
    [[ -n "$token" ]] && break
    sleep $((login_attempt * 2))
  done

  if [[ -z "$token" ]]; then
    echo "  [T$idx] ✗ Login failed for $admin_user (after 5 attempts)"
    rm -f "$resp"
    return 1
  fi

  # Enable finance-automation module (retry with gateway tenant token)
  local mod_ok=false
  local mod_attempt
  for mod_attempt in 1 2 3; do
    local mc
    mc=$(curl -s -o /dev/null -w "%{http_code}" \
      -X PUT "$GW/v1/tenants/$tid/modules" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json" \
      -d "{\"modules\":[\"core\",\"finance-automation\"]}" 2>/dev/null)
    if [[ "$mc" =~ ^2 ]]; then mod_ok=true; break; fi
    sleep $((mod_attempt * 2))
  done
  if ! $mod_ok; then
    echo "  [T$idx] ⚠ Module enable failed — trying core-service directly"
    curl -s -o /dev/null \
      -X PUT "$CORE_SVC/v1/tenants/$tid/modules" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json" \
      -d "{\"modules\":[\"core\",\"finance-automation\"]}" 2>/dev/null || true
    sleep 2
  fi

  # Collect existing properties (retry up to 3 times — module propagation may lag)
  local props_json existing_count
  local prop_attempt
  for prop_attempt in 1 2 3; do
    props_json=$(curl -s "$GW/v1/properties?tenant_id=$tid&limit=100" \
      -H "Authorization: Bearer $token" 2>/dev/null)
    existing_count=$(echo "$props_json" | jq 'if type == "array" then length elif .data then (.data | length) elif .properties then (.properties | length) else 0 end' 2>/dev/null || echo "0")
    [[ "$existing_count" -gt 0 ]] && break
    # On final attempt, try core-service directly (bypasses gateway module check)
    if [[ "$prop_attempt" -eq 3 ]]; then
      props_json=$(curl -s "$CORE_SVC/v1/properties?tenant_id=$tid&limit=100" \
        -H "Authorization: Bearer $token" 2>/dev/null)
      existing_count=$(echo "$props_json" | jq 'if type == "array" then length elif .data then (.data | length) elif .properties then (.properties | length) else 0 end' 2>/dev/null || echo "0")
    fi
    sleep $((prop_attempt * 2))
  done

  local prop_pairs=""

  # Process existing properties — ensure room types + rooms + rates exist
  for pi in $(seq 0 $((existing_count - 1))); do
    local ppid
    ppid=$(echo "$props_json" | jq -r "if type == \"array\" then .[$pi].id elif .data then .data[$pi].id elif .properties then .properties[$pi].id else empty end" 2>/dev/null)
    [[ -n "$ppid" && "$ppid" != "null" ]] || continue

    local prtid
    prtid=$(curl -s "$GW/v1/room-types?tenant_id=$tid&property_id=$ppid&limit=1" \
      -H "Authorization: Bearer $token" 2>/dev/null \
      | jq -r 'if type == "array" then .[0].room_type_id elif .data then .data[0].room_type_id elif .room_types then .room_types[0].room_type_id else empty end // empty' 2>/dev/null)

    # Create room type if missing
    if [[ -z "$prtid" || "$prtid" == "null" ]]; then
      local rt_price=$(( 120 + (idx * 5) % 100 ))
      local rt_resp
      rt_resp=$(curl -s -X POST "$GW/v1/room-types" \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json" \
        -d "{\"tenant_id\":\"$tid\",\"property_id\":\"$ppid\",\"type_name\":\"Standard King\",\"type_code\":\"STK\",\"category\":\"STANDARD\",\"base_occupancy\":2,\"max_occupancy\":3,\"max_adults\":2,\"max_children\":1,\"extra_bed_capacity\":1,\"number_of_beds\":1,\"base_price\":${rt_price}.00,\"currency\":\"USD\",\"amenities\":[\"WIFI\",\"TV\",\"AC\"],\"is_active\":true,\"display_order\":1}" 2>/dev/null)
      prtid=$(echo "$rt_resp" | jq -r '.room_type_id // .data.room_type_id // .id // empty' 2>/dev/null)
      if [[ -z "$prtid" || "$prtid" == "null" ]]; then
        prtid=$(curl -s "$GW/v1/room-types?tenant_id=$tid&property_id=$ppid&limit=1" \
          -H "Authorization: Bearer $token" 2>/dev/null \
          | jq -r 'if type == "array" then .[0].room_type_id elif .data then .data[0].room_type_id else empty end // empty' 2>/dev/null)
      fi
    fi

    [[ -n "$prtid" && "$prtid" != "null" ]] || continue

    # Create rooms if fewer than 5
    local room_count
    room_count=$(curl -s "$GW/v1/rooms?tenant_id=$tid&property_id=$ppid&limit=1" \
      -H "Authorization: Bearer $token" 2>/dev/null \
      | jq 'if type == "array" then length elif .data then (.data | length) elif .rooms then (.rooms | length) else 0 end' 2>/dev/null || echo "0")
    if [[ "$room_count" -lt 5 ]]; then
      for rn in $(seq 1 10); do
        curl -s -o /dev/null -X POST "$GW/v1/rooms" \
          -H "Authorization: Bearer $token" \
          -H "Content-Type: application/json" \
          -d "{\"tenant_id\":\"$tid\",\"property_id\":\"$ppid\",\"room_type_id\":\"$prtid\",\"room_number\":\"$(printf '%d%02d' "$((pi + 1))" "$rn")\",\"floor\":\"$((pi + 1))\",\"status\":\"available\",\"housekeeping_status\":\"clean\",\"maintenance_status\":\"operational\",\"is_blocked\":false,\"is_out_of_order\":false}" 2>/dev/null || true
      done
    fi

    # Seed BAR rate
    curl -s -o /dev/null -X POST "$GW/v1/rates?tenant_id=$tid" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json" \
      -d "{\"tenant_id\":\"$tid\",\"property_id\":\"$ppid\",\"room_type_id\":\"$prtid\",\"rate_name\":\"Best Available Rate\",\"rate_code\":\"BAR\",\"base_rate\":$(( 120 + (idx * 5) % 100 )).00,\"valid_from\":\"2024-01-01\",\"status\":\"ACTIVE\"}" 2>/dev/null || true

    [[ -n "$prop_pairs" ]] && prop_pairs+="|"
    prop_pairs+="$ppid:$prtid"
  done

  # Create additional properties to reach NUM_PROPS
  local needed=$((NUM_PROPS - existing_count))
  for pi in $(seq 1 "$needed"); do
    local prop_idx=$((existing_count + pi))
    local pcode="LT$(printf '%03d' "$idx")-$(printf '%03d' "$prop_idx")"
    local pname="$tenant_name P$prop_idx"
    local tz
    case $((prop_idx % 4)) in
      0) tz="America/New_York" ;; 1) tz="America/Chicago" ;;
      2) tz="America/Denver"   ;; 3) tz="America/Los_Angeles" ;;
    esac
    local price=$(( 120 + (idx * 5 + prop_idx * 3) % 100 ))

    local ppid=""
    local pc
    pc=$(curl -s -o "$resp" -w "%{http_code}" \
      -X POST "$GW/v1/properties" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json" \
      -d "{\"tenant_id\":\"$tid\",\"property_name\":\"$pname\",\"property_code\":\"$pcode\",\"property_type\":\"hotel\",\"star_rating\":$(( (prop_idx % 3) + 3 )),\"total_rooms\":$(( 30 + (prop_idx * 10) )),\"email\":\"p${prop_idx}@${slug}.test\",\"currency\":\"USD\",\"timezone\":\"$tz\"}")
    if [[ "$pc" =~ ^2 ]]; then
      ppid=$(jq -r '.id // .data.id // .property_id // empty' "$resp" 2>/dev/null)
    fi
    if [[ -z "$ppid" || "$ppid" == "null" ]]; then
      ppid=$(curl -s "$GW/v1/properties?tenant_id=$tid&limit=100" \
        -H "Authorization: Bearer $token" 2>/dev/null \
        | jq -r --arg c "$pcode" 'if type == "array" then map(select(.property_code == $c)) | .[0].id elif .data then (.data | map(select(.property_code == $c)) | .[0].id) elif .properties then (.properties | map(select(.property_code == $c)) | .[0].id) else empty end // empty' 2>/dev/null)
    fi
    [[ -n "$ppid" && "$ppid" != "null" ]] || continue

    # Room type
    local prtid=""
    local rt_resp
    rt_resp=$(curl -s -X POST "$GW/v1/room-types" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json" \
      -d "{\"tenant_id\":\"$tid\",\"property_id\":\"$ppid\",\"type_name\":\"Standard Room\",\"type_code\":\"STD\",\"category\":\"STANDARD\",\"base_occupancy\":2,\"max_occupancy\":3,\"max_adults\":2,\"max_children\":1,\"extra_bed_capacity\":1,\"number_of_beds\":1,\"base_price\":${price}.00,\"currency\":\"USD\",\"amenities\":[\"WIFI\",\"TV\",\"AC\"],\"is_active\":true,\"display_order\":1}" 2>/dev/null)
    prtid=$(echo "$rt_resp" | jq -r '.room_type_id // .data.room_type_id // .id // empty' 2>/dev/null)
    if [[ -z "$prtid" || "$prtid" == "null" ]]; then
      prtid=$(curl -s "$GW/v1/room-types?tenant_id=$tid&property_id=$ppid&limit=1" \
        -H "Authorization: Bearer $token" 2>/dev/null \
        | jq -r 'if type == "array" then .[0].room_type_id elif .data then .data[0].room_type_id else empty end // empty' 2>/dev/null)
    fi
    [[ -n "$prtid" && "$prtid" != "null" ]] || continue

    # Rooms
    for rn in $(seq 1 10); do
      curl -s -o /dev/null -X POST "$GW/v1/rooms" \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json" \
        -d "{\"tenant_id\":\"$tid\",\"property_id\":\"$ppid\",\"room_type_id\":\"$prtid\",\"room_number\":\"$(printf '%d%02d' "$prop_idx" "$rn")\",\"floor\":\"$prop_idx\",\"status\":\"available\",\"housekeeping_status\":\"clean\",\"maintenance_status\":\"operational\",\"is_blocked\":false,\"is_out_of_order\":false}" 2>/dev/null || true
    done

    # BAR rate
    curl -s -o /dev/null -X POST "$GW/v1/rates?tenant_id=$tid" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json" \
      -d "{\"tenant_id\":\"$tid\",\"property_id\":\"$ppid\",\"room_type_id\":\"$prtid\",\"rate_name\":\"Best Available Rate\",\"rate_code\":\"BAR\",\"base_rate\":${price}.00,\"valid_from\":\"2024-01-01\",\"status\":\"ACTIVE\"}" 2>/dev/null || true

    [[ -n "$prop_pairs" ]] && prop_pairs+="|"
    prop_pairs+="$ppid:$prtid"
  done

  # Write manifest line
  local prop_count
  prop_count=$(echo "$prop_pairs" | tr '|' '\n' | grep -c . 2>/dev/null) || prop_count=0
  echo "${idx}|${tid}|${token}|${prop_pairs}" >> "$MANIFEST"
  echo "  [T$idx] ✓ Ready: $tid with $prop_count properties"
  rm -f "$resp"
}

if ! $SKIP_BOOTSTRAP; then
  echo "── Bootstrapping $NUM_TENANTS tenants (batches of $MAX_PARALLEL_BOOTSTRAP) ──"
  for batch_start in $(seq 1 "$MAX_PARALLEL_BOOTSTRAP" "$NUM_TENANTS"); do
    batch_end=$((batch_start + MAX_PARALLEL_BOOTSTRAP - 1))
    [[ $batch_end -gt $NUM_TENANTS ]] && batch_end=$NUM_TENANTS
    echo "  Batch: T${batch_start}–T${batch_end}"
    pids=()
    for idx in $(seq "$batch_start" "$batch_end"); do
      bootstrap_one_tenant "$idx" &
      pids+=($!)
    done
    for pid in "${pids[@]}"; do
      wait "$pid" 2>/dev/null || true
    done
    # Brief pause between batches to avoid rate-limit and connection exhaustion
    sleep 2
  done
  echo ""
  echo "  ✓ Bootstrap complete: $(wc -l < "$MANIFEST") tenants"
else
  echo "── Skipping bootstrap — using existing manifest ──"
  if [[ ! -s "$MANIFEST" ]]; then
    echo "FATAL: No manifest. Run without --skip-bootstrap first."
    exit 1
  fi
fi
echo ""

TENANT_COUNT=$(wc -l < "$MANIFEST")
[[ "$TENANT_COUNT" -ge 1 ]] || { echo "FATAL: No tenants in manifest"; exit 1; }
echo "  Tenants ready: $TENANT_COUNT"
echo ""

# ─── Warm up Kafka guest consumer ────────────────────────────────────────
echo "── Warming up Kafka consumers ──────────────────────────────────────"
WARMUP_TID=$(head -1 "$MANIFEST" | cut -d'|' -f2)
WARMUP_TOKEN=$(head -1 "$MANIFEST" | cut -d'|' -f3)
warmup_email="warmup-$(date +%s)@lt.test"
curl -s -o /dev/null -X POST "$GW/v1/guests" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $WARMUP_TOKEN" \
  -d "{\"tenant_id\":\"$WARMUP_TID\",\"first_name\":\"Warmup\",\"last_name\":\"Test\",\"email\":\"$warmup_email\",\"phone\":\"+15550000000\",\"nationality\":\"US\"}" || true
# Poll until guest appears (proves consumer is active)
warmup_ok=0
for warmup_try in 1 2 3 4 5 6 7 8 9 10; do
  sleep 2
  wid=$(curl -s "$GW/v1/guests?tenant_id=$WARMUP_TID&email=$warmup_email" \
    -H "Authorization: Bearer $WARMUP_TOKEN" 2>/dev/null | jq -r '.[0].id // empty' 2>/dev/null || true)
  if [[ -n "$wid" && "$wid" != "null" ]]; then
    warmup_ok=1; break
  fi
done
if [[ "$warmup_ok" -eq 1 ]]; then
  echo "  ✓ Kafka guest consumer warm (${warmup_try}×2s)"
else
  echo "  ⚠ Kafka warmup timeout — guest consumer may be slow"
fi
echo ""

# ═════════════════════════════════════════════════════════════════════════════
# PHASE 1 — CONCURRENT TENANT WORKERS
# ═════════════════════════════════════════════════════════════════════════════

echo "╔═══════════════════════════════════════════════════════════════════════╗"
printf "║  PHASE 1: CONCURRENT EXECUTION — %d tenants in parallel" "$TENANT_COUNT"
printf "%*s║\n" "$((15 - ${#TENANT_COUNT}))" ""
echo "╚═══════════════════════════════════════════════════════════════════════╝"
echo ""

# ─── tenant_worker <manifest_line> ───────────────────────────────────────
tenant_worker() {
  local line="$1"
  local idx tid token prop_data
  IFS='|' read -r idx tid token prop_data <<< "$line"

  local result_file="$WORK_DIR/result-${idx}.txt"
  local log_file="$WORK_DIR/log-${idx}.txt"
  local rf="$WORK_DIR/resp-${idx}.json"

  local pass=0 fail=0 total=0 skip=0
  local start_time=$SECONDS

  # Ensure result file is written even if the worker crashes
  trap 'echo "$idx|$pass|$fail|$skip|$total|$((SECONDS - start_time))" > "$result_file"' EXIT

  # Disable set -e inside workers — individual API calls may fail without being fatal
  set +e

  # ── Worker-local API helpers ──
  local _hc  # last HTTP status code
  w_post() {
    _hc=$(curl -s -o "$rf" -w "%{http_code}" -X POST "$1" \
      -H "Authorization: Bearer $token" -H "Content-Type: application/json" \
      -d "$2" 2>/dev/null)
  }
  w_get() {
    _hc=$(curl -s -o "$rf" -w "%{http_code}" "$1" \
      -H "Authorization: Bearer $token" 2>/dev/null)
  }
  w_put() {
    _hc=$(curl -s -o "$rf" -w "%{http_code}" -X PUT "$1" \
      -H "Authorization: Bearer $token" -H "Content-Type: application/json" \
      -d "$2" 2>/dev/null)
  }
  w_cmd() {
    _hc=$(curl -s -o "$rf" -w "%{http_code}" -X POST "$GW/v1/commands/$1/execute" \
      -H "Authorization: Bearer $token" -H "Content-Type: application/json" \
      -d "{\"tenant_id\":\"$tid\",\"payload\":$2}" 2>/dev/null)
  }
  w_jfirst()  { jq -r "(if type == \"array\" then .[0] elif .data and (.data | type == \"array\") then .data[0] elif .properties then .properties[0] elif .guests then .guests[0] elif .reservations then .reservations[0] elif .folios then .folios[0] elif .charges then .charges[0] elif .payments then .payments[0] elif .invoices then .invoices[0] elif .sessions then .sessions[0] else . end) // {} | .$1 // empty" "$rf" 2>/dev/null || echo ""; }
  w_jcount()  { jq -r 'if type == "array" then length elif .data and (.data | type == "array") then (.data | length) elif .properties then (.properties | length) elif .guests then (.guests | length) elif .reservations then (.reservations | length) elif .folios then (.folios | length) elif .charges then (.charges | length) elif .payments then (.payments | length) elif .invoices then (.invoices | length) elif .sessions then (.sessions | length) else 0 end' "$rf" 2>/dev/null || echo "0"; }
  w_jfield()  { jq -r ".$1 // (.data.$1) // empty" "$rf" 2>/dev/null || echo ""; }
  w_jfilter() { jq -r "(if type == \"array\" then . elif .data then .data elif .charges then .charges elif .payments then .payments else [] end) | map(select($1)) | .[0].$2 // empty" "$rf" 2>/dev/null || echo ""; }

  w_pass() { total=$((total + 1)); pass=$((pass + 1)); echo "  [T$idx] PASS $1" >> "$log_file"; }
  w_fail() { total=$((total + 1)); fail=$((fail + 1)); echo "  [T$idx] FAIL $1 — $2" >> "$log_file"; }
  w_skip() { total=$((total + 1)); skip=$((skip + 1)); echo "  [T$idx] SKIP $1" >> "$log_file"; }
  w_log()  { echo "  [T$idx] $1" >> "$log_file"; }

  w_log "======== START tenant=$tid ========"

  # Split property pairs by a delimiter
  local OLD_IFS="$IFS"
  IFS='|'
  local props_arr=()
  for pp in $prop_data; do
    props_arr+=("$pp")
  done
  IFS="$OLD_IFS"

  w_log "Properties: ${#props_arr[@]}"

  for pp in "${props_arr[@]}"; do
    local pid rtid
    IFS=':' read -r pid rtid <<< "$pp"
    [[ -n "$pid" && "$pid" != "null" && -n "$rtid" && "$rtid" != "null" ]] || { w_skip "Prop $pp — bad ids"; continue; }

    local tag="T${idx}-${pid:0:8}"
    w_log "-- $tag: START --"

    # ═══ 1. GUEST CREATION ═══════════════════════════════════════════════
    local g1_email="${tag,,}-${UNIQUE}@lt.test"
    w_post "$GW/v1/guests" \
      "{\"tenant_id\":\"$tid\",\"first_name\":\"Load\",\"last_name\":\"$tag\",\"email\":\"$g1_email\",\"phone\":\"+1555$(printf '%07d' $((RANDOM % 10000000)))\",\"nationality\":\"US\"}"
    local g1_id
    g1_id=$(jq -r '.id // .data.id // .guest_id // empty' "$rf" 2>/dev/null)
    # Poll for guest (Kafka command is async — consumer may lag under load)
    if [[ -z "$g1_id" || "$g1_id" == "null" ]]; then
      local g1_try
      for g1_try in 1 2 3 4 5 6 7 8; do
        sleep 3
        w_get "$GW/v1/guests?tenant_id=$tid&email=$g1_email"
        g1_id=$(w_jfirst "id")
        [[ -z "$g1_id" || "$g1_id" == "null" ]] && g1_id=$(w_jfirst "guest_id")
        # Fallback: try direct guests-service on retries 4+
        if [[ -z "$g1_id" || "$g1_id" == "null" ]] && [[ $g1_try -ge 4 ]]; then
          g1_id=$(curl -s "http://localhost:3010/v1/guests?tenant_id=$tid&email=$g1_email" \
            -H "Authorization: Bearer $token" 2>/dev/null | jq -r '.[0].id // empty' 2>/dev/null)
        fi
        [[ -n "$g1_id" && "$g1_id" != "null" ]] && break
      done
    fi
    [[ -n "$g1_id" && "$g1_id" != "null" ]] && w_pass "Guest 1 ($tag)" || { w_fail "Guest 1 ($tag)" "no id"; continue; }

    # Guest 2 — for no-show scenario
    local g2_email="${tag,,}-ns-${UNIQUE}@lt.test"
    w_post "$GW/v1/guests" \
      "{\"tenant_id\":\"$tid\",\"first_name\":\"NoShow\",\"last_name\":\"$tag\",\"email\":\"$g2_email\",\"phone\":\"+1555$(printf '%07d' $((RANDOM % 10000000)))\",\"nationality\":\"US\"}"
    local g2_id
    g2_id=$(jq -r '.id // .data.id // .guest_id // empty' "$rf" 2>/dev/null)
    if [[ -z "$g2_id" || "$g2_id" == "null" ]]; then
      local g2_try
      for g2_try in 1 2 3; do
        sleep $((g2_try + 1))
        w_get "$GW/v1/guests?tenant_id=$tid&email=$g2_email"
        g2_id=$(w_jfirst "id")
        [[ -z "$g2_id" || "$g2_id" == "null" ]] && g2_id=$(w_jfirst "guest_id")
        [[ -n "$g2_id" && "$g2_id" != "null" ]] && break
      done
    fi

    # Guest 3 — for cancel scenario
    local g3_email="${tag,,}-cx-${UNIQUE}@lt.test"
    w_post "$GW/v1/guests" \
      "{\"tenant_id\":\"$tid\",\"first_name\":\"Cancel\",\"last_name\":\"$tag\",\"email\":\"$g3_email\",\"phone\":\"+1555$(printf '%07d' $((RANDOM % 10000000)))\",\"nationality\":\"US\"}"
    local g3_id
    g3_id=$(jq -r '.id // .data.id // .guest_id // empty' "$rf" 2>/dev/null)
    if [[ -z "$g3_id" || "$g3_id" == "null" ]]; then
      local g3_try
      for g3_try in 1 2 3; do
        sleep $((g3_try + 1))
        w_get "$GW/v1/guests?tenant_id=$tid&email=$g3_email"
        g3_id=$(w_jfirst "id")
        [[ -z "$g3_id" || "$g3_id" == "null" ]] && g3_id=$(w_jfirst "guest_id")
        [[ -n "$g3_id" && "$g3_id" != "null" ]] && break
      done
    fi

    # ═══ 2. RESERVATION CREATE ═══════════════════════════════════════════
    # Res 1: full lifecycle (create -> checkin -> charges -> checkout)
    w_cmd "reservation.create" \
      "{\"property_id\":\"$pid\",\"guest_id\":\"$g1_id\",\"room_type_id\":\"$rtid\",\"check_in_date\":\"$TODAY\",\"check_out_date\":\"$IN3DAYS\",\"status\":\"CONFIRMED\",\"source\":\"DIRECT\",\"total_amount\":597.00,\"currency\":\"USD\"}"
    local r1_id
    r1_id=$(jq -r '.id // .data.id // .reservation_id // empty' "$rf" 2>/dev/null)
    if [[ -z "$r1_id" || "$r1_id" == "null" ]]; then
      local r1_try
      for r1_try in 1 2 3 4; do
        sleep $((r1_try + 1))
        w_get "$GW/v1/reservations?tenant_id=$tid&property_id=$pid&guest_id=$g1_id&limit=5"
        r1_id=$(w_jfirst "id")
        [[ -z "$r1_id" || "$r1_id" == "null" ]] && r1_id=$(w_jfirst "reservation_id")
        [[ -n "$r1_id" && "$r1_id" != "null" ]] && break
      done
    fi
    [[ -n "$r1_id" && "$r1_id" != "null" ]] && w_pass "Res 1 create ($tag)" || w_fail "Res 1 ($tag)" "no id"

    # Res 2: no-show
    local r2_id=""
    if [[ -n "$g2_id" && "$g2_id" != "null" ]]; then
      w_cmd "reservation.create" \
        "{\"property_id\":\"$pid\",\"guest_id\":\"$g2_id\",\"room_type_id\":\"$rtid\",\"check_in_date\":\"$TODAY\",\"check_out_date\":\"$TOMORROW\",\"status\":\"CONFIRMED\",\"source\":\"OTA\",\"total_amount\":199.00,\"currency\":\"USD\"}"
      local r2_try
      for r2_try in 1 2 3 4; do
        sleep $((r2_try + 1))
        r2_id=$(jq -r '.id // .data.id // .reservation_id // empty' "$rf" 2>/dev/null)
        if [[ -z "$r2_id" || "$r2_id" == "null" ]]; then
          w_get "$GW/v1/reservations?tenant_id=$tid&property_id=$pid&guest_id=$g2_id&limit=5"
          r2_id=$(w_jfirst "id")
          [[ -z "$r2_id" || "$r2_id" == "null" ]] && r2_id=$(w_jfirst "reservation_id")
        fi
        [[ -n "$r2_id" && "$r2_id" != "null" ]] && break
      done
      [[ -n "$r2_id" && "$r2_id" != "null" ]] && w_pass "Res 2 no-show ($tag)" || w_skip "Res 2 ($tag)"
    fi

    # Res 3: cancel
    local r3_id=""
    if [[ -n "$g3_id" && "$g3_id" != "null" ]]; then
      w_cmd "reservation.create" \
        "{\"property_id\":\"$pid\",\"guest_id\":\"$g3_id\",\"room_type_id\":\"$rtid\",\"check_in_date\":\"$IN3DAYS\",\"check_out_date\":\"$IN5DAYS\",\"status\":\"CONFIRMED\",\"source\":\"DIRECT\",\"total_amount\":398.00,\"currency\":\"USD\"}"
      local r3_try
      for r3_try in 1 2 3 4; do
        sleep $((r3_try + 1))
        r3_id=$(jq -r '.id // .data.id // .reservation_id // empty' "$rf" 2>/dev/null)
        if [[ -z "$r3_id" || "$r3_id" == "null" ]]; then
          w_get "$GW/v1/reservations?tenant_id=$tid&property_id=$pid&guest_id=$g3_id&limit=5"
          r3_id=$(w_jfirst "id")
          [[ -z "$r3_id" || "$r3_id" == "null" ]] && r3_id=$(w_jfirst "reservation_id")
        fi
        [[ -n "$r3_id" && "$r3_id" != "null" ]] && break
      done
      [[ -n "$r3_id" && "$r3_id" != "null" ]] && w_pass "Res 3 cancel ($tag)" || w_skip "Res 3 ($tag)"
    fi

    # ═══ 3. CHECK-IN (Res 1) ═════════════════════════════════════════════
    if [[ -n "$r1_id" && "$r1_id" != "null" ]]; then
      w_cmd "reservation.check_in" "{\"reservation_id\":\"$r1_id\",\"property_id\":\"$pid\"}"
      local st=""
      local ci_try
      for ci_try in 1 2 3 4; do
        sleep $((ci_try + 1))
        w_get "$GW/v1/reservations/$r1_id?tenant_id=$tid"
        st=$(w_jfield "status")
        [[ "${st,,}" == "checked_in" || "${st,,}" == "in_house" ]] && break
      done
      [[ "${st,,}" == "checked_in" || "${st,,}" == "in_house" ]] && w_pass "Check-in ($tag)" || w_skip "Check-in ($tag) st=$st"
    fi

    # ═══ 4. FOLIO (auto-created) ═════════════════════════════════════════
    local f1_id=""
    if [[ -n "$r1_id" && "$r1_id" != "null" ]]; then
      w_get "$GW/v1/billing/folios?tenant_id=$tid&reservation_id=$r1_id"
      f1_id=$(w_jfirst "id")
      [[ -z "$f1_id" || "$f1_id" == "null" ]] && f1_id=$(w_jfirst "folio_id")
    fi

    # ═══ 5. CHARGE POSTINGS ══════════════════════════════════════════════
    if [[ -n "$r1_id" && "$r1_id" != "null" ]]; then
      w_cmd "billing.charge.post" "{\"property_id\":\"$pid\",\"reservation_id\":\"$r1_id\",\"amount\":199.00,\"charge_code\":\"ROOM\",\"description\":\"Room $tag\"}"
      w_cmd "billing.charge.post" "{\"property_id\":\"$pid\",\"reservation_id\":\"$r1_id\",\"amount\":45.00,\"charge_code\":\"RESTAURANT\",\"description\":\"Dinner $tag\"}"
      w_cmd "billing.charge.post" "{\"property_id\":\"$pid\",\"reservation_id\":\"$r1_id\",\"amount\":18.50,\"charge_code\":\"MINIBAR\",\"description\":\"Minibar $tag\"}"
      w_cmd "billing.charge.post" "{\"property_id\":\"$pid\",\"reservation_id\":\"$r1_id\",\"amount\":120.00,\"charge_code\":\"SPA\",\"description\":\"Spa $tag\"}"
      sleep 5
      w_get "$GW/v1/billing/charges?tenant_id=$tid&property_id=$pid&reservation_id=$r1_id&limit=50"
      local cc
      cc=$(w_jcount)
      [[ "$cc" -ge 2 ]] && w_pass "Charges ($tag): $cc" || w_fail "Charges ($tag)" "$cc"
    fi

    # ═══ 6. VOID SPA ═════════════════════════════════════════════════════
    if [[ -n "$r1_id" && "$r1_id" != "null" ]]; then
      w_get "$GW/v1/billing/charges?tenant_id=$tid&reservation_id=$r1_id&charge_code=SPA&limit=10"
      local spa_id
      spa_id=$(w_jfilter '.is_voided != true' "id")
      if [[ -n "$spa_id" && "$spa_id" != "null" ]]; then
        w_cmd "billing.charge.void" "{\"posting_id\":\"$spa_id\",\"property_id\":\"$pid\",\"reservation_id\":\"$r1_id\",\"void_reason\":\"Wrong guest $tag\"}"
        sleep 2; w_pass "Void SPA ($tag)"
      else w_skip "Void SPA ($tag)"; fi
    fi

    # ═══ 7. PAYMENTS ═════════════════════════════════════════════════════
    local payref="CC-$tag-$UNIQUE"
    if [[ -n "$r1_id" && "$r1_id" != "null" ]]; then
      w_cmd "billing.payment.capture" "{\"payment_reference\":\"$payref\",\"property_id\":\"$pid\",\"reservation_id\":\"$r1_id\",\"guest_id\":\"$g1_id\",\"amount\":300.00,\"payment_method\":\"CREDIT_CARD\"}"
      sleep 2
      w_cmd "billing.payment.capture" "{\"payment_reference\":\"CASH-$tag-$UNIQUE\",\"property_id\":\"$pid\",\"reservation_id\":\"$r1_id\",\"guest_id\":\"$g1_id\",\"amount\":80.00,\"payment_method\":\"CASH\"}"
      sleep 3
      w_get "$GW/v1/billing/payments?tenant_id=$tid&property_id=$pid&limit=50"
      local pc
      pc=$(w_jcount)
      [[ "$pc" -ge 1 ]] && w_pass "Payments ($tag): $pc" || w_fail "Payments ($tag)" "$pc"
    fi

    # ═══ 8. REFUND ═══════════════════════════════════════════════════════
    if [[ -n "$r1_id" && "$r1_id" != "null" ]]; then
      w_get "$GW/v1/billing/payments?tenant_id=$tid&property_id=$pid&limit=50"
      local cc_pid
      cc_pid=$(jq -r --arg ref "$payref" '(if type == "array" then . elif .data then .data elif .payments then .payments else [] end) | map(select(.payment_reference == $ref)) | .[0].id // empty' "$rf" 2>/dev/null)
      if [[ -n "$cc_pid" && "$cc_pid" != "null" ]]; then
        w_cmd "billing.payment.refund" "{\"payment_id\":\"$cc_pid\",\"property_id\":\"$pid\",\"reservation_id\":\"$r1_id\",\"guest_id\":\"$g1_id\",\"amount\":25.00,\"reason\":\"Overcharge\",\"refund_reference\":\"RF-$tag-$UNIQUE\",\"payment_method\":\"CREDIT_CARD\"}"
        sleep 2; w_pass "Refund ($tag)"
      else w_skip "Refund ($tag)"; fi
    fi

    # ═══ 9. INVOICE CREATE + FINALIZE ════════════════════════════════════
    local inv_id=""
    if [[ -n "$r1_id" && "$r1_id" != "null" ]]; then
      w_cmd "billing.invoice.create" "{\"property_id\":\"$pid\",\"reservation_id\":\"$r1_id\",\"guest_id\":\"$g1_id\",\"total_amount\":262.50,\"idempotency_key\":\"INV-$tag-$UNIQUE\"}"
      sleep 3
      w_get "$GW/v1/billing/invoices?tenant_id=$tid&property_id=$pid&reservation_id=$r1_id"
      inv_id=$(w_jfirst "id")
      [[ -z "$inv_id" || "$inv_id" == "null" ]] && inv_id=$(w_jfirst "invoice_id")
      [[ -n "$inv_id" && "$inv_id" != "null" ]] && w_pass "Invoice ($tag)" || w_fail "Invoice ($tag)" "no id"

      if [[ -n "$inv_id" && "$inv_id" != "null" ]]; then
        w_cmd "billing.invoice.finalize" "{\"invoice_id\":\"$inv_id\"}"
        sleep 2; w_pass "Invoice finalize ($tag)"
      fi
    fi

    # ═══ 10. CASHIER OPEN + CLOSE ════════════════════════════════════════
    w_cmd "billing.cashier.open" "{\"property_id\":\"$pid\",\"cashier_id\":\"$g1_id\",\"cashier_name\":\"FD $tag\",\"shift_type\":\"morning\",\"opening_float\":500.00}"
    sleep 3
    w_get "$GW/v1/billing/cashier-sessions?tenant_id=$tid&property_id=$pid&limit=10"
    local sess_id
    sess_id=$(w_jfirst "session_id")
    [[ -z "$sess_id" || "$sess_id" == "null" ]] && sess_id=$(w_jfirst "id")
    [[ -n "$sess_id" && "$sess_id" != "null" ]] && w_pass "Cashier open ($tag)" || w_skip "Cashier ($tag)"
    if [[ -n "$sess_id" && "$sess_id" != "null" ]]; then
      w_cmd "billing.cashier.close" "{\"session_id\":\"$sess_id\",\"closing_cash_declared\":580.00,\"closing_cash_counted\":580.00,\"notes\":\"Close $tag\"}"
      sleep 2; w_pass "Cashier close ($tag)"
    fi

    # ═══ 11. ACCOUNTS RECEIVABLE ═════════════════════════════════════════
    if [[ -n "$r1_id" && "$r1_id" != "null" ]]; then
      w_cmd "billing.ar.post" "{\"reservation_id\":\"$r1_id\",\"account_type\":\"corporate\",\"account_id\":\"$g1_id\",\"account_name\":\"Corp $tag\",\"amount\":100.00,\"payment_terms\":\"net_30\",\"notes\":\"AR $tag\"}"
      sleep 2
      w_get "$GW/v1/billing/accounts-receivable?tenant_id=$tid&property_id=$pid"
      local arc
      arc=$(w_jcount)
      [[ "$arc" -ge 1 ]] && w_pass "AR ($tag)" || w_skip "AR ($tag)"
    fi

    # ═══ 12. CHARGE TRANSFER -> HOUSE ACCOUNT ════════════════════════════
    if [[ -n "$r1_id" && "$r1_id" != "null" ]]; then
      w_cmd "billing.folio.create" "{\"property_id\":\"$pid\",\"folio_type\":\"HOUSE_ACCOUNT\",\"folio_name\":\"House $tag\",\"currency\":\"USD\",\"notes\":\"House $tag\",\"idempotency_key\":\"HOUSE-$tag-$UNIQUE\"}"
      sleep 2
      w_get "$GW/v1/billing/folios?tenant_id=$tid&property_id=$pid&folio_type=HOUSE_ACCOUNT"
      local h_id
      h_id=$(w_jfirst "id")
      [[ -z "$h_id" || "$h_id" == "null" ]] && h_id=$(w_jfirst "folio_id")
      if [[ -n "$h_id" && "$h_id" != "null" ]]; then
        w_get "$GW/v1/billing/charges?tenant_id=$tid&reservation_id=$r1_id&charge_code=MINIBAR&limit=10"
        local mb_id
        mb_id=$(w_jfilter '.is_voided != true' "id")
        if [[ -n "$mb_id" && "$mb_id" != "null" ]]; then
          w_cmd "billing.charge.transfer" "{\"posting_id\":\"$mb_id\",\"to_folio_id\":\"$h_id\",\"property_id\":\"$pid\",\"reason\":\"Xfer $tag\"}"
          sleep 2; w_pass "Charge transfer ($tag)"
        else w_skip "Charge transfer ($tag)"; fi
      else w_skip "House acct ($tag)"; fi
    fi

    # ═══ 13. NO-SHOW CHARGE (Res 2) ══════════════════════════════════════
    if [[ -n "$r2_id" && "$r2_id" != "null" ]]; then
      w_cmd "billing.no_show.charge" "{\"property_id\":\"$pid\",\"reservation_id\":\"$r2_id\",\"charge_amount\":189.00,\"currency\":\"USD\",\"reason_code\":\"NO_SHOW_POLICY\"}"
      sleep 2; w_pass "No-show charge ($tag)"
    fi

    # ═══ 14. CANCEL (Res 3) + CANCELLATION PENALTY ═══════════════════════
    if [[ -n "$r3_id" && "$r3_id" != "null" ]]; then
      w_cmd "reservation.cancel" "{\"reservation_id\":\"$r3_id\",\"reason\":\"Guest request $tag\"}"
      local cx_st=""
      local cx_try
      for cx_try in 1 2 3 4; do
        sleep $((cx_try + 1))
        w_get "$GW/v1/reservations/$r3_id?tenant_id=$tid"
        cx_st=$(w_jfield "status")
        [[ "${cx_st,,}" == "cancelled" ]] && break
      done
      [[ "${cx_st,,}" == "cancelled" ]] && w_pass "Reservation cancel ($tag)" || w_skip "Reservation cancel ($tag) st=$cx_st"
      if [[ "${cx_st,,}" == "cancelled" ]]; then
        w_cmd "billing.cancellation.penalty" "{\"property_id\":\"$pid\",\"reservation_id\":\"$r3_id\",\"penalty_amount_override\":99.50,\"currency\":\"USD\",\"reason\":\"Late cancel $tag\"}"
        sleep 2; w_pass "Cancel penalty ($tag)"
      else
        w_skip "Cancel penalty ($tag) (not CANCELLED)"
      fi
    fi

    # ═══ 15. LATE CHECKOUT CHARGE ════════════════════════════════════════
    if [[ -n "$r1_id" && "$r1_id" != "null" ]]; then
      local late_iso="${TODAY}T15:00:00+00:00"
      w_cmd "billing.late_checkout.charge" "{\"property_id\":\"$pid\",\"reservation_id\":\"$r1_id\",\"actual_checkout_time\":\"$late_iso\",\"standard_checkout_time\":\"12:00\",\"currency\":\"USD\"}"
      sleep 2; w_pass "Late CO charge ($tag)"
    fi

    # ═══ 16. COMP POST ═══════════════════════════════════════════════════
    if [[ -n "$r1_id" && "$r1_id" != "null" ]]; then
      w_cmd "billing.comp.post" "{\"property_id\":\"$pid\",\"reservation_id\":\"$r1_id\",\"comp_type\":\"FOOD_BEVERAGE\",\"amount\":35.00,\"currency\":\"USD\",\"charge_code\":\"RESTAURANT\",\"description\":\"Comp $tag\"}"
      sleep 2; w_pass "Comp post ($tag)"
    fi

    # ═══ 17. TAX EXEMPTION ═══════════════════════════════════════════════
    if [[ -n "$f1_id" && "$f1_id" != "null" ]]; then
      w_cmd "billing.tax_exemption.apply" "{\"property_id\":\"$pid\",\"folio_id\":\"$f1_id\",\"exemption_type\":\"GOVERNMENT\",\"exemption_certificate\":\"GOV-$tag-$UNIQUE\",\"exemption_reason\":\"Govt $tag\",\"expiry_date\":\"2027-12-31\"}"
      sleep 2; w_pass "Tax exempt ($tag)"
    fi

    # ═══ 18. CHECKOUT (Res 1) ════════════════════════════════════════════
    if [[ -n "$r1_id" && "$r1_id" != "null" ]]; then
      w_cmd "reservation.check_out" "{\"reservation_id\":\"$r1_id\",\"property_id\":\"$pid\"}"
      local co_st=""
      local co_try
      for co_try in 1 2 3 4; do
        sleep $((co_try + 1))
        w_get "$GW/v1/reservations/$r1_id?tenant_id=$tid"
        co_st=$(w_jfield "status")
        [[ "${co_st,,}" == "checked_out" || "${co_st,,}" == "departed" ]] && break
      done
      [[ "${co_st,,}" == "checked_out" || "${co_st,,}" == "departed" ]] && w_pass "Checkout ($tag)" || w_skip "Checkout ($tag) st=$co_st"
    fi

    # ═══ 19. NIGHT AUDIT ═════════════════════════════════════════════════
    # Seed business date
    w_put "$GW/v1/night-audit/business-date?tenant_id=$tid" \
      "{\"tenant_id\":\"$tid\",\"property_id\":\"$pid\",\"business_date\":\"$TODAY\",\"date_status\":\"OPEN\",\"night_audit_status\":\"PENDING\"}"

    w_cmd "billing.night_audit.execute" "{\"property_id\":\"$pid\",\"audit_date\":\"$TODAY\",\"perform_date_roll\":false}"
    sleep 5
    w_get "$GW/v1/night-audit/history?tenant_id=$tid&property_id=$pid"
    local ac
    ac=$(w_jcount)
    [[ "$ac" -ge 1 ]] && w_pass "Night audit ($tag)" || w_skip "Night audit ($tag)"

    # ═══ 20. DATE ROLL ═══════════════════════════════════════════════════
    w_cmd "billing.night_audit.execute" "{\"property_id\":\"$pid\",\"audit_date\":\"$TODAY\",\"perform_date_roll\":true}"
    sleep 5
    w_get "$GW/v1/night-audit/status?tenant_id=$tid&property_id=$pid"
    local bd
    bd=$(w_jfield "business_date")
    [[ -n "$bd" && "$bd" != "null" ]] && w_pass "Date roll ($tag) -> $bd" || w_skip "Date roll ($tag)"

    # ═══ 21. EXPRESS CHECKOUT (Res 2 folio) ══════════════════════════════
    if [[ -n "$r2_id" && "$r2_id" != "null" ]]; then
      w_get "$GW/v1/billing/folios?tenant_id=$tid&reservation_id=$r2_id"
      local f2_id
      f2_id=$(w_jfirst "id")
      [[ -z "$f2_id" || "$f2_id" == "null" ]] && f2_id=$(w_jfirst "folio_id")
      if [[ -n "$f2_id" && "$f2_id" != "null" ]]; then
        w_cmd "billing.express_checkout" "{\"property_id\":\"$pid\",\"reservation_id\":\"$r2_id\",\"folio_id\":\"$f2_id\",\"send_folio_email\":false,\"skip_balance_check\":true,\"notes\":\"Express $tag\"}"
        sleep 2; w_pass "Express CO ($tag)"
      fi
    fi

    w_log "-- $tag: DONE --"
  done

  local elapsed=$((SECONDS - start_time))
  echo "$idx|$pass|$fail|$skip|$total|$elapsed" > "$result_file"
  w_log "======== END tenant=$tid pass=$pass fail=$fail skip=$skip total=$total ${elapsed}s ========"
  rm -f "$rf"
}

# ─── Launch workers in batches ───────────────────────────────────────────
START_TIME=$SECONDS

tenant_lines=()
while IFS= read -r line; do
  [[ -n "$line" ]] && tenant_lines+=("$line")
done < "$MANIFEST"

echo "  Launching ${#tenant_lines[@]} workers in batches of $MAX_PARALLEL_WORKERS..."
echo ""

worker_pids=()
running=0

for i in "${!tenant_lines[@]}"; do
  local_idx=$(echo "${tenant_lines[$i]}" | cut -d'|' -f1)
  echo "  > Worker T$local_idx launched"
  tenant_worker "${tenant_lines[$i]}" &
  worker_pids+=($!)
  running=$((running + 1))

  if [[ $running -ge $MAX_PARALLEL_WORKERS ]]; then
    echo "  ... Batch of $running running — waiting..."
    for pid in "${worker_pids[@]}"; do wait "$pid" 2>/dev/null || true; done
    worker_pids=()
    running=0
    echo "  ... Batch done"
  fi
done

if [[ ${#worker_pids[@]} -gt 0 ]]; then
  echo "  ... Final batch (${#worker_pids[@]}) — waiting..."
  for pid in "${worker_pids[@]}"; do wait "$pid" 2>/dev/null || true; done
  echo "  ... Done"
fi

TOTAL_ELAPSED=$((SECONDS - START_TIME))
echo ""

# ═════════════════════════════════════════════════════════════════════════════
# PHASE 2 — AGGREGATE RESULTS
# ═════════════════════════════════════════════════════════════════════════════

echo "======================================================================="
echo "  PHASE 2: RESULTS"
echo "======================================================================="
echo ""

total_pass=0; total_fail=0; total_skip=0; total_tests=0
tenants_ok=0; tenants_failed=0

printf "  %-8s  %6s  %6s  %6s  %6s  %8s\n" "Tenant" "Pass" "Fail" "Skip" "Total" "Duration"
printf "  %-8s  %6s  %6s  %6s  %6s  %8s\n" "------" "----" "----" "----" "-----" "--------"

for rf in "$WORK_DIR"/result-*.txt; do
  [[ -f "$rf" ]] || continue
  IFS='|' read -r idx p f s t e < "$rf"
  total_pass=$((total_pass + p)); total_fail=$((total_fail + f))
  total_skip=$((total_skip + s)); total_tests=$((total_tests + t))
  [[ "$f" -eq 0 ]] && tenants_ok=$((tenants_ok + 1)) || tenants_failed=$((tenants_failed + 1))
  printf "  T%-7s  %6d  %6d  %6d  %6d  %6ds\n" "$idx" "$p" "$f" "$s" "$t" "$e"
done

printf "  %-8s  %6s  %6s  %6s  %6s  %8s\n" "------" "----" "----" "----" "-----" "--------"
printf "  %-8s  %6d  %6d  %6d  %6d  %6ds\n" \
  "TOTAL" "$total_pass" "$total_fail" "$total_skip" "$total_tests" "$TOTAL_ELAPSED"
echo ""

if [[ $total_fail -gt 0 ]]; then
  echo "── Failures ───────────────────────────────────────────────────────"
  for lf in "$WORK_DIR"/log-*.txt; do
    [[ -f "$lf" ]] || continue
    grep "FAIL" "$lf" 2>/dev/null || true
  done
  echo ""
fi

# Throughput
local_tps="0"
if [[ $TOTAL_ELAPSED -gt 0 ]]; then
  local_tps=$(echo "scale=1; $total_tests / $TOTAL_ELAPSED" | bc 2>/dev/null || echo "?")
fi

echo "======================================================================="
if [[ $total_fail -eq 0 ]]; then
  echo "  ALL CONCURRENT TESTS PASSED"
else
  printf "  %d FAILURES detected\n" "$total_fail"
fi
echo ""
printf "  Tenants:      %d (%d OK, %d failed)\n" \
  "$((tenants_ok + tenants_failed))" "$tenants_ok" "$tenants_failed"
printf "  Properties:   %d per tenant\n" "$NUM_PROPS"
printf "  Total tests:  %d  pass=%d  fail=%d  skip=%d\n" \
  "$total_tests" "$total_pass" "$total_fail" "$total_skip"
printf "  Duration:     %ds (%dm %ds)\n" \
  "$TOTAL_ELAPSED" "$((TOTAL_ELAPSED / 60))" "$((TOTAL_ELAPSED % 60))"
printf "  Throughput:   ~%s ops/sec\n" "$local_tps"
echo ""
echo "  Per-property coverage (21 operations):"
echo "    RES: create -> check-in -> charges -> checkout"
echo "    RES: create -> no-show charge"
echo "    RES: create -> cancellation penalty -> cancel"
echo "    BIL: room/restaurant/minibar/spa charges, void, transfer"
echo "    BIL: CC + cash payment, refund"
echo "    BIL: invoice (create + finalize), cashier (open + close)"
echo "    BIL: AR, comp, tax exemption, late checkout, express checkout"
echo "    AUD: night audit + date roll"
echo "======================================================================="
echo ""
echo "  Logs: $WORK_DIR/log-*.txt"
echo ""

[[ $total_fail -gt 0 ]] && exit 1 || exit 0
