#!/usr/bin/env bash
###############################################################################
# harness.sh — shared E2E test harness
#
# Every script in this directory had grown its own copy of the same transport,
# assertion and reporting helpers. This is that set, extracted once so a new
# suite is a list of assertions rather than 200 lines of scaffolding.
#
# Source it after ensure-deps.sh:
#
#   source "$SCRIPT_DIR/ensure-deps.sh"
#   source "$SCRIPT_DIR/lib/harness.sh"
#
# It expects $TOKEN to hold the bearer token for the calls it makes; set it with
# harness_login, or assign it directly when a suite manages several tokens.
###############################################################################

GW="${GW:-http://localhost:8080}"
CORE_SVC="${CORE_SVC:-http://localhost:3000}"
KAFKA_WAIT="${KAFKA_WAIT:-4}"
RATE_LIMIT_MAX_RETRIES="${RATE_LIMIT_MAX_RETRIES:-6}"

PASS=0; FAIL=0; TOTAL=0; SKIP=0

RESP_FILE=$(mktemp /tmp/tartware-harness-resp.XXXXXX.json)
trap 'rm -f "$RESP_FILE"' EXIT

# ─── Identifiers ─────────────────────────────────────────────────────────────

gen_uuid() {
  if [[ -r /proc/sys/kernel/random/uuid ]]; then
    cat /proc/sys/kernel/random/uuid
  elif command -v uuidgen >/dev/null 2>&1; then
    uuidgen
  else
    printf '%08x-%04x-4%03x-8%03x-%012x\n' \
      $((RANDOM*RANDOM)) $RANDOM $RANDOM $RANDOM $((RANDOM*RANDOM*RANDOM))
  fi
}

# ─── Rate-limit aware transport ──────────────────────────────────────────────
# A throttled response is not a result: it carries no data and says nothing
# about the endpoint. Retrying it is the difference between a real assertion and
# a cascade of phantom failures whenever a run outpaces the gateway's limiter.

is_rate_limited() {
  [[ "$1" == "429" ]] && return 0
  [[ "$1" == "403" ]] && grep -qi "rate limit" "$RESP_FILE" 2>/dev/null && return 0
  return 1
}

rate_limit_wait() {
  local hint
  hint=$(grep -oiE 'retry in[^0-9]*[0-9]+' "$RESP_FILE" 2>/dev/null | grep -oE '[0-9]+' | head -1)
  [[ -z "$hint" ]] && hint=5
  [[ "$hint" -lt 1 ]] && hint=1
  [[ "$hint" -gt 35 ]] && hint=35
  sleep "$((hint + 1))"
}

# post URL BODY [IDEMPOTENCY_KEY]
# The key is generated once and reused across retries — a retry must never be
# able to create a second row.
post() {
  local idem="${3:-$(gen_uuid)}"
  local code attempt=0
  while :; do
    code=$(curl -s -o "$RESP_FILE" -w "%{http_code}" \
      -X POST "$1" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -H "Idempotency-Key: $idem" \
      -d "$2")
    is_rate_limited "$code" && [[ $attempt -lt $RATE_LIMIT_MAX_RETRIES ]] || break
    attempt=$((attempt + 1)); rate_limit_wait
  done
  echo "$code"
}

get() {
  local code attempt=0
  while :; do
    code=$(curl -s -o "$RESP_FILE" -w "%{http_code}" "$1" -H "Authorization: Bearer $TOKEN")
    is_rate_limited "$code" && [[ $attempt -lt $RATE_LIMIT_MAX_RETRIES ]] || break
    attempt=$((attempt + 1)); rate_limit_wait
  done
  echo "$code"
}

# ─── Response readers ────────────────────────────────────────────────────────

resp_count() {
  jq -r 'if type == "array" then length elif .data and (.data | type == "array") then (.data | length) else 0 end' "$RESP_FILE" 2>/dev/null || echo "0"
}

resp_field() {
  jq -r ".$1 // (.data.$1) // empty" "$RESP_FILE" 2>/dev/null || echo ""
}

resp_raw() { cat "$RESP_FILE"; }

# resp_jq FILTER — read anything the shorthands do not cover.
resp_jq() {
  jq -r "$1 // empty" "$RESP_FILE" 2>/dev/null || echo ""
}

# ─── Assertions ──────────────────────────────────────────────────────────────

pass()  { TOTAL=$((TOTAL+1)); PASS=$((PASS+1)); printf "  ✅ %-62s PASS\n" "$1"; }
fail()  { TOTAL=$((TOTAL+1)); FAIL=$((FAIL+1)); printf "  ❌ %-62s FAIL  %s\n" "$1" "$2"; }
skip()  { TOTAL=$((TOTAL+1)); SKIP=$((SKIP+1)); printf "  ⏭  %-62s SKIP  %s\n" "$1" "${2:-}"; }

