export type NavItem = {
	label: string;
	icon: string;
	route?: string;
	description?: string;
	children?: NavItem[];
};

export const PRIMARY_NAV_ITEMS: NavItem[] = [
	{
		label: "Dashboard",
		icon: "dashboard",
		route: "/dashboard",
		description: "Real-time overview of property operations and key metrics",
	},
	{
		label: "Reservations",
		icon: "book_online",
		description: "Manage bookings, check-ins, check-outs, and guest stays",
		children: [
			{
				label: "All Reservations",
				icon: "list_alt",
				route: "/reservations",
				description: "Individual bookings, check-ins, check-outs, and guest stays",
			},
			{
				label: "Group Bookings",
				icon: "groups",
				route: "/groups",
				description: "Group blocks, room allocations, and rooming lists",
			},
		],
	},
	{
		label: "Guests",
		icon: "people",
		route: "/guests",
		description: "Guest profiles, preferences, and loyalty history",
	},
	{
		label: "Availability",
		icon: "inventory_2",
		description: "Room inventory and property configuration",
		children: [
			{
				label: "Rooms",
				icon: "hotel",
				route: "/rooms",
				description: "Room inventory, status tracking, and assignments",
			},
			{
				label: "Room Types",
				icon: "category",
				route: "/room-types",
				description: "Room categories, configurations, and amenity packages",
			},
			{
				label: "Buildings",
				icon: "apartment",
				route: "/buildings",
				description: "Property structures, wings, and floor plans",
			},
		],
	},
	{
		label: "Revenue",
		icon: "payments",
		description: "Rate management and revenue optimization",
		children: [
			{
				label: "Rates",
				icon: "sell",
				route: "/rates",
				description: "Rate plans, pricing strategies, and seasonal adjustments",
			},
			{
				label: "Rate Calendar",
				icon: "calendar_month",
				route: "/rate-calendar",
				description: "Day-level pricing management across rate plans",
			},
			{
				label: "Packages",
				icon: "card_giftcard",
				route: "/packages",
				description: "Bundled offerings with services and add-on inclusions",
			},
		],
	},
	{
		label: "Housekeeping",
		icon: "cleaning_services",
		route: "/housekeeping",
		description: "Room cleaning schedules, task assignments, and inspections",
	},
	{
		label: "Accounts",
		icon: "account_balance",
		description: "Financial operations and accounting management",
		children: [
			{
				label: "Billing",
				icon: "receipt_long",
				route: "/billing",
				description: "Folios, charges, payments, and invoice management",
			},
			{
				label: "Accounts Receivable",
				icon: "request_quote",
				route: "/accounts-receivable",
				description: "City ledger, direct billing, and AR aging management",
			},
			{
				label: "Cashiering",
				icon: "point_of_sale",
				route: "/cashiering",
				description: "Cashier sessions, shift management, and float reconciliation",
			},
			{
				label: "Night Audit",
				icon: "nightlight",
				route: "/night-audit",
				description: "End-of-day processing, trial balance, and revenue posting",
			},
			{
				label: "Tax Config",
				icon: "gavel",
				route: "/tax-config",
				description: "Tax rules, jurisdictions, and rate configuration",
			},
		],
	},
];

export const SECONDARY_NAV_ITEMS: NavItem[] = [
	{
		label: "Reports",
		icon: "assessment",
		route: "/reports",
		description: "Operational reports, analytics, and data exports",
	},
	{
		label: "Settings",
		icon: "settings",
		route: "/settings",
		description: "Property configuration, user preferences, and system setup",
	},
	{
		label: "Command Management",
		icon: "terminal",
		route: "/command-management",
		description: "Enable, disable, and monitor system commands",
	},
	{
		label: "User Management",
		icon: "manage_accounts",
		route: "/users",
		description: "Manage team members, roles, and access permissions",
	},
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
