import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { take } from 'rxjs';
import type { Tenant } from '../../../core/models/tenant.model';
import { PropertyContextService } from '../../../core/services/property-context.service';
import type {
  SettingsCategoryAggregate,
  SettingsSectionAggregate,
} from '../../../core/services/settings-catalog.service';
import { SettingsCatalogService } from '../../../core/services/settings-catalog.service';
import { TenantContextService } from '../../../core/services/tenant-context.service';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-settings',
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatListModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent {
  private tenantContext = inject(TenantContextService);
  private propertyContext = inject(PropertyContextService);
  private settingsCatalogService = inject(SettingsCatalogService);
  themeService = inject(ThemeService);

  tenant = this.tenantContext.activeTenant;
  properties = this.propertyContext.properties;
  catalog = signal<SettingsCategoryAggregate[]>([]);
  selectedCategoryCode = signal<string | null>(null);
  catalogError = signal<string | null>(null);
  catalogLoading = signal(true);
  values = signal<Map<string, unknown>>(new Map());

  tenantAddress = computed(() => {
    const tenant = this.tenant();
    if (!tenant) {
      return '—';
    }
    const parts = [
      tenant.address_line1,
      tenant.address_line2,
      tenant.city,
      tenant.state,
      tenant.country,
    ].filter((part): part is string => typeof part === 'string' && part.trim().length > 0);

    return parts.length > 0 ? parts.join(', ') : '—';
  });

  subscriptionPlan = computed(() => {
    const tenant = this.tenant();
    if (!tenant) return null;
    const subscription = tenant.subscription as { plan?: string; status?: string; seats?: number };
    return subscription ?? null;
  });

  categories = computed(() => this.catalog());
  selectedCategory = computed(() => {
    const code = this.selectedCategoryCode();
    if (!code) return null;
    return this.catalog().find((item) => item.category.code === code) ?? null;
  });
  selectedSections = computed<SettingsSectionAggregate[]>(
    () => this.selectedCategory()?.sections ?? []
  );

  readonly controlTypeLabels: Record<string, string> = {
    JSON_EDITOR: 'JSON Editor',
    TEXT_INPUT: 'Text Input',
    TEXT_AREA: 'Text Area',
    NUMBER_INPUT: 'Number',
    SELECT: 'Select',
    MULTI_SELECT: 'Multi-select',
    RADIO_GROUP: 'Radio Group',
    SLIDER: 'Slider',
    DATE_PICKER: 'Date Picker',
    TIME_PICKER: 'Time Picker',
    DATETIME_PICKER: 'Date & Time',
    TAGS: 'Tag List',
    TOGGLE: 'Toggle',
    FILE_UPLOAD: 'File Upload',
  };

  readonly scopeLabels: Record<string, string> = {
    GLOBAL: 'Global',
    TENANT: 'Tenant',
    TENANT_TEMPLATE: 'Tenant Template',
    PROPERTY: 'Property',
    UNIT: 'Unit',
    USER: 'User',
  };

  constructor() {
    this.loadCatalog();
  }

  private loadCatalog(): void {
    this.catalogLoading.set(true);
    this.settingsCatalogService
      .getCatalog()
      .pipe(take(1))
      .subscribe({
        next: (categories) => {
          this.catalog.set(categories);
          if (!this.selectedCategoryCode() && categories.length > 0) {
            this.selectedCategoryCode.set(categories[0].category.code);
          }
          this.catalogLoading.set(false);
        },
        error: (error) => {
          console.error('Failed to load settings catalog', error);
          this.catalogError.set('Unable to load settings catalog.');
          this.catalogLoading.set(false);
        },
      });

    this.settingsCatalogService
      .getValues()
      .pipe(take(1))
      .subscribe({
        next: (settingsValues) => {
          const map = new Map<string, unknown>();
          for (const value of settingsValues) {
            map.set(value.setting_id, {
              scope: value.scope_level,
              value: value.value,
              source: value.source,
            });
          }
          this.values.set(map);
        },
        error: (error) => {
          console.warn('Failed to load settings values', error);
        },
      });
  }

  selectCategory(code: string): void {
    this.selectedCategoryCode.set(code);
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  updateTenantProfile(tenant: Tenant | null): void {
    console.log('Update tenant profile', tenant);
  }

  trackCategory(_: number, item: SettingsCategoryAggregate): string {
    return item.category.id;
  }

  trackSection(_: number, item: SettingsSectionAggregate): string {
    return item.section.id;
  }

  trackDefinition(_: number, item: SettingsSectionAggregate['definitions'][number]): string {
    return item.id;
  }

  formatScope(scope: string): string {
    return this.scopeLabels[scope] ?? scope;
  }

  formatControlType(control: string): string {
    return this.controlTypeLabels[control] ?? control;
  }

  getCurrentValue(settingId: string): { scope: string; value: unknown; source: string } | null {
    return (
      (this.values().get(settingId) as
        | { scope: string; value: unknown; source: string }
        | undefined) ?? null
    );
  }
}
