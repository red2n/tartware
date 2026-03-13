import type { Routes } from "@angular/router";

export const routes: Routes = [
	{
		path: "",
		loadComponent: () => import("./pages/search/search").then((m) => m.SearchPage),
	},
	{
		path: "book/:roomTypeId",
		loadComponent: () => import("./pages/booking/booking").then((m) => m.BookingPage),
	},
	{
		path: "confirmation/:confirmationCode",
		loadComponent: () =>
			import("./pages/confirmation/confirmation").then((m) => m.ConfirmationPage),
	},
	{
		path: "lookup",
		loadComponent: () => import("./pages/lookup/lookup").then((m) => m.LookupPage),
	},
	{
		path: "checkin",
		loadComponent: () => import("./pages/checkin/checkin").then((m) => m.CheckinPage),
	},
	{
		path: "**",
		redirectTo: "",
	},
];
