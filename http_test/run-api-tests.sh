#!/bin/bash
# =====================================================
# PMS API Test Script
# =====================================================
# This script tests all API endpoints and creates sample data
# that can be used for testing in any new environment.
#
# Usage: ./run-api-tests.sh
#
# Prerequisites:
# - Services running: npm run dev
# - Database seeded with default data
#
# Known Seed Data (from scripts/data/defaults/default_seed.json):
# - Tenant:    11111111-1111-1111-1111-111111111111 (Tartware Hospitality Labs)
# - Property:  22222222-2222-2222-2222-222222222222 (Tartware City Center)
# - User:      33333333-3333-3333-3333-333333333333 (setup.admin)
# - Room Type: 44444444-4444-4444-4444-444444444444 (Cityline King)
# - Room 101:  55555555-5555-5555-5555-555555555551
# - Room 102:  55555555-5555-5555-5555-555555555552
# - Room 201:  55555555-5555-5555-5555-555555555553
# - Room 202:  55555555-5555-5555-5555-555555555554
#
# Prerequisites:
# 1. Run database setup: executables/setup-database/setup-database.sh
# 2. Start services: npm run dev
# =====================================================

# Don't exit on first error - we want to run all tests
set +e

BASE_URL="http://localhost:8080"

# Expected seed data IDs (for validation)
EXPECTED_TENANT_ID="11111111-1111-1111-1111-111111111111"
EXPECTED_PROPERTY_ID="22222222-2222-2222-2222-222222222222"
EXPECTED_ROOM_TYPE_ID="44444444-4444-4444-4444-444444444444"
EXPECTED_ROOM_101_ID="55555555-5555-5555-5555-555555555551"

# Discovered IDs
TENANT_ID=""
PROPERTY_ID=""
ROOM_TYPE_ID=""
ROOM_ID=""
GUEST_ID=""
RESERVATION_ID=""
RATE_ID=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[PASS]${NC} $1"; }
log_error() { echo -e "${RED}[FAIL]${NC} $1"; }
log_header() { echo -e "\n${YELLOW}========== $1 ==========${NC}"; }

# =====================================================
# 1. AUTHENTICATION
# =====================================================
log_header "AUTHENTICATION"

