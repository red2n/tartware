#!/bin/bash
# Tartware Load Testing Script
# Tests system capacity up to 20k ops/sec

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
API_BASE_URL="${API_BASE_URL:-https://api.tartware.local}"
DURATION="${DURATION:-5m}"
MAX_VUS="${MAX_VUS:-5000}"
TARGET_RPS="${TARGET_RPS:-20000}"

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_k6() {
    if ! command -v k6 >/dev/null 2>&1; then
        log_error "k6 not found"
        log_info "Install k6: https://k6.io/docs/getting-started/installation/"
        exit 1
    fi
    log_info "k6 found: $(k6 version)"
}

create_k6_script() {
    log_info "Creating k6 test script..."

    cat > /tmp/tartware-load-test.js <<'EOF'
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const apiLatency = new Trend('api_latency');
const requestCount = new Counter('requests');

// Test configuration
export const options = {
    stages: [
        // Ramp up
        { duration: '2m', target: 1000 },   // Ramp to 1k VUs
        { duration: '2m', target: 2500 },   // Ramp to 2.5k VUs
        { duration: '2m', target: 5000 },   // Ramp to 5k VUs (20k RPS)

        // Sustained load
        { duration: '10m', target: 5000 },  // Maintain 5k VUs

        // Ramp down
        { duration: '2m', target: 1000 },
        { duration: '1m', target: 0 },
    ],
    thresholds: {
        'http_req_duration': ['p(95)<500', 'p(99)<1000'],
        'http_req_failed': ['rate<0.05'],
        'errors': ['rate<0.05'],
    },
    noConnectionReuse: false,
    userAgent: 'TartwareLoadTest/1.0',
};

const BASE_URL = __ENV.API_BASE_URL || 'https://api.tartware.local';

// Sample test data
const hotels = ['hotel-001', 'hotel-002', 'hotel-003'];
const rooms = ['room-101', 'room-102', 'room-201', 'room-202'];

function getRandomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
}

export default function () {
    // Simulate realistic user behavior

    group('API Gateway Health', () => {
        const res = http.get(`${BASE_URL}/health`);
        check(res, {
            'health check ok': (r) => r.status === 200,
        });
        errorRate.add(res.status !== 200);
        apiLatency.add(res.timings.duration);
        requestCount.add(1);
    });

    sleep(0.1);

    group('List Rooms', () => {
        const hotelId = getRandomElement(hotels);
        const res = http.get(`${BASE_URL}/api/v1/hotels/${hotelId}/rooms`);
        check(res, {
            'list rooms ok': (r) => r.status === 200,
        });
        errorRate.add(res.status !== 200);
        apiLatency.add(res.timings.duration);
        requestCount.add(1);
    });

    sleep(0.5);

    group('Get Room Details', () => {
        const hotelId = getRandomElement(hotels);
        const roomId = getRandomElement(rooms);
        const res = http.get(`${BASE_URL}/api/v1/hotels/${hotelId}/rooms/${roomId}`);
        check(res, {
            'room details ok': (r) => r.status === 200,
        });
        errorRate.add(res.status !== 200);
        apiLatency.add(res.timings.duration);
        requestCount.add(1);
    });

    sleep(0.3);

    group('Search Availability', () => {
        const hotelId = getRandomElement(hotels);
        const params = {
            checkIn: '2025-01-15',
            checkOut: '2025-01-17',
            guests: '2',
        };
        const res = http.get(`${BASE_URL}/api/v1/hotels/${hotelId}/availability`, { params });
        check(res, {
            'search availability ok': (r) => r.status === 200,
        });
        errorRate.add(res.status !== 200);
        apiLatency.add(res.timings.duration);
        requestCount.add(1);
    });

    sleep(1);

    // Occasional write operations (10% of requests)
    if (Math.random() < 0.1) {
        group('Create Reservation', () => {
            const hotelId = getRandomElement(hotels);
            const roomId = getRandomElement(rooms);
            const payload = JSON.stringify({
                hotelId: hotelId,
                roomId: roomId,
                guestName: 'Load Test User',
                guestEmail: 'loadtest@example.com',
                checkIn: '2025-01-15',
                checkOut: '2025-01-17',
                guests: 2,
            });
            const params = {
                headers: {
                    'Content-Type': 'application/json',
                },
            };
            const res = http.post(`${BASE_URL}/api/v1/reservations`, payload, params);
            check(res, {
                'create reservation ok': (r) => r.status === 201 || r.status === 200,
            });
            errorRate.add(res.status >= 400);
            apiLatency.add(res.timings.duration);
            requestCount.add(1);
        });

        sleep(0.5);
    }
}

