import { Component, input, output } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { MatTooltipModule } from "@angular/material/tooltip";
import { RouterLink, RouterLinkActive } from "@angular/router";

type NavItem = {
	label: string;
	icon: string;
	route: string;
};

@Component({
	selector: "app-sidebar",
	standalone: true,
	imports: [RouterLink, RouterLinkActive, MatIconModule, MatTooltipModule],
	templateUrl: "./sidebar.html",
	styleUrl: "./sidebar.scss",
})
export class SidebarComponent {
	readonly collapsed = input(false);
	readonly toggleCollapse = output<void>();

	readonly primaryNavItems: NavItem[] = [
		{ label: "Dashboard", icon: "dashboard", route: "/dashboard" },
		{ label: "Reservations", icon: "book_online", route: "/reservations" },
		{ label: "Guests", icon: "people", route: "/guests" },
		{ label: "Rooms", icon: "hotel", route: "/rooms" },
		{ label: "Room Types", icon: "category", route: "/room-types" },
		{ label: "Buildings", icon: "apartment", route: "/buildings" },
		{ label: "Rates", icon: "payments", route: "/rates" },
		{ label: "Rate Calendar", icon: "calendar_month", route: "/rate-calendar" },
		{ label: "Packages", icon: "card_giftcard", route: "/packages" },
		{
			label: "Housekeeping",
			icon: "cleaning_services",
			route: "/housekeeping",
		},
		{ label: "Billing", icon: "receipt_long", route: "/billing" },
	];

	readonly secondaryNavItems: NavItem[] = [
		{ label: "Reports", icon: "assessment", route: "/reports" },
		{ label: "Settings", icon: "settings", route: "/settings" },
	];
}
