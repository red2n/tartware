#!/usr/bin/env bash
###############################################################################
# test-multi-currency-locations.sh
# Multi-currency × multi-location × multi-tenant end-to-end test
#
# Four tenants, one per country, each bootstrapped from scratch with its own
# owner, its own property, and its own base currency — then run through the
# full billing pipeline in that currency and cross-posted with four foreign
# tender currencies. This is the shape a hotel group actually has: a guest pays
# in their home currency at a property that keeps its books in another, and the
# ledger has to hold both.
#
#   TENANT / LOCATION (base currency)   TRANSACTION CURRENCIES
#     New York, US      USD  (2dp)        USD  2dp
#     Tokyo, JP         JPY  (0dp)        JPY  0dp   ← no minor unit at all
#     Mumbai, IN        INR  (2dp)        INR  2dp
#     Kuwait City, KW   KWD  (3dp)        KWD  3dp   ← thousandths
#                                         EUR  2dp   ← guest-only, no property
#
# 4 locations × 5 currencies = 20 posting combinations. The currency set spans
# all three ISO 4217 minor-unit classes on purpose: a suite of five 2-decimal
# currencies would never exercise the rounding that actually breaks.
#
# EUR is deliberately not any property's base currency — it only ever arrives as
# guest tender, which is the case that has no same-currency shortcut anywhere in
# the posting path.
#
# Every tenant runs the SAME pipeline test-multi-tenant.sh runs — guest,
# reservation, folio, charges, payment, invoice, cashier session, AR account,
# night audit, GL batch — except every amount is denominated in that location's
# own currency and every step asserts the currency that came back.
#
# Layout:
#   PHASE 0   Bootstrap 4 tenants (one per currency/country) + properties,
#             rooms, rates, modules, commands
#   PHASE 1   FX rate matrix per tenant + negative validation + correction
#   PHASE 2   Full billing pipeline per tenant, denominated in its own currency
#   PHASE 3   The matrix — every tender currency at every location
#   PHASE 4   Guest-currency payments (EUR at every location)
#   PHASE 5   Minor-unit precision probes
#   PHASE 6   Cross-tenant + cross-currency isolation
#   PHASE 7   Summary, DLQ delta, tenant handles
#
# Usage:
#   ./executables/test-accounts-realdata/test-multi-currency-locations.sh
#   ./executables/test-accounts-realdata/test-multi-currency-locations.sh --tag=143012
#   ./executables/test-accounts-realdata/test-multi-currency-locations.sh --skip-command-enable
#
# Flags:
#   --tag=XXXXXXX          Reuse a previous run's tenants/properties instead of
#                          bootstrapping new ones (tenants are looked up by slug).
#   --skip-command-enable  Skip the global command-enable step and its 32s cache
#                          wait. Only safe when a previous run already did it.
#
# Known gaps this suite catches on today's build (a red result here is the
# finding, not a broken test) — all four confirmed against a live stack on
# 2026-08-12:
#   - general_ledger_batches.currency is hard-coded 'USD' in ledger.ts, so a
#     Tokyo batch reports USD (Phase 2)
#   - cashier_sessions.base_currency is never set on open, so it defaults to
#     'USD' at every property; the list endpoint omits the field entirely, so
#     only the detail route can see it (Phase 2)
#   - charge amounts are stored verbatim, not normalised to the tender currency's
#     minor unit — 61.5006 KWD persists at 4dp (payments ARE normalised, via
#     roundToCurrency in payment.ts) (Phase 5.1)
#   - billing.no_show.charge writes its posting without locking an FX rate, so
#     base_currency falls to the column default 'USD' (Phase 6.1)
#   - ar.account.create is accepted (202), logs "billing command applied", and
#     writes no row: ar_accounts stays empty and nothing reaches the DLQ
#     (Phase 2). Reproducible outside this suite.
#
# Two constraints discovered the hard way, now designed around rather than
# asserted: payments.reservation_id is NOT NULL, so a capture against a house
# account dead-letters after four retries — and while it retries, commands
# queued behind it on the same partition are starved, which reads as unrelated
# "posting not found" failures further down the run.
#
# Prerequisites:
#   - All services running (pnpm run dev)
#   - jq, bc, curl — installed automatically by ensure-deps.sh if missing
#   - http_test/get-token.sh working
#   - npx tsx (system-admin token bootstrap, same as test-multi-tenant.sh)
###############################################################################
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

source "$SCRIPT_DIR/ensure-deps.sh"

# ─── Configuration ───────────────────────────────────────────────────────────
GW="http://localhost:8080"
CORE_SVC="http://localhost:3000"
BILLING_SVC="http://localhost:3025"
TODAY=$(date +%Y-%m-%d)
IN3DAYS=$(date -d "+3 days" +%Y-%m-%d 2>/dev/null || date -v+3d +%Y-%m-%d)
KAFKA_WAIT=6

PASS=0; FAIL=0; TOTAL=0; SKIP=0

# Per-run tag suffixed onto every tenant slug, property code, username and email
# so each invocation provisions a fresh estate and surfaces real uniqueness
# errors instead of silently reusing prior-run data. --tag reuses one.
RUN_TAG="$(date +%H%M%S)$(printf '%02d' $((RANDOM % 100)))"
SKIP_COMMAND_ENABLE=false

for arg in "$@"; do
  case "$arg" in
    -h|--help) sed -n '2,70p' "$0" | sed 's/^# \?//'; exit 0 ;;
    --tag=*) RUN_TAG="${arg#--tag=}" ;;
    --skip-command-enable) SKIP_COMMAND_ENABLE=true ;;
    *) echo "Unknown option: $arg (try --help)"; exit 2 ;;
  esac
done

UNIQUE=$(date +%s)
OWNER_PASS="MclCurrency123!"

# ─── Helpers ─────────────────────────────────────────────────────────────────

# Set per-location before any request; post/get/send_command read them.
TOKEN=""
CUR_TID=""

RESP_FILE=$(mktemp /tmp/tartware-mcl-resp.XXXXXX.json)
trap "rm -f $RESP_FILE ${RESP_FILE}.mtx ${RESP_FILE}.pay" EXIT

