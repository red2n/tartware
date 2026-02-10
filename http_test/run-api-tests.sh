#!/bin/bash
# =====================================================
# Tartware PMS — Full API Test Suite
# =====================================================
# Tests ALL gateway-registered endpoints and creates sample data
# (guests, reservations) for a complete lifecycle test.
#
# Usage:
#   ./run-api-tests.sh           # Full suite with data creation
#   ./run-api-tests.sh --quick   # GET-only, skip write commands
#
# Prerequisites:
#   1. Database seeded: executables/setup-database/setup-database.sh
#   2. Services running: npm run dev
#
# Seed Data (scripts/data/defaults/default_seed.json):
#   Tenant:    11111111-1111-1111-1111-111111111111
#   Property:  22222222-2222-2222-2222-222222222222
#   User:      33333333-3333-3333-3333-333333333333 (setup.admin)
#   Room Type: 44444444-4444-4444-4444-444444444444 (Cityline King)
#   Room 101:  55555555-5555-5555-5555-555555555551
#   Room 102:  55555555-5555-5555-5555-555555555552
#   Room 201:  55555555-5555-5555-5555-555555555553
#   Room 202:  55555555-5555-5555-5555-555555555554
#
# Swagger UI: http://localhost:8080/docs
# =====================================================

set +e  # Don't exit on first error — run all tests

BASE_URL="http://localhost:8080"
QUICK_MODE=false
[ "$1" = "--quick" ] && QUICK_MODE=true

# ── Seed data IDs ────────────────────────────────────
EXPECTED_TENANT_ID="11111111-1111-1111-1111-111111111111"
EXPECTED_PROPERTY_ID="22222222-2222-2222-2222-222222222222"
EXPECTED_ROOM_TYPE_ID="44444444-4444-4444-4444-444444444444"
EXPECTED_ROOM_101_ID="55555555-5555-5555-5555-555555555551"
EXPECTED_USER_ID="33333333-3333-3333-3333-333333333333"

# ── Discovered IDs (populated during test) ───────────
TENANT_ID=""; PROPERTY_ID=""; ROOM_TYPE_ID=""; ROOM_ID=""
GUEST_ID=""; RESERVATION_ID=""; RATE_ID=""

# ── Counters ─────────────────────────────────────────
PASS=0; FAIL=0; WARN=0; SKIP=0
PASS_LIST=""; FAIL_LIST=""; WARN_LIST=""

# ── Colors ───────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

log_pass()   { echo -e "  ${GREEN}[PASS]${NC} $1" >&2; PASS=$((PASS+1)); PASS_LIST="${PASS_LIST}\n    ${1}"; }
log_fail()   { echo -e "  ${RED}[FAIL]${NC} $1" >&2; FAIL=$((FAIL+1)); FAIL_LIST="${FAIL_LIST}\n    ${1}"; }
log_warn()   { echo -e "  ${YELLOW}[WARN]${NC} $1" >&2; WARN=$((WARN+1)); WARN_LIST="${WARN_LIST}\n    ${1}"; }
log_skip()   { echo -e "  ${CYAN}[SKIP]${NC} $1" >&2; SKIP=$((SKIP+1)); }
log_info()   { echo -e "  ${BLUE}[INFO]${NC} $1" >&2; }
log_header() {
  echo "" >&2
  echo -e "${YELLOW}═══════════════════════════════════════════${NC}" >&2
  echo -e "${YELLOW}  $1${NC}" >&2
  echo -e "${YELLOW}═══════════════════════════════════════════${NC}" >&2
}

