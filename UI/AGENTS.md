# UI Agent Instructions

## Schema Usage — `@tartware/schemas` is the Single Source of Truth

- **NEVER define local TypeScript types for API data shapes** (request bodies, response items, query params) inside UI components or services. Always import from `@tartware/schemas`.
- Use `import type { ... } from '@tartware/schemas'` for all API-related types (e.g., `RoomItem`, `RateItem`, `RateListQuery`, `CreateRateBody`).
- The `@tartware/schemas` package is already a `workspace:^` dependency in the UI `package.json` — no additional setup needed.
- **Allowed locally in UI:** component-internal view-model types, signal types, filter/tab types, form state types, and UI-only display helpers that do not duplicate schema shapes.
- If a needed type does not exist in `@tartware/schemas`, add it to the schema package first (`schema/src/`), build it (`npx nx run @tartware/schemas:build`), then import it in the UI.

## Component Patterns

- Use Angular standalone components with signal-based state management.
- Reusable styles live in `src/styles/shared.scss` — do not duplicate shared patterns in component SCSS files.
- Use `@defer (on idle)` for heavy table/list rendering.
- Route all API requests through `ApiService` → API Gateway (port 8080) — never call backend services directly.
- Lazy-load feature components via `loadComponent` in `app.routes.ts`.
