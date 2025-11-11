import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import type { PropertyWithStats } from '@tartware/schemas';
import type { Tenant } from '../../../core/models/tenant.model';
import { PropertyContextService } from '../../../core/services/property-context.service';
import { TenantContextService } from '../../../core/services/tenant-context.service';
import { ThemeService } from '../../../core/services/theme.service';
import { RouterModule } from '@angular/router';

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
  themeService = inject(ThemeService);

  tenant = this.tenantContext.activeTenant;
  properties = this.propertyContext.properties;

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

  enabledModules = computed<string[]>(() => {
    const tenant = this.tenant();
    const modules = (tenant?.config as { modules?: string[] } | undefined)?.modules;
    return modules && Array.isArray(modules) ? modules : ['reservations', 'billing', 'housekeeping'];
  });

  subscriptionPlan = computed(() => {
    const tenant = this.tenant();
    if (!tenant) return null;
    const subscription = tenant.subscription as { plan?: string; status?: string; seats?: number };
    return subscription ?? null;
  });

  trackProperty(_: number, property: PropertyWithStats): string {
    return property.id;
  }

  trackModule(_: number, module: string): string {
    return module;
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
}
