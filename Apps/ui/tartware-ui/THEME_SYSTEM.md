# Tartware Professional Theme System

A centralized, enterprise-grade design system for the Tartware PMS Angular application.

## Overview

This theme system provides a consistent, professional look and feel across the entire application with reusable styles, variables, and components.

## Structure

```
src/styles/
├── _variables.scss          # Design tokens (colors, spacing, typography)
├── _mixins.scss            # Reusable style patterns
├── _utilities.scss         # Utility classes
└── _material-overrides.scss # Angular Material customizations
```

## Color Palette

### Primary (Indigo)
- **Brand Color**: `$primary-600` (#4f46e5) - Main brand color used for CTAs, links
- Light variations: `$primary-50` through `$primary-500`
- Dark variations: `$primary-700` through `$primary-900`

### Neutral (Gray)
- **Background**: `$gray-50` (#f9fafb) - Page backgrounds
- **Text**: `$gray-900` (#111827) - Primary text
- **Borders**: `$gray-200` (#e5e7eb) - Borders and dividers

### Semantic Colors
- **Success**: `$success-600` (#16a34a)
- **Warning**: `$warning-600` (#ca8a04)
- **Error**: `$error-600` (#dc2626)
- **Info**: `$info-600` (#2563eb)

## Usage

### 1. Using Variables in SCSS

```scss
@import '../../../styles/variables';
@import '../../../styles/mixins';

.my-component {
  background: $gray-50;
  color: $gray-900;
  border: 1px solid $gray-200;
  border-radius: $radius-md;
  padding: $spacing-lg;
}
```

### 2. Using Mixins

```scss
// Card with default styling
.card {
  @include card-base;
  @include card-hover;
}

// Primary button
.action-button {
  @include button-primary;
}

// Alert message
.info-message {
  @include alert-info;
}

// Page layout
.page {
  @include page-container;
}
```

### 3. Using Utility Classes (HTML)

```html
<!-- Flexbox utilities -->
<div class="flex-between gap-md">
  <h2>Title</h2>
  <button>Action</button>
</div>

<!-- Text utilities -->
<p class="text-primary">Primary text</p>
<p class="text-muted">Muted text</p>

<!-- Background utilities -->
<div class="bg-page">Page background</div>
<div class="bg-card">Card background</div>

<!-- Border utilities -->
<div class="border-light border-radius-md">Bordered box</div>

<!-- Shadow utilities -->
<div class="shadow-md">Card with shadow</div>
```

### 4. Using Tailwind Classes (HTML)

Tailwind is configured with our color palette:

```html
<!-- Backgrounds -->
<div class="bg-gray-50">Page background</div>
<div class="bg-primary-600">Brand background</div>

<!-- Text colors -->
<p class="text-gray-900">Primary text</p>
<p class="text-primary-600">Brand text</p>

<!-- Borders -->
<div class="border border-gray-200 rounded-lg">Bordered element</div>

<!-- Spacing -->
<div class="p-6 mb-4">Padded element</div>
```

## Common Patterns

### Card Component
```scss
.card {
  @include card-base;
  @include card-hover;
}
```

### Button Variants
```scss
// Primary action button
.btn-primary {
  @include button-primary;
}

// Secondary button
.btn-secondary {
  @include button-secondary;
}

// Text button (no background)
.btn-text {
  @include button-text;
}
```

### Status Badges
```scss
.badge-active {
  @include badge-success;
}

.badge-inactive {
  @include badge-neutral;
}

.badge-pending {
  @include badge-warning;
}
```

### Form Inputs
```scss
input, textarea, select {
  @include input-base;
}
```

### Alerts
```scss
.alert-success { @include alert-success; }
.alert-error { @include alert-error; }
.alert-warning { @include alert-warning; }
.alert-info { @include alert-info; }
```

### Page Layout
```scss
.page-container {
  @include page-container;

  .page-header {
    @include page-header;
  }
}
```

### Table Styling
```scss
.data-table {
  @include table-container;

  thead {
    @include table-header;
  }

  tbody tr {
    @include table-row-hover;
  }
}
```

## Spacing System

- `$spacing-xs`: 8px - Tight spacing
- `$spacing-sm`: 12px - Small spacing
- `$spacing-md`: 16px - Default spacing
- `$spacing-lg`: 24px - Large spacing
- `$spacing-xl`: 32px - Extra large spacing
- `$spacing-2xl`: 48px - Section spacing

## Typography

### Font Sizes
- `$font-size-xs`: 12px
- `$font-size-sm`: 14px
- `$font-size-md`: 15.2px
- `$font-size-base`: 16px
- `$font-size-lg`: 18px
- `$font-size-xl`: 20px
- `$font-size-2xl`: 24px
- `$font-size-3xl`: 32px

### Font Weights
- `$font-weight-normal`: 400
- `$font-weight-medium`: 500
- `$font-weight-semibold`: 600
- `$font-weight-bold`: 700

## Border Radius

- `$radius-sm`: 6px - Small elements
- `$radius-md`: 8px - Buttons, inputs
- `$radius-lg`: 12px - Cards, modals
- `$radius-xl`: 16px - Large containers

## Shadows

- `$shadow-sm`: Subtle shadow for small elements
- `$shadow-md`: Default card shadow
- `$shadow-lg`: Elevated elements (dropdowns, menus)
- `$shadow-xl`: Modals and overlays

## Transitions

- `$transition-fast`: 0.15s - Micro-interactions
- `$transition-base`: 0.2s - Default transitions
- `$transition-slow`: 0.3s - Complex animations

## Animations

### Loading Spinner
```html
<div class="spinner"></div>
<div class="spinner spinner-lg"></div>
```

### Slide In (for alerts)
```html
<div class="alert slide-in">Alert message</div>
```

### Fade
```html
<div class="fade-in">Fading in</div>
```

## Responsive Design

Use mixins for responsive breakpoints:

```scss
.component {
  padding: $spacing-xl;

  @include mobile {
    padding: $spacing-md;
  }

  @include tablet {
    padding: $spacing-lg;
  }
}
```

## Angular Material Customization

All Material components are automatically styled to match the theme. No additional configuration needed.

### Customized Components
- Cards
- Buttons
- Form fields
- Tables
- Dialogs
- Snackbars
- Menus
- Chips
- Tabs
- Tooltips
- Selects

### Example
```html
<!-- Material button automatically styled -->
<button mat-raised-button color="primary">Submit</button>

<!-- Material card automatically styled -->
<mat-card>Card content</mat-card>
```

## Best Practices

1. **Always use variables** - Never hardcode colors or spacing values
2. **Use mixins for common patterns** - Ensures consistency
3. **Leverage utility classes** - For simple styling needs
4. **Combine Tailwind + custom styles** - Use Tailwind for layout, custom styles for brand-specific components
5. **Keep components clean** - Move reusable styles to mixins
6. **Follow the color system** - Don't introduce new colors without updating the palette

## Migration from Old Styles

### Before (component-specific gradients)
```scss
.login-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  backdrop-filter: blur(20px);
  border-radius: 24px;
}
```

### After (using theme system)
```scss
@import '../../../styles/mixins';

.login-card {
  @include card-base;
}
```

## Adding New Components

When creating new components:

1. Import theme files at the top of your SCSS:
```scss
@import '../../../styles/variables';
@import '../../../styles/mixins';
```

2. Use mixins and variables instead of hardcoding:
```scss
.my-component {
  background: $gray-50;        // Not #f9fafb
  padding: $spacing-lg;         // Not 1.5rem
  border-radius: $radius-md;    // Not 8px
  box-shadow: $shadow-md;       // Not 0 4px 6px...
}
```

3. For common patterns, use existing mixins:
```scss
.my-button {
  @include button-primary;
}
```

## Extending the Theme

### Adding New Colors
Edit `src/styles/_variables.scss`:
```scss
$custom-color: #your-color;
```

### Adding New Mixins
Edit `src/styles/_mixins.scss`:
```scss
@mixin my-pattern {
  // Your styles
}
```

### Adding New Utilities
Edit `src/styles/_utilities.scss`:
```scss
.my-utility {
  // Your styles
}
```

## Support

For questions or issues with the theme system, refer to this documentation or contact the development team.
