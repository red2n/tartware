import type { TenantRole } from "@tartware/schemas";

export type NavItem = {
	label: string;
	icon: string;
	route?: string;
	description?: string;
	/** Screen key used to look up visibility in role_screen_permissions table. */
	screenKey?: string;
	children?: NavItem[];
};

/** Maps roles to numeric priority for comparison. Higher = more access. */
const ROLE_PRIORITY: Record<TenantRole, number> = {
	VIEWER: 100,
	STAFF: 200,
	MANAGER: 300,
	ADMIN: 400,
	OWNER: 500,
};

/** Returns true if the user's role meets or exceeds the required minimum role. */
export function hasMinRole(userRole: TenantRole, minRole: TenantRole): boolean {
	return ROLE_PRIORITY[userRole] >= ROLE_PRIORITY[minRole];
}

/** Filter nav items the user can access based on their allowed screen keys. */
export function filterNavByAllowedScreens(
	items: readonly NavItem[],
	allowedScreens: ReadonlySet<string>,
	permissionsLoaded: boolean,
): NavItem[] {
	// If permissions haven't loaded or are empty (API error/first deploy), show all items (fail-open)
	if (!permissionsLoaded || allowedScreens.size === 0) return [...items];

	return items
		.filter((item) => {
			// Items without a screenKey are always visible (e.g. Dashboard)
			if (!item.screenKey) return true;
			return allowedScreens.has(item.screenKey);
		})
		.map((item) => {
			if (!item.children) return item;
			const children = item.children.filter((child) => {
				if (!child.screenKey) return true;
				return allowedScreens.has(child.screenKey);
			});
			return children.length > 0 ? { ...item, children } : null;
		})
		.filter((item): item is NavItem => item !== null);
}

export const PRIMARY_NAV_ITEMS: NavItem[] = [
	{
		label: "Dashboard",
		icon: "dashboard",
		route: "/dashboard",
		screenKey: "dashboard",
		description: "Real-time overview of property operations and key metrics",
	},
	{
		label: "Reservations",
		icon: "book_online",
		description: "Manage bookings, check-ins, check-outs, and guest stays",
		screenKey: "reservations",
		children: [
			{
				label: "All Reservations",
				icon: "list_alt",
				route: "/reservations",
				screenKey: "reservations",
				description: "Individual bookings, check-ins, check-outs, and guest stays",
			},
			{
				label: "Group Bookings",
				icon: "groups",
				route: "/groups",
				screenKey: "groups",
				description: "Group blocks, room allocations, and rooming lists",
			},
		],
	},
	{
		label: "Guests",
		icon: "people",
		route: "/guests",
		screenKey: "guests",
		description: "Guest profiles, preferences, and loyalty history",
	},
	{
		label: "Availability",
		icon: "inventory_2",
		description: "Room inventory and property configuration",
		screenKey: "rooms",
		children: [
			{
				label: "Rooms",
				icon: "hotel",
				route: "/rooms",
				screenKey: "rooms",
				description: "Room inventory, status tracking, and assignments",
			},
			{
				label: "Room Types",
				icon: "category",
				route: "/room-types",
				screenKey: "room-types",
				description: "Room categories, configurations, and amenity packages",
			},
			{
				label: "Buildings",
				icon: "apartment",
				route: "/buildings",
				screenKey: "buildings",
				description: "Property structures, wings, and floor plans",
			},
		],
	},
	{
		label: "Revenue",
		icon: "payments",
		description: "Rate management and revenue optimization",
		screenKey: "rates",
		children: [
			{
				label: "Rates",
				icon: "sell",
				route: "/rates",
				screenKey: "rates",
				description: "Rate plans, pricing strategies, and seasonal adjustments",
			},
			{
				label: "Rate Calendar",
				icon: "calendar_month",
				route: "/rate-calendar",
				screenKey: "rate-calendar",
				description: "Day-level pricing management across rate plans",
			},
			{
				label: "Packages",
				icon: "card_giftcard",
				route: "/packages",
				screenKey: "packages",
				description: "Bundled offerings with services and add-on inclusions",
			},
		],
	},
	{
		label: "Housekeeping",
		icon: "cleaning_services",
		route: "/housekeeping",
		screenKey: "housekeeping",
		description: "Room cleaning schedules, task assignments, and inspections",
	},
	{
		label: "Accounts",
		icon: "account_balance",
		description: "Financial operations and accounting management",
		screenKey: "billing",
		children: [
			{
				label: "Billing",
				icon: "receipt_long",
				route: "/billing",
				screenKey: "billing",
				description: "Folios, charges, payments, and invoice management",
			},
			{
				label: "Accounts Receivable",
				icon: "request_quote",
				route: "/accounts-receivable",
				screenKey: "accounts-receivable",
				description: "City ledger, direct billing, and AR aging management",
			},
			{
				label: "Cashiering",
				icon: "point_of_sale",
				route: "/cashiering",
				screenKey: "cashiering",
				description: "Cashier sessions, shift management, and float reconciliation",
			},
			{
				label: "Night Audit",
				icon: "nightlight",
				route: "/night-audit",
				screenKey: "night-audit",
				description: "End-of-day processing, trial balance, and revenue posting",
			},
			{
				label: "Ledger",
				icon: "account_balance_wallet",
				route: "/ledger",
				screenKey: "billing",
				description: "General ledger entries, batches, and posting review",
			},
			{
				label: "Tax Config",
				icon: "gavel",
				route: "/tax-config",
				screenKey: "tax-config",
				description: "Tax rules, jurisdictions, and rate configuration",
			},
			{
				label: "Invoices",
				icon: "description",
				route: "/invoices",
				screenKey: "invoices",
				description: "Create, adjust, and finalize guest invoices",
			},
			{
				label: "Fiscal Periods",
				icon: "date_range",
				route: "/fiscal-periods",
				screenKey: "fiscal-periods",
				description: "Manage accounting periods — close, lock, and reopen",
			},
			{
				label: "Commissions",
				icon: "handshake",
				route: "/commissions",
				screenKey: "commissions",
				description: "Commission reports by source and period",
			},
		],
	},
];

