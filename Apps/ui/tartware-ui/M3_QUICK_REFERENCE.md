# Material Design 3 (M3) Quick Reference Guide

## Overview
This guide provides quick reference for implementing Material Design 3 components in the Tartware UI Angular application.

**Official Documentation**: https://m3.material.io/components
**Angular Material Version**: 18.2.14
**Last Updated**: November 2025

---

## M3 Core Principles

### 1. **Expressive** - Personalized and adaptive designs
### 2. **Adaptable** - Dynamic color and responsive layouts
### 3. **Accessible** - WCAG AAA standards, inclusive design

---

## Common Components Reference

### 🔘 Buttons
**Reference**: https://m3.material.io/components/buttons

#### Types:
```html
<!-- Elevated Button (default) -->
<button mat-raised-button>Elevated</button>

<!-- Filled Button (high emphasis) -->
<button mat-flat-button color="primary">Filled</button>

<!-- Tonal Button (medium emphasis) -->
<button mat-flat-button class="mat-mdc-tonal-button">Tonal</button>

<!-- Outlined Button (low emphasis) -->
<button mat-stroked-button>Outlined</button>

<!-- Text Button (minimal) -->
<button mat-button>Text</button>

<!-- FAB (Floating Action Button) -->
<button mat-fab color="primary">
  <mat-icon>add</mat-icon>
</button>
```

#### Best Practices:
- Use filled buttons for primary actions
- Use outlined buttons for secondary actions
- Maximum 2 buttons per screen for emphasis
- Touch target: minimum 48x48dp

---

### 📄 Cards
**Reference**: https://m3.material.io/components/cards

#### Types:
```html
<!-- Elevated Card -->
<mat-card class="mat-mdc-card-elevated">
  <mat-card-header>
    <mat-card-title>Title</mat-card-title>
    <mat-card-subtitle>Subtitle</mat-card-subtitle>
  </mat-card-header>
  <mat-card-content>
    Content here
  </mat-card-content>
  <mat-card-actions>
    <button mat-button>ACTION</button>
  </mat-card-actions>
</mat-card>

<!-- Filled Card -->
<mat-card class="mat-mdc-card-filled">
  <!-- content -->
</mat-card>

<!-- Outlined Card -->
<mat-card class="mat-mdc-card-outlined">
  <!-- content -->
</mat-card>
```

#### Best Practices:
- Use for grouped content with multiple actions
- Keep content concise and scannable
- Use appropriate elevation for hierarchy

---

### 📝 Text Fields
**Reference**: https://m3.material.io/components/text-fields

#### Types:
```html
<!-- Filled Text Field (default) -->
<mat-form-field appearance="fill">
  <mat-label>Label</mat-label>
  <input matInput [formControl]="control">
  <mat-error *ngIf="control.hasError('required')">
    Field is required
  </mat-error>
  <mat-hint>Helper text</mat-hint>
</mat-form-field>

<!-- Outlined Text Field -->
<mat-form-field appearance="outline">
  <mat-label>Label</mat-label>
  <input matInput [formControl]="control">
</mat-form-field>

<!-- With Icon -->
<mat-form-field appearance="fill">
  <mat-label>Search</mat-label>
  <input matInput>
  <mat-icon matPrefix>search</mat-icon>
</mat-form-field>
```

#### Best Practices:
- Always include labels
- Provide clear error messages
- Use helper text for guidance
- Support keyboard navigation

---

### 🍔 Navigation
**Reference**: https://m3.material.io/components/navigation-drawer

#### Navigation Drawer:
```html
<mat-drawer-container class="example-container">
  <mat-drawer mode="side" opened>
    <mat-nav-list>
      <a mat-list-item routerLink="/dashboard">
        <mat-icon matListItemIcon>dashboard</mat-icon>
        <span matListItemTitle>Dashboard</span>
      </a>
      <a mat-list-item routerLink="/tenants">
        <mat-icon matListItemIcon>business</mat-icon>
        <span matListItemTitle>Tenants</span>
      </a>
    </mat-nav-list>
  </mat-drawer>
  <mat-drawer-content>
    <!-- Main content -->
  </mat-drawer-content>
</mat-drawer-container>
```

#### Top App Bar:
```html
<mat-toolbar color="primary">
  <button mat-icon-button (click)="drawer.toggle()">
    <mat-icon>menu</mat-icon>
  </button>
  <span>Tartware PMS</span>
  <span class="spacer"></span>
  <button mat-icon-button>
    <mat-icon>account_circle</mat-icon>
  </button>
</mat-toolbar>
```

