import type { Routes } from "@angular/router";

import { authGuard } from "./core/auth/auth.guard";
import { propertyGuard } from "./core/auth/property.guard";
import { screenGuard } from "./core/auth/role.guard";
import { REPORTS } from "./features/reports/report-defs";
import { unsavedChangesGuard } from "./shared/forms/unsaved-changes.guard";

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
				data: { screen: "dashboard" },
				loadComponent: () =>
					import("./features/dashboard/dashboard").then((m) => m.DashboardComponent),
			},
			{
				path: "dashboard/activity",
				canActivate: [propertyGuard, screenGuard("dashboard")],
				data: { screen: "dashboard" },
				loadComponent: () =>
					import("./features/dashboard/activity-log/activity-log").then(
						(m) => m.ActivityLogComponent,
					),
			},
			{
				path: "reservations",
				canActivate: [propertyGuard, screenGuard("reservations")],
				data: { screen: "reservations" },
				loadComponent: () =>
					import("./features/reservations/reservations").then((m) => m.ReservationsComponent),
			},
			{
				// Ahead of reservations/:reservationId, which would match "waitlist" as an id.
				path: "reservations/waitlist",
				canActivate: [propertyGuard, screenGuard("reservations")],
				data: { screen: "reservations" },
				loadComponent: () =>
					import("./features/reservations/waitlist/waitlist").then((m) => m.WaitlistComponent),
			},
			{
				path: "reservations/new",
				canDeactivate: [unsavedChangesGuard],
				canActivate: [propertyGuard, screenGuard("reservations")],
				data: { screen: "reservations" },
				loadComponent: () =>
					import("./features/reservations/create-reservation/create-reservation").then(
						(m) => m.CreateReservationComponent,
					),
			},
			{
				path: "reservations/:reservationId",
				canActivate: [propertyGuard, screenGuard("reservations")],
				data: { screen: "reservations" },
				loadComponent: () =>
					import("./features/reservations/reservation-detail/reservation-detail").then(
						(m) => m.ReservationDetailComponent,
					),
			},
			{
				path: "groups",
				canActivate: [propertyGuard, screenGuard("groups")],
				data: { screen: "groups" },
				loadComponent: () => import("./features/groups/groups").then((m) => m.GroupsComponent),
			},
			{
				path: "groups/new",
				canDeactivate: [unsavedChangesGuard],
				canActivate: [propertyGuard, screenGuard("groups")],
				data: { screen: "groups" },
				loadComponent: () =>
					import("./features/groups/create-group/create-group").then((m) => m.CreateGroupComponent),
			},
			{
				path: "groups/:groupId",
				canActivate: [propertyGuard, screenGuard("groups")],
				data: { screen: "groups" },
				loadComponent: () =>
					import("./features/groups/group-detail/group-detail").then((m) => m.GroupDetailComponent),
			},
			{
				path: "rooms",
				canActivate: [propertyGuard, screenGuard("rooms")],
				data: { screen: "rooms" },
				loadComponent: () => import("./features/rooms/rooms").then((m) => m.RoomsComponent),
			},
			{
				path: "room-types",
				canActivate: [propertyGuard, screenGuard("room-types")],
				data: { screen: "room-types" },
				loadComponent: () =>
					import("./features/rooms/room-types/room-types").then((m) => m.RoomTypesComponent),
			},
			{
				path: "buildings",
				canActivate: [propertyGuard, screenGuard("buildings")],
				data: { screen: "buildings" },
				loadComponent: () =>
					import("./features/rooms/buildings/buildings").then((m) => m.BuildingsComponent),
			},
			{
				path: "rates",
				canActivate: [propertyGuard, screenGuard("rates")],
				data: { screen: "rates" },
				loadComponent: () => import("./features/rates/rates").then((m) => m.RatesComponent),
			},
			{
				path: "promo-codes",
				canActivate: [propertyGuard, screenGuard("rates")],
				data: { screen: "rates" },
				loadComponent: () =>
					import("./features/rates/promo-codes/promo-codes").then((m) => m.PromoCodesComponent),
			},
			{
				path: "rate-calendar",
				canActivate: [propertyGuard, screenGuard("rate-calendar")],
				data: { screen: "rate-calendar" },
				loadComponent: () =>
					import("./features/rate-calendar/rate-calendar").then((m) => m.RateCalendarComponent),
			},
			{
				// Sales & catering (ui-gaps/13). Two screen keys, matching the two
				// privilege levels the write routes already draw: booking an event is
				// STAFF, editing function space inventory is MANAGER.
				path: "events",
				redirectTo: "events/calendar",
				pathMatch: "full",
			},
			{
				path: "events/calendar",
				canActivate: [propertyGuard, screenGuard("events")],
				data: { screen: "events" },
				loadComponent: () =>
					import("./features/events/function-space-calendar/function-space-calendar").then(
						(m) => m.FunctionSpaceCalendarComponent,
					),
			},
			{
				// The day sheet — item 5 of ui-gaps/13-sales-catering.md. Screen key
				// `events` like the calendar: reading the day is STAFF work, and the
				// four execution steps it records are the operation's own, not
				// inventory administration.
				path: "events/day-sheet",
				canActivate: [propertyGuard, screenGuard("events")],
				data: { screen: "events" },
				loadComponent: () =>
					import("./features/events/day-sheet/day-sheet").then((m) => m.DaySheetComponent),
			},
			{
				path: "events/meeting-rooms",
				canActivate: [propertyGuard, screenGuard("meeting-rooms")],
				data: { screen: "meeting-rooms" },
				loadComponent: () =>
					import("./features/events/meeting-rooms/meeting-rooms").then(
						(m) => m.MeetingRoomsComponent,
					),
			},
			{
				path: "events/bookings/:eventId",
				canActivate: [propertyGuard, screenGuard("events")],
				data: { screen: "events" },
				loadComponent: () =>
					import("./features/events/event-booking-detail/event-booking-detail").then(
						(m) => m.EventBookingDetailComponent,
					),
			},
			{
				// The BEO editor. Reached from a booking rather than from the nav —
				// a BEO only exists as the operational detail of one event, so there
				// is no useful "all BEOs" entry point at this level. Screen key
				// `events`, because POST /v1/banquet-orders is STAFF like the
				// booking routes, not MANAGER like meeting-room inventory.
				path: "events/beos/:beoId",
				canActivate: [propertyGuard, screenGuard("events")],
				data: { screen: "events" },
				loadComponent: () =>
					import("./features/events/beo-editor/beo-editor").then((m) => m.BeoEditorComponent),
			},
			{
				path: "packages",
				canActivate: [propertyGuard, screenGuard("packages")],
				data: { screen: "packages" },
				loadComponent: () =>
					import("./features/packages/packages").then((m) => m.PackagesComponent),
			},
			{
				path: "packages/:packageId",
				canActivate: [propertyGuard, screenGuard("packages")],
				data: { screen: "packages" },
				loadComponent: () =>
					import("./features/packages/package-detail/package-detail").then(
						(m) => m.PackageDetailComponent,
					),
			},
			{
				path: "rooms/:roomId",
				canActivate: [propertyGuard, screenGuard("rooms")],
				data: { screen: "rooms" },
				loadComponent: () =>
					import("./features/rooms/room-detail/room-detail").then((m) => m.RoomDetailComponent),
			},
			{
				path: "guests",
				pathMatch: "full",
				redirectTo: "guests/segment/all",
			},
			{
				// Ahead of guests/:guestId, which would otherwise match "feedback" as an id.
				path: "guests/feedback",
				canActivate: [propertyGuard, screenGuard("guests")],
				data: { screen: "guests" },
				loadComponent: () =>
					import("./features/guests/feedback/feedback").then((m) => m.GuestFeedbackComponent),
			},
			{
				// Declared before guests/:guestId; the extra segment keeps them distinct.
				path: "guests/segment/:segment",
				canActivate: [propertyGuard, screenGuard("guests")],
				data: { screen: "guests" },
				loadComponent: () => import("./features/guests/guests").then((m) => m.GuestsComponent),
			},
			{
				// Declared before guests/:guestId so the literal segment wins the match.
				path: "guests/new",
				canDeactivate: [unsavedChangesGuard],
				canActivate: [propertyGuard, screenGuard("guests")],
				data: { screen: "guests" },
				loadComponent: () =>
					import("./features/guests/guest-form/guest-form").then((m) => m.GuestFormComponent),
			},
			{
				// Declared before guests/:guestId for the same reason: the two-segment
				// edit path must not be swallowed by the single-segment detail route.
				path: "guests/:guestId/edit",
				canDeactivate: [unsavedChangesGuard],
				canActivate: [propertyGuard, screenGuard("guests")],
				data: { screen: "guests" },
				loadComponent: () =>
					import("./features/guests/guest-form/guest-form").then((m) => m.GuestFormComponent),
			},
			{
				path: "guests/:guestId",
				canActivate: [propertyGuard, screenGuard("guests")],
				data: { screen: "guests" },
				loadComponent: () =>
					import("./features/guests/guest-detail/guest-detail").then((m) => m.GuestDetailComponent),
			},
			{
				path: "housekeeping",
				pathMatch: "full",
				redirectTo: "housekeeping/rooms",
			},
			// Ahead of `housekeeping/:view`, which would otherwise swallow these as board tabs.
			{
				path: "housekeeping/incidents",
				canActivate: [propertyGuard, screenGuard("housekeeping")],
				data: { screen: "housekeeping" },
				loadComponent: () =>
					import("./features/housekeeping/incidents/incidents").then((m) => m.IncidentsComponent),
			},
			{
				path: "housekeeping/maintenance",
				canActivate: [propertyGuard, screenGuard("housekeeping")],
				data: { screen: "housekeeping" },
				loadComponent: () =>
					import("./features/housekeeping/maintenance/maintenance").then(
						(m) => m.MaintenanceComponent,
					),
			},
			{
				path: "housekeeping/lost-and-found",
				canActivate: [propertyGuard, screenGuard("housekeeping")],
				data: { screen: "housekeeping" },
				loadComponent: () =>
					import("./features/housekeeping/lost-and-found/lost-and-found").then(
						(m) => m.LostAndFoundComponent,
					),
			},
			{
				path: "housekeeping/:view",
				canActivate: [propertyGuard, screenGuard("housekeeping")],
				data: { screen: "housekeeping" },
				loadComponent: () =>
					import("./features/housekeeping/housekeeping").then((m) => m.HousekeepingComponent),
			},
			{
				path: "billing",
				canActivate: [propertyGuard, screenGuard("billing")],
				data: { screen: "billing" },
				loadComponent: () => import("./features/billing/billing").then((m) => m.BillingComponent),
			},
			{
				path: "approvals",
				canActivate: [propertyGuard, screenGuard("billing")],
				data: { screen: "billing" },
				loadComponent: () =>
					import("./features/accounts/approvals/approvals").then((m) => m.ApprovalsComponent),
			},
			{
				path: "ar-accounts",
				canActivate: [propertyGuard, screenGuard("accounts-receivable")],
				data: { screen: "accounts-receivable" },
				loadComponent: () =>
					import("./features/accounts/ar-accounts/ar-accounts").then(
						(m) => m.ArAccountsComponent,
					),
			},
			{
				path: "accounts-receivable",
				canActivate: [propertyGuard, screenGuard("accounts-receivable")],
				data: { screen: "accounts-receivable" },
				loadComponent: () =>
					import("./features/accounts/accounts-receivable/accounts-receivable").then(
						(m) => m.AccountsReceivableComponent,
					),
			},
			{
				path: "cashiering",
				canActivate: [propertyGuard, screenGuard("cashiering")],
				data: { screen: "cashiering" },
				loadComponent: () =>
					import("./features/accounts/cashiering/cashiering").then((m) => m.CashieringComponent),
			},
			{
				path: "night-audit",
				canActivate: [propertyGuard, screenGuard("night-audit")],
				data: { screen: "night-audit" },
				loadComponent: () =>
					import("./features/accounts/night-audit/night-audit").then((m) => m.NightAuditComponent),
			},
			{
				path: "ledger",
				canActivate: [propertyGuard, screenGuard("billing")],
				data: { screen: "billing" },
				loadComponent: () =>
					import("./features/accounts/ledger/ledger").then((m) => m.LedgerComponent),
			},
			{
				path: "gl-batches",
				canActivate: [propertyGuard, screenGuard("billing")],
				data: { screen: "billing" },
				loadComponent: () =>
					import("./features/accounts/gl-batches/gl-batches").then((m) => m.GlBatchesComponent),
			},
			{
				path: "chargebacks",
				canActivate: [propertyGuard, screenGuard("billing")],
				data: { screen: "billing" },
				loadComponent: () =>
					import("./features/accounts/chargebacks/chargebacks").then((m) => m.ChargebacksComponent),
			},
			{
				path: "tax-config",
				canActivate: [propertyGuard, screenGuard("tax-config")],
				data: { screen: "tax-config" },
				loadComponent: () =>
					import("./features/accounts/tax-config/tax-config").then((m) => m.TaxConfigComponent),
			},
			{
				path: "currency-config",
				canActivate: [propertyGuard, screenGuard("currency-config")],
				data: { screen: "currency-config" },
				loadComponent: () =>
					import("./features/accounts/currency-config/currency-config").then(
						(m) => m.CurrencyConfigComponent,
					),
			},
			{
				path: "invoices",
				canActivate: [propertyGuard, screenGuard("invoices")],
				data: { screen: "invoices" },
				loadComponent: () =>
					import("./features/accounts/invoices/invoices").then((m) => m.InvoicesComponent),
			},
			{
				path: "fiscal-periods",
				canActivate: [propertyGuard, screenGuard("fiscal-periods")],
				data: { screen: "fiscal-periods" },
				loadComponent: () =>
					import("./features/accounts/fiscal-periods/fiscal-periods").then(
						(m) => m.FiscalPeriodsComponent,
					),
			},
			{
				path: "commissions",
				canActivate: [propertyGuard, screenGuard("commissions")],
				data: { screen: "commissions" },
				loadComponent: () =>
					import("./features/accounts/commissions/commissions").then((m) => m.CommissionsComponent),
			},
			{
				path: "reports",
				pathMatch: "full",
				redirectTo: `reports/${REPORTS[0].key}`,
			},
			{
				path: "reports/:reportKey",
				canActivate: [propertyGuard, screenGuard("reports")],
				data: { screen: "reports" },
				loadComponent: () => import("./features/reports/reports").then((m) => m.ReportsComponent),
			},
			{
				path: "settings",
				pathMatch: "full",
				redirectTo: "settings/ADMIN_USER_MANAGEMENT",
			},
			{
				path: "settings/:categoryCode",
				canActivate: [screenGuard("settings")],
				data: { screen: "settings" },
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
				data: { screen: "command-management" },
				loadComponent: () =>
					import("./features/command-management/command-management").then(
						(m) => m.CommandManagementComponent,
					),
			},
			{
				path: "users",
				canActivate: [screenGuard("users")],
				data: { screen: "users" },
				loadComponent: () => import("./features/users/users").then((m) => m.UsersComponent),
			},
			{
				path: "modules",
				canActivate: [screenGuard("modules")],
				data: { screen: "modules" },
				loadComponent: () => import("./features/modules/modules").then((m) => m.ModulesComponent),
			},
			{
				path: "loyalty",
				pathMatch: "full",
				redirectTo: "loyalty/tiers",
			},
			{
				path: "loyalty/:tab",
				canActivate: [screenGuard("loyalty")],
				data: { screen: "loyalty" },
				loadComponent: () => import("./features/loyalty/loyalty").then((m) => m.LoyaltyComponent),
			},
			{
				path: "webhooks",
				canActivate: [screenGuard("webhooks")],
				data: { screen: "webhooks" },
				loadComponent: () =>
					import("./features/webhooks/webhooks").then((m) => m.WebhooksComponent),
			},
			{
				path: "operations/shift-handovers",
				canActivate: [propertyGuard, screenGuard("housekeeping")],
				data: { screen: "housekeeping" },
				loadComponent: () =>
					import("./features/operations/shift-handovers/shift-handovers").then(
						(m) => m.ShiftHandoversComponent,
					),
			},
			{
				path: "channels",
				canActivate: [screenGuard("channels")],
				data: { screen: "channels" },
				loadComponent: () =>
					import("./features/channels/channels").then((m) => m.ChannelsComponent),
			},
			{
				path: "compliance/police-reports",
				canActivate: [screenGuard("compliance")],
				data: { screen: "compliance" },
				loadComponent: () =>
					import("./features/compliance/police-reports/police-reports").then(
						(m) => m.PoliceReportsComponent,
					),
			},
			{
				path: "compliance/breach-incidents",
				canActivate: [screenGuard("compliance")],
				data: { screen: "compliance" },
				loadComponent: () =>
					import("./features/compliance/breach-incidents/breach-incidents").then(
						(m) => m.BreachIncidentsComponent,
					),
			},
			{
				path: "settings/distribution",
				canActivate: [propertyGuard, screenGuard("settings")],
				data: { screen: "settings" },
				loadComponent: () =>
					import("./features/settings/distribution/distribution").then(
						(m) => m.DistributionSettingsComponent,
					),
			},
			{
				path: "screen-permissions",
				canActivate: [screenGuard("users")],
				data: { screen: "users" },
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
