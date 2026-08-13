#!/usr/bin/env bash
###############################################################################
# seed-screens.sh — populate the UI registers without running the full suite.
#
# test-multi-tenant.sh also runs these seeders (Phase 6c.10), but that is a
# ~25-minute run. When the goal is just "get data onto the screens", this drives
# the same seeds/*.sh files directly against an existing tenant in well under a
# minute.
#
# Usage:
#   ./seed-screens.sh                     # seed the seeded tenant A / property A1
#   ./seed-screens.sh <tenant_id> <property_id> [room_type_id]
#
# Env: API_URL (default http://localhost:8080), API_USER, API_PASS,
#      BILLING_DIRECT (default http://localhost:3025)
#
# The helpers below intentionally mirror test-multi-tenant.sh's, because the
# seeders are written against that contract and must behave identically in both
# callers. If you change a helper here, change it there too.
###############################################################################
set -uo pipefail

GW="${API_URL:-http://localhost:8080}"
BILLING_DIRECT="${BILLING_DIRECT:-http://localhost:3025}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESP_FILE="$(mktemp)"
trap 'rm -f "$RESP_FILE"' EXIT

TODAY=$(date +%Y-%m-%d)
IN3DAYS=$(date -d "+3 days" +%Y-%m-%d 2>/dev/null || date -v+3d +%Y-%m-%d)
IN5DAYS=$(date -d "+5 days" +%Y-%m-%d 2>/dev/null || date -v+5d +%Y-%m-%d)
RUN_TAG="$(date +%H%M%S)$(printf '%02d' $((RANDOM % 100)))"

PASS=0; FAIL=0; SKIP=0
pass() { PASS=$((PASS+1)); printf "  \033[32m✅\033[0m %-58s PASS\n" "$1"; }
fail() { FAIL=$((FAIL+1)); printf "  \033[31m❌\033[0m %-58s FAIL  %s\n" "$1" "${2:-}"; }
skip() { SKIP=$((SKIP+1)); printf "  \033[33m⏭\033[0m  %-58s SKIP  %s\n" "$1" "${2:-}"; }
assert_gte() {
  if [[ "${2:-0}" -ge "${3:-0}" ]]; then pass "$1"; else fail "$1" "expected >= $3 actual=${2:-0}"; fi
}

gen_uuid() {
  if [[ -r /proc/sys/kernel/random/uuid ]]; then cat /proc/sys/kernel/random/uuid
  elif command -v uuidgen >/dev/null 2>&1; then uuidgen
  else printf '%08x-%04x-%04x-%04x-%012x\n' $((RANDOM*RANDOM)) $RANDOM $RANDOM $RANDOM $((RANDOM*RANDOM*RANDOM)); fi
}

# Same rate-limit handling as the suite: a throttled response carries no data,
# so counting it as an answer reports an empty screen that is really just a 429.
RATE_LIMIT_MAX_RETRIES="${RATE_LIMIT_MAX_RETRIES:-4}"
is_rate_limited() {
  [[ "$1" == "429" ]] && return 0
  [[ "$1" == "403" ]] && grep -qi "rate limit" "$RESP_FILE" 2>/dev/null && return 0
  return 1
}
rate_limit_wait() {
  local hint
  hint=$(grep -oiE 'retry in[^0-9]*[0-9]+' "$RESP_FILE" 2>/dev/null | grep -oE '[0-9]+' | head -1)
  [[ -z "$hint" ]] && hint=5
  [[ "$hint" -gt 35 ]] && hint=35
  sleep "$((hint + 1))"
}

get() {
  local code attempt=0
  while :; do
    code=$(curl -s -o "$RESP_FILE" -w "%{http_code}" "$1" -H "Authorization: Bearer $TOKEN")
    is_rate_limited "$code" && [[ $attempt -lt $RATE_LIMIT_MAX_RETRIES ]] || break
    attempt=$((attempt+1)); rate_limit_wait
  done
  echo "$code"
}

post() {
  local idem="${3:-$(gen_uuid)}" code attempt=0
  while :; do
    code=$(curl -s -o "$RESP_FILE" -w "%{http_code}" -X POST "$1" \
      -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
      -H "Idempotency-Key: $idem" -d "$2")
    is_rate_limited "$code" && [[ $attempt -lt $RATE_LIMIT_MAX_RETRIES ]] || break
    attempt=$((attempt+1)); rate_limit_wait
  done
  echo "$code"
}

