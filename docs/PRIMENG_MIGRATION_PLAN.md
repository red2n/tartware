# PrimeNG Migration Plan — `pms-ui`

> **Decision**: Migrate from Angular Material (v21) to **PrimeNG + Lara theme**.
> **Status**: Planning — no code changed yet.
> **Angular version**: 21.2.x (PrimeNG 18+ fully supports Angular 17+).

---

## Why PrimeNG fits this codebase

| Current setup | PrimeNG fit |
|---|---|
| Primer token system (`--bgColor-*`, `--fgColor-*`, `--borderColor-*`) | PrimeNG theming uses CSS custom properties — direct 1-to-1 mapping to existing Primer variables. |
| `material-overrides.scss` — fighting MDC component internals | Replaced by a thin `primeng-theme.scss` override that speaks the same CSS-variable language. |
| `shared.scss` layout utilities (`.card`, `.page-header`, `.kpi-grid`, etc.) | 100% portable — framework-agnostic SCSS, untouched. |
| `tokens.css` app-specific tokens | 100% portable. |
| Tailwind CSS v4 + Primer primitives | PrimeNG is not Tailwind-aware but does not conflict — both coexist via their respective CSS layers. |
| `MatIconModule` (625 uses) | Replaced by `<i class="pi pi-*">` OR keep using Google Material Icons via `<span class="material-icons">` — PrimeNG does not dictate icon library. |
| `MatDialogModule` (28 files) | Replaced by PrimeNG `DynamicDialog` or `<p-dialog>`. |
| `MatProgressSpinnerModule` (70 files) | Replaced by `<p-progressSpinner>` or `<p-skeleton>`. |

---

## Current Material footprint (measured)

| Material module | Import count | HTML usage |
|---|---|---|
| `MatIconModule` | 110 | 625 `<mat-icon>` |
| `MatButtonModule` | 76 | 157 `<button>` with mat directives |
| `MatTooltipModule` | 74 | 146 `matTooltip` attributes |
| `MatProgressSpinnerModule` | 70 | 101 `<mat-spinner>` |
| `MatDialogModule` | 28 | 12 `<mat-dialog-*>` blocks |
| `MatSlideToggleModule` | 8 | 6 `<mat-slide-toggle>` |
| `MatFormFieldModule` + `MatInputModule` | 6 | 3 `<mat-form-field>` |
| `MatMenuModule` | 4 | 7 `<mat-menu>` |
| `MatCheckboxModule` | 2 | — |
| **Total files touched** | **56 `.ts`** | **53 `.html`** |

**Observation**: The heavy hitters are icons (625), tooltips (146), spinners (101), and buttons (157). Dialogs are used in 28 files but have a simple mapping. There are almost no table/form/datepicker usages — this is a lighter migration than a full enterprise CRUD app would be.

---

## Migration strategy

### Guiding principles

1. **Keep `@angular/cdk`** — PrimeNG depends on it for overlays. No removal needed.
2. **Keep `@angular/forms`** — standard Angular reactive forms, untouched.
3. **Keep `shared.scss`, `tokens.css`, `primer-light.css`, `primer-dark.css`** — 100% framework-agnostic, survive intact.
4. **Icons: keep Google Material Icons** — just switch from `<mat-icon>icon_name</mat-icon>` to `<span class="material-icons">icon_name</span>` (or a tiny wrapper component). This avoids touching 625 uses individually; a single find-replace handles it.
5. **Migrate component-by-component** — layout shell first, then leaf feature components, so the app remains runnable throughout.

---

## Phase 0 — Dependency setup (no template changes)

### 0a. Install PrimeNG

```bash
cd UI/pms-ui
pnpm add primeng @primeng/themes
```

### 0b. Add PrimeNG provider to `app.config.ts`

```ts
import { providePrimeNG } from 'primeng/config';
import Lara from '@primeng/themes/lara';

export const appConfig: ApplicationConfig = {
  providers: [
    // ... existing providers
    providePrimeNG({
      theme: {
        preset: Lara,
        options: { darkModeSelector: '[data-theme="dark"]' }, // matches existing Primer hook
      },
    }),
  ],
};
```

### 0c. Replace `material-overrides.scss` with `primeng-theme.scss`

Delete `material-overrides.scss` and create `primeng-theme.scss`. Map PrimeNG's semantic tokens to the existing Primer variables:

