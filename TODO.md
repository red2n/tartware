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

7. **Align schemas with table scripts** (in progress)
   - Schema-only (no matching table script) examples:
     - (none from current list; re-scan pending)
   - Script-only (no matching schema) examples:
     - (none from current list; re-scan pending)
   - Progress: split roll-service shadow tables into aligned scripts:
     - `scripts/tables/03-bookings/90_roll_service_shadow_ledgers.sql`
     - `scripts/tables/03-bookings/91_roll_service_backfill_checkpoint.sql`
     - `scripts/tables/03-bookings/92_roll_service_consumer_offsets.sql`
   - Progress: split analytics performance tables into aligned scripts:
     - `scripts/tables/07-analytics/23_performance_reports.sql`
     - `scripts/tables/07-analytics/24_report_schedules.sql`
     - `scripts/tables/07-analytics/25_performance_thresholds.sql`
     - `scripts/tables/07-analytics/26_performance_baselines.sql`
     - `scripts/tables/07-analytics/30_performance_alerts.sql`
     - `scripts/tables/07-analytics/31_alert_rules.sql`
   - Progress: split settings tables + seed data into per-table scripts:
     - `scripts/tables/01-core/06_setting_categories.sql`
     - `scripts/tables/01-core/07_setting_definitions.sql`
     - `scripts/tables/01-core/08_tenant_settings.sql`
     - `scripts/tables/01-core/09_property_settings.sql`
     - `scripts/tables/01-core/10_room_settings.sql`
     - `scripts/tables/01-core/11_user_settings.sql`
     - `scripts/tables/01-core/12_settings_seed.sql`
   - Progress: split mobile/digital operations tables into per-table scripts:
     - `scripts/tables/05-operations/100_mobile_check_ins.sql`
     - `scripts/tables/05-operations/109_digital_registration_cards.sql`
     - `scripts/tables/05-operations/110_contactless_requests.sql`
   - Progress: split dynamic pricing tables into per-table scripts:
     - `scripts/tables/06-integrations/95_dynamic_pricing_rules_ml.sql`
     - `scripts/tables/06-integrations/98_price_adjustments_history.sql`
     - `scripts/tables/06-integrations/99_pricing_experiments.sql`
   - Planned approach: resolve naming mismatches (e.g., room availability), then split/rename combined scripts to match schema file names.
