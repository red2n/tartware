import { computed, Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { Tenant } from '../models/tenant.model';

/**
 * Tenant Context Service
 * Manages the active tenant context throughout the PMS application
 *
 * Features:
 * - Active tenant state management with signals
 * - Tenant selection and switching
 * - Context persistence in localStorage
 * - Automatic navigation to tenant dashboard
 *
 * Reference: Multi-tenant context management pattern
 *
 * @example Usage in Component
 * ```typescript
 * export class MyComponent {
 *   tenantContext = inject(TenantContextService);
 *
 *   get currentTenant() {
 *     return this.tenantContext.activeTenant();
 *   }
 * }
 * ```
 */
@Injectable({
  providedIn: 'root',
})
export class TenantContextService {
  private router = inject(Router);

  // Storage key for active tenant
  private readonly ACTIVE_TENANT_KEY = 'tartware-active-tenant';

  // Active tenant signal
  private activeTenantSignal = signal<Tenant | null>(null);

  // Public readonly signals
  readonly activeTenant = this.activeTenantSignal.asReadonly();
  readonly hasTenant = computed(() => this.activeTenant() !== null);
  readonly tenantId = computed(() => this.activeTenant()?.id || null);
  readonly tenantName = computed(() => this.activeTenant()?.name || '');
  readonly tenantSlug = computed(() => this.activeTenant()?.slug || '');

  constructor() {
    this.loadActiveTenant();
  }

  /**
   * Load active tenant from localStorage
   * @private
   */
  private loadActiveTenant(): void {
    try {
      const saved = localStorage.getItem(this.ACTIVE_TENANT_KEY);
      if (saved) {
        const tenant = JSON.parse(saved) as Tenant;
        this.activeTenantSignal.set(tenant);
      }
    } catch (error) {
      console.warn('Failed to load active tenant:', error);
      this.clearActiveTenant();
    }
  }

  /**
   * Save active tenant to localStorage
   * @private
   */
  private saveActiveTenant(tenant: Tenant): void {
    try {
      localStorage.setItem(this.ACTIVE_TENANT_KEY, JSON.stringify(tenant));
    } catch (error) {
      console.warn('Failed to save active tenant:', error);
    }
  }

  /**
   * Set the active tenant and navigate to dashboard
   * @param tenant - Tenant to set as active
   * @param navigate - Whether to navigate to dashboard (default: true)
   */
  setActiveTenant(tenant: Tenant, navigate = true): void {
    this.activeTenantSignal.set(tenant);
    this.saveActiveTenant(tenant);

    if (navigate) {
      this.router.navigate(['/pms', tenant.id, 'dashboard']);
    }
  }

  /**
   * Clear active tenant and return to tenant list
   */
  clearActiveTenant(): void {
    this.activeTenantSignal.set(null);
    localStorage.removeItem(this.ACTIVE_TENANT_KEY);
    this.router.navigate(['/tenants']);
  }

  /**
   * Switch to a different tenant
   * @param tenant - New tenant to switch to
   */
  switchTenant(tenant: Tenant): void {
    this.setActiveTenant(tenant, true);
  }

  /**
   * Check if given tenant ID is the active tenant
   * @param tenantId - Tenant ID to check
   * @returns true if tenant is active
   */
  isActiveTenant(tenantId: string): boolean {
    return this.tenantId() === tenantId;
  }

  /**
   * Get current tenant or throw error if none active
   * @returns Active tenant
   * @throws Error if no tenant is active
   */
  requireTenant(): Tenant {
    const tenant = this.activeTenant();
    if (!tenant) {
      throw new Error('No active tenant. Please select a tenant first.');
    }
    return tenant;
  }
}
