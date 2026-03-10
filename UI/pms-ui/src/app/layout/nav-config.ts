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
		description: "Property configuration, user preferences, and system setup",
		children: [
			{ label: "Admin & Users", icon: "admin_panel_settings", route: "/settings/ADMIN_USER_MANAGEMENT" },
			{ label: "Property & Tenant", icon: "apartment", route: "/settings/PROPERTY_TENANT_PROFILE" },
			{ label: "Rooms & Inventory", icon: "meeting_room", route: "/settings/ROOM_UNIT_INVENTORY" },
			{ label: "Rates & Pricing", icon: "request_quote", route: "/settings/RATE_PRICING_FINANCIAL" },
			{ label: "Approvals", icon: "approval", route: "/settings/APPROVAL_WORKFLOWS" },
			{ label: "Integrations", icon: "sync_alt", route: "/settings/INTEGRATION_CHANNEL_MANAGEMENT" },
			{ label: "Booking & Guests", icon: "travel_explore", route: "/settings/BOOKING_ENGINE_GUEST" },
			{ label: "Operations", icon: "cleaning_services", route: "/settings/HOUSEKEEPING_MAINTENANCE_OPERATIONS" },
			{ label: "Reporting", icon: "analytics", route: "/settings/REPORTING_ANALYTICS_NIGHT_AUDIT" },
			{ label: "Notifications", icon: "notifications", route: "/settings/COMMUNICATION_NOTIFICATIONS" },
			{ label: "Security", icon: "shield", route: "/settings/SECURITY_COMPLIANCE_BACKUP" },
			{ label: "UI & Localization", icon: "palette", route: "/settings/UI_LOCALIZATION_CUSTOM" },
			{ label: "Advanced", icon: "rocket_launch", route: "/settings/ADVANCED_TRENDING" },
		],
	},
	{
		label: "Command Management",
		icon: "terminal",
		description: "Enable, disable, and monitor system commands",
		children: [
			{ label: "All Commands", icon: "apps", route: "/command-management/all" },
			{ label: "Reservations", icon: "event", route: "/command-management/reservations-command-service" },
			{ label: "Guests", icon: "people", route: "/command-management/guests-service" },
			{ label: "Rooms", icon: "hotel", route: "/command-management/rooms-service" },
			{ label: "Housekeeping", icon: "cleaning_services", route: "/command-management/housekeeping-service" },
			{ label: "Billing", icon: "receipt_long", route: "/command-management/billing-service" },
			{ label: "Settings", icon: "settings", route: "/command-management/settings-service" },
			{ label: "Notifications", icon: "notifications", route: "/command-management/notification-service" },
			{ label: "Core", icon: "hub", route: "/command-management/core-service" },
			{ label: "Revenue", icon: "trending_up", route: "/command-management/revenue-service" },
		],
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
	for (const items of [PRIMARY_NAV_ITEMS, SECONDARY_NAV_ITEMS]) {
		for (const item of items) {
			if (item.children?.some((child) => child.route && url.startsWith(child.route))) {
				return item;
			}
		}
	}
	return null;
}
