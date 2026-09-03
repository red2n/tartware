import { signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import type { CommandApprovalView } from "@tartware/schemas";

import { ApiService } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { TenantContextService } from "../../../core/context/tenant-context.service";
import { ToastService } from "../../../shared/toast/toast.service";
import { ApprovalsComponent } from "./approvals";

const HOUR = 60 * 60 * 1000;

const deferred = (over: Partial<CommandApprovalView> = {}): CommandApprovalView =>
	({
		approval_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
		tenant_id: "tenant-1",
		property_id: null,
		command_name: "billing.ar.write_off",
		request_id: "req-1",
		entity_type: "command",
		entity_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
		operation_payload: { amount: 40000, currency: "GBP" },
		description: "Bad debt, uncollectable after dunning",
		status: "PENDING",
		required_role: "OWNER",
		requested_by: "clerk-1",
		requested_by_name: "Dana Ruiz",
		requested_by_role: "OWNER",
		requested_at: new Date(Date.now() - HOUR).toISOString(),
		expires_at: new Date(Date.now() + 24 * HOUR).toISOString(),
		actioned_by: null,
		actioned_by_name: null,
		actioned_at: null,
		action_reason: null,
		dispatched_command_id: null,
		...over,
	}) as CommandApprovalView;

describe("ApprovalsComponent — deferred command queue", () => {
	let fixture: ComponentFixture<ApprovalsComponent>;

	const role = signal<string | null>("OWNER");
	const rows = signal<CommandApprovalView[]>([deferred()]);
	const gets: { path: string; params?: Record<string, string> }[] = [];
	const posts: { path: string; body?: unknown }[] = [];
	const toasts: { kind: "success" | "error"; text: string }[] = [];
	let approveResponse: unknown = { approval: {}, command_id: "cmd-77" };

	const apiStub = {
		get: (path: string, params?: Record<string, string>) => {
			gets.push({ path, params });
			if (path.includes("/commands/approvals")) return Promise.resolve(rows());
			// The two older sections are not under test; they must not throw.
			return Promise.resolve({ data: [] });
		},
		post: (path: string, body?: unknown) => {
			posts.push({ path, body });
			return Promise.resolve(approveResponse);
		},
	};

	const authStub = {
		tenantId: () => "tenant-1",
		user: () => ({ id: "owner-2", first_name: "Sam", last_name: "Okafor", username: "sam" }),
		activeMembership: () => (role() ? { role: role() } : null),
	};

	const render = async () => {
		fixture = TestBed.createComponent(ApprovalsComponent);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();
	};

	const text = (): string => fixture.nativeElement.textContent ?? "";
	const buttons = (label: string): HTMLButtonElement[] =>
		Array.from(fixture.nativeElement.querySelectorAll("button")).filter((b) =>
			((b as HTMLButtonElement).textContent ?? "").trim().startsWith(label),
		) as HTMLButtonElement[];

	beforeEach(() => {
		gets.length = 0;
		posts.length = 0;
		toasts.length = 0;
		role.set("OWNER");
		rows.set([deferred()]);
		approveResponse = { approval: {}, command_id: "cmd-77" };

		TestBed.configureTestingModule({
			imports: [ApprovalsComponent],
			providers: [
				{ provide: ApiService, useValue: apiStub },
				{ provide: AuthService, useValue: authStub },
				{ provide: TenantContextService, useValue: { propertyId: () => "" } },
				{
					provide: ToastService,
					useValue: {
						success: (t: string) => toasts.push({ kind: "success", text: t }),
						error: (t: string) => toasts.push({ kind: "error", text: t }),
					},
				},
			],
		});
	});

	it("reads the queue from the tenant-scoped command route", async () => {
		await render();
		const call = gets.find((g) => g.path.includes("/commands/approvals"));
		expect(call?.path).toBe("/tenants/tenant-1/commands/approvals");
	});

	it("shows the command name verbatim rather than a prettified label", async () => {
		await render();
		// The dotted name is what was submitted and what the command log will show.
		expect(text()).toContain("billing.ar.write_off");
	});

	/**
	 * The floor is computed from `COMMAND_DUAL_CONTROL`, so this is not a second
	 * copy of the rule — it is the reason an ADMIN is not sent at an endpoint
	 * that would 403 them.
	 */
	it("does not call the endpoint at all for a role below the approver floor", async () => {
		role.set("ADMIN");
		await render();
		expect(gets.some((g) => g.path.includes("/commands/approvals"))).toBe(false);
	});

	it("explains the empty section rather than leaving it looking empty", async () => {
		role.set("MANAGER");
		await render();
		expect(text()).toContain("Releasing a deferred command needs OWNER");
		expect(text()).not.toContain("No commands awaiting release");
	});

	it("offers the requester no way to release their own request", async () => {
		// Four-eyes is the whole control; the requester never sees a button.
		rows.set([deferred({ requested_by: "owner-2" })]);
		await render();
		expect(text()).toContain("Your request");
		expect(buttons("Release")).toHaveLength(0);
	});

	it("refuses an expired request in the evaluator's own words", async () => {
		rows.set([deferred({ expires_at: new Date(Date.now() - HOUR).toISOString() })]);
		await render();
		expect(buttons("Release")[0]?.disabled).toBe(true);
		expect(text()).toContain("expired");
	});

	it("releases through the approve route and names the command it became", async () => {
		await render();
		buttons("Release")[0]?.click();
		fixture.detectChanges();

		buttons("Confirm")[0]?.click();
		await fixture.whenStable();
		fixture.detectChanges();

		expect(posts[0]?.path).toBe(
			"/tenants/tenant-1/commands/approvals/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/approve",
		);
		// Releasing *causes* the operation, so the toast names the dispatched command.
		expect(toasts[0]?.text).toContain("cmd-77");
	});

	it("shows the payload verbatim before it is released", async () => {
		await render();
		buttons("Release")[0]?.click();
		fixture.detectChanges();
		// An approval on a summary is not an approval.
		expect(fixture.nativeElement.querySelector(".payload-block")?.textContent).toContain("40000");
	});

	it("will not submit a rejection without a reason", async () => {
		await render();
		buttons("Reject")[0]?.click();
		fixture.detectChanges();
		expect(buttons("Confirm")[0]?.disabled).toBe(true);

		fixture.componentInstance.reason.set("Balance is collectable; chase it");
		fixture.detectChanges();
		expect(buttons("Confirm")[0]?.disabled).toBe(false);
	});

	it("counts an expiring command in the card that sits above both queues", async () => {
		// The card read 0 while a row beside it was badged 1h, because it counted
		// only the billing queue.
		rows.set([deferred({ expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() })]);
		await render();
		expect(fixture.componentInstance.expiringSoon()).toHaveLength(1);
	});

	it("says nothing was dispatched when a request is refused", async () => {
		await render();
		buttons("Reject")[0]?.click();
		fixture.detectChanges();
		fixture.componentInstance.reason.set("Chase it");
		fixture.detectChanges();

		buttons("Confirm")[0]?.click();
		await fixture.whenStable();
		fixture.detectChanges();

		expect(posts[0]?.path).toContain("/reject");
		expect(toasts[0]?.text).toContain("Nothing was dispatched");
	});
});
