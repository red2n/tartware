import { NgClass } from "@angular/common";
import { Component, computed, inject, type OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import {
	type GroupBlockStatus,
	GroupBlockStatusDescriptions,
	type GroupBookingDetail,
} from "@tartware/schemas";
import { ProgressSpinnerModule } from "primeng/progressspinner";
import { TooltipModule } from "primeng/tooltip";
import { ApiService } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { I18nService } from "../../../core/i18n/i18n.service";
import { TranslatePipe } from "../../../core/i18n/translate.pipe";
import { SettingsService } from "../../../core/settings/settings.service";
import { groupBlockStatusClass, roomBlockStatusClass } from "../../../shared/badge-utils";
import { IconComponent } from "../../../shared/components/icon/icon";
import { SubmitOnEnterDirective } from "../../../shared/forms/submit-on-enter.directive";
import { UnsavedGuardDirective } from "../../../shared/forms/unsaved-guard.directive";
import { ToastService } from "../../../shared/toast/toast.service";

type DetailRow = { label: string; value: string; badge?: string; description?: string };

type RoomTypeOption = { room_type_id: string; type_name: string; base_price: number };

/** One editable row of the rooming list — a guest to be booked into the block. */
type RoomingGuestRow = {
	guest_name: string;
	guest_email: string;
	room_type_id: string;
	arrival_date: string;
	departure_date: string;
};

/**
 * Expands a block date range into one entry per night.
 *
 * Blocks are held per night, so the departure date is excluded — a group
 * arriving on the 12th and departing on the 15th consumes inventory on the
 * 12th, 13th and 14th. Exported as a pure function so the date arithmetic is
 * testable without standing up the component.
 */
export const expandBlockNights = (startDate: string, endDate: string): string[] => {
	if (!startDate || !endDate) return [];
	const start = new Date(`${startDate}T00:00:00Z`);
	const end = new Date(`${endDate}T00:00:00Z`);
	if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return [];

	const nights: string[] = [];
	for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
		nights.push(d.toISOString().slice(0, 10));
	}
	return nights;
};

@Component({
	selector: "app-group-detail",
	standalone: true,
	imports: [
		NgClass,
		FormsModule,
		RouterLink,
		IconComponent,
		ProgressSpinnerModule,
		TooltipModule,
		TranslatePipe,
		UnsavedGuardDirective,

		SubmitOnEnterDirective,
	],
	templateUrl: "./group-detail.html",
	styleUrl: "./group-detail.scss",
})
export class GroupDetailComponent implements OnInit {
	private readonly api = inject(ApiService);
	private readonly i18n = inject(I18nService);
	private readonly auth = inject(AuthService);
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	private readonly toast = inject(ToastService);
	readonly settings = inject(SettingsService);

	readonly group = signal<GroupBookingDetail | null>(null);
	readonly loading = signal(false);
	readonly error = signal<string | null>(null);
	readonly roomTypes = signal<RoomTypeOption[]>([]);

	/* ── Action state ── */
	readonly actionLoading = signal(false);
	readonly actionSuccess = signal<string | null>(null);
	readonly actionError = signal<string | null>(null);
	readonly confirmingCheckIn = signal(false);
	readonly preferredFloor = signal<number | null>(null);

	/* ── Add room block form ── */
	readonly addingBlock = signal(false);
	readonly blockRoomTypeId = signal("");
	readonly blockStartDate = signal("");
	readonly blockEndDate = signal("");
	readonly blockRooms = signal<number | null>(null);
	readonly blockRate = signal<number | null>(null);

	/** Nights the current block form covers — drives the preview and validation. */
	readonly blockNights = computed(() =>
		expandBlockNights(this.blockStartDate(), this.blockEndDate()),
	);

	readonly canSubmitBlock = computed(() => {
		const rooms = this.blockRooms();
		const rate = this.blockRate();
		return (
			this.blockRoomTypeId() !== "" &&
			this.blockNights().length > 0 &&
			rooms != null &&
			rooms > 0 &&
			rate != null &&
			rate >= 0
		);
	});

	/* ── Rooming list (book) form ── */
	readonly bookingRoomingList = signal(false);
	readonly roomingGuests = signal<RoomingGuestRow[]>([]);

	readonly canSubmitRoomingList = computed(
		() =>
			this.roomingGuests().every(
				(g) =>
					g.guest_name.trim() !== "" &&
					g.room_type_id !== "" &&
					g.arrival_date !== "" &&
					g.departure_date !== "" &&
					g.departure_date > g.arrival_date,
			) && this.roomingGuests().length > 0,
	);

	statusClass = groupBlockStatusClass;
	blockStatusClass = roomBlockStatusClass;
	formatDate(dateStr: string): string {
		return this.settings.formatDate(dateStr);
	}
	formatCurrency(amount: number, currency?: string): string {
		return this.settings.formatCurrency(amount, currency);
	}

