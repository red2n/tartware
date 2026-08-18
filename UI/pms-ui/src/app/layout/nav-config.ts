import { REPORTS } from "../features/reports/report-defs";
import { anyTermMatches, labelMatchRank, matchesSearch } from "../shared/search-utils";

export type NavItem = {
	label: string;
	icon: string;
	route?: string;
	description?: string;
	/** Screen key used to look up visibility in role_screen_permissions table. */
	screenKey?: string;
	children?: NavItem[];
};

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
			{
				label: "Waitlist",
				icon: "playlist_add",
				route: "/reservations/waitlist",
				screenKey: "reservations",
				description: "Guests waiting on inventory, with offers and conversion",
			},
		],
	},
	{
		label: "Guests",
		icon: "people",
		screenKey: "guests",
		description: "Guest profiles, preferences, and loyalty history",
		// Nested under /segment so these never collide with /guests/:guestId.
		children: [
			{
				label: "All guests",
				icon: "people",
				route: "/guests/segment/all",
				description: "Every guest profile",
			},
			{ label: "VIP", icon: "star", route: "/guests/segment/vip", description: "VIP guests" },
			{
				label: "Loyalty",
				icon: "loyalty",
				route: "/guests/segment/loyalty",
				description: "Guests enrolled in the loyalty programme",
			},
			{
				label: "Blacklisted",
				icon: "block",
				route: "/guests/segment/blacklisted",
				description: "Guests flagged as blacklisted",
			},
			{
				label: "Feedback",
				icon: "rate_review",
				route: "/guests/feedback",
				description: "Reviews, surveys and complaints, through to resolution",
			},
		],
	},
	{
		label: "Loyalty",
		icon: "emoji_events",
		screenKey: "loyalty",
		description: "Loyalty tier rules and points transactions",
		children: [
			{
				label: "Tier rules",
				icon: "emoji_events",
				route: "/loyalty/tiers",
				description: "Earn rates and tier thresholds",
			},
			{
				label: "Transactions",
				icon: "receipt_long",
				route: "/loyalty/transactions",
				description: "Points ledger across all members",
			},
		],
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
			{
				label: "Promo codes",
				icon: "local_offer",
				route: "/promo-codes",
				screenKey: "rates",
				description: "Discount codes, validity windows, limits and redemptions",
			},
		],
	},
	{
		label: "Housekeeping",
		icon: "cleaning_services",
		screenKey: "housekeeping",
		description: "Room cleaning schedules, task assignments, and inspections",
		children: [
			{
				label: "Room Board",
				icon: "hotel",
				route: "/housekeeping/rooms",
				description: "Room status board with housekeeping and occupancy state",
			},
			{
				label: "Tasks",
				icon: "task_alt",
				route: "/housekeeping/tasks",
				description: "Cleaning assignments and inspections",
			},
			{
				label: "Lost & found",
				icon: "inventory_2",
				route: "/housekeeping/lost-and-found",
				description: "Items handed in, held in storage, claimed and returned",
			},
			{
				label: "Maintenance",
				icon: "build",
				route: "/housekeeping/maintenance",
				description: "Property faults — raise, assign, complete and escalate",
			},
			{
				label: "Incidents",
				icon: "report",
				route: "/housekeeping/incidents",
				description: "Guest and property incidents — injuries, damage, theft allegations",
			},
			{
				label: "Shift handovers",
				icon: "swap_horiz",
				route: "/operations/shift-handovers",
				description: "Open issues carried across a shift change, with sign-off",
			},
		],
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
				label: "Approvals",
				icon: "verified",
				route: "/approvals",
				screenKey: "billing",
				description: "Four-eyes approval queue and flow-guard bypass log",
			},
			{
				label: "AR Accounts",
				icon: "account_balance",
				route: "/ar-accounts",
				screenKey: "accounts-receivable",
				description: "Corporate accounts, credit terms, statements and aging",
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
				label: "GL Batches",
				icon: "inventory_2",
				route: "/gl-batches",
				screenKey: "billing",
				description: "GL batch review and ERP export",
			},
			{
				label: "Chargebacks",
				icon: "gavel",
				route: "/chargebacks",
				screenKey: "billing",
				description: "Credit-card disputes and chargeback workflow",
			},
			{
				label: "Tax Config",
				icon: "gavel",
				route: "/tax-config",
				screenKey: "tax-config",
				description: "Tax rules, jurisdictions, and rate configuration",
			},
			{
				label: "Currency Config",
				icon: "currency_exchange",
				route: "/currency-config",
				screenKey: "currency-config",
				description: "Property base currencies and daily FX rates",
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
		screenKey: "reports",
		description: "Operational reports, analytics, and data exports",
		// Derived from the report catalogue so adding a report adds its nav entry.
		children: REPORTS.map((report) => ({
			label: report.label,
			icon: report.icon,
			route: `/reports/${report.key}`,
			description: report.description,
		})),
	},
	{
		label: "Settings",
		icon: "settings",
		description: "Property configuration, user preferences, and system setup",
		screenKey: "settings",
		children: [
			{
				label: "Admin & Users",
				icon: "admin_panel_settings",
				route: "/settings/ADMIN_USER_MANAGEMENT",
			},
			{ label: "Property & Tenant", icon: "apartment", route: "/settings/PROPERTY_TENANT_PROFILE" },
			{ label: "Rooms & Inventory", icon: "meeting_room", route: "/settings/ROOM_UNIT_INVENTORY" },
			{
				label: "Rates & Pricing",
				icon: "request_quote",
				route: "/settings/RATE_PRICING_FINANCIAL",
			},
			{ label: "Approvals", icon: "approval", route: "/settings/APPROVAL_WORKFLOWS" },
			{
				label: "Integrations",
				icon: "sync_alt",
				route: "/settings/INTEGRATION_CHANNEL_MANAGEMENT",
			},
			{
				label: "Booking & Guests",
				icon: "travel_explore",
				route: "/settings/BOOKING_ENGINE_GUEST",
			},
			{
				label: "Operations",
				icon: "cleaning_services",
				route: "/settings/HOUSEKEEPING_MAINTENANCE_OPERATIONS",
			},
			{ label: "Reporting", icon: "analytics", route: "/settings/REPORTING_ANALYTICS_NIGHT_AUDIT" },
			{
				label: "Notifications",
				icon: "notifications",
				route: "/settings/COMMUNICATION_NOTIFICATIONS",
			},
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
			{
				label: "Reservations",
				icon: "event",
				route: "/command-management/reservations-command-service",
			},
			{ label: "Guests", icon: "people", route: "/command-management/guests-service" },
			{ label: "Rooms", icon: "hotel", route: "/command-management/rooms-service" },
			{
				label: "Housekeeping",
				icon: "cleaning_services",
				route: "/command-management/housekeeping-service",
			},
			{ label: "Billing", icon: "receipt_long", route: "/command-management/billing-service" },
			{ label: "Settings", icon: "settings", route: "/command-management/settings-service" },
			{
				label: "Notifications",
				icon: "notifications",
				route: "/command-management/notification-service",
			},
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
			{
				label: "Screen Permissions",
				icon: "shield",
				route: "/screen-permissions",
				screenKey: "users",
			},
			{
				label: "Modules",
				icon: "extension",
				route: "/modules",
				screenKey: "modules",
			},
			{
				label: "Webhooks",
				icon: "webhook",
				route: "/webhooks",
				screenKey: "webhooks",
			},
			{
				label: "Channel health",
				icon: "hub",
				route: "/channels",
				screenKey: "channels",
				description: "OTA connection status, sync history and recovery actions",
			},
			{
				label: "Distribution",
				icon: "hub",
				route: "/settings/distribution",
				screenKey: "settings",
				description: "Booking sources and market segments",
			},
			{
				label: "Police reports",
				icon: "local_police",
				route: "/compliance/police-reports",
				screenKey: "compliance",
				description: "Crimes reported to the police, with agency case numbers",
			},
			{
				label: "Data breach register",
				icon: "shield",
				route: "/compliance/breach-incidents",
				screenKey: "compliance",
				description: "GDPR Art. 33 breach log and regulator notifications",
			},
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

/** A screen the search can offer to navigate to. */
export type ScreenMatch = {
	label: string;
	icon: string;
	route: string;
	description?: string;
	/** Parent nav section, shown as context in the results list. */
	section?: string;
};

/** Every routable screen the user is allowed to open, parents and children alike. */
export function listScreens(
	allowedScreens: ReadonlySet<string>,
	permissionsLoaded: boolean,
): ScreenMatch[] {
	const visible = filterNavByAllowedScreens(
		[...PRIMARY_NAV_ITEMS, ...SECONDARY_NAV_ITEMS],
		allowedScreens,
		permissionsLoaded,
	);

	const screens: ScreenMatch[] = [];
	for (const item of visible) {
		if (item.route) {
			screens.push({
				label: item.label,
				icon: item.icon,
				route: item.route,
				description: item.description,
			});
		}
		for (const child of item.children ?? []) {
			if (!child.route) continue;
			screens.push({
				label: child.label,
				icon: child.icon,
				route: child.route,
				description: child.description,
				section: item.label,
			});
		}
	}
	return screens;
}

/**
 * Screens matching a search term, best match first: an exact label beats a
 * label that starts with the term, which beats one that merely contains it,
 * then the parent section, then the description. Searching "reservation" finds
 * Reservations before Arrivals-under-Reservations before anything that only
 * mentions reservations in its description.
 */
export function searchScreens(
	query: string,
	allowedScreens: ReadonlySet<string>,
	permissionsLoaded: boolean,
	limit = 8,
): ScreenMatch[] {
	const term = query.trim().toLowerCase();
	if (!term) return [];

	const ranked: { rank: number; screen: ScreenMatch }[] = [];
	for (const screen of listScreens(allowedScreens, permissionsLoaded)) {
		// Term-by-term so a multi-word query still reaches a screen: "king room"
		// must find Rooms (and Settings, whose description mentions rooms) rather
		// than nothing, which is what testing the whole string as one substring
		// did. Label matches outrank section, which outranks description.
		const labelRank = labelMatchRank(term, screen.label);
		const rank =
			labelRank >= 0
				? labelRank
				: matchesSearch(term, screen.section)
					? 3
					: matchesSearch(term, screen.description)
						? 4
						: // Relaxed tier, mirroring the grids: a query carrying an extra
							// word ("king room") must still reach Rooms rather than nothing.
							anyTermMatches(term, screen.label, screen.section, screen.description)
							? 5
							: -1;
		if (rank >= 0) ranked.push({ rank, screen });
	}

	ranked.sort((a, b) => a.rank - b.rank || a.screen.label.localeCompare(b.screen.label));
	return ranked.slice(0, limit).map((entry) => entry.screen);
}
