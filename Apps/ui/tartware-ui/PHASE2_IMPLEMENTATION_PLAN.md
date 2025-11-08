# Phase 2 Implementation Plan - Angular Best Practices

## Overview
This document outlines Phase 2 improvements focusing on lazy loading, performance optimization, and comprehensive Angular error/diagnostic monitoring.

**Prerequisites**: Phase 1 Complete ✅
**Target Completion**: Q1 2025
**Priority**: High

---

## Critical Angular Resources Integration

### 🔴 Always Check Before Implementation

Before implementing ANY UI functionality, consult these official resources:

#### 1. Angular Errors Reference
**URL**: https://angular.dev/errors
**Purpose**: Understand and prevent common Angular errors
**Usage**:
- Check error codes before debugging
- Implement preventive measures for common errors
- Reference during code reviews

#### 2. Angular API Documentation
**URL**: https://angular.dev/api
**Purpose**: Official API documentation for all Angular packages
**Usage**:
- Verify correct API usage
- Check for deprecated methods
- Find recommended patterns
- Review TypeScript signatures

#### 3. Angular Extended Diagnostics
**URL**: https://angular.dev/extended-diagnostics
**Purpose**: Catch common Angular template mistakes at build time
**Usage**:
- Enable all recommended diagnostics
- Fix warnings proactively
- Prevent runtime template errors

#### 4. Material Design 3 (M3) Components
**URL**: https://m3.material.io/components
**Purpose**: Modern design system with improved accessibility and theming
**Usage**:
- Reference for all UI component implementations
- Ensure design consistency across the app
- Follow M3 accessibility guidelines
- Implement dynamic color theming
- Use M3 design tokens for styling

---

## Phase 2 Roadmap

### Priority 1: Extended Diagnostics & Error Prevention ⚡

#### A. Enable Extended Diagnostics ✅ COMPLETE
```jsonc
// tsconfig.json - angularCompilerOptions
"extendedDiagnostics": {
  "checks": {
    "invalidBananaInBox": "error",           // [()] syntax errors
    "nullishCoalescingNotNullable": "warning", // Unnecessary ??
    "optionalChainNotNullable": "warning",   // Unnecessary ?.
    "textAttributeNotBinding": "warning"     // Missing [] or ()
  },
  "defaultCategory": "warning"
}
```

#### B. Implement Error Monitoring
- [ ] **Add error boundary component**
  - Catch and display template errors gracefully
  - Log errors to console in dev mode
  - Report errors to monitoring service in prod

- [ ] **Create error logging service**
  - Integrate with backend logging API
  - Add client-side error tracking
  - Implement error reporting UI

- [ ] **Add runtime error handlers**
  - Global error handler for uncaught exceptions
  - HTTP error interceptor (already done ✅)
  - Router error handling

#### C. Template Error Prevention
- [ ] **Audit all templates for common errors**
  - Check for banana-in-box errors: `([ngModel])` should be `[(ngModel)]`
  - Verify event binding syntax: `(click)` not `onclick`
  - Validate property binding syntax: `[value]` not `value=""`
  - Check structural directives: `*ngIf`, `*ngFor`, `*ngSwitch`

- [ ] **Add template linting rules**
  - Configure ESLint template rules
  - Add custom template validators
  - Enforce template best practices