resp_count() {
  jq -r 'if type=="array" then length elif .data and (.data|type=="array") then (.data|length) else 0 end' \
    "$RESP_FILE" 2>/dev/null || echo "0"
}
resp_first() {
  jq -r "(if type==\"array\" then .[0] elif .data and (.data|type==\"array\") then .data[0] else . end) // {} | .$1 // empty" \
    "$RESP_FILE" 2>/dev/null || echo ""
}

poll_count() {
  local url="$1" want="$2" max="${3:-60}" waited=0 n=0 code
  while [[ $waited -lt $max ]]; do
    code=$(get "$url")
    if [[ "$code" =~ ^2 ]]; then
      n=$(resp_count)
      [[ "$n" -ge "$want" ]] && { echo "$n"; return 0; }
    fi
    sleep 3; waited=$((waited+3))
  done
  echo "$n"
}

send_command() {
  local label="$1" cmd="$2" payload="$3" idem="${4:-$(gen_uuid)}"
  printf "  ▸ %-55s " "$label"
  local code
  code=$(curl -s -o "$RESP_FILE" -w "%{http_code}" \
    -X POST "$GW/v1/commands/$cmd/execute" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -H "Idempotency-Key: $idem" \
    -d "{\"tenant_id\":\"$CUR_TID\",\"payload\":$payload}")
  if [[ "$code" =~ ^2 ]]; then echo "✓ $code"; else
    echo "✗ $code $(jq -r '.detail // .message // empty' "$RESP_FILE" 2>/dev/null | head -c 90)"
  fi
}

# ── Preflight ────────────────────────────────────────────────────────────────
command -v jq >/dev/null 2>&1 || { echo "FATAL: jq is required"; exit 1; }
if [[ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "$GW/health")" != "200" ]]; then
  echo "FATAL: API gateway not reachable at $GW — is the dev stack running?"
  exit 1
fi

TOKEN=$(API_URL="$GW" "$SCRIPT_DIR/../../http_test/get-token.sh" 2>/dev/null)
[[ -n "$TOKEN" ]] || { echo "FATAL: could not obtain an auth token"; exit 1; }

TID="${1:-11111111-1111-1111-1111-111111111111}"
PID="${2:-}"
RTID="${3:-}"
CUR_TID="$TID"

if [[ -z "$PID" ]]; then
  get "$GW/v1/properties?tenant_id=$TID&limit=50" >/dev/null
  PID=$(resp_first "id")
fi
[[ -n "$PID" ]] || { echo "FATAL: no property found for tenant $TID"; exit 1; }

if [[ -z "$RTID" ]]; then
  # Room types key on room_type_id, not id — asking for "id" silently yields an
  # empty string, which then reaches the waitlist command as
  # requested_room_type_id:"" and comes back "Invalid uuid".
  get "$GW/v1/room-types?tenant_id=$TID&property_id=$PID&limit=50" >/dev/null
  RTID=$(resp_first "room_type_id")
  [[ -n "$RTID" ]] || RTID=$(resp_first "id")
fi

echo "┌─ tenant=$TID"
echo "│  property=$PID"
echo "│  room_type=${RTID:-<none>}  run_tag=$RUN_TAG"
echo "└─"
echo ""

# shellcheck source=/dev/null
for f in "$SCRIPT_DIR"/seeds/*.sh; do [[ -e "$f" ]] && source "$f"; done

seed_waitlist        "$TOKEN" "$TID" "$PID" "$RTID" "main"
seed_guest_feedback  "$TOKEN" "$TID" "$PID" "main"
seed_promo_codes     "$TOKEN" "$TID" "$PID" "main"
seed_lost_and_found  "$TOKEN" "$TID" "$PID" "main"
seed_incidents       "$TOKEN" "$TID" "$PID" "main"
seed_shift_handovers "$TOKEN" "$TID" "$PID" "main"
seed_approvals       "$TOKEN" "$TID" "$PID" "main"

echo ""
echo "  ${PASS} passed, ${FAIL} failed, ${SKIP} skipped"
[[ "$FAIL" -eq 0 ]]
