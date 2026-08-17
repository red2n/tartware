# UI Agent Instructions

## Schema Usage — `@tartware/schemas` is the Single Source of Truth

- **NEVER define local TypeScript types for API data shapes** (request bodies, response items, query params) inside UI components or services. Always import from `@tartware/schemas`.
- Use `import type { ... } from '@tartware/schemas'` for all API-related types (e.g., `RoomItem`, `RateItem`, `RateListQuery`, `CreateRateBody`).
- The `@tartware/schemas` package is already a `workspace:^` dependency in the UI `package.json` — no additional setup needed.
- **Allowed locally in UI:** component-internal view-model types, signal types, filter/tab types, form state types, and UI-only display helpers that do not duplicate schema shapes.
- If a needed type does not exist in `@tartware/schemas`, add it to the schema package first (`schema/src/`), build it (`npx nx run @tartware/schemas:build`), then import it in the UI.

## Design Tokens — `UI/shared-styles/` is the Single Source of Truth

- **NEVER write a raw colour in an app** — no hex, no `rgb()`, no named colours in any
  component SCSS or inline `styles:` block. Both apps are currently at zero; keep them there.
- Colour comes from `UI/shared-styles/palette-light.css` / `palette-dark.css`, shared by
  `pms-ui` and `guest-portal`. Shape comes from `shape.css`. Read `UI/shared-styles/README.md`
  before adding or changing a token.
- Use `--borderColor-control` for anything a user operates (inputs, checkboxes).
  `--borderColor-default` is a decorative separator at 1.3:1 and fails WCAG 1.4.11 on controls.
- `--accent-decorative` must never carry text or back a white label — it is 3.96:1.
  Text uses `--fgColor-accent`.
- Theme state is one attribute, `data-theme` on `<html>`. Do not add parallel attributes.
- After touching any palette file run `node UI/shared-styles/check-contrast.mjs` (72 pairings,
  exits non-zero on failure). A new text-bearing token must be added to its `PAIRS` list.

## Component Patterns

- Use Angular standalone components with signal-based state management.
- Reusable styles live in `src/styles/shared.scss` — do not duplicate shared patterns in component SCSS files.
- Use `@defer (on idle)` for heavy table/list rendering.
- Route all API requests through `ApiService` → API Gateway (port 8080) — never call backend services directly.
- Lazy-load feature components via `loadComponent` in `app.routes.ts`.
- Open modals with `AppDialogService` (never PrimeNG's `DialogService` directly) and wrap the dialog template in `<app-dialog-shell>` — the service owns the sizing and the shell owns the pinned title/footer rows.