---

### 💬 Dialogs
**Reference**: https://m3.material.io/components/dialogs

```typescript
// dialog.component.ts
import { Component, inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'app-confirm-dialog',
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      {{ data.message }}
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [mat-dialog-close]="true">
        Confirm
      </button>
    </mat-dialog-actions>
  `
})
export class ConfirmDialogComponent {
  dialogRef = inject(MatDialogRef<ConfirmDialogComponent>);
  data = inject(MAT_DIALOG_DATA);
}

// Usage
const dialogRef = this.dialog.open(ConfirmDialogComponent, {
  data: { title: 'Confirm Action', message: 'Are you sure?' }
});

dialogRef.afterClosed().subscribe(result => {
  if (result) {
    // User confirmed
  }
});
```

---

### 🏷️ Chips
**Reference**: https://m3.material.io/components/chips

```html
<!-- Filter Chips -->
<mat-chip-listbox>
  <mat-chip-option selected>All</mat-chip-option>
  <mat-chip-option>Active</mat-chip-option>
  <mat-chip-option>Inactive</mat-chip-option>
</mat-chip-listbox>

<!-- Input Chips -->
<mat-chip-grid #chipGrid>
  <mat-chip-row *ngFor="let tag of tags" (removed)="remove(tag)">
    {{ tag }}
    <button matChipRemove>
      <mat-icon>cancel</mat-icon>
    </button>
  </mat-chip-row>
  <input [matChipInputFor]="chipGrid"
         [matChipInputSeparatorKeyCodes]="separatorKeysCodes"
         (matChipInputTokenEnd)="add($event)">
</mat-chip-grid>
```

---

### 📋 Lists
**Reference**: https://m3.material.io/components/lists

```html
<!-- Basic List -->
<mat-list>
  <mat-list-item>
    <mat-icon matListItemIcon>folder</mat-icon>
    <div matListItemTitle>Photos</div>
    <div matListItemLine>Jan 9, 2024</div>
  </mat-list-item>
</mat-list>

<!-- Selection List -->
<mat-selection-list #items>
  <mat-list-option *ngFor="let item of items" [value]="item">
    {{ item.name }}
  </mat-list-option>
</mat-selection-list>
```

---

### 📊 Data Tables
**Reference**: https://m3.material.io/components/data-tables (not in M3 spec, but Material implementation)

```html
<table mat-table [dataSource]="dataSource" matSort>
  <!-- Columns -->
  <ng-container matColumnDef="name">
    <th mat-header-cell *matHeaderCellDef mat-sort-header>Name</th>
    <td mat-cell *matCellDef="let row">{{ row.name }}</td>
  </ng-container>

  <ng-container matColumnDef="actions">
    <th mat-header-cell *matHeaderCellDef>Actions</th>
    <td mat-cell *matCellDef="let row">
      <button mat-icon-button>
        <mat-icon>more_vert</mat-icon>
      </button>
    </td>
  </ng-container>

  <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
  <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
</table>