# Generate a UUID for Idempotency-Key (required by all command writes since IDEMP-01).
gen_uuid() {
  if [[ -r /proc/sys/kernel/random/uuid ]]; then
    cat /proc/sys/kernel/random/uuid
  elif command -v uuidgen >/dev/null 2>&1; then
    uuidgen
  else
    # Fallback: pseudo-uuid from $RANDOM + epoch
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

# ─── API response helpers ────────────────────────────────────────────────────
# These handle both flat arrays and { data: [], meta: { count } } wrappers.

resp_count() {
  jq -r 'if type == "array" then length elif .data and (.data | type == "array") then (.data | length) else 0 end' "$RESP_FILE" 2>/dev/null || echo "0"
}

resp_first() {
  local field="$1"
  jq -r "(if type == \"array\" then .[0] elif .data and (.data | type == \"array\") then .data[0] else . end) // {} | .$field // empty" "$RESP_FILE" 2>/dev/null || echo ""
}

resp_field() {
  local field="$1"
  jq -r ".$field // (.data.$field) // empty" "$RESP_FILE" 2>/dev/null || echo ""
}

resp_fcount() {
  local filter="$1"
  jq -r "(if type == \"array\" then . elif .data and (.data | type == \"array\") then .data else [] end) | map(select($filter)) | length" "$RESP_FILE" 2>/dev/null || echo "0"
}

resp_ffirst() {
  local filter="$1" field="$2"
  jq -r "(if type == \"array\" then . elif .data and (.data | type == \"array\") then .data else [] end) | map(select($filter)) | .[0].$field // empty" "$RESP_FILE" 2>/dev/null || echo ""
}

# ─── Assertion helpers ───────────────────────────────────────────────────────

pass() { TOTAL=$((TOTAL+1)); PASS=$((PASS+1)); printf "  ✅ %-64s PASS\n" "$1"; }
fail() { TOTAL=$((TOTAL+1)); FAIL=$((FAIL+1)); printf "  ❌ %-64s FAIL — %s\n" "$1" "$2"; }
skip() { TOTAL=$((TOTAL+1)); SKIP=$((SKIP+1)); printf "  ⏭  %-64s SKIP — %s\n" "$1" "${2:-}"; }

assert_eq() {
  local label="$1" expected="$2" actual="$3"
  if [[ "$expected" == "$actual" ]]; then pass "$label"
  else fail "$label" "expected=$expected actual=$actual"; fi
}

# Case-insensitive compare (for DB enums that may be upper/lowercase)
assert_eq_ci() {
  local label="$1" expected="${2,,}" actual="${3,,}"
  if [[ "$expected" == "$actual" ]]; then pass "$label"
  else fail "$label" "expected=$2 actual=$3"; fi
}

# Numeric compare (strips trailing zeros after decimal: 8.875000 == 8.875, 458.50 == 458.5)
assert_eq_num() {
  local label="$1" expected="$2" actual="$3"
  # Normalize: remove trailing zeros ONLY after a decimal point, then trailing dot
  local norm_exp norm_act
  norm_exp=$(echo "$expected" | sed '/\./ s/0*$//; s/\.$//')
  norm_act=$(echo "$actual" | sed '/\./ s/0*$//; s/\.$//')
  if [[ "$norm_exp" == "$norm_act" ]]; then pass "$label"
  else fail "$label" "expected=$expected actual=$actual"; fi
}

assert_gte() {
  local label="$1" min="$2" actual="$3"
  if [[ "$actual" -ge "$min" ]] 2>/dev/null; then pass "$label"
  else fail "$label" "expected>=$min actual=$actual"; fi
}

assert_http() {
  local label="$1" expected="$2" actual="$3"
  if [[ "$actual" =~ ^${expected} ]]; then pass "$label"
  else
    local detail
    detail=$(jq -r '.detail // .message // .error // empty' "$RESP_FILE" 2>/dev/null || echo "")
    fail "$label" "HTTP $actual ${detail:0:70}"
  fi
}

# Number of significant decimals in a money value: 29001 → 0, 61.500 → 1 (trailing
# zeros stripped, since 61.500 is representable in a 1dp currency too).
decimals_of() {
  echo "${1:-0}" | awk -F. '{ if (NF < 2) print 0; else { sub(/0+$/, "", $2); print length($2) } }'
}

# assert_minor_units <label> <currency> <amount>
# The value must be expressible in that currency. A JPY amount carrying decimals,
# or a KWD one truncated to two, fails here even if numerically close.
assert_minor_units() {
  local label="$1" ccy="$2" amount="$3" allowed d
  allowed=$(ccy_units "$ccy")
  d=$(decimals_of "$amount")
  if [[ "$d" -le "$allowed" ]]; then
    pass "$label (${amount} — ≤ ${allowed}dp)"
  else
    fail "$label" "$amount has ${d}dp, $ccy allows ${allowed}dp"
  fi
}

send_command() {
  local label="$1" cmd_name="$2" payload="$3" idem_key="${4:-$(gen_uuid)}"
  local body code
  body=$(printf '{"tenant_id":"%s","payload":%s}' "$CUR_TID" "$payload")
  code=$(curl -s -o "$RESP_FILE" -w "%{http_code}" \
    -X POST "$GW/v1/commands/$cmd_name/execute" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -H "Idempotency-Key: $idem_key" \
    -d "$body")
  if [[ "$code" =~ ^2 ]]; then printf "  ▸ %-62s ✓ %s\n" "$label" "$code"
  else printf "  ▸ %-62s ✗ %s ← %s\n" "$label" "$code" "$(jq -r '.message // .error // .detail // .code // empty' "$RESP_FILE" 2>/dev/null | head -c 140)"; fi
}

seed_rest() {
  local label="$1" url="$2" body="$3"
  local code
  code=$(post "$url" "$body")
  if [[ "$code" =~ ^2 ]]; then pass "$label → $code"
  else fail "$label" "HTTP $code $(jq -r '.detail // .message // .error // empty' "$RESP_FILE" 2>/dev/null | head -c 70)"; fi
}

wait_kafka() {
  local secs="${1:-$KAFKA_WAIT}"
  printf "  ⏱  Waiting %ds for async processing...\n" "$secs"
  sleep "$secs"
}

# poll_count — poll a URL until resp_count >= want, or give up.
# Async command handlers land rows at a rate that varies with Kafka backlog, so
# a fixed sleep that works for the first tenant starves the fourth.
poll_count() {
  local url="$1" want="$2" max="${3:-40}" waited=0 n=0
  while [[ $waited -lt $max ]]; do
    get "$url" >/dev/null
    n=$(resp_count)
    [[ "$n" -ge "$want" ]] && { echo "$n"; return 0; }
    sleep 4; waited=$((waited + 4))
  done
  # Always exit 0: the caller asserts on the count. Returning non-zero would
  # abort the whole script under `set -e`.
  echo "$n"
}

# poll_for — re-read a list endpoint until at least one item matches the filter.
# Command handlers land rows on Kafka's schedule, not the test's, and a fixed
# sleep that suits the first location starves the fourth. Leaves the last
# response in RESP_FILE either way, so the caller asserts on it as usual.
# Usage: poll_for <url> <jq_select_filter> [max_wait_s=40]
poll_for() {
  local url="$1" filter="$2" max="${3:-40}" waited=0 n=0
  while :; do
    get "$url" >/dev/null
    n=$(resp_fcount "$filter")
    [[ "$n" -ge 1 ]] && break
    [[ $waited -ge $max ]] && break
    sleep 4; waited=$((waited + 4))
  done
  echo "$n"
}

# poll_delta — poll an API endpoint until the item-count delta >= min_delta,
# retrying with exponential backoff when the initial check shows Δ=0.
# Emits pass on success, skip after all retries (never a hard fail — Δ=0 may
# be a handler no-op rather than a test defect).
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

# ─── Dead-letter queue depth ─────────────────────────────────────────────────
# Commands are accepted with HTTP 202 long before their consumer runs, so a
# handler that throws is invisible to every request-level assertion here: the
# message is retried, parked on a dead-letter topic, and the test still scores a
# PASS off the 202. Sampling DLQ depth before and after the run is what turns
# those silent failures into a real assertion.
KAFKA_CONTAINER="${TARTWARE_KAFKA_CONTAINER:-tartware-kafka}"
KAFKA_BROKER_INTERNAL="${TARTWARE_KAFKA_BROKER:-localhost:29092}"
DLQ_TOPICS=(commands.primary.dlq reservations.events.dlq inventory.events.dlq)
declare -A PRE_DLQ=()
DLQ_TRACKED=0

dlq_available() {
  command -v docker >/dev/null 2>&1 && docker exec "$KAFKA_CONTAINER" true >/dev/null 2>&1
}

dlq_topic_depth() {
  docker exec "$KAFKA_CONTAINER" kafka-run-class kafka.tools.GetOffsetShell \
    --broker-list "$KAFKA_BROKER_INTERNAL" --topic "$1" 2>/dev/null \
    | awk -F: '{s+=$3} END {print s+0}'
}

# ─── Currency & location matrix ──────────────────────────────────────────────
# Record fields, in order:
#   1 minor_units   2 city          3 country      4 timezone     5 language
#   6 rate_to_usd   7 sample_amt    8 room_rate    9 stay_3n     10 minibar
#  11 restaurant   12 payment      13 float       14 credit_limit 15 no_show
#  16 over_precise
#
# `rate_to_usd` is a fixed plausible rate seeded through the FX API, so the whole
# run is deterministic rather than dependent on a live feed. Every amount is
# sized to look native in that currency — ¥29,000 not ¥199 — so a rounding fault
# shows up as a visible discrepancy rather than a sub-cent one.
#
# `over_precise` carries one digit more than the currency allows and is used by
# the Phase 5 minor-unit probe. The fractional parts avoid exact .5 ties so the
# expectation does not depend on the host printf's tie-breaking rule.
currency_profile() {
  case "${1^^}" in
    USD) echo "2|New York|US|America/New_York|en|1.000000|199.00|199.00|597.00|24.50|85.00|300.00|500.00|25000|189.00|199.007" ;;
    JPY) echo "0|Tokyo|JP|Asia/Tokyo|ja|0.006700|29000|29000|87000|3600|12500|44000|75000|3700000|27000|29000.75" ;;
    INR) echo "2|Mumbai|IN|Asia/Kolkata|en|0.012000|16500.00|16500.00|49500.00|2050.00|7100.00|25000.00|42000.00|2080000|15400.00|16500.007" ;;
    KWD) echo "3|Kuwait City|KW|Asia/Kuwait|ar|3.260000|61.500|61.500|184.500|7.500|26.250|92.000|153.000|7660|57.500|61.5006" ;;
    EUR) echo "2|Paris|FR|Europe/Paris|fr|1.090000|185.00|185.00|555.00|22.50|78.00|280.00|460.00|23000|175.00|185.007" ;;
    *)   echo "2|Unknown|XX|UTC|en|1.000000|100.00|100.00|300.00|10.00|40.00|150.00|250.00|10000|90.00|100.007" ;;
  esac
}

ccy_field()      { currency_profile "$1" | cut -d'|' -f"$2"; }
ccy_units()      { ccy_field "$1" 1; }
ccy_city()       { ccy_field "$1" 2; }
ccy_country()    { ccy_field "$1" 3; }
ccy_tz()         { ccy_field "$1" 4; }
ccy_lang()       { ccy_field "$1" 5; }
ccy_usd_rate()   { ccy_field "$1" 6; }
ccy_amount()     { ccy_field "$1" 7; }
ccy_room()       { ccy_field "$1" 8; }
ccy_stay()       { ccy_field "$1" 9; }
ccy_minibar()    { ccy_field "$1" 10; }
ccy_restaurant() { ccy_field "$1" 11; }
ccy_payment()    { ccy_field "$1" 12; }
ccy_float()      { ccy_field "$1" 13; }
ccy_credit()     { ccy_field "$1" 14; }
ccy_noshow()     { ccy_field "$1" 15; }
ccy_precise()    { ccy_field "$1" 16; }

# One tenant + one property per location. EUR is absent on purpose — it is guest
# tender only, which is the case with no same-currency shortcut anywhere.
LOCATION_CURRENCIES=(USD JPY INR KWD)
# Every currency that can arrive as tender at any location.
TXN_CURRENCIES=(USD JPY INR KWD EUR)
GUEST_CCY="EUR"

# `bc` prints values below 1 without a leading zero (".917431"), which is invalid
# JSON and would be rejected before reaching the FX handler.
fx_scale() { printf "%.6f" "$1"; }

# Cross rate FROM → TO, both quoted against USD. Computed at the DECIMAL(12,6)
# scale the column stores so the expectation and the seeded value agree exactly.
cross_rate() {
  local from_usd to_usd
  from_usd=$(ccy_usd_rate "$1")
  to_usd=$(ccy_usd_rate "$2")
  fx_scale "$(echo "scale=10; $from_usd / $to_usd" | bc -l 2>/dev/null || echo "1")"
}

# Round half-up at the currency's ISO 4217 exponent, the way `roundToCurrency`
# in schema/src/api/currency.ts does. printf is wrong here: it rounds the binary
# double half-to-even, so an exact 60.7365 comes back 60.736 while the service
# stores 60.737 — a one-unit disagreement that looks like a conversion bug.
round_to_currency() {
  local value="$1" dp
  dp=$(ccy_units "$2")
  local scaled
  scaled=$(echo "scale=0; ($value * 10^$dp + 0.5) / 1" | bc -l 2>/dev/null || echo "0")
  if [[ "$dp" -eq 0 ]]; then
    echo "$scaled"
  else
    # bc prints values below 1 without a leading zero (".737"), which breaks both
    # JSON and the numeric compare.
    echo "scale=$dp; $scaled / 10^$dp" | bc -l | sed 's/^\./0./; s/^-\./-0./'
  fi
}

convert_amount() {
  local raw
  raw=$(echo "$1 * $2" | bc -l 2>/dev/null || echo "0")
  round_to_currency "$raw" "$3"
}

# ─── Per-location state ──────────────────────────────────────────────────────
declare -A TID PID TOK RTID OWNER
declare -A GUEST RES GFOLIO HFOLIO INVOICE SESSION ARACCT
declare -A POSTED_AMT PAYREF
declare -A PRE_CHARGES PRE_PAYMENTS

# ─── Preflight ───────────────────────────────────────────────────────────────

SYS_TOKEN=""

preflight() {
  local ok=true
  echo "── Preflight ────────────────────────────────────────────────────────"
  if ensure_deps jq bc curl; then printf "  ✓ jq, bc, curl\n"; else ok=false; fi

  if curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$GW/health" | grep -q "200"; then
    printf "  ✓ api-gateway reachable\n"
  else printf "  ✗ api-gateway unreachable at %s\n" "$GW"; ok=false; fi

  if curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$BILLING_SVC/health" | grep -q "200"; then
    printf "  ✓ billing-service reachable\n"
  else printf "  ✗ billing-service unreachable at %s\n" "$BILLING_SVC"; ok=false; fi

  echo "  Generating system admin token..."
  SYS_TOKEN=$(ADMIN_USERNAME=system.admin DB_PASSWORD=postgres \
    AUTH_JWT_SECRET=dev-secret-minimum-32-chars-change-me! \
    npx tsx Apps/core-service/scripts/bootstrap-system-admin-token.ts 2>/dev/null \
    | sed -n '/^{$/,/^}$/p' | jq -r '.token // empty')
  if [[ -n "$SYS_TOKEN" ]]; then printf "  ✓ system admin token\n"
  else printf "  ✗ system admin token — cannot bootstrap tenants\n"; ok=false; fi

  if dlq_available; then
    local summary=""
    for t in "${DLQ_TOPICS[@]}"; do
      PRE_DLQ[$t]=$(dlq_topic_depth "$t")
      summary+=" ${t}=${PRE_DLQ[$t]}"
    done
    DLQ_TRACKED=1
    printf "  ✓ DLQ baseline captured:%s\n" "$summary"
  else
    printf "  ⚠ Kafka container '%s' unreachable — DLQ check will be skipped\n" "$KAFKA_CONTAINER"
  fi

  echo ""
  if ! $ok; then echo "FATAL: Preflight failed"; exit 1; fi
}

