#!/usr/bin/env bash
###############################################################################
# smoke-revenue.sh — live read + serialization smoke test for revenue-service.
#
# Why this exists. Until 2026-08-24 **nothing automated had ever called a
# revenue endpoint**: `run-api-tests.sh` does not mention revenue and
# `revenue.http` is not in the runner. The four analyses wired into the Reports
# screen on 2026-08-13 were therefore shipped, module-gated, role-gated, correct
# in SQL — and broken. Two returned 500 (`Do not know how to serialize a
# BigInt`) and one served its array as `{"0":…,"1":…}`, which the Reports screen
# renders as a single row whose columns are the array indices.
# See ui-gaps/05-revenue-module-status.md.
#
# So this suite asserts **shape, not just status**. A status-only check would
# have passed `booking-pace` for the whole eleven days it was broken. Every
# assertion below names the shape the caller must receive:
#
#   array        a bare JSON array
#   items        { items: [...] }        (optionally with a summary block)
#   object       a single JSON object, no numeric top-level keys
#   INDEX-KEYED  {"0":…,"1":…} — the defect; always a failure
#
# revenue-service is read-only from the UI (all 32 `revenue.*` commands are
# unreachable — ui-gaps/17), so there is no write path to exercise here and the
# script mutates nothing. It is safe to re-run and leaves no rows behind.
#
# Everything goes through the API gateway on :8080 — gateway routing, the
# `revenue-management` module gate and the ADMIN role gate are part of what is
# under test.
#
# Needs the dev stack up (pnpm run dev:backend) and Postgres/Kafka via docker.
#
# Note: right after a service restart the gateway's circuit breaker can still be
# open and the first call returns 503. Re-run; it is not a code fault.
###############################################################################
set -uo pipefail
cd "$(dirname "$0")/.."

GW="${GW:-http://localhost:8080}"
TOKEN=$(./http_test/get-token.sh 2>/dev/null)
TID="${TENANT_ID:-11111111-1111-1111-1111-111111111111}"
PID="${PROPERTY_ID:-22222222-2222-2222-2222-222222222222}"
RESP=$(mktemp)
TODAY=$(date +%F)
MONTH_AGO=$(date -d "-30 days" +%F)
MONTH_ON=$(date -d "+30 days" +%F)

PASS=0; FAIL=0
declare -a FAILURES=()

uuid() { cat /proc/sys/kernel/random/uuid; }

req() { # url -> echoes http code, body lands in $RESP
  curl -s -o "$RESP" -w "%{http_code}" "$1" \
    -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: $(uuid)"
}

# Classify the payload actually served. This is the heart of the suite: the
# defect that shipped was a 200 with the wrong shape, invisible to status codes.
shape_of() {
  node -e '
    let s = "";
    process.stdin.on("data", (d) => (s += d)).on("end", () => {
      let p;
      try { p = JSON.parse(s); } catch { return console.log("non-json"); }
      if (Array.isArray(p)) return console.log("array");
      if (p === null || typeof p !== "object") return console.log("scalar");
      const keys = Object.keys(p);
      if (keys.length > 0 && keys.every((k) => /^\d+$/.test(k)))
        return console.log("INDEX-KEYED");
      if (Array.isArray(p.items)) return console.log("items");
      return console.log("object");
    });
  ' < "$RESP" 2>/dev/null || echo "unreadable"
}

check() { # label expected-code actual-code
  if [[ "$2" == "$3" ]]; then
    printf '  ✅ %-52s %s\n' "$1" "$3"; PASS=$((PASS+1))
  else
    printf '  ❌ %-52s expected %s got %s\n' "$1" "$2" "$3"
    printf '        %s\n' "$(head -c 300 "$RESP")"
    FAIL=$((FAIL+1)); FAILURES+=("$1 (expected $2, got $3)")
  fi
}

check_shape() { # label expected-shape
  local actual; actual=$(shape_of)
  if [[ "$2" == "$actual" ]]; then
    printf '  ✅ %-52s %s\n' "$1" "$actual"; PASS=$((PASS+1))
  else
    printf '  ❌ %-52s expected %s got %s\n' "$1" "$2" "$actual"
    printf '        %s\n' "$(head -c 200 "$RESP")"
    FAIL=$((FAIL+1)); FAILURES+=("$1 (expected shape $2, got $actual)")
  fi
}

get_shape() { # label url expected-code expected-shape
  local code; code=$(req "$2")
  check "$1" "$3" "$code"
  [[ "$code" == "$3" ]] && check_shape "  ↳ shape" "$4"
}

if [[ -z "$TOKEN" ]]; then
  echo "No token — is the stack up? (pnpm run dev:backend)"; exit 1
fi

RANGE="tenant_id=$TID&property_id=$PID&start_date=$MONTH_AGO&end_date=$MONTH_ON"
DATED="tenant_id=$TID&property_id=$PID&business_date=$TODAY"

echo "═══════════════════════════════════════════════════════════════"
echo "  REVENUE READ + SERIALIZATION SMOKE TEST"
echo "═══════════════════════════════════════════════════════════════"

# ─────────────────────────────────────────────────────────────────────────────
echo
echo "── THE FOUR ANALYSES ON THE REPORTS SCREEN (ui-gaps/05) ──"
# These four are entries in UI/pms-ui/.../reports/report-defs.ts. They are the
# only revenue surface a user can reach, and all four were broken on first run.

