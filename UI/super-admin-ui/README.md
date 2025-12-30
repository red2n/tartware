# Platform Admin Console (UI/super-admin-ui)

System-admin console for platform operators and support. Lives under `UI/super-admin-ui` and uses system admin plus impersonation tokens to inspect tenant data. This is **not** the tenant/guest-facing reservation portal.

## Scope
- System admin auth flows (login, break-glass, impersonation)
- Tenant and user lookup (admin perspective)
- Support-only reservation viewer (tenant-scoped, read-only)
- Session strip, theme toggle, and HTTP interceptor wiring
- Types come from `@tartware/schemas`; no ad-hoc DTOs

## Guardrails
- Flat theme (see `src/styles/theme.scss`), Material/CDK controls
- Standalone components, signals, SSR-compatible patterns
- Admin/support context only; avoid tenant/guest UI here

## Development
- `npm start` (dev server)
- `npm test` (Karma)
- `npm run build` (Angular build)

## Notes
- API base defaults to `/v1`; adjust via `API_BASE` provider if needed.
- Uses admin token for `/system/*` calls; prefers impersonation token for tenant-scoped calls.
- Reservation view is for support triage; tenant-facing booking UI should live in its own app.
