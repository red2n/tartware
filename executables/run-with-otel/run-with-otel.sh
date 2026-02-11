#!/bin/bash

# Run Tartware services with OpenTelemetry enabled
# Usage: ./run-with-otel.sh <workspace> [additional pnpm args]
# Example: ./run-with-otel.sh Apps/core-service
# Example: ./run-with-otel.sh Apps/api-gateway dev

set -e

if [ -z "$1" ]; then
  echo "❌ Error: Workspace argument is required"
  echo "Usage: $0 <workspace> [pnpm-command]"
  echo "Example: $0 Apps/core-service dev"
  exit 1
fi

WORKSPACE="$1"
NPM_COMMAND="${2:-dev}"

# Set OTEL environment variables
export OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4318/v1"
export OTEL_EXPORTER_OTLP_TRACES_ENDPOINT="http://localhost:4318/v1/traces"
export OTEL_EXPORTER_OTLP_LOGS_ENDPOINT="http://localhost:4318/v1/logs"
export OTEL_LOG_LEVEL="info"
export NODE_ENV="${NODE_ENV:-development}"

echo "🚀 Starting $WORKSPACE with OpenTelemetry enabled"
echo "📊 OTLP Endpoint: $OTEL_EXPORTER_OTLP_ENDPOINT"
echo "📝 Logs will be sent to OpenSearch via OTEL Collector"
echo ""

# Run the service
pnpm --filter "$WORKSPACE" run "$NPM_COMMAND"
