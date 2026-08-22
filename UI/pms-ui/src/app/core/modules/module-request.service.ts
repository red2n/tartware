import { computed, Injectable, inject, signal } from "@angular/core";
import type { ModuleAccessRequest, ModuleId } from "@tartware/schemas";

import { ApiService } from "../api/api.service";
import { AuthService } from "../auth/auth.service";
import { I18nService } from "../i18n/i18n.service";

type RequestListResponse = { requests?: ModuleAccessRequest[] };

/** Roles allowed to decide a request — mirrors the endpoint's minRole. */
const REVIEWER_ROLES = new Set(["OWNER", "ADMIN"]);

/**
 * The one place that knows what a user can do about a switched-off module.
 *
 * Screens used to decide this themselves and got it wrong in the same way each
 * time — offering "Open Settings → Modules" to staff who cannot open that
 * screen. Here, `canReview()` answers it once from the caller's role, and
 * everything else hangs off that: reviewers get the queue, everyone else gets
 * a request to raise and the status of the one they already raised.
 */
@Injectable({ providedIn: "root" })
export class ModuleRequestService {
	private readonly api = inject(ApiService);
	private readonly i18n = inject(I18nService);
	private readonly auth = inject(AuthService);

	private readonly _mine = signal<ModuleAccessRequest[]>([]);
	private readonly _queue = signal<ModuleAccessRequest[]>([]);
	private readonly _loading = signal(false);

	/** Requests the current user raised, newest first. */
	readonly mine = this._mine.asReadonly();
	/** Every request for the tenant — populated only for reviewers. */
	readonly queue = this._queue.asReadonly();
	readonly loading = this._loading.asReadonly();

	/** True when the caller may approve or reject, i.e. is OWNER or ADMIN. */
	readonly canReview = computed(() => {
		const role = this.auth.activeMembership()?.role;
		return role !== undefined && REVIEWER_ROLES.has(role);
	});

	readonly pending = computed(() => this._queue().filter((r) => r.status === "pending"));

	/** The caller's own open ask for a module, if there is one. */
	pendingRequestFor(moduleId: string): ModuleAccessRequest | null {
		return (
			this._mine().find((r) => r.moduleId === moduleId && r.status === "pending") ??
			// A reviewer sees the tenant-wide queue instead of a personal list.
			this._queue().find((r) => r.moduleId === moduleId && r.status === "pending") ??
			null
		);
	}

	/**
	 * Loads whichever list the caller is entitled to. Reviewers get the tenant
	 * queue; everyone else gets their own requests — asking for the queue as a
	 * non-admin would just 403.
	 */
	async load(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;

		this._loading.set(true);
		try {
			if (this.canReview()) {
				const res = await this.api.get<RequestListResponse>(`/tenants/${tenantId}/module-requests`);
				this._queue.set(res.requests ?? []);
			} else {
				const res = await this.api.get<RequestListResponse>(
					`/tenants/${tenantId}/module-requests/mine`,
				);
				this._mine.set(res.requests ?? []);
			}
		} finally {
			this._loading.set(false);
		}
	}

	/** Raise a request. Throws the API error so the caller can surface it. */
	async request(input: {
		moduleId: ModuleId | string;
		requestedScreen?: string;
		propertyId?: string;
		reason?: string;
	}): Promise<ModuleAccessRequest> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) throw new Error(this.i18n.t("No property selected."));

		const created = await this.api.post<ModuleAccessRequest>(
			`/tenants/${tenantId}/module-requests`,
			{
				moduleId: input.moduleId,
				requestedScreen: input.requestedScreen,
				propertyId: input.propertyId,
				reason: input.reason?.trim() || undefined,
			},
		);
		this._mine.update((list) => [created, ...list.filter((r) => r.id !== created.id)]);
		return created;
	}

	/** Approve a request; the server switches the module on as part of this. */
	async approve(requestId: string, notes?: string): Promise<void> {
		await this.decide(requestId, "approve", notes);
	}

	async reject(requestId: string, notes?: string): Promise<void> {
		await this.decide(requestId, "reject", notes);
	}

	private async decide(requestId: string, verb: "approve" | "reject", notes?: string) {
		const tenantId = this.auth.tenantId();
		if (!tenantId) throw new Error(this.i18n.t("No property selected."));

		const res = await this.api.post<{ request: ModuleAccessRequest }>(
			`/tenants/${tenantId}/module-requests/${requestId}/${verb}`,
			{ notes: notes?.trim() || undefined },
		);
		this._queue.update((list) => list.map((r) => (r.id === requestId ? res.request : r)));
	}
}
