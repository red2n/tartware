#!/usr/bin/env bash
###############################################################################
# Guest Portal API Test Script
#
# Tests the guest self-service flow end-to-end:
#   1. Search availability
#   2. Create a booking
#   3. Look up the booking
#
# Usage: ./http_test/test-guest-portal.sh
###############################################################################
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080}"
TENANT_ID="11111111-1111-1111-1111-111111111111"
PROPERTY_ID="22222222-2222-2222-2222-222222222222"
ROOM_TYPE_ID="44444444-4444-4444-4444-444444444444"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass=0
fail=0

check() {
  local name="$1" status="$2" body="$3"
  if [[ "$status" -ge 200 && "$status" -lt 300 ]]; then
    echo -e "${GREEN}✓ ${name}${NC} (HTTP ${status})"
    ((pass++))
  else
    echo -e "${RED}✗ ${name}${NC} (HTTP ${status})"
    echo "  Response: ${body:0:300}"
    ((fail++))
  fi
}

echo "=============================================="
echo " Guest Portal API Tests"
echo " Base URL: ${BASE_URL}"
echo "=============================================="
echo ""

# ── 1. Search Availability ──────────────────────────────
echo "── Availability Search ──"

RESPONSE=$(curl -s -w "\n%{http_code}" \
  "${BASE_URL}/v1/self-service/search?tenant_id=${TENANT_ID}&property_id=${PROPERTY_ID}&check_in_date=2026-06-01&check_out_date=2026-06-03&adults=2&children=0")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
check "Search availability (2 adults)" "$HTTP_CODE" "$BODY"

if [[ "$HTTP_CODE" == "200" ]]; then
  echo "  Results: $(echo "$BODY" | grep -o '"roomTypeId"' | wc -l) room type(s)"
fi

# ── 2. Create Booking ──────────────────────────────
echo ""
echo "── Create Booking ──"

IDEMPOTENCY_KEY="portal-test-$(date +%s)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  "${BASE_URL}/v1/self-service/book" \
  -d "{
    \"tenant_id\": \"${TENANT_ID}\",
    \"property_id\": \"${PROPERTY_ID}\",
    \"guest_email\": \"portal.test@example.com\",
    \"guest_first_name\": \"Portal\",
    \"guest_last_name\": \"TestGuest\",
    \"guest_phone\": \"+1-555-0199\",
    \"room_type_id\": \"${ROOM_TYPE_ID}\",
    \"check_in_date\": \"2026-06-01\",
    \"check_out_date\": \"2026-06-03\",
    \"adults\": 2,
    \"children\": 0,
    \"payment_token\": \"tok_test_visa_4242\",
    \"special_requests\": \"High floor\",
    \"idempotency_key\": \"${IDEMPOTENCY_KEY}\"
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
check "Create booking" "$HTTP_CODE" "$BODY"

CONFIRMATION_CODE=""
RESERVATION_ID=""
if [[ "$HTTP_CODE" -ge 200 && "$HTTP_CODE" -lt 300 ]]; then
  CONFIRMATION_CODE=$(echo "$BODY" | grep -o '"confirmationCode":"[^"]*"' | head -1 | cut -d'"' -f4)
  RESERVATION_ID=$(echo "$BODY" | grep -o '"reservationId":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "  Confirmation: ${CONFIRMATION_CODE}"
  echo "  Reservation:  ${RESERVATION_ID}"
fi

# ── 3. Lookup Booking ──────────────────────────────
echo ""
echo "── Booking Lookup ──"

if [[ -n "$CONFIRMATION_CODE" ]]; then
  RESPONSE=$(curl -s -w "\n%{http_code}" \
    "${BASE_URL}/v1/self-service/booking/${CONFIRMATION_CODE}")

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | sed '$d')
  check "Lookup booking by confirmation code" "$HTTP_CODE" "$BODY"
else
  echo -e "${YELLOW}⊘ Skipped lookup — no confirmation code from booking step${NC}"
fi

# ── 4. Lookup non-existent booking ──────────────────────────────
RESPONSE=$(curl -s -w "\n%{http_code}" \
  "${BASE_URL}/v1/self-service/booking/NONEXISTENT999")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
if [[ "$HTTP_CODE" == "404" ]]; then
  echo -e "${GREEN}✓ Non-existent booking returns 404${NC}"
  ((pass++))
else
  echo -e "${RED}✗ Non-existent booking expected 404, got ${HTTP_CODE}${NC}"
  ((fail++))
fi

# ── Summary ──────────────────────────────
echo ""
echo "=============================================="
echo -e " Results: ${GREEN}${pass} passed${NC}, ${RED}${fail} failed${NC}"
echo "=============================================="

[[ "$fail" -eq 0 ]] && exit 0 || exit 1
