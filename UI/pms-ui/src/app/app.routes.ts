import { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/login/login').then((m) => m.LoginComponent),
  },
  {
    path: '',
    loadComponent: () => import('./layout/shell/shell').then((m) => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard').then((m) => m.DashboardComponent),
      },
      {
        path: 'rooms',
        loadComponent: () =>
          import('./features/rooms/rooms').then((m) => m.RoomsComponent),
      },
      {
        path: 'rates',
        loadComponent: () =>
          import('./features/rates/rates').then((m) => m.RatesComponent),
      },
      {
        path: 'rooms/:roomId',
        loadComponent: () =>
          import('./features/rooms/room-detail/room-detail').then((m) => m.RoomDetailComponent),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings').then((m) => m.SettingsComponent),
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