# ═════════════════════════════════════════════════════════════════════════════
#  HEADER
# ═════════════════════════════════════════════════════════════════════════════

echo ""
echo "╔═══════════════════════════════════════════════════════════════════════╗"
echo "║   MULTI-CURRENCY × MULTI-LOCATION × MULTI-TENANT E2E TEST SUITE      ║"
echo "╠═══════════════════════════════════════════════════════════════════════╣"
printf "║  Run tag:    %-56s ║\n" "$RUN_TAG"
printf "║  Date:       %-56s ║\n" "$TODAY"
printf "║  Tenants:    %-56s ║\n" "${#LOCATION_CURRENCIES[@]} (one per location, bootstrapped from scratch)"
printf "║  Locations:  %-56s ║\n" "${LOCATION_CURRENCIES[*]} (4 countries)"
printf "║  Currencies: %-56s ║\n" "${TXN_CURRENCIES[*]}"
printf "║  Matrix:     %-56s ║\n" "${#LOCATION_CURRENCIES[@]} locations × ${#TXN_CURRENCIES[@]} currencies = $(( ${#LOCATION_CURRENCIES[@]} * ${#TXN_CURRENCIES[@]} )) combinations"
echo "╚═══════════════════════════════════════════════════════════════════════╝"
echo ""

preflight

# ═════════════════════════════════════════════════════════════════════════════
#  PHASE 0 — TENANT + PROPERTY PROVISIONING (one tenant per currency)
# ═════════════════════════════════════════════════════════════════════════════

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PHASE 0: TENANT PROVISIONING (${#LOCATION_CURRENCIES[@]} tenants, ${#LOCATION_CURRENCIES[@]} base currencies)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── 0.1  Bootstrap one tenant per location ──────────────────────────────────
echo "── 0.1  Bootstrap tenants ───────────────────────────────────────────"

for ccy in "${LOCATION_CURRENCIES[@]}"; do
  low="${ccy,,}"
  city=$(ccy_city "$ccy");   country=$(ccy_country "$ccy")
  tz=$(ccy_tz "$ccy");       lang=$(ccy_lang "$ccy")
  slug="mcl-${low}-${RUN_TAG}"
  user="mcl.${low}.${RUN_TAG}"
  email="mcl+${low}${RUN_TAG}@tartware.test"
  pcode="MCL-${ccy}-${RUN_TAG}"
  OWNER[$ccy]="$user"

  # Look the tenant up first so --tag can reuse a previous run's estate.
  existing=$(curl -s "$CORE_SVC/v1/system/tenants?limit=200" \
    -H "Authorization: Bearer $SYS_TOKEN" \
    | jq -r --arg slug "$slug" '.tenants // [] | map(select(.slug == $slug)) | .[0].id // empty' 2>/dev/null || echo "")

  if [[ -n "$existing" ]]; then
    TID[$ccy]="$existing"
    pass "Tenant $slug exists — $city ($ccy)"
  else
    code=$(curl -s -o "$RESP_FILE" -w "%{http_code}" \
      -X POST "$CORE_SVC/v1/system/tenants/bootstrap" \
      -H "Authorization: Bearer $SYS_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"tenant\": {
          \"name\": \"Tartware $city $RUN_TAG\",
          \"slug\": \"$slug\",
          \"type\": \"INDEPENDENT\",
          \"email\": \"$email\"
        },
        \"property\": {
          \"property_name\": \"Tartware $city\",
          \"property_code\": \"$pcode\",
          \"property_type\": \"hotel\",
          \"star_rating\": 4,
          \"total_rooms\": 40,
          \"email\": \"$email\",
          \"address\": { \"city\": \"$city\", \"country\": \"$country\" },
          \"currency\": \"$ccy\",
          \"timezone\": \"$tz\",
          \"default_language\": \"$lang\"
        },
        \"owner\": {
          \"username\": \"$user\",
          \"email\": \"$email\",
          \"password\": \"$OWNER_PASS\",
          \"first_name\": \"MCL\",
          \"last_name\": \"$ccy Owner\"
        }
      }")
    if [[ "$code" =~ ^2 ]]; then
      TID[$ccy]=$(jq -r '.tenant.id // empty' "$RESP_FILE")
      PID[$ccy]=$(jq -r '.property.id // empty' "$RESP_FILE")
      pass "Tenant $slug bootstrapped — $city, $country ($ccy)"
    else
      fail "Tenant $slug bootstrap" "HTTP $code $(jq -r '.detail // .message // .error // empty' "$RESP_FILE" 2>/dev/null | head -c 70)"
      continue
    fi
  fi

  # Owner token — every subsequent request for this location uses it.
  tok=$(curl -s -X POST "$GW/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$user\",\"password\":\"$OWNER_PASS\"}" \
    | jq -r '.access_token // .token // .data.access_token // empty')
  if [[ -n "$tok" ]]; then
    TOK[$ccy]="$tok"
    pass "Auth token for $ccy owner ($user)"
  else
    fail "Auth token for $ccy owner" "login failed for $user"
    continue
  fi

  # Modules — finance-automation gates every billing and FX route.
  TOKEN="$tok"
  code=$(put "$GW/v1/tenants/${TID[$ccy]}/modules" \
    "{\"modules\":[\"core\",\"finance-automation\",\"tenant-owner-portal\",\"facility-maintenance\",\"analytics-bi\",\"marketing-channel\",\"enterprise-api\",\"revenue-management\",\"loyalty\",\"distribution\"]}")
  assert_http "Modules enabled for $ccy tenant" "2" "$code"

  # Property id (bootstrap returns it; a reused tenant needs a lookup).
  if [[ -z "${PID[$ccy]:-}" ]]; then
    get "$GW/v1/properties?tenant_id=${TID[$ccy]}&limit=100" >/dev/null
    PID[$ccy]=$(resp_ffirst ".property_code == \"$pcode\"" "id")
    [[ -z "${PID[$ccy]:-}" ]] && PID[$ccy]=$(resp_first "id")
  fi

  if [[ -n "${PID[$ccy]:-}" ]]; then
    get "$GW/v1/properties?tenant_id=${TID[$ccy]}&limit=100" >/dev/null
    assert_eq "DB: $ccy property base currency"    "$ccy"     "$(resp_ffirst ".id == \"${PID[$ccy]}\"" "currency")"
    assert_eq "DB: $ccy property timezone $tz"     "$tz"      "$(resp_ffirst ".id == \"${PID[$ccy]}\"" "timezone")"
  else
    fail "Property for $ccy tenant" "not resolved"
  fi
done
echo ""

# Every location must have landed a tenant, token and property — the rest of the
# suite is meaningless otherwise.
READY=()
for ccy in "${LOCATION_CURRENCIES[@]}"; do
  if [[ -n "${TID[$ccy]:-}" && -n "${TOK[$ccy]:-}" && -n "${PID[$ccy]:-}" ]]; then
    READY+=("$ccy")
  fi
