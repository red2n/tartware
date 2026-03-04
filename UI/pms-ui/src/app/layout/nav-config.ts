export type NavItem = {
	label: string;
	icon: string;
	route?: string;
	children?: NavItem[];
};

export const PRIMARY_NAV_ITEMS: NavItem[] = [
	{ label: "Dashboard", icon: "dashboard", route: "/dashboard" },
	{ label: "Reservations", icon: "book_online", route: "/reservations" },
	{ label: "Guests", icon: "people", route: "/guests" },
	{
		label: "Availability",
		icon: "inventory_2",
		children: [
			{ label: "Rooms", icon: "hotel", route: "/rooms" },
			{ label: "Room Types", icon: "category", route: "/room-types" },
			{ label: "Buildings", icon: "apartment", route: "/buildings" },
		],
	},
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

export const SECONDARY_NAV_ITEMS: NavItem[] = [
	{ label: "Reports", icon: "assessment", route: "/reports" },
	{ label: "Settings", icon: "settings", route: "/settings" },
];

/** Find the parent NavItem whose children contain a route matching the given URL. */
export function findActiveParent(url: string): NavItem | null {
	for (const item of PRIMARY_NAV_ITEMS) {
		if (item.children?.some((child) => child.route && url.startsWith(child.route))) {
			return item;
		}
	}
	return null;
}
