import { signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import type { ReasonCodeListItem } from "@tartware/schemas";

import { ApiService } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { ReasonCodePickerComponent } from "./reason-code-picker";

const code = (over: Partial<ReasonCodeListItem> = {}): ReasonCodeListItem =>
	({
		reason_id: "11111111-1111-1111-1111-111111111111",
		reason_code: "WO_SMALL_BALANCE",
		reason_name: "Small balance below the collection floor",
		reason_description: "The residual costs more to pursue than it is worth.",
		reason_category: "WRITE_OFF",
		approval_level: "MANAGER",
		requires_approval: true,
		is_system_default: true,
		...over,
	}) as ReasonCodeListItem;

describe("ReasonCodePickerComponent", () => {
	let fixture: ComponentFixture<ReasonCodePickerComponent>;

	const role = signal<string | null>("MANAGER");
	const rows = signal<ReasonCodeListItem[]>([code()]);
	const requests: { path: string; params?: Record<string, string> }[] = [];
	let failNext = false;

	const apiStub = {
		get: (path: string, params?: Record<string, string>) => {
			requests.push({ path, params });
			return failNext ? Promise.reject(new Error("offline")) : Promise.resolve(rows());
		},
	};

	const authStub = {
		tenantId: () => "tenant-1",
		activeMembership: () => (role() ? { role: role() } : null),
	};

	const render = async (over: { category?: string; value?: string } = {}) => {
		fixture = TestBed.createComponent(ReasonCodePickerComponent);
		fixture.componentRef.setInput("category", over.category ?? "WRITE_OFF");
		fixture.componentRef.setInput("value", over.value ?? "");
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();
	};

	const text = (): string => fixture.nativeElement.textContent ?? "";
	const options = (): HTMLOptionElement[] =>
		Array.from(fixture.nativeElement.querySelectorAll("option"));

	beforeEach(() => {
		requests.length = 0;
		failNext = false;
		role.set("MANAGER");
		rows.set([code()]);

		TestBed.configureTestingModule({
			imports: [ReasonCodePickerComponent],
			providers: [
				{ provide: ApiService, useValue: apiStub },
				{ provide: AuthService, useValue: authStub },
			],
		});
	});

	it("asks for the codes of the category the command demands", async () => {
		await render({ category: "RATE_OVERRIDE" });
		expect(requests[0]?.path).toBe("/reason-codes");
		expect(requests[0]?.params?.["category"]).toBe("RATE_OVERRIDE");
		expect(requests[0]?.params?.["tenant_id"]).toBe("tenant-1");
	});

	it("lists a code the operator can use without a warning", async () => {
		await render({ value: "WO_SMALL_BALANCE" });
		// MANAGER clears a MANAGER-level code.
		expect(text()).not.toContain("needs");
		expect(options().some((o) => o.value === "WO_SMALL_BALANCE")).toBe(true);
	});

	it("marks a code the operator's role cannot clear, rather than hiding it", async () => {
		// A code that is simply absent looks like a code that does not exist.
		// "You need an owner for this" is the useful message.
		rows.set([code({ reason_code: "WO_INSOLVENCY", approval_level: "GM" })]);
		await render();
		expect(options().some((o) => o.value === "WO_INSOLVENCY")).toBe(true);
		expect(text()).toContain("OWNER");
	});

	it("warns on the selected code, using the level → role translation", async () => {
		rows.set([code({ reason_code: "WO_BAD_DEBT", approval_level: "DIRECTOR" })]);
		await render({ value: "WO_BAD_DEBT" });
		// DIRECTOR has no membership equivalent; it maps up to ADMIN.
		expect(text()).toContain("ADMIN");
		expect(text()).toContain("refused");
	});

	it("says so when the category has no codes at all", async () => {
		rows.set([]);
		await render();
		expect(text()).toContain("No reason codes are configured");
	});

	it("says so when the list could not be loaded, and stays usable", async () => {
		failNext = true;
		await render();
		expect(text()).toContain("Could not load reason codes");
	});

	it("treats an unidentified operator as clearing nothing", async () => {
		role.set(null);
		await render({ value: "WO_SMALL_BALANCE" });
		expect(text()).toContain("MANAGER");
	});
});