done
if [[ ${#READY[@]} -eq 0 ]]; then
  echo "FATAL: No location provisioned successfully"; exit 1
fi

# ── 0.2  Enable all commands (global catalog, not per-tenant) ───────────────
echo "── 0.2  Enable All Commands ─────────────────────────────────────────"

if $SKIP_COMMAND_ENABLE; then
  echo "  (skipped by --skip-command-enable)"
else
  TOKEN="${TOK[${READY[0]}]}"
  ALL_CMDS=$(curl -s -H "Authorization: Bearer $TOKEN" \
    "$GW/v1/commands/features?limit=500" \
    | jq -r '.[]? // .data[]? | .command_name' 2>/dev/null)
  CMD_NAMES=()
  while IFS= read -r cmd_name; do
    [[ -z "$cmd_name" ]] && continue
    CMD_NAMES+=("$cmd_name")
  done <<< "$ALL_CMDS"
  CMD_COUNT=${#CMD_NAMES[@]}

  # The batch endpoint caps `updates` at 200 items and the catalog is already
  # past that — sending the whole list in one call 400s and leaves every command
  # disabled, so send it in chunks.
  BATCH_MAX=200
  if [[ $CMD_COUNT -eq 0 ]]; then
    echo "  ⚠ No commands found in catalog — skipping enable step"
  else
    enabled_total=0; failed_chunks=0
    for ((offset = 0; offset < CMD_COUNT; offset += BATCH_MAX)); do
      chunk_payload=$(printf '%s\n' "${CMD_NAMES[@]:offset:BATCH_MAX}" \
        | jq -R -s 'split("\n") | map(select(length > 0) | {command_name: ., status: "enabled"})')
      enable_code=$(curl -s -o "$RESP_FILE" -w "%{http_code}" \
        -X PATCH "$GW/v1/commands/features/batch" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"updates\":$chunk_payload}")
      if [[ "$enable_code" =~ ^2 ]]; then
        chunk_updated=$(jq '.updated | length' "$RESP_FILE" 2>/dev/null || echo 0)
        enabled_total=$((enabled_total + chunk_updated))
      else
        failed_chunks=$((failed_chunks + 1))
        echo "  ⚠ Batch enable chunk at offset $offset failed (HTTP $enable_code)"
      fi
    done
    if [[ $failed_chunks -eq 0 ]]; then
      echo "  ✓ $enabled_total / $CMD_COUNT commands enabled globally"
    else
      echo "  ⚠ $enabled_total / $CMD_COUNT commands enabled — $failed_chunks chunk(s) failed"
    fi
  fi
  echo "  Waiting 32s for gateway command cache refresh..."
  sleep 32
  echo "  ✓ Command cache refreshed"
fi
echo ""

# ── 0.3  Room types, rooms and BAR rates — priced in the local currency ─────
echo "── 0.3  Room Types, Rooms & Rates (local currency) ──────────────────"

for ccy in "${READY[@]}"; do
  tid="${TID[$ccy]}"; pid="${PID[$ccy]}"; TOKEN="${TOK[$ccy]}"
  tcode="MCL-${ccy}-${RUN_TAG}"
  room_rate=$(ccy_room "$ccy")

  get "$GW/v1/room-types?tenant_id=$tid&property_id=$pid&limit=100" >/dev/null
  RTID[$ccy]=$(resp_ffirst ".type_code == \"$tcode\"" "room_type_id")

  if [[ -z "${RTID[$ccy]:-}" ]]; then
    code=$(post "$GW/v1/room-types" \
      "{\"tenant_id\":\"$tid\",\"property_id\":\"$pid\",\"type_name\":\"$(ccy_city "$ccy") Standard\",\"type_code\":\"$tcode\",\"category\":\"STANDARD\",\"base_occupancy\":2,\"max_occupancy\":3,\"max_adults\":2,\"max_children\":1,\"extra_bed_capacity\":1,\"number_of_beds\":1,\"base_price\":$room_rate,\"currency\":\"$ccy\",\"amenities\":[\"WIFI\",\"TV\",\"AC\"],\"is_active\":true,\"display_order\":1}")
    RTID[$ccy]=$(jq -r '.room_type_id // .data.room_type_id // .id // .data.id // empty' "$RESP_FILE" 2>/dev/null)
    if [[ -z "${RTID[$ccy]:-}" ]]; then
      get "$GW/v1/room-types?tenant_id=$tid&property_id=$pid&limit=100" >/dev/null
      RTID[$ccy]=$(resp_ffirst ".type_code == \"$tcode\"" "room_type_id")
    fi
    assert_http "Room type created ($ccy, $room_rate $ccy)" "2" "$code"
  else
    pass "Room type exists ($ccy)"
  fi

  if [[ -n "${RTID[$ccy]:-}" ]]; then
    # The room type must keep the location's currency — a USD-priced room type at
    # a JPY property makes every downstream rate meaningless.
    get "$GW/v1/room-types?tenant_id=$tid&property_id=$pid&limit=100" >/dev/null
    assert_eq_ci "DB: $ccy room type priced in $ccy" "$ccy" "$(resp_ffirst ".type_code == \"$tcode\"" "currency")"

    for r in 101 102 103 104 105; do
      get "$GW/v1/rooms?tenant_id=$tid&property_id=$pid&limit=500" >/dev/null
      if [[ -z "$(resp_ffirst ".room_number == \"$r\"" "room_id")" ]]; then
        post "$GW/v1/rooms" \
          "{\"tenant_id\":\"$tid\",\"property_id\":\"$pid\",\"room_type_id\":\"${RTID[$ccy]}\",\"room_number\":\"$r\",\"floor\":\"1\",\"status\":\"available\",\"housekeeping_status\":\"clean\",\"maintenance_status\":\"operational\",\"is_blocked\":false,\"is_out_of_order\":false}" >/dev/null
      fi
    done
    get "$GW/v1/rooms?tenant_id=$tid&property_id=$pid&limit=500" >/dev/null
    assert_gte "Rooms seeded at $(ccy_city "$ccy")" "5" "$(resp_count)"

    # BAR rate — reservation rate-plan resolution needs one on file.
    code=$(post "$GW/v1/rates?tenant_id=$tid" \
      "{\"tenant_id\":\"$tid\",\"property_id\":\"$pid\",\"room_type_id\":\"${RTID[$ccy]}\",\"rate_name\":\"Best Available Rate\",\"rate_code\":\"BAR\",\"base_rate\":$room_rate,\"currency\":\"$ccy\",\"valid_from\":\"2024-01-01\",\"status\":\"ACTIVE\"}")
    if [[ "$code" =~ ^2 || "$code" == "409" ]]; then
      pass "BAR rate $room_rate $ccy at $(ccy_city "$ccy")"
    else
      fail "BAR rate at $(ccy_city "$ccy")" "HTTP $code"
    fi
  else
    fail "Room type ($ccy)" "not resolved — pipeline will run without a rate plan"
  fi
done
echo ""

# ── 0.4  Pre-test row counts (per tenant) ───────────────────────────────────
echo "── 0.4  Pre-test Row Counts ─────────────────────────────────────────"
for ccy in "${READY[@]}"; do
  TOKEN="${TOK[$ccy]}"
  get "$GW/v1/billing/charges?tenant_id=${TID[$ccy]}&limit=200"  >/dev/null; PRE_CHARGES[$ccy]=$(resp_count)
  get "$GW/v1/billing/payments?tenant_id=${TID[$ccy]}&limit=200" >/dev/null; PRE_PAYMENTS[$ccy]=$(resp_count)
  printf "  %-14s charges=%-4s payments=%-4s tenant=%s\n" \
    "$(ccy_city "$ccy")" "${PRE_CHARGES[$ccy]}" "${PRE_PAYMENTS[$ccy]}" "${TID[$ccy]:0:8}…"
done
echo ""

# ═════════════════════════════════════════════════════════════════════════════
#  PHASE 1 — FX RATE MATRIX (per tenant)
# ═════════════════════════════════════════════════════════════════════════════
#
# fx_rates rows are tenant-scoped (lockFxRate prefers tenant rows over global),
# so each freshly bootstrapped tenant needs its own matrix. Without one the
# posting path falls back to 1.0 and records the foreign amount unconverted —
# a ¥29,000 charge becomes 29,000 in a USD ledger.

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PHASE 1: FX RATE MATRIX (per tenant)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

for loc in "${READY[@]}"; do
  tid="${TID[$loc]}"; TOKEN="${TOK[$loc]}"
  seeded=0; expected=0
  for from in "${TXN_CURRENCIES[@]}"; do
    [[ "$from" == "$loc" ]] && continue   # same-currency pair is rejected by design
    expected=$((expected + 1))
    rate=$(cross_rate "$from" "$loc")
    http=$(post "$GW/v1/billing/fx-rates" \
      "{\"tenant_id\":\"$tid\",\"from_currency\":\"$from\",\"to_currency\":\"$loc\",\"rate\":$rate,\"rate_date\":\"$TODAY\",\"rate_source\":\"QA_MATRIX\"}")
    if [[ "$http" == "201" || "$http" == "200" ]]; then
      seeded=$((seeded + 1))
    else
      fail "FX rate $from→$loc ($(ccy_city "$loc"))" "HTTP $http $(jq -r '.detail // .message // empty' "$RESP_FILE" 2>/dev/null | head -c 60)"
    fi
  done
  assert_eq "FX matrix seeded for $(ccy_city "$loc") ($expected pairs into $loc)" "$expected" "$seeded"

  get "$GW/v1/billing/fx-rates?tenant_id=$tid&rate_date=$TODAY&include_global=false&limit=500" >/dev/null
  assert_gte "DB: $loc tenant fx_rates rows for $TODAY" "$expected" "$(resp_count)"

  # Spot-check a rate round-trips at full precision. A rate silently truncated on
  # write skews every posting that locks against it.
  spot_from="EUR"; [[ "$loc" == "EUR" ]] && spot_from="USD"
  spot=$(cross_rate "$spot_from" "$loc")
  get "$GW/v1/billing/fx-rates?tenant_id=$tid&from_currency=$spot_from&to_currency=$loc&rate_date=$TODAY" >/dev/null
  assert_eq_num "DB: $spot_from→$loc round-trips at $spot" "$spot" "$(resp_first "rate")"
done
echo ""

# ── 1.2  Negative validation + same-day correction (first location only) ────
echo "── 1.2  FX Validation & Correction ──────────────────────────────────"
VAL_LOC="${READY[0]}"
TOKEN="${TOK[$VAL_LOC]}"; vtid="${TID[$VAL_LOC]}"

code=$(post "$GW/v1/billing/fx-rates" \
  "{\"tenant_id\":\"$vtid\",\"from_currency\":\"EU\",\"to_currency\":\"$VAL_LOC\",\"rate\":1.1,\"rate_date\":\"$TODAY\"}")
assert_http "FX rejects a non-ISO currency code" "4" "$code"

code=$(post "$GW/v1/billing/fx-rates" \
  "{\"tenant_id\":\"$vtid\",\"from_currency\":\"EUR\",\"to_currency\":\"$VAL_LOC\",\"rate\":-1.1,\"rate_date\":\"$TODAY\"}")
assert_http "FX rejects a negative rate" "4" "$code"

code=$(post "$GW/v1/billing/fx-rates" \
  "{\"tenant_id\":\"$vtid\",\"from_currency\":\"$VAL_LOC\",\"to_currency\":\"$VAL_LOC\",\"rate\":1.0,\"rate_date\":\"$TODAY\"}")
assert_http "FX rejects a same-currency pair" "4" "$code"

# Same-day correction upserts in place: 200, not a second row.
CORRECTED=$(fx_scale "$(echo "$(cross_rate EUR "$VAL_LOC") * 1.05" | bc -l)")
code=$(post "$GW/v1/billing/fx-rates" \
  "{\"tenant_id\":\"$vtid\",\"from_currency\":\"EUR\",\"to_currency\":\"$VAL_LOC\",\"rate\":$CORRECTED,\"rate_date\":\"$TODAY\",\"rate_source\":\"QA_CORRECTION\"}")
assert_eq "FX same-day correction upserts (200, not 201)" "200" "$code"
get "$GW/v1/billing/fx-rates?tenant_id=$vtid&from_currency=EUR&to_currency=$VAL_LOC&rate_date=$TODAY&include_global=false" >/dev/null
assert_eq "FX correction leaves one row, not two" "1" "$(resp_count)"
assert_eq_num "FX correction took effect" "$CORRECTED" "$(resp_first "rate")"

# Restore the matrix rate — later phases assert against it.
RESTORED=$(cross_rate EUR "$VAL_LOC")
post "$GW/v1/billing/fx-rates" \
  "{\"tenant_id\":\"$vtid\",\"from_currency\":\"EUR\",\"to_currency\":\"$VAL_LOC\",\"rate\":$RESTORED,\"rate_date\":\"$TODAY\",\"rate_source\":\"QA_MATRIX\"}" >/dev/null
get "$GW/v1/billing/fx-rates?tenant_id=$vtid&from_currency=EUR&to_currency=$VAL_LOC&rate_date=$TODAY&include_global=false" >/dev/null
assert_eq_num "FX matrix rate restored" "$RESTORED" "$(resp_first "rate")"
echo ""

# ═════════════════════════════════════════════════════════════════════════════
#  PHASE 2 — FULL BILLING PIPELINE PER TENANT, IN THE LOCAL CURRENCY
# ═════════════════════════════════════════════════════════════════════════════
#
# Same pipeline test-multi-tenant.sh runs, except nothing is USD unless the
# location is New York: the reservation, the folio, every charge, the payment,
# the invoice, the cashier float, the AR credit limit and the GL batch are all
# denominated in the property's own base currency, and each step asserts the
# currency that came back rather than only that a row appeared.

run_currency_pipeline() {
  local ccy="$1"
  local tid="${TID[$ccy]}" pid="${PID[$ccy]}" rtid="${RTID[$ccy]:-}"
  local city units
  city=$(ccy_city "$ccy"); units=$(ccy_units "$ccy")
  TOKEN="${TOK[$ccy]}"; CUR_TID="$tid"

  local guest_id="" res_id="" folio_id="" inv_id="" session_id="" payref=""
  local tag="${ccy}-${RUN_TAG}"

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  BILLING PIPELINE: $city — base $ccy (${units}dp)"
  echo "  tenant=$tid  property=$pid"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""

  # ── Guest ──
  echo "── $city — Guest ────────────────────────────────────────────────────"
  # $UNIQUE, not $RUN_TAG: --tag reuses the estate, but a re-run still needs a
  # fresh guest or the create comes back 409 on the email uniqueness constraint.
  local gemail="guest-${ccy,,}-${UNIQUE}@tartware-test.local"
  seed_rest "REST guest at $city" "$GW/v1/guests" \
    "{\"tenant_id\":\"$tid\",\"first_name\":\"Mika\",\"last_name\":\"Traveller-$ccy\",\"email\":\"$gemail\",\"phone\":\"+1-555-$(printf '%03d' $((RANDOM % 1000)))-$(printf '%04d' $((RANDOM % 10000)))\",\"nationality\":\"$(ccy_country "$ccy")\"}"
  guest_id=$(jq -r '.id // .data.id // .guest_id // empty' "$RESP_FILE" 2>/dev/null)
  if [[ -z "$guest_id" ]]; then
    wait_kafka 3
    get "$GW/v1/guests?tenant_id=$tid&email=$gemail" >/dev/null
    guest_id=$(resp_first "id")
  fi
  GUEST[$ccy]="$guest_id"
  if [[ -n "$guest_id" ]]; then pass "Guest created at $city"; else fail "Guest at $city" "no id"; fi
  echo ""

  # ── Reservation + folio ──
  echo "── $city — Reservation & Folio ($ccy) ───────────────────────────────"
  if [[ -n "$guest_id" && -n "$rtid" ]]; then
    send_command "reservation.create: 3 nights, $(ccy_stay "$ccy") $ccy" \
      "reservation.create" \
      "{\"property_id\":\"$pid\",\"guest_id\":\"$guest_id\",\"room_type_id\":\"$rtid\",\"check_in_date\":\"$TODAY\",\"check_out_date\":\"$IN3DAYS\",\"status\":\"CONFIRMED\",\"source\":\"DIRECT\",\"total_amount\":$(ccy_stay "$ccy"),\"currency\":\"$ccy\"}"
    res_id=$(jq -r '.id // .data.id // .reservation_id // empty' "$RESP_FILE" 2>/dev/null)
    wait_kafka 6
    if [[ -z "$res_id" ]]; then
      get "$GW/v1/reservations?tenant_id=$tid&property_id=$pid&limit=10" >/dev/null
      res_id=$(resp_first "id")
    fi
  fi
  RES[$ccy]="$res_id"

  if [[ -n "$res_id" ]]; then
    pass "Reservation created at $city"
    poll_count "$GW/v1/billing/folios?tenant_id=$tid&reservation_id=$res_id" 1 24 >/dev/null
    get "$GW/v1/billing/folios?tenant_id=$tid&reservation_id=$res_id" >/dev/null
    folio_id=$(resp_first "id")
    if [[ -n "$folio_id" ]]; then
      pass "Guest folio auto-created at $city"
      # The folio inherits the reservation currency. A USD folio at a JPY hotel
      # makes every balance on it unreconcilable against the property ledger.
      assert_eq_ci "DB: $city guest folio denominated in $ccy" "$ccy" "$(resp_first "currency")"
    else
      fail "Guest folio at $city" "none for reservation ${res_id:0:8}…"
    fi
  else
    fail "Reservation at $city" "not created"
  fi
  GFOLIO[$ccy]="$folio_id"
  echo ""

  # ── Charges, all in the local currency ──
  echo "── $city — Charge Postings ($ccy) ───────────────────────────────────"
  if [[ -n "$res_id" ]]; then
    local room minibar rest
    room=$(ccy_room "$ccy"); minibar=$(ccy_minibar "$ccy"); rest=$(ccy_restaurant "$ccy")
    send_command "charge.post ROOM $room $ccy" "billing.charge.post" \
      "{\"property_id\":\"$pid\",\"reservation_id\":\"$res_id\",\"amount\":$room,\"currency\":\"$ccy\",\"charge_code\":\"ROOM\",\"description\":\"Room charge $tag\"}"
    send_command "charge.post MINIBAR $minibar $ccy" "billing.charge.post" \
      "{\"property_id\":\"$pid\",\"reservation_id\":\"$res_id\",\"amount\":$minibar,\"currency\":\"$ccy\",\"charge_code\":\"MINIBAR\",\"description\":\"Minibar $tag\"}"
    send_command "charge.post RESTAURANT $rest $ccy" "billing.charge.post" \
      "{\"property_id\":\"$pid\",\"reservation_id\":\"$res_id\",\"amount\":$rest,\"currency\":\"$ccy\",\"charge_code\":\"RESTAURANT\",\"description\":\"Dinner $tag\"}"
    wait_kafka 9

    local n
    n=$(poll_count "$GW/v1/billing/charges?tenant_id=$tid&reservation_id=$res_id&limit=200" 3 32)
    assert_gte "Charges posted at $city" "3" "$n"

    get "$GW/v1/billing/charges?tenant_id=$tid&reservation_id=$res_id&limit=200" >/dev/null
    local room_amt room_rate room_base room_bccy
    room_amt=$(resp_ffirst ".charge_description == \"Room charge $tag\"" "total_amount")
    room_rate=$(resp_ffirst ".charge_description == \"Room charge $tag\"" "exchange_rate")
    room_base=$(resp_ffirst ".charge_description == \"Room charge $tag\"" "base_amount")
    room_bccy=$(resp_ffirst ".charge_description == \"Room charge $tag\"" "base_currency")

    if [[ -n "$room_amt" ]]; then
      assert_eq_num "DB: $city ROOM amount $room preserved"  "$room" "$room_amt"
      assert_eq_ci  "DB: $city ROOM tendered in $ccy"        "$ccy"  "$(resp_ffirst ".charge_description == \"Room charge $tag\"" "currency")"
      # Local currency at its own property: the rate must be the same-currency
      # no-op, and the base amount must equal the tendered amount exactly.
      assert_eq_num "DB: $city ROOM rate is 1.0 (same currency)" "1" "${room_rate:-0}"
      assert_eq_num "DB: $city ROOM base equals tender"          "$room" "${room_base:-0}"
      assert_eq_ci  "DB: $city ROOM base_currency $ccy"          "$ccy"  "${room_bccy:-}"
      assert_minor_units "DB: $city ROOM base in $ccy minor units" "$ccy" "${room_base:-0}"
    else
      fail "DB: $city ROOM posting" "not found"
    fi

    # Folio balance rolls up in the location's currency.
    if [[ -n "$folio_id" ]]; then
      get "$GW/v1/billing/folios/$folio_id?tenant_id=$tid" >/dev/null
      local fbal
      fbal=$(jq -r '.balance // .data.balance // empty' "$RESP_FILE" 2>/dev/null)
      if [[ -n "$fbal" ]]; then
        assert_minor_units "DB: $city folio balance in $ccy minor units" "$ccy" "$fbal"
      else
        skip "DB: $city folio balance" "no balance field"
      fi
    fi
  else
    skip "Charges at $city" "no reservation"
  fi
  echo ""

  # ── Payment in the local currency ──
  echo "── $city — Payment ($ccy) ───────────────────────────────────────────"
  if [[ -n "$res_id" ]]; then
    local pay
    pay=$(ccy_payment "$ccy")
    payref="MCL-${ccy}-LOCAL-${RUN_TAG}"
    send_command "payment.capture $pay $ccy" "billing.payment.capture" \
      "{\"payment_reference\":\"$payref\",\"property_id\":\"$pid\",\"reservation_id\":\"$res_id\",\"guest_id\":\"$guest_id\",\"amount\":$pay,\"currency\":\"$ccy\",\"payment_method\":\"CREDIT_CARD\"}"
    wait_kafka 8

    get "$GW/v1/billing/payments?tenant_id=$tid&property_id=$pid&limit=200" >/dev/null
    local found
    found=$(resp_fcount ".payment_reference == \"$payref\"")
    assert_eq "DB: $city local payment recorded" "1" "$found"
    if [[ "$found" == "1" ]]; then
      assert_eq_num "DB: $city payment amount $pay"            "$pay" "$(resp_ffirst ".payment_reference == \"$payref\"" "amount")"
      assert_eq_ci  "DB: $city payment tendered in $ccy"       "$ccy" "$(resp_ffirst ".payment_reference == \"$payref\"" "currency")"
      assert_eq_num "DB: $city payment rate 1.0 (same currency)" "1"  "$(resp_ffirst ".payment_reference == \"$payref\"" "exchange_rate")"
      assert_eq_num "DB: $city payment base equals tender"     "$pay" "$(resp_ffirst ".payment_reference == \"$payref\"" "base_amount")"
      assert_eq_ci  "DB: $city payment base_currency $ccy"     "$ccy" "$(resp_ffirst ".payment_reference == \"$payref\"" "base_currency")"
    fi
  else
    skip "Payment at $city" "no reservation"
  fi
  echo ""

  # ── Invoice ──
  echo "── $city — Invoice ($ccy) ───────────────────────────────────────────"
  if [[ -n "$res_id" ]]; then
    send_command "invoice.create $(ccy_stay "$ccy") $ccy" "billing.invoice.create" \
      "{\"property_id\":\"$pid\",\"reservation_id\":\"$res_id\",\"guest_id\":\"$guest_id\",\"total_amount\":$(ccy_stay "$ccy"),\"currency\":\"$ccy\",\"idempotency_key\":\"INV-$tag\"}"
    wait_kafka 6
    get "$GW/v1/billing/invoices?tenant_id=$tid&property_id=$pid&reservation_id=$res_id" >/dev/null
    inv_id=$(resp_first "id")
    if [[ -n "$inv_id" ]]; then
      pass "Invoice created at $city"
      assert_eq_ci  "DB: $city invoice denominated in $ccy" "$ccy" "$(resp_first "currency")"
      assert_minor_units "DB: $city invoice total in $ccy minor units" "$ccy" "$(resp_first "total_amount")"
    else
      fail "Invoice at $city" "not found"
    fi
  else
    skip "Invoice at $city" "no reservation"
  fi
  INVOICE[$ccy]="$inv_id"
  echo ""

  # ── Cashier session — float declared in the local currency ──
  echo "── $city — Cashier Session ($ccy) ───────────────────────────────────"
  local cashier_uid=""
  get "$GW/v1/users?tenant_id=$tid&limit=1" >/dev/null 2>&1
  cashier_uid=$(resp_first "id")
  [[ -z "$cashier_uid" ]] && cashier_uid="$guest_id"
  if [[ -n "$cashier_uid" ]]; then
    send_command "cashier.open float $(ccy_float "$ccy") $ccy" "billing.cashier.open" \
      "{\"property_id\":\"$pid\",\"cashier_id\":\"$cashier_uid\",\"cashier_name\":\"Front Desk $city\",\"shift_type\":\"morning\",\"opening_float\":$(ccy_float "$ccy")}"
    wait_kafka 6
    get "$GW/v1/billing/cashier-sessions?tenant_id=$tid&property_id=$pid&limit=10" >/dev/null
    session_id=$(resp_first "session_id")
    if [[ -n "$session_id" ]]; then
      pass "Cashier session opened at $city"
      # The till at a Tokyo hotel counts yen. A session that reports its base as
      # USD makes the drawer reconciliation wrong by the whole FX rate.
      #
      # Read the detail route, not the list: CashierSessionListItemSchema has no
      # base_currency, so Fastify's response serialiser strips it and the list
      # can never answer this question.
      get "$GW/v1/billing/cashier-sessions/$session_id?tenant_id=$tid" >/dev/null
      assert_eq_ci "DB: $city cashier session base_currency $ccy" "$ccy" "$(resp_field "base_currency")"

      send_command "cashier.close" "billing.cashier.close" \
        "{\"session_id\":\"$session_id\",\"closing_cash_declared\":$(ccy_float "$ccy"),\"closing_cash_counted\":$(ccy_float "$ccy"),\"notes\":\"End of shift $tag\"}"
      wait_kafka 6
      get "$GW/v1/billing/cashier-sessions/$session_id?tenant_id=$tid" >/dev/null
      local sstatus
      sstatus=$(resp_field "session_status")
      assert_eq_ci "Cashier session closed at $city" "closed" "$sstatus"
    else
      fail "Cashier session at $city" "no session_id"
    fi
  else
    skip "Cashier session at $city" "no user to act as cashier"
  fi
  SESSION[$ccy]="$session_id"
  echo ""

  # ── AR account — credit limit in the local currency ──
  echo "── $city — AR Account ($ccy) ────────────────────────────────────────"
  local company_id=""
  # The company list keys its rows `company_id`, not `id` — reading `id` here
  # made every run create a second company instead of reusing the first.
  get "$GW/v1/companies?tenant_id=$tid&limit=10" >/dev/null
  company_id=$(resp_first "company_id")
  if [[ -z "$company_id" ]]; then
    post "$GW/v1/companies" \
      "{\"tenant_id\":\"$tid\",\"company_name\":\"Meridian Corp $ccy\",\"company_type\":\"corporate\",\"company_code\":\"MER-$ccy-$RUN_TAG\",\"city\":\"$city\",\"country\":\"$(ccy_country "$ccy")\",\"credit_limit\":$(ccy_credit "$ccy"),\"payment_terms_type\":\"net_30\",\"is_active\":true}" >/dev/null
    company_id=$(jq -r '.company_id // .id // .data.company_id // .data.id // empty' "$RESP_FILE" 2>/dev/null)
    if [[ -z "$company_id" ]]; then
      get "$GW/v1/companies?tenant_id=$tid&limit=10" >/dev/null
      company_id=$(resp_first "company_id")
    fi
  fi

  if [[ -n "$company_id" ]]; then
    send_command "ar.account.create limit $(ccy_credit "$ccy") $ccy" "ar.account.create" \
      "{\"property_id\":\"$pid\",\"company_id\":\"$company_id\",\"company_name\":\"Meridian Corp $ccy\",\"credit_limit\":$(ccy_credit "$ccy"),\"payment_terms\":\"NET30\",\"currency\":\"$ccy\"}"
    wait_kafka 6
    poll_for "$GW/v1/billing/ar/accounts?tenant_id=$tid&property_id=$pid&limit=10" \
      '.ar_account_id != null' 32 >/dev/null
    local ar_id
    ar_id=$(resp_first "ar_account_id")
    if [[ -n "$ar_id" ]]; then
      pass "AR account created at $city"
      assert_eq_ci "DB: $city AR account denominated in $ccy" "$ccy" "$(resp_first "currency")"
      ARACCT[$ccy]="$ar_id"
    else
      fail "AR account at $city" "no ar_account_id after command"
    fi
  else
    skip "AR account at $city" "no company record to attach to"
  fi
  echo ""

  # ── Night audit + GL batch ──
  echo "── $city — Night Audit & GL Batch ($ccy) ────────────────────────────"
  put "$GW/v1/night-audit/business-date?tenant_id=$tid" \
    "{\"tenant_id\":\"$tid\",\"property_id\":\"$pid\",\"business_date\":\"$TODAY\",\"date_status\":\"OPEN\",\"night_audit_status\":\"PENDING\"}" >/dev/null 2>&1 || true

  send_command "night_audit.execute $TODAY" "billing.night_audit.execute" \
    "{\"property_id\":\"$pid\",\"audit_date\":\"$TODAY\",\"perform_date_roll\":false}"
  wait_kafka 10
  assert_gte "Night audit executed at $city" "1" \
    "$(poll_count "$GW/v1/night-audit/history?tenant_id=$tid&property_id=$pid" 1 24)"

  send_command "ledger.post: rebuild GL batch" "billing.ledger.post" \
    "{\"property_id\":\"$pid\",\"business_date\":\"$TODAY\"}"
  wait_kafka 8

  get "$GW/v1/billing/gl-batches?tenant_id=$tid&property_id=$pid&start_date=$TODAY&end_date=$TODAY" >/dev/null
  local gl_batch_id
  gl_batch_id=$(resp_first "gl_batch_id")
  if [[ -n "$gl_batch_id" ]]; then
    pass "GL batch created at $city"
    # USALI keeps the books in the property's own currency. A batch stamped USD
    # at a Kuwait property mis-states every entry it summarises.
    assert_eq_ci "DB: $city GL batch currency $ccy" "$ccy" "$(resp_first "currency")"

    get "$GW/v1/billing/gl-batches/$gl_batch_id/entries?tenant_id=$tid" >/dev/null
    local entries
    entries=$(jq -r '.entry_count // (.data | length) // 0' "$RESP_FILE" 2>/dev/null || echo "0")
    if [[ "$entries" -ge 2 ]]; then
      pass "GL entries returned at $city (count=$entries)"
    else
      skip "GL entries at $city" "count=$entries"
    fi
  else
    fail "GL batch at $city" "none for $TODAY"
  fi
  echo ""

  # ── No-show penalty — a command that carries its own currency ──
  echo "── $city — No-Show Penalty ($ccy) ───────────────────────────────────"
  if [[ -n "$res_id" ]]; then
    local pre_ns
    get "$GW/v1/billing/charges?tenant_id=$tid&property_id=$pid&limit=200" >/dev/null
    pre_ns=$(resp_count)
    send_command "no_show.charge $(ccy_noshow "$ccy") $ccy" "billing.no_show.charge" \
      "{\"property_id\":\"$pid\",\"reservation_id\":\"$res_id\",\"charge_amount\":$(ccy_noshow "$ccy"),\"currency\":\"$ccy\",\"reason_code\":\"NO_SHOW_POLICY\"}"
    wait_kafka 8
    poll_delta "No-show charge posted at $city" \
      "$GW/v1/billing/charges?tenant_id=$tid&property_id=$pid&limit=200" "$pre_ns"

    get "$GW/v1/billing/charges?tenant_id=$tid&reservation_id=$res_id&limit=200" >/dev/null
    local ns_ccy ns_amt
    # no-show-charge.ts uses reason_code as the charge_code it writes.
    ns_ccy=$(resp_ffirst ".charge_code == \"NO_SHOW_POLICY\"" "currency")
    ns_amt=$(resp_ffirst ".charge_code == \"NO_SHOW_POLICY\"" "total_amount")
    if [[ -n "$ns_ccy" ]]; then
      assert_eq_ci "DB: $city no-show penalty denominated in $ccy" "$ccy" "$ns_ccy"
      assert_minor_units "DB: $city no-show amount in $ccy minor units" "$ccy" "${ns_amt:-0}"
    else
      skip "DB: $city no-show penalty currency" "no NO_SHOW posting to read"
    fi
  else
    skip "No-show penalty at $city" "no reservation"
  fi
  echo ""

  # ── House folio for the currency matrix in Phase 3 ──
  echo "── $city — House Account ($ccy) ─────────────────────────────────────"
  send_command "folio.create: house account ($ccy)" "billing.folio.create" \
    "{\"property_id\":\"$pid\",\"folio_type\":\"HOUSE_ACCOUNT\",\"folio_name\":\"MCL $ccy $UNIQUE\",\"currency\":\"$ccy\",\"notes\":\"Multi-currency location QA\",\"idempotency_key\":\"HOUSE-$tag\"}"
  wait_kafka 6
  get "$GW/v1/billing/folios?tenant_id=$tid&property_id=$pid&folio_type=HOUSE_ACCOUNT&limit=200" >/dev/null
  HFOLIO[$ccy]=$(resp_first "id")
  if [[ -n "${HFOLIO[$ccy]:-}" ]]; then
    pass "House folio at $city (${HFOLIO[$ccy]:0:8}…)"
    assert_eq_ci "DB: $city house folio currency $ccy" "$ccy" "$(resp_first "currency")"
  else
    fail "House folio at $city" "not found"
  fi
  echo ""

  echo "  ✓ Pipeline complete for $city ($ccy)"
  echo ""
}