```scss
// primeng-theme.scss
// Maps PrimeNG design tokens → existing Primer/app tokens
// so components pick up colors automatically in light and dark modes.

:root {
  // Surface
  --p-surface-card:        var(--bgColor-muted);
  --p-surface-hover:       var(--bgColor-subtle);
  --p-surface-border:      var(--borderColor-default);

  // Text
  --p-text-color:          var(--fgColor-default);
  --p-text-muted-color:    var(--fgColor-muted);

  // Primary (OpenSea blue)
  --p-primary-color:       #2081e2;
  --p-primary-contrast-color: #ffffff;

  // Focus ring
  --p-focus-ring-color:    var(--borderColor-accent-emphasis);
  --p-focus-ring-width:    var(--focus-outline-width, 2px);

  // Border radius — matches MDC overrides already in tokens.css
  --p-border-radius-sm:    var(--borderRadius-small);
  --p-border-radius-md:    var(--borderRadius-medium);
  --p-border-radius-lg:    var(--borderRadius-large);

  // Input
  --p-inputtext-background: var(--bgColor-default);
  --p-inputtext-border-color: var(--borderColor-default);
  --p-inputtext-color:      var(--fgColor-default);
}
```

Update `styles.scss`:

```scss
// Replace: @use './styles/material-overrides';
// With:
@use './styles/primeng-theme';
```

### 0d. Remove `@angular/material` import from `styles.scss`

The `@use '@angular/material'` Sass reference lives only inside `material-overrides.scss` — deleting that file removes it automatically.

**Build gate**: `pnpm run build` should pass (some TS errors expected as imports reference missing modules — track these per phase).

---

## Phase 1 — Icons (highest ROI, single find-replace)

**Scope**: 625 template occurrences across 53 files.

### Strategy: create a thin `IconComponent` wrapper

Create `src/app/shared/components/icon/icon.ts`:

```ts
@Component({
  selector: 'app-icon',
  standalone: true,
  template: `<span class="material-icons" [attr.aria-hidden]="true">{{ name }}</span>`,
  styles: [':host { display: contents; }'],
})
export class IconComponent {
  @Input({ required: true }) name!: string;
}
```

Then in templates, replace:

```html
<!-- Before -->
<mat-icon>home</mat-icon>
<mat-icon>{{ someSignal() }}</mat-icon>

<!-- After -->
<app-icon name="home" />
<app-icon [name]="someSignal()" />
```

This is a mechanical find-replace per file. No behavior changes.

Remove `MatIconModule` import from each file as you go.

**Effort estimate**: 1–2 hours scripted, or ~30 min with a VS Code multi-file regex replace.

---

## Phase 2 — Tooltips

**Scope**: 146 `matTooltip` attributes across 74 files.

PrimeNG provides `pTooltip` directive from `primeng/tooltip`.

```html
<!-- Before -->
<button matTooltip="Save changes" matTooltipPosition="above">

<!-- After -->
<button pTooltip="Save changes" tooltipPosition="top">
```

Per-file swap: remove `MatTooltipModule`, add `TooltipModule` from `primeng/tooltip`.

**Effort**: ~1 hour.

---

## Phase 3 — Loading spinners

**Scope**: 101 `<mat-spinner>` across 70 files.

These are pure visual replacements.

```html
<!-- Before -->
<mat-spinner diameter="24" />
<mat-spinner />  (full-page)

<!-- After -->
<p-progressSpinner strokeWidth="3" styleClass="w-6 h-6" />
<p-progressSpinner />
```

Or use PrimeNG Skeleton (`<p-skeleton>`) for content placeholders where appropriate.

Import `ProgressSpinnerModule` from `primeng/progressspinner` per component, remove `MatProgressSpinnerModule`.

**Effort**: ~1 hour.

---

## Phase 4 — Buttons

**Scope**: 157 `<button>` elements with `mat-button`, `mat-raised-button`, `mat-flat-button`, `mat-icon-button` directives.

PrimeNG button is a directive on native `<button>`:

```html
<!-- Before -->
<button mat-flat-button color="primary" (click)="save()">Save</button>
<button mat-icon-button matTooltip="Delete"><mat-icon>delete</mat-icon></button>

<!-- After -->
<button pButton severity="primary" (click)="save()">Save</button>
<button pButton [rounded]="true" [text]="true" pTooltip="Delete">
  <app-icon name="delete" />
</button>
```

The OpenSea gradient from `material-overrides.scss` moves into `primeng-theme.scss`:

```scss
.p-button.p-button-primary {
  background: linear-gradient(135deg, #2081e2 0%, #7b3fe4 100%);
  border: none;
  box-shadow: 0 4px 16px #2081e240;
  &:hover { opacity: 0.9; }
}
```

**Effort**: ~2–3 hours (most complex swap due to variant diversity).

---

## Phase 5 — Dialogs

**Scope**: 28 files, ~12 dialog component blocks.

PrimeNG `DynamicDialogModule` is the closest equivalent to `MatDialog`:

```ts
// Before
constructor(private dialog: MatDialog) {}
openDialog() {
  this.dialog.open(CreateGuestDialogComponent, { width: '480px', data: { ... } });
}

// After
constructor(private dialogService: DialogService) {}
openDialog() {
  this.dialogService.open(CreateGuestDialogComponent, {
    header: 'Create Guest',
    width: '480px',
    data: { ... },
  });
}
```

