## TODO

1. **Expose reservation reads through the API Gateway** (done)
   - Added `/v1/reservations` proxy in `Apps/api-gateway/src/server.ts` so GET calls hit `core-service`.
   - UI already targets `/v1/reservations` via `ReservationApiService`.

2. **Unblock tenant directory access for system admins** (done)
   - `TenantApiService` now calls `/v1/system/tenants`; gateway already proxies `/v1/system/*` to core-service.
   - System-admin token is used for `/system/*` calls so impersonation isn’t required to list tenants.

3. **Send the correct token for command execution** (done)
   - `/v1/commands/:name/execute` uses impersonation token while `/v1/commands/definitions` uses the system-admin token.
   - UI already blocks submissions without active impersonation.

4. **Route command-center traffic through the gateway** (done)
   - Gateway proxies `/v1/commands/**` via `serviceTargets.commandCenterServiceUrl`.
   - Removed Angular dev proxy; UI now points directly at the gateway base.
   - (Later) Ensure api-gateway deployment env includes `COMMAND_CENTER_SERVICE_URL` and `SETTINGS_SERVICE_URL` so k8s routes to in-cluster services.

5. **Fix the `TenantsComponent` TypeScript compile error** (done)
   - Stray `readonly tenantTypes = TenantTypeEnum.options;` line is already removed in `UI/super-admin-ui/src/app/pages/tenants.component.ts`.

6. **Make the settings service reachable** (done)
   - Added Settings Catalog page in the system-admin UI that reads `/v1/settings/catalog` and `/v1/settings/values` through the gateway.

7. **Align schemas with table scripts** (done)
   - Schema vs SQL field verification shows 0 mismatches.
   - Report: `schema-script-field-report.txt`.

8. **SaaS tenant enforcement gaps** (done)
   - Settings service now validates active tenant membership during auth.
   - API gateway tenant proxy routes now require `withTenantScope` membership checks.
   - Availability Guard HTTP endpoints now require admin token when guard tokens are configured.

9. **SaaS tenant bootstrap (industry standard)** (done)
   - Standard: create tenant + primary property + owner user in one transaction; assign OWNER via `user_tenant_associations`.
   - Standard: owner manages managers/department heads and module access; system admin only for platform tasks.
   - Implemented: `POST /v1/system/tenants/bootstrap` in core-service for tenant + property + owner bootstrap.
   - Optional next: add self-serve onboarding (invite code or billing signup) that calls the same bootstrap flow.

10. **Tenant admin access management (industry standard)** (done)
   - Added tenant-scoped user management: invite/create user, update role, deactivate, reset password.
   - Added tenant self-serve onboarding (non-system-admin) that creates tenant + owner + property.
   - Added tenant MFA enrollment/rotation endpoints to pair with login enforcement.

