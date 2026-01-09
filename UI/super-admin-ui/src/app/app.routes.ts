import { Routes } from '@angular/router';

import { WelcomeComponent } from './pages/welcome.component';
import { LoginComponent } from './pages/login.component';
import { BreakGlassComponent } from './pages/break-glass.component';
import { ImpersonationComponent } from './pages/impersonation.component';
import { TenantsComponent } from './pages/tenants.component';
import { UsersComponent } from './pages/users.component';
import { ReservationsComponent } from './pages/reservations.component';
import { CommandCenterComponent } from './pages/command-center.component';
import { systemAdminGuard } from './guards/system-admin.guard';

export const routes: Routes = [
	{
		path: '',
		pathMatch: 'full',
		redirectTo: 'welcome',
	},
	{
		path: 'login',
		component: LoginComponent,
		title: 'System Admin | Login',
	},
	{
		path: 'break-glass',
		component: BreakGlassComponent,
		title: 'System Admin | Break glass',
	},
	{
		path: 'impersonation',
		component: ImpersonationComponent,
		canActivate: [systemAdminGuard],
		title: 'System Admin | Impersonation',
	},
	{
		path: 'tenants',
		component: TenantsComponent,
		canActivate: [systemAdminGuard],
		title: 'System Admin | Tenants',
	},
	{
		path: 'users',
		component: UsersComponent,
		canActivate: [systemAdminGuard],
		title: 'System Admin | Users',
	},
	{
		path: 'reservations',
		component: ReservationsComponent,
		canActivate: [systemAdminGuard],
		title: 'Admin Support | Tenant reservations',
	},
	{
		path: 'command-center',
		component: CommandCenterComponent,
		canActivate: [systemAdminGuard],
		title: 'System Admin | Command Center',
	},
	{
		path: 'welcome',
		component: WelcomeComponent,
		title: 'System Admin UI',
	},
	{
		path: '**',
		redirectTo: 'welcome',
	},
];
