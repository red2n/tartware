# Tartware Theme Quick Reference

## 🎨 Colors

### Primary (Indigo)
```scss
$primary-600   // #4f46e5 - Main brand
$primary-700   // #4338ca - Hover state
```

### Grays
```scss
$gray-50       // #f9fafb - Page background
$gray-200      // #e5e7eb - Borders
$gray-600      // #6b7280 - Secondary text
$gray-900      // #111827 - Primary text
```

### Semantic
```scss
$success-600   // #16a34a - Success
$warning-600   // #ca8a04 - Warning
$error-600     // #dc2626 - Error
$info-600      // #2563eb - Info
```

## 📐 Spacing

```scss
$spacing-xs    // 8px
$spacing-sm    // 12px
$spacing-md    // 16px
$spacing-lg    // 24px
$spacing-xl    // 32px
$spacing-2xl   // 48px
```

## 🔤 Typography

```scss
$font-size-sm     // 14px
$font-size-base   // 16px
$font-size-lg     // 18px
$font-size-2xl    // 24px
$font-size-3xl    // 32px

$font-weight-medium    // 500
$font-weight-semibold  // 600
```

## 📦 Common Mixins

### Cards
```scss
@include card-base;      // White card with shadow
@include card-hover;     // Hover effect
```

### Buttons
```scss
@include button-primary;    // Indigo button
@include button-secondary;  // White button
@include button-text;       // Text-only button
```

### Badges
```scss
@include badge-primary;    // Indigo badge
@include badge-success;    // Green badge
@include badge-warning;    // Yellow badge
@include badge-error;      // Red badge
@include badge-neutral;    // Gray badge
```

### Alerts
```scss
@include alert-info;       // Blue alert
@include alert-success;    // Green alert
@include alert-warning;    // Yellow alert
@include alert-error;      // Red alert
```

### Page Layout
```scss
@include page-container;   // Full page with gray background
@include page-header;      // Page title section
```

### Tables
```scss
@include table-container;  // Table wrapper
@include table-header;     // Table header row
@include table-row-hover;  // Row hover effect
```

### Responsive
```scss
@include mobile { }    // max-width: 768px
@include tablet { }    // 769px - 1024px
@include desktop { }   // min-width: 1025px
```

## 🛠️ Utility Classes

### Flexbox
```html
<div class="flex-center">Centered</div>
<div class="flex-between">Space between</div>
<div class="flex-column">Vertical</div>
```

### Text
```html
<p class="text-primary">Primary color</p>
<p class="text-muted">Muted text</p>
<p class="text-truncate">Truncated...</p>
```

### Backgrounds
```html
<div class="bg-page">Page background</div>
<div class="bg-card">Card background</div>
```

### Borders
```html
<div class="border-light">Light border</div>
<div class="border-radius-md">Rounded</div>
```

### Shadows
```html
<div class="shadow-sm">Small shadow</div>
<div class="shadow-md">Medium shadow</div>
```

### Loading
```html
<div class="spinner"></div>
<div class="spinner spinner-lg"></div>
```

## 📋 Component Template

```scss
@import '../../../styles/variables';
@import '../../../styles/mixins';

.my-card {
  @include card-base;
  @include card-hover;
}

.my-button {
  @include button-primary;
}

.my-badge {
  @include badge-success;
}
```

## ✨ Best Practices

1. ✅ Use variables, not hardcoded values
2. ✅ Use mixins for common patterns
3. ✅ Use utility classes in HTML when possible
4. ✅ Follow responsive design with mixins
5. ❌ Don't create custom colors
6. ❌ Don't hardcode spacing values
7. ❌ Don't use gradients (keep it professional)

## 🔗 Full Documentation

See `THEME_SYSTEM.md` for complete documentation.
