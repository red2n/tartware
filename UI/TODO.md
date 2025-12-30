# Super Admin UI TODO

# Super Admin UI TODO

## Guardrails (must follow in every template)
- **Flat colors only**: No gradients, shadows, or heavy visual effects
- **Minimal styling**: Keep CSS lean - use utility classes where possible
- **All colors from theme file**: Source from `projects/ui-theme/src/lib/styles/theme.scss` CSS variables only
- **No animations**: `provideNoopAnimations()` is enabled, avoid transition/animation CSS
- **Light and dark palettes**: Use CSS custom properties (--color-*) for automatic theme support
- Prefer Angular CDK + Material form controls/dialogs/tables; keep templates lean and duplication-free
- Accessible and audit-friendly: keyboard-first, focus-visible, a11y lint clean, emit audit breadcrumbs where needed
- Performance-first: strict mode, standalone components, signals/component-store; avoid extra DOM wrappers
- SSR considered for settings-like screens and any data-heavy views (plan routing to support SSR later)
- Upgradable: keep to Angular v19+ LTS, no custom Material theming hacks; isolate styling in theme file for easy updates

## Immediate setup
- Scaffold Angular workspace (standalone, strict) for system-admin UI.
- Add Material/CDK with light/dark theme tokens in a single theme/colors file.
- Add global styles for flat palettes and typography; keep animation module disabled by default.
- Set up routing shell (system-admin module), auth/role guards, HTTP interceptors (auth header + correlation + logging).

## Initial screens
- System Admin Login (password + MFA; break-glass secondary flow).
- Impersonation launcher (tenant+user selection, reason/ticket capture).
- Tenants list (paged) with basic filters.
- Users list (filter by tenant) with basic paging.
- Session strip (role, session hash, sign-out).
- Reservations browser (tenant + optional property/status/search filters) using /v1/reservations; add paging/export later.

## Tenant context & filters
- Persist tenant/property context in session service (localStorage) and reuse across pages.
- Tenant picker component pulls /v1/system/tenants and emits selection for downstream views.

## Contract-driven
- Generate typed API client from OpenAPI for system-admin endpoints; add runtime validation per response (Zod or similar).
- Centralize API base URL and auth header injection via interceptor.

## Theming
- theme/colors file exporting CSS custom properties for light and dark; Material theme bridge based on those tokens.
- No gradients; solid fills and clear borders only.

## Observability & audit
- HTTP interceptor to emit timing/error breadcrumbs; optional hooks to send to telemetry.
- Capture audit-friendly breadcrumbs in UI (who/when/what) without leaking secrets.

## SSR consideration
- Keep routing/data-fetch patterns compatible with Angular SSR; defer heavy client-only APIs, and guard window usage.
