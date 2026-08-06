import { TestBed } from "@angular/core/testing";

import { ApiService } from "./api.service";

/**
 * The mapping lives in handleError, which is private and only reachable through
 * a real fetch, so these drive it via a stubbed global fetch.
 */
describe("ApiService error messages", () => {
	let api: ApiService;
	let originalFetch: typeof globalThis.fetch;

	const respondWith = (status: number, body: unknown): void => {
		globalThis.fetch = (() =>
			Promise.resolve({
				ok: false,
				status,
				json: () => Promise.resolve(body),
			} as Response)) as typeof globalThis.fetch;
	};

	const errorFrom = async (): Promise<string> => {
		try {
			await api.get("/anything");
			return "no error thrown";
		} catch (e) {
			return e instanceof Error ? e.message : String(e);
		}
	};

	beforeEach(() => {
		originalFetch = globalThis.fetch;
		TestBed.configureTestingModule({ providers: [ApiService] });
		api = TestBed.inject(ApiService);
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	it("explains TENANT_MODULE_NOT_ENABLED and points at the fix", async () => {
		respondWith(403, { message: "TENANT_MODULE_NOT_ENABLED" });
		const message = await errorFrom();

		expect(message).not.toContain("TENANT_MODULE_NOT_ENABLED");
		expect(message).toContain("module isn't enabled");
		expect(message).toContain("Modules");
	});

	it("names the specific modules the server rejected", async () => {
		respondWith(403, {
			detail: "TENANT_MODULE_NOT_ENABLED",
			missingModules: ["analytics-bi"],
		});
		const message = await errorFrom();

		expect(message).toContain("module isn't enabled");
		expect(message).toContain("analytics-bi");
	});

	it("lists every missing module when more than one is required", async () => {
		respondWith(403, {
			detail: "TENANT_MODULE_NOT_ENABLED",
			missingModules: ["analytics-bi", "finance-automation"],
		});
		const message = await errorFrom();

		expect(message).toContain("analytics-bi, finance-automation");
	});

	it("maps the code when it arrives as `detail` rather than `message`", async () => {
		respondWith(403, { detail: "TENANT_MODULE_NOT_ENABLED" });
		expect(await errorFrom()).toContain("module isn't enabled");
	});

	it("leaves messages that are not known codes untouched", async () => {
		respondWith(400, { message: "start_date must be before end_date" });
		expect(await errorFrom()).toBe("start_date must be before end_date");
	});

	it("falls back to the status when the body carries no message", async () => {
		respondWith(500, {});
		expect(await errorFrom()).toBe("HTTP 500");
	});
});
