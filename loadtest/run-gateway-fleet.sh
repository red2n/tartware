#!/usr/bin/env bash
# Start N API-gateway processes on consecutive ports for load testing.
#
# One gateway process is one Node event loop, so its command-acceptance ceiling
# is a single core's worth of JSON parsing, validation and pool waiting —
# measured at roughly 1,700/sec on this hardware. Reaching a fleet-scale target
# means running a fleet, exactly as the Kubernetes deployment does; a single
# process cannot get there no matter how the code is tuned.
#
# Each instance shares the database, PgBouncer, and Kafka, so this also puts the
# shared tiers under realistic contention rather than testing one process in
# isolation. Every instance runs its own outbox dispatcher, which is safe:
# `claimOutboxBatch` locks rows FOR UPDATE SKIP LOCKED.
#
# Usage:  ./loadtest/run-gateway-fleet.sh <count> <base-port> <log-dir>
# Stop:   pkill -f "api-gateway"

set -euo pipefail

COUNT="${1:-4}"
BASE_PORT="${2:-8085}"
LOG_DIR="${3:-/tmp/tartware-fleet}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

mkdir -p "$LOG_DIR"
node "$ROOT/scripts/dev/ensure-otel.mjs" >/dev/null 2>&1 || true

for i in $(seq 0 $((COUNT - 1))); do
  PORT=$((BASE_PORT + i))
  # Rate limits are raised deliberately: the shipped defaults (60 commands/min)
  # exist to protect a tenant from a runaway client, and would otherwise be the
  # only thing this test measures.
  PORT=$PORT \
  API_GATEWAY_PORT=$PORT \
  API_GATEWAY_LOG_PRETTY=false \
  API_GATEWAY_RATE_MAX=100000000 \
  API_GATEWAY_RATE_COMMAND_MAX=100000000 \
  API_GATEWAY_RATE_AUTH_MAX=1000000 \
  REDIS_ENABLED=false \
  DB_PASSWORD=postgres \
  REDIS_PASSWORD=redis_password \
  AUTH_JWT_SECRET='dev-secret-minimum-32-chars-change-me!' \
  AUTH_JWT_ISSUER=tartware-core-service \
  AUTH_JWT_AUDIENCE=tartware-core \
  CORE_SERVICE_URL=http://localhost:3000 \
  GUESTS_SERVICE_URL=http://localhost:3010 \
  ROOMS_SERVICE_URL=http://localhost:3015 \
  RESERVATION_COMMAND_SERVICE_URL=http://localhost:3020 \
  BILLING_SERVICE_URL=http://localhost:3025 \
  HOUSEKEEPING_SERVICE_URL=http://localhost:3030 \
  NOTIFICATION_SERVICE_URL=http://localhost:3055 \
  REVENUE_SERVICE_URL=http://localhost:3060 \
  COMMAND_OUTBOX_WORKER_ID="api-gateway-$PORT" \
    pnpm --filter @tartware/api-gateway dev > "$LOG_DIR/gateway-$PORT.log" 2>&1 &
  echo "started gateway on :$PORT (log $LOG_DIR/gateway-$PORT.log)"
done

echo "waiting for readiness..."
for i in $(seq 0 $((COUNT - 1))); do
  PORT=$((BASE_PORT + i))
  until curl -s -m 2 "http://localhost:$PORT/health" 2>/dev/null | grep -q '"status"'; do
    sleep 2
  done
  echo "  :$PORT ready"
done
echo "fleet of $COUNT gateways ready on ports $BASE_PORT-$((BASE_PORT + COUNT - 1))"
