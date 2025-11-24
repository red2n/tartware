## Command Playbook

### 1. Fresh Environment Bring-Up
1. `docker compose up -d postgres redis`
2. `npm run bootstrap:system-admin --workspace=Apps/core-service -- --username=bootstrap_admin --email=bootstrap@example.com --role=SYSTEM_ADMIN`
3. `npm run test --workspace=Apps/core-service -- tests/system-admin.test.ts`
4. `REDIS_ENABLED=true npm run test --workspace=Apps/core-service`

### 2. Cleanup & Fresh Install
1. `docker compose down`
2. `npm ci`
