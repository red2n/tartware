import { DatePipe } from "@angular/common";
import { Component, computed, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ApiService } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { TenantContextService } from "../../../core/context/tenant-context.service";
import { IconComponent } from "../../../shared/components/icon/icon";
import { PageHeaderComponent } from "../../../shared/components/page-header/page-header";
import { SubmitOnEnterDirective } from "../../../shared/forms/submit-on-enter.directive";
import { ToastService } from "../../../shared/toast/toast.service";

/**
 * A piece of guest feedback and its handling state.
 *
 * Feedback with no intake and no response workflow is a table that stays empty;
 * both halves were missing until 2026-08-13. The complaint-handling columns
 * (`feedback_status`, `assigned_to`, `resolution_notes`) were added with this
 * screen. See ui-gaps/09-guest-feedback.md.
 */
type Feedback = {
	id: string;
	property_id: string;
	guest_id?: string;
	guest_name?: string;
	reservation_id?: string;
	feedback_source?: string;
	feedback_source_display?: string;
	overall_rating?: string;
	rating_scale?: number;
	cleanliness_rating?: string;
	staff_rating?: string;
	location_rating?: string;
	value_rating?: string;
	review_title?: string;
	review_text?: string;
	would_recommend?: boolean;
	would_return?: boolean;
	sentiment_label?: string;
	is_verified?: boolean;
	is_public?: boolean;
	is_featured?: boolean;
	response_text?: string;
	responded_at?: string;
	created_at?: string;
	feedback_status?: string;
	feedback_status_display?: string;
	feedback_category?: string;
	assigned_to?: string;
	assigned_at?: string;
	resolution_notes?: string;
	resolved_at?: string;
	service_recovery_reference?: string;
};

const SOURCES = [
	"STAFF_ENTERED",
	"GUEST_PORTAL",
	"PHONE",
	"EMAIL",
	"EMAIL_SURVEY",
	"SMS_SURVEY",
	"IN_APP",
	"OTA_REVIEW",
	"GOOGLE",
	"TRIPADVISOR",
	"BOOKING_COM",
] as const;

const STATUSES = [
	"new",
	"acknowledged",
	"in_progress",
	"responded",
	"resolved",
	"closed",
] as const;

const SENTIMENTS = ["POSITIVE", "NEUTRAL", "NEGATIVE"] as const;

/** Statuses where someone still owes the guest an answer. */
const OPEN_STATUSES = new Set(["new", "acknowledged", "in_progress"]);

