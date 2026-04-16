#!/usr/bin/env bash
set -eo pipefail

cd "$(dirname "$0")/../.."

echo "=== Stamping build version ==="
node scripts/stamp-ui-version.mjs

echo "=== Building UI ==="
npx nx run @tartware/pms-ui:build --skip-nx-cache 2>&1 | tail -15

echo "=== Purging old UI containers and images ==="
cd UI/pms-ui
sudo docker rm -f tartware-pms-ui tartware-ui 2>/dev/null || true
sudo docker rmi -f tartware-pms-ui tartware-ui 2>/dev/null || true
# Remove any dangling/unused images from previous UI builds
sudo docker image prune -f --filter "label=com.docker.compose.project" 2>/dev/null || true
sudo docker image prune -f 2>/dev/null || true

echo "=== Building fresh Docker image ==="
sudo docker build --no-cache -t tartware-pms-ui .
sudo docker run -d --name tartware-pms-ui \
  --add-host=host.docker.internal:host-gateway \
  -p 80:80 tartware-pms-ui

echo "=== Deploy complete ==="
sudo docker ps --filter name=tartware-pms-ui --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
