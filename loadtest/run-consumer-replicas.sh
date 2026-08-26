#!/usr/bin/env bash
# Start extra replicas of the command-consuming services.
#
# Applying commands, not accepting them, is what limits end-to-end throughput:
# one process per domain drains a handful of partitions and the rest sit idle.
# A replica joins the same Kafka consumer group, is assigned its share of the
# partitions, and applies commands in parallel with its siblings — which is how
# the partition count actually gets used.
#
# Replicas are consumer capacity only. Each still binds an HTTP port because
# the services boot a server, but nothing routes reads to them: the gateway is
# configured with a single URL per service. Scaling *reads* needs a load
# balancer in front of each service — in Kubernetes that is what the Service
# object already does, so this gap is local-only.
#
# Usage: ./loadtest/run-consumer-replicas.sh <replicas-per-service> [log-dir]
# Stop:  pkill -f "src/index.ts"

set -uo pipefail

REPLICAS="${1:-2}"
LOG_DIR="${2:-/tmp/tartware-replicas}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

mkdir -p "$LOG_DIR"
cd "$ROOT"

# The services that consume from commands.primary, with the base port their
# primary instance owns. Replicas are offset well clear of the 3000-3060 range
# so they never collide with a primary.
SERVICES=(
  "reservations-command-service:3020"
  "billing-service:3025"
  "guests-service:3010"
  "rooms-service:3015"
  "housekeeping-service:3030"
)

PORT_BASE=3300
index=0

for entry in "${SERVICES[@]}"; do
  NAME="${entry%%:*}"
  for r in $(seq 1 "$REPLICAS"); do
    PORT=$((PORT_BASE + index))
    index=$((index + 1))
    PORT=$PORT \
    HOST=0.0.0.0 \
    LOG_PRETTY=false \
    DB_NAME=tartware \
    DB_PASSWORD=postgres \
    AUTH_JWT_SECRET='dev-secret-minimum-32-chars-change-me!' \
    AUTH_JWT_ISSUER=tartware-core-service \
    AUTH_JWT_AUDIENCE=tartware-core \
    REDIS_PASSWORD=redis_password \
    KAFKA_BROKERS=localhost:29092 \
    KAFKA_PARTITION_CONCURRENCY="${KAFKA_PARTITION_CONCURRENCY:-32}" \
    KAFKA_BATCH_CONCURRENCY="${KAFKA_BATCH_CONCURRENCY:-16}" \
    CORE_SERVICE_URL=http://localhost:3000 \
    GUESTS_SERVICE_URL=http://localhost:3010 \
    ROOMS_SERVICE_URL=http://localhost:3015 \
    SERVICE_AUTH_USERNAME=setup.admin \
    SERVICE_AUTH_PASSWORD=TempPass1234 \
    AVAILABILITY_GUARD_GRPC_TOKEN=guard-shared-secret-dev \
    RESERVATION_COMMAND_PORT=$PORT \
    RESERVATION_DLQ_TOPIC=reservations.events.dlq \
    OUTBOX_WORKER_ID="${NAME}-replica-${r}" \
      pnpm --filter "@tartware/${NAME}" dev > "$LOG_DIR/${NAME}-r${r}.log" 2>&1 &
  done
done

echo "started $((REPLICAS * ${#SERVICES[@]})) replicas across ${#SERVICES[@]} services"
echo "waiting for consumers to join their groups..."

for _ in $(seq 1 60); do
  JOINED=$(grep -l "command consumer started" "$LOG_DIR"/*.log 2>/dev/null | wc -l)
  [ "$JOINED" -ge $((REPLICAS * ${#SERVICES[@]})) ] && break
  sleep 3
done
echo "  replicas with a live consumer: ${JOINED:-0} / $((REPLICAS * ${#SERVICES[@]}))"
CRASHED=$(grep -l "ERR_PNPM\|Failed to start" "$LOG_DIR"/*.log 2>/dev/null | wc -l)
[ "$CRASHED" -gt 0 ] && echo "  ⚠ $CRASHED replica log(s) show a startup failure — see $LOG_DIR"
exit 0
