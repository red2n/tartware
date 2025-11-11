import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { RouterModule } from '@angular/router';
import type { PropertyWithStats } from '@tartware/schemas';
import { take } from 'rxjs';
import type { ModuleDefinition, ModuleId } from '../../../core/models/module.model';
import type { Tenant } from '../../../core/models/tenant.model';
import { ModuleService } from '../../../core/services/module.service';
import { PropertyContextService } from '../../../core/services/property-context.service';
import { TenantContextService } from '../../../core/services/tenant-context.service';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatListModule,
    MatChipsModule,
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent {
  private tenantContext = inject(TenantContextService);
  private propertyContext = inject(PropertyContextService);
  private moduleService = inject(ModuleService);
  themeService = inject(ThemeService);

  tenant = this.tenantContext.activeTenant;
  properties = this.propertyContext.properties;
  enabledModules = this.tenantContext.enabledModules;
  moduleCatalog = signal<ModuleDefinition[]>([]);

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

  constructor() {
    this.moduleService
      .getModuleCatalog()
      .pipe(take(1))
      .subscribe({
        next: (definitions) => this.moduleCatalog.set(definitions),
      });
  }

  trackProperty(_: number, property: PropertyWithStats): string {
    return property.id;
  }

  trackModule(_: number, module: ModuleDefinition): string {
    return module.id;
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  manageIntegrations(): void {
    console.log('Navigate to integrations management');
  }

  updateTenantProfile(tenant: Tenant | null): void {
    console.log('Update tenant profile', tenant);
  }

  isModuleEnabled(moduleId: ModuleId): boolean {
    return this.tenantContext.isModuleEnabled(moduleId);
  }
}
