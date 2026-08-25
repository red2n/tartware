import { TestBed } from "@angular/core/testing";

import { GuestApiService } from "./guest-api.service";

/**
 * These endpoints are the guest-facing surface — a wrong query parameter or a
 * swallowed error reaches a customer, not a staff member. The service talks to
 * `fetch` directly, so the tests stub the global and assert on the request it
 * built and the shape it returned.
 */
describe("GuestApiService", () => {
	let api: GuestApiService;
	let originalFetch: typeof globalThis.fetch;
	let requests: Array<{ url: string; init?: RequestInit }>;

	/** Stub fetch with a fixed response, recording every request made. */
	const respondWith = (response: {
		ok?: boolean;
		status?: number;
		statusText?: string;
		body?: unknown;
	}): void => {
		globalThis.fetch = ((url: string, init?: RequestInit) => {
			requests.push({ url, init });
			return Promise.resolve({
				ok: response.ok ?? true,
				status: response.status ?? 200,
				statusText: response.statusText ?? "OK",
				json: () => Promise.resolve(response.body ?? {}),
			} as Response);
		}) as unknown as typeof globalThis.fetch;
	};

	/** The URL of the single request the call under test made. */
	const requestedUrl = (): string => {
		expect(requests).toHaveLength(1);
		return requests[0].url;
	};

	const bodySentAsJson = (): Record<string, unknown> =>
		JSON.parse(String(requests[0].init?.body)) as Record<string, unknown>;

	const messageFrom = async (call: Promise<unknown>): Promise<string> => {
		try {
			await call;
			return "no error thrown";
		} catch (e) {
			return e instanceof Error ? e.message : String(e);
		}
	};

	beforeEach(() => {
		originalFetch = globalThis.fetch;
		requests = [];
		TestBed.configureTestingModule({});
		api = TestBed.inject(GuestApiService);
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	describe("searchRooms", () => {
		const params = {
			tenant_id: "t-1",
			property_id: "p-1",
			check_in_date: "2026-09-01",
			check_out_date: "2026-09-04",
			adults: 2,
		};

		it("sends every search parameter the availability query needs", async () => {
			respondWith({ body: { roomTypes: [] } });

			await api.searchRooms(params);

			const url = new URL(requestedUrl(), "http://localhost");
			expect(url.pathname).toBe("/v1/self-service/search");
			expect(Object.fromEntries(url.searchParams)).toEqual({
				tenant_id: "t-1",
				property_id: "p-1",
				check_in_date: "2026-09-01",
				check_out_date: "2026-09-04",
				adults: "2",
			});
		});

		it("includes children only when some were requested", async () => {
			respondWith({ body: { roomTypes: [] } });
			await api.searchRooms({ ...params, children: 2 });
			expect(requestedUrl()).toContain("children=2");

			requests = [];
			respondWith({ body: { roomTypes: [] } });
			await api.searchRooms({ ...params, children: 0 });
			expect(requestedUrl()).not.toContain("children");
		});

		it("reports a failed search rather than returning an empty result", async () => {
			respondWith({ ok: false, status: 503, statusText: "Service Unavailable" });

			expect(await messageFrom(api.searchRooms(params))).toBe("Search failed: Service Unavailable");
		});
	});

	describe("lookupBooking", () => {
		it("returns null for a code that matches no booking", async () => {
			respondWith({ ok: false, status: 404 });

			await expect(api.lookupBooking("NOPE")).resolves.toBeNull();
		});

		it("throws when the lookup itself fails, so a 500 is not read as 'no booking'", async () => {
			respondWith({ ok: false, status: 500, statusText: "Internal Server Error" });

			expect(await messageFrom(api.lookupBooking("ABC123"))).toBe(
				"Lookup failed: Internal Server Error",
			);
		});

		it("escapes the confirmation code into the path", async () => {
			respondWith({ body: { confirmationCode: "A/B 1" } });

			await api.lookupBooking("A/B 1");

			expect(requestedUrl()).toBe("/v1/self-service/booking/A%2FB%201");
		});
	});

	describe("error messages", () => {
		it("prefers the server's message over the status text", async () => {
			respondWith({
				ok: false,
				status: 409,
				statusText: "Conflict",
				body: { message: "Those dates are no longer available." },
			});

			expect(
				await messageFrom(
					api.createBooking({
						tenant_id: "t-1",
					} as unknown as Parameters<typeof api.createBooking>[0]),
				),
			).toBe("Those dates are no longer available.");
		});

		it("falls back to the status text when the body carries no message", async () => {
			respondWith({ ok: false, status: 400, statusText: "Bad Request", body: {} });

			expect(
				await messageFrom(
					api.createBooking({} as unknown as Parameters<typeof api.createBooking>[0]),
				),
			).toBe("Booking failed: Bad Request");
		});

		it("explains a feedback 404 in the guest's terms", async () => {
			respondWith({ ok: false, status: 404 });

			expect(
				await messageFrom(
					api.submitFeedback({
						tenant_id: "t-1",
						confirmation_code: "GONE",
						review_text: "Lovely stay",
					}),
				),
			).toBe("We could not find a booking with that confirmation code.");
		});
	});

	describe("response envelopes", () => {
		// These endpoints have been observed returning a bare array, a { data }
		// envelope, or a { keys } envelope; the client normalises all three.
		it("unwraps a bare array of keys", async () => {
			respondWith({ body: [{ key_id: "k1" }] });

			await expect(api.getKeys("r-1", "t-1")).resolves.toEqual([{ key_id: "k1" }]);
		});

		it("unwraps a { data } envelope", async () => {
			respondWith({ body: { data: [{ key_id: "k2" }] } });

			await expect(api.getKeys("r-1", "t-1")).resolves.toEqual([{ key_id: "k2" }]);
		});

		it("unwraps a { keys } envelope", async () => {
			respondWith({ body: { keys: [{ key_id: "k3" }] } });

			await expect(api.getKeys("r-1", "t-1")).resolves.toEqual([{ key_id: "k3" }]);
		});

		it("yields an empty list when the envelope carries neither", async () => {
			respondWith({ body: {} });

			await expect(api.getKeys("r-1", "t-1")).resolves.toEqual([]);
		});
	});

	describe("completeCheckout", () => {
		it("defaults to an express checkout", async () => {
			respondWith({ body: { status: "COMPLETED" } });

			await api.completeCheckout({ tenant_id: "t-1", confirmation_code: "ABC123" });

			expect(bodySentAsJson()).toMatchObject({ express: true, confirmation_code: "ABC123" });
		});

		it("lets the caller turn express off", async () => {
			respondWith({ body: { status: "COMPLETED" } });

			await api.completeCheckout({
				tenant_id: "t-1",
				confirmation_code: "ABC123",
				express: false,
			});

			expect(bodySentAsJson()).toMatchObject({ express: false });
		});
	});

	describe("registrationCardUrl", () => {
		it("builds the HTML card URL without fetching it", () => {
			const url = api.registrationCardUrl("res/1", "t-1");

			expect(url).toBe("/v1/self-service/registration-card/res%2F1/html?tenant_id=t-1");
			expect(requests).toHaveLength(0);
		});
	});
});
