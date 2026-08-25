import { expect, test } from "@playwright/test";

/**
 * Day-boundary convention (ui-gaps/13-sales-catering.md). Creates an event that
 * finishes after midnight — the case the tables used to refuse outright — and
 * checks the screens say which day each end falls on.
 *
 * NOT YET EXECUTED. Neither Playwright browser runs on the box this was written
 * on (`libnspr4.so`, `libnss3.so`, `libasound.so.2` missing, no sudo for
 * `npx playwright install-deps`), so the selectors are unverified. The write
 * path underneath is covered live by `http_test/smoke-events.sh`.
 */
const NAME = `E2E Midnight ${Date.now()}`;

test("an event running past midnight can be booked and reads as next day", async ({ page }) => {
	const errors: string[] = [];
	page.on("console", (m) => {
		if (m.type() === "error") errors.push(m.text());
	});

	await page.goto("/events/calendar");
	await expect(page.getByRole("heading", { name: "Function space" })).toBeVisible();

	await page.getByRole("button", { name: "New event booking" }).click();
	await page.locator("#fs-name").fill(NAME);
	await page.locator("#fs-organizer").fill("E2E Organizer");
	await page.locator("#fs-attendees").fill("40");
	await page.locator("#fs-start").fill("23:00");
	await page.locator("#fs-end").fill("01:30");

	// The whole point: the day is inferred, so the form has to say so.
	await expect(page.getByText("Next day")).toBeVisible();

	const book = page.getByRole("button", { name: "Book the space" });
	await expect(book).toBeEnabled();
	await book.click();

	// Grid chip carries the +1 marker, since the cell shows only the start time.
	const chip = page.locator("button", { hasText: "23:00" }).filter({ hasText: NAME }).first();
	await expect(chip).toBeVisible({ timeout: 15_000 });
	await expect(chip).toContainText("+1");

	await chip.click();
	await expect(page.getByRole("heading", { name: NAME })).toBeVisible({ timeout: 15_000 });
	await expect(page.getByText("23:00 – 01:30")).toBeVisible();
	await expect(page.getByText("(ends next day)")).toBeVisible();

	expect(errors, `console errors: ${errors.join(" | ")}`).toHaveLength(0);
});
