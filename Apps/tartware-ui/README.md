# Tartware UI - Angular Frontend

Modern Angular 18 application for Tartware Property Management System (PMS) with Material Design 3, TypeScript strict mode, and comprehensive quality tooling.

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm start
# Navigate to http://localhost:4200/

# Run tests
npm test

# Build for production
npm run build:prod
```

---

## 📋 Available Scripts

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
npm run build:prod       # Production build (optimized)
npm run build:stats      # Build with bundle analysis
npm run analyze          # Analyze bundle composition
```

### Testing
```bash
npm run test             # Run tests in watch mode
npm run test:coverage    # Run tests with coverage report
```

---

## 🏗️ Project Structure

```
src/
├── app/
│   ├── core/                    # Singleton services, guards, interceptors
│   │   ├── guards/              # Auth & role guards
│   │   ├── interceptors/        # HTTP interceptors (auth, loading)
│   │   ├── services/            # Core services (auth, loading, error handling)
│   │   ├── models/              # TypeScript interfaces
│   │   └── components/          # Global components (status bar, error boundary)
│   ├── features/                # Feature modules (lazy loaded)
│   │   ├── auth/                # Authentication (login)
│   │   └── tenants/             # Tenant management
│   ├── shared/                  # Shared components, pipes, directives
│   │   ├── components/          # Reusable components
│   │   ├── pipes/               # Custom pipes
│   │   └── directives/          # Custom directives
│   ├── app.component.ts         # Root component
│   ├── app.routes.ts            # Route configuration (lazy loading)
│   └── app.config.ts            # Application configuration
├── styles/
│   ├── _m3-theme.scss          # Material Design 3 theme
│   ├── _variables.scss         # Design tokens (colors, spacing)
│   ├── _mixins.scss            # Reusable style patterns
│   ├── _utilities.scss         # Utility classes
│   ├── _material-overrides.scss # Material component customization
│   └── styles.scss             # Global styles
└── environments/                # Environment configs
    ├── environment.ts           # Development
    └── environment.prod.ts      # Production
```

---

## 🎨 Design System

### Material Design 3 (M3)
- **Theme**: Custom Indigo/Purple palette with light/dark mode
- **Design Tokens**: CSS custom properties with `--md-sys-` prefix
- **Components**: All Material components styled with M3 guidelines
- **Accessibility**: WCAG 2.1 AA compliant

### Color Palette
```scss
Primary: #4f46e5 (Indigo-600)
Success: #16a34a (Green-600)
Warning: #ca8a04 (Yellow-600)
Error:   #dc2626 (Red-600)
Info:    #2563eb (Blue-600)
```

### Key Features
- ✅ Lazy loading (37% bundle reduction: 761kB → 482kB)
- ✅ OnPush change detection strategy
- ✅ Angular Signals for reactive state
- ✅ Modern `inject()` dependency injection
- ✅ TypeScript strict mode
- ✅ Triple quality checks (ESLint + Prettier + Biome)
- ✅ Automated prebuild hooks
- ✅ HTTP interceptors (loading, auth)
- ✅ Error boundaries for graceful error handling
- ✅ VSCode-inspired status bar
- ✅ Dark mode support

---

## 🛠️ Tech Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| Angular | 18.2.0 | Framework (standalone components) |
| TypeScript | 5.5.2 | Language (strict mode) |
| Angular Material | 18.2.14 | UI components (M3 theme) |
| RxJS | 7.8.0 | Reactive programming |
| Tailwind CSS | 3.4.18 | Utility-first CSS |
| ESLint | 9.38.0 | Code linting |
| Prettier | 3.6.2 | Code formatting |
| Biome | 2.3.4 | Additional linting & formatting |

---

## 📖 Architecture Patterns

### Standalone Components
All components use standalone API (no NgModules):
```typescript
@Component({
  selector: 'app-my-component',
  standalone: true,
  imports: [CommonModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
```

### Modern Dependency Injection
Using `inject()` function instead of constructor injection:
```typescript
export class MyComponent {
  private myService = inject(MyService);
  private router = inject(Router);
}
```

