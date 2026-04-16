import { test as setup, expect } from "@playwright/test";

const USERNAME = "setup.admin";
const PASSWORD = "TempPass123";
const PROPERTY_NAME = "Tartware Beach Resort";

const authFile = "e2e/.auth/state.json";

/**
 * Global setup: log in once, select a property, and save the browser
 * storage state so every subsequent test reuses the authenticated session.
 */
setup("authenticate and select property", async ({ page }) => {
	// 1. Login
	await page.goto("/login");
	await page.getByLabel("Username").fill(USERNAME);
	await page.getByRole("textbox", { name: "Password" }).fill(PASSWORD);
	await page.getByRole("button", { name: "Sign in" }).click();
	await page.waitForURL("**/select-property", { timeout: 15_000 });
	await expect(page.getByRole("heading", { name: "Select a property" })).toBeVisible();

	// 2. Select property
	await page.getByRole("button", { name: PROPERTY_NAME }).click();
	await page.getByRole("button", { name: "Continue" }).click();
	await page.waitForURL("**/dashboard", { timeout: 15_000 });
	await expect(page).toHaveURL(/\/dashboard/);

	// 3. Save authenticated state
	await page.context().storageState({ path: authFile });
});