	/** A group in a terminal state accepts no further inventory or booking actions. */
	private readonly isEditable = computed(() => {
		const g = this.group();
		if (!g) return false;
		return !new Set(["CANCELLED", "COMPLETED"]).has(g.block_status.toUpperCase());
	});

	/** Group can be checked in when status is active (not cancelled/completed) and rooms have been picked. */
	readonly canCheckIn = computed(() => {
		const g = this.group();
		if (!g) return false;
		return this.isEditable() && g.total_rooms_picked > 0;
	});

	/** Rooms can be blocked while the group is live. */
	readonly canAddRooms = computed(() => this.isEditable());

	/**
	 * Booking requires inventory to draw from — without a block there is nothing
	 * to pick up, and the reservation would be created outside the group's
	 * allotment.
	 */
	readonly canBookRoomingList = computed(() => {
		const g = this.group();
		if (!g) return false;
		return this.isEditable() && g.total_rooms_blocked > 0;
	});

	readonly groupTypeIcon: Record<string, { icon: string; tooltip: string }> = {
		CONFERENCE: { icon: "groups", tooltip: "Conference" },
		WEDDING: { icon: "favorite", tooltip: "Wedding" },
		CORPORATE: { icon: "business", tooltip: "Corporate" },
		TOUR_GROUP: { icon: "tour", tooltip: "Tour Group" },
		SPORTS_TEAM: { icon: "sports", tooltip: "Sports Team" },
		REUNION: { icon: "celebration", tooltip: "Reunion" },
		CONVENTION: { icon: "location_city", tooltip: "Convention" },
		GOVERNMENT: { icon: "account_balance", tooltip: "Government" },
		AIRLINE_CREW: { icon: "flight", tooltip: "Airline Crew" },
		EDUCATIONAL: { icon: "school", tooltip: "Educational" },
		OTHER: { icon: "more_horiz", tooltip: "Other" },
	};

	readonly groupInfoRows = computed<DetailRow[]>(() => {
		const g = this.group();
		if (!g) return [];
		return [
			{ label: "Group Name", value: g.group_name },
			{ label: "Group Code", value: g.group_code ?? "—" },
			{
				label: "Type",
				value: g.group_type_display,
			},
			{
				label: "Status",
				value: g.block_status_display,
				badge: this.statusClass(g.block_status),
				description: GroupBlockStatusDescriptions[g.block_status as GroupBlockStatus] ?? "",
			},
			{ label: "Organization", value: g.organization_name ?? "—" },
			{ label: "Event", value: g.event_name ?? "—" },
			{ label: "Active", value: g.is_active ? "Yes" : "No" },
			{ label: "Confidence", value: g.booking_confidence ?? "—" },
		];
	});

	readonly stayRows = computed<DetailRow[]>(() => {
		const g = this.group();
		if (!g) return [];
		return [
			{ label: "Arrival", value: this.formatDate(g.arrival_date) },
			{ label: "Departure", value: this.formatDate(g.departure_date) },
			{ label: "Nights", value: String(g.number_of_nights) },
			{ label: "Cutoff Date", value: this.formatDate(g.cutoff_date) },
			{
				label: "Cutoff Days Before",
				value: g.cutoff_days_before_arrival != null ? String(g.cutoff_days_before_arrival) : "—",
			},
			{
				label: "Release Unsold",
				value: g.release_unsold_rooms ? "Yes" : "No",
			},
		];
	});

	readonly contactRows = computed<DetailRow[]>(() => {
		const g = this.group();
		if (!g) return [];
		return [
			{ label: "Contact Name", value: g.contact_name },
			{ label: "Email", value: g.contact_email ?? "—" },
			{ label: "Phone", value: g.contact_phone ?? "—" },
		];
	});

	readonly roomRows = computed<DetailRow[]>(() => {
		const g = this.group();
		if (!g) return [];
		return [
			{ label: "Rooms Requested", value: String(g.total_rooms_requested) },
			{ label: "Rooms Blocked", value: String(g.total_rooms_blocked) },
			{ label: "Rooms Picked", value: String(g.total_rooms_picked) },
			{ label: "Rooms Confirmed", value: String(g.total_rooms_confirmed) },
			{
				label: "Pickup %",
				value: `${g.pickup_percentage}%`,
				badge: this.pickupBadge(g.pickup_percentage),
			},
			{
				label: "Rooming List",
				value: g.rooming_list_received ? "Received" : "Pending",
				badge: g.rooming_list_received ? "badge-success" : "badge-warning",
			},
			{
				label: "Rooming Deadline",
				value: g.rooming_list_deadline ? this.formatDate(g.rooming_list_deadline) : "—",
			},
		];
	});

