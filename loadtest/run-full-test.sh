#!/usr/bin/env bash
# End-to-end load test from a clean database.
#
# Every step runs in one place so a result can be reproduced rather than
# reassembled from memory: reset, boot, bootstrap tenants, seed the reference
# data a booking needs, seed aggregates, run, then report what actually landed
# in the database.
#
# Fixtures (room types, rates) are inserted with SQL. They are reference data a
# tenant is configured with, not the flow under test — every command and every
# read in the measured run goes through the API.
#
# Usage: ./loadtest/run-full-test.sh [tenants] [gateways] [peak-rate] [hold]
set -uo pipefail

TENANTS="${1:-50}"
GATEWAYS="${2:-10}"
PEAK="${3:-20000}"
HOLD="${4:-60s}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOGS="${LOGS:-/tmp/tartware-loadtest}"
mkdir -p "$LOGS"
cd "$ROOT"

echo "── 1/7  stopping any running stack ─────────────────────────────"
pkill -f "api-gateway" 2>/dev/null
pkill -f "src/index.ts" 2>/dev/null
pkill -f concurrently 2>/dev/null
sleep 4

echo "── 2/7  resetting the database ─────────────────────────────────"
./executables/tartware.sh db setup > "$LOGS/db-reset.log" 2>&1 || {
  echo "db reset failed — see $LOGS/db-reset.log"; exit 1; }
echo "  database reset (verified by the bootstrap below finding one tenant)"

echo "── 3/7  bootstrapping topics + starting services ───────────────"
# Partitions are the ceiling on how many commands a domain can apply at once,
# so the topics are sized before anything consumes from them.
pnpm run kafka:topics 2>&1 | grep -E "partitions|Creating|bootstrapped" || true

# With 128 partitions a consumer process left at the default 4 drains four of
# them and idles on the rest. Each concurrent partition holds a connection for
# its transaction, so this stays comfortably under DB_POOL_MAX (50).
export KAFKA_PARTITION_CONCURRENCY="${KAFKA_PARTITION_CONCURRENCY:-32}"

FORCE_COLOR=0 REGISTRY_URL=http://localhost:3000 npx concurrently --raw \
  -n core,guests,rooms,reservations,billing,housekeeping,availability,notifications,revenue \
  "pnpm run dev:core" "pnpm run dev:guests" "pnpm run dev:rooms" \
  "pnpm run dev:reservations" "pnpm run dev:billing" "pnpm run dev:housekeeping" \
  "pnpm run dev:availability-guard" "pnpm run dev:notification-service" \
  "pnpm run dev:revenue" > "$LOGS/services.log" 2>&1 &

for _ in $(seq 1 120); do
  UP=$(ss -ltn 2>/dev/null | grep -cE ':(3000|3010|3015|3020|3025|3030|3045|3055|3060) ')
  [ "$UP" -ge 9 ] && break
  sleep 3
done
echo "  services listening: ${UP:-0}/9   consumers: $(grep -c 'command consumer started' "$LOGS/services.log" 2>/dev/null || echo 0)/9"

echo "── 4/7  starting $GATEWAYS gateways + consumer replicas ────────"
./loadtest/run-gateway-fleet.sh "$GATEWAYS" 8085 "$LOGS/fleet" 2>&1 | tail -1
# Accepting commands scales with gateways; applying them scales with consumer
# replicas sharing the partitions.
./loadtest/run-consumer-replicas.sh "${CONSUMER_REPLICAS:-3}" "$LOGS/replicas" 2>&1 | tail -2

echo "── 5/7  bootstrapping $TENANTS tenants ─────────────────────────"
SYS=$(ADMIN_USERNAME=system.admin DB_PASSWORD=postgres \
  AUTH_JWT_SECRET='dev-secret-minimum-32-chars-change-me!' \
  npx tsx Apps/core-service/scripts/bootstrap-system-admin-token.ts 2>/dev/null |
  python3 -c "import sys,re; m=re.search(r'\"(?:token|access_token)\"\s*:\s*\"([^\"]+)\"', sys.stdin.read()); print(m.group(1) if m else '')")
[ -n "$SYS" ] || { echo "could not mint a system-admin token"; exit 1; }
python3 ./loadtest/bootstrap_tenants.py --count "$TENANTS" --system-token "$SYS" \
  --core http://localhost:3000 --gateway http://localhost:8085 \
  --out /tmp/tartware-tenant-tokens.tsv 2>&1 | tail -3

