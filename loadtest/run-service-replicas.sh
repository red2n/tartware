#!/usr/bin/env bash
# Start replicas of the domain services, for reads and for consuming.
#
# Two different bottlenecks, one mechanism:
#
#   * Consuming. A replica joins its Kafka consumer group and is assigned a
#     share of the partitions, so commands apply in parallel. This needs no
#     routing at all.
#   * Reading. Availability and rate lookups proxy through the gateway to a
#     single `rooms-service` / `core-service` process, and one Node event loop
#     is one core. Under load those reads fail while the box sits at ~56% —
#     the limit is the process, not the machine.
#
# Read replicas listen on deterministic ports so the gateway fleet can spread
# its proxy targets across them: gateway *i* is pointed at replica *i mod N*.
# That is client-side distribution rather than a load balancer, which is enough
# to show whether the single process was the ceiling; in Kubernetes the Service
# object does this properly and no such wiring is needed.
#
# Usage: ./loadtest/run-service-replicas.sh <consumer-replicas> <read-replicas> [log-dir]
# Stop:  pkill -f "src/index.ts"

set -uo pipefail

CONSUMERS="${1:-3}"
READS="${2:-3}"
LOG_DIR="${3:-/tmp/tartware-replicas}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

mkdir -p "$LOG_DIR"
cd "$ROOT"

# Deterministic port blocks, clear of the 3000-3060 primaries.
ROOMS_PORT_BASE=3400
CORE_PORT_BASE=3500
CONSUMER_PORT_BASE=3600

common_env() {
  export HOST=0.0.0.0
  export LOG_PRETTY=false
  export DB_NAME=tartware
  export DB_PASSWORD=postgres
  export AUTH_JWT_SECRET='dev-secret-minimum-32-chars-change-me!'
  export AUTH_JWT_ISSUER=tartware-core-service
  export AUTH_JWT_AUDIENCE=tartware-core
  export REDIS_PASSWORD=redis_password
  export KAFKA_BROKERS=localhost:29092
  export CORE_SERVICE_URL=http://localhost:3000
  export GUESTS_SERVICE_URL=http://localhost:3010
  export ROOMS_SERVICE_URL=http://localhost:3015
  export SERVICE_AUTH_USERNAME=setup.admin
  export SERVICE_AUTH_PASSWORD=TempPass1234
  export AVAILABILITY_GUARD_GRPC_TOKEN=guard-shared-secret-dev
  export KAFKA_PARTITION_CONCURRENCY="${KAFKA_PARTITION_CONCURRENCY:-32}"
  export KAFKA_BATCH_CONCURRENCY="${KAFKA_BATCH_CONCURRENCY:-16}"
}

start_replica() { # <package> <port> <log-name> <worker-id>
  ( common_env
    PORT="$2" \
    RESERVATION_COMMAND_PORT="$2" \
    RESERVATION_DLQ_TOPIC=reservations.events.dlq \
    OUTBOX_WORKER_ID="$4" \
      pnpm --filter "@tartware/$1" dev > "$LOG_DIR/$3.log" 2>&1 & )
}

echo "starting $READS read replica(s) each of rooms-service and core-service"
ROOMS_URLS=""
CORE_URLS=""
for i in $(seq 0 $((READS - 1))); do
  start_replica rooms-service $((ROOMS_PORT_BASE + i)) "rooms-read-$i" "rooms-read-$i"
  start_replica core-service $((CORE_PORT_BASE + i)) "core-read-$i" "core-read-$i"
  ROOMS_URLS="${ROOMS_URLS}http://localhost:$((ROOMS_PORT_BASE + i)),"
  CORE_URLS="${CORE_URLS}http://localhost:$((CORE_PORT_BASE + i)),"
done

echo "starting $CONSUMERS consumer replica(s) per command-consuming service"
CONSUMER_SERVICES=(
  reservations-command-service
  billing-service
  guests-service
  rooms-service
  housekeeping-service
)
index=0
for name in "${CONSUMER_SERVICES[@]}"; do
  for r in $(seq 1 "$CONSUMERS"); do
    start_replica "$name" $((CONSUMER_PORT_BASE + index)) "${name}-c${r}" "${name}-c${r}"
    index=$((index + 1))
  done
done

# The gateway fleet reads these to spread its proxy targets.
{
  echo "ROOMS_URLS=${ROOMS_URLS%,}"
  echo "CORE_URLS=${CORE_URLS%,}"
} > /tmp/tartware-replica-urls.env

TOTAL=$(( READS * 2 + CONSUMERS * ${#CONSUMER_SERVICES[@]} ))
echo "waiting for $TOTAL replicas to come up..."
for _ in $(seq 1 80); do
  READY=0
  for i in $(seq 0 $((READS - 1))); do
    curl -s -m 2 "http://localhost:$((ROOMS_PORT_BASE + i))/health" >/dev/null 2>&1 && READY=$((READY + 1))
    curl -s -m 2 "http://localhost:$((CORE_PORT_BASE + i))/health" >/dev/null 2>&1 && READY=$((READY + 1))
  done
  CONSUMING=$(grep -l "command consumer started" "$LOG_DIR"/*-c*.log 2>/dev/null | wc -l)
  [ "$READY" -ge $((READS * 2)) ] && [ "$CONSUMING" -ge $((CONSUMERS * ${#CONSUMER_SERVICES[@]})) ] && break
  sleep 3
done

echo "  read replicas healthy: ${READY:-0}/$((READS * 2))"
echo "  consumer replicas live: ${CONSUMING:-0}/$((CONSUMERS * ${#CONSUMER_SERVICES[@]}))"
CRASHED=$(grep -l "ERR_PNPM\|Failed to start" "$LOG_DIR"/*.log 2>/dev/null | wc -l)
[ "$CRASHED" -gt 0 ] && echo "  ⚠ $CRASHED replica log(s) show a startup failure — see $LOG_DIR"
echo "  wrote /tmp/tartware-replica-urls.env"
exit 0
