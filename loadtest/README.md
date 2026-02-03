# Tartware Microservices Load Testing

Comprehensive load testing suite for Tartware PMS microservices using [k6](https://k6.io/).

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            Load Test Runner                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   Smoke     │  │    Load     │  │   Stress    │  │    Spike    │    │
│  │  (sanity)   │  │ (sustained) │  │  (limits)   │  │  (bursts)   │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          API Gateway (:8080)                             │
│                    (Rate Limiting, Auth, Routing)                        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
          ┌─────────────┬───────────┼───────────┬─────────────┐
          ▼             ▼           ▼           ▼             ▼
    ┌──────────┐  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
    │  Core    │  │ Billing  │ │  Guests  │ │Housekeep │ │  Rooms   │
    │ Service  │  │ Service  │ │ Service  │ │ Service  │ │ Service  │
    │  :3000   │  │  :3600   │ │  :3300   │ │  :3500   │ │  :3400   │
    └──────────┘  └──────────┘ └──────────┘ └──────────┘ └──────────┘
```

## Quick Start

### 1. Prerequisites

- Docker & Docker Compose
- Running Tartware services (`npm run dev`)
- k6 installed locally (optional, for direct runs)

### 2. Environment Setup

```bash
cp .env.example .env
# Edit .env with your test tenant credentials
```

### 3. Get Auth Token

```bash
# Login and extract token
TOKEN=$(curl -s -X POST http://localhost:8080/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"setup.admin","password":"TempPass123"}' | jq -r '.access_token')

echo "API_TOKEN=$TOKEN" >> .env
```

### 4. Run Tests

```bash
# Start metrics infrastructure
docker compose up -d influxdb grafana

# Run smoke test (quick sanity check)
docker compose run --rm k6 run /scripts/scenarios/smoke.js

# Run load test (sustained traffic)
docker compose run --rm k6 run /scripts/scenarios/load.js

# Run stress test (find breaking points)
docker compose run --rm k6 run /scripts/scenarios/stress.js

# Run spike test (sudden traffic bursts)
docker compose run --rm k6 run /scripts/scenarios/spike.js
```

### 5. View Results

- **Grafana Dashboard**: http://localhost:3001 (admin/admin)
- **InfluxDB**: http://localhost:8086 (admin/adminpassword)

## Test Scenarios

| Scenario | Duration | VUs | Purpose |
|----------|----------|-----|---------|
| **Smoke** | 1m | 1-5 | Sanity check, verify endpoints work |
| **Load** | 10m | 50-100 | Normal sustained traffic |
| **Stress** | 15m | 100-500 | Find performance limits |
| **Spike** | 5m | 10→500→10 | Test burst handling |

## Service-Specific Tests

Run tests targeting individual microservices:

```bash
# Test core-service endpoints
docker compose run --rm k6 run /scripts/services/core-service.js

# Test billing-service endpoints
docker compose run --rm k6 run /scripts/services/billing-service.js

# Test guests-service endpoints
docker compose run --rm k6 run /scripts/services/guests-service.js

# Test housekeeping-service endpoints
docker compose run --rm k6 run /scripts/services/housekeeping-service.js

# Test rooms-service endpoints
docker compose run --rm k6 run /scripts/services/rooms-service.js
```

## Metrics & Thresholds

### Default Thresholds

| Metric | Threshold | Description |
|--------|-----------|-------------|
| `http_req_failed` | < 1% | Error rate |
| `http_req_duration` | p95 < 500ms | Response time |
| `iterations` | > 100/s | Throughput |

### Custom Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `service_request_duration` | Trend | Per-service latency |
| `service_errors` | Counter | Per-service error count |
| `auth_token_refresh` | Counter | Token refresh operations |

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GATEWAY_URL` | `http://localhost:8080` | API Gateway URL |
| `API_TOKEN` | - | JWT auth token (required) |
| `TENANT_ID` | - | Test tenant UUID |
| `PROPERTY_ID` | - | Test property UUID |
| `VUS` | `50` | Virtual users |
| `DURATION` | `5m` | Test duration |
| `RAMP_UP` | `30s` | Ramp-up time |

### Test Data

```bash
# Use seed data IDs
TENANT_ID=11111111-1111-1111-1111-111111111111
PROPERTY_ID=22222222-2222-2222-2222-222222222222
ROOM_TYPE_ID=44444444-4444-4444-4444-444444444444
```

## Local k6 Runs (without Docker)

```bash
# Install k6
brew install k6  # macOS
# or: https://k6.io/docs/getting-started/installation/

# Run with output to terminal
k6 run --env GATEWAY_URL=http://localhost:8080 \
       --env API_TOKEN="$TOKEN" \
       --env TENANT_ID="11111111-1111-1111-1111-111111111111" \
       k6/scenarios/smoke.js

# Run with InfluxDB output
k6 run --out influxdb=http://localhost:8086/k6 \
       --env GATEWAY_URL=http://localhost:8080 \
       k6/scenarios/load.js
```

## Troubleshooting

### Common Issues

1. **401 Unauthorized**: Token expired, regenerate with login endpoint
2. **Connection refused**: Ensure services are running (`npm run dev`)
3. **High error rate**: Check service logs for errors
4. **Slow responses**: Check database connections, may need connection pooling tuning

### Debug Mode

```bash
# Run with verbose output
k6 run --verbose --http-debug=full k6/scenarios/smoke.js
```

## CI/CD Integration

```yaml
# GitHub Actions example
- name: Run Load Tests
  run: |
    docker compose -f loadtest/docker-compose.yml run --rm k6 \
      run /scripts/scenarios/smoke.js --summary-export=results.json

- name: Check Thresholds
  run: |
    if grep -q '"fail":true' results.json; then
      echo "Load test thresholds failed"
      exit 1
    fi
```
