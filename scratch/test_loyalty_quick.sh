#!/usr/bin/env bash
set -e

GW="http://localhost:8080"
TID="11111111-1111-1111-1111-111111111111"
PID="22222222-2222-2222-2222-222222222222"
TOKEN=$(./http_test/get-token.sh)

echo "--- Loyalty Quick Test ---"

# 1. Create Guest
echo "Creating Guest..."
EMAIL="loyalty-$(date +%s)@test.local"
curl -s -X POST "$GW/v1/guests?tenant_id=$TID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: guest-$(date +%s)" \
  -d "{\"tenant_id\":\"$TID\",\"first_name\":\"Loyalty\",\"last_name\":\"Tester\",\"email\":\"$EMAIL\"}" >/dev/null
echo "Guest registered, waiting for async processing..."
sleep 5

GUEST_ID=$(curl -s -X GET "$GW/v1/guests?tenant_id=$TID&limit=100" \
  -H "Authorization: Bearer $TOKEN" | jq -r --arg email "$EMAIL" 'if type == "array" then . else .data end | .[] | select(.email == $email) | .id // empty')

if [[ -z "$GUEST_ID" ]]; then
  echo "Failed to find guest after registration"
  exit 1
fi
echo "Guest ID: $GUEST_ID"
sleep 2

# 1b. Enable Command
echo "Enabling Loyalty Enroll Command..."
curl -s -X PATCH "$GW/v1/commands/loyalty.program.enroll/features" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"enabled"}' >/dev/null

# 2. Enroll
echo "Enrolling..."
ENROLL_RESP=$(curl -s -X POST "$GW/v1/commands/loyalty.program.enroll/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: enroll-$(date +%s)" \
  -d "{\"tenant_id\":\"$TID\",\"payload\":{\"guest_id\":\"$GUEST_ID\",\"program_name\":\"Quick Test\",\"program_tier\":\"bronze\",\"enrollment_channel\":\"web\",\"enrollment_property_id\":\"$PID\"}}")
echo "Enroll Response: $ENROLL_RESP"
sleep 5

# 3. Get Program ID
PROG_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d tartware -t -c "SELECT program_id FROM guest_loyalty_programs WHERE guest_id = '$GUEST_ID' AND tenant_id = '$TID' LIMIT 1" | tr -d '[:space:]')
echo "Program ID: $PROG_ID"

if [[ -z "$PROG_ID" || "$PROG_ID" == "NULL" ]]; then
  echo "Enrollment failed (no DB record)"
  exit 1
fi

# 4. Earn Points
echo "Earning Points..."
curl -s -X POST "$GW/v1/commands/loyalty.points.earn/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: earn-$(date +%s)" \
  -d "{\"tenant_id\":\"$TID\",\"payload\":{\"guest_id\":\"$GUEST_ID\",\"program_id\":\"$PROG_ID\",\"points\":123,\"description\":\"Quick test earn\"}}"
sleep 5

# 5. Verify Balance
echo "Verifying Balance..."
BALANCE_RESP=$(curl -s -X GET "$GW/v1/loyalty/programs/$PROG_ID/balance?tenant_id=$TID" \
  -H "Authorization: Bearer $TOKEN")
echo "Balance Response: $BALANCE_RESP"
BALANCE=$(echo "$BALANCE_RESP" | jq -r '.points_balance // .data.points_balance // empty')

if [[ "$BALANCE" == "123" ]]; then
  echo "--- SUCCESS: Loyalty Pipeline Works! ---"
else
  echo "--- FAILURE: Expected 123 points, got $BALANCE ---"
  exit 1
fi
