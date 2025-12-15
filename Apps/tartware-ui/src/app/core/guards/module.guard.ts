import { inject } from '@angular/core';
import type { ActivatedRouteSnapshot, CanActivateFn, RouterStateSnapshot } from '@angular/router';
import { Router } from '@angular/router';
import type { TenantRole } from '@tartware/schemas';
import { catchError, map, of } from 'rxjs';
import type { ModuleId } from '../models/module.model';
import { AuthService } from '../services/auth.service';
import { ModuleService } from '../services/module.service';
import { TenantContextService } from '../services/tenant-context.service';

/**
 * Blocks navigation to module-specific routes unless the tenant context has
 * the required role and feature flag enabled. Falls back to dashboard when
 * prerequisites are missing.
 */
export const moduleGuard =
  (moduleId: ModuleId, options: { minRole?: TenantRole } = {}): CanActivateFn =>
  (_route: ActivatedRouteSnapshot, _state: RouterStateSnapshot) => {
    const tenantContext = inject(TenantContextService);
    const moduleService = inject(ModuleService);
    const router = inject(Router);
    const authService = inject(AuthService);

    const tenantId = tenantContext.tenantId();
    if (!tenantId) {
      router.navigate(['/tenants'], { replaceUrl: true });
      return false;
    }

    const requiredRole = options.minRole;
    if (requiredRole && !authService.hasMinimumRole(tenantId, requiredRole)) {
      router.navigate(['/tenants'], { replaceUrl: true });
      return false;
    }

    const enabledModules = tenantContext.enabledModules();
    if (enabledModules.includes(moduleId)) {
      return true;
    }

    return moduleService.getTenantModules(tenantId).pipe(
      map((modules) => {
        if (modules.includes(moduleId)) {
          return true;
        }
        router.navigate(['/pms', tenantId, 'dashboard'], { replaceUrl: true });
        return false;
      }),
      catchError(() => {
        router.navigate(['/pms', tenantId, 'dashboard'], { replaceUrl: true });
        return of(false);
      })
    );
  };