export function handleSummary(data) {
    return {
        'stdout': textSummary(data, { indent: ' ', enableColors: true }),
        '/tmp/k6-results.json': JSON.stringify(data),
    };
}
EOF

    log_info "Test script created"
}

run_smoke_test() {
    log_info "Running smoke test..."

    k6 run --vus 10 --duration 30s \
        --env API_BASE_URL="${API_BASE_URL}" \
        /tmp/tartware-load-test.js

    log_info "Smoke test complete"
}

run_load_test() {
    log_info "Starting load test..."
    log_info "Target: ${TARGET_RPS} requests/second"
    log_info "Duration: ${DURATION}"
    log_info "Base URL: ${API_BASE_URL}"

    # Run with cloud output if k6 cloud token is set
    if [ -n "${K6_CLOUD_TOKEN:-}" ]; then
        k6 cloud --env API_BASE_URL="${API_BASE_URL}" /tmp/tartware-load-test.js
    else
        k6 run --env API_BASE_URL="${API_BASE_URL}" \
            --out json=/tmp/k6-results.json \
            --out influxdb=http://localhost:8086/k6 \
            /tmp/tartware-load-test.js
    fi

    log_info "Load test complete"
}

run_stress_test() {
    log_info "Running stress test - pushing beyond limits..."

    k6 run --vus ${MAX_VUS} --duration ${DURATION} \
        --env API_BASE_URL="${API_BASE_URL}" \
        /tmp/tartware-load-test.js

    log_info "Stress test complete"
}

analyze_results() {
    log_info "Analyzing results..."

    if [ -f /tmp/k6-results.json ]; then
        log_info "Results saved to: /tmp/k6-results.json"

        # Extract key metrics
        local p95=$(jq '.metrics.http_req_duration.values.["p(95)"]' /tmp/k6-results.json)
        local p99=$(jq '.metrics.http_req_duration.values.["p(99)"]' /tmp/k6-results.json)
        local error_rate=$(jq '.metrics.http_req_failed.values.rate' /tmp/k6-results.json)
        local rps=$(jq '.metrics.http_reqs.values.rate' /tmp/k6-results.json)

        log_info "========================================="
        log_info "Performance Summary:"
        log_info "  RPS:        ${rps}"
        log_info "  P95 Latency: ${p95} ms"
        log_info "  P99 Latency: ${p99} ms"
        log_info "  Error Rate:  ${error_rate}%"
        log_info "========================================="
    fi
}

monitor_cluster() {
    log_info "Monitoring cluster during test..."

    # Start monitoring in background
    (
        while true; do
            echo "=== $(date) ==="
            kubectl top pods -n tartware-system
            kubectl get hpa -n tartware-system
            sleep 10
        done
    ) &

    MONITOR_PID=$!
    echo $MONITOR_PID > /tmp/monitor.pid

    log_info "Monitoring started (PID: $MONITOR_PID)"
    log_info "Stop with: kill $(cat /tmp/monitor.pid)"
}

main() {
    log_info "Tartware Load Testing"

    check_k6
    create_k6_script

    PS3="Select test type: "
    options=(
        "Smoke Test (30s)"
        "Load Test (20k RPS)"
        "Stress Test (Max capacity)"
        "Monitor Cluster"
        "Analyze Results"
        "Exit"
    )

    select opt in "${options[@]}"; do
        case $opt in
            "Smoke Test (30s)")
                run_smoke_test
                analyze_results
                ;;
            "Load Test (20k RPS)")
                run_load_test
                analyze_results
                ;;
            "Stress Test (Max capacity)")
                run_stress_test
                analyze_results
                ;;
            "Monitor Cluster")
                monitor_cluster
                ;;
            "Analyze Results")
                analyze_results
                ;;
            "Exit")
                break
                ;;
            *)
                log_error "Invalid option"
                ;;
        esac
    done
}

main "$@"
