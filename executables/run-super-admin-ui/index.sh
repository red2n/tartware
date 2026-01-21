#!/bin/bash

# Start Super Admin UI and Required Services
# This script starts core-service, command-center-service, and the Angular UI

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "🚀 Starting Super Admin UI services..."
echo ""

# Function to kill services on exit
cleanup() {
  echo ""
  echo "🛑 Stopping services..."
  pkill -P $$ || true
  exit 0
}

fail_startup() {
  echo ""
  echo "❌ Startup failed. Stopping services..."
  pkill -P $$ || true
  exit 1
}

trap cleanup INT TERM

# Start core-service
echo "📦 Starting core-service on port 3000..."
cd "$PROJECT_ROOT/Apps/core-service"
REDIS_PASSWORD=redis_password npm run dev > /tmp/core-service.log 2>&1 &
CORE_PID=$!
echo "   ✓ core-service started (PID: $CORE_PID)"

# Wait for core-service to be ready
echo "   ⏳ Waiting for core-service..."
core_ready=false
for i in {1..30}; do
  if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "   ✓ core-service ready"
    core_ready=true
    break
  fi
  sleep 1
done
if [ "$core_ready" != "true" ]; then
  echo "   ✗ core-service failed to become ready"
  fail_startup
fi

# Start command-center-service
echo "📦 Starting command-center-service on port 3700..."
cd "$PROJECT_ROOT/Apps/command-center-service"
PORT=3700 npm run dev > /tmp/command-center-service.log 2>&1 &
COMMAND_CENTER_PID=$!
echo "   ✓ command-center-service started (PID: $COMMAND_CENTER_PID)"

# Wait for command-center-service to be ready
echo "   ⏳ Waiting for command-center-service..."
command_center_ready=false
for i in {1..30}; do
  if curl -s http://localhost:3700/health > /dev/null 2>&1; then
    echo "   ✓ command-center-service ready"
    command_center_ready=true
    break
  fi
  sleep 1
done
if [ "$command_center_ready" != "true" ]; then
  echo "   ✗ command-center-service failed to become ready"
  fail_startup
fi

# Start Angular UI
echo "🎨 Starting Angular UI on port 4200..."
cd "$PROJECT_ROOT/UI/super-admin-ui"
npm run start > /tmp/super-admin-ui.log 2>&1 &
UI_PID=$!
echo "   ✓ Angular UI started (PID: $UI_PID)"

# Wait for UI to be ready
echo "   ⏳ Waiting for Angular UI..."
ui_ready=false
for i in {1..60}; do
  if curl -s http://localhost:4200 > /dev/null 2>&1; then
    echo "   ✓ Angular UI ready"
    ui_ready=true
    break
  fi
  sleep 1
done
if [ "$ui_ready" != "true" ]; then
  echo "   ✗ Angular UI failed to become ready"
  fail_startup
fi

echo ""
echo "✅ All services started successfully!"
echo ""
echo "🌐 Services running:"
echo "   • Core Service:           http://localhost:3000"
echo "   • Command Center Service: http://localhost:3700"
echo "   • Super Admin UI:         http://localhost:4200"
echo ""
echo "📋 Logs:"
echo "   • Core Service:           tail -f /tmp/core-service.log"
echo "   • Command Center Service: tail -f /tmp/command-center-service.log"
echo "   • Super Admin UI:         tail -f /tmp/super-admin-ui.log"
echo ""
echo "🔐 Admin Credentials:"
echo "   See your configured credentials in .env or docs/CREDENTIALS_GUIDE.md"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for user interrupt
wait