echo "── 6/7  enabling gates + seeding reference data + aggregates ───"
# Modules and command feature flags are opened through their own endpoints, so
# the run exercises the same gates a real client passes through.
./loadtest/enable-via-api.sh /tmp/tartware-tenant-tokens.tsv http://localhost:8085 2>&1 | grep -E "granted|enabled"
URLS_SEED=$(for i in $(seq 0 $((GATEWAYS - 1))); do printf 'http://localhost:%d,' $((8085 + i)); done | sed 's/,$//')
# Reference data, aggregates and the manifest all go through the API, so a
# broken endpoint fails the run instead of being quietly worked around.
python3 ./loadtest/seed_via_api.py \
  --gateways "$URLS_SEED" \
  --tokens /tmp/tartware-tenant-tokens.tsv \
  --guests "${SEED_GUESTS:-20}" \
  --reservations "${SEED_RESERVATIONS:-20}" \
  --out /tmp/tartware-flow-manifest.json || {
    echo "seeding failed"; exit 1; }

echo "── 7/7  running the flow at $PEAK ops/sec ──────────────────────"
URLS=$(for i in $(seq 0 $((GATEWAYS - 1))); do printf 'http://localhost:%d,' $((8085 + i)); done | sed 's/,$//')
MANIFEST_TENANTS=$(python3 -c "import json;print(len(json.load(open('/tmp/tartware-flow-manifest.json'))))" 2>/dev/null || echo 0)
echo "  driving $MANIFEST_TENANTS tenants, each with its own token"
[ "$MANIFEST_TENANTS" -gt 0 ] || { echo "manifest is empty — nothing can be driven"; exit 1; }

# Sample CPU while the load runs; "the box is saturated" should be a
# measurement, not an inference from throughput flattening.
( while :; do
    awk '/^cpu /{t=$2+$3+$4+$5+$6+$7+$8; i=$5; print t, i}' /proc/stat
    sleep 5
  done > "$LOGS/cpu-samples.txt" ) &
CPU_SAMPLER=$!

( cd loadtest/k6 && GATEWAY_URLS="$URLS" \
  MANIFEST_PATH=/tmp/tartware-flow-manifest.json \
  START_RATE=2000 PEAK_RATE="$PEAK" RAMP_DURATION=60s HOLD_DURATION="$HOLD" \
  PREALLOCATED_VUS=3000 MAX_VUS=15000 \
  k6 run scenarios/pms-full-flow.js ) 2>&1 | tee "$LOGS/k6.log" |
  grep -E "command_accept_rate|commands_accepted|total_ops|http_req_duration|http_req_failed|dropped_iterations|availability_latency|rate_lookup_latency|read_errors"

echo
kill "$CPU_SAMPLER" 2>/dev/null
awk 'NR==1{t0=$1;i0=$2} END{dt=$1-t0; di=$2-i0; if (dt>0) printf "  average CPU utilisation during run: %.0f%%\n", 100*(1-di/dt)}' "$LOGS/cpu-samples.txt"

echo "── settling + verifying (API only) ─────────────────────────────"
# Pipeline depth comes from each service's /metrics endpoint; counts come from
# the same list endpoints a client would call.
for _ in $(seq 1 60); do
  PENDING=$(curl -s -m 10 http://localhost:3020/metrics 2>/dev/null |
    awk '/^reservation_outbox_pending_records /{print $2}')
  [ -n "$PENDING" ] && [ "${PENDING%.*}" -le 5 ] && break
  sleep 5
done
echo "  reservation outbox pending: ${PENDING:-unknown}"

python3 - "$URLS_SEED" /tmp/tartware-tenant-tokens.tsv <<'PYEOF'
import json, sys, urllib.request, concurrent.futures as f

gateway = sys.argv[1].split(",")[0]
rows = [l.rstrip("\n").split("\t") for l in open(sys.argv[2]) if l.count("\t") == 2]

def count(entry, resource):
    tenant, _prop, token = entry
    req = urllib.request.Request(
        f"{gateway}/v1/{resource}?tenant_id={tenant}&limit=2000",
        headers={"Authorization": f"Bearer {token}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            body = json.loads(r.read() or "null")
    except Exception:
        return 0
    if isinstance(body, list):
        return len(body)
    if isinstance(body, dict) and isinstance(body.get("data"), list):
        return len(body["data"])
    return 0

for resource in ("reservations", "guests"):
    with f.ThreadPoolExecutor(max_workers=32) as pool:
        total = sum(pool.map(lambda e: count(e, resource), rows))
    print(f"  {resource} visible via API: {total} across {len(rows)} tenants")
PYEOF
echo "logs in $LOGS"
