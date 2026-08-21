import { TestBed } from "@angular/core/testing";
import type { BookingLookupResponse } from "@tartware/schemas";

import { GuestApiService } from "../../services/guest-api.service";
import { LookupPage } from "./lookup";

/**
 * The page is built through `runInInjectionContext` rather than rendered, so
 * these exercise the lookup logic without standing up Material and animations.
 */
describe("LookupPage", () => {
	let lookupBooking: (code: string) => Promise<BookingLookupResponse | null>;

	const buildPage = (): LookupPage => {
		TestBed.configureTestingModule({
			providers: [
				{
					provide: GuestApiService,
					useValue: { lookupBooking: (code: string) => lookupBooking(code) },
				},
			],
		});
		return TestBed.runInInjectionContext(() => new LookupPage());
	};

	const booking = { confirmationCode: "ABC123" } as BookingLookupResponse;

	beforeEach(() => {
		lookupBooking = () => Promise.resolve(null);
	});

	it("shows the booking it found", async () => {
		lookupBooking = () => Promise.resolve(booking);
		const page = buildPage();
		page.code = "ABC123";

		await page.lookup();

		expect(page.booking()).toEqual(booking);
		expect(page.notFound()).toBe(false);
		expect(page.error()).toBeNull();
	});

	it("reports 'not found' when the code matches nothing", async () => {
		lookupBooking = () => Promise.resolve(null);
		const page = buildPage();
		page.code = "NOPE";

		await page.lookup();

		expect(page.notFound()).toBe(true);
		expect(page.error()).toBeNull();
		expect(page.booking()).toBeNull();
	});

	// A failed request used to set notFound, telling a guest with a valid booking
	// that it did not exist whenever the gateway was down.
	it("reports a failed request as an error, not as a missing booking", async () => {
		lookupBooking = () => Promise.reject(new Error("Lookup failed: Bad Gateway"));
		const page = buildPage();
		page.code = "ABC123";

		await page.lookup();

		expect(page.error()).toBe("Lookup failed: Bad Gateway");
		expect(page.notFound()).toBe(false);
	});

	it("trims the code before searching and echoes the trimmed value", async () => {
		const seen: string[] = [];
		lookupBooking = (code) => {
			seen.push(code);
			return Promise.resolve(booking);
		};
		const page = buildPage();
		page.code = "  ABC123  ";

		await page.lookup();

		expect(seen).toEqual(["ABC123"]);
		expect(page.searched()).toBe("ABC123");
	});

	it("does not call the API for a blank code", async () => {
		let called = false;
		lookupBooking = () => {
			called = true;
			return Promise.resolve(null);
		};
		const page = buildPage();
		page.code = "   ";

		await page.lookup();

		expect(called).toBe(false);
		expect(page.loading()).toBe(false);
	});

	it("clears a previous error when a new search starts", async () => {
		lookupBooking = () => Promise.reject(new Error("boom"));
		const page = buildPage();
		page.code = "ABC123";
		await page.lookup();
		expect(page.error()).toBe("boom");

		lookupBooking = () => Promise.resolve(booking);
		await page.lookup();

		expect(page.error()).toBeNull();
		expect(page.booking()).toEqual(booking);
	});
});