echo ""
echo "╔═══════════════════════════════════════════════════════════════════════╗"
echo "║  PHASE 2: Per-Tenant Billing Pipeline in the Local Currency          ║"
echo "╚═══════════════════════════════════════════════════════════════════════╝"
echo ""

for ccy in "${READY[@]}"; do
  run_currency_pipeline "$ccy"
done

# ═════════════════════════════════════════════════════════════════════════════
#  PHASE 3 — THE MATRIX: every tender currency at every location
# ═════════════════════════════════════════════════════════════════════════════
#
# For each (location, tender currency) pair, post a charge onto that location's
# house folio and verify the ledger recorded three things correctly:
#   1. the tender currency and amount, untouched
#   2. the FX rate actually locked — 1.0 only when the currencies match
#   3. the base amount, rounded to the LOCATION's ISO 4217 exponent
#
# Point 3 is the one that fails on a system that rounds money at a fixed 2dp:
# a charge converted into JPY must be whole yen, and into KWD must keep its
# third decimal.

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PHASE 3: CURRENCY × LOCATION MATRIX"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

for loc in "${READY[@]}"; do
  folio="${HFOLIO[$loc]:-}"; pid="${PID[$loc]}"; tid="${TID[$loc]}"
  TOKEN="${TOK[$loc]}"; CUR_TID="$tid"
  [[ -z "$folio" ]] && { skip "Matrix at $(ccy_city "$loc")" "no house folio"; continue; }

  echo "── $(ccy_city "$loc") — base $loc ($(ccy_units "$loc")dp) ─────────────────────"
  for txn in "${TXN_CURRENCIES[@]}"; do
    amount=$(ccy_amount "$txn")
    POSTED_AMT["$loc/$txn"]="$amount"
    seed_rest "  POST $amount $txn at $(ccy_city "$loc")" \
      "$GW/v1/tenants/$tid/billing/charges" \
      "{\"property_id\":\"$pid\",\"folio_id\":\"$folio\",\"amount\":$amount,\"currency\":\"$txn\",\"charge_code\":\"MISC\",\"posting_type\":\"DEBIT\",\"quantity\":1,\"description\":\"MCL $txn at $(ccy_city "$loc") $UNIQUE\"}"
  done
