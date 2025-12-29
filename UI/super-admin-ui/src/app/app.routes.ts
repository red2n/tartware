import { Routes } from '@angular/router';

import { WelcomeComponent } from './pages/welcome.component';
import { LoginComponent } from './pages/login.component';
import { BreakGlassComponent } from './pages/break-glass.component';
import { ImpersonationComponent } from './pages/impersonation.component';

export const routes: Routes = [
	{
		path: '',
		pathMatch: 'full',
		redirectTo: 'login',
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
		title: 'System Admin | Impersonation',
	},
	{
		path: 'welcome',
		component: WelcomeComponent,
		title: 'System Admin UI',
	},
	{
		path: '**',
		redirectTo: 'login',
	},
];
