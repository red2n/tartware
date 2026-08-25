import { Component, computed, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
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

type Decision = { kind: "approve" | "reject" | "cancel"; request: ApprovalRequest };

const HOUR_MS = 60 * 60 * 1000;

/**
 * Four-eyes approval queue and flow-guard bypass log.
 *
 * The backend for `accounts-gaps/08-approval-workflows.md` shipped without a
 * screen, so pending approvals were invisible: a privileged operation either
 * blocked forever or the enforcement was being worked around. The flow-approvals
 * half is the `force`-bypass audit trail from the flow-guard work — rows were being
 * written and nobody could read them, which defeats the point of recording an
 * override. See ui-gaps/12-billing-partials.md.
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
	readonly bypasses = signal<FlowApproval[]>([]);
	readonly loading = signal(false);
	readonly loadingBypasses = signal(false);
	readonly submitting = signal(false);

	readonly decision = signal<Decision | null>(null);
	readonly reason = signal("");

	/** Expiring within the hour — after that the request dies and has to be raised again. */
	readonly expiringSoon = computed(() =>
		this.pending().filter((request) => this.hoursToExpiry(request) <= 1),
	);

	readonly currentUserId = computed(() => this.auth.user()?.id ?? "");

	/**
	 * Four-eyes: billing-service rejects a self-approval with
	 * `SELF_APPROVAL_FORBIDDEN`, so the button is disabled here rather than letting
	 * the operator discover the rule from an error toast.
	 */
	isOwnRequest(request: ApprovalRequest): boolean {
		const me = this.currentUserId();
		return me.length > 0 && request.requested_by === me;
	}

	/** A rejection must say why; the API requires a non-empty reason. */
	readonly canSubmitDecision = computed(() => {
		const decision = this.decision();
		if (!decision) return false;
		if (decision.kind === "reject") return this.reason().trim().length > 0;
		return true;
	});

	constructor() {
		effect(() => {
			if (this.auth.tenantId()) {
				this.load();
				this.loadBypasses();
			}
		});
	}

	hoursToExpiry(request: ApprovalRequest): number {
		return Math.round((Date.parse(request.expires_at) - Date.now()) / HOUR_MS);
	}

	expiryLabel(request: ApprovalRequest): string {
		const hours = this.hoursToExpiry(request);
		if (hours < 0) return "Expired";
		if (hours === 0) return this.i18n.t("Under an hour");
		return `${hours}h`;
	}

	labelFor(value: string | undefined): string {
		if (!value) return "—";
		return value.replace(/[_.]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
	}

	/** The payload is what is actually being approved, so it is shown verbatim. */
	payloadText(request: ApprovalRequest): string {
		if (!request.operation_payload) return "";
		try {
			return JSON.stringify(request.operation_payload, null, 2);
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

	open(kind: Decision["kind"], request: ApprovalRequest): void {
		this.reason.set("");
		this.decision.set({ kind, request });
	}

	cancelDecision(): void {
		this.decision.set(null);
	}

	async submitDecision(): Promise<void> {
		const decision = this.decision();
		const tenantId = this.auth.tenantId();
		if (!decision || !tenantId || !this.canSubmitDecision() || this.submitting()) return;

		const user = this.auth.user();
		const actorId = user?.id ?? "";
		if (!actorId) {
			this.toast.error(this.i18n.t("Cannot action an approval without a signed-in user."));
			return;
		}
		const actorName =
			[user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.username;

		const reason = this.reason().trim();
		const { kind, request } = decision;

		this.submitting.set(true);
		try {
			const body: Record<string, unknown> = { tenant_id: tenantId };
			if (kind === "cancel") {
				body["cancelled_by"] = actorId;
				if (reason) body["reason"] = reason;
			} else {
				body["actioned_by"] = actorId;
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
			this.decision.set(null);
			await this.load();
		} catch (e) {
			this.toast.error(
				e instanceof Error
					? e.message
					: kind === "approve"
						? this.i18n.t("Failed to approve the request")
						: kind === "reject"
							? this.i18n.t("Failed to reject the request")
							: this.i18n.t("Failed to cancel the request"),
			);
		} finally {
			this.submitting.set(false);
		}
	}

	bypassKey(row: FlowApproval): string {
		return row.id;
	}
}