#### D. API Usage Validation
- [ ] **Audit all Angular API usage**
  - Check for deprecated APIs (consult https://angular.dev/api)
  - Verify correct method signatures
  - Update to latest API recommendations
  - Document any intentional legacy usage

---

### Priority 2: Material Design 3 (M3) Theme Implementation 🎨

#### A. Material Design 3 Integration
**Reference**: https://m3.material.io/components

Material Design 3 is Google's latest design system with improved accessibility, dynamic theming, and modern components.

##### Current State:
- ✅ Angular Material 18.2.14 installed
- ⚠️ Using default Material Design 2 theme
- 🎯 Need to migrate to Material Design 3

##### Implementation Steps:

**1. Update Angular Material Theme**
```scss
// src/styles.scss
@use '@angular/material' as mat;

// Include M3 theme
@include mat.core();

// Define M3 color palette
$tartware-primary: mat.define-palette(mat.$azure-palette);
$tartware-accent: mat.define-palette(mat.$blue-palette);
$tartware-warn: mat.define-palette(mat.$red-palette);

// Create M3 theme
$tartware-theme: mat.define-theme((
  color: (
    theme-type: light,
    primary: $tartware-primary,
    tertiary: $tartware-accent,
  ),
  typography: (
    brand-family: 'Roboto, sans-serif',
    plain-family: 'Roboto, sans-serif',
  ),
  density: (
    scale: 0
  )
));

// Apply M3 theme
@include mat.all-component-themes($tartware-theme);

// Dark theme support
.dark-theme {
  $dark-theme: mat.define-theme((
    color: (
      theme-type: dark,
      primary: $tartware-primary,
      tertiary: $tartware-accent,
    )
  ));

  @include mat.all-component-colors($dark-theme);
}
```

**2. M3 Component Checklist**
Reference: https://m3.material.io/components for each component

- [ ] **Buttons** (https://m3.material.io/components/buttons)
  - Elevated Button (primary actions)
  - Filled Button (high-emphasis actions)
  - Tonal Button (medium-emphasis actions)
  - Outlined Button (low-emphasis actions)
  - Text Button (minimal actions)

- [ ] **Cards** (https://m3.material.io/components/cards)
  - Elevated cards
  - Filled cards
  - Outlined cards

- [ ] **Dialogs** (https://m3.material.io/components/dialogs)
  - Basic dialogs
  - Full-screen dialogs
  - Alert dialogs

- [ ] **Lists** (https://m3.material.io/components/lists)
  - Single-line lists
  - Two-line lists
  - Three-line lists

- [ ] **Navigation** (https://m3.material.io/components/navigation-bar)
  - Navigation bar
  - Navigation drawer
  - Navigation rail
  - Top app bar

- [ ] **Text Fields** (https://m3.material.io/components/text-fields)
  - Filled text fields
  - Outlined text fields

- [ ] **Chips** (https://m3.material.io/components/chips)
  - Assist chips
  - Filter chips
  - Input chips
  - Suggestion chips

**3. M3 Design Tokens**
```scss
// src/theme/design-tokens.scss
// Based on https://m3.material.io/foundations/design-tokens

:root {
  // Surface colors
  --md-sys-color-surface: #fef7ff;
  --md-sys-color-surface-variant: #e7e0ec;
  --md-sys-color-on-surface: #1d1b20;
  --md-sys-color-on-surface-variant: #49454f;

  // Primary colors
  --md-sys-color-primary: #6750a4;
  --md-sys-color-on-primary: #ffffff;
  --md-sys-color-primary-container: #eaddff;
  --md-sys-color-on-primary-container: #21005d;

  // Secondary colors
  --md-sys-color-secondary: #625b71;
  --md-sys-color-on-secondary: #ffffff;
  --md-sys-color-secondary-container: #e8def8;
  --md-sys-color-on-secondary-container: #1d192b;

  // Tertiary colors
  --md-sys-color-tertiary: #7d5260;
  --md-sys-color-on-tertiary: #ffffff;
  --md-sys-color-tertiary-container: #ffd8e4;
  --md-sys-color-on-tertiary-container: #31111d;

  // Error colors
  --md-sys-color-error: #b3261e;
  --md-sys-color-on-error: #ffffff;
  --md-sys-color-error-container: #f9dedc;
  --md-sys-color-on-error-container: #410e0b;

  // Elevation
  --md-sys-elevation-level0: 0dp;
  --md-sys-elevation-level1: 1dp;
  --md-sys-elevation-level2: 3dp;
  --md-sys-elevation-level3: 6dp;
  --md-sys-elevation-level4: 8dp;
  --md-sys-elevation-level5: 12dp;

  // Typography
  --md-sys-typescale-display-large-size: 57px;
  --md-sys-typescale-display-medium-size: 45px;
  --md-sys-typescale-display-small-size: 36px;
  --md-sys-typescale-headline-large-size: 32px;
  --md-sys-typescale-headline-medium-size: 28px;
  --md-sys-typescale-headline-small-size: 24px;
  --md-sys-typescale-body-large-size: 16px;
  --md-sys-typescale-body-medium-size: 14px;
  --md-sys-typescale-body-small-size: 12px;

  // Shape
  --md-sys-shape-corner-none: 0px;
  --md-sys-shape-corner-extra-small: 4px;
  --md-sys-shape-corner-small: 8px;
  --md-sys-shape-corner-medium: 12px;
  --md-sys-shape-corner-large: 16px;
  --md-sys-shape-corner-extra-large: 28px;
}
```

**4. Component Migration Guide**
```typescript
// Example: Migrating buttons to M3 patterns

// BEFORE (M2 style)
<button mat-raised-button color="primary">Action</button>

// AFTER (M3 style - Filled Button)
<button mat-flat-button color="primary" class="m3-filled-button">
  Action
</button>

// M3 Elevated Button
<button mat-raised-button class="m3-elevated-button">
  Action
</button>

// M3 Tonal Button
<button mat-flat-button class="m3-tonal-button">
  Action
</button>
```

**5. Accessibility Requirements (M3 Standards)**
- [ ] Color contrast ratios: WCAG AAA (7:1 for normal text)
- [ ] Touch targets: Minimum 48x48dp
- [ ] Focus indicators: Visible and clear
- [ ] Screen reader support: ARIA labels
- [ ] Keyboard navigation: Full support
- [ ] Motion reduction: Respect prefers-reduced-motion

**6. Dynamic Color Support**
```typescript
// service for dynamic theming
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private isDark = signal(false);

  toggleTheme() {
    this.isDark.update(v => !v);
    document.body.classList.toggle('dark-theme');
  }

  applyUserPreference() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
      this.isDark.set(true);
      document.body.classList.add('dark-theme');
    }
  }
}
```

**7. M3 Component Library Setup**
- [ ] Create shared M3 component library
- [ ] Document all M3 patterns used
- [ ] Create Storybook for M3 components
- [ ] Add visual regression tests

---

### Priority 3: Lazy Loading Implementation 🚀

#### A. Feature Module Lazy Loading
```typescript
// app.routes.ts
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component')
      .then(m => m.LoginComponent)
  },
  {
    path: 'tenants',
    loadComponent: () => import('./features/tenants/tenant-list.component')
      .then(m => m.TenantListComponent),
    canActivate: [authGuard]
  },
  // Future feature modules
  {
    path: 'bookings',
    loadChildren: () => import('./features/bookings/bookings.routes')
      .then(m => m.BOOKINGS_ROUTES)
  },
  {
    path: 'inventory',
    loadChildren: () => import('./features/inventory/inventory.routes')
      .then(m => m.INVENTORY_ROUTES)
  }
];
```

#### B. Component-Level Code Splitting
- [ ] **Split large components**
  - Lazy load modal dialogs
  - Lazy load data tables
  - Lazy load charts and visualizations

- [ ] **Defer non-critical components**
  - Use `@defer` blocks for below-fold content
  - Implement placeholder components
  - Add loading skeletons

#### C. Service Lazy Loading
- [ ] **Lazy load heavy services**
  - Analytics services
  - Reporting services
  - Export/import services

#### D. Bundle Analysis
- [ ] **Analyze current bundle**
  ```bash
  npm run build -- --stats-json
  npx webpack-bundle-analyzer dist/tartware-ui/stats.json
  ```

- [ ] **Identify large dependencies**
  - Check Angular Material component usage
  - Audit third-party libraries
  - Remove unused dependencies

- [ ] **Set bundle budgets**
  ```json
  "budgets": [
    {
      "type": "initial",
      "maximumWarning": "300kB",
      "maximumError": "500kB"
    },
    {
      "type": "anyComponentStyle",
      "maximumWarning": "2kB",
      "maximumError": "4kB"
    }
  ]
  ```

---

### Priority 3: Performance Optimization 🎯

#### A. Change Detection Strategy
- [ ] **Implement OnPush change detection**
  ```typescript
  @Component({
    selector: 'app-tenant-list',
    changeDetection: ChangeDetectionStrategy.OnPush,
    // ...
  })
  ```

- [ ] **Audit components for OnPush compatibility**
  - Use signals for reactive state
  - Use immutable data patterns
  - Minimize @Input() mutations

#### B. Virtual Scrolling
- [ ] **Add virtual scrolling for large lists**
  ```typescript
  import { ScrollingModule } from '@angular/cdk/scrolling';

  <cdk-virtual-scroll-viewport itemSize="50" class="viewport">
    <div *cdkVirtualFor="let item of items">{{item}}</div>
  </cdk-virtual-scroll-viewport>
  ```

#### C. Image Optimization
- [ ] **Use NgOptimizedImage directive**
  ```typescript
  import { NgOptimizedImage } from '@angular/common';

  <img ngSrc="image.jpg" width="400" height="300" priority>
  ```

- [ ] **Implement lazy image loading**
- [ ] **Add image compression pipeline**
- [ ] **Use responsive images with srcset**

#### D. Angular Performance APIs
- [ ] **Implement performance monitoring**
  - Check https://angular.dev/api/core for performance APIs
  - Use `NgZone` for performance-critical code
  - Monitor change detection cycles
  - Track component render times

---

### Priority 4: Testing Implementation 🧪

#### A. Unit Tests
- [ ] **Services**
  - AuthService with all methods
  - TenantService HTTP calls
  - ErrorHandlerService error scenarios
  - LoadingService state management

- [ ] **Components**
  - LoginComponent form validation
  - TenantListComponent data display
  - Error boundary component

- [ ] **Guards & Interceptors**
  - authGuard authorization logic
  - roleGuard role checking
  - authInterceptor token injection

#### B. Component Testing
- [ ] **Angular Testing Library**
  ```typescript
  import { render, screen, fireEvent } from '@testing-library/angular';

  test('login form submits correctly', async () => {
    await render(LoginComponent);
    const input = screen.getByLabelText('Username');
    const button = screen.getByRole('button', { name: /login/i });

    await fireEvent.input(input, { target: { value: 'testuser' } });
    await fireEvent.click(button);

    expect(screen.getByText(/welcome/i)).toBeInTheDocument();
  });
  ```

#### C. E2E Tests
- [ ] **Critical user flows**
  - Login → Tenant list
  - Create booking
  - Update inventory

- [ ] **Setup Playwright or Cypress**
  ```bash
  # Playwright (recommended by Angular team)
  npm install -D @playwright/test
  npx playwright install
  ```

#### D. Test Coverage
- [ ] **Set coverage targets**
  - Services: 90%+
  - Components: 80%+
  - Guards/Interceptors: 100%

- [ ] **Add coverage reports**
  ```json
  // karma.conf.js
  coverageReporter: {
    type: 'html',
    dir: require('path').join(__dirname, './coverage'),
    subdir: '.',
    reporters: [
      { type: 'html' },
      { type: 'text-summary' },
      { type: 'lcovonly' }
    ]
  }
  ```

---

### Priority 5: Advanced Error Handling 🛡️

#### A. Template Error Boundaries
```typescript
// error-boundary.component.ts
@Component({
  selector: 'app-error-boundary',
  template: `
    @if (hasError()) {
      <div class="error-container">
        <h2>Something went wrong</h2>
        <p>{{ errorMessage() }}</p>
        <button (click)="retry()">Retry</button>
      </div>
    } @else {
      <ng-content></ng-content>
    }
  `
})
export class ErrorBoundaryComponent {
  hasError = signal(false);
  errorMessage = signal('');

  // Error catching logic
}
```

#### B. Error Recovery Strategies
- [ ] **Implement retry logic**
  - Exponential backoff for HTTP failures
  - Manual retry buttons in UI
  - Automatic retry for network errors

- [ ] **Graceful degradation**
  - Show cached data when offline
  - Display fallback UI for failed components
  - Partial page loading on errors

#### C. Error Reporting Integration
- [ ] **Add error tracking service** (Sentry, LogRocket, etc.)
  ```typescript
  // main.ts
  if (environment.production) {
    Sentry.init({
      dsn: environment.sentryDsn,
      integrations: [
        new Sentry.BrowserTracing(),
        new Sentry.Replay()
      ],
      tracesSampleRate: 1.0,
    });
  }
  ```

---

### Priority 6: Angular API Best Practices 📚

#### A. Regular API Audits
- [ ] **Monthly API review**
  - Check https://angular.dev/api for updates
  - Review deprecation notices
  - Plan migration for deprecated features

- [ ] **Document API usage**
  - Create internal API usage guide
  - Document deviations from standards
  - Maintain changelog for API updates

#### B. TypeScript & Angular Version Updates
- [ ] **Stay current with Angular releases**
  - Monitor https://angular.dev/guide/releases
  - Plan quarterly update cycles
  - Test updates in staging environment

- [ ] **Update dependencies**
  ```bash
  ng update @angular/cli @angular/core
  npm outdated
  npm update
  ```

#### C. API Pattern Enforcement
- [ ] **Create code snippets for common patterns**
  - Component boilerplate
  - Service patterns
  - Guard templates
  - Interceptor templates

- [ ] **Add ESLint custom rules**
  - Enforce inject() over constructor injection
  - Require OnPush where applicable
  - Validate signal usage patterns

---

## Implementation Checklist

### Week 1-2: Diagnostics & Error Prevention
- [x] Enable extended diagnostics in tsconfig.json
- [ ] Audit all templates for errors
- [ ] Create error boundary component
- [ ] Add error logging service
- [ ] Test all error scenarios

### Week 3-4: Lazy Loading
- [ ] Implement route-level lazy loading
- [ ] Add component-level code splitting
- [ ] Analyze bundle sizes
- [ ] Optimize bundle budgets
- [ ] Document loading strategies

### Week 5-6: Performance Optimization
- [ ] Implement OnPush change detection
- [ ] Add virtual scrolling
- [ ] Optimize images with NgOptimizedImage
- [ ] Add performance monitoring
- [ ] Run Lighthouse audits

### Week 7-8: Testing
- [ ] Write unit tests for all services
- [ ] Add component tests
- [ ] Implement E2E tests
- [ ] Set up CI/CD test pipeline
- [ ] Generate coverage reports

### Week 9-10: Advanced Features
- [ ] Error tracking integration
- [ ] Performance monitoring dashboard
- [ ] Documentation updates
- [ ] Developer guidelines
- [ ] Code review checklist

---

## Success Metrics

### Performance Targets
- Initial bundle size: < 300kB (currently 761kB)
- Lazy loaded routes: 100%
- First Contentful Paint: < 1.5s
- Time to Interactive: < 3.5s
- Lighthouse score: > 90

### Quality Targets
- Unit test coverage: > 80%
- E2E test coverage: Critical paths 100%
- Zero template errors with extended diagnostics
- Zero deprecated API usage
- All builds pass with no warnings

### Developer Experience
- Build time: < 5s for dev
- Lint time: < 3s
- Test execution: < 30s for unit tests
- Clear error messages for all failures
- Comprehensive documentation

---

## Resources & References

### Angular Official Documentation
1. **Errors**: https://angular.dev/errors
2. **API**: https://angular.dev/api
3. **Extended Diagnostics**: https://angular.dev/extended-diagnostics
4. **Performance**: https://angular.dev/guide/performance
5. **Testing**: https://angular.dev/guide/testing
6. **Lazy Loading**: https://angular.dev/guide/lazy-loading-ngmodules

### Material Design 3
1. **Components**: https://m3.material.io/components
2. **Foundations**: https://m3.material.io/foundations
3. **Styles**: https://m3.material.io/styles
4. **Design Tokens**: https://m3.material.io/foundations/design-tokens
5. **Accessibility**: https://m3.material.io/foundations/accessible-design
6. **Color System**: https://m3.material.io/styles/color/system

### Tools & Libraries
- **Bundle Analyzer**: webpack-bundle-analyzer
- **Testing**: @angular/testing, @testing-library/angular
- **E2E**: Playwright, Cypress
- **Performance**: Lighthouse, Web Vitals
- **Error Tracking**: Sentry, LogRocket

### Best Practice Guides
- Angular Style Guide: https://angular.dev/style-guide
- RxJS Best Practices: https://rxjs.dev/guide/overview
- TypeScript Handbook: https://www.typescriptlang.org/docs/

---

## Developer Workflow Integration

### Pre-Implementation Checklist
Before starting any new feature:
1. ✅ Check https://angular.dev/api for API usage
2. ✅ Review https://angular.dev/errors for common pitfalls
3. ✅ Verify https://angular.dev/extended-diagnostics are enabled
4. ✅ Consult https://m3.material.io/components for UI components
5. ✅ Run `npm run lint` to check for issues
6. ✅ Write tests alongside implementation
7. ✅ Update documentation

### Code Review Checklist
- [ ] All Angular APIs used correctly (verify with docs)
- [ ] No extended diagnostic warnings
- [ ] Lazy loading used where appropriate
- [ ] OnPush change detection considered
- [ ] Unit tests included
- [ ] Performance impact assessed
- [ ] Error handling implemented
- [ ] Documentation updated

---

## Continuous Improvement

### Monthly Tasks
- Review Angular changelog for updates
- Check for new extended diagnostic checks
- Audit bundle sizes
- Review error logs
- Update dependencies
- Run performance audits

### Quarterly Tasks
- Plan Angular version upgrades
- Review and update best practices
- Conduct performance optimization sprint
- Update developer documentation
- Training on new Angular features

---

## Getting Started with Phase 2

To begin Phase 2 implementation:

```bash
# 1. Verify Phase 1 is complete
npm run lint
npm run build

# 2. Enable extended diagnostics (already done ✅)
# Check tsconfig.json - angularCompilerOptions

# 3. Run diagnostic check
npm run build -- --configuration production

# 4. Start with lazy loading
# Begin implementing route-level lazy loading

# 5. Set up testing infrastructure
npm install -D @testing-library/angular
npm install -D @playwright/test

# 6. Monitor progress
# Use this document to track implementation
```

---

## Questions & Support

**Need Help?**
1. Check official Angular docs first: https://angular.dev
2. Review error reference: https://angular.dev/errors
3. Consult API documentation: https://angular.dev/api
4. Check extended diagnostics: https://angular.dev/extended-diagnostics

**Found an Issue?**
- Document in project issues
- Reference Angular error codes
- Include diagnostic output
- Provide minimal reproduction

---

**Next Steps**: Review this plan with the team and prioritize items based on business needs. Focus on lazy loading and error prevention first for immediate impact.
