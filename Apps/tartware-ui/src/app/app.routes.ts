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
    path: 'change-password',
    loadComponent: () =>
      import('./features/auth/change-password.component').then((m) => m.ChangePasswordComponent),
    canActivate: [authGuard],
    title: 'Change Password - Tartware PMS',
  },
  {
    path: 'tenants',
    loadComponent: () =>
      import('./features/tenants/tenant-list.component').then((m) => m.TenantListComponent),
    canActivate: [authGuard],
    title: 'Tenants - Tartware PMS',
  },
  {
    path: 'pms/:tenantId',
    loadComponent: () =>
      import('./features/pms/pms-layout.component').then((m) => m.PmsLayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/pms/dashboard/dashboard.component').then((m) => m.DashboardComponent),
        title: 'Dashboard - Tartware PMS',
      },
      {
        path: 'reservations',
        loadComponent: () =>
          import('./features/pms/reservations/reservations.component').then(
            (m) => m.ReservationsComponent
          ),
        title: 'Reservations - Tartware PMS',
      },
      // Placeholder routes for other PMS features
      {
        path: 'rooms',
        loadComponent: () =>
          import('./features/pms/dashboard/dashboard.component').then((m) => m.DashboardComponent),
        title: 'Rooms - Tartware PMS',
      },
      {
        path: 'guests',
        loadComponent: () =>
          import('./features/pms/dashboard/dashboard.component').then((m) => m.DashboardComponent),
        title: 'Guests - Tartware PMS',
      },
      {
        path: 'housekeeping',
        loadComponent: () =>
          import('./features/pms/dashboard/dashboard.component').then((m) => m.DashboardComponent),
        title: 'Housekeeping - Tartware PMS',
      },
      {
        path: 'billing',
        loadComponent: () =>
          import('./features/pms/dashboard/dashboard.component').then((m) => m.DashboardComponent),
        title: 'Billing - Tartware PMS',
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./features/pms/dashboard/dashboard.component').then((m) => m.DashboardComponent),
        title: 'Reports - Tartware PMS',
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/pms/dashboard/dashboard.component').then((m) => m.DashboardComponent),
        title: 'Settings - Tartware PMS',
      },
    ],
  },
  {
    path: '**',
    redirectTo: '/login',
  },
];
