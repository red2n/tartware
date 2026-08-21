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
 * How the front desk transfers open issues across a shift change: VIP arriving
 * late, room 312 complaint unresolved, cash discrepancy pending.
 *
 * The money half of a shift change already worked — `billing.cashier.handover`
 * and the cashier-sessions screen. This is the operational half, which was
 * read-only until 2026-08-13. See ui-gaps/08-shift-handovers.md.
 */
type ShiftHandover = {
	handover_id: string;
	property_id: string;
	handover_number?: string;
	handover_title?: string;
	shift_date: string;
	outgoing_shift: string;
	outgoing_user_id: string;
	outgoing_user_name?: string;
	incoming_shift: string;
	incoming_user_id: string;
	incoming_user_name?: string;
	department: string;
	department_display: string;
	handover_status: string;
	handover_status_display: string;
	handover_started_at?: string;
	handover_completed_at?: string;
	current_occupancy_percent?: string;
	expected_arrivals_count?: number;
	expected_departures_count?: number;
	tasks_pending?: number;
	tasks_urgent?: number;
	key_points: string;
	requires_follow_up?: boolean;
	acknowledged?: boolean;
	created_at?: string;
};

const SHIFTS = ["morning", "afternoon", "evening", "night"] as const;

const DEPARTMENTS = [
	"front_desk",
	"housekeeping",
	"maintenance",
	"food_beverage",
	"management",
	"sales",
	"security",
	"spa",
	"concierge",
	"other",
] as const;

const STATUSES = ["pending", "in_progress", "completed", "acknowledged", "escalated"] as const;

/** Statuses where the handover has not yet been taken by the incoming shift. */
const OPEN_STATUSES = new Set(["pending", "in_progress", "completed", "escalated"]);

