<!--
Purpose: Hard rules and coding standards for AI agents (GitHub Copilot / coding assistants) working on tartware-ui.
These are non-negotiable requirements that must be followed in ALL cases.
Last Updated: November 8, 2025
-->

# Copilot Instructions for tartware-ui (Angular Frontend)

## 1. Project Overview & Non-Negotiables

### 1.1 Tech Stack (LOCKED - Never Override)
- **Framework**: Angular 18.2.0 with standalone components (NO NgModules)
- **TypeScript**: 5.5.2 with strict mode enabled
- **UI Library**: Angular Material 18.2.14 with Material Design 3 (M3) theme
- **State Management**: RxJS 7.8.0 with signals for local state
- **Build Tool**: Angular CLI with esbuild
- **Quality Tools**: ESLint + Prettier + Biome.js (ALL THREE required)

### 1.2 Architecture Principles (MANDATORY)
1. **Standalone Components Only**: Never create or suggest NgModule-based components
2. **Lazy Loading**: All feature routes MUST use `loadComponent()` for code splitting
3. **Modern Patterns**: Use `inject()` function, NOT constructor injection
4. **Type Safety**: TypeScript strict mode is non-negotiable - NO `any` types
5. **Performance First**: OnPush change detection strategy required for all components

---

## 2. Code Quality Standards (ENFORCED)

### 2.1 Quality Tooling (Triple Check System)
**All three tools must pass before any commit:**

1. **ESLint** - Angular-specific rules, accessibility checks
   ```bash
   npm run lint        # Check
   npm run lint:fix    # Auto-fix
   ```

2. **Prettier** - Code formatting
   ```bash
   npm run format:check  # Check
   npm run format        # Auto-fix
   ```

3. **Biome.js** - Additional linting, complexity analysis, performance rules
   ```bash
   npm run biome       # Check
   npm run biome:fix   # Auto-fix
   ```

### 2.2 Build Pipeline (AUTOMATED - Never Skip)
```bash
npm run build        # Auto-runs: prebuild → lint → biome → build
npm run build:prod   # Auto-runs: prebuild:prod → lint → biome → build (production)
npm run validate     # Full validation: lint + biome + build
```

**CRITICAL**: `prebuild` and `prebuild:prod` hooks automatically run quality checks. Never disable or remove these hooks.

### 2.3 Biome Configuration Rules
**File**: `biome.json`

Key rules that MUST be respected:
- `complexity.useLiteralKeys: "off"` - Required for TypeScript strict index signatures (DO NOT change)
- `noForEach: "off"` - Angular patterns use forEach in specific cases
- `noNonNullAssertion: "off"` - Allowed for Angular DI and Material components
- HTML files excluded - Angular templates are not linted by Biome

---

## 3. Angular Best Practices (STRICT ENFORCEMENT)

### 3.1 Component Structure
```typescript
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Component description
 *
 * Features:
 * - Feature 1
 * - Feature 2
 *
 * Reference: [Documentation URL if applicable]
 */
@Component({
  selector: 'app-my-component',
  standalone: true,
  imports: [CommonModule, /* Material modules */],
  templateUrl: './my-component.html',
  styleUrl: './my-component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush, // REQUIRED
})
export class MyComponent {
  // Use inject() - NO constructor injection
  private myService = inject(MyService);

  // Use signals for reactive state
  data = signal<DataType[]>([]);
  isLoading = signal(false);

  // Computed signals for derived state
  itemCount = computed(() => this.data().length);
}
```

**MANDATORY RULES:**
1. ✅ Always use `ChangeDetectionStrategy.OnPush`
2. ✅ Always use `inject()` function for DI
3. ✅ Use signals for component state (NOT BehaviorSubjects in components)
4. ✅ Include JSDoc comments explaining purpose and features
5. ✅ Import only what's needed (no wildcard imports)
6. ❌ NEVER use `any` type
7. ❌ NEVER use constructor injection
8. ❌ NEVER create NgModules

### 3.2 Routing (Lazy Loading Required)
**File**: `src/app/app.routes.ts`

