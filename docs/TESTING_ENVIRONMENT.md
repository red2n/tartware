# Tartware Testing Environment

## Overview
This guide explains how to run the Tartware API load tests locally (Docker/k6/Locust) and in a Kubernetes cluster so you can validate the command pipeline at 20k+ ops/sec.

## Prerequisites
- Docker / Docker Compose v2.21+
- kubectl with access to the target cluster
- A valid Tartware API token (JWT) that can submit commands for the tenants under test
- Real tenant / property / room-type UUIDs for the load generator payloads

## Shared Environment Variables
| Variable | Description | Example |
| --- | --- | --- |
| `GATEWAY_BASE_URL` | API Gateway base URL or ingress endpoint | `https://api-gateway.tartware.example` |
| `API_TOKEN` | Bearer token injected into every request | `eyJhbGciOiJIUzI1NiIs...` |
| `TENANT_IDS` | Comma separated tenant UUIDs | `11111111-1111-1111-1111-111111111111` |
| `PROPERTY_IDS` | Comma separated property UUIDs used for reservations | `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa` |
| `ROOM_TYPE_IDS` | Comma separated room-type UUIDs used for reservations | `bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb` |
| `RESERVATION_IDS` | Existing reservations leveraged for modify/cancel/billing commands | `22222222-2222-2222-2222-222222222222` |
| `GUEST_IDS` | Existing guests referenced by reservations/billing events | `33333333-3333-3333-3333-333333333333` |
| `HOUSEKEEPING_TASK_IDS` | Task IDs used for assign/complete commands | `44444444-4444-4444-4444-444444444444` |
| `HOUSEKEEPING_STAFF_IDS` | Staff UUIDs assigned to housekeeping tasks | `55555555-5555-5555-5555-555555555555` |
| `COMMAND_TARGET_RATE` | Desired command arrival rate per second | `20000` |
| `READ_RATE` | Arrival rate for read-only proxy calls | `8000` |
| `TEST_DURATION` | Duration for the steady-state stage | `20m` |

> Populate the UUID lists with **real** values from your seed tenant so that downstream services accept the commands (billing/housekeeping enforce FK constraints).

### Collecting realistic IDs
Use psql/TablePlus (or any DB console) against the staging database to capture UUIDs for each list above, then store them in a dotenv file you can `source` before running the tests. Example queries:
- Reservations: `SELECT id FROM reservations WHERE tenant_id = '<tenant-id>' LIMIT 20;`
- Guests: `SELECT id FROM guests WHERE tenant_id = '<tenant-id>' LIMIT 20;`
- Housekeeping tasks: `SELECT id FROM housekeeping_tasks WHERE tenant_id = '<tenant-id>' LIMIT 20;`
- Housekeeping staff: `SELECT id FROM housekeeping_staff WHERE tenant_id = '<tenant-id>' LIMIT 20;`

### Automated bootstrap (recommended)
Run the helper script to sample real IDs and update both `.env.loadtest` and the Kubernetes kustomization automatically:

```bash
# Uses PG* env vars or pass --connection-string
PGHOST=postgres.internal \
PGUSER=tartware \
PGPASSWORD=secret \
node scripts/bootstrap-loadtest-env.mjs \
  --env-file .env.loadtest \
  --kustomization platform/kubernetes/loadtest/kustomization.yaml

# Inspect .env.loadtest, then set API_TOKEN manually or via secret
```

The script queries tenants/properties/reservations/guests/housekeeping tasks, writes the comma-separated ID lists, and pre-populates the k6 ConfigMap literals so you can `kubectl apply -k platform/kubernetes/loadtest` immediately after creating the `tartware-k6-secret`.

## Local Load Testing (Docker Compose)
1. **Bootstrap metrics stack**
   ```bash
   cd loadtest
   docker compose -f docker-compose.loadtest.yml up -d influxdb grafana
   ```
   Grafana → http://localhost:3001 (admin/admin) • InfluxDB → http://localhost:8086 (token `tartware-token`).