Dialog components inject `DynamicDialogRef` and `DynamicDialogConfig` instead of `MatDialogRef` and `MAT_DIALOG_DATA`. The `<mat-dialog-content>` / `<mat-dialog-actions>` structural slots map to plain `<div>` with PrimeNG button styling — or wrap in the existing `shared/components/dialog-actions/` component which already abstracts this.

**Effort**: ~3–4 hours (dialog components need both `.ts` and `.html` changes).

---

## Phase 6 — Remaining small modules

| Module | Count | PrimeNG replacement |
|---|---|---|
| `MatSlideToggleModule` | 8 files | `<p-toggleSwitch>` from `primeng/toggleswitch` |
| `MatMenuModule` | 4 files | `<p-menu>` or `<p-tieredmenu>` from `primeng/menu` |
| `MatFormFieldModule` + `MatInputModule` | 6 files | PrimeNG `InputText` directive (`pInputText`) + native `<label>` |
| `MatCheckboxModule` | 2 files | `<p-checkbox>` from `primeng/checkbox` |

**Effort**: ~2 hours total.

---

## Phase 7 — Layout shell components

The layout components (`sidebar`, `topbar`, `activity-bar`, `status-bar`, `sub-sidebar`) use Material for icons and buttons only. After Phases 1 & 4 complete, these are already migrated. **No additional work needed** if phases are done in order.

---

## Phase 8 — Clean up and remove `@angular/material`

After all phases pass:

```bash
cd UI/pms-ui
pnpm remove @angular/material
# Keep @angular/cdk — PrimeNG needs it
```

Delete `src/styles/material-overrides.scss`.

Run the full quality gate:

```bash
cd UI/pms-ui
npx biome check --write src/
npx eslint src/
ng build --configuration=production
```

---

## Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| PrimeNG Lara date-picker / calendar look in rate-calendar screen | Medium | Rate calendar uses custom grid rendering, not Mat datepicker — low impact |
| `@angular/cdk` overlay z-index conflicts between PrimeNG overlays and any remaining CDK usages | Low | PrimeNG respects `--p-zindex-overlay`; set to match existing `z-index: 1100` (Google Places dropdown) |
| `DynamicDialogService` requires a provider at root or feature level | Low | Add `DialogService` to the root providers in `app.config.ts` |
| Animation — PrimeNG uses its own `AnimationModule`; Angular 21 uses `BrowserAnimationsModule` | Low | `provideAnimationsAsync()` is already in `app.config.ts` — no change needed |
| SSR/prerender | N/A | `pms-ui` is a pure SPA with service worker, no SSR |

---

## What stays 100% unchanged

- `src/styles/shared.scss` — all layout utilities, `.card`, `.page-header`, `.kpi-grid`, `.data-table`, `.status-badge` etc.
- `src/styles/tokens.css` — all app-specific CSS custom properties
- `src/styles/primer-light.css` + `primer-dark.css` — Primer token sets
- `src/styles/styles.scss` — structure unchanged, only `material-overrides` reference replaced
- `@primer/primitives` package — stays
- Tailwind CSS v4 — stays
- All feature logic, services, signals, API calls — untouched
- `@tartware/schemas` types — untouched
- `app.routes.ts` lazy loading — untouched

---

## Effort summary

| Phase | Scope | Estimated effort |
|---|---|---|
| 0 — Dependency + theme setup | Package install, provider, theme file | 1–2 h |
| 1 — Icons | 625 occurrences, 53 files | 1–2 h |
| 2 — Tooltips | 146 occurrences, 74 files | 1 h |
| 3 — Spinners | 101 occurrences, 70 files | 1 h |
| 4 — Buttons | 157 occurrences, 56 files | 2–3 h |
| 5 — Dialogs | 28 files, 12 dialog blocks | 3–4 h |
| 6 — Small modules (toggle, menu, input, checkbox) | 20 files | 2 h |
| 7 — Layout shell | Covered by phases 1 & 4 | 0 h |
| 8 — Remove `@angular/material` + quality gate | Package removal, biome, eslint, build | 1 h |
| **Total** | | **~12–16 h** |

The migration is **mechanical rather than architectural** — the existing token system and `shared.scss` are already the right abstraction layer. PrimeNG slot directly into them.

---

## Not in scope

- Replacing PrimeNG with a second library later — commit to PrimeNG as the single component library.
- Migrating `@angular/cdk` usages (overlay, portal) — CDK stays.
- Any API, schema, or backend changes — UI-only migration.
- Self-service / guest portal screens (these don't exist yet — build with PrimeNG from the start per the API gap plan).
