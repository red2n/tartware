#!/usr/bin/env bash
set -euo pipefail
NAMESPACE=${ARGO_NAMESPACE:-argo}
LOCAL_PORT=${LOCAL_PORT:-8080}
TARGET_PORT=${ARGO_TARGET_PORT:-443}
SERVICE_NAME=${ARGO_SERVER_SERVICE:-argo-cd-argocd-server}

echo "Forwarding https://localhost:${LOCAL_PORT} -> ${SERVICE_NAME}.${NAMESPACE}:${TARGET_PORT}" >&2
kubectl -n "${NAMESPACE}" port-forward "svc/${SERVICE_NAME}" "${LOCAL_PORT}:${TARGET_PORT}"