	readonly financialRows = computed<DetailRow[]>(() => {
		const g = this.group();
		if (!g) return [];
		return [
			{
				label: "Negotiated Rate",
				value: g.negotiated_rate ? this.formatCurrency(+g.negotiated_rate, "USD") : "—",
			},
			{
				label: "Deposit Amount",
				value: g.deposit_amount ? this.formatCurrency(+g.deposit_amount, "USD") : "—",
			},
			{
				label: "Deposit Received",
				value: g.deposit_received ? "Yes" : "No",
				badge: g.deposit_received ? "badge-success" : "badge-warning",
			},
			{
				label: "Estimated Revenue",
				value: g.estimated_total_revenue
					? this.formatCurrency(+g.estimated_total_revenue, "USD")
					: "—",
			},
			{
				label: "Actual Revenue",
				value: g.actual_revenue ? this.formatCurrency(+g.actual_revenue, "USD") : "—",
			},
			{
				label: "Contract Signed",
				value: g.contract_signed ? "Yes" : "No",
				badge: g.contract_signed ? "badge-success" : "badge-muted",
			},
		];
	});

	ngOnInit(): void {
		const id = this.route.snapshot.paramMap.get("groupId");
		if (id) {
			this.loadGroup(id);
		}
	}

	async loadGroup(id: string): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;

		this.loading.set(true);
		this.error.set(null);

