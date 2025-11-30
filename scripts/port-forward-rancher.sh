#!/usr/bin/env bash
set -euo pipefail
NAMESPACE=${RANCHER_NAMESPACE:-cattle-system}
LOCAL_PORT=${LOCAL_PORT:-8443}
TARGET_PORT=${RANCHER_TARGET_PORT:-443}
SERVICE_NAME=${RANCHER_SERVICE:-rancher}

echo "Forwarding https://localhost:${LOCAL_PORT} -> ${SERVICE_NAME}.${NAMESPACE}:${TARGET_PORT}" >&2
kubectl -n "${NAMESPACE}" port-forward "svc/${SERVICE_NAME}" "${LOCAL_PORT}:${TARGET_PORT}"