<mat-paginator [pageSizeOptions]="[5, 10, 25, 100]"></mat-paginator>
```

---

## M3 Color System

### Primary Colors
```scss
$primary-palette: (
  0: #000000,
  10: #21005d,
  20: #381e72,
  30: #4f378b,
  40: #6750a4,
  50: #7f67be,
  60: #9a82db,
  70: #b69df8,
  80: #d0bcff,
  90: #eaddff,
  95: #f6edff,
  98: #fef7ff,
  99: #fffbfe,
  100: #ffffff,
);
```

### Surface Colors
```scss
$surface-palette: (
  surface: #fef7ff,
  surface-dim: #ded8e1,
  surface-bright: #fef7ff,
  surface-container-lowest: #ffffff,
  surface-container-low: #f7f2fa,
  surface-container: #f3edf7,
  surface-container-high: #ece6f0,
  surface-container-highest: #e6e0e9,
);
```

---

## M3 Typography Scale

```scss
$typography-config: mat.define-typography-config(
  $display-large: mat.define-typography-level(57px, 64px, 400),
  $display-medium: mat.define-typography-level(45px, 52px, 400),
  $display-small: mat.define-typography-level(36px, 44px, 400),

  $headline-large: mat.define-typography-level(32px, 40px, 400),
  $headline-medium: mat.define-typography-level(28px, 36px, 400),
  $headline-small: mat.define-typography-level(24px, 32px, 400),

  $title-large: mat.define-typography-level(22px, 28px, 400),
  $title-medium: mat.define-typography-level(16px, 24px, 500),
  $title-small: mat.define-typography-level(14px, 20px, 500),

  $body-large: mat.define-typography-level(16px, 24px, 400),
  $body-medium: mat.define-typography-level(14px, 20px, 400),
  $body-small: mat.define-typography-level(12px, 16px, 400),

  $label-large: mat.define-typography-level(14px, 20px, 500),
  $label-medium: mat.define-typography-level(12px, 16px, 500),
  $label-small: mat.define-typography-level(11px, 16px, 500),
);
```

---

## M3 Elevation System

```scss
// Elevation levels (box-shadow)
$elevation-0: none;
$elevation-1: 0 1px 2px rgba(0, 0, 0, 0.3), 0 1px 3px 1px rgba(0, 0, 0, 0.15);
$elevation-2: 0 1px 2px rgba(0, 0, 0, 0.3), 0 2px 6px 2px rgba(0, 0, 0, 0.15);
$elevation-3: 0 4px 8px 3px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.3);
$elevation-4: 0 6px 10px 4px rgba(0, 0, 0, 0.15), 0 2px 3px rgba(0, 0, 0, 0.3);
$elevation-5: 0 8px 12px 6px rgba(0, 0, 0, 0.15), 0 4px 4px rgba(0, 0, 0, 0.3);

// Usage
.elevated-card {
  box-shadow: $elevation-2;
}
```

---

## M3 Shape System

```scss
// Corner radius values
$shape-corner-none: 0;
$shape-corner-extra-small: 4px;
$shape-corner-small: 8px;
$shape-corner-medium: 12px;
$shape-corner-large: 16px;
$shape-corner-extra-large: 28px;
$shape-corner-full: 50%;

// Usage
.rounded-card {
  border-radius: $shape-corner-large;
}
```

---

## Accessibility Guidelines (M3)

### Color Contrast
- **Normal text**: 4.5:1 minimum (WCAG AA)
- **Large text**: 3:1 minimum
- **Target**: 7:1 for AAA compliance

### Touch Targets
- **Minimum size**: 48x48dp
- **Spacing**: 8dp between targets
- **Visible area**: Can be smaller, but tap area must be 48dp

### Focus Indicators
```scss
// Focus ring
button:focus-visible {
  outline: 2px solid var(--md-sys-color-primary);
  outline-offset: 2px;
}
```

### Screen Readers
```html
<!-- Always include aria-label for icon buttons -->
<button mat-icon-button aria-label="Delete item">
  <mat-icon>delete</mat-icon>
</button>

<!-- Use aria-describedby for additional context -->
<input matInput
       aria-describedby="password-help"
       [formControl]="password">
<span id="password-help" class="sr-only">
  Password must be at least 8 characters
</span>
```

---

## Motion & Animation (M3)

### Duration
```scss
$duration-short1: 50ms;   // Small utility
$duration-short2: 100ms;  // Small elements
$duration-short3: 150ms;  // Small elements
$duration-short4: 200ms;  // Most common
$duration-medium1: 250ms; // Medium elements
$duration-medium2: 300ms; // Medium elements
$duration-long1: 400ms;   // Large elements
$duration-long2: 500ms;   // Large elements
$duration-extra-long: 1000ms; // Screen transitions
```

### Easing
```scss
$easing-standard: cubic-bezier(0.2, 0, 0, 1);
$easing-emphasized: cubic-bezier(0.2, 0, 0, 1);
$easing-emphasized-decelerate: cubic-bezier(0.05, 0.7, 0.1, 1);
$easing-emphasized-accelerate: cubic-bezier(0.3, 0, 0.8, 0.15);
```

### Respect User Preferences
```scss
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Dark Theme Support

```scss
// styles.scss
.dark-theme {
  @include mat.all-component-colors($dark-theme);

  // Custom dark theme variables
  --surface: #1c1b1f;
  --on-surface: #e6e1e5;
  --surface-variant: #49454f;
  --on-surface-variant: #cac4d0;
}
```