### Signals for State Management
Reactive state with Angular Signals:
```typescript
export class MyComponent {
  data = signal<DataType[]>([]);
  isLoading = signal(false);
  itemCount = computed(() => this.data().length);
}
```

### Lazy Loading
All routes use `loadComponent()` for code splitting:
```typescript
{
  path: 'feature',
  loadComponent: () => import('./features/feature/feature.component')
    .then(m => m.FeatureComponent),
}
```

---

## 🔒 Security

- ✅ JWT authentication with HTTP-only cookies (when available)
- ✅ Auth guard for protected routes
- ✅ Role-based authorization
- ✅ XSS prevention (Angular's built-in sanitization)
- ✅ 401 auto-redirect to login
- ✅ Token refresh handling

---

## ♿ Accessibility

- ✅ WCAG 2.1 AA compliant
- ✅ ARIA labels on all interactive elements
- ✅ Keyboard navigation support (Tab, Enter, Space)
- ✅ Focus indicators visible
- ✅ Screen reader friendly
- ✅ High contrast mode support
- ✅ Reduced motion support

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Target: 80%+ code coverage
```

---

## 📦 Build & Bundle Size

### Bundle Budgets
- Initial: 500kB warning / 1MB error
- Component styles: 2kB warning / 4kB error

### Current Bundle Sizes (Production)
- **Initial**: 482kB (optimized with lazy loading)
- **Login**: 17.59kB (lazy chunk)
- **Tenant List**: 154.38kB (lazy chunk)

### Analysis
```bash
npm run analyze  # Opens webpack-bundle-analyzer
```

---

## 🎯 Code Quality Standards

### Triple Quality Check System
1. **ESLint** - Angular-specific rules, accessibility
2. **Prettier** - Code formatting consistency
3. **Biome** - Additional linting, complexity analysis

All checks run automatically before every build via prebuild hooks.

### TypeScript Configuration
- ✅ Strict mode enabled
- ✅ Extended diagnostics enabled
- ✅ No implicit any
- ✅ No property access from index signature
- ✅ No implicit returns
- ✅ No fallthrough cases in switch

---

## 🌍 Environment Configuration

### Development
```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
  enableDebugTools: true,
  logLevel: 'debug',
};
```

### Production
```typescript
export const environment = {
  production: true,
  apiUrl: 'https://api.tartware.com',
  enableDebugTools: false,
  logLevel: 'error',
};
```

---

## 🤝 Contributing

### Code Style
- Follow the [Angular Style Guide](https://angular.dev/style-guide)
- Use **OnPush change detection** for all components
- Use **signals** for reactive state in components
- Use **inject()** function for dependency injection
- Write **JSDoc comments** for public APIs
- Add **unit tests** for new features (80%+ coverage target)

### Commit Messages (Conventional Commits)
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

### Pull Request Checklist
- [ ] Run `npm run validate` (all checks pass)
- [ ] Run `npm test` (all tests pass)
- [ ] Bundle size within budgets (`npm run analyze`)
- [ ] Update documentation if needed
- [ ] Add tests for new features

---

## 📚 Additional Documentation

- **[Copilot Instructions](/.github/copilot-instructions.md)** - Hard rules for AI coding agents
- **[Theme Quick Reference](/docs/THEME_QUICK_REFERENCE.md)** - Design system usage guide
- **[M3 Quick Reference](/docs/M3_QUICK_REFERENCE.md)** - Material Design 3 patterns

---

## 🐛 Troubleshooting

### Build Fails
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json .angular
npm install
```

### Tests Fail
```bash
# Clear test cache
npm test -- --no-cache
```

### Linting Errors
```bash
# Auto-fix most issues
npm run lint:fix
npm run biome:fix
npm run format
```

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/red2n/tartware/issues)
- **Documentation**: [Tartware Docs](/docs)
- **Email**: support@tartware.com

---

## 📄 License

Copyright © 2025 Tartware. All rights reserved.
