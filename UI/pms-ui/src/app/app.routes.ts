import type { Routes } from "@angular/router";

import { authGuard } from "./core/auth/auth.guard";
import { propertyGuard } from "./core/auth/property.guard";

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
				canActivate: [propertyGuard],
				loadComponent: () =>
					import("./features/dashboard/dashboard").then((m) => m.DashboardComponent),
			},
			{
				path: "reservations",
				canActivate: [propertyGuard],
				loadComponent: () =>
					import("./features/reservations/reservations").then((m) => m.ReservationsComponent),
			},
			{
				path: "reservations/new",
				canActivate: [propertyGuard],
				loadComponent: () =>
					import("./features/reservations/create-reservation/create-reservation").then(
						(m) => m.CreateReservationComponent,
					),
			},
			{
				path: "reservations/:reservationId",
				canActivate: [propertyGuard],
				loadComponent: () =>
					import("./features/reservations/reservation-detail/reservation-detail").then(
						(m) => m.ReservationDetailComponent,
					),
			},
			{
				path: "rooms",
				canActivate: [propertyGuard],
				loadComponent: () => import("./features/rooms/rooms").then((m) => m.RoomsComponent),
			},
			{
				path: "rates",
				canActivate: [propertyGuard],
				loadComponent: () => import("./features/rates/rates").then((m) => m.RatesComponent),
			},
			{
				path: "rate-calendar",
				canActivate: [propertyGuard],
				loadComponent: () =>
					import("./features/rate-calendar/rate-calendar").then(
						(m) => m.RateCalendarComponent,
					),
			},
			{
				path: "rooms/:roomId",
				canActivate: [propertyGuard],
				loadComponent: () =>
					import("./features/rooms/room-detail/room-detail").then((m) => m.RoomDetailComponent),
			},
			{
				path: "guests",
				loadComponent: () => import("./features/guests/guests").then((m) => m.GuestsComponent),
			},
			{
				path: "guests/:guestId",
				loadComponent: () =>
					import("./features/guests/guest-detail/guest-detail").then((m) => m.GuestDetailComponent),
			},
			{
				path: "settings",
				loadComponent: () =>
					import("./features/settings/settings").then((m) => m.SettingsComponent),
			},
			{ path: "", redirectTo: "dashboard", pathMatch: "full" },
		],
	},
	{ path: "**", redirectTo: "login" },
];