		try {
			const res = await this.api.get<GroupBookingDetail>(`/group-bookings/${id}`, {
				tenant_id: tenantId,
			});
			this.group.set(res);
		} catch (e) {
			this.error.set(e instanceof Error ? e.message : "Failed to load group booking");
		} finally {
			this.loading.set(false);
		}
	}

	/**
	 * Room types are only needed by the block and rooming-list forms, so this is
	 * loaded lazily on first use rather than on every detail view.
	 */
	private async ensureRoomTypes(): Promise<void> {
		if (this.roomTypes().length > 0) return;
		const tenantId = this.auth.tenantId();
		const g = this.group();
		if (!tenantId || !g) return;

		try {
			const res = await this.api.get<RoomTypeOption[]>("/room-types", {
				tenant_id: tenantId,
				property_id: g.property_id,
			});
			this.roomTypes.set(Array.isArray(res) ? res : []);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : this.i18n.t("Failed to load room types"));
		}
	}

	goBack(): void {
		this.router.navigate(["/groups"]);
	}

	/* ── Check-in action flow ── */

	showCheckInConfirm(): void {
		this.clearActionState();
		this.confirmingCheckIn.set(true);
		this.preferredFloor.set(null);
	}

	cancelAction(): void {
		this.confirmingCheckIn.set(false);
		this.addingBlock.set(false);
		this.bookingRoomingList.set(false);
	}

	/**
	 * Dispatch the `group.check_in` command via Command Center.
	 * Uses proximity-based room assignment on the backend.
	 */
	async checkInGroup(): Promise<void> {
		const g = this.group();
		const tenantId = this.auth.tenantId();
		if (!g || !tenantId) return;

		this.actionLoading.set(true);
		this.actionError.set(null);
		this.actionSuccess.set(null);

		try {
			const payload: Record<string, unknown> = {
				group_booking_id: g.group_booking_id,
			};
			const floor = this.preferredFloor();
			if (floor != null) payload["preferred_floor"] = floor;

			await this.api.post(`/tenants/${tenantId}/commands/group.check_in`, payload);

			this.toast.success(
				this.i18n.t('Group "{p0}" check-in initiated. Rooms are being assigned.', {
					p0: g.group_name,
				}),
			);
			this.confirmingCheckIn.set(false);
			await this.pollGroupUntilChanged(g.group_booking_id);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : this.i18n.t("Group check-in failed"));
		} finally {
			this.actionLoading.set(false);
		}
	}

	/* ── Add room block flow ── */

	async showAddBlock(): Promise<void> {
		const g = this.group();
		if (!g) return;
		this.clearActionState();
		await this.ensureRoomTypes();
		// Default the range to the group's own stay so the common case is one click.
		this.blockRoomTypeId.set("");
		this.blockStartDate.set(g.arrival_date.slice(0, 10));
		this.blockEndDate.set(g.departure_date.slice(0, 10));
		this.blockRooms.set(g.total_rooms_requested || null);
		this.blockRate.set(g.negotiated_rate != null ? Number(g.negotiated_rate) : null);
		this.addingBlock.set(true);
	}

	/**
	 * Dispatch `group.add_rooms`, expanding the chosen range into one block
	 * entry per night. The backend upserts on
	 * (tenant, group, room_type, block_date), so re-submitting a range simply
	 * updates those nights rather than duplicating them.
	 */
	async addRoomBlock(): Promise<void> {
		const g = this.group();
		const tenantId = this.auth.tenantId();
		if (!g || !tenantId || !this.canSubmitBlock()) return;

		this.actionLoading.set(true);
		try {
			const blocks = this.blockNights().map((night) => ({
				room_type_id: this.blockRoomTypeId(),
				block_date: night,
				blocked_rooms: this.blockRooms(),
				negotiated_rate: this.blockRate(),
			}));

			await this.api.post(`/tenants/${tenantId}/commands/group.add_rooms`, {
				group_booking_id: g.group_booking_id,
				blocks,
			});

			this.toast.success(
				`Blocked ${this.blockRooms()} room(s) across ${blocks.length} night(s) for "${g.group_name}".`,
			);
			this.addingBlock.set(false);
			await this.pollGroupUntilChanged(
				g.group_booking_id,
				(prev, next) => next.room_blocks.length !== prev.room_blocks.length,
			);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : this.i18n.t("Failed to add room block"));
		} finally {
			this.actionLoading.set(false);
		}
	}

	/* ── Rooming list (book) flow ── */

	async showRoomingList(): Promise<void> {
		const g = this.group();
		if (!g) return;
		this.clearActionState();
		await this.ensureRoomTypes();
		this.roomingGuests.set([this.blankGuestRow()]);
		this.bookingRoomingList.set(true);
	}

	private blankGuestRow(): RoomingGuestRow {
		const g = this.group();
		return {
			guest_name: "",
			guest_email: "",
			room_type_id: this.group()?.room_blocks[0]?.room_type_id ?? "",
			arrival_date: g ? g.arrival_date.slice(0, 10) : "",
			departure_date: g ? g.departure_date.slice(0, 10) : "",
		};
	}

	addGuestRow(): void {
		this.roomingGuests.update((rows) => [...rows, this.blankGuestRow()]);
	}

	removeGuestRow(index: number): void {
		this.roomingGuests.update((rows) => rows.filter((_, i) => i !== index));
	}

	updateGuestRow(index: number, field: keyof RoomingGuestRow, value: string): void {
		this.roomingGuests.update((rows) =>
			rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
		);
	}

	/**
	 * Dispatch `group.upload_rooming_list` — the booking step. The backend
	 * creates one CONFIRMED reservation per guest, linked to this group, and
	 * decrements the block.
	 */
	async bookRoomingList(): Promise<void> {
		const g = this.group();
		const tenantId = this.auth.tenantId();
		if (!g || !tenantId || !this.canSubmitRoomingList()) return;

		this.actionLoading.set(true);
		try {
			const guests = this.roomingGuests().map((row) => ({
				guest_name: row.guest_name.trim(),
				room_type_id: row.room_type_id,
				arrival_date: row.arrival_date,
				departure_date: row.departure_date,
				...(row.guest_email.trim() ? { guest_email: row.guest_email.trim() } : {}),
			}));

			await this.api.post(`/tenants/${tenantId}/commands/group.upload_rooming_list`, {
				group_booking_id: g.group_booking_id,
				guests,
				rooming_list_format: "portal",
			});

			this.toast.success(
				`Booking ${guests.length} reservation(s) for "${g.group_name}". Rooms are being picked up from the block.`,
			);
			this.bookingRoomingList.set(false);
			await this.pollGroupUntilChanged(
				g.group_booking_id,
				(prev, next) => next.total_rooms_picked !== prev.total_rooms_picked,
			);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : this.i18n.t("Failed to book rooming list"));
		} finally {
			this.actionLoading.set(false);
		}
	}

	private clearActionState(): void {
		this.actionSuccess.set(null);
		this.actionError.set(null);
		this.confirmingCheckIn.set(false);
		this.addingBlock.set(false);
		this.bookingRoomingList.set(false);
	}

	/**
	 * Commands are async (Kafka). Poll the group booking until we detect the
	 * change this action was expected to produce, so the UI refreshes on its
	 * own. Each caller supplies the predicate for its own effect — a block add
	 * never changes block_status, so a shared status check would always time
	 * out and leave the view stale.
	 *
	 * Always resolves: the poll is a convenience refresh, and the command has
	 * already been accepted by the time we get here.
	 */
	private async pollGroupUntilChanged(
		id: string,
		hasChanged: (previous: GroupBookingDetail, next: GroupBookingDetail) => boolean = (p, n) =>
			p.block_status !== n.block_status,
	): Promise<void> {
		const previous = this.group();
		if (!previous) return;

		for (let i = 0; i < 8; i++) {
			await new Promise((r) => setTimeout(r, 800));
			await this.loadGroup(id);
			const current = this.group();
			if (current && hasChanged(previous, current)) return;
		}
	}

	private pickupBadge(percentage: number): string {
		if (percentage >= 80) return "badge-success";
		if (percentage >= 50) return "badge-warning";
		return "badge-danger";
	}
}