# ─────────────────────────────────────────────────────
# test_endpoint  — generic HTTP test
#   $1  = METHOD (GET|POST|PUT|DELETE)
#   $2  = URL path (appended to BASE_URL)
#   $3  = label
#   $4+ = extra curl args (e.g. -d '{}' or -H 'x-tenant-id: ...')
# Returns response body on stdout; sets $LAST_CODE
# ─────────────────────────────────────────────────────
LAST_CODE=""
test_endpoint() {
  local method="$1" url_path="$2" label="$3"
  shift 3
  local url="${BASE_URL}${url_path}"
  local raw code body

  raw=$(curl -sS -w '\n%{http_code}' -X "$method" "$url" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -H "X-Request-ID: test-$(date +%s%N)" \
    -H "X-Idempotency-Key: idem-${RANDOM}-$(date +%s%N)" \
    "$@" 2>/dev/null)

  code=$(echo "$raw" | tail -1)
  body=$(echo "$raw" | sed '$d')
  LAST_CODE="$code"

  if [ "$code" -ge 200 ] 2>/dev/null && [ "$code" -lt 300 ] 2>/dev/null; then
    log_pass "[$code] $label"
  elif [ "$code" = "403" ]; then
    log_pass "[$code] $label (module-gated)"
  elif [ "$code" = "401" ]; then
    log_fail "[$code] $label (auth rejected)"
  elif [ "$code" = "404" ]; then
    log_warn "[$code] $label (not found / no data)"
  elif [ "$code" = "409" ]; then
    log_pass "[$code] $label (duplicate/conflict — idempotent)"
  elif [ "$code" -ge 400 ] 2>/dev/null && [ "$code" -lt 500 ] 2>/dev/null; then
    log_fail "[$code] $label"
    log_info "Body: ${body:0:200}"
  elif [ "$code" -ge 500 ] 2>/dev/null; then
    log_fail "[$code] $label (server error)"
    log_info "Body: ${body:0:200}"
  else
    log_warn "[$code] $label (unexpected)"
  fi
  echo "$body"
}

# Convenience wrappers
test_get()  { test_endpoint GET  "$@"; }
test_post() { test_endpoint POST "$@"; }

# =====================================================
# PRE-FLIGHT
# =====================================================
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Tartware PMS — Full API Test Suite${NC}"
echo -e "${BLUE}  Gateway:  $BASE_URL${NC}"
echo -e "${BLUE}  Swagger:  $BASE_URL/docs${NC}"
[ "$QUICK_MODE" = true ] && echo -e "${BLUE}  Mode:     QUICK (GET-only, no writes)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

log_info "Checking gateway health..."
HEALTH=$(curl -sS "$BASE_URL/health" 2>/dev/null)
if echo "$HEALTH" | grep -q '"status"'; then
  log_pass "Gateway healthy"
else
  log_fail "Gateway not reachable at $BASE_URL"
  echo "  Start services first:  npm run dev"
  exit 1
fi

# =====================================================
# 1. AUTHENTICATION
# =====================================================
log_header "1. AUTHENTICATION"