export const SECONDARY_NAV_ITEMS: NavItem[] = [
	{
		label: "Reports",
		icon: "assessment",
		route: "/reports",
		screenKey: "reports",
		description: "Operational reports, analytics, and data exports",
	},
	{
		label: "Settings",
		icon: "settings",
		description: "Property configuration, user preferences, and system setup",
		screenKey: "settings",
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
		screenKey: "command-management",
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
		description: "Manage team members, roles, and access permissions",
		screenKey: "users",
		children: [
			{ label: "Users", icon: "people", route: "/users", screenKey: "users" },
			{ label: "Screen Permissions", icon: "shield", route: "/screen-permissions", screenKey: "users" },
		],
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

/** Find the NavItem (parent or direct) whose route or child route matches the URL. */
export function findActiveNavItem(url: string): NavItem | null {
	for (const items of [PRIMARY_NAV_ITEMS, SECONDARY_NAV_ITEMS]) {
		for (const item of items) {
			if (item.children?.some((child) => child.route && url.startsWith(child.route))) {
				return item;
			}
			if (item.route && url.startsWith(item.route)) {
				return item;
			}
		}
	}
	return null;
}

/**
 * Find the first route the user is allowed to access based on their screen permissions.
 * Walks PRIMARY then SECONDARY nav items, returning the first matching route.
 * Falls back to "/dashboard" if no allowed route is found.
 */
export function findFirstAllowedRoute(allowedScreens: ReadonlySet<string>): string {
	// If no permissions loaded, default to dashboard (guards are fail-open anyway)
	if (allowedScreens.size === 0) return "/dashboard";

	for (const items of [PRIMARY_NAV_ITEMS, SECONDARY_NAV_ITEMS]) {
		for (const item of items) {
			if (item.route && item.screenKey && allowedScreens.has(item.screenKey)) {
				return item.route;
			}
			if (item.children) {
				const effectiveKey = item.screenKey;
				for (const child of item.children) {
					const childKey = child.screenKey ?? effectiveKey;
					if (child.route && childKey && allowedScreens.has(childKey)) {
						return child.route;
					}
				}
			}
		}
	}
	return "/dashboard";
}