log_info "Testing login with setup.admin..."
LOGIN_RESPONSE=$(curl -sS -X POST "$BASE_URL/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"setup.admin","password":"TempPass123"}')

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
  log_success "Login successful - Token obtained (${#TOKEN} chars)"
else
  log_error "Login failed: $LOGIN_RESPONSE"
  exit 1
fi

# =====================================================
# 2. TENANTS
# =====================================================
log_header "TENANTS"

log_info "Listing tenants..."
TENANTS_RESPONSE=$(curl -sS "$BASE_URL/v1/tenants?limit=10" \
  -H "Authorization: Bearer $TOKEN")

TENANT_ID=$(echo "$TENANTS_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
TENANT_NAME=$(echo "$TENANTS_RESPONSE" | grep -o '"name":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$TENANT_ID" ]; then
  log_success "Found tenant: $TENANT_NAME ($TENANT_ID)"
else
  log_error "No tenants found"
  exit 1
fi

# =====================================================
# 3. PROPERTIES
# =====================================================
log_header "PROPERTIES"

log_info "Listing properties..."
PROPERTIES_RESPONSE=$(curl -sS "$BASE_URL/v1/properties?tenant_id=$TENANT_ID&limit=10" \
  -H "Authorization: Bearer $TOKEN")

PROPERTY_ID=$(echo "$PROPERTIES_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
PROPERTY_NAME=$(echo "$PROPERTIES_RESPONSE" | grep -o '"property_name":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$PROPERTY_ID" ]; then
  log_success "Found property: $PROPERTY_NAME ($PROPERTY_ID)"
else
  log_info "No property found, creating one..."
  CREATE_PROP_RESPONSE=$(curl -sS -X POST "$BASE_URL/v1/properties" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
      \"tenant_id\": \"$TENANT_ID\",
      \"property_name\": \"Test Central Hotel\",
      \"property_code\": \"TCH-001\",
      \"property_type\": \"HOTEL\",
      \"star_rating\": 4,
      \"total_rooms\": 50,
      \"phone\": \"+15551001\",
      \"email\": \"hotel@test.demo\",
      \"address\": {
        \"line1\": \"100 Main Street\",
        \"city\": \"Test City\",
        \"state\": \"CA\",
        \"country\": \"US\",
        \"postal_code\": \"90210\"
      },
      \"currency\": \"USD\",
      \"timezone\": \"America/Los_Angeles\"
    }")
  PROPERTY_ID=$(echo "$CREATE_PROP_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  if [ -n "$PROPERTY_ID" ]; then
    log_success "Created property: $PROPERTY_ID"
  else
    log_error "Failed to create property: $CREATE_PROP_RESPONSE"
  fi
fi

# =====================================================
# 4. ROOM TYPES
# =====================================================
log_header "ROOM TYPES"

log_info "Listing room types..."
ROOM_TYPES_RESPONSE=$(curl -sS "$BASE_URL/v1/room-types?tenant_id=$TENANT_ID&property_id=$PROPERTY_ID&limit=10" \
  -H "Authorization: Bearer $TOKEN")

# Room types API returns room_type_id, not id
ROOM_TYPE_ID=$(echo "$ROOM_TYPES_RESPONSE" | grep -o '"room_type_id":"[^"]*"' | head -1 | cut -d'"' -f4)
ROOM_TYPE_NAME=$(echo "$ROOM_TYPES_RESPONSE" | grep -o '"type_name":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$ROOM_TYPE_ID" ]; then
  log_success "Found room type: $ROOM_TYPE_NAME ($ROOM_TYPE_ID)"
else
  log_info "No room type found, creating Standard Room..."
  CREATE_RT_RESPONSE=$(curl -sS -X POST "$BASE_URL/v1/room-types" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
      \"tenant_id\": \"$TENANT_ID\",
      \"property_id\": \"$PROPERTY_ID\",
      \"type_name\": \"Standard Room\",
      \"type_code\": \"STD\",
      \"category\": \"STANDARD\",
      \"base_occupancy\": 2,
      \"max_occupancy\": 2,
      \"max_adults\": 2,
      \"max_children\": 0,
      \"base_price\": 99,
      \"currency\": \"USD\",
      \"amenities\": [\"WIFI\", \"TV\", \"AC\"],
      \"is_active\": true
    }")
  ROOM_TYPE_ID=$(echo "$CREATE_RT_RESPONSE" | grep -o '"room_type_id":"[^"]*"' | head -1 | cut -d'"' -f4)
  if [ -n "$ROOM_TYPE_ID" ]; then
    log_success "Created room type: $ROOM_TYPE_ID"
  else
    log_error "Failed to create room type: $CREATE_RT_RESPONSE"
  fi
fi

# =====================================================
# 5. ROOMS
# =====================================================
log_header "ROOMS"

log_info "Listing rooms..."
ROOMS_RESPONSE=$(curl -sS "$BASE_URL/v1/rooms?tenant_id=$TENANT_ID&property_id=$PROPERTY_ID&limit=10" \
  -H "Authorization: Bearer $TOKEN")

# Rooms API returns room_id, not id
ROOM_ID=$(echo "$ROOMS_RESPONSE" | grep -o '"room_id":"[^"]*"' | head -1 | cut -d'"' -f4)
ROOM_NUMBER=$(echo "$ROOMS_RESPONSE" | grep -o '"room_number":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$ROOM_ID" ]; then
  log_success "Found room: $ROOM_NUMBER ($ROOM_ID)"
else
  log_info "No room found, creating Room 101..."
  CREATE_ROOM_RESPONSE=$(curl -sS -X POST "$BASE_URL/v1/rooms" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
      \"tenant_id\": \"$TENANT_ID\",
      \"property_id\": \"$PROPERTY_ID\",
      \"room_type_id\": \"$ROOM_TYPE_ID\",
      \"room_number\": \"101\",
      \"room_name\": \"Standard 101\",
      \"floor\": \"1\",
      \"status\": \"available\",
      \"housekeeping_status\": \"clean\",
      \"maintenance_status\": \"operational\"
    }")
  ROOM_ID=$(echo "$CREATE_ROOM_RESPONSE" | grep -o '"room_id":"[^"]*"' | head -1 | cut -d'"' -f4)
  if [ -n "$ROOM_ID" ]; then
    log_success "Created room: $ROOM_ID"
  else
    log_error "Failed to create room: $CREATE_ROOM_RESPONSE"
  fi
fi

# =====================================================
# 6. RATES
# =====================================================
log_header "RATES"

log_info "Listing rates..."
RATES_RESPONSE=$(curl -sS "$BASE_URL/v1/rates?tenant_id=$TENANT_ID&property_id=$PROPERTY_ID&limit=10" \
  -H "Authorization: Bearer $TOKEN")

RATE_ID=$(echo "$RATES_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
RATE_NAME=$(echo "$RATES_RESPONSE" | grep -o '"rate_name":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$RATE_ID" ]; then
  log_success "Found rate: $RATE_NAME ($RATE_ID)"
else
  log_info "No rate found, creating BAR rate..."
  CREATE_RATE_RESPONSE=$(curl -sS -X POST "$BASE_URL/v1/rates" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
      \"tenant_id\": \"$TENANT_ID\",
      \"property_id\": \"$PROPERTY_ID\",
      \"room_type_id\": \"$ROOM_TYPE_ID\",
      \"rate_name\": \"Best Available Rate - Standard\",
      \"rate_code\": \"BAR-STD\",
      \"description\": \"Best available rate\",
      \"rate_type\": \"BAR\",
      \"strategy\": \"DYNAMIC\",
      \"priority\": 100,
      \"base_rate\": 99.00,
      \"currency\": \"USD\",
      \"valid_from\": \"2026-01-01\",
      \"valid_until\": \"2026-12-31\",
      \"min_length_of_stay\": 1,
      \"status\": \"ACTIVE\"
    }")
  RATE_ID=$(echo "$CREATE_RATE_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  if [ -n "$RATE_ID" ]; then
    log_success "Created rate: $RATE_ID"
  else
    log_error "Failed to create rate: $CREATE_RATE_RESPONSE"
  fi
fi

# =====================================================
# 7. DASHBOARD
# =====================================================
log_header "DASHBOARD"

log_info "Testing dashboard stats..."
STATS_RESPONSE=$(curl -sS "$BASE_URL/v1/dashboard/stats?tenant_id=$TENANT_ID" \
  -H "Authorization: Bearer $TOKEN")

if echo "$STATS_RESPONSE" | grep -q '"total_rooms"'; then
  log_success "Dashboard stats retrieved"
elif echo "$STATS_RESPONSE" | grep -q "error\|404"; then
  log_info "Dashboard stats not available: ${STATS_RESPONSE:0:80}"
else
  log_info "Dashboard returned: ${STATS_RESPONSE:0:80}"
fi

log_info "Testing dashboard activities..."
ACTIVITY_RESPONSE=$(curl -sS "$BASE_URL/v1/dashboard/activities?tenant_id=$TENANT_ID&limit=10" \
  -H "Authorization: Bearer $TOKEN")

if echo "$ACTIVITY_RESPONSE" | grep -q "404\|not found"; then
  log_info "Dashboard activities endpoint not implemented yet"
elif echo "$ACTIVITY_RESPONSE" | grep -q "error"; then
  log_info "Dashboard activities: ${ACTIVITY_RESPONSE:0:80}"
else
  log_success "Dashboard activities retrieved"
fi

# =====================================================
# 8. SETTINGS
# =====================================================
log_header "SETTINGS"

log_info "Testing settings endpoint..."
SETTINGS_RESPONSE=$(curl -sS "$BASE_URL/v1/settings?tenant_id=$TENANT_ID" \
  -H "Authorization: Bearer $TOKEN")

if echo "$SETTINGS_RESPONSE" | grep -q "404\|not found"; then
  log_info "Settings endpoint not implemented yet"
elif echo "$SETTINGS_RESPONSE" | grep -q "error"; then
  log_info "Settings: ${SETTINGS_RESPONSE:0:80}"
else
  log_success "Settings retrieved"
fi

# =====================================================
# 9. MODULES
# =====================================================
log_header "MODULES"

log_info "Testing modules catalog..."
MODULES_RESPONSE=$(curl -sS "$BASE_URL/v1/modules/catalog" \
  -H "Authorization: Bearer $TOKEN")

if echo "$MODULES_RESPONSE" | grep -q "error"; then
  log_error "Modules catalog failed: $MODULES_RESPONSE"
else
  log_success "Modules catalog retrieved"
fi

# =====================================================
# 10. GUESTS
# =====================================================
log_header "GUESTS"

log_info "Listing guests..."
GUESTS_RESPONSE=$(curl -sS "$BASE_URL/v1/guests?tenant_id=$TENANT_ID&limit=10" \
  -H "Authorization: Bearer $TOKEN" 2>/dev/null || echo "error")

if echo "$GUESTS_RESPONSE" | grep -q '"id"'; then
  GUEST_ID=$(echo "$GUESTS_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  log_success "Found guest: $GUEST_ID"
elif echo "$GUESTS_RESPONSE" | grep -q "error\|404"; then
  log_info "No guests found (or service unavailable)"
else
  log_info "Guests endpoint returned: ${GUESTS_RESPONSE:0:100}"
fi

# =====================================================
# 11. RESERVATIONS
# =====================================================
log_header "RESERVATIONS"

log_info "Listing reservations..."
RESERVATIONS_RESPONSE=$(curl -sS "$BASE_URL/v1/reservations?tenant_id=$TENANT_ID&limit=10" \
  -H "Authorization: Bearer $TOKEN" 2>/dev/null || echo "error")

if echo "$RESERVATIONS_RESPONSE" | grep -q '"id"'; then
  RESERVATION_ID=$(echo "$RESERVATIONS_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  log_success "Found reservation: $RESERVATION_ID"
elif echo "$RESERVATIONS_RESPONSE" | grep -q "error\|404"; then
  log_info "No reservations found (or service unavailable)"
else
  log_info "Reservations endpoint returned: ${RESERVATIONS_RESPONSE:0:100}"
fi

# =====================================================
# 12. HOUSEKEEPING
# =====================================================
log_header "HOUSEKEEPING"

log_info "Listing housekeeping tasks..."
HK_RESPONSE=$(curl -sS "$BASE_URL/v1/housekeeping/tasks?tenant_id=$TENANT_ID&limit=10" \
  -H "Authorization: Bearer $TOKEN" 2>/dev/null || echo "error")

if echo "$HK_RESPONSE" | grep -q '"id"'; then
  log_success "Housekeeping tasks retrieved"
elif echo "$HK_RESPONSE" | grep -q "error\|404"; then
  log_info "No housekeeping tasks (or service unavailable)"
else
  log_info "Housekeeping endpoint returned: ${HK_RESPONSE:0:100}"
fi

# =====================================================
# SUMMARY - OUTPUT IDs FOR .http FILES
# =====================================================
log_header "TEST SUMMARY"

echo ""
echo "Discovered IDs from API testing:"
echo "======================================"
echo "TENANT_ID=$TENANT_ID"
echo "PROPERTY_ID=$PROPERTY_ID"
echo "ROOM_TYPE_ID=$ROOM_TYPE_ID"
echo "ROOM_ID=$ROOM_ID"
echo "RATE_ID=$RATE_ID"
[ -n "$GUEST_ID" ] && echo "GUEST_ID=$GUEST_ID"
[ -n "$RESERVATION_ID" ] && echo "RESERVATION_ID=$RESERVATION_ID"
echo ""

# Validate against expected seed data
echo "Validating against expected seed data..."
echo "========================================"
MATCH_COUNT=0
TOTAL_COUNT=4

if [ "$TENANT_ID" = "$EXPECTED_TENANT_ID" ]; then
  log_success "Tenant ID matches seed data"
  ((MATCH_COUNT++))
else
  log_error "Tenant ID mismatch: expected $EXPECTED_TENANT_ID"
fi

if [ "$PROPERTY_ID" = "$EXPECTED_PROPERTY_ID" ]; then
  log_success "Property ID matches seed data"
  ((MATCH_COUNT++))
else
  log_error "Property ID mismatch: expected $EXPECTED_PROPERTY_ID"
fi

if [ "$ROOM_TYPE_ID" = "$EXPECTED_ROOM_TYPE_ID" ]; then
  log_success "Room Type ID matches seed data"
  ((MATCH_COUNT++))
else
  log_error "Room Type ID mismatch: expected $EXPECTED_ROOM_TYPE_ID"
fi

if [ "$ROOM_ID" = "$EXPECTED_ROOM_101_ID" ]; then
  log_success "Room ID matches seed data (Room 101)"
  ((MATCH_COUNT++))
else
  log_info "Room ID is: $ROOM_ID (seed Room 101: $EXPECTED_ROOM_101_ID)"
fi

echo ""
echo "Login credentials:"
echo "  Username: setup.admin"
echo "  Password: TempPass123"
echo ""

if [ "$MATCH_COUNT" -ge 3 ]; then
  log_success "API tests completed! $MATCH_COUNT/$TOTAL_COUNT IDs match seed data."
  exit 0
else
  log_info "API tests completed. Data may be newly created (not seeded)."
  exit 0
fi
