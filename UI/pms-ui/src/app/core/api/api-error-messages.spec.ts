import { TestBed } from "@angular/core/testing";

import { ApiService, ModuleNotEnabledError } from "./api.service";

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

	const thrownFrom = async (): Promise<unknown> => {
		try {
			await api.get("/anything");
			return new Error("no error thrown");
		} catch (e) {
			return e;
		}
	};

	const errorFrom = async (): Promise<string> => {
		const e = await thrownFrom();
		return e instanceof Error ? e.message : String(e);
	};

	const moduleErrorFrom = async (): Promise<ModuleNotEnabledError> => {
		const e = await thrownFrom();
		expect(e).toBeInstanceOf(ModuleNotEnabledError);
		return e as ModuleNotEnabledError;
	};

	beforeEach(() => {
		originalFetch = globalThis.fetch;
		TestBed.configureTestingModule({ providers: [ApiService] });
		api = TestBed.inject(ApiService);
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	it("raises TENANT_MODULE_NOT_ENABLED as its own error type, not a bare Error", async () => {
		respondWith(403, { message: "TENANT_MODULE_NOT_ENABLED" });
		const error = await moduleErrorFrom();

		expect(error.message).not.toContain("TENANT_MODULE_NOT_ENABLED");
		expect(error.title).toBe("This feature isn't switched on");
		expect(error.action).toContain("Settings → Modules");
	});

	it("splits the explanation into a headline, a reason and a fix", async () => {
		respondWith(403, {
			detail: "TENANT_MODULE_NOT_ENABLED",
			missingModules: ["analytics-bi"],
		});
		const error = await moduleErrorFrom();

		expect(error.title).toBe("Analytics & BI isn't switched on");
		expect(error.detail).toContain("your property hasn't switched on yet");
		expect(error.action).toContain("An administrator at your property");
		expect(error.action).toContain("Settings → Modules");
	});

	it("names the missing module the way the Modules screen does", async () => {
		respondWith(403, {
			detail: "TENANT_MODULE_NOT_ENABLED",
			missingModules: ["analytics-bi"],
		});
		const error = await moduleErrorFrom();

		expect(error.moduleNames).toEqual(["Analytics & BI"]);
	});

	it("keeps module ids out of everything the user reads", async () => {
		respondWith(403, {
			detail: "TENANT_MODULE_NOT_ENABLED",
			missingModules: ["analytics-bi"],
		});
		const error = await moduleErrorFrom();

		for (const text of [error.title, error.detail, error.action, error.message]) {
			expect(text).not.toContain("analytics-bi");
			expect(text).not.toContain("missing:");
		}
	});

	it("lists every missing module when more than one is required", async () => {
		respondWith(403, {
			detail: "TENANT_MODULE_NOT_ENABLED",
			missingModules: ["analytics-bi", "finance-automation"],
		});
		const error = await moduleErrorFrom();

		expect(error.title).toBe("Analytics & BI and Finance & Automation aren't switched on");
	});

	it("falls back to the generic wording for an unrecognised module id", async () => {
		respondWith(403, {
			detail: "TENANT_MODULE_NOT_ENABLED",
			missingModules: ["some-future-module"],
		});
		const error = await moduleErrorFrom();

		expect(error.moduleNames).toEqual([]);
		expect(error.title).toBe("This feature isn't switched on");
		expect(error.message).not.toContain("some-future-module");
	});

	it("still reads as one sentence for toasts and logs", async () => {
		respondWith(403, {
			detail: "TENANT_MODULE_NOT_ENABLED",
			missingModules: ["analytics-bi"],
		});
		const error = await moduleErrorFrom();

		expect(error.message).toBe(`${error.title}. ${error.action}`);
	});

	it("maps the code when it arrives as `detail` rather than `message`", async () => {
		respondWith(403, { detail: "TENANT_MODULE_NOT_ENABLED" });
		expect(await errorFrom()).toContain("isn't switched on");
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
