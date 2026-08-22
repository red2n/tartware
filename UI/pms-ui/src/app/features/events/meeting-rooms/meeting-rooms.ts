import { Component, computed, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import type { MeetingRoomListItem } from "@tartware/schemas";

import { ApiService } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { TenantContextService } from "../../../core/context/tenant-context.service";
import { I18nService } from "../../../core/i18n/i18n.service";
import { TranslatePipe } from "../../../core/i18n/translate.pipe";
import { IconComponent } from "../../../shared/components/icon/icon";
import { PageHeaderComponent } from "../../../shared/components/page-header/page-header";
import { SubmitOnEnterDirective } from "../../../shared/forms/submit-on-enter.directive";
import { UnsavedGuardDirective } from "../../../shared/forms/unsaved-guard.directive";
import { ToastService } from "../../../shared/toast/toast.service";

/**
 * Function space inventory admin — item 4 of ui-gaps/13-sales-catering.md.
 *
 * Reference data, so it follows the settings-style CRUD pattern rather than the
 * calendar: list, editor card, retire confirmation. Retiring is a soft delete —
 * event bookings and banquet orders reference `room_id` with ON DELETE RESTRICT,
 * so a room with history stops being bookable instead of disappearing.
 */

/** Matches `MeetingRoomTypeEnum` and the room_type CHECK constraint. */
const ROOM_TYPES = [
	"BALLROOM",
	"CONFERENCE",
	"BOARDROOM",
	"MEETING",
	"BANQUET",
	"EXHIBITION",
	"OUTDOOR",
	"THEATER",
	"CLASSROOM",
	"FLEXIBLE",
] as const;

/** Matches `MeetingRoomStatusEnum` and the room_status CHECK constraint. */
const ROOM_STATUSES = ["AVAILABLE", "OCCUPIED", "MAINTENANCE", "BLOCKED", "OUT_OF_ORDER"] as const;

/** Layouts a room can be set for. Mirrors `EventSetupTypeEnum`. */
const SETUPS = [
	"THEATER",
	"CLASSROOM",
	"BANQUET",
	"RECEPTION",
	"U_SHAPE",
	"HOLLOW_SQUARE",
	"BOARDROOM",
] as const;

type RoomForm = {
	room_code: string;
	room_name: string;
	room_type: string;
	room_status: string;
	max_capacity: number | null;
	building: string;
	floor: number | null;
	theater_capacity: number | null;
	classroom_capacity: number | null;
	banquet_capacity: number | null;
	reception_capacity: number | null;
	u_shape_capacity: number | null;
	boardroom_capacity: number | null;
	area_sqm: number | null;
	default_setup: string;
	setup_time_minutes: number | null;
	teardown_time_minutes: number | null;
	hourly_rate: number | null;
	half_day_rate: number | null;
	full_day_rate: number | null;
	currency_code: string;
	operating_hours_start: string;
	operating_hours_end: string;
	has_natural_light: boolean;
	has_audio_visual: boolean;
	has_video_conferencing: boolean;
	has_wifi: boolean;
	has_stage: boolean;
	has_dance_floor: boolean;
	wheelchair_accessible: boolean;
	is_active: boolean;
	requires_approval: boolean;
};

const emptyForm = (): RoomForm => ({
	room_code: "",
	room_name: "",
	room_type: "MEETING",
	room_status: "AVAILABLE",
	max_capacity: null,
	building: "",
	floor: null,
	theater_capacity: null,
	classroom_capacity: null,
	banquet_capacity: null,
	reception_capacity: null,
	u_shape_capacity: null,
	boardroom_capacity: null,
	area_sqm: null,
	default_setup: "",
	setup_time_minutes: null,
	teardown_time_minutes: null,
	hourly_rate: null,
	half_day_rate: null,
	full_day_rate: null,
	currency_code: "USD",
	operating_hours_start: "",
	operating_hours_end: "",
	has_natural_light: false,
	has_audio_visual: false,
	has_video_conferencing: false,
	has_wifi: false,
	has_stage: false,
	has_dance_floor: false,
	wheelchair_accessible: false,
	is_active: true,
	requires_approval: false,
});

@Component({
	selector: "app-meeting-rooms",
	standalone: true,
	imports: [
		FormsModule,
		IconComponent,
		PageHeaderComponent,
		SubmitOnEnterDirective,
		TranslatePipe,
		UnsavedGuardDirective,
	],
	templateUrl: "./meeting-rooms.html",
	styleUrl: "./meeting-rooms.scss",
})
export class MeetingRoomsComponent {
	private readonly api = inject(ApiService);
	private readonly i18n = inject(I18nService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	private readonly toast = inject(ToastService);

	readonly roomTypes = ROOM_TYPES;
	readonly roomStatuses = ROOM_STATUSES;
	readonly setups = SETUPS;

	readonly rooms = signal<MeetingRoomListItem[]>([]);
	readonly loading = signal(false);
	readonly submitting = signal(false);

	readonly typeFilter = signal("");
	readonly statusFilter = signal("");

	readonly editorOpen = signal(false);
	readonly editing = signal<MeetingRoomListItem | null>(null);
	readonly form = signal<RoomForm>(emptyForm());
	readonly retireTarget = signal<MeetingRoomListItem | null>(null);

	/** Placeholder rows while the list loads — six columns, matching the table. */
	readonly skeletonRows = Array.from({ length: 6 });
	readonly skeletonCols = Array.from({ length: 6 });

	/** Rooms that cannot currently take a booking, which is worth seeing at a glance. */
	readonly unbookable = computed(() =>
		this.rooms().filter((r) => !r.is_active || r.room_status !== "AVAILABLE"),
	);

	readonly canSubmit = computed(() => {
		const f = this.form();
		if (f.room_name.trim().length === 0) return false;
		if (f.max_capacity == null || f.max_capacity <= 0) return false;
		if (!this.editing() && !/^[A-Za-z0-9_-]{2,50}$/.test(f.room_code.trim())) return false;
		return true;
	});

	constructor() {
		effect(() => {
			if (this.auth.tenantId()) this.load();
		});
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

	statusClass(status: string): string {
		switch (status) {
			case "AVAILABLE":
				return "badge badge-accent badge-sm";
			case "OCCUPIED":
				return "badge badge-warning badge-sm";
			case "MAINTENANCE":
			case "BLOCKED":
			case "OUT_OF_ORDER":
				return "badge badge-attention badge-sm";
			default:
				return "badge badge-muted badge-sm";
		}
	}

	/** The layout capacities that are actually filled in, as one line. */
	capacitySummary(room: MeetingRoomListItem): string {
		const parts: string[] = [];
		if (room.theater_capacity) parts.push(`Theater ${room.theater_capacity}`);
		if (room.classroom_capacity) parts.push(`Classroom ${room.classroom_capacity}`);
		if (room.banquet_capacity) parts.push(`Banquet ${room.banquet_capacity}`);
		if (room.reception_capacity) parts.push(`Reception ${room.reception_capacity}`);
		if (room.u_shape_capacity) parts.push(`U-shape ${room.u_shape_capacity}`);
		if (room.boardroom_capacity) parts.push(`Boardroom ${room.boardroom_capacity}`);
		return parts.length > 0 ? parts.join(" · ") : "—";
	}

	/** Whichever rate basis the room is sold on. */
	rateSummary(room: MeetingRoomListItem): string {
		const cur = room.currency_code || "";
		if (room.full_day_rate) return `${room.full_day_rate} ${cur} / day`.trim();
		if (room.half_day_rate) return `${room.half_day_rate} ${cur} / half day`.trim();
		if (room.hourly_rate) return `${room.hourly_rate} ${cur} / hour`.trim();
		return "—";
	}

	featureIcons(room: MeetingRoomListItem): { icon: string; label: string }[] {
		const icons: { icon: string; label: string }[] = [];
		if (room.has_audio_visual) icons.push({ icon: "videocam", label: "Audio visual" });
		if (room.has_video_conferencing) icons.push({ icon: "duo", label: "Video conferencing" });
		if (room.has_wifi) icons.push({ icon: "wifi", label: "WiFi" });
		if (room.has_natural_light) icons.push({ icon: "wb_sunny", label: "Natural light" });
		if (room.has_stage) icons.push({ icon: "theater_comedy", label: "Stage" });
		if (room.has_dance_floor) icons.push({ icon: "music_note", label: "Dance floor" });
		if (room.wheelchair_accessible) icons.push({ icon: "accessible", label: "Step-free access" });
		return icons;
	}

	async load(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;
		this.loading.set(true);
		try {
			const params: Record<string, string> = { tenant_id: tenantId, limit: "200" };
			const propertyId = this.ctx.propertyId();
			if (propertyId) params["property_id"] = propertyId;
			const type = this.typeFilter().trim();
			if (type) params["room_type"] = type;
			const status = this.statusFilter().trim();
			if (status) params["room_status"] = status;

			const res = await this.api.get<{ data: MeetingRoomListItem[] } | MeetingRoomListItem[]>(
				"/meeting-rooms",
				params,
			);
			this.rooms.set(Array.isArray(res) ? res : (res?.data ?? []));
		} catch (e) {
			this.toast.error(
				e instanceof Error ? e.message : this.i18n.t("Failed to load meeting rooms"),
			);
		} finally {
			this.loading.set(false);
		}
	}

	openCreate(): void {
		this.editing.set(null);
		this.form.set(emptyForm());
		this.editorOpen.set(true);
	}

	openEdit(room: MeetingRoomListItem): void {
		this.editing.set(room);
		this.form.set({
			room_code: room.room_code,
			room_name: room.room_name,
			room_type: room.room_type,
			room_status: room.room_status,
			max_capacity: room.max_capacity,
			building: room.building ?? "",
			floor: room.floor,
			theater_capacity: room.theater_capacity,
			classroom_capacity: room.classroom_capacity,
			banquet_capacity: room.banquet_capacity,
			reception_capacity: room.reception_capacity,
			u_shape_capacity: room.u_shape_capacity,
			boardroom_capacity: room.boardroom_capacity,
			area_sqm: room.area_sqm,
			default_setup: room.default_setup ?? "",
			setup_time_minutes: room.setup_time_minutes,
			teardown_time_minutes: room.teardown_time_minutes,
			hourly_rate: room.hourly_rate,
			half_day_rate: room.half_day_rate,
			full_day_rate: room.full_day_rate,
			currency_code: room.currency_code || "USD",
			// The API returns TIME as HH:MM:SS; the time input wants HH:MM.
			operating_hours_start: (room.operating_hours_start ?? "").slice(0, 5),
			operating_hours_end: (room.operating_hours_end ?? "").slice(0, 5),
			has_natural_light: room.has_natural_light,
			has_audio_visual: room.has_audio_visual,
			has_video_conferencing: room.has_video_conferencing,
			has_wifi: room.has_wifi,
			has_stage: room.has_stage,
			has_dance_floor: room.has_dance_floor,
			wheelchair_accessible: room.wheelchair_accessible,
			is_active: room.is_active,
			requires_approval: room.requires_approval,
		});
		this.editorOpen.set(true);
	}

	cancelEditor(): void {
		this.editorOpen.set(false);
		this.editing.set(null);
	}

	patchForm(patch: Partial<RoomForm>): void {
		this.form.set({ ...this.form(), ...patch });
	}

	async submitForm(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId || !this.canSubmit() || this.submitting()) return;
		const f = this.form();
		const existing = this.editing();

		// Only send what is set: the write schema treats every optional field as
		// absent-means-unchanged, and an empty string is not a valid enum or TIME.
		const body: Record<string, unknown> = {
			tenant_id: tenantId,
			room_name: f.room_name.trim(),
			room_type: f.room_type,
			room_status: f.room_status,
			max_capacity: f.max_capacity,
			currency_code: f.currency_code.trim() || "USD",
			has_natural_light: f.has_natural_light,
			has_audio_visual: f.has_audio_visual,
			has_video_conferencing: f.has_video_conferencing,
			has_wifi: f.has_wifi,
			has_stage: f.has_stage,
			has_dance_floor: f.has_dance_floor,
			wheelchair_accessible: f.wheelchair_accessible,
			is_active: f.is_active,
			requires_approval: f.requires_approval,
			...(f.building.trim() ? { building: f.building.trim() } : {}),
			...(f.floor != null ? { floor: f.floor } : {}),
			...(f.theater_capacity != null ? { theater_capacity: f.theater_capacity } : {}),
			...(f.classroom_capacity != null ? { classroom_capacity: f.classroom_capacity } : {}),
			...(f.banquet_capacity != null ? { banquet_capacity: f.banquet_capacity } : {}),
			...(f.reception_capacity != null ? { reception_capacity: f.reception_capacity } : {}),
			...(f.u_shape_capacity != null ? { u_shape_capacity: f.u_shape_capacity } : {}),
			...(f.boardroom_capacity != null ? { boardroom_capacity: f.boardroom_capacity } : {}),
			...(f.area_sqm != null ? { area_sqm: f.area_sqm } : {}),
			...(f.default_setup ? { default_setup: f.default_setup } : {}),
			...(f.setup_time_minutes != null ? { setup_time_minutes: f.setup_time_minutes } : {}),
			...(f.teardown_time_minutes != null
				? { teardown_time_minutes: f.teardown_time_minutes }
				: {}),
			...(f.hourly_rate != null ? { hourly_rate: f.hourly_rate } : {}),
			...(f.half_day_rate != null ? { half_day_rate: f.half_day_rate } : {}),
			...(f.full_day_rate != null ? { full_day_rate: f.full_day_rate } : {}),
			...(f.operating_hours_start ? { operating_hours_start: f.operating_hours_start } : {}),
			...(f.operating_hours_end ? { operating_hours_end: f.operating_hours_end } : {}),
		};

		this.submitting.set(true);
		try {
			if (existing) {
				await this.api.put(`/meeting-rooms/${existing.room_id}`, body);
				this.toast.success(this.i18n.t("Meeting room updated."));
			} else {
				const propertyId = this.ctx.propertyId();
				if (!propertyId) {
					this.toast.error(this.i18n.t("Select a property before creating a meeting room."));
					return;
				}
				await this.api.post("/meeting-rooms", {
					...body,
					property_id: propertyId,
					room_code: f.room_code.trim().toUpperCase(),
				});
				this.toast.success(this.i18n.t("Meeting room created."));
			}
			this.editorOpen.set(false);
			this.editing.set(null);
			await this.load();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : this.i18n.t("Failed to save meeting room"));
		} finally {
			this.submitting.set(false);
		}
	}

	openRetire(room: MeetingRoomListItem): void {
		this.retireTarget.set(room);
	}

	cancelRetire(): void {
		this.retireTarget.set(null);
	}

	async confirmRetire(): Promise<void> {
		const room = this.retireTarget();
		const tenantId = this.auth.tenantId();
		if (!room || !tenantId || this.submitting()) return;
		this.submitting.set(true);
		try {
			await this.api.delete(`/meeting-rooms/${room.room_id}?tenant_id=${tenantId}`);
			this.toast.success(this.i18n.t("{p0} retired.", { p0: room.room_code }));
			this.retireTarget.set(null);
			await this.load();
		} catch (e) {
			this.toast.error(
				e instanceof Error ? e.message : this.i18n.t("Failed to retire meeting room"),
			);
		} finally {
			this.submitting.set(false);
		}
	}
}