done

wait_kafka 12

echo ""
echo "── Verification ─────────────────────────────────────────────────────"
for loc in "${READY[@]}"; do
  folio="${HFOLIO[$loc]:-}"; tid="${TID[$loc]}"
  TOKEN="${TOK[$loc]}"
  [[ -z "$folio" ]] && continue

  # Wait for the last tender currency to land before snapshotting: the postings
  # arrive on Kafka's schedule, and a snapshot taken early reads as "not found"
  # for every currency behind it.
  last_ccy="${TXN_CURRENCIES[${#TXN_CURRENCIES[@]}-1]}"
  poll_for "$GW/v1/billing/charges?tenant_id=$tid&folio_id=$folio&limit=200" \
    ".charge_description == \"MCL $last_ccy at $(ccy_city "$loc") $UNIQUE\"" 40 >/dev/null
  cp "$RESP_FILE" "${RESP_FILE}.mtx"

  for txn in "${TXN_CURRENCIES[@]}"; do
    amount="${POSTED_AMT["$loc/$txn"]:-}"
    [[ -z "$amount" ]] && continue
    cp "${RESP_FILE}.mtx" "$RESP_FILE"

    filter=".currency == \"$txn\" and .charge_description == \"MCL $txn at $(ccy_city "$loc") $UNIQUE\""
    actual_amt=$(resp_ffirst "$filter" "total_amount")
    actual_rate=$(resp_ffirst "$filter" "exchange_rate")
    actual_base=$(resp_ffirst "$filter" "base_amount")
    actual_base_ccy=$(resp_ffirst "$filter" "base_currency")

    if [[ -z "$actual_amt" ]]; then
      fail "$loc ← $txn" "posting not found"
      continue
    fi

    if [[ "$txn" == "$loc" ]]; then
      expected_rate="1"
      expected_base="$amount"
    else
      expected_rate=$(cross_rate "$txn" "$loc")
      expected_base=$(convert_amount "$amount" "$expected_rate" "$loc")
    fi

    assert_eq_num "$loc ← $txn: amount $amount preserved"   "$amount"        "$actual_amt"
    assert_eq_num "$loc ← $txn: rate $expected_rate locked" "$expected_rate" "${actual_rate:-0}"
    assert_eq_num "$loc ← $txn: base $expected_base $loc"   "$expected_base" "${actual_base:-0}"
    assert_eq_ci  "$loc ← $txn: base_currency $loc"         "$loc"           "${actual_base_ccy:-}"
    assert_minor_units "$loc ← $txn: base in $loc minor units" "$loc" "${actual_base:-0}"
  done
  rm -f "${RESP_FILE}.mtx"
