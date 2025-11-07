import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login.component';
import { TenantListComponent } from './features/tenants/tenant-list.component';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'tenants', component: TenantListComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '/login' }
];
