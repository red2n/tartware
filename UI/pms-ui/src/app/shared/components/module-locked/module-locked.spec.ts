import { signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import type { ModuleAccessRequest } from "@tartware/schemas";

import { ModuleNotEnabledError } from "../../../core/api/api.service";
import { TenantContextService } from "../../../core/context/tenant-context.service";
import { ModuleRequestService } from "../../../core/modules/module-request.service";
import { ToastService } from "../../toast/toast.service";
import { ModuleLockedComponent } from "./module-locked";

const lockedError = (): ModuleNotEnabledError =>
	new ModuleNotEnabledError({
		moduleIds: ["analytics-bi"],
		moduleNames: ["Analytics & BI"],
		title: "Analytics & BI isn't switched on",
		detail: "This screen needs Analytics & BI, which your property hasn't switched on yet.",
		action: "An administrator at your property can switch it on under Settings → Modules.",
		titleKey: "{modules} isn't switched on",
		detailKey: "This screen needs {modules}, which your property hasn't switched on yet.",
		messageParams: { modules: "Analytics & BI" },
	});

const pendingRequest = (): ModuleAccessRequest =>
	({
		id: "req-1",
		moduleId: "analytics-bi",
		moduleName: "Analytics & BI",
		requestedByName: "Priya Raman",
		status: "pending",
	}) as ModuleAccessRequest;

describe("ModuleLockedComponent", () => {
	let fixture: ComponentFixture<ModuleLockedComponent>;

	const canReview = signal(false);
	const openRequest = signal<ModuleAccessRequest | null>(null);
	const raised: unknown[] = [];

	const requestsStub = {
		canReview,
		load: () => Promise.resolve(),
		pendingRequestFor: () => openRequest(),
		request: (input: unknown) => {
			raised.push(input);
			return Promise.resolve(pendingRequest());
		},
	};

	const render = async () => {
		fixture = TestBed.createComponent(ModuleLockedComponent);
		fixture.componentRef.setInput("error", lockedError());
		fixture.componentRef.setInput("screen", "reports");
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();
	};

	const html = (): string => fixture.nativeElement.textContent ?? "";
	const query = <T extends HTMLElement>(sel: string): T | null =>
		fixture.nativeElement.querySelector(sel);

	beforeEach(() => {
		canReview.set(false);
		openRequest.set(null);
		raised.length = 0;

		TestBed.configureTestingModule({
			imports: [ModuleLockedComponent],
			providers: [
				provideRouter([]),
				{ provide: ModuleRequestService, useValue: requestsStub },
				{ provide: TenantContextService, useValue: { propertyId: () => "prop-1" } },
				{ provide: ToastService, useValue: { success: () => {}, error: () => {} } },
			],
		});
	});

	it("explains the situation whoever is looking", async () => {
		await render();

		expect(html()).toContain("Analytics & BI isn't switched on");
		expect(html()).toContain("your property hasn't switched on yet");
	});

	it("sends a reviewer to the screen where they can switch it on", async () => {
		canReview.set(true);
		await render();

		expect(query<HTMLAnchorElement>("a.btn")?.getAttribute("href")).toBe("/modules");
		// The one thing they cannot do is request it from themselves.
		expect(html()).not.toContain("Request access");
	});

	it("never offers the Modules screen to someone who cannot open it", async () => {
		await render();

		expect(query("a.btn")).toBeNull();
		expect(html()).toContain("Request access");
	});

	it("raises a request carrying the module, the screen and the reason", async () => {
		await render();

		query<HTMLButtonElement>("button.btn-primary")?.click();
		fixture.detectChanges();

		const textarea = query<HTMLTextAreaElement>("textarea");
		expect(textarea).not.toBeNull();
		fixture.componentInstance.reason.set("Need the occupancy report");
		fixture.detectChanges();

		const buttons: HTMLButtonElement[] = Array.from(
			(fixture.nativeElement as HTMLElement).querySelectorAll("button.btn-primary"),
		);
		buttons.at(-1)?.click();
		await fixture.whenStable();

		expect(raised).toEqual([
			{
				moduleId: "analytics-bi",
				requestedScreen: "reports",
				propertyId: "prop-1",
				reason: "Need the occupancy report",
			},
		]);
	});

	it("shows who is waiting instead of inviting a second request", async () => {
		openRequest.set(pendingRequest());
		await render();

		expect(html()).toContain("Priya Raman");
		expect(html()).toContain("Request pending");
		expect(html()).not.toContain("Request access");
	});

	it("offers nothing to request when the server named no module we know", async () => {
		fixture = TestBed.createComponent(ModuleLockedComponent);
		fixture.componentRef.setInput(
			"error",
			new ModuleNotEnabledError({
				moduleIds: [],
				moduleNames: [],
				title: "This feature isn't switched on",
				detail: "This screen needs a feature your property hasn't switched on yet.",
				action: "An administrator at your property can switch it on under Settings → Modules.",
				titleKey: "This feature isn't switched on",
				detailKey: "This screen needs a feature your property hasn't switched on yet.",
				messageParams: { modules: "" },
			}),
		);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		expect(html()).toContain("This feature isn't switched on");
		expect(html()).not.toContain("Request access");
	});
});