get_shape "GET /v1/revenue/segment-analysis"      "$GW/v1/revenue/segment-analysis?$RANGE"      200 items
get_shape "GET /v1/revenue/channel-profitability" "$GW/v1/revenue/channel-profitability?$RANGE" 200 items
get_shape "GET /v1/revenue/booking-pace"          "$GW/v1/revenue/booking-pace?$RANGE"          200 array
get_shape "GET /v1/revenue/displacement-analysis" "$GW/v1/revenue/displacement-analysis?$RANGE" 200 items

# segment-analysis and channel-profitability 500d on a bare COUNT(*) reaching
# JSON.stringify as a BigInt. Assert the aggregate fields are real numbers, not
# strings and not absent — a 200 with a stringified count is still a defect.
code=$(req "$GW/v1/revenue/segment-analysis?$RANGE")
if [[ "$code" == "200" ]]; then
  bad=$(jq -r '[.items[]? | select((.rooms_sold|type) != "number" or (.room_nights|type) != "number")] | length' "$RESP" 2>/dev/null)
  check "segment-analysis counts are JSON numbers" "0" "${bad:-unreadable}"
fi

code=$(req "$GW/v1/revenue/channel-profitability?$RANGE")
if [[ "$code" == "200" ]]; then
  bad=$(jq -r '[.items[]? | select((.booking_count|type) != "number")] | length' "$RESP" 2>/dev/null)
  check "channel-profitability counts are JSON numbers" "0" "${bad:-unreadable}"
fi

# ─────────────────────────────────────────────────────────────────────────────
echo
echo "── PRICING READS ──"
# All eight served their arrays as index-keyed objects until 2026-08-24.

get_shape "GET /v1/revenue/pricing-rules"               "$GW/v1/revenue/pricing-rules?tenant_id=$TID&property_id=$PID&limit=50"               200 array
get_shape "GET /v1/revenue/rate-recommendations"        "$GW/v1/revenue/rate-recommendations?tenant_id=$TID&property_id=$PID&limit=50"        200 array
get_shape "GET /v1/revenue/competitor-rates"            "$GW/v1/revenue/competitor-rates?tenant_id=$TID&property_id=$PID&limit=50"            200 array
get_shape "GET /v1/revenue/demand-calendar"             "$GW/v1/revenue/demand-calendar?tenant_id=$TID&property_id=$PID&limit=50"             200 array
get_shape "GET /v1/revenue/rate-restrictions"           "$GW/v1/revenue/rate-restrictions?tenant_id=$TID&property_id=$PID&limit=50"           200 array
get_shape "GET /v1/revenue/hurdle-rates"                "$GW/v1/revenue/hurdle-rates?tenant_id=$TID&property_id=$PID&limit=50"                200 array
get_shape "GET /v1/revenue/rate-shopping"               "$GW/v1/revenue/rate-shopping?$RANGE&limit=50"                                        200 array
get_shape "GET /v1/revenue/competitive-response-rules"  "$GW/v1/revenue/competitive-response-rules?tenant_id=$TID&property_id=$PID&limit=50"  200 array

# ─────────────────────────────────────────────────────────────────────────────
echo
echo "── REPORTING READS ──"

get_shape "GET /v1/revenue/forecasts"        "$GW/v1/revenue/forecasts?tenant_id=$TID&property_id=$PID&limit=50" 200 array
get_shape "GET /v1/revenue/goals"            "$GW/v1/revenue/goals?tenant_id=$TID&property_id=$PID&limit=50"     200 array
get_shape "GET /v1/revenue/budget-variance"  "$GW/v1/revenue/budget-variance?$RANGE"                             200 array
get_shape "GET /v1/revenue/forecast-accuracy" "$GW/v1/revenue/forecast-accuracy?$RANGE"                          200 items
get_shape "GET /v1/revenue/kpis"             "$GW/v1/revenue/kpis?$DATED"                                        200 object
get_shape "GET /v1/revenue/managers-report"  "$GW/v1/revenue/managers-report?$DATED"                             200 object
get_shape "GET /v1/revenue/compset-indices"  "$GW/v1/revenue/compset-indices?$DATED"                             200 object

# ─────────────────────────────────────────────────────────────────────────────
echo
echo "── GATES AND VALIDATION ──"
# The gateway gates all of /v1/revenue/* on `revenue-management`; downstream the
# routes require ADMIN. ui-gaps/05 records six reads that additionally require
# `finance-automation` — deliberately left mismatched pending a tiering decision.

code=$(curl -s -o "$RESP" -w "%{http_code}" "$GW/v1/revenue/segment-analysis?$RANGE")
check "no token → unauthorized" 401 "$code"

code=$(req "$GW/v1/revenue/segment-analysis?tenant_id=$TID&property_id=$PID")
check "missing date range → bad request" 400 "$code"

code=$(req "$GW/v1/revenue/booking-pace?tenant_id=$TID&property_id=$PID&start_date=not-a-date&end_date=$MONTH_ON")
check "malformed start_date → bad request" 400 "$code"

code=$(req "$GW/v1/revenue/pricing-rules/$(uuid)?tenant_id=$TID")
check "unknown pricing rule id → not found" 404 "$code"

# ─────────────────────────────────────────────────────────────────────────────
echo
echo "═══════════════════════════════════════════════════════════════"
echo "  $PASS passed, $FAIL failed"
if ((FAIL)); then printf '  ❌ %s\n' "${FAILURES[@]}"; fi
echo "═══════════════════════════════════════════════════════════════"
exit $((FAIL > 0))