log_info "Logging in as setup.admin..."
LOGIN_RESPONSE=$(curl -sS -X POST "$BASE_URL/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"setup.admin","password":"TempPass123"}')

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
  log_pass "Login successful (token: ${#TOKEN} chars)"
else
  log_fail "Login failed: $LOGIN_RESPONSE"
  exit 1
fi

# Auth context
test_get "/v1/auth/context" "Auth context" > /dev/null

# =====================================================
# 2. TENANTS
# =====================================================
log_header "2. TENANTS"

TENANTS_BODY=$(test_get "/v1/tenants?limit=10" "List tenants" 2>/dev/null)
TENANT_ID=$(echo "$TENANTS_BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
TENANT_NAME=$(echo "$TENANTS_BODY" | grep -o '"name":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$TENANT_ID" ]; then
  log_info "Tenant: $TENANT_NAME ($TENANT_ID)"
else
  log_fail "No tenants found — database may not be seeded"
  exit 1
fi

# =====================================================
# 3. PROPERTIES
# =====================================================
log_header "3. PROPERTIES"

PROPS_BODY=$(test_get "/v1/properties?tenant_id=$TENANT_ID&limit=10" "List properties" 2>/dev/null)
PROPERTY_ID=$(echo "$PROPS_BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
PROPERTY_NAME=$(echo "$PROPS_BODY" | grep -o '"property_name":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$PROPERTY_ID" ]; then
  log_info "Property: $PROPERTY_NAME ($PROPERTY_ID)"
else
  log_fail "No properties found"
  exit 1
fi

# Query string fragment reused in every read request
QS="tenant_id=$TENANT_ID&property_id=$PROPERTY_ID"

# =====================================================
# 4. MODULES
# =====================================================
log_header "4. MODULES"

test_get "/v1/modules/catalog" "Modules catalog" > /dev/null
test_get "/v1/tenants/$TENANT_ID/modules" "Tenant modules" > /dev/null

# =====================================================
# 5. ROOM TYPES
# =====================================================
log_header "5. ROOM TYPES"

RT_BODY=$(test_get "/v1/room-types?$QS&limit=10" "List room types" 2>/dev/null)
ROOM_TYPE_ID=$(echo "$RT_BODY" | grep -o '"room_type_id":"[^"]*"' | head -1 | cut -d'"' -f4)
ROOM_TYPE_NAME=$(echo "$RT_BODY" | grep -o '"type_name":"[^"]*"' | head -1 | cut -d'"' -f4)
[ -n "$ROOM_TYPE_ID" ] && log_info "Room type: $ROOM_TYPE_NAME ($ROOM_TYPE_ID)"

# =====================================================
# 6. ROOMS
# =====================================================
log_header "6. ROOMS"

ROOMS_BODY=$(test_get "/v1/rooms?$QS&limit=10" "List rooms" 2>/dev/null)
ROOM_ID=$(echo "$ROOMS_BODY" | grep -o '"room_id":"[^"]*"' | head -1 | cut -d'"' -f4)
ROOM_NUMBER=$(echo "$ROOMS_BODY" | grep -o '"room_number":"[^"]*"' | head -1 | cut -d'"' -f4)
[ -n "$ROOM_ID" ] && log_info "Room: $ROOM_NUMBER ($ROOM_ID)"

# =====================================================
# 7. RATES
# =====================================================
log_header "7. RATES"

RATES_BODY=$(test_get "/v1/rates?$QS&limit=10" "List rates" 2>/dev/null)
RATE_ID=$(echo "$RATES_BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
RATE_CODE=$(echo "$RATES_BODY" | grep -o '"rate_code":"[^"]*"' | head -1 | cut -d'"' -f4)
[ -n "$RATE_ID" ] && log_info "Rate: $RATE_CODE ($RATE_ID)"

# =====================================================
# 8. GUESTS (read)
# =====================================================
log_header "8. GUESTS (Read)"

# NOTE: Guest list must NOT include property_id — the filter requires reservations to exist
GUESTS_BODY=$(test_get "/v1/guests?tenant_id=$TENANT_ID&limit=10" "List guests")
GUEST_ID=$(echo "$GUESTS_BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
[ -n "$GUEST_ID" ] && log_info "Existing guest: $GUEST_ID"

# =====================================================
# 9. GUEST REGISTRATION (write command)
# =====================================================
log_header "9. GUEST REGISTRATION (Write)"

if [ "$QUICK_MODE" = true ]; then
  log_skip "Guest registration (--quick mode)"
else
  TS=$(date +%s)

  # Register via REST route (POST /v1/guests → Kafka guest.register)
  GREG_BODY=$(test_post "/v1/guests" \
    "Register guest (REST route)" \
    -d "{
      \"tenant_id\": \"$TENANT_ID\",
      \"property_id\": \"$PROPERTY_ID\",
      \"first_name\": \"API\",
      \"last_name\": \"TestGuest-$TS\",
      \"email\": \"api.guest.$TS@tartware.test\",
      \"phone\": \"+1-555-$(printf '%03d' $((RANDOM % 1000)))-$(printf '%04d' $((RANDOM % 10000)))\",
      \"address\": {
        \"street\": \"100 Test Street\",
        \"city\": \"New York\",
        \"state\": \"NY\",
        \"country\": \"US\",
        \"postal_code\": \"10001\"
      },
      \"preferences\": {
        \"marketing_consent\": true,
        \"notes\": \"Created by run-api-tests.sh\"
      }
    }" 2>/dev/null)

  # Also register via command center (POST /v1/commands/guest.register/execute)
  GREG2_BODY=$(test_post "/v1/commands/guest.register/execute" \
    "Register guest (command center)" \
    -d "{
      \"tenant_id\": \"$TENANT_ID\",
      \"payload\": {
        \"first_name\": \"CMD\",
        \"last_name\": \"TestGuest-$TS\",
        \"email\": \"cmd.guest.$TS@tartware.test\"
      }
    }" 2>/dev/null)

  # Wait for async Kafka processing with retry
  log_info "Waiting for guest Kafka processing..."
  GUEST_ID=""
  for RETRY in 1 2 3 4 5; do
    sleep 2
    GUESTS_BODY=$(curl -sS "$BASE_URL/v1/guests?tenant_id=$TENANT_ID&limit=10" \
      -H "Authorization: Bearer $TOKEN" 2>/dev/null)
    GUEST_ID=$(echo "$GUESTS_BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    if [ -n "$GUEST_ID" ]; then
      break
    fi
    log_info "Retry $RETRY/5 — guest not available yet..."
  done

  if [ -n "$GUEST_ID" ]; then
    log_pass "Guest available after registration: $GUEST_ID"
  else
    log_warn "Guest not available after 10s — reservations may fail (FK constraint)"
    log_info "Reservation tests require a valid guest_id in the guests table"
  fi
fi

# =====================================================
# 10. RESERVATION CREATE (write command)
# =====================================================
log_header "10. RESERVATION CREATE (Write)"

if [ "$QUICK_MODE" = true ]; then
  log_skip "Reservation creation (--quick mode)"
elif [ -z "$GUEST_ID" ]; then
  log_warn "Skipping reservation creation — no valid guest_id (FK fk_reservations_guest_id)"
  log_info "Guest registration must succeed first for reservations to work"
else
  RT_FOR_RES="${ROOM_TYPE_ID:-$EXPECTED_ROOM_TYPE_ID}"

  # Create via REST route (POST /v1/tenants/:tenantId/reservations → Kafka reservation.create)
  RES_BODY=$(test_post "/v1/tenants/$TENANT_ID/reservations" \
    "Create reservation (REST route)" \
    -d "{
      \"property_id\": \"$PROPERTY_ID\",
      \"guest_id\": \"$GUEST_ID\",
      \"room_type_id\": \"$RT_FOR_RES\",
      \"check_in_date\": \"2026-03-15\",
      \"check_out_date\": \"2026-03-18\",
      \"total_amount\": 627.00,
      \"rate_code\": \"BAR\",
      \"source\": \"DIRECT\",
      \"currency\": \"USD\",
      \"notes\": \"Created by run-api-tests.sh REST\"
    }" 2>/dev/null)

  # Also create via command center
  RES2_BODY=$(test_post "/v1/commands/reservation.create/execute" \
    "Create reservation (command center)" \
    -d "{
      \"tenant_id\": \"$TENANT_ID\",
      \"payload\": {
        \"property_id\": \"$PROPERTY_ID\",
        \"guest_id\": \"$GUEST_ID\",
        \"room_type_id\": \"$RT_FOR_RES\",
        \"check_in_date\": \"2026-04-01\",
        \"check_out_date\": \"2026-04-03\",
        \"total_amount\": 418.00,
        \"rate_code\": \"BAR\",
        \"source\": \"WEBSITE\",
        \"currency\": \"USD\",
        \"notes\": \"Created by run-api-tests.sh CMD\"
      }
    }" 2>/dev/null)

  # Wait for async processing with retry
  log_info "Waiting for reservation command processing..."
  RESERVATION_ID=""
  for RETRY in 1 2 3 4 5; do
    sleep 2
    RES_CHECK=$(curl -sS "$BASE_URL/v1/reservations?$QS&limit=50" \
      -H "Authorization: Bearer $TOKEN" 2>/dev/null)
    RESERVATION_ID=$(echo "$RES_CHECK" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    if [ -n "$RESERVATION_ID" ]; then
      break
    fi
    log_info "Retry $RETRY/5 — reservation not materialized yet..."
  done

  RES_COUNT=$(echo "$RES_CHECK" | grep -o '"id":"[^"]*"' | wc -l)
  if [ -n "$RESERVATION_ID" ]; then
    log_pass "Reservations in DB: $RES_COUNT (first: $RESERVATION_ID)"
  else
    log_warn "No reservations found after 10s — check DLQ for errors"
  fi
fi

# =====================================================
# 11. RESERVATIONS (read)
# =====================================================
log_header "11. RESERVATIONS (Read)"

test_get "/v1/reservations?$QS&limit=50" "List all reservations" > /dev/null
test_get "/v1/reservations?$QS&status=confirmed" "Reservations by status" > /dev/null

if [ -n "$RESERVATION_ID" ]; then
  test_get "/v1/reservations/$RESERVATION_ID?$QS" "Single reservation" > /dev/null
fi

# =====================================================
# 12. DASHBOARD & REPORTS
# =====================================================
log_header "12. DASHBOARD & REPORTS"

test_get "/v1/dashboard/stats?$QS" "Dashboard stats" > /dev/null
test_get "/v1/dashboard/activities?$QS&limit=10" "Dashboard activities" > /dev/null
test_get "/v1/reports/occupancy?$QS" "Occupancy report" > /dev/null

# =====================================================
# 13. BILLING
# =====================================================
log_header "13. BILLING"

test_get "/v1/billing/payments?$QS" "Billing payments" > /dev/null
test_get "/v1/billing/invoices?$QS" "Billing invoices" > /dev/null
test_get "/v1/billing/folios?$QS" "Billing folios" > /dev/null
test_get "/v1/billing/charges?$QS" "Billing charges" > /dev/null
test_get "/v1/billing/tax-configurations?$QS" "Tax configurations" > /dev/null

# =====================================================
# 14. HOUSEKEEPING
# =====================================================
log_header "14. HOUSEKEEPING"

test_get "/v1/housekeeping/tasks?$QS" "Housekeeping tasks" > /dev/null
test_get "/v1/housekeeping/schedules?$QS" "Housekeeping schedules" > /dev/null
test_get "/v1/housekeeping/inspections?$QS" "Housekeeping inspections" > /dev/null

# =====================================================
# 15. COMMAND CENTER
# =====================================================
log_header "15. COMMAND CENTER"

test_get "/v1/commands/definitions" "Command definitions" > /dev/null

# =====================================================
# 16. RECOMMENDATIONS
# =====================================================
log_header "16. RECOMMENDATIONS"

test_get "/v1/recommendations?tenantId=$TENANT_ID&propertyId=$PROPERTY_ID&checkInDate=2026-03-01&checkOutDate=2026-03-03&adults=2" \
  "Room recommendations" \
  -H "x-tenant-id: $TENANT_ID" > /dev/null

# =====================================================
# 17. NOTIFICATIONS
# =====================================================
log_header "17. NOTIFICATIONS"

test_get "/v1/tenants/$TENANT_ID/notifications/templates" "Notification templates" > /dev/null

if [ -n "$GUEST_ID" ]; then
  test_get "/v1/tenants/$TENANT_ID/notifications/guests/$GUEST_ID/communications" \
    "Guest communications" > /dev/null
fi

# =====================================================
# 18. NIGHT AUDIT
# =====================================================
log_header "18. NIGHT AUDIT"

test_get "/v1/night-audit/status?$QS" "Night audit status" > /dev/null
test_get "/v1/night-audit/history?$QS" "Night audit history" > /dev/null

# =====================================================
# 19. OTA & PROMO CODES
# =====================================================
log_header "19. OTA & PROMO CODES"

test_get "/v1/ota-connections?$QS" "OTA connections" > /dev/null
test_get "/v1/promo-codes?$QS" "Promo codes" > /dev/null

# =====================================================
# 20. OPERATIONS (Front Desk)
# =====================================================
log_header "20. OPERATIONS (Front Desk)"

test_get "/v1/cashier-sessions?$QS" "Cashier sessions" > /dev/null
test_get "/v1/shift-handovers?$QS" "Shift handovers" > /dev/null
test_get "/v1/lost-and-found?$QS" "Lost & found" > /dev/null
test_get "/v1/banquet-orders?$QS" "Banquet orders" > /dev/null
test_get "/v1/guest-feedback?$QS" "Guest feedback" > /dev/null
test_get "/v1/police-reports?$QS" "Police reports" > /dev/null

# =====================================================
# 21. BOOKING CONFIGURATION
# =====================================================
log_header "21. BOOKING CONFIGURATION"

test_get "/v1/allotments?$QS" "Allotments" > /dev/null
test_get "/v1/booking-sources?$QS" "Booking sources" > /dev/null
test_get "/v1/market-segments?$QS" "Market segments" > /dev/null
test_get "/v1/channel-mappings?$QS" "Channel mappings" > /dev/null
test_get "/v1/companies?$QS" "Companies" > /dev/null
test_get "/v1/meeting-rooms?$QS" "Meeting rooms" > /dev/null
test_get "/v1/event-bookings?$QS" "Event bookings" > /dev/null
test_get "/v1/waitlist?$QS" "Waitlist" > /dev/null
test_get "/v1/group-bookings?$QS" "Group bookings" > /dev/null

# =====================================================
# 22. SETTINGS SERVICE
# =====================================================
log_header "22. SETTINGS SERVICE"
log_info "Known issue: Settings uses RS256 JWT — HS256 tokens return 401"

test_get "/v1/settings?$QS" "Settings (expect 401)" > /dev/null

# =====================================================
# 23. SWAGGER / OPENAPI
# =====================================================
log_header "23. SWAGGER / OPENAPI"

SWAGGER_CODE=$(curl -sS -o /dev/null -w '%{http_code}' "$BASE_URL/docs/json" 2>/dev/null)
if [ "$SWAGGER_CODE" = "200" ]; then
  ROUTE_COUNT=$(curl -sS "$BASE_URL/docs/json" 2>/dev/null | grep -o '"/' | wc -l)
  log_pass "Swagger JSON at /docs/json ($ROUTE_COUNT paths)"
else
  log_warn "Swagger JSON not accessible (HTTP $SWAGGER_CODE)"
fi

SWAGGER_UI=$(curl -sS -o /dev/null -w '%{http_code}' "$BASE_URL/docs" 2>/dev/null)
if [ "$SWAGGER_UI" = "200" ] || [ "$SWAGGER_UI" = "302" ]; then
  log_pass "Swagger UI renders at /docs"
else
  log_warn "Swagger UI not accessible (HTTP $SWAGGER_UI)"
fi

# =====================================================
# 24. SEED DATA VALIDATION
# =====================================================
log_header "24. SEED DATA VALIDATION"

MATCH_COUNT=0
[ "$TENANT_ID" = "$EXPECTED_TENANT_ID" ]       && { log_pass "Tenant ID matches seed";    MATCH_COUNT=$((MATCH_COUNT+1)); } || log_warn "Tenant: expected $EXPECTED_TENANT_ID, got $TENANT_ID"
[ "$PROPERTY_ID" = "$EXPECTED_PROPERTY_ID" ]   && { log_pass "Property ID matches seed";  MATCH_COUNT=$((MATCH_COUNT+1)); } || log_warn "Property: expected $EXPECTED_PROPERTY_ID, got $PROPERTY_ID"
[ "$ROOM_TYPE_ID" = "$EXPECTED_ROOM_TYPE_ID" ] && { log_pass "Room Type ID matches seed"; MATCH_COUNT=$((MATCH_COUNT+1)); } || log_warn "Room Type: expected $EXPECTED_ROOM_TYPE_ID, got $ROOM_TYPE_ID"
[ "$ROOM_ID" = "$EXPECTED_ROOM_101_ID" ]       && { log_pass "Room 101 ID matches seed";  MATCH_COUNT=$((MATCH_COUNT+1)); } || log_info "Room: $ROOM_ID (seed: $EXPECTED_ROOM_101_ID)"

# =====================================================
# FINAL REPORT
# =====================================================
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  FINAL RESULTS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${GREEN}PASS${NC}: $PASS"
echo -e "  ${RED}FAIL${NC}: $FAIL"
echo -e "  ${YELLOW}WARN${NC}: $WARN (404 / no data)"
[ "$SKIP" -gt 0 ] && echo -e "  ${CYAN}SKIP${NC}: $SKIP"
echo -e "  TOTAL: $((PASS + FAIL + WARN + SKIP))"
echo ""

if [ -n "$FAIL_LIST" ]; then
  echo -e "  ${RED}FAILURES:${NC}"
  echo -e "$FAIL_LIST"
  echo ""
fi

if [ -n "$WARN_LIST" ]; then
  echo -e "  ${YELLOW}WARNINGS (not blocking):${NC}"
  echo -e "$WARN_LIST"
  echo ""
fi

echo "  Discovered IDs:"
echo "  ─────────────────────────────────────────"
echo "  TENANT_ID=$TENANT_ID"
echo "  PROPERTY_ID=$PROPERTY_ID"
echo "  ROOM_TYPE_ID=$ROOM_TYPE_ID"
echo "  ROOM_ID=$ROOM_ID"
echo "  RATE_ID=$RATE_ID"
[ -n "$GUEST_ID" ]       && echo "  GUEST_ID=$GUEST_ID"
[ -n "$RESERVATION_ID" ] && echo "  RESERVATION_ID=$RESERVATION_ID"
echo ""
echo "  Swagger UI:    $BASE_URL/docs"
echo "  Seed matches:  $MATCH_COUNT/4"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ "$FAIL" -eq 0 ]; then
  echo -e "  ${GREEN}All tests passed!${NC}"
elif [ "$FAIL" -le 2 ]; then
  echo -e "  ${YELLOW}Tests completed with minor issues.${NC}"
else
  echo -e "  ${RED}Tests completed with failures.${NC}"
fi

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

exit $FAIL
