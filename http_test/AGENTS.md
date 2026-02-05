# HTTP Test Instructions for AI Agents

## Overview
This folder contains `.http` files for testing the Tartware API using VS Code REST Client extension. Before executing any HTTP requests, authentication is required.

## Pre-requisites

1. **Services must be running** - Execute `npm run dev` from the project root
2. **Authentication token required** - Use `get-token.sh` to obtain a JWT access token

## Getting an Access Token

### Quick Token Retrieval
```bash
# Get token for immediate use in curl
TOKEN=$(./get-token.sh)
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/v1/tenants
```

### Export to Shell Environment
```bash
# Source to set TOKEN and AUTH_HEADER variables in current shell
source <(./get-token.sh -e)

# Now use in subsequent commands
curl -H "$AUTH_HEADER" http://localhost:8080/v1/rooms
```

### Get as Header Format (for copy/paste)
```bash
./get-token.sh -h
# Output: Authorization: Bearer eyJhbG...
```

### Copy to Clipboard
```bash
./get-token.sh -c
```

## Environment Variables

Override defaults for different environments:
```bash
API_URL=http://prod.example.com API_USER=admin API_PASS=secret ./get-token.sh
```

| Variable | Default | Description |
|----------|---------|-------------|
| `API_URL` | `http://localhost:8080` | Base URL for API Gateway |
| `API_USER` | `setup.admin` | Login username |
| `API_PASS` | `TempPass123` | Login password |

## Using VS Code REST Client

When using `.http` files directly in VS Code:

1. Open `_environment.http` first
2. Execute the `# @name login` request (Section 1)
3. The `@authToken` variable will be populated automatically
4. Other `.http` files reference `{{authToken}}` from this shared response

## Seed Data IDs

These IDs are pre-populated in the database:

| Entity | ID | Name |
|--------|-----|------|
| Tenant | `11111111-1111-1111-1111-111111111111` | Tartware Hospitality Labs |
| Property | `22222222-2222-2222-2222-222222222222` | Tartware City Center |
| User | `33333333-3333-3333-3333-333333333333` | setup.admin |
| Room Type | `44444444-4444-4444-4444-444444444444` | Cityline King |
| Room 101 | `55555555-5555-5555-5555-555555555551` | Room 101 |
| Room 102 | `55555555-5555-5555-5555-555555555552` | Room 102 |
| Room 201 | `55555555-5555-5555-5555-555555555553` | Room 201 |
| Room 202 | `55555555-5555-5555-5555-555555555554` | Room 202 |

## Running Automated Tests

```bash
# Run the full API test suite
./run-api-tests.sh
```

## File Reference

| File | Purpose |
|------|---------|
| `_environment.http` | Base config, login, shared variables |
| `get-token.sh` | CLI utility to obtain JWT tokens |
| `run-api-tests.sh` | Automated test runner script |
| `availability-guard.http` | Lock/unlock room availability |
| `billing.http` | Payments, invoices, folios |
| `booking-config.http` | Allotments, sources, segments |
| `command-center.http` | Command dispatch endpoints |
| `core-service.http` | Auth, tenants, properties, users |
| `guests.http` | Guest profiles, preferences |
| `housekeeping.http` | Tasks, assignments, status |
| `modules.http` | Module catalog |
| `operations.http` | Operations endpoints |
| `rates.http` | Rate plans |
| `recommendations.http` | Recommendation engine |
| `reservations.http` | Reservation CRUD + lifecycle |
| `rooms.http` | Room management |
| `settings-service.http` | Settings and amenities |
| `tenantandproperty.http` | Tenant/property management |

## Troubleshooting

### "API not reachable"
```bash
# Check if services are running
curl http://localhost:8080/health

# If not, start services
cd /path/to/tartware && npm run dev
```

### "Authentication failed"
- Verify credentials: default is `setup.admin` / `TempPass123`
- Check if database was seeded properly
- Ensure `TARTWARE_DROP_EXISTING=true` was set during initial setup

### Token Expired
- Tokens expire after 15 minutes
- Re-run `./get-token.sh` to get a fresh token