done
echo ""

# ═════════════════════════════════════════════════════════════════════════════
#  PHASE 4 — GUEST-CURRENCY PAYMENTS (EUR at every location)
# ═════════════════════════════════════════════════════════════════════════════
#
# EUR is no property's base currency, so a EUR payment always converts. That is
# the case with no same-currency shortcut anywhere in the capture path.

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PHASE 4: GUEST-CURRENCY PAYMENTS ($GUEST_CCY at every location)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# The guest folio, not the house folio: payments.reservation_id is NOT NULL, so
# a capture against a house account fails in the handler, retries four times and
# dead-letters — and every command queued behind it on that partition is starved.
# A guest settling their own folio in EUR is the realistic case anyway.
for loc in "${READY[@]}"; do
  folio="${GFOLIO[$loc]:-}"; pid="${PID[$loc]}"; tid="${TID[$loc]}"
  res="${RES[$loc]:-}"; guest="${GUEST[$loc]:-}"
  TOKEN="${TOK[$loc]}"
  [[ -z "$folio" || -z "$res" ]] && { skip "EUR payment at $(ccy_city "$loc")" "no guest folio/reservation"; continue; }
  ref="MCL-${loc}-${GUEST_CCY}-${RUN_TAG}"
  PAYREF[$loc]="$ref"
  amount=$(ccy_amount "$GUEST_CCY")
  seed_rest "POST payment $amount $GUEST_CCY at $(ccy_city "$loc") ($loc books)" \
    "$GW/v1/tenants/$tid/billing/payments/capture" \
    "{\"payment_reference\":\"$ref\",\"property_id\":\"$pid\",\"folio_id\":\"$folio\",\"reservation_id\":\"$res\",\"guest_id\":\"$guest\",\"amount\":$amount,\"currency\":\"$GUEST_CCY\",\"payment_method\":\"CREDIT_CARD\"}"
done

wait_kafka 10

for loc in "${READY[@]}"; do
  ref="${PAYREF[$loc]:-}"
  [[ -z "$ref" ]] && continue
  TOKEN="${TOK[$loc]}"
  poll_for "$GW/v1/billing/payments?tenant_id=${TID[$loc]}&limit=200" \
    ".payment_reference == \"$ref\"" 40 >/dev/null
  cp "$RESP_FILE" "${RESP_FILE}.pay"

  amount=$(ccy_amount "$GUEST_CCY")
  expected_rate=$(cross_rate "$GUEST_CCY" "$loc")
  expected_base=$(convert_amount "$amount" "$expected_rate" "$loc")

  found=$(resp_fcount ".payment_reference == \"$ref\"")
  assert_eq "DB: payment $ref recorded" "1" "$found"

  if [[ "$found" == "1" ]]; then
    assert_eq_ci  "DB: $loc payment tendered in $GUEST_CCY"  "$GUEST_CCY"     "$(resp_ffirst ".payment_reference == \"$ref\"" "currency")"
    assert_eq_num "DB: $loc payment amount $amount"          "$amount"        "$(resp_ffirst ".payment_reference == \"$ref\"" "amount")"
    assert_eq_num "DB: $loc payment rate $expected_rate"     "$expected_rate" "$(resp_ffirst ".payment_reference == \"$ref\"" "exchange_rate")"
    assert_eq_num "DB: $loc payment base $expected_base"     "$expected_base" "$(resp_ffirst ".payment_reference == \"$ref\"" "base_amount")"
    assert_minor_units "DB: $loc payment base in $loc minor units" "$loc" "$(resp_ffirst ".payment_reference == \"$ref\"" "base_amount")"
  fi
  rm -f "${RESP_FILE}.pay"
done
echo ""

# ═════════════════════════════════════════════════════════════════════════════
#  PHASE 5 — MINOR-UNIT PRECISION PROBES
# ═════════════════════════════════════════════════════════════════════════════
#
# 5.1 An amount carrying one digit more than the currency allows must be
#     normalised before it reaches the ledger — ¥29,000.75 is not tenderable.
#     Payments do this (roundToCurrency in payment.ts); charges are the probe.
# 5.2 A charge posted WITHOUT an explicit currency must adopt the property's
#     base currency, not the "USD" default in charge.ts.

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PHASE 5: MINOR-UNIT PRECISION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "── 5.1  Over-precise tender is normalised ───────────────────────────"
for loc in "${READY[@]}"; do
  folio="${HFOLIO[$loc]:-}"; pid="${PID[$loc]}"; tid="${TID[$loc]}"
  TOKEN="${TOK[$loc]}"
  [[ -z "$folio" ]] && continue
  precise=$(ccy_precise "$loc")
  desc="MCL PRECISE $loc $UNIQUE"
  seed_rest "POST $precise $loc at $(ccy_city "$loc") ($(ccy_units "$loc")dp currency)" \
    "$GW/v1/tenants/$tid/billing/charges" \
    "{\"property_id\":\"$pid\",\"folio_id\":\"$folio\",\"amount\":$precise,\"currency\":\"$loc\",\"charge_code\":\"MISC\",\"posting_type\":\"DEBIT\",\"quantity\":1,\"description\":\"$desc\"}"

  # A payment of the same over-precise amount — the control case, since
  # payment.capture normalises through roundToCurrency. Guest folio, for the
  # NOT NULL reservation_id reason described in Phase 4.
  gfolio="${GFOLIO[$loc]:-}"; res="${RES[$loc]:-}"; guest="${GUEST[$loc]:-}"
  if [[ -n "$gfolio" && -n "$res" ]]; then
    seed_rest "POST payment $precise $loc at $(ccy_city "$loc")" \
      "$GW/v1/tenants/$tid/billing/payments/capture" \
      "{\"payment_reference\":\"MCL-PRECISE-$loc-$RUN_TAG\",\"property_id\":\"$pid\",\"folio_id\":\"$gfolio\",\"reservation_id\":\"$res\",\"guest_id\":\"$guest\",\"amount\":$precise,\"currency\":\"$loc\",\"payment_method\":\"CASH\"}"
  else
    skip "Over-precise payment at $(ccy_city "$loc")" "no guest folio/reservation"
  fi
done

wait_kafka 10

for loc in "${READY[@]}"; do
  folio="${HFOLIO[$loc]:-}"; tid="${TID[$loc]}"
  TOKEN="${TOK[$loc]}"
  [[ -z "$folio" ]] && continue
  precise=$(ccy_precise "$loc")
  expected=$(round_to_currency "$precise" "$loc")
  desc="MCL PRECISE $loc $UNIQUE"

  poll_for "$GW/v1/billing/charges?tenant_id=$tid&folio_id=$folio&limit=200" \
    ".charge_description == \"$desc\"" 40 >/dev/null
  actual=$(resp_ffirst ".charge_description == \"$desc\"" "total_amount")
  if [[ -n "$actual" ]]; then
    assert_minor_units "$loc: charge tender normalised to $(ccy_units "$loc")dp" "$loc" "$actual"
    assert_eq_num "$loc: charge $precise → $expected" "$expected" "$actual"
    assert_minor_units "$loc: charge base normalised" "$loc" \
      "$(resp_ffirst ".charge_description == \"$desc\"" "base_amount")"
  else
    fail "$loc: over-precise charge" "posting not found"
  fi

  poll_for "$GW/v1/billing/payments?tenant_id=$tid&limit=200" \
    ".payment_reference == \"MCL-PRECISE-$loc-$RUN_TAG\"" 40 >/dev/null
  pactual=$(resp_ffirst ".payment_reference == \"MCL-PRECISE-$loc-$RUN_TAG\"" "amount")
  if [[ -n "$pactual" ]]; then
    assert_minor_units "$loc: payment tender normalised to $(ccy_units "$loc")dp" "$loc" "$pactual"
    assert_eq_num "$loc: payment $precise → $expected" "$expected" "$pactual"
  else
    fail "$loc: over-precise payment" "not found"
  fi
done
echo ""

echo "── 5.2  Currency defaults to the property base, not USD ─────────────"
for loc in "${READY[@]}"; do
  [[ "$loc" == "USD" ]] && continue   # nothing to distinguish at a USD property
  folio="${HFOLIO[$loc]:-}"; pid="${PID[$loc]}"; tid="${TID[$loc]}"
  TOKEN="${TOK[$loc]}"
  [[ -z "$folio" ]] && continue
  desc="MCL NOCCY $loc $UNIQUE"
  seed_rest "POST $(ccy_amount "$loc") (no currency field) at $(ccy_city "$loc")" \
    "$GW/v1/tenants/$tid/billing/charges" \
    "{\"property_id\":\"$pid\",\"folio_id\":\"$folio\",\"amount\":$(ccy_amount "$loc"),\"charge_code\":\"MISC\",\"posting_type\":\"DEBIT\",\"quantity\":1,\"description\":\"$desc\"}"
