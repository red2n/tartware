import type { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

/**
 * Application routes with lazy loading
 * All feature components are loaded on-demand to reduce initial bundle size
 */
export const routes: Routes = [
  {
    path: '',
    redirectTo: '/login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent),
    title: 'Login - Tartware PMS',
  },
  {
    path: 'tenants',
    loadComponent: () =>
      import('./features/tenants/tenant-list.component').then((m) => m.TenantListComponent),
    canActivate: [authGuard],
    title: 'Tenants - Tartware PMS',
  },
  {
    path: '**',
    redirectTo: '/login',
  },
];
