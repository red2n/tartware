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