@Component({
	selector: "app-guest-feedback",
	standalone: true,
	imports: [DatePipe, FormsModule, IconComponent, PageHeaderComponent, SubmitOnEnterDirective],
	templateUrl: "./feedback.html",
})
export class GuestFeedbackComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	private readonly toast = inject(ToastService);

	readonly sources = SOURCES;
	readonly statuses = STATUSES;
	readonly sentiments = SENTIMENTS;

	readonly items = signal<Feedback[]>([]);
	readonly loading = signal(false);
	readonly submitting = signal(false);
	readonly statusFilter = signal("");
	readonly sentimentFilter = signal("");
	readonly categoryFilter = signal("");
	readonly unresolvedOnly = signal(false);

	readonly logging = signal(false);
	readonly form = signal({
		feedback_source: "STAFF_ENTERED" as string,
		review_title: "",
		review_text: "",
		feedback_category: "",
		overall_rating: null as number | null,
		sentiment_label: "NEGATIVE" as string,
		guest_id: "",
		reservation_id: "",
		is_public: false,
	});

	readonly triageTarget = signal<Feedback | null>(null);
	readonly triageForm = signal({
		feedback_category: "",
		sentiment_label: "",
		feedback_status: "",
		assigned_to: "",
	});

	readonly respondTarget = signal<Feedback | null>(null);
	readonly respondForm = signal({ response_text: "", is_public: false });

	readonly resolveTarget = signal<Feedback | null>(null);
	readonly resolveForm = signal({
		resolution_notes: "",
		service_recovery_reference: "",
		feedback_status: "resolved" as string,
	});

	readonly unresolved = computed(() =>
		this.items().filter((f) => OPEN_STATUSES.has(f.feedback_status ?? "new")),
	);

	/** Negative feedback nobody has answered is the queue that costs a guest. */
	readonly awaitingResponse = computed(() =>
		this.unresolved().filter((f) => !f.response_text),
	);

	readonly visibleItems = computed(() =>
		this.unresolvedOnly() ? this.unresolved() : this.items(),
	);

	readonly canLog = computed(() => this.form().review_text.trim().length > 0);
	readonly canRespond = computed(() => this.respondForm().response_text.trim().length > 0);
	readonly canResolve = computed(() => this.resolveForm().resolution_notes.trim().length > 0);

	constructor() {
		effect(() => {
			if (this.auth.tenantId()) this.load();
		});
	}

	labelFor(value: string | undefined): string {
		if (!value) return "—";
		return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
	}

	statusClass(status: string | undefined): string {
		switch (status) {
			case "resolved":
			case "closed":
				return "badge badge-muted badge-sm";
			case "responded":
				return "badge badge-accent badge-sm";
			case "in_progress":
			case "acknowledged":
				return "badge badge-warning badge-sm";
			default:
				return "badge badge-attention badge-sm";
		}
	}

	sentimentClass(sentiment: string | undefined): string {
		switch (sentiment) {
			case "POSITIVE":
				return "badge badge-accent badge-sm";
			case "NEGATIVE":
				return "badge badge-attention badge-sm";
			case "NEUTRAL":
				return "badge badge-muted badge-sm";
			default:
				return "badge badge-muted badge-sm";
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
			const status = this.statusFilter().trim();
			if (status) params["feedback_status"] = status;
			const sentiment = this.sentimentFilter().trim();
			if (sentiment) params["sentiment_label"] = sentiment;
			const category = this.categoryFilter().trim();
			if (category) params["feedback_category"] = category;

			const res = await this.api.get<{ data: Feedback[] } | Feedback[]>("/guest-feedback", params);
			this.items.set(Array.isArray(res) ? res : (res?.data ?? []));
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to load guest feedback");
		} finally {
			this.loading.set(false);
		}
	}

	openLog(): void {
		this.form.set({
			feedback_source: "STAFF_ENTERED",
			review_title: "",
			review_text: "",
			feedback_category: "",
			overall_rating: null,
			// Staff log complaints far more often than compliments; the operator can change it.
			sentiment_label: "NEGATIVE",
			guest_id: "",
			reservation_id: "",
			is_public: false,
		});
		this.logging.set(true);
	}

	cancelLog(): void {
		this.logging.set(false);
	}

	async submitLog(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId || !this.canLog() || this.submitting()) return;
		if (!propertyId) {
			this.toast.error("Select a property before logging feedback.");
			return;
		}
		const f = this.form();
		this.submitting.set(true);
		try {
			await this.api.post("/guest-feedback", {
				tenant_id: tenantId,
				property_id: propertyId,
				feedback_source: f.feedback_source,
				review_text: f.review_text.trim(),
				sentiment_label: f.sentiment_label,
				is_public: f.is_public,
				...(f.review_title.trim() ? { review_title: f.review_title.trim() } : {}),
				...(f.feedback_category.trim() ? { feedback_category: f.feedback_category.trim() } : {}),
				...(f.overall_rating != null ? { overall_rating: f.overall_rating } : {}),
				...(f.guest_id.trim() ? { guest_id: f.guest_id.trim() } : {}),
				...(f.reservation_id.trim() ? { reservation_id: f.reservation_id.trim() } : {}),
			});
			this.toast.success("Feedback logged.");
			this.logging.set(false);
			await this.load();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to log feedback");
		} finally {
			this.submitting.set(false);
		}
	}

	openTriage(item: Feedback): void {
		this.triageForm.set({
			feedback_category: item.feedback_category ?? "",
			sentiment_label: item.sentiment_label ?? "",
			feedback_status: item.feedback_status ?? "new",
			assigned_to: item.assigned_to ?? "",
		});
		this.triageTarget.set(item);
	}

	cancelTriage(): void {
		this.triageTarget.set(null);
	}

	async submitTriage(): Promise<void> {
		const item = this.triageTarget();
		const tenantId = this.auth.tenantId();
		if (!item || !tenantId || this.submitting()) return;
		const f = this.triageForm();
		this.submitting.set(true);
		try {
			await this.api.put(`/guest-feedback/${item.id}`, {
				tenant_id: tenantId,
				...(f.feedback_category.trim() ? { feedback_category: f.feedback_category.trim() } : {}),
				...(f.sentiment_label.trim() ? { sentiment_label: f.sentiment_label.trim() } : {}),
				...(f.feedback_status.trim() ? { feedback_status: f.feedback_status.trim() } : {}),
				...(f.assigned_to.trim() ? { assigned_to: f.assigned_to.trim() } : {}),
			});
			this.toast.success("Feedback updated.");
			this.triageTarget.set(null);
			await this.load();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to update feedback");
		} finally {
			this.submitting.set(false);
		}
	}

	openRespond(item: Feedback): void {
		this.respondForm.set({
			response_text: item.response_text ?? "",
			is_public: item.is_public ?? false,
		});
		this.respondTarget.set(item);
	}

	cancelRespond(): void {
		this.respondTarget.set(null);
	}

	async submitRespond(): Promise<void> {
		const item = this.respondTarget();
		const tenantId = this.auth.tenantId();
		if (!item || !tenantId || !this.canRespond() || this.submitting()) return;
		const f = this.respondForm();
		this.submitting.set(true);
		try {
			await this.api.post(`/guest-feedback/${item.id}/respond`, {
				tenant_id: tenantId,
				response_text: f.response_text.trim(),
				is_public: f.is_public,
			});
			this.toast.success("Response recorded.");
			this.respondTarget.set(null);
			await this.load();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to record response");
		} finally {
			this.submitting.set(false);
		}
	}

	openResolve(item: Feedback): void {
		this.resolveForm.set({
			resolution_notes: item.resolution_notes ?? "",
			service_recovery_reference: item.service_recovery_reference ?? "",
			feedback_status: "resolved",
		});
		this.resolveTarget.set(item);
	}

	cancelResolve(): void {
		this.resolveTarget.set(null);
	}

	async submitResolve(): Promise<void> {
		const item = this.resolveTarget();
		const tenantId = this.auth.tenantId();
		if (!item || !tenantId || !this.canResolve() || this.submitting()) return;
		const f = this.resolveForm();
		this.submitting.set(true);
		try {
			await this.api.post(`/guest-feedback/${item.id}/resolve`, {
				tenant_id: tenantId,
				resolution_notes: f.resolution_notes.trim(),
				feedback_status: f.feedback_status,
				...(f.service_recovery_reference.trim()
					? { service_recovery_reference: f.service_recovery_reference.trim() }
					: {}),
			});
			this.toast.success("Feedback resolved.");
			this.resolveTarget.set(null);
			await this.load();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to resolve feedback");
		} finally {
			this.submitting.set(false);
		}
	}
}