11. **Command-based write pipeline roadmap for 20K ops/sec** (done)
    - Step 1: Establish a command catalog with owners, payload schemas, and routing rules (command-center targetService + service ownership). (done)
      - Catalog draft (v1):
        - Reservations (owner: `reservations-command-service`):
          - `reservation.create`, `reservation.modify`, `reservation.cancel` (existing)
          - `reservation.check_in`, `reservation.check_out`
          - `reservation.assign_room`, `reservation.unassign_room`
          - `reservation.extend_stay`, `reservation.rate_override`
          - `reservation.add_deposit`, `reservation.release_deposit`
        - Guests (owner: `guests-service`):
          - `guest.register`, `guest.merge` (existing)
          - `guest.update_profile`, `guest.update_contact`
          - `guest.set_loyalty`, `guest.set_vip`, `guest.set_blacklist`
          - `guest.gdpr.erase`, `guest.preference.update`
        - Rooms/Inventory (owner: `rooms-service`):
          - `rooms.inventory.block`, `rooms.inventory.release` (split out for clarity)
          - `rooms.status.update`, `rooms.housekeeping_status.update`
          - `rooms.out_of_order`, `rooms.out_of_service`
          - `rooms.move`, `rooms.features.update`
        - Housekeeping (owner: `housekeeping-service`):
          - `housekeeping.task.assign`, `housekeeping.task.complete` (existing)
          - `housekeeping.task.create`, `housekeeping.task.reassign`
          - `housekeeping.task.reopen`, `housekeeping.task.add_note`
          - `housekeeping.task.bulk_status`
        - Billing/Financial (owner: `billing-service`):
          - `billing.payment.capture`, `billing.payment.refund` (existing)
          - `billing.invoice.create`, `billing.invoice.adjust`
          - `billing.charge.post`, `billing.payment.apply`
          - `billing.folio.transfer`
        - Settings (owner: `settings-service` for commands; CRUD for low-velocity admin):
          - `settings.value.set`, `settings.value.bulk_set`
          - `settings.value.approve`, `settings.value.revert`
        - Integrations (owner: new `integrations-command-service` only if high volume):
          - `integration.ota.sync_request`, `integration.ota.rate_push`
          - `integration.webhook.retry`, `integration.mapping.update`
        - Analytics (owner: `analytics-command-service` only if high volume):
          - `analytics.metric.ingest`, `analytics.report.schedule`
        - Operations (owner: `operations-command-service` only if high volume):
          - `operations.maintenance.request`, `operations.incident.report`
          - `operations.asset.update`, `operations.inventory.adjust`
    - Step 2: Expand reservation commands beyond create/modify/cancel (check-in/out, room assignment, rate overrides, deposits/folios). (done)
    - Step 3: Add guest commands (profile update, loyalty changes, blacklist/whitelist, contact preferences, GDPR erase). (done)
    - Step 4: Add rooms/inventory commands (status transitions, out-of-order/service, room moves, housekeeping status). (done)
    - Step 5: Add housekeeping commands (task create/reassign/reopen, notes, bulk status updates). (done)
    - Step 6: Add billing commands (invoice create/adjust, charge postings, payment lifecycle, refunds with audit). (done)
    - Step 7: Add settings commands for high-value changes that need audit/approval; keep low-velocity admin CRUD in settings-service. (done)
      - Added settings command consumer + handlers in settings-service; Kafka wiring and command schemas in place.
    - Step 8: Add integrations/analytics/operations command services only where high write volume or fan-out is required; leave low-volume CRUD in dedicated services. (done)
      - Decision criteria + current recommendation captured in `docs/command-center-service/step-8-domain-command-services.md`.
    - Step 9: Add reliability controls (idempotency keys, dedupe, DLQ replay tooling, per-tenant throttles) for every new command. (done)
      - Command center now dedupes by `request_id` (tenant + command + request), with payload hash conflict checks.
      - Settings command consumer now retries with backoff and routes failures to `commands.primary.dlq`.
      - Billing/housekeeping/rooms/guests command consumers now retry with backoff and route failures to `commands.primary.dlq`.
      - Command center now enforces per-tenant throttles via command_features and has a DLQ replay runbook.
    - Step 10: Add observability and SLOs for command throughput/latency/backlog per service. (done)
      - Added command outcome counters, duration histograms, and consumer lag gauges for rooms/housekeeping/billing/guests/settings.
      - Documented SLOs and dashboard PromQL in `docs/observability/command-consumer-slos.md`.

## Checkpoint (2025-09-05)
- Step 1-7 of the command-based write pipeline roadmap are complete; Step 8 is next.
- Command schema/catalog + gateway routing + service handlers implemented for reservations, guests, rooms, housekeeping, billing.
- `AGENTS.md` added with schema-first + 20K ops/sec guidance.
- Tests run: `npm run biome`, `npm run knip`, `npm run build` (all green). Knip hints remain for `vitest` in `Apps/core-service/knip.json` and `Apps/settings-service/knip.json`.

## Resume Notes
- Next task: Validate Grafana dashboards + alert rules from `docs/observability/command-consumer-slos.md`.
- Gateway already has a generic POST `/v1/tenants/:tenantId/commands/:commandName` endpoint; reuse it for new settings commands.
- Command catalog + command-center registry entries already expanded in `scripts/tables/01-core/10_command_center.sql`.
- Reservations updates include check-in/out, assign/unassign, extend stay, rate override, deposits; reservation schema allows `room_number` nullable (`schema/src/schemas/03-bookings/reservations.ts`).
- Services updated: guests/rooms/housekeeping/billing/reservations command handlers and command-center consumers are in place; no new services added.
