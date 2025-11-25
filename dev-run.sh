#!/bin/bash

# Unified dev runner with OTLP + env sanity checks.
# Usage: ./dev-run.sh <workspace> [npm-script]
# Examples:
#   ./dev-run.sh Apps/core-service
#   ./dev-run.sh Apps/api-gateway dev

set -euo pipefail

if [[ $# -lt 1 ]]; then
  cat <<'USAGE'
Usage: ./dev-run.sh <workspace> [npm-script]
The script loads .env, checks Docker dependencies, exports sane defaults
for Postgres/Redis/Kafka, wires OTLP env vars, and runs npm in the workspace.
USAGE
  exit 1
fi

WORKSPACE="$1"
NPM_COMMAND="${2:-dev}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

require_bin() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "❌ Missing dependency '$1'. Please install it first." >&2
    exit 1
  fi
}

require_bin npm
require_bin lsof
require_bin docker

DOCKER_CMD=(docker)
if ! "${DOCKER_CMD[@]}" info >/dev/null 2>&1; then
  if command -v sudo >/dev/null 2>&1 && sudo docker info >/dev/null 2>&1; then
    DOCKER_CMD=(sudo docker)
  else
    echo "❌ Docker is not running or current user lacks permission. Start Docker and/or run 'sudo usermod -aG docker $USER' then log out/in." >&2
    exit 1
  fi
fi

COMPOSE_CMD=("${DOCKER_CMD[@]}" compose)
if ! "${COMPOSE_CMD[@]}" version >/dev/null 2>&1; then
  if command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD=(docker-compose)
  else
    echo "❌ Neither 'docker compose' nor 'docker-compose' is available." >&2
    exit 1
  fi
fi

REQUIRED_SERVICES=(postgres redis kafka zookeeper otel-collector opensearch-node)
for service in "${REQUIRED_SERVICES[@]}"; do
  if ! "${COMPOSE_CMD[@]}" -f docker-compose.yml ps --status running --services 2>/dev/null | grep -Fxq "$service"; then
    echo "❌ Docker service '$service' is not running." >&2
    echo "   Start them with: docker compose up -d ${REQUIRED_SERVICES[*]}" >&2
    exit 1
  fi
done

if [[ ! -d "$WORKSPACE" ]]; then
  echo "❌ Workspace '$WORKSPACE' not found relative to repo root." >&2
  exit 1
fi

if [[ -f ".env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source ".env"
  set +a
fi

export DB_HOST="${DB_HOST:-127.0.0.1}"
export DB_PORT="${DB_PORT:-5432}"
export DB_NAME="${DB_NAME:-tartware}"
export DB_USER="${DB_USER:-postgres}"
export DB_PASSWORD="${DB_PASSWORD:-postgres}"
export DATABASE_URL="${DATABASE_URL:-postgres://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}}"
export REDIS_HOST="${REDIS_HOST:-127.0.0.1}"
export REDIS_PORT="${REDIS_PORT:-6379}"
export REDIS_PASSWORD="${REDIS_PASSWORD:-redis_password}"
export REDIS_URL="${REDIS_URL:-redis://:${REDIS_PASSWORD}@${REDIS_HOST}:${REDIS_PORT}}"
export REDIS_ENABLED="${REDIS_ENABLED:-true}"
export REDIS_TTL_DEFAULT="${REDIS_TTL_DEFAULT:-3600}"
DEFAULT_KAFKA_BROKERS="localhost:29092"
if [[ -z "${KAFKA_BROKERS:-}" ]]; then
  export KAFKA_BROKERS="$DEFAULT_KAFKA_BROKERS"
else
  # When running host-side, DNS name "kafka" is unresolved; auto-heal to localhost.
  if [[ "$KAFKA_BROKERS" == *"kafka:"* ]]; then
    echo "⚠️  Rewriting KAFKA_BROKERS='$KAFKA_BROKERS' to '$DEFAULT_KAFKA_BROKERS' for host access."
    export KAFKA_BROKERS="$DEFAULT_KAFKA_BROKERS"
  fi
fi
export NODE_ENV="${NODE_ENV:-development}"
export OTEL_EXPORTER_OTLP_ENDPOINT="${OTEL_EXPORTER_OTLP_ENDPOINT:-http://localhost:4318/v1}"
export OTEL_EXPORTER_OTLP_TRACES_ENDPOINT="${OTEL_EXPORTER_OTLP_TRACES_ENDPOINT:-http://localhost:4318/v1/traces}"
export OTEL_EXPORTER_OTLP_LOGS_ENDPOINT="${OTEL_EXPORTER_OTLP_LOGS_ENDPOINT:-http://localhost:4318/v1/logs}"
export OTEL_LOG_LEVEL="${OTEL_LOG_LEVEL:-info}"

case "$WORKSPACE" in
  Apps/core-service) DEFAULT_PORT=3000 ;;
  Apps/api-gateway) DEFAULT_PORT=8080 ;;
  Apps/reservations-command-service) DEFAULT_PORT=3101 ;;
  *)
    DEFAULT_PORT="${PORT:-}"
    ;;
esac

if [[ -n "${DEFAULT_PORT:-}" && -z "${PORT:-}" ]]; then
  export PORT="$DEFAULT_PORT"
fi

if [[ -n "${PORT:-}" ]]; then
  if lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "❌ Port $PORT is already in use. Free it before running this service." >&2
    exit 1
  fi
fi

echo "🚀 Starting $WORKSPACE (npm run $NPM_COMMAND)"
echo "📦 Postgres: $DATABASE_URL"
echo "🧠 Redis: $REDIS_URL"
echo "📬 Kafka brokers: $KAFKA_BROKERS"
echo "📊 OTLP endpoint: $OTEL_EXPORTER_OTLP_ENDPOINT"
echo ""

npm run "$NPM_COMMAND" --workspace="$WORKSPACE"
