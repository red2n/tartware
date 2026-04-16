import { type Page, test, expect } from "@playwright/test";

// ─── Helpers ───────────────────────────────────────────────────────────

/** Navigate to a route and wait for the main content to appear. */
async function navigateTo(page: Page, path: string) {
	await page.goto(`/${path}`, { waitUntil: "domcontentloaded" });
	await page.locator("main").waitFor({ state: "visible", timeout: 15_000 });
}

/**
 * Assert that a page loads correctly:
 * - no full-page error state (inline errors alongside data are OK)
 * - no legacy "Loading …" spinner left on screen
 * - at least one heading is visible
 */
async function assertPageLoaded(page: Page, screenName: string) {
	// Check for full-page error (error with no data behind it)
	const errorState = page.locator(".error-state");
	const errorCount = await errorState.count();
	if (errorCount > 0) {
		const hasContent = (await page.locator(
			"table, .data-grid, .card, .kpi-card, .overview-bar, .tab-content",
		).count()) > 0;
		if (!hasContent) {
			const errorText = await errorState.first().textContent();
			throw new Error(`${screenName}: full-page error — ${errorText?.trim()}`);
		}
	}

	// Ensure no legacy loading-state spinners remain
	const legacySpinner = page.locator(".loading-state");
	await expect(legacySpinner).toHaveCount(0, { timeout: 15_000 });

	// Verify a heading is visible (page rendered successfully)
	const heading = page.locator("h1, h2, .page-title").first();
	await expect(heading).toBeVisible({ timeout: 10_000 });
}

// ─── Tests ─────────────────────────────────────────────────────────────
// Auth is handled by the setup project (e2e/auth.setup.ts) — every test
// starts with an already-authenticated session + selected property.

test.describe("PMS UI Smoke Tests", () => {
	test.describe.configure({ mode: "serial" });

	const screens: { path: string; name: string }[] = [
		{ path: "dashboard", name: "Dashboard" },
		{ path: "reservations", name: "Reservations" },
		{ path: "groups", name: "Group Bookings" },
		{ path: "guests", name: "Guests" },
		{ path: "rooms", name: "Rooms" },
		{ path: "room-types", name: "Room Types" },
		{ path: "buildings", name: "Buildings" },
		{ path: "rates", name: "Rates" },
		{ path: "rate-calendar", name: "Rate Calendar" },
		{ path: "packages", name: "Packages" },
		{ path: "housekeeping", name: "Housekeeping" },
		{ path: "billing", name: "Billing" },
		{ path: "accounts-receivable", name: "Accounts Receivable" },
		{ path: "cashiering", name: "Cashiering" },
		{ path: "night-audit", name: "Night Audit" },
		{ path: "tax-config", name: "Tax Configuration" },
		{ path: "invoices", name: "Invoices" },
		{ path: "commissions", name: "Commissions" },
		{ path: "settings", name: "Settings" },
		{ path: "command-management", name: "Command Management" },
		{ path: "users", name: "User Management" },
		{ path: "screen-permissions", name: "Screen Permissions" },
	];

	for (const screen of screens) {
		test(`${screen.name} — loads without errors`, async ({ page }) => {
			await navigateTo(page, screen.path);
			await assertPageLoaded(page, screen.name);
		});
	}
});
