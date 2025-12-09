#!/usr/bin/env bash

# Tartware helper: gracefully free dev ports (Ctrl+C equivalent)
# Usage:
#   ./scripts/kill-ports.sh             # kills defaults 3000 8080 3101
#   ./scripts/kill-ports.sh 3000 8080   # override ports

set -euo pipefail

DEFAULT_PORTS=(
  3000 # core-service / settings-service (Fastify)
  8080 # api-gateway
  3101 # reservations-command-service
  4200 # tartware-ui (Angular dev server)
  # Add more app-only ports here; docker-managed ports (5432,6379, etc.) are intentionally skipped
)

PORTS=("$@")
if [ ${#PORTS[@]} -eq 0 ]; then
  PORTS=("${DEFAULT_PORTS[@]}")
fi

graceful_kill() {
  local pid=$1
  local port=$2

  echo "→ Sending SIGINT to PID ${pid} (port ${port})"
  if ! kill -2 "${pid}" 2>/dev/null; then
    echo "  ! Failed to send SIGINT to ${pid}; skipping"
    return
  fi

  for _ in {1..5}; do
    if ! kill -0 "${pid}" 2>/dev/null; then
      echo "  ✓ Process ${pid} exited"
      return
    fi
    sleep 0.2
  done

  echo "  … PID ${pid} still alive, sending SIGKILL"
  kill -9 "${pid}" 2>/dev/null || true
}

for port in "${PORTS[@]}"; do
  pids=$(lsof -ti tcp:"${port}" 2>/dev/null || true)
  if [ -z "${pids}" ]; then
    echo "No process listening on port ${port}"
    continue
  fi

  for pid in ${pids}; do
    graceful_kill "${pid}" "${port}"
  done
done