2. **Run the k6 command-pipeline scenario**
   ```bash
   export GATEWAY_BASE_URL=https://api-gateway.tartware.example
   export API_TOKEN=$(cat ~/tokens/tartware-manager.jwt)
   export TENANT_IDS=11111111-1111-1111-1111-111111111111
   export PROPERTY_IDS=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
   export ROOM_TYPE_IDS=bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb
   export RESERVATION_IDS=22222222-2222-2222-2222-222222222222
   export GUEST_IDS=33333333-3333-3333-3333-333333333333
   export HOUSEKEEPING_TASK_IDS=44444444-4444-4444-4444-444444444444
   export HOUSEKEEPING_STAFF_IDS=55555555-5555-5555-5555-555555555555

   docker compose -f loadtest/docker-compose.loadtest.yml run --rm k6
   ```
   The script (`loadtest/k6/command-pipeline.js`) now drives the full command catalog: guest registrations, reservation create/modify/cancel, billing payment capture, housekeeping assign/complete, plus the read-only proxies and `/health`.

3. **Optional: Locust UI**
   ```bash
   cd loadtest
   docker compose -f docker-compose.loadtest.yml --profile locust up -d
   open http://localhost:8089
   ```
   Locust automatically reads the same environment variables and drives the identical guest/reservation/billing/housekeeping command mix for exploratory tests via its web UI.

## Kubernetes Load Testing
1. **Create namespace + API token secret**
   ```bash
   kubectl create namespace tartware-loadtest
   kubectl create secret generic tartware-k6-secret \
     --from-literal=api-token="$(cat ~/tokens/tartware-manager.jwt)" \
     -n tartware-loadtest
   ```
2. **Configure tenant/property IDs**
   Edit `platform/kubernetes/loadtest/kustomization.yaml` and set `TENANT_IDS`, `PROPERTY_IDS`, `ROOM_TYPE_IDS`, `RESERVATION_IDS`, `GUEST_IDS`, `HOUSEKEEPING_TASK_IDS`, `HOUSEKEEPING_STAFF_IDS`, and (optionally) the arrival rates/duration literals.

3. **Launch the job**
   ```bash
   kubectl apply -k platform/kubernetes/loadtest
   kubectl logs job/tartware-k6-loadtest -n tartware-loadtest -f
   ```
   The kustomization generates:
   - `ConfigMap tartware-k6-script` (bundles the JS scenario)
   - `ConfigMap tartware-k6-env` (non-sensitive tuning knobs)
   - `Job tartware-k6-loadtest` (runs the Grafana/k6 container)

4. **Cleanup**
   ```bash
   kubectl delete -k platform/kubernetes/loadtest
   ```

## Monitoring & Success Criteria
- Watch auto-scaling/resource pressure: `kubectl get hpa,pods -n tartware-system` and `kubectl top pods -A | grep tartware`.
- Grafana dashboards (local compose or cluster observability) should track: `command_duration_ms` (p95 < 500 ms), `http_req_failed` (<5%), Kafka consumer lag, and outbox queue depth.
- k6 exits non-zero when the gateway returns anything other than `202 Accepted`, giving immediate feedback about auth/tenant configuration.

## Recommended Profiles
| Profile | Command Settings | Expected Outcome |
| --- | --- | --- |
| Smoke | `COMMAND_TARGET_RATE=1000`, `READ_RATE=1000`, `TEST_DURATION=2m` | Validates wiring/auth |
| Peak | `COMMAND_TARGET_RATE=20000`, `READ_RATE=8000`, `TEST_DURATION=20m` | Exercises scaling plan |
| Endurance | `COMMAND_TARGET_RATE=10000`, `READ_RATE=5000`, `TEST_DURATION=4h` | Detects leaks & backlog growth |

Reference this guide from `DEPLOYMENT_CHECKLIST.md` when providing evidence for the "Validate Command Center throughput" gate.
