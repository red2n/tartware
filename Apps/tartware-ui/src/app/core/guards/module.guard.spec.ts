import { TestBed } from '@angular/core/testing';
import type { CanActivateFn } from '@angular/router';
import { Router } from '@angular/router';
import type { TenantRole } from '@tartware/schemas';
import { firstValueFrom, of } from 'rxjs';
import type { ModuleId } from '../models/module.model';
import { AuthService } from '../services/auth.service';
import { ModuleService } from '../services/module.service';
import { TenantContextService } from '../services/tenant-context.service';
import { moduleGuard } from './module.guard';

describe('moduleGuard', () => {
  let guardFactory: (moduleId: ModuleId, options?: { minRole?: TenantRole }) => CanActivateFn;
  let tenantContext: { tenantId: jasmine.Spy; enabledModules: jasmine.Spy };
  let moduleService: { getTenantModules: jasmine.Spy };
  let authService: { hasMinimumRole: jasmine.Spy };
  let router: { navigate: jasmine.Spy };

  beforeEach(() => {
    tenantContext = {
      tenantId: jasmine.createSpy('tenantId'),
      enabledModules: jasmine.createSpy('enabledModules'),
    };
    moduleService = {
      getTenantModules: jasmine.createSpy('getTenantModules'),
    };
    authService = {
      hasMinimumRole: jasmine.createSpy('hasMinimumRole'),
    };
    router = {
      navigate: jasmine.createSpy('navigate'),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: TenantContextService, useValue: tenantContext },
        { provide: ModuleService, useValue: moduleService },
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
      ],
    });

    guardFactory = (moduleId, options) => moduleGuard(moduleId, options ?? {});
  });

  it('allows navigation when module is enabled and role requirement satisfied', () => {
    tenantContext.tenantId.and.returnValue('tenant-1');
    tenantContext.enabledModules.and.returnValue(['core']);
    authService.hasMinimumRole.and.returnValue(true);

    const result = TestBed.runInInjectionContext(() =>
      guardFactory('core', { minRole: 'MANAGER' })()
    );

    expect(result).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('redirects to tenants when minimum role is not met', () => {
    tenantContext.tenantId.and.returnValue('tenant-1');
    tenantContext.enabledModules.and.returnValue(['core']);
    authService.hasMinimumRole.and.returnValue(false);

    const result = TestBed.runInInjectionContext(() =>
      guardFactory('core', { minRole: 'MANAGER' })()
    );

    expect(result).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/tenants'], { replaceUrl: true });
  });

  it('fetches modules from API when not cached', async () => {
    tenantContext.tenantId.and.returnValue('tenant-1');
    tenantContext.enabledModules.and.returnValue([]);
    authService.hasMinimumRole.and.returnValue(true);
    moduleService.getTenantModules.and.returnValue(of(['core']));

    const result = TestBed.runInInjectionContext(() => guardFactory('core')());

    expect(result).not.toBe(true);
    const resolved = await firstValueFrom(result as ReturnType<typeof of<boolean>>);
    expect(resolved).toBe(true);
    expect(moduleService.getTenantModules).toHaveBeenCalledWith('tenant-1');
  });
});
