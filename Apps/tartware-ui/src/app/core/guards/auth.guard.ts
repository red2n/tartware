import { inject } from '@angular/core';
import {
  type ActivatedRouteSnapshot,
  type CanActivateFn,
  Router,
  type RouterStateSnapshot,
} from '@angular/router';
import type { TenantRole } from '@tartware/schemas';
import { AuthService } from '../services/auth.service';

/**
 * Authentication guard
 * Protects routes that require user authentication
 * Redirects unauthenticated users to login page with return URL
 *
 * @example
 * ```typescript
 * const routes: Routes = [
 *   { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] }
 * ];
 * ```
 */
export const authGuard: CanActivateFn = (
  _route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Check if user is authenticated using computed signal
  if (authService.isAuthenticated()) {
    if (authService.needsPasswordChange() && state.url !== '/change-password') {
      return router.createUrlTree(['/change-password']);
    }
    return true;
  }

  // Store attempted URL for redirecting after login
  console.warn('Unauthorized access attempt to:', state.url);

  // Redirect to login with return URL
  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url },
  });
};

/**
 * Role-based authorization guard factory
 * Creates a guard that checks if user has specific role
 *
 * @param requiredRole - The role required to access the route
 * @returns CanActivateFn that checks for the required role
 *
 * @example
 * ```typescript
 * const routes: Routes = [
 *   {
 *     path: 'admin',
 *     component: AdminComponent,
 *     canActivate: [roleGuard('admin')]
 *   }
 * ];
 * ```
 */
export function roleGuard(requiredRole: TenantRole): CanActivateFn {
  return (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (!authService.isAuthenticated()) {
      return router.createUrlTree(['/login'], {
        queryParams: { returnUrl: state.url },
      });
    }

    const tenantId = route.params['tenantId'] || route.queryParams['tenantId'];
    if (tenantId && authService.hasRole(tenantId, requiredRole)) {
      return true;
    }

    // User doesn't have required role
    console.warn('Insufficient permissions for:', state.url);
    return router.createUrlTree(['/unauthorized']);
  };
}
