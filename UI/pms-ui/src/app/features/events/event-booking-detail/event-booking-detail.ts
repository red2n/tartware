import { DatePipe } from "@angular/common";
import { Component, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import {
	EVENT_BOOKING_LEGAL_TRANSITIONS,
	type BanquetOrderDetail,
	type BanquetOrderListItem,
	type EventBookingDetail,
	type EventBookingStatus,
} from "@tartware/schemas";

import { ApiService } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { TranslatePipe } from "../../../core/i18n/translate.pipe";
import { IconComponent } from "../../../shared/components/icon/icon";
import { PageHeaderComponent } from "../../../shared/components/page-header/page-header";
import { SubmitOnEnterDirective } from "../../../shared/forms/submit-on-enter.directive";
import { UnsavedGuardDirective } from "../../../shared/forms/unsaved-guard.directive";
import { ToastService } from "../../../shared/toast/toast.service";

/**
 * Event booking detail — item 2 of ui-gaps/13-sales-catering.md.
 *
 * Everything the sales office needs about one booking: who it is for, what space
 * is held and for how long, what was promised, what it is worth, and where the
 * money lands. Lifecycle moves are offered from the shared transition map rather
 * than a local copy, so the screen never shows a button the service will refuse.
 */

const EVENT_TYPES = [
	"MEETING",
	"CONFERENCE",
	"WEDDING",
	"BANQUET",
	"TRAINING",
	"WORKSHOP",
	"RECEPTION",
	"SEMINAR",
	"TRADE_SHOW",
	"PARTY",
	"FUNDRAISER",
	"EXHIBITION",
	"OTHER",
] as const;

const SETUP_TYPES = [
	"THEATER",
	"CLASSROOM",
	"BANQUET",
	"RECEPTION",
	"U_SHAPE",
	"HOLLOW_SQUARE",
	"BOARDROOM",
] as const;

type EditForm = {
	event_name: string;
	event_type: string;
	event_date: string;
	start_time: string;
	end_time: string;
	setup_start_time: string;
	teardown_end_time: string;
	organizer_name: string;
	organizer_company: string;
	organizer_email: string;
	organizer_phone: string;
	contact_person: string;
	contact_email: string;
	contact_phone: string;
	expected_attendees: number | null;
	confirmed_attendees: number | null;
	guarantee_number: number | null;
	setup_type: string;
	setup_details: string;
	special_requests: string;
	catering_required: boolean;
	audio_visual_needed: boolean;
	beo_due_date: string;
	final_count_due_date: string;
	rental_rate: number | null;
	estimated_total: number | null;
	deposit_required: number | null;
	billing_instructions: string;
	billing_contact_name: string;
	billing_contact_email: string;
};

@Component({
	selector: "app-event-booking-detail",
	standalone: true,
	imports: [
		DatePipe,
		FormsModule,
		IconComponent,
		PageHeaderComponent,
		RouterLink,
		SubmitOnEnterDirective,
		TranslatePipe,
		UnsavedGuardDirective,
	],
	templateUrl: "./event-booking-detail.html",
	// No component styles — `.status-strip` and the BEO row list both live in
	// src/styles/shared.scss, per UI/AGENTS.md.
})
export class EventBookingDetailComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	private readonly toast = inject(ToastService);

	readonly eventTypes = EVENT_TYPES;
	readonly setupTypes = SETUP_TYPES;

	readonly booking = signal<EventBookingDetail | null>(null);
	readonly loading = signal(true);
	readonly submitting = signal(false);
	readonly notFound = signal(false);

	readonly editing = signal(false);
	readonly form = signal<EditForm | null>(null);

	/** The status the operator picked, pending confirmation. */
	readonly pendingStatus = signal<EventBookingStatus | null>(null);
	readonly cancellationReason = signal("");

	readonly skeletonRows = Array.from({ length: 5 });

	/** BEOs raised against this booking — every version, oldest first. */
	readonly beos = signal<BanquetOrderListItem[]>([]);
	readonly creatingBeo = signal(false);

	/** Only the moves the service will accept, from the shared map. */
	readonly nextStatuses = computed<readonly EventBookingStatus[]>(() => {
		const current = this.booking()?.booking_status;
		if (!current) return [];
		return EVENT_BOOKING_LEGAL_TRANSITIONS[current] ?? [];
	});

	readonly isTerminal = computed(() => this.nextStatuses().length === 0);

	/** The full window the room is held for, setup and teardown included. */
	readonly holdWindow = computed(() => {
		const b = this.booking();
		if (!b) return "";
		const from = this.shortTime(b.setup_start_time ?? b.start_time);
		const to = this.shortTime(b.teardown_end_time ?? b.end_time);
		return `${from} – ${to}`;
	});

	/** True when setup or teardown extends the hold beyond the event itself. */
	readonly hasHoldMargin = computed(() => {
		const b = this.booking();
		if (!b) return false;
		return Boolean(b.setup_start_time || b.teardown_end_time);
	});

	/**
	 * The versions still in force — one per BEO number, the one nothing has
	 * revised. What the operation is actually working from.
	 */
	readonly currentBeos = computed<BanquetOrderListItem[]>(() =>
		this.beos().filter((b) => !b.is_superseded),
	);

	readonly depositOutstanding = computed(() => {
		const b = this.booking();
		if (!b || b.deposit_required == null) return null;
		return b.deposit_required - (b.deposit_paid ?? 0);
	});

	constructor() {
		const id = this.route.snapshot.paramMap.get("eventId");
		if (id) void this.load(id);
		else this.notFound.set(true);
	}

	/**
	 * Enum value → readable label: `IN_PROGRESS` becomes "In Progress".
	 *
	 * The lowercase step matters — without it the value passes through unchanged
	 * (it is already uppercase) and the screen shouts "DEFINITE" at you, while the
	 * badge beside it reads "Definite" because that one comes from the server's
	 * own display label.
	 */
	labelFor(value: string | null | undefined): string {
		if (!value) return "—";
		return value
			.toLowerCase()
			.replace(/_/g, " ")
			.replace(/\b\w/g, (c) => c.toUpperCase());
	}

	shortTime(time: string | null): string {
		return (time ?? "").slice(0, 5);
	}

	statusClass(status: string): string {
		switch (status) {
			case "CONFIRMED":
			case "IN_PROGRESS":
				return "badge badge-accent";
			case "DEFINITE":
				return "badge badge-accent";
			case "TENTATIVE":
			case "INQUIRY":
				return "badge badge-warning";
			case "COMPLETED":
				return "badge badge-muted";
			default:
				return "badge badge-attention";
		}
	}

	async load(eventId: string): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;
		this.loading.set(true);
		try {
			const res = await this.api.get<EventBookingDetail>(`/event-bookings/${eventId}`, {
				tenant_id: tenantId,
			});
			this.booking.set(res);
			this.notFound.set(false);
			await this.loadBeos(eventId);
		} catch (e) {
			this.notFound.set(true);
			this.toast.error(e instanceof Error ? e.message : "Failed to load event booking");
		} finally {
			this.loading.set(false);
		}
	}

	async reload(): Promise<void> {
		const id = this.booking()?.event_id;
		if (id) await this.load(id);
	}

	backToCalendar(): void {
		void this.router.navigate(["/events/calendar"]);
	}

	// ── Editing ──

	openEdit(): void {
		const b = this.booking();
		if (!b) return;
		this.form.set({
			event_name: b.event_name,
			event_type: b.event_type,
			event_date: b.event_date.slice(0, 10),
			start_time: this.shortTime(b.start_time),
			end_time: this.shortTime(b.end_time),
			setup_start_time: this.shortTime(b.setup_start_time),
			teardown_end_time: this.shortTime(b.teardown_end_time),
			organizer_name: b.organizer_name,
			organizer_company: b.organizer_company ?? "",
			organizer_email: b.organizer_email ?? "",
			organizer_phone: b.organizer_phone ?? "",
			contact_person: b.contact_person ?? "",
			contact_email: b.contact_email ?? "",
			contact_phone: b.contact_phone ?? "",
			expected_attendees: b.expected_attendees,
			confirmed_attendees: b.confirmed_attendees,
			guarantee_number: b.guarantee_number,
			setup_type: b.setup_type,
			setup_details: b.setup_details ?? "",
			special_requests: b.special_requests ?? "",
			catering_required: b.catering_required,
			audio_visual_needed: b.audio_visual_needed,
			beo_due_date: b.beo_due_date?.slice(0, 10) ?? "",
			final_count_due_date: b.final_count_due_date?.slice(0, 10) ?? "",
			rental_rate: b.rental_rate,
			estimated_total: b.estimated_total,
			deposit_required: b.deposit_required,
			billing_instructions: b.billing_instructions ?? "",
			billing_contact_name: b.billing_contact_name ?? "",
			billing_contact_email: b.billing_contact_email ?? "",
		});
		this.editing.set(true);
	}

	cancelEdit(): void {
		this.editing.set(false);
		this.form.set(null);
	}

	patchForm(patch: Partial<EditForm>): void {
		const current = this.form();
		if (current) this.form.set({ ...current, ...patch });
	}

	readonly canSave = computed(() => {
		const f = this.form();
		if (!f) return false;
		if (f.event_name.trim().length === 0) return false;
		if (f.organizer_name.trim().length === 0) return false;
		if (f.expected_attendees == null || f.expected_attendees <= 0) return false;
		if (!f.start_time || !f.end_time || f.end_time <= f.start_time) return false;
		if (f.setup_start_time && f.setup_start_time > f.start_time) return false;
		return true;
	});

	async save(): Promise<void> {
		const b = this.booking();
		const f = this.form();
		const tenantId = this.auth.tenantId();
		if (!b || !f || !tenantId || !this.canSave() || this.submitting()) return;

		this.submitting.set(true);
		try {
			// Every field on the update schema is optional and the service COALESCEs,
			// so an empty string means "leave it alone" rather than "blank it".
			await this.api.put(`/event-bookings/${b.event_id}`, {
				tenant_id: tenantId,
				event_name: f.event_name.trim(),
				event_type: f.event_type,
				event_date: f.event_date,
				start_time: f.start_time,
				end_time: f.end_time,
				organizer_name: f.organizer_name.trim(),
				expected_attendees: f.expected_attendees,
				setup_type: f.setup_type,
				catering_required: f.catering_required,
				audio_visual_needed: f.audio_visual_needed,
				...(f.setup_start_time ? { setup_start_time: f.setup_start_time } : {}),
				...(f.teardown_end_time ? { teardown_end_time: f.teardown_end_time } : {}),
				...(f.organizer_company.trim() ? { organizer_company: f.organizer_company.trim() } : {}),
				...(f.organizer_email.trim() ? { organizer_email: f.organizer_email.trim() } : {}),
				...(f.organizer_phone.trim() ? { organizer_phone: f.organizer_phone.trim() } : {}),
				...(f.contact_person.trim() ? { contact_person: f.contact_person.trim() } : {}),
				...(f.contact_email.trim() ? { contact_email: f.contact_email.trim() } : {}),
				...(f.contact_phone.trim() ? { contact_phone: f.contact_phone.trim() } : {}),
				...(f.confirmed_attendees != null ? { confirmed_attendees: f.confirmed_attendees } : {}),
				...(f.guarantee_number != null ? { guarantee_number: f.guarantee_number } : {}),
				...(f.setup_details.trim() ? { setup_details: f.setup_details.trim() } : {}),
				...(f.special_requests.trim() ? { special_requests: f.special_requests.trim() } : {}),
				...(f.beo_due_date ? { beo_due_date: f.beo_due_date } : {}),
				...(f.final_count_due_date ? { final_count_due_date: f.final_count_due_date } : {}),
				...(f.rental_rate != null ? { rental_rate: f.rental_rate } : {}),
				...(f.estimated_total != null ? { estimated_total: f.estimated_total } : {}),
				...(f.deposit_required != null ? { deposit_required: f.deposit_required } : {}),
				...(f.billing_instructions.trim()
					? { billing_instructions: f.billing_instructions.trim() }
					: {}),
				...(f.billing_contact_name.trim()
					? { billing_contact_name: f.billing_contact_name.trim() }
					: {}),
				...(f.billing_contact_email.trim()
					? { billing_contact_email: f.billing_contact_email.trim() }
					: {}),
			});
			this.toast.success("Event booking updated.");
			this.editing.set(false);
			this.form.set(null);
			await this.reload();
		} catch (e) {
			// A 409 means the edit moved the booking onto space someone else holds.
			this.toast.error(e instanceof Error ? e.message : "Failed to update event booking");
		} finally {
			this.submitting.set(false);
		}
	}

	// ── Banquet event orders ──

	/**
	 * The BEOs for this booking.
	 *
	 * A failure here leaves the card empty rather than failing the screen: the
	 * booking is the thing the operator came for, and the BEO list is context.
	 */
	private async loadBeos(eventId: string): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;
		try {
			const res = await this.api.get<{ data: BanquetOrderListItem[] } | BanquetOrderListItem[]>(
				"/banquet-orders",
				{ tenant_id: tenantId, event_booking_id: eventId, limit: "200" },
			);
			this.beos.set(Array.isArray(res) ? res : (res?.data ?? []));
		} catch {
			this.beos.set([]);
		}
	}

	openBeo(beoId: string): void {
		void this.router.navigate(["/events/beos", beoId]);
	}

	/**
	 * Raise the first BEO for this booking.
	 *
	 * Everything a BEO requires is already known from the booking — the room, the
	 * date, the window, the layout and a head count — so this creates the draft
	 * from those rather than asking an operator to retype them, and drops them
	 * straight into the editor to fill in the F&B detail. `setup_start_time` is
	 * NOT NULL on the BEO where it is optional on the booking, so it falls back
	 * to the event start.
	 */
	async createBeo(): Promise<void> {
		const b = this.booking();
		const tenantId = this.auth.tenantId();
		if (!b || !tenantId || this.creatingBeo()) return;

		const guaranteed = b.guarantee_number ?? b.confirmed_attendees ?? b.expected_attendees;
		if (!guaranteed || guaranteed <= 0) {
			this.toast.error("Set an expected or guaranteed head count on the booking first.");
			return;
		}

		this.creatingBeo.set(true);
		try {
			const res = await this.api.post<{ data: BanquetOrderDetail } | BanquetOrderDetail>(
				"/banquet-orders",
				{
					tenant_id: tenantId,
					property_id: b.property_id,
					event_booking_id: b.event_id,
					meeting_room_id: b.meeting_room_id,
					event_date: b.event_date.slice(0, 10),
					setup_start_time: this.shortTime(b.setup_start_time ?? b.start_time),
					event_start_time: this.shortTime(b.start_time),
					event_end_time: this.shortTime(b.end_time),
					room_setup: b.setup_type,
					guaranteed_count: guaranteed,
					...(b.teardown_end_time
						? { teardown_end_time: this.shortTime(b.teardown_end_time) }
						: {}),
					...(b.expected_attendees ? { expected_count: b.expected_attendees } : {}),
					...(b.currency_code ? { currency_code: b.currency_code } : {}),
				},
			);
			const created = "data" in res ? res.data : res;
			this.toast.success(`${created.beo_number} created as a draft.`);
			void this.router.navigate(["/events/beos", created.beo_id]);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to create the BEO");
		} finally {
			this.creatingBeo.set(false);
		}
	}

	// ── Lifecycle ──

	askStatus(status: EventBookingStatus): void {
		this.cancellationReason.set("");
		this.pendingStatus.set(status);
	}

	cancelStatus(): void {
		this.pendingStatus.set(null);
	}

	async confirmStatus(): Promise<void> {
		const b = this.booking();
		const next = this.pendingStatus();
		const tenantId = this.auth.tenantId();
		if (!b || !next || !tenantId || this.submitting()) return;

		this.submitting.set(true);
		try {
			await this.api.post(`/event-bookings/${b.event_id}/status`, {
				tenant_id: tenantId,
				booking_status: next,
				...(next === "CANCELLED" && this.cancellationReason().trim()
					? { cancellation_reason: this.cancellationReason().trim() }
					: {}),
			});
			this.toast.success(`Booking moved to ${this.labelFor(next)}.`);
			this.pendingStatus.set(null);
			await this.reload();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to change status");
		} finally {
			this.submitting.set(false);
		}
	}
}