```typescript
// theme.service.ts
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private isDark = signal(false);

  constructor() {
    this.applyUserPreference();
  }

  toggleTheme() {
    this.isDark.update(v => !v);
    document.body.classList.toggle('dark-theme');
    localStorage.setItem('theme', this.isDark() ? 'dark' : 'light');
  }

  applyUserPreference() {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      this.isDark.set(true);
      document.body.classList.add('dark-theme');
    }
  }
}
```

---

## Component Checklist

When implementing any M3 component:

- [ ] Reference official M3 spec: https://m3.material.io/components
- [ ] Check Angular Material documentation for implementation details
- [ ] Ensure proper color contrast (WCAG AA minimum)
- [ ] Verify touch target size (48x48dp minimum)
- [ ] Add keyboard navigation support
- [ ] Include ARIA labels where needed
- [ ] Test with screen reader
- [ ] Support dark theme
- [ ] Respect prefers-reduced-motion
- [ ] Use proper elevation for hierarchy
- [ ] Apply correct typography scale
- [ ] Use M3 shape system for rounded corners
- [ ] Add focus indicators
- [ ] Test on mobile and desktop
- [ ] Document any deviations from spec

---

## Common Patterns

### Form with Validation
```typescript
@Component({
  selector: 'app-booking-form',
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()">
      <mat-form-field appearance="outline">
        <mat-label>Guest Name</mat-label>
        <input matInput formControlName="guestName">
        <mat-error *ngIf="form.get('guestName')?.hasError('required')">
          Guest name is required
        </mat-error>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Check-in Date</mat-label>
        <input matInput [matDatepicker]="picker" formControlName="checkIn">
        <mat-datepicker-toggle matIconSuffix [for]="picker">
        </mat-datepicker-toggle>
        <mat-datepicker #picker></mat-datepicker>
      </mat-form-field>

      <button mat-flat-button color="primary" type="submit"
              [disabled]="form.invalid">
        Create Booking
      </button>
    </form>
  `
})
export class BookingFormComponent {
  private fb = inject(FormBuilder);

  form = this.fb.group({
    guestName: ['', Validators.required],
    checkIn: [null, Validators.required]
  });

  onSubmit() {
    if (this.form.valid) {
      // Submit logic
    }
  }
}
```

### List with Actions
```html
<mat-list>
  <mat-list-item *ngFor="let tenant of tenants()">
    <mat-icon matListItemIcon>business</mat-icon>
    <div matListItemTitle>{{ tenant.name }}</div>
    <div matListItemLine>{{ tenant.type }}</div>
    <button mat-icon-button matListItemMeta
            [matMenuTriggerFor]="menu"
            aria-label="More actions">
      <mat-icon>more_vert</mat-icon>
    </button>

    <mat-menu #menu="matMenu">
      <button mat-menu-item (click)="edit(tenant)">
        <mat-icon>edit</mat-icon>
        <span>Edit</span>
      </button>
      <button mat-menu-item (click)="delete(tenant)">
        <mat-icon>delete</mat-icon>
        <span>Delete</span>
      </button>
    </mat-menu>
  </mat-list-item>
</mat-list>
```

---

## Resources

### Official Documentation
- **M3 Components**: https://m3.material.io/components
- **M3 Foundations**: https://m3.material.io/foundations
- **Angular Material**: https://material.angular.io
- **Accessibility**: https://m3.material.io/foundations/accessible-design

### Tools
- **Material Theme Builder**: https://material-foundation.github.io/material-theme-builder/
- **Color Tool**: https://material.io/resources/color/
- **Icon Library**: https://fonts.google.com/icons

### Community
- **GitHub**: https://github.com/angular/components
- **Stack Overflow**: Tag `angular-material`

---

## Quick Tips

1. **Always start with the M3 spec** - Check https://m3.material.io/components first
2. **Use Angular Material components** - They implement M3 guidelines
3. **Customize with design tokens** - Use CSS custom properties for theming
4. **Test accessibility** - Use browser dev tools and screen readers
5. **Support dark mode** - It's not optional in M3
6. **Respect user preferences** - Motion, contrast, color scheme
7. **Keep touch targets 48dp** - Even if visual is smaller
8. **Use proper elevation** - Indicates hierarchy and interaction
9. **Follow typography scale** - Consistency is key
10. **Document deviations** - If you must differ from spec, document why

---

**Need Help?** Reference the official M3 documentation at https://m3.material.io/components for detailed specifications and guidelines.