```typescript
export const routes: Routes = [
  {
    path: 'feature',
    loadComponent: () =>
      import('./features/feature/feature.component').then(m => m.FeatureComponent),
    canActivate: [authGuard], // If protected
    title: 'Feature - Tartware PMS',
  },
];
```

**RULES:**
- ✅ ALL routes MUST use `loadComponent()` for lazy loading
- ✅ Include page title metadata
- ✅ Apply guards where needed
- ❌ NO eager loading of feature components

### 3.3 Services Pattern
```typescript
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class MyService {
  private http = inject(HttpClient);

  // Public signals for reactive state (if needed)
  data = signal<DataType[]>([]);

  // Methods return Observables
  getData(): Observable<DataType[]> {
    return this.http.get<DataType[]>('/api/data');
  }
}
```

**RULES:**
- ✅ Use `inject()` function
- ✅ Return Observables from HTTP methods (don't auto-subscribe in service)
- ✅ Use signals for service-level state that components consume
- ✅ Include JSDoc documentation

### 3.4 HTTP Interceptors (Functional Pattern)
```typescript
import type { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

export const myInterceptor: HttpInterceptorFn = (req, next) => {
  const service = inject(MyService);

  // Interceptor logic

  return next(req).pipe(
    // RxJS operators
  );
};
```

**Current Interceptors (DO NOT MODIFY ORDER):**
```typescript
provideHttpClient(withInterceptors([
  loadingInterceptor,  // Must be FIRST (shows loading bar)
  authInterceptor,     // Must be SECOND (adds auth headers)
]))
```

---

## 4. Material Design 3 (M3) Implementation

### 4.1 Theme Configuration
**File**: `src/styles/_m3-theme.scss`

**RULES:**
- ✅ Use M3 design tokens (CSS custom properties with `--md-sys-` prefix)
- ✅ Support both light and dark themes
- ✅ Use `.dark-theme` class for dark mode
- ❌ DO NOT use prebuilt Material themes
- ❌ DO NOT modify M3 design token values without design approval

### 4.2 Theme Service Usage
```typescript
export class MyComponent {
  themeService = inject(ThemeService);

  toggleTheme() {
    this.themeService.toggleTheme();
  }

  get isDark() {
    return this.themeService.isDark();
  }
}
```

**Available Methods:**
- `toggleTheme()` - Switch between light/dark
- `setTheme('light' | 'dark')` - Set specific theme
- `getCurrentTheme()` - Get current theme
- `resetToSystemPreference()` - Use system preference
- `isDark()` - Signal for reactive theme state

### 4.3 M3 Component Styling
**Use M3 design tokens in component styles:**

```scss
.my-component {
  background-color: var(--md-sys-color-surface);
  color: var(--md-sys-color-on-surface);
  border-radius: var(--md-sys-shape-corner-medium);
  box-shadow: var(--md-sys-elevation-2);
}
```

**Available Design Tokens:**
- Surface colors: `--md-sys-color-surface`, `--md-sys-color-surface-variant`
- Primary: `--md-sys-color-primary`, `--md-sys-color-on-primary`
- Shapes: `--md-sys-shape-corner-small`, `--md-sys-shape-corner-medium`
- Elevation: `--md-sys-elevation-1` through `--md-sys-elevation-5`

---

## 5. Performance Optimization (MANDATORY)

### 5.1 Bundle Size Targets
**Configuration**: `angular.json`

```json
{
  "budgets": [
    {
      "type": "initial",
      "maximumWarning": "500kB",
      "maximumError": "1MB"
    },
    {
      "type": "anyComponentStyle",
      "maximumWarning": "2kB",
      "maximumError": "4kB"
    }
  ]
}
```

**RULES:**
- ✅ Initial bundle MUST be under 500kB (warning) / 1MB (error)
- ✅ Component styles MUST be under 2kB (warning) / 4kB (error)
- ✅ Use lazy loading to reduce initial bundle size
- ✅ Run `npm run analyze` to check bundle composition

### 5.2 Change Detection Strategy
**ALL components MUST use OnPush:**

```typescript
@Component({
  // ...
  changeDetection: ChangeDetectionStrategy.OnPush,
})
```

**Why OnPush is mandatory:**
1. Reduces change detection cycles by ~90%
2. Forces explicit state management with signals
3. Prevents accidental mutations
4. Improves performance for large component trees

### 5.3 Loading States (Automatic)
**Global Loading Indicator** - Automatically handled by `LoadingInterceptor`

```typescript
// No manual loading state needed for HTTP calls
// The interceptor handles it automatically
```

**Component-Specific Loading** - Use signals:
```typescript
export class MyComponent {
  isLoading = signal(false);

  loadData() {
    this.isLoading.set(true);
    this.service.getData().subscribe({
      next: (data) => {
        this.data.set(data);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }
}
```

---

## 6. Error Handling (MANDATORY PATTERNS)

### 6.1 Global Error Handler
**Service**: `GlobalErrorHandlerService` - Automatically catches all unhandled errors

**RULES:**
- ✅ Already configured in `app.config.ts`
- ✅ Logs errors to console (production: send to monitoring service)
- ❌ DO NOT create custom global error handlers

### 6.2 Error Boundary Component
**Component**: `ErrorBoundaryComponent` - Wrap error-prone components

```html
<app-error-boundary [title]="'Data Loading Error'" [showDetails]="true">
  <my-component></my-component>
</app-error-boundary>
```

**When to use:**
- Data-heavy components that might fail
- Components making external API calls
- Complex UI components with intricate logic

### 6.3 HTTP Error Handling
```typescript
this.http.get<DataType>('/api/data').subscribe({
  next: (data) => {
    this.data.set(data);
  },
  error: (error: HttpErrorResponse) => {
    // Log error
    console.error('API Error:', error);

    // Show user-friendly message
    this.errorMessage.set(
      error.status === 404
        ? 'Data not found'
        : 'Failed to load data. Please try again.'
    );
  },
});
```

---

## 7. TypeScript Configuration (STRICT - Never Relax)

### 7.1 Compiler Options (tsconfig.json)
```jsonc
{
  "compilerOptions": {
    "strict": true,                              // REQUIRED
    "noImplicitOverride": true,                  // REQUIRED
    "noPropertyAccessFromIndexSignature": true,  // REQUIRED
    "noImplicitReturns": true,                   // REQUIRED
    "noFallthroughCasesInSwitch": true,         // REQUIRED
  }
}
```

**RULES:**
- ❌ NEVER disable strict mode
- ❌ NEVER use `@ts-ignore` or `@ts-expect-error` without explanation
- ✅ Fix TypeScript errors properly, don't suppress them

### 7.2 Angular Extended Diagnostics (ENABLED)
```jsonc
{
  "angularCompilerOptions": {
    "strictTemplates": true,                     // REQUIRED
    "strictInjectionParameters": true,           // REQUIRED
    "strictInputAccessModifiers": true,          // REQUIRED
    "extendedDiagnostics": {
      "checks": {
        "invalidBananaInBox": "error",           // [()] instead of ([])
        "nullishCoalescingNotNullable": "warning",
        "optionalChainNotNullable": "warning",
        "textAttributeNotBinding": "warning"
      }
    }
  }
}
```

**Why Extended Diagnostics:**
- Catches common Angular template errors at build time
- Prevents runtime errors in production
- Enforces best practices in templates

---

## 8. Testing Standards (Required for New Features)

### 8.1 Test Structure
```typescript
import { TestBed } from '@angular/core/testing';
import { MyComponent } from './my-component';

describe('MyComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyComponent], // Standalone component
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(MyComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });

  it('should toggle theme', () => {
    const fixture = TestBed.createComponent(MyComponent);
    const component = fixture.componentInstance;
    const initialTheme = component.themeService.getCurrentTheme();

    component.toggleTheme();

    expect(component.themeService.getCurrentTheme()).not.toBe(initialTheme);
  });
});
```

**RULES:**
- ✅ Write tests for new components and services
- ✅ Test user interactions and state changes
- ✅ Mock HTTP calls with TestBed
- ✅ Run tests before committing: `npm run test`
- ✅ Check coverage: `npm run test:coverage` (target: 80%+)

---

## 9. File Organization & Naming (STRICT CONVENTIONS)

### 9.1 Directory Structure
```
src/
├── app/
│   ├── core/                    # Singleton services, guards, interceptors
│   │   ├── guards/
│   │   ├── interceptors/
│   │   ├── services/
│   │   └── models/
│   ├── features/                # Feature modules (lazy loaded)
│   │   ├── auth/
│   │   ├── tenants/
│   │   └── [feature-name]/
│   ├── shared/                  # Shared components, pipes, directives
│   │   ├── components/
│   │   ├── pipes/
│   │   └── directives/
│   ├── app.component.ts
│   ├── app.routes.ts
│   └── app.config.ts
├── styles/
│   ├── _m3-theme.scss          # Material Design 3 theme
│   └── styles.scss             # Global styles
└── environments/                # Environment configs
```

### 9.2 Naming Conventions
**Files:**
- Components: `my-component.component.ts` (kebab-case)
- Services: `my-service.service.ts` (kebab-case)
- Guards: `my-guard.guard.ts` (kebab-case)
- Interceptors: `my-interceptor.interceptor.ts` (kebab-case)
- Models: `my-model.model.ts` (kebab-case)

**Classes:**
- Components: `MyComponent` (PascalCase)
- Services: `MyService` (PascalCase)
- Interfaces: `MyInterface` (PascalCase)
- Types: `MyType` (PascalCase)

**Selectors:**
- Component selectors: `app-my-component` (prefix: `app-`, kebab-case)
- Directive selectors: `appMyDirective` (prefix: `app`, camelCase)

---

## 10. Security Best Practices (MANDATORY)

### 10.1 Authentication
**Pattern**: JWT tokens with HTTP-only cookies (when available)

```typescript
export class AuthService {
  private http = inject(HttpClient);

  login(credentials: LoginCredentials): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/auth/login', credentials);
  }

  // Token stored in localStorage as fallback
  // (HTTP-only cookies preferred for production)
  getToken(): string | null {
    return localStorage.getItem('auth_token');
  }
}
```

**RULES:**
- ✅ Use `authGuard` for protected routes
- ✅ Use `authInterceptor` to add tokens to requests
- ✅ Clear tokens on logout
- ❌ NEVER log sensitive data (tokens, passwords)
- ❌ NEVER store sensitive data in localStorage in production (use HTTP-only cookies)

### 10.2 XSS Prevention
**Angular automatically sanitizes templates - respect it:**

```typescript
// ✅ GOOD - Angular sanitizes automatically
template: `<div>{{ userInput }}</div>`

// ❌ BAD - Bypasses sanitization (only if absolutely necessary)
template: `<div [innerHTML]="trustedHtml"></div>`
```

**RULES:**
- ✅ Let Angular handle sanitization (default behavior)
- ✅ Use `DomSanitizer` only when absolutely necessary
- ✅ Validate and sanitize user input on backend
- ❌ NEVER use `bypassSecurityTrust*` without security review

---

## 11. Accessibility (A11y) - WCAG 2.1 AA Compliance

### 11.1 ARIA Labels (Required)
```html
<!-- ✅ GOOD -->
<button mat-button aria-label="Close dialog">
  <mat-icon>close</mat-icon>
</button>

<!-- ❌ BAD -->
<button mat-button>
  <mat-icon>close</mat-icon>
</button>
```

### 11.2 Keyboard Navigation
**RULES:**
- ✅ All interactive elements must be keyboard accessible
- ✅ Use proper focus management (Material handles most cases)
- ✅ Test with keyboard only (Tab, Enter, Escape)
- ✅ Use `tabindex="0"` for custom interactive elements

### 11.3 Color Contrast
**RULES:**
- ✅ Minimum contrast ratio: 4.5:1 (normal text), 3:1 (large text)
- ✅ M3 theme provides compliant colors (use design tokens)
- ✅ Test with browser DevTools (Lighthouse audit)

### 11.4 Screen Reader Support
```html
<!-- ✅ GOOD -->
<mat-form-field>
  <mat-label>Email Address</mat-label>
  <input matInput type="email" aria-required="true" />
  <mat-error>Please enter a valid email</mat-error>
</mat-form-field>

<!-- Use live regions for dynamic content -->
<div role="status" aria-live="polite" aria-atomic="true">
  {{ statusMessage() }}
</div>
```

**ESLint A11y Rules (Enforced):**
- `noAccessKey: "error"` - Avoid accesskey attribute
- `noAutofocus: "warn"` - Avoid autofocus in most cases
- `useAltText: "error"` - Images must have alt text
- `useButtonType: "error"` - Buttons must have explicit type

---

## 12. Environment Configuration

### 12.1 Environment Files
```
src/environments/
├── environment.ts          # Development
├── environment.staging.ts  # Staging
└── environment.prod.ts     # Production
```

**Structure:**
```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
  enableDebugTools: true,
  logLevel: 'debug',
};
```

**RULES:**
- ✅ Use environment variables for API URLs, feature flags
- ✅ Never commit secrets or API keys
- ❌ DO NOT use environment variables for business logic

---

## 13. Git & Version Control

### 13.1 Commit Messages (Conventional Commits)
```
feat: add dark mode toggle to settings page
fix: resolve loading spinner not hiding on error
refactor: migrate auth service to signals
style: apply M3 design tokens to card components
docs: update README with new testing guidelines
test: add unit tests for theme service
perf: implement lazy loading for admin routes
chore: update Angular to 18.2.14
```

**Format**: `<type>: <description>`

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `refactor` - Code refactoring
- `style` - UI/styling changes
- `docs` - Documentation
- `test` - Tests
- `perf` - Performance improvements
- `chore` - Maintenance tasks

### 13.2 Pull Request Checklist
**Before creating PR:**
```bash
# 1. Run all quality checks
npm run validate

# 2. Run tests
npm run test

# 3. Check bundle size
npm run analyze

# 4. Verify build
npm run build:prod
```

---

## 14. Common Patterns & Examples

### 14.1 Reactive Form with Signals
```typescript
export class MyFormComponent {
  private fb = inject(FormBuilder);

  form = this.fb.group({
    name: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
  });

  isSubmitting = signal(false);

  onSubmit() {
    if (this.form.invalid) return;

    this.isSubmitting.set(true);

    this.service.submit(this.form.value).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        // Handle success
      },
      error: () => {
        this.isSubmitting.set(false);
        // Handle error
      },
    });
  }
}
```

### 14.2 Data Table with Loading State
```typescript
export class DataTableComponent implements OnInit {
  private service = inject(DataService);

  data = signal<DataType[]>([]);
  isLoading = signal(true);

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.isLoading.set(true);

    this.service.getData().subscribe({
      next: (data) => {
        this.data.set(data);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        // Error handling
      },
    });
  }
}
```

```html
<app-error-boundary [title]="'Data Loading Error'">
  @if (isLoading()) {
    <mat-spinner></mat-spinner>
  } @else {
    <table mat-table [dataSource]="data()">
      <!-- Table columns -->
    </table>
  }
</app-error-boundary>
```

### 14.3 Signal-Based Computed Values
```typescript
export class DashboardComponent {
  data = signal<DataItem[]>([]);
  filter = signal<string>('all');

  // Computed signal - automatically updates when dependencies change
  filteredData = computed(() => {
    const items = this.data();
    const filterValue = this.filter();

    if (filterValue === 'all') return items;

    return items.filter(item => item.status === filterValue);
  });

  itemCount = computed(() => this.filteredData().length);
}
```

---

## 15. Quick Reference Commands

### Development
```bash
npm start                # Start dev server (http://localhost:4200)
npm run watch            # Build and watch for changes
```

### Quality Checks
```bash
npm run lint             # Run ESLint
npm run lint:fix         # Auto-fix ESLint issues
npm run biome            # Run Biome checks
npm run biome:fix        # Auto-fix Biome issues
npm run format           # Format with Prettier + Biome
npm run format:check     # Check formatting
npm run validate         # Full validation (lint + biome + build)
```

### Build
```bash
npm run build            # Development build (with quality checks)
npm run build:prod       # Production build (with quality checks)
npm run build:stats      # Build with bundle analysis
npm run analyze          # Analyze bundle composition
```

### Testing
```bash
npm run test             # Run tests in watch mode
npm run test:coverage    # Run tests with coverage report
```

---

## 16. What AI Agents Should NEVER Do

### ❌ Forbidden Actions
1. **Never disable strict TypeScript mode** - This is non-negotiable
2. **Never remove quality checks** - All three tools (ESLint, Prettier, Biome) must pass
3. **Never create NgModules** - Use standalone components exclusively
4. **Never use constructor injection** - Use `inject()` function
5. **Never skip OnPush change detection** - Required for all components
6. **Never disable prebuild hooks** - Quality checks must run before builds
7. **Never use `any` type** - Use proper TypeScript types
8. **Never bypass Angular's sanitization** - Unless absolutely necessary and approved
9. **Never hardcode sensitive data** - Use environment variables
10. **Never remove lazy loading** - All routes must use `loadComponent()`
11. **Never modify M3 theme tokens** - Without design team approval
12. **Never change interceptor order** - `loadingInterceptor` must be first
13. **Never create separate index files per table** - Use consolidated `00-create-all-indexes.sql`
14. **Never relax bundle size budgets** - Without performance review
15. **Never skip accessibility attributes** - ARIA labels, roles, keyboard support required

---

## 17. When to Ask for Guidance

### 🤔 Situations Requiring Human Review
1. **Architecture changes** - Major refactoring, new patterns
2. **Security concerns** - Authentication, authorization, data handling
3. **Performance degradation** - Bundle size increase, slower builds
4. **Breaking changes** - API changes, dependency updates
5. **Accessibility uncertainty** - Complex ARIA patterns, screen reader support
6. **Design deviations** - Changes to M3 theme, visual design
7. **Testing gaps** - Missing test coverage, complex scenarios

---

## 18. Summary Checklist for AI Agents

**Before making ANY code change, verify:**

- [ ] TypeScript strict mode is enabled and code compiles without errors
- [ ] Component uses `ChangeDetectionStrategy.OnPush`
- [ ] Using `inject()` function (not constructor injection)
- [ ] Using signals for reactive state in components
- [ ] Route uses `loadComponent()` for lazy loading
- [ ] All quality checks pass (ESLint + Prettier + Biome)
- [ ] Bundle size is within budgets
- [ ] Component has JSDoc comments explaining purpose
- [ ] Accessibility attributes are present (ARIA labels, keyboard support)
- [ ] Error handling is implemented (try-catch, error boundaries)
- [ ] Material Design 3 tokens are used for styling
- [ ] No `any` types, no `@ts-ignore` without explanation
- [ ] Tests are written for new features
- [ ] Security best practices are followed
- [ ] Code follows naming conventions

---

## 19. Resources & References

### Official Documentation
- Angular: https://angular.dev/
- Material Design 3: https://m3.material.io/
- Angular Material: https://material.angular.io/
- RxJS: https://rxjs.dev/
- TypeScript: https://www.typescriptlang.org/

### Tartware-Specific
- Database Schema: `/home/navin/workspace/tartware/schema`
- Backend API: `/home/navin/workspace/tartware/Apps/core-service`
- Documentation: `/home/navin/workspace/tartware/docs`

### Quality Tools
- ESLint: https://eslint.org/
- Biome: https://biomejs.dev/
- Prettier: https://prettier.io/

---

## 20. Version History

| Date | Version | Changes |
|------|---------|---------|
| 2025-11-08 | 1.0 | Initial comprehensive guidelines based on Phase 1 & 2 implementation |

---

**Last Updated**: November 8, 2025
**Maintainer**: Tartware Development Team
**Status**: ACTIVE - These rules are enforced via CI/CD and code review
