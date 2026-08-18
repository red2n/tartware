import { Component, computed, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import type { EventBookingListItem, MeetingRoomListItem } from "@tartware/schemas";

import { ApiService } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { TenantContextService } from "../../../core/context/tenant-context.service";
import { TranslatePipe } from "../../../core/i18n/translate.pipe";
import { SettingsService } from "../../../core/settings/settings.service";
import { IconComponent } from "../../../shared/components/icon/icon";
import { PageHeaderComponent } from "../../../shared/components/page-header/page-header";
import { SubmitOnEnterDirective } from "../../../shared/forms/submit-on-enter.directive";
import { UnsavedGuardDirective } from "../../../shared/forms/unsaved-guard.directive";
import { ToastService } from "../../../shared/toast/toast.service";

/**
 * Function space calendar — item 1 of ui-gaps/13-sales-catering.md, and the
 * primary working view for sales & catering.
 *
 * Modelled on `features/rate-calendar` as the spec asks: the same sticky
 * first column, the same date-window toolbar, the same horizontal scroll. What
 * differs is the cell — a rate calendar cell holds one editable number, a
 * function space cell holds however many bookings that room has that day, each
 * a link into its detail screen.
 *
 * Clicking an empty cell opens the booking form with the room and date already
 * filled in, because "who is in the Grand Ballroom on the 14th" and "put someone
 * in the Grand Ballroom on the 14th" are the same question asked twice.
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

const BOOKING_STATUSES = [
	"INQUIRY",
	"TENTATIVE",
	"DEFINITE",
	"CONFIRMED",
	"IN_PROGRESS",
	"COMPLETED",
	"CANCELLED",
	"NO_SHOW",
] as const;

/** Statuses that still hold the room — the ones the overlap check enforces. */
const HOLDING_STATUSES = new Set([
	"INQUIRY",
	"TENTATIVE",
	"DEFINITE",
	"CONFIRMED",
	"IN_PROGRESS",
	"COMPLETED",
]);

type BookingForm = {
	meeting_room_id: string;
	event_date: string;
	event_name: string;
	event_type: string;
	start_time: string;
	end_time: string;
	setup_start_time: string;
	teardown_end_time: string;
	organizer_name: string;
	organizer_company: string;
	organizer_email: string;
	organizer_phone: string;
	expected_attendees: number | null;
	setup_type: string;
	special_requests: string;
	catering_required: boolean;
	audio_visual_needed: boolean;
	rental_rate: number | null;
	currency_code: string;
};

const emptyForm = (): BookingForm => ({
	meeting_room_id: "",
	event_date: "",
	event_name: "",
	event_type: "MEETING",
	start_time: "09:00",
	end_time: "17:00",
	setup_start_time: "",
	teardown_end_time: "",
	organizer_name: "",
	organizer_company: "",
	organizer_email: "",
	organizer_phone: "",
	expected_attendees: null,
	setup_type: "THEATER",
	special_requests: "",
	catering_required: false,
	audio_visual_needed: false,
	rental_rate: null,
	currency_code: "USD",
});

@Component({
	selector: "app-function-space-calendar",
	standalone: true,
	imports: [
		FormsModule,
		IconComponent,
		PageHeaderComponent,
		SubmitOnEnterDirective,
		TranslatePipe,
		UnsavedGuardDirective,
	],
	templateUrl: "./function-space-calendar.html",
	styleUrl: "./function-space-calendar.scss",
})
export class FunctionSpaceCalendarComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	private readonly router = inject(Router);
	private readonly toast = inject(ToastService);
	readonly settings = inject(SettingsService);

	readonly eventTypes = EVENT_TYPES;
	readonly setupTypes = SETUP_TYPES;
	readonly bookingStatuses = BOOKING_STATUSES;

	readonly rooms = signal<MeetingRoomListItem[]>([]);
	readonly bookings = signal<EventBookingListItem[]>([]);
	readonly dataReady = signal(false);
	readonly submitting = signal(false);

	/** First day of the visible window (YYYY-MM-DD). */
	startDate = this.toDateStr(new Date());
	readonly viewDays = signal(14);
	readonly statusFilter = signal("");
	/** Cancelled and no-show bookings are hidden by default — they hold nothing. */
	readonly showReleased = signal(false);

	readonly editorOpen = signal(false);
	readonly form = signal<BookingForm>(emptyForm());

	readonly skeletonRows = Array.from({ length: 6 });

	/** Week start comes from settings, as in the rate calendar. */
	readonly weekStartDay = computed(() => {
		const val = this.settings.getString("ui.week_starts_on", "SUNDAY");
		return val === "MONDAY" ? 1 : 0;
	});

	readonly dateColumns = computed(() => {
		const dates: string[] = [];
		const start = new Date(`${this.startDate}T00:00:00`);
		for (let i = 0; i < this.viewDays(); i++) {
			const d = new Date(start);
			d.setDate(start.getDate() + i);
			dates.push(this.toDateStr(d));
		}
		return dates;
	});

	/** Only rooms that can still take a booking appear as rows. */
	readonly visibleRooms = computed(() => this.rooms().filter((r) => r.is_active));

	/** Bookings indexed by "roomId|date", which is exactly one grid cell. */
	readonly cellIndex = computed(() => {
		const index = new Map<string, EventBookingListItem[]>();
		const status = this.statusFilter();
		const released = this.showReleased();

		for (const booking of this.bookings()) {
			if (status && booking.booking_status !== status) continue;
			if (!released && !HOLDING_STATUSES.has(booking.booking_status)) continue;
			const key = `${booking.meeting_room_id}|${booking.event_date.slice(0, 10)}`;
			const list = index.get(key);
			if (list) list.push(booking);
			else index.set(key, [booking]);
		}

		for (const list of index.values()) {
			list.sort((a, b) => a.start_time.localeCompare(b.start_time));
		}
		return index;
	});

	/** Bookings in the window that still need a BEO, by due date. */
	readonly beoDueSoon = computed(() =>
		this.bookings().filter(
			(b) =>
				HOLDING_STATUSES.has(b.booking_status) &&
				b.beo_due_date !== null &&
				b.beo_due_date.slice(0, 10) <= this.toDateStr(new Date()),
		),
	);

	/** Tentative holds are the ones that quietly expire; worth a count. */
	readonly tentativeCount = computed(
		() => this.bookings().filter((b) => b.booking_status === "TENTATIVE").length,
	);

	readonly canSubmit = computed(() => {
		const f = this.form();
		if (!f.meeting_room_id || !f.event_date) return false;
		if (f.event_name.trim().length === 0) return false;
		if (f.organizer_name.trim().length === 0) return false;
		if (f.expected_attendees == null || f.expected_attendees <= 0) return false;
		if (!f.start_time || !f.end_time || f.end_time <= f.start_time) return false;
		if (f.setup_start_time && f.setup_start_time > f.start_time) return false;
		return true;
	});

	constructor() {
		effect(() => {
			const tenantId = this.auth.tenantId();
			const propertyId = this.ctx.propertyId();
			if (tenantId && propertyId) this.loadAll();
		});
	}

	// ── Formatting helpers ──

	private toDateStr(d: Date): string {
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, "0");
		const day = String(d.getDate()).padStart(2, "0");
		return `${y}-${m}-${day}`;
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

	dayOfWeek(date: string): string {
		return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" });
	}

	dayNum(date: string): string {
		return String(new Date(`${date}T00:00:00`).getDate());
	}

	isWeekend(date: string): boolean {
		const dow = new Date(`${date}T00:00:00`).getDay();
		return this.weekStartDay() === 1 ? dow === 6 || dow === 0 : dow === 0 || dow === 6;
	}

	isToday(date: string): boolean {
		return date === this.toDateStr(new Date());
	}

	/** HH:MM:SS from the API, HH:MM on screen. */
	shortTime(time: string): string {
		return time.slice(0, 5);
	}

	statusClass(status: string): string {
		switch (status) {
			case "CONFIRMED":
			case "IN_PROGRESS":
				return "chip chip-confirmed";
			case "DEFINITE":
				return "chip chip-definite";
			case "TENTATIVE":
			case "INQUIRY":
				return "chip chip-tentative";
			case "COMPLETED":
				return "chip chip-completed";
			default:
				return "chip chip-released";
		}
	}

	bookingsFor(roomId: string, date: string): EventBookingListItem[] {
		return this.cellIndex().get(`${roomId}|${date}`) ?? [];
	}

	// ── Navigation ──

	onStartDateChange(): void {
		this.loadBookings();
	}

	onViewDaysChange(days: number): void {
		this.viewDays.set(days);
		this.loadBookings();
	}

	shiftPeriod(direction: 1 | -1): void {
		const start = new Date(`${this.startDate}T00:00:00`);
		start.setDate(start.getDate() + direction * this.viewDays());
		this.startDate = this.toDateStr(start);
		this.loadBookings();
	}

	goToToday(): void {
		this.startDate = this.toDateStr(new Date());
		this.loadBookings();
	}

	openBooking(booking: EventBookingListItem): void {
		void this.router.navigate(["/events/bookings", booking.event_id]);
	}

	// ── Data ──

	async loadAll(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId || !propertyId) return;

		this.dataReady.set(false);
		try {
			const res = await this.api.get<{ data: MeetingRoomListItem[] } | MeetingRoomListItem[]>(
				"/meeting-rooms",
				{ tenant_id: tenantId, property_id: propertyId, limit: "200" },
			);
			this.rooms.set(Array.isArray(res) ? res : (res?.data ?? []));
			await this.loadBookings();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to load meeting rooms");
		} finally {
			this.dataReady.set(true);
		}
	}

	async loadBookings(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId || !propertyId) return;

		const dates = this.dateColumns();
		try {
			const res = await this.api.get<{ data: EventBookingListItem[] } | EventBookingListItem[]>(
				"/event-bookings",
				{
					tenant_id: tenantId,
					property_id: propertyId,
					event_date_from: dates[0] ?? "",
					event_date_to: dates[dates.length - 1] ?? "",
					limit: "500",
				},
			);
			this.bookings.set(Array.isArray(res) ? res : (res?.data ?? []));
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to load event bookings");
		}
	}

	// ── Booking form ──

	openCreate(roomId?: string, date?: string): void {
		const room = roomId ? this.rooms().find((r) => r.room_id === roomId) : undefined;
		this.form.set({
			...emptyForm(),
			meeting_room_id: roomId ?? this.visibleRooms()[0]?.room_id ?? "",
			event_date: date ?? this.dateColumns()[0] ?? this.toDateStr(new Date()),
			// A business day inside the room's operating hours, not the operating
			// hours themselves — defaulting to 07:00–23:00 because that is when the
			// room *could* open would have every new booking hold the whole day.
			start_time: this.laterOf("09:00", (room?.operating_hours_start ?? "").slice(0, 5)),
			end_time: this.earlierOf("17:00", (room?.operating_hours_end ?? "").slice(0, 5)),
			setup_type: room?.default_setup || "THEATER",
			currency_code: room?.currency_code || "USD",
			rental_rate: room?.full_day_rate ?? null,
		});
		this.editorOpen.set(true);
	}

	/** Clamp helpers for the default window; an absent bound leaves the default. */
	private laterOf(a: string, b: string): string {
		return b && b > a ? b : a;
	}

	private earlierOf(a: string, b: string): string {
		return b && b < a ? b : a;
	}

	cancelEditor(): void {
		this.editorOpen.set(false);
	}

	patchForm(patch: Partial<BookingForm>): void {
		this.form.set({ ...this.form(), ...patch });
	}

	async submitForm(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId || !propertyId || !this.canSubmit() || this.submitting()) return;
		const f = this.form();

		this.submitting.set(true);
		try {
			await this.api.post("/event-bookings", {
				tenant_id: tenantId,
				property_id: propertyId,
				meeting_room_id: f.meeting_room_id,
				event_date: f.event_date,
				event_name: f.event_name.trim(),
				event_type: f.event_type,
				start_time: f.start_time,
				end_time: f.end_time,
				organizer_name: f.organizer_name.trim(),
				expected_attendees: f.expected_attendees,
				setup_type: f.setup_type,
				catering_required: f.catering_required,
				audio_visual_needed: f.audio_visual_needed,
				currency_code: f.currency_code.trim() || "USD",
				...(f.setup_start_time ? { setup_start_time: f.setup_start_time } : {}),
				...(f.teardown_end_time ? { teardown_end_time: f.teardown_end_time } : {}),
				...(f.organizer_company.trim() ? { organizer_company: f.organizer_company.trim() } : {}),
				...(f.organizer_email.trim() ? { organizer_email: f.organizer_email.trim() } : {}),
				...(f.organizer_phone.trim() ? { organizer_phone: f.organizer_phone.trim() } : {}),
				...(f.special_requests.trim() ? { special_requests: f.special_requests.trim() } : {}),
				...(f.rental_rate != null ? { rental_rate: f.rental_rate } : {}),
			});
			this.toast.success("Event booking created.");
			this.editorOpen.set(false);
			await this.loadBookings();
		} catch (e) {
			// A 409 here is the overlap check doing its job — the room is already
			// held for part of that window, setup and teardown included.
			this.toast.error(e instanceof Error ? e.message : "Failed to create event booking");
		} finally {
			this.submitting.set(false);
		}
	}
}