assert_eq()   { if [[ "$2" == "$3" ]]; then pass "$1"; else fail "$1" "expected=[$2] actual=[$3]"; fi; }
assert_ne()   { if [[ "$2" != "$3" ]]; then pass "$1"; else fail "$1" "expected not [$2]"; fi; }
assert_gte()  { if [[ "$2" -ge "$3" ]]; then pass "$1"; else fail "$1" "expected >= $3 actual=$2"; fi; }
assert_http() { if [[ "$3" =~ ^${2} ]]; then pass "$1"; else fail "$1" "expected=$2 actual=$3 body=$(head -c 200 "$RESP_FILE")"; fi; }

# assert_contains LABEL NEEDLE — the last response body contains NEEDLE.
assert_contains() {
  if grep -q "$2" "$RESP_FILE" 2>/dev/null; then pass "$1"
  else fail "$1" "missing [$2] in $(head -c 200 "$RESP_FILE")"; fi
}

section() { printf "\n── %s %s\n" "$1" "$(printf '─%.0s' $(seq 1 $((70 - ${#1}))))"; }

# ─── Waiting for asynchronous work ───────────────────────────────────────────
# Commands are accepted with 202 long before their consumer runs, so every
# assertion about an effect has to wait for one. Polling a condition beats a
# fixed sleep: it is faster when the consumer is quick and honest when it is not.

# wait_for SECONDS COMMAND... — retry until the command succeeds or time runs out.
wait_for() {
  local timeout="$1"; shift
  local waited=0
  while [[ $waited -lt $timeout ]]; do
    if "$@" >/dev/null 2>&1; then return 0; fi
    sleep 2; waited=$((waited + 2))
  done
  return 1
}

# wait_for_json SECONDS URL JQ_FILTER EXPECTED — poll a GET until it matches.
wait_for_json() {
  local timeout="$1" url="$2" filter="$3" expected="$4"
  local waited=0 actual
  while [[ $waited -lt $timeout ]]; do
    get "$url" >/dev/null
    actual=$(resp_jq "$filter")
    [[ "$actual" == "$expected" ]] && return 0
    sleep 2; waited=$((waited + 2))
  done
  return 1
}

# ─── Login ───────────────────────────────────────────────────────────────────

harness_login() {
  local user="${1:-setup.admin}" pass_word="${2:-${AUTH_DEFAULT_PASSWORD:-TempPass1234}}"
  local body
  body=$(curl -s -X POST "$CORE_SVC/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$user\",\"password\":\"$pass_word\"}")
  TOKEN=$(echo "$body" | jq -r '.access_token // .data.access_token // empty')
  if [[ -z "$TOKEN" ]]; then
    echo "  ❌ login failed for $user: $(echo "$body" | head -c 200)" >&2
    return 1
  fi
  export TOKEN
}

# ─── Command feature flags ───────────────────────────────────────────────────
# Every command in the catalogue ships `disabled`, so a suite that does not
# enable what it exercises scores a wall of 409s. This is the "FEATURE_DISABLED
# trap" the multi-tenant suite works around the same way.

# The gateway caches the command registry and refreshes it on a timer
# (COMMAND_REGISTRY_REFRESH_MS, default 30s), so flipping a flag in the database
# is not visible to the dispatch path straight away — the command keeps
# returning 409 FEATURE_DISABLED until the next refresh. Waiting only when a row
# actually changed keeps a re-run fast: the second run enables nothing and waits
# for nothing.
enable_commands() {
  local names="" n changed
  for n in "$@"; do names="$names,'$n'"; done
  names="${names:1}"
  changed=$(PGPASSWORD="${DB_PASSWORD:-postgres}" psql -h "${DB_HOST:-127.0.0.1}" -p "${DB_DIRECT_PORT:-5432}" \
    -U "${DB_USER:-postgres}" -d "${DB_NAME:-tartware}" -tAc \
    "WITH flipped AS (
       UPDATE command_features SET status='enabled'
        WHERE command_name IN ($names) AND status <> 'enabled'
       RETURNING 1
     ) SELECT count(*) FROM flipped" 2>/dev/null | tr -d '[:space:]')

  if [[ "${changed:-0}" -gt 0 ]]; then
    local wait_s=$(( ${COMMAND_REGISTRY_REFRESH_MS:-30000} / 1000 + 3 ))
    echo "  … enabled $changed command(s); waiting ${wait_s}s for the gateway registry to refresh"
    sleep "$wait_s"
  fi
}

# ─── Summary ─────────────────────────────────────────────────────────────────

harness_summary() {
  local title="${1:-TESTS COMPLETE}"
  printf "\n╔═══════════════════════════════════════════════════════════════════════╗\n"
  if [[ $FAIL -eq 0 ]]; then
    printf "║  ✅  %-64s ║\n" "$title: $PASS/$TOTAL passed, $SKIP skipped"
  else
    printf "║  ❌  %-64s ║\n" "$title: $PASS/$TOTAL passed, $FAIL FAILED, $SKIP skipped"
  fi
  printf "╚═══════════════════════════════════════════════════════════════════════╝\n"
  [[ $FAIL -eq 0 ]]
}
