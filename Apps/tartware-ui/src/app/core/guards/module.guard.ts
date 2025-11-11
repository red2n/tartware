import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import type { ModuleId } from '../models/module.model';
import { ModuleService } from '../services/module.service';
import { TenantContextService } from '../services/tenant-context.service';

export const moduleGuard =
  (moduleId: ModuleId): CanActivateFn =>
  () => {
    const tenantContext = inject(TenantContextService);
    const moduleService = inject(ModuleService);
    const router = inject(Router);

    const tenantId = tenantContext.tenantId();
    if (!tenantId) {
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
