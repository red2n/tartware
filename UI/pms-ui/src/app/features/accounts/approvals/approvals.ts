import { Component, computed, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";

import {
	type ApprovalActionKind,
	type ApprovalDecision,
	COMMAND_APPROVER_FLOOR,
	type CommandApprovalView,
	evaluateApprovalAction,
	tenantRoleAtLeast,
} from "@tartware/schemas";

import { ApiService } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { TenantContextService } from "../../../core/context/tenant-context.service";
import { I18nService } from "../../../core/i18n/i18n.service";
import { LocaleDatePipe } from "../../../core/i18n/locale-date.pipe";
import { TranslatePipe } from "../../../core/i18n/translate.pipe";
import { IconComponent } from "../../../shared/components/icon/icon";
import { PageHeaderComponent } from "../../../shared/components/page-header/page-header";
import { SubmitOnEnterDirective } from "../../../shared/forms/submit-on-enter.directive";
import { ToastService } from "../../../shared/toast/toast.service";

/** Row of GET /v1/billing/approvals/pending. */
type ApprovalRequest = {
	approval_id: string;
	property_id?: string;
	operation_type: string;
	entity_type: string;
	entity_id: string;
	operation_payload?: Record<string, unknown>;
	description?: string;
	required_role?: string;
	requested_by: string;
	requested_by_name?: string;
	status: string;
	expires_at: string;
	created_at: string;
};

/**
 * Row of GET /v1/billing/flow-approvals — the `force`-bypass audit record.
 * Columns match `flow-approval-repository.ts` exactly; a bypass log that renders
 * blanks because a field was guessed is no better than not having one.
 */
type FlowApproval = {
	id: string;
	property_id?: string;
	flow_name: string;
	gate_name: string;
	entity_type: string;
	entity_id: string;
	approved_by: string;
	role_at_approval: string;
	reason_code: string;
	reason_notes?: string;
	approved_at: string;
	expires_at?: string;
	correlation_id?: string;
};

/**
 * What is being decided, and in which queue.
 *
 * The two queues are separate rows of `approval_requests` — `command_name IS
 * NULL` for a billing operation, non-null for a deferred command — and finding
 * 12 scoped each end's queries so neither can see the other's rows. They share
 * one confirmation card here because the decision is the same shape (read the
 * payload, give a reason, sign), and a second copy of that card is how the two
 * would drift apart on screen after being separated in the data.
 */
type OperationsDecision = {
	queue: "operations";
	kind: "approve" | "reject" | "cancel";
	request: ApprovalRequest;
};

/** A deferred command has no `cancel` route: the requester withdraws by letting it expire. */
type CommandDecision = {
	queue: "command";
	kind: "approve" | "reject";
	request: CommandApprovalView;
};

type Decision = OperationsDecision | CommandDecision;

const HOUR_MS = 60 * 60 * 1000;

/**
 * Hoisted rather than written inline at the call site.
 *
 * `check-i18n` reads a quoted literal on an `action` field as a user-facing
 * label — that heuristic is what finds nav and report captions that reach a
 * template with no pipe on them — so passing this one inline reads to it as a
 * missing translation key. A named constant is outside the pattern.
 */
const APPROVE_ACTION: ApprovalActionKind = "APPROVE";

/**
 * Four-eyes approval queues and the flow-guard bypass log.
 *
 * Three sections, and they are not three views of one thing:
 *
 * 1. **Commands awaiting release** — A04's queue. The five commands that undo a
 *    completed accounting control (the three write-offs, `fiscal_period.reopen`,
 *    `date_roll.manual`) are recorded as `approval_requests` rows by
 *    `acceptCommand` instead of being written to the outbox, and releasing one
 *    *dispatches the stored payload*. Until this section existed the queue had
 *    routes and no screen: an operator submitted a write-off, was honestly told
 *    it had been queued, and nobody in the product could release it. That is a
 *    control that fails closed on itself.
 * 2. **Billing operations** — the older queue, for privileged billing operations.
 * 3. **Flow-guard bypasses** — the `force`-override audit trail.
 *
 * The approve/reject buttons in section 1 are gated by
 * `evaluateApprovalAction`, the same pure evaluator the gateway runs inside the
 * transaction that locks the row. Using it here rather than restating its four
 * rules means the button cannot come to disagree with the server about who may
 * sign — and the refusal it returns is the message shown, so an operator who
 * cannot approve is told which rule stopped them instead of discovering it from
 * a toast. It stays advisory: the decision that counts is the server's.
 */
@Component({
	selector: "app-approvals",
	standalone: true,
	imports: [
		FormsModule,
		IconComponent,
		LocaleDatePipe,
		PageHeaderComponent,
		SubmitOnEnterDirective,
		TranslatePipe,
	],
	templateUrl: "./approvals.html",
	styleUrl: "./approvals.scss",
})
export class ApprovalsComponent {
	private readonly api = inject(ApiService);
	private readonly i18n = inject(I18nService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	private readonly toast = inject(ToastService);

	readonly pending = signal<ApprovalRequest[]>([]);
	readonly commands = signal<CommandApprovalView[]>([]);
	readonly bypasses = signal<FlowApproval[]>([]);
	readonly loading = signal(false);
	readonly loadingCommands = signal(false);
	readonly loadingBypasses = signal(false);
	readonly submitting = signal(false);

	readonly decision = signal<Decision | null>(null);
	readonly reason = signal("");

	/**
	 * Expiring within the hour — after that the request dies and has to be raised
	 * again from scratch.
	 *
	 * Both queues, because the card counting them sits above both: counting only
	 * the billing one left it reading "0" while a command row beside it was
	 * badged `1h`, which is the sort of quiet disagreement that teaches an
	 * operator to stop trusting the number.
	 */
	readonly expiringSoon = computed(() => [
		...this.commands().filter((row) => this.hoursToExpiry(row.expires_at) <= 1),
		...this.pending().filter((row) => this.hoursToExpiry(row.expires_at) <= 1),
	]);

	readonly currentUserId = computed(() => this.auth.user()?.id ?? "");
	readonly currentRole = computed(() => this.auth.activeMembership()?.role ?? null);

	/**
	 * Whether this operator is on the command queue's endpoint at all.
	 *
	 * `COMMAND_APPROVER_FLOOR` is computed from `COMMAND_DUAL_CONTROL`, so it
	 * follows the declarations rather than restating them — the day a command is
	 * deferred at a lower role this stops asking for OWNER on its own. Checking
	 * it here is not a second gate: it decides whether to make a request that
	 * would 403, and lets the section explain the empty space instead.
	 */
	readonly canSeeCommandQueue = computed(() =>
		tenantRoleAtLeast(this.currentRole(), COMMAND_APPROVER_FLOOR),
	);

	readonly commandApproverFloor = COMMAND_APPROVER_FLOOR;

	/**
	 * Four-eyes: billing-service rejects a self-approval with
	 * `SELF_APPROVAL_FORBIDDEN`, so the button is disabled here rather than letting
	 * the operator discover the rule from an error toast.
	 */
	isOwnRequest(request: ApprovalRequest): boolean {
		const me = this.currentUserId();
		return me.length > 0 && request.requested_by === me;
	}

	/**
	 * The shared evaluator's verdict on this operator releasing this row.
	 *
	 * Pure and side-effect free, so it is safe to call from the template. The
	 * order of its rules is the policy — pending, unexpired, not the requester,
	 * clears `required_role` — and it is deliberately not restated here.
	 */
	commandGate(row: CommandApprovalView): ApprovalDecision {
		return evaluateApprovalAction({
			action: APPROVE_ACTION,
			status: row.status,
			expiresAt: row.expires_at,
			requestedBy: row.requested_by,
			requiredRole: row.required_role,
			actorId: this.currentUserId(),
			actorRole: this.currentRole(),
		});
	}

	canApproveCommand(row: CommandApprovalView): boolean {
		return this.commandGate(row).ok;
	}

	/** Why the approve button is disabled, in the evaluator's own words. */
	commandBlockedBecause(row: CommandApprovalView): string {
		const verdict = this.commandGate(row);
		return verdict.ok ? "" : verdict.message;
	}

	/** Whether this row is the operator's own request — the four-eyes rule, named. */
	isOwnCommand(row: CommandApprovalView): boolean {
		const me = this.currentUserId();
		return me.length > 0 && row.requested_by === me;
	}

	/**
	 * Rejecting needs no more authority than seeing the request — `evaluateApprovalAction`
	 * only applies `required_role` to an APPROVE. What it must never be is a
	 * self-rejection dressed as a decision, so the requester is kept off both buttons.
	 */
	canRejectCommand(row: CommandApprovalView): boolean {
		return row.status === "PENDING" && !this.isOwnCommand(row);
	}

	/** A rejection must say why; the API requires a non-empty reason. */
	readonly canSubmitDecision = computed(() => {
		const decision = this.decision();
		if (!decision) return false;
		if (decision.kind === "reject") return this.reason().trim().length > 0;
		return true;
	});

	/** The heading of the confirmation card — the verb, then what it acts on. */
	readonly decisionSubject = computed(() => {
		const decision = this.decision();
		if (!decision) return "";
		return decision.queue === "command"
			? decision.request.command_name
			: this.labelFor(decision.request.operation_type);
	});

	constructor() {
		effect(() => {
			if (this.auth.tenantId()) {
				this.load();
				this.loadCommands();
				this.loadBypasses();
			}
		});
	}

	hoursToExpiry(expiresAt: string): number {
		return Math.round((Date.parse(expiresAt) - Date.now()) / HOUR_MS);
	}

	expiryLabel(expiresAt: string): string {
		const hours = this.hoursToExpiry(expiresAt);
		if (hours < 0) return this.i18n.t("Expired");
		if (hours === 0) return this.i18n.t("Under an hour");
		return `${hours}h`;
	}

	labelFor(value: string | undefined): string {
		if (!value) return "—";
		return value.replace(/[_.]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
	}

	/** The payload is what is actually being approved, so it is shown verbatim. */
	payloadText(payload: Record<string, unknown> | undefined): string {
		if (!payload) return "";
		try {
			return JSON.stringify(payload, null, 2);
		} catch {
			return "";
		}
	}

	async load(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;
		this.loading.set(true);
		try {
			const params: Record<string, string> = { tenant_id: tenantId, limit: "200" };
			const propertyId = this.ctx.propertyId();
			if (propertyId) params["property_id"] = propertyId;
			const res = await this.api.get<{ data: ApprovalRequest[] }>(
				"/billing/approvals/pending",
				params,
			);
			this.pending.set(res?.data ?? []);
		} catch (e) {
			this.toast.error(
				e instanceof Error ? e.message : this.i18n.t("Failed to load pending approvals"),
			);
		} finally {
			this.loading.set(false);
		}
	}

	/**
	 * The deferred-command queue. Tenant-scoped in the path, and the route
	 * answers with a bare array rather than `{ data }` — the two queues were
	 * built at different times and their envelopes differ, which is worth
	 * tolerating here rather than changing a published response shape.
	 */
	async loadCommands(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId || !this.canSeeCommandQueue()) {
			this.commands.set([]);
			return;
		}
		this.loadingCommands.set(true);
		try {
			const res = await this.api.get<CommandApprovalView[] | { data: CommandApprovalView[] }>(
				`/tenants/${tenantId}/commands/approvals`,
				{ limit: "200" },
			);
			this.commands.set(Array.isArray(res) ? res : (res?.data ?? []));
		} catch (e) {
			this.toast.error(
				e instanceof Error ? e.message : this.i18n.t("Failed to load commands awaiting release"),
			);
		} finally {
			this.loadingCommands.set(false);
		}
	}

	async loadBypasses(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;
		this.loadingBypasses.set(true);
		try {
			const res = await this.api.get<{ data: FlowApproval[] } | FlowApproval[]>(
				"/billing/flow-approvals",
				{ tenant_id: tenantId, limit: "100" },
			);
			this.bypasses.set(Array.isArray(res) ? res : (res?.data ?? []));
		} catch {
			/* the bypass log is supplementary; a failure must not hide the queue */
		} finally {
			this.loadingBypasses.set(false);
		}
	}

	refreshAll(): void {
		void this.load();
		void this.loadCommands();
		void this.loadBypasses();
	}

	open(kind: OperationsDecision["kind"], request: ApprovalRequest): void {
		this.reason.set("");
		this.decision.set({ queue: "operations", kind, request });
	}

	openCommand(kind: CommandDecision["kind"], request: CommandApprovalView): void {
		this.reason.set("");
		this.decision.set({ queue: "command", kind, request });
	}

	cancelDecision(): void {
		this.decision.set(null);
	}

	async submitDecision(): Promise<void> {
		const decision = this.decision();
		const tenantId = this.auth.tenantId();
		if (!decision || !tenantId || !this.canSubmitDecision() || this.submitting()) return;

		// The acting identity is no longer sent: the API takes it from the bearer
		// token, so that a four-eyes approval cannot be attributed to someone the
		// caller names. The signed-in check stays because an unauthenticated
		// submit would only fail at the server.
		const user = this.auth.user();
		if (!user?.id) {
			this.toast.error(this.i18n.t("Cannot action an approval without a signed-in user."));
			return;
		}

		this.submitting.set(true);
		try {
			if (decision.queue === "command") {
				await this.submitCommandDecision(decision, tenantId);
			} else {
				await this.submitOperationsDecision(decision, tenantId, user);
			}
			this.decision.set(null);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : this.failureMessage(decision));
		} finally {
			this.submitting.set(false);
		}
	}

	/**
	 * Releasing a command dispatches its stored payload, so the toast names the
	 * command it became. "Approved." would understate it: approving here *causes*
	 * the operation rather than annotating one that already ran, and the command
	 * id is what the operator follows into the command log if it fails downstream.
	 */
	private async submitCommandDecision(decision: CommandDecision, tenantId: string): Promise<void> {
		const reason = this.reason().trim();
		const body: Record<string, unknown> = {};
		if (reason) body["reason"] = reason;

		const path = `/tenants/${tenantId}/commands/approvals/${decision.request.approval_id}/${decision.kind}`;

		if (decision.kind === "approve") {
			const res = await this.api.post<{ command_id?: string | null }>(path, body);
			const commandId = res?.command_id;
			this.toast.success(
				commandId
					? this.i18n.t("Released — dispatched as command {commandId}.", {
							commandId,
						})
					: this.i18n.t("Released."),
			);
		} else {
			await this.api.post(path, body);
			this.toast.success(this.i18n.t("Refused. Nothing was dispatched."));
		}
		await this.loadCommands();
	}

	private async submitOperationsDecision(
		decision: OperationsDecision,
		tenantId: string,
		user: NonNullable<ReturnType<AuthService["user"]>>,
	): Promise<void> {
		const actorName = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username;
		const reason = this.reason().trim();
		const { kind, request } = decision;

		const body: Record<string, unknown> = { tenant_id: tenantId };
		if (kind === "cancel") {
			if (reason) body["reason"] = reason;
		} else {
			if (actorName) body["actioned_by_name"] = actorName;
			if (kind === "reject") body["reason"] = reason;
			else if (reason) body["reason"] = reason;
		}

		await this.api.post(`/billing/approvals/${request.approval_id}/${kind}`, body);
		this.toast.success(
			kind === "approve"
				? this.i18n.t("Approved.")
				: kind === "reject"
					? this.i18n.t("Rejected.")
					: this.i18n.t("Request cancelled."),
		);
		await this.load();
	}

	private failureMessage(decision: Decision): string {
		switch (decision.kind) {
			case "approve":
				return this.i18n.t("Failed to approve the request");
			case "reject":
				return this.i18n.t("Failed to reject the request");
			default:
				return this.i18n.t("Failed to cancel the request");
		}
	}

	bypassKey(row: FlowApproval): string {
		return row.id;
	}
}
