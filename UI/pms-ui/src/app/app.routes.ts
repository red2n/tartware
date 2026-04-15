import type { Routes } from "@angular/router";

import { authGuard } from "./core/auth/auth.guard";
import { propertyGuard } from "./core/auth/property.guard";
import { screenGuard } from "./core/auth/role.guard";

export const routes: Routes = [
	{
		path: "login",
		loadComponent: () => import("./features/login/login").then((m) => m.LoginComponent),
	},
	{
		path: "select-property",
		canActivate: [authGuard],
		loadComponent: () =>
			import("./features/select-property/select-property").then((m) => m.SelectPropertyComponent),
	},
	{
		path: "",
		loadComponent: () => import("./layout/shell/shell").then((m) => m.ShellComponent),
		canActivate: [authGuard],
		children: [
			{
				path: "dashboard",
				canActivate: [propertyGuard, screenGuard("dashboard")],
				loadComponent: () =>
					import("./features/dashboard/dashboard").then((m) => m.DashboardComponent),
			},
			{
				path: "dashboard/activity",
				canActivate: [propertyGuard, screenGuard("dashboard")],
				loadComponent: () =>
					import("./features/dashboard/activity-log/activity-log").then((m) => m.ActivityLogComponent),
			},
			{
				path: "reservations",
				canActivate: [propertyGuard, screenGuard("reservations")],
				loadComponent: () =>
					import("./features/reservations/reservations").then((m) => m.ReservationsComponent),
			},
			{
				path: "reservations/new",
				canActivate: [propertyGuard, screenGuard("reservations")],
				loadComponent: () =>
					import("./features/reservations/create-reservation/create-reservation").then(
						(m) => m.CreateReservationComponent,
					),
			},
			{
				path: "reservations/:reservationId",
				canActivate: [propertyGuard, screenGuard("reservations")],
				loadComponent: () =>
					import("./features/reservations/reservation-detail/reservation-detail").then(
						(m) => m.ReservationDetailComponent,
					),
			},
			{
				path: "groups",
				canActivate: [propertyGuard, screenGuard("groups")],
				loadComponent: () => import("./features/groups/groups").then((m) => m.GroupsComponent),
			},
			{
				path: "groups/new",
				canActivate: [propertyGuard, screenGuard("groups")],
				loadComponent: () =>
					import("./features/groups/create-group/create-group").then((m) => m.CreateGroupComponent),
			},
			{
				path: "groups/:groupId",
				canActivate: [propertyGuard, screenGuard("groups")],
				loadComponent: () =>
					import("./features/groups/group-detail/group-detail").then((m) => m.GroupDetailComponent),
			},
			{
				path: "rooms",
				canActivate: [propertyGuard, screenGuard("rooms")],
				loadComponent: () => import("./features/rooms/rooms").then((m) => m.RoomsComponent),
			},
			{
				path: "room-types",
				canActivate: [propertyGuard, screenGuard("room-types")],
				loadComponent: () =>
					import("./features/rooms/room-types/room-types").then((m) => m.RoomTypesComponent),
			},
			{
				path: "buildings",
				canActivate: [propertyGuard, screenGuard("buildings")],
				loadComponent: () =>
					import("./features/rooms/buildings/buildings").then((m) => m.BuildingsComponent),
			},
			{
				path: "rates",
				canActivate: [propertyGuard, screenGuard("rates")],
				loadComponent: () => import("./features/rates/rates").then((m) => m.RatesComponent),
			},
			{
				path: "rate-calendar",
				canActivate: [propertyGuard, screenGuard("rate-calendar")],
				loadComponent: () =>
					import("./features/rate-calendar/rate-calendar").then((m) => m.RateCalendarComponent),
			},
			{
				path: "packages",
				canActivate: [propertyGuard, screenGuard("packages")],
				loadComponent: () =>
					import("./features/packages/packages").then((m) => m.PackagesComponent),
			},
			{
				path: "packages/:packageId",
				canActivate: [propertyGuard, screenGuard("packages")],
				loadComponent: () =>
					import("./features/packages/package-detail/package-detail").then(
						(m) => m.PackageDetailComponent,
					),
			},
			{
				path: "rooms/:roomId",
				canActivate: [propertyGuard, screenGuard("rooms")],
				loadComponent: () =>
					import("./features/rooms/room-detail/room-detail").then((m) => m.RoomDetailComponent),
			},
			{
				path: "guests",
				canActivate: [propertyGuard, screenGuard("guests")],
				loadComponent: () => import("./features/guests/guests").then((m) => m.GuestsComponent),
			},
			{
				path: "guests/:guestId",
				canActivate: [propertyGuard, screenGuard("guests")],
				loadComponent: () =>
					import("./features/guests/guest-detail/guest-detail").then((m) => m.GuestDetailComponent),
			},
			{
				path: "housekeeping",
				canActivate: [propertyGuard, screenGuard("housekeeping")],
				loadComponent: () =>
					import("./features/housekeeping/housekeeping").then((m) => m.HousekeepingComponent),
			},
			{
				path: "billing",
				canActivate: [propertyGuard, screenGuard("billing")],
				loadComponent: () => import("./features/billing/billing").then((m) => m.BillingComponent),
			},
			{
				path: "accounts-receivable",
				canActivate: [propertyGuard, screenGuard("accounts-receivable")],
				loadComponent: () =>
					import("./features/accounts/accounts-receivable/accounts-receivable").then(
						(m) => m.AccountsReceivableComponent,
					),
			},
			{
				path: "cashiering",
				canActivate: [propertyGuard, screenGuard("cashiering")],
				loadComponent: () =>
					import("./features/accounts/cashiering/cashiering").then((m) => m.CashieringComponent),
			},
			{
				path: "night-audit",
				canActivate: [propertyGuard, screenGuard("night-audit")],
				loadComponent: () =>
					import("./features/accounts/night-audit/night-audit").then((m) => m.NightAuditComponent),
			},
			{
				path: "ledger",
				canActivate: [propertyGuard, screenGuard("billing")],
				loadComponent: () =>
					import("./features/accounts/ledger/ledger").then((m) => m.LedgerComponent),
			},
			{
				path: "tax-config",
				canActivate: [propertyGuard, screenGuard("tax-config")],
				loadComponent: () =>
					import("./features/accounts/tax-config/tax-config").then((m) => m.TaxConfigComponent),
			},
			{
				path: "invoices",
				canActivate: [propertyGuard, screenGuard("invoices")],
				loadComponent: () =>
					import("./features/accounts/invoices/invoices").then((m) => m.InvoicesComponent),
			},
			{
				path: "fiscal-periods",
				canActivate: [propertyGuard, screenGuard("fiscal-periods")],
				loadComponent: () =>
					import("./features/accounts/fiscal-periods/fiscal-periods").then((m) => m.FiscalPeriodsComponent),
			},
			{
				path: "commissions",
				canActivate: [propertyGuard, screenGuard("commissions")],
				loadComponent: () =>
					import("./features/accounts/commissions/commissions").then((m) => m.CommissionsComponent),
			},
			{
				path: "settings",
				pathMatch: "full",
				redirectTo: "settings/ADMIN_USER_MANAGEMENT",
			},
			{
				path: "settings/:categoryCode",
				canActivate: [screenGuard("settings")],
				loadComponent: () =>
					import("./features/settings/settings").then((m) => m.SettingsComponent),
			},
			{
				path: "command-management",
				pathMatch: "full",
				redirectTo: "command-management/all",
			},
			{
				path: "command-management/:serviceTab",
				canActivate: [screenGuard("command-management")],
				loadComponent: () =>
					import("./features/command-management/command-management").then(
						(m) => m.CommandManagementComponent,
					),
			},
			{
				path: "users",
				canActivate: [screenGuard("users")],
				loadComponent: () => import("./features/users/users").then((m) => m.UsersComponent),
			},
			{
				path: "screen-permissions",
				canActivate: [screenGuard("users")],
				loadComponent: () =>
					import("./features/screen-permissions/screen-permissions").then(
						(m) => m.ScreenPermissionsComponent,
					),
			},
			{ path: "", redirectTo: "dashboard", pathMatch: "full" },
		],
	},
	{ path: "**", redirectTo: "login" },
];