@Component({
	selector: "app-shift-handovers",
	standalone: true,
	imports: [DatePipe, FormsModule, IconComponent, PageHeaderComponent, SubmitOnEnterDirective],
	templateUrl: "./shift-handovers.html",
})
export class ShiftHandoversComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	private readonly toast = inject(ToastService);

	readonly shifts = SHIFTS;
	readonly departments = DEPARTMENTS;
	readonly statuses = STATUSES;

	readonly handovers = signal<ShiftHandover[]>([]);
	readonly loading = signal(false);
	readonly submitting = signal(false);
	readonly statusFilter = signal("");
	readonly departmentFilter = signal("");
	readonly dateFilter = signal("");

	readonly opening = signal(false);
	readonly editing = signal<ShiftHandover | null>(null);
	readonly form = signal({
		shift_date: "",
		department: "front_desk" as string,
		outgoing_shift: "morning" as string,
		outgoing_user_id: "",
		outgoing_user_name: "",
		incoming_shift: "afternoon" as string,
		incoming_user_id: "",
		incoming_user_name: "",
		handover_title: "",
		key_points: "",
		important_notes: "",
		urgent_matters: "",
		requires_follow_up: false,
		cash_on_hand: null as number | null,
		deposits_to_make: null as number | null,
		payment_issues: "",
		staff_issues: "",
		special_situations: "",
		handover_status: "in_progress" as string,
	});

	readonly ackTarget = signal<ShiftHandover | null>(null);
	readonly ackForm = signal({
		acknowledgment_notes: "",
		questions_asked: "",
		handover_quality_rating: null as number | null,
	});

	/**
	 * The point of the feature: an unacknowledged handover from a previous shift
	 * is something someone has to read before the day moves on.
	 */
	readonly awaitingAcknowledgement = computed(() =>
		this.handovers().filter((h) => !h.acknowledged && OPEN_STATUSES.has(h.handover_status)),
	);

	/** Unresolved items that should carry into the next shift rather than vanish. */
	readonly needingFollowUp = computed(() =>
		this.handovers().filter((h) => h.requires_follow_up && !h.acknowledged),
	);

	readonly canSubmitForm = computed(() => {
		const f = this.form();
		if (f.key_points.trim().length === 0) return false;
		if (this.editing()) return true;
		return (
			f.shift_date.trim().length > 0 &&
			f.outgoing_user_id.trim().length > 0 &&
			f.incoming_user_id.trim().length > 0
		);
	});

	constructor() {
		effect(() => {
			if (this.auth.tenantId()) this.load();
		});
	}

	labelFor(value: string | undefined): string {
		if (!value) return "—";
		return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
	}

	statusClass(status: string): string {
		switch (status) {
			case "acknowledged":
				return "badge badge-accent badge-sm";
			case "escalated":
				return "badge badge-attention badge-sm";
			case "completed":
				return "badge badge-warning badge-sm";
			case "in_progress":
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
			if (status) params["handover_status"] = status;
			const department = this.departmentFilter().trim();
			if (department) params["department"] = department;
			const date = this.dateFilter().trim();
			if (date) params["shift_date"] = date;

			const res = await this.api.get<{ data: ShiftHandover[] } | ShiftHandover[]>(
				"/shift-handovers",
				params,
			);
			this.handovers.set(Array.isArray(res) ? res : (res?.data ?? []));
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to load shift handovers");
		} finally {
			this.loading.set(false);
		}
	}

	openHandover(): void {
		this.editing.set(null);
		this.form.set({
			shift_date: new Date().toISOString().slice(0, 10),
			department: "front_desk",
			outgoing_shift: "morning",
			// Pre-filled with the signed-in user: the person opening a handover is
			// almost always the one going off shift.
			outgoing_user_id: this.auth.user()?.id ?? "",
			outgoing_user_name: "",
			incoming_shift: "afternoon",
			incoming_user_id: "",
			incoming_user_name: "",
			handover_title: "",
			key_points: "",
			important_notes: "",
			urgent_matters: "",
			requires_follow_up: false,
			cash_on_hand: null,
			deposits_to_make: null,
			payment_issues: "",
			staff_issues: "",
			special_situations: "",
			handover_status: "in_progress",
		});
		this.opening.set(true);
	}

	openEdit(handover: ShiftHandover): void {
		this.editing.set(handover);
		this.form.set({
			shift_date: handover.shift_date.slice(0, 10),
			department: handover.department,
			outgoing_shift: handover.outgoing_shift,
			outgoing_user_id: handover.outgoing_user_id,
			outgoing_user_name: handover.outgoing_user_name ?? "",
			incoming_shift: handover.incoming_shift,
			incoming_user_id: handover.incoming_user_id,
			incoming_user_name: handover.incoming_user_name ?? "",
			handover_title: handover.handover_title ?? "",
			key_points: handover.key_points,
			important_notes: "",
			urgent_matters: "",
			requires_follow_up: handover.requires_follow_up ?? false,
			cash_on_hand: null,
			deposits_to_make: null,
			payment_issues: "",
			staff_issues: "",
			special_situations: "",
			handover_status: handover.handover_status,
		});
		this.opening.set(true);
	}

	cancelForm(): void {
		this.opening.set(false);
		this.editing.set(null);
	}

	async submitForm(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId || !this.canSubmitForm() || this.submitting()) return;

		const existing = this.editing();
		if (!existing && !propertyId) {
			this.toast.error("Select a property before opening a handover.");
			return;
		}

		const f = this.form();
		const optional = (value: string) => value.trim();
		const shared: Record<string, unknown> = {
			tenant_id: tenantId,
			key_points: f.key_points.trim(),
			requires_follow_up: f.requires_follow_up,
			...(optional(f.handover_title) ? { handover_title: optional(f.handover_title) } : {}),
			...(optional(f.important_notes) ? { important_notes: optional(f.important_notes) } : {}),
			...(optional(f.urgent_matters) ? { urgent_matters: optional(f.urgent_matters) } : {}),
			...(f.cash_on_hand != null ? { cash_on_hand: f.cash_on_hand } : {}),
			...(f.deposits_to_make != null ? { deposits_to_make: f.deposits_to_make } : {}),
			...(optional(f.payment_issues) ? { payment_issues: optional(f.payment_issues) } : {}),
			...(optional(f.staff_issues) ? { staff_issues: optional(f.staff_issues) } : {}),
			...(optional(f.special_situations)
				? { special_situations: optional(f.special_situations) }
				: {}),
		};

		this.submitting.set(true);
		try {
			if (existing) {
				await this.api.put(`/shift-handovers/${existing.handover_id}`, {
					...shared,
					handover_status: f.handover_status,
				});
				this.toast.success("Handover updated.");
			} else {
				await this.api.post("/shift-handovers", {
					...shared,
					property_id: propertyId,
					shift_date: f.shift_date,
					department: f.department,
					outgoing_shift: f.outgoing_shift,
					outgoing_user_id: f.outgoing_user_id.trim(),
					incoming_shift: f.incoming_shift,
					incoming_user_id: f.incoming_user_id.trim(),
					...(optional(f.outgoing_user_name)
						? { outgoing_user_name: optional(f.outgoing_user_name) }
						: {}),
					...(optional(f.incoming_user_name)
						? { incoming_user_name: optional(f.incoming_user_name) }
						: {}),
				});
				this.toast.success("Handover opened.");
			}
			this.opening.set(false);
			this.editing.set(null);
			await this.load();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to save handover");
		} finally {
			this.submitting.set(false);
		}
	}

	openAcknowledge(handover: ShiftHandover): void {
		this.ackForm.set({
			acknowledgment_notes: "",
			questions_asked: "",
			handover_quality_rating: null,
		});
		this.ackTarget.set(handover);
	}

	cancelAcknowledge(): void {
		this.ackTarget.set(null);
	}

	async submitAcknowledge(): Promise<void> {
		const handover = this.ackTarget();
		const tenantId = this.auth.tenantId();
		if (!handover || !tenantId || this.submitting()) return;
		const f = this.ackForm();
		this.submitting.set(true);
		try {
			await this.api.post(`/shift-handovers/${handover.handover_id}/acknowledge`, {
				tenant_id: tenantId,
				...(f.acknowledgment_notes.trim()
					? { acknowledgment_notes: f.acknowledgment_notes.trim() }
					: {}),
				...(f.questions_asked.trim() ? { questions_asked: f.questions_asked.trim() } : {}),
				...(f.handover_quality_rating != null
					? { handover_quality_rating: f.handover_quality_rating }
					: {}),
			});
			this.toast.success("Handover acknowledged.");
			this.ackTarget.set(null);
			await this.load();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to acknowledge handover");
		} finally {
			this.submitting.set(false);
		}
	}
}
