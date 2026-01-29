# Access Token Steps (Local)

## Overview
These steps document how a local access token was obtained for core-service using the seeded `setup.admin` user.

## Steps

1) **Confirm the seeded user exists**
   - The default seed includes `setup.admin` in [scripts/data/defaults/default_seed.json](scripts/data/defaults/default_seed.json).

2) **Reset tenant user passwords to a known default**
   - Script: [Apps/core-service/scripts/reset-default-password.ts](Apps/core-service/scripts/reset-default-password.ts)
   - Result: the user password hash is reset for the seeded user.

3) **Set a known password hash and valid MFA secret**
   - Update the `setup.admin` user in Postgres so:
     - `password_hash` is a known bcrypt hash for `TempPass123`
     - `mfa_secret` is a 16+ char string (required by auth schema)
     - `version` increments (optimistic locking)

4) **Start core-service on a free port**
   - Example: run core-service on port `3001` and ensure it connects to the local DB.

5) **Login to obtain the JWT**
   - Endpoint: `POST /v1/auth/login`
   - Body:
     - `username`: `setup.admin`
     - `password`: `TempPass123`
   - Response includes `access_token`.

6) **Use the token to call a DB-backed endpoint**
   - Example: `GET /v1/users?tenant_id=11111111-1111-1111-1111-111111111111&limit=50`
   - Header: `Authorization: Bearer <access_token>`

## Notes
- Login accepts `username`, not `email`.
- `mfa_secret` must be at least 16 chars to satisfy validation in [Apps/core-service/src/services/auth-service.ts](Apps/core-service/src/services/auth-service.ts).
- The seeded tenant ID is `11111111-1111-1111-1111-111111111111`.