done

wait_kafka 8

for loc in "${READY[@]}"; do
  [[ "$loc" == "USD" ]] && continue
  folio="${HFOLIO[$loc]:-}"; tid="${TID[$loc]}"
  TOKEN="${TOK[$loc]}"
  [[ -z "$folio" ]] && continue
  desc="MCL NOCCY $loc $UNIQUE"
  poll_for "$GW/v1/billing/charges?tenant_id=$tid&folio_id=$folio&limit=200" \
    ".charge_description == \"$desc\"" 40 >/dev/null
  ccy_got=$(resp_ffirst ".charge_description == \"$desc\"" "currency")
  if [[ -n "$ccy_got" ]]; then
    # An unqualified amount at a Tokyo hotel is yen. Recording it as USD both
    # mislabels the tender and converts nothing, so the folio total is wrong by
    # the whole exchange rate.
    assert_eq_ci "$loc: unqualified charge adopts property base $loc" "$loc" "$ccy_got"
  else
    fail "$loc: unqualified charge" "posting not found"
  fi
done
echo ""

# ═════════════════════════════════════════════════════════════════════════════
#  PHASE 6 — CROSS-TENANT & CROSS-CURRENCY ISOLATION
# ═════════════════════════════════════════════════════════════════════════════
#
# Each location is now its own tenant, so isolation is both a tenancy question
# and a currency one: Tokyo's postings must not appear in Kuwait City's books,
# and every folio at a location must carry that location's currency — otherwise
# the property total is meaningless.

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PHASE 6: CROSS-TENANT & CROSS-CURRENCY ISOLATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "── 6.1  Per-location ledger integrity ───────────────────────────────"
for loc in "${READY[@]}"; do
  tid="${TID[$loc]}"; pid="${PID[$loc]}"
  TOKEN="${TOK[$loc]}"

  get "$GW/v1/billing/charges?tenant_id=$tid&property_id=$pid&limit=200" >/dev/null
  total=$(resp_count)
  if [[ "$total" -eq 0 ]]; then
    skip "Isolation: $(ccy_city "$loc")" "no postings"
  else
    assert_eq "Isolation: $(ccy_city "$loc") — 0 foreign postings of $total" \
      "0" "$(resp_fcount ".property_id != \"$pid\"")"
    # Every posting at this location must roll up into this location's currency,
    # whatever currency the guest tendered in.
    assert_eq "Isolation: $(ccy_city "$loc") — all postings base to $loc" \
      "0" "$(resp_fcount ".base_currency != \"$loc\" and .base_currency != null")"
  fi

  get "$GW/v1/billing/folios?tenant_id=$tid&property_id=$pid&limit=200" >/dev/null
  fcount=$(resp_count)
  if [[ "$fcount" -eq 0 ]]; then
    skip "Isolation: $loc folio currency" "no folios"
  else
    assert_eq "Isolation: all $fcount folios at $(ccy_city "$loc") are $loc" \
      "0" "$(resp_fcount ".currency != \"$loc\"")"
  fi
done
echo ""

echo "── 6.2  Cross-tenant reads are blocked ──────────────────────────────"
# Each location's token pointed at the next location's tenant — must be refused
# or return nothing.
count=${#READY[@]}
for i in "${!READY[@]}"; do
  a="${READY[$i]}"; b="${READY[$(( (i + 1) % count ))]}"
  [[ "$a" == "$b" ]] && continue
  TOKEN="${TOK[$a]}"
  for ep in "billing/charges" "billing/payments" "billing/folios" "guests"; do
    code=$(get "$GW/v1/${ep}?tenant_id=${TID[$b]}&limit=10")
    n=$(resp_count)
    if [[ "$code" =~ ^(401|403|404) ]] || [[ "$n" == "0" ]]; then
      pass "Isolation: $a token cannot read $b $ep (HTTP=$code count=$n)"
    else
      fail "Isolation: $a token reading $b $ep" "HTTP=$code count=$n"
    fi
  done

  # FX rates are tenant-scoped too — a leaked rate table is a leaked commercial
  # position, and would also let one tenant's rate silently price another's books.
  code=$(get "$GW/v1/billing/fx-rates?tenant_id=${TID[$b]}&rate_date=$TODAY&include_global=false&limit=500")
  n=$(resp_count)
  if [[ "$code" =~ ^(401|403|404) ]] || [[ "$n" == "0" ]]; then
    pass "Isolation: $a token cannot read $b fx-rates (HTTP=$code count=$n)"
  else
    fail "Isolation: $a token reading $b fx-rates" "HTTP=$code count=$n"
  fi
done
echo ""

echo "── 6.3  Own FX table holds only own pairs ───────────────────────────"
for loc in "${READY[@]}"; do
  TOKEN="${TOK[$loc]}"
  get "$GW/v1/billing/fx-rates?tenant_id=${TID[$loc]}&rate_date=$TODAY&include_global=false&limit=500" >/dev/null
  n=$(resp_count)
  if [[ "$n" -eq 0 ]]; then
    skip "FX scope: $(ccy_city "$loc")" "no tenant rates"
  else
    assert_eq "FX scope: all $n rates at $(ccy_city "$loc") convert into $loc" \
      "0" "$(resp_fcount ".to_currency != \"$loc\"")"
    assert_eq "FX scope: no foreign tenant_id in $loc rate table" \
      "0" "$(resp_fcount ".tenant_id != null and .tenant_id != \"${TID[$loc]}\"")"
  fi
done
echo ""

echo "── 6.4  Cross-tenant command rejection ──────────────────────────────"
if [[ ${#READY[@]} -ge 2 ]]; then
  atk="${READY[0]}"; vic="${READY[1]}"
  code=$(curl -s -o "$RESP_FILE" -w "%{http_code}" \
    -X POST "$GW/v1/commands/billing.charge.post/execute" \
    -H "Authorization: Bearer ${TOK[$atk]}" \
    -H "Content-Type: application/json" \
    -H "Idempotency-Key: $(gen_uuid)" \
    -d "{\"tenant_id\":\"${TID[$vic]}\",\"payload\":{\"property_id\":\"${PID[$vic]}\",\"folio_id\":\"${HFOLIO[$vic]:-00000000-0000-0000-0000-000000000000}\",\"amount\":999.99,\"currency\":\"USD\",\"charge_code\":\"MISC\",\"description\":\"Cross-tenant currency attack $UNIQUE\"}}")
  if [[ "$code" =~ ^(400|401|403|404) ]]; then
    pass "Isolation: $atk token cannot post into $vic (HTTP=$code)"
  else
    wait_kafka 8
    TOKEN="${TOK[$vic]}"
    get "$GW/v1/billing/charges?tenant_id=${TID[$vic]}&limit=200" >/dev/null
    landed=$(resp_fcount ".charge_description == \"Cross-tenant currency attack $UNIQUE\"")
    assert_eq "Isolation: cross-tenant charge not persisted" "0" "$landed"
  fi
else
  skip "Cross-tenant command rejection" "need 2 locations"
fi
echo ""

# ═════════════════════════════════════════════════════════════════════════════
#  PHASE 7 — SUMMARY
# ═════════════════════════════════════════════════════════════════════════════

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ESTATE SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
printf "  %-14s %-5s %-3s %-10s %-10s %-10s %s\n" "LOCATION" "BASE" "DP" "TENANT" "PROPERTY" "FOLIO" "OWNER LOGIN"
for loc in "${READY[@]}"; do
  gf="${GFOLIO[$loc]:-}"
  printf "  %-14s %-5s %-3s %-10s %-10s %-10s %s\n" \
    "$(ccy_city "$loc")" "$loc" "$(ccy_units "$loc")" \
    "${TID[$loc]:0:8}" "${PID[$loc]:0:8}" "${gf:0:8}" "${OWNER[$loc]}"
done
echo ""
printf "  Owner password for every bootstrapped tenant: %s\n" "$OWNER_PASS"
printf "  Tender currencies exercised at every location: %s\n" "${TXN_CURRENCIES[*]}"
printf "  %s is guest-only — no property is based in it, so it always converts.\n" "$GUEST_CCY"
printf "  Re-run against this estate with: --tag=%s --skip-command-enable\n" "$RUN_TAG"
echo ""

echo "── Post-run row counts ──────────────────────────────────────────────"
for loc in "${READY[@]}"; do
  TOKEN="${TOK[$loc]}"
  get "$GW/v1/billing/charges?tenant_id=${TID[$loc]}&limit=200"  >/dev/null; post_charges=$(resp_count)
  get "$GW/v1/billing/payments?tenant_id=${TID[$loc]}&limit=200" >/dev/null; post_payments=$(resp_count)
  printf "  %-14s charges %s → %s   payments %s → %s\n" \
    "$(ccy_city "$loc")" "${PRE_CHARGES[$loc]:-0}" "$post_charges" \
    "${PRE_PAYMENTS[$loc]:-0}" "$post_payments"
done
echo ""

# ─── Dead-letter queues ──────────────────────────────────────────────────────
# A handler that throws is invisible to every 202 above; only the DLQ delta sees it.
echo "── Dead-letter queues ───────────────────────────────────────────────"
if [[ "$DLQ_TRACKED" == "1" ]]; then
  for t in "${DLQ_TOPICS[@]}"; do
    post_depth=$(dlq_topic_depth "$t")
    delta=$(( post_depth - ${PRE_DLQ[$t]:-0} ))
    if [[ "$delta" -le 0 ]]; then
      pass "DLQ $t unchanged (${PRE_DLQ[$t]:-0} → $post_depth)"
    else
      fail "DLQ $t grew by $delta" "${PRE_DLQ[$t]:-0} → $post_depth — a command handler threw"
    fi
  done
else
  skip "DLQ delta" "Kafka container unreachable"
fi
echo ""

echo "╔═══════════════════════════════════════════════════════════════════════╗"
if [[ $FAIL -eq 0 ]]; then
  printf "║  ✅  ALL TESTS PASSED: %d/%d passed" "$PASS" "$TOTAL"
else
  printf "║  ❌  TESTS COMPLETE:   %d/%d passed, %d FAILED" "$PASS" "$TOTAL" "$FAIL"
fi
if [[ $SKIP -gt 0 ]]; then printf ", %d skipped" "$SKIP"; fi
printf "%*s║\n" "$((16 - ${#PASS} - ${#TOTAL} - ${#FAIL} - ${#SKIP}))" ""
echo "╚═══════════════════════════════════════════════════════════════════════╝"
echo ""

if [[ $FAIL -gt 0 ]]; then exit 1; fi
